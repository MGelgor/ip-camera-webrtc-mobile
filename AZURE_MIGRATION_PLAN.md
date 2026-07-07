# Azure Migration Plan

Bu plan 4.210.154.232 adresindeki `Sunucu05` uzerinde yapilan read-only kesfe gore
hazirlandi. En kritik kural: sunucuda calisan mevcut sirket servislerine dokunulmayacak.

## Read-only Kesif Ozeti

- OS: Ubuntu 24.04.4 LTS
- Private IP: `10.3.0.4`
- Public IP: `4.210.154.232`
- Ilk kesifte Docker kurulu degildi; kurulumda Docker kullanilmadi.
- Ilk kesifte Node.js/npm kurulu degildi; kurulumda sistem paketleriyle Node.js/npm eklendi.
- UFW inactive.
- Aktif sirket servisleri:
  - Kamailio: SIP `5060/udp`, `5060/tcp`, `5061/tcp`
  - rtpengine: RTP/media proxy
  - Tomcat: `8080`, `8093`, `8096`
  - ActiveMQ: `1883`, local `61616`, local `8161`
  - MariaDB: local `3306`
  - MongoDB: `27017`
- `/opt` altinda `tomcat` ve `activemq` kullanimda.

## TURN / rtpengine Notu

Bu projede rtpengine kullanilmiyor. rtpengine, Sunucu05 uzerinde calisan mevcut
sirket SIP/media sistemine ait.

Ilk risk notu port cakismasi degildi; ayni Linux makinede UDP paketlerinin rtpengine
iptables/nft zincirinden gecmesiyle ilgiliydi.

- rtpengine aktif ve UDP paketlerini iptables/nft uzerinden isliyor.
- rtpengine media port araligi: `49200-65300/udp`
- Bu projenin TURN relay araligi varsayilan olarak `48160-48200/udp`.
- Bu iki aralik dogrudan cakismiyor.

Kurulum oncesi yapilan degisikliksiz test sonucu:

- `3478/udp`, `48160/udp`, `48200/udp` icin gecici local UDP listener acildi.
- Sunucunun kendi private IP'sine gonderilen UDP paketleri userspace listener'a ulasti.
- Bu, rtpengine zincirinin bu portlarda paketi tamamen yutmadigini gosterir.
- Public IP uzerinden gonderilen UDP probe paketleri o asamada sunucuya ulasmadi.
- Bu, Azure NSG veya upstream firewall tarafinda UDP portlarinin henuz acik olmadigini
  gostermisti.

Guvenli karar:

- Signaling bu VM'de izole edilebilir.
- TURN ayni VM'de teknik olarak denenebilir, cunku secilen port araligi rtpengine ile
  cakismiyor ve local userspace delivery testi gecti.
- Production icin yine de Azure NSG kurallari acilmadan ve coturn allocation/relay testi
  gecmeden canliya alinmamalidir.
- En temiz mimari, mumkunse TURN icin ayri Azure VM veya ayri public IP/network policy
  kullanmaktir.

## Onerilen Mimari

```text
Mobile App
  -> WSS Signaling on Azure Sunucu05
  -> secure tunnel / VPN
  -> Camera LAN go2rtc gateway

Mobile App
  -> TURN on Sunucu05 or separate Azure VM
```

go2rtc kamera LAN'inda kalmali. RTSP credential'lari Azure signaling veya mobil APK
icinde gereksiz yere buyutulmemeli.

## Sunucu05 Uzerinde Guvenli Signaling Kurulum Prensibi

- Yeni Linux kullanicisi: `ipcam`
- Yeni dizin: `/opt/ip-camera-webrtc-mobile`
- Mevcut `/opt/tomcat` ve `/opt/activemq` dizinlerine dokunulmayacak.
- Mevcut systemd unit'leri degistirilmeyecek.
- Mevcut 8080/8093/8096/5060/5061/1883/27017/3306 portlari kullanilmayacak.
- Signaling icin onerilen port: `13000/tcp`
- Signaling process'i reverse proxy'ye baglanmadan once dogrudan kendi TLS'iyle
  calisabilir.

## Gateway Baglantisi

Azure signaling server kodu go2rtc API/WebSocket'e server tarafindan baglanir. Bu yuzden
`GATEWAY_HOST:GO2RTC_API_PORT` Azure'dan erisilebilir olmalidir.

Guvenli secenek sirasi:

1. WireGuard/VPN ile Azure -> kamera LAN ozel ag erisimi
2. Gateway tarafindan Azure'a reverse SSH tunnel, Azure'da yalniz `127.0.0.1` bind
3. Son care: go2rtc API'yi internete acmak ve yalniz Azure IP'sine izin vermek

Onerilen ilk uygulama: reverse SSH tunnel veya VPN. go2rtc `1984` public acilmamali.

## Yapilacaklar

1. Azure NSG'de sadece gerekli portlar icin kural planla.
   - Signaling: `13000/tcp`
   - TURN: `3478/tcp`, `3478/udp`, `48160-48200/udp`
2. Sunucu05'e Node.js'i mevcut sisteme global kurmadan izole runtime olarak yerlestir.
3. Projeyi `/opt/ip-camera-webrtc-mobile` altina koy.
4. `.env` dosyasini repo disinda, `600` izinle olustur.
5. Signaling'i `ipcam` kullanicisiyle systemd unit olarak calistir.
6. `SIGNALING_TLS_CERT_PATH` ve `SIGNALING_TLS_KEY_PATH` ile WSS'i aktif et.
7. Gateway erisim yolunu VPN/reverse tunnel ile dogrula.
8. Mobil build icin `EXPO_PUBLIC_SIGNALING_URL=wss://<host>:13000/ws` kullan.
9. Test sirasi:
   - `GET /health`
   - `POST /auth/login`
   - `GET /cameras`
   - `GET /gateway/status?src=ofis_kamera`
   - `WSS /ws`
   - mobil veri uzerinden canli goruntu

## 2026-07-07 Kurulum Durumu

Sunucu uzerinde Docker kullanilmadan su kurulum yapildi:

- Sistem kullanicisi: `ipcam`
- Uygulama dizini: `/opt/ip-camera-webrtc-mobile`
- Config dizini: `/etc/ip-camera-webrtc-mobile`
- State/log dizinleri:
  - `/var/lib/ip-camera-webrtc-mobile`
  - `/var/log/ip-camera-webrtc-mobile`
- Paketler:
  - `coturn`
  - `nodejs`
  - `npm`
- Default paket servisi:
  - `coturn.service` disabled/inactive birakildi.
- Proje servisleri:
  - `ip-camera-coturn.service` enabled/active
  - `ip-camera-signaling.service` enabled/active

Dinleyen proje portlari:

- `13000/tcp`: signaling HTTPS/WSS
- `3478/tcp`: coturn
- `3478/udp`: coturn
- `48160-48200/udp`: coturn relay allocation araligi; portlar allocation sirasinda kullanilir

Local dogrulamalar:

- `http://127.0.0.1:13000/health` 200 dondu.
- Yetkisiz `/cameras` 401 dondu.
- `/auth/login` 200 dondu.
- Yetkili `/cameras` 200 dondu ve katalogda TURN bilgisi var.
- `turnutils_stunclient 10.3.0.4 -p 3478` cevap aldi.

Dis ag durumu:

- `https://test.multitek.com.tr:13000/health` public 200 donuyor.
- `3478/tcp` public baglanti testi basarili.
- `3478/udp` STUN testi public taraftan cevap aldi.
- `48160/udp` ve `48200/udp` public UDP probe paketleri sunucuya ulasti.

Not:

- Paket kurulumu sirasinda Ubuntu `needrestart`, `tomcat.service` icin restart uyguladi.
  Son kontrolde Tomcat dahil kritik servislerin tamami active durumdaydi.
- Signaling `test.multitek.com.tr` sertifikasi ile ayni `13000/tcp` portunda HTTPS/WSS
  olarak aktif edildi. Mobil URL: `wss://test.multitek.com.tr:13000/ws`.
- Gateway/go2rtc public acilmadi. Android gateway cihazi Azure'a reverse SSH tunnel
  aciyor:
  - Azure: `127.0.0.1:1984`
  - Gateway: `127.0.0.1:1984`
- Gateway tarafinda kurulan dosyalar:
  - `/data/local/tmp/staj-gateway/ipcam-ssh-tunnel`
  - `/data/local/tmp/staj-gateway/azure_tunnel_ed25519`
  - `/data/local/tmp/staj-gateway/start-azure-tunnel-root.sh`
  - `/data/local/tmp/staj-gateway/start-go2rtc-root.sh`
- Boot hook: `/system/bin/starapp.sh` mevcut go2rtc autostart akisini cagiriyor; go2rtc
  basladiktan sonra Azure reverse tunnel da baslatiliyor.
- Reboot sonrasi dogrulama:
  - go2rtc process'i yeniden basladi.
  - `ipcam-ssh-tunnel` process'i yeniden basladi.
  - Tunnel logunda `remote listener ready: 127.0.0.1:1984` goruldu.
  - Public API uzerinden `GET /gateway/status?src=ofis_kamera` 200 dondu ve
    `producers=1` goruldu.
- Telefon uygulamasi `wss://test.multitek.com.tr:13000/ws` ile giris yapti ve canli
  goruntu testi basarili oldu.

## Gateway Reverse SSH Tunnel

Gateway icin Docker veya ek paket kurulumu yapilmadi. Android 6.0.1/aarch64 uzerinde
calisan kucuk bir Go binary'si derlendi ve sadece su isi yapiyor:

- Azure SSH servisine public key ile baglanir.
- Azure tarafinda yalniz `127.0.0.1:1984` dinletir.
- Gelen baglantiyi gateway uzerindeki `127.0.0.1:1984` go2rtc API'sine tasir.
- Koparsa 10 saniye arayla yeniden baglanir.
- Azure SSH host key fingerprint kontrolu yapar.

Azure `authorized_keys` icinde bu key icin PTY, agent forwarding ve X11 forwarding kapali.
`permitlisten` kisitlamasi ilk denemede OpenSSH tarafindan reddedildigi icin kaldirildi;
ileride dogru `permitlisten` soz dizimiyle yeniden daraltilmasi onerilir.

## Dokunulmayacak Alanlar

- `/opt/tomcat`
- `/opt/activemq`
- `/etc/kamailio`
- `/etc/rtpengine`
- MariaDB, MongoDB, ActiveMQ, Tomcat, Kamailio ve rtpengine servisleri
- rtpengine iptables/nft kurallari
- Mevcut 80/443 veya Tomcat portlari
