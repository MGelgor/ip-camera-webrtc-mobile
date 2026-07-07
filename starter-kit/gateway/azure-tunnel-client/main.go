package main

import (
	"crypto/sha256"
	"encoding/base64"
	"flag"
	"io"
	"log"
	"net"
	"os"
	"strings"
	"time"

	"golang.org/x/crypto/ssh"
)

func main() {
	sshHost := flag.String("ssh-host", "test.multitek.com.tr:22", "Azure SSH host:port")
	sshUser := flag.String("ssh-user", "azureadmin", "Azure SSH username")
	keyPath := flag.String("key", "", "private key path")
	hostKeySHA256 := flag.String("host-key-sha256", "", "expected SSH host key SHA256 fingerprint")
	remoteAddr := flag.String("remote", "127.0.0.1:1984", "remote listen address")
	localAddr := flag.String("local", "127.0.0.1:1984", "local gateway address")
	retryDelay := flag.Duration("retry-delay", 10*time.Second, "reconnect delay")
	flag.Parse()

	if *keyPath == "" || *hostKeySHA256 == "" {
		log.Fatal("-key and -host-key-sha256 are required")
	}

	signer, err := signerFromFile(*keyPath)
	if err != nil {
		log.Fatalf("read key: %v", err)
	}

	config := &ssh.ClientConfig{
		User:            *sshUser,
		Auth:            []ssh.AuthMethod{ssh.PublicKeys(signer)},
		HostKeyCallback: hostKeyCallback(*hostKeySHA256),
		HostKeyAlgorithms: []string{
			ssh.KeyAlgoED25519,
		},
		Timeout: 20 * time.Second,
	}

	for {
		if err := runTunnel(*sshHost, *remoteAddr, *localAddr, config); err != nil {
			log.Printf("tunnel stopped: %v", err)
		}
		time.Sleep(*retryDelay)
	}
}

func signerFromFile(path string) (ssh.Signer, error) {
	key, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	return ssh.ParsePrivateKey(key)
}

func hostKeyCallback(expected string) ssh.HostKeyCallback {
	expected = strings.TrimPrefix(strings.TrimSpace(expected), "SHA256:")
	return func(hostname string, remote net.Addr, key ssh.PublicKey) error {
		sum := sha256.Sum256(key.Marshal())
		actual := base64.RawStdEncoding.EncodeToString(sum[:])
		if actual != expected {
			return &hostKeyError{expected: expected, actual: actual}
		}
		return nil
	}
}

type hostKeyError struct {
	expected string
	actual   string
}

func (e *hostKeyError) Error() string {
	return "unexpected SSH host key SHA256:" + e.actual + " expected:" + e.expected
}

func runTunnel(sshHost, remoteAddr, localAddr string, config *ssh.ClientConfig) error {
	log.Printf("connecting ssh=%s remote=%s local=%s", sshHost, remoteAddr, localAddr)
	client, err := ssh.Dial("tcp", sshHost, config)
	if err != nil {
		return err
	}
	defer client.Close()

	listener, err := client.Listen("tcp", remoteAddr)
	if err != nil {
		return err
	}
	defer listener.Close()
	log.Printf("remote listener ready: %s", remoteAddr)

	for {
		remoteConn, err := listener.Accept()
		if err != nil {
			return err
		}
		go handleConn(remoteConn, localAddr)
	}
}

func handleConn(remoteConn net.Conn, localAddr string) {
	defer remoteConn.Close()

	localConn, err := net.DialTimeout("tcp", localAddr, 5*time.Second)
	if err != nil {
		log.Printf("local dial failed: %v", err)
		return
	}
	defer localConn.Close()

	done := make(chan struct{}, 2)
	go copyAndClose(localConn, remoteConn, done)
	go copyAndClose(remoteConn, localConn, done)
	<-done
}

func copyAndClose(dst net.Conn, src net.Conn, done chan<- struct{}) {
	_, _ = io.Copy(dst, src)
	_ = dst.Close()
	_ = src.Close()
	done <- struct{}{}
}
