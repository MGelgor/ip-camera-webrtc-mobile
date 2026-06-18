# TURN / coturn Katmani

Bu klasor, PDF'teki `STUN/TURN` katmanini Docker ile kurmak icin eklenmistir.

Hedef mimari:

```text
IP Kamera
  -> Akilli Diyafon (go2rtc gateway)
  -> Signaling Server
  -> coturn
  -> Mobil Uygulama
```

## Ne icin gerekli?

STUN tek basina yeterli olmadiginda, TURN relay devreye girer. Ozellikle:

- mobil veri
- farkli Wi-Fi
- symmetric NAT
- kati firewall

durumlarinda bu katman kritik olur.

## On kosullar

- Public IP'li bir Linux VPS
- Docker Engine
- Docker Compose plugin
- VPS firewall / cloud security group uzerinde bu portlar acik olmali:
  - `3478/tcp`
  - `3478/udp`
  - `49160-49200/udp`

## Hangi dosyalar var?

- `Dockerfile`
  - coturn ve `envsubst` yukler
- `docker-compose.yml`
  - port mapping ile coturn container'ini baslatir
- `turnserver.conf.template`
  - `.env` degiskenleri ile gercek config'e donusturulur

## Kurulum

1. `starter-kit/.env` dosyasini elle olustur veya mevcut dosyada su alanlari doldur:

```text
TURN_URL
TURN_USER
TURN_PASSWORD
TURN_REALM
TURN_SERVER_NAME
TURN_PUBLIC_IP
TURN_PORT
TURN_MIN_PORT
TURN_MAX_PORT
```

2. Linux VPS uzerinde bu klasore gel:

```bash
cd starter-kit/turn
```

3. Container'i build edip baslat:

```bash
docker compose up -d --build
```

4. Loglari izle:

```bash
docker compose logs -f
```

## go2rtc ile baglama

TURN hazir olduktan sonra `gateway/go2rtc.yaml` icindeki yorum satirindaki blok acilir:

```yaml
    - urls:
        - "${TURN_URL}"
      username: "${TURN_USER}"
      credential: "${TURN_PASSWORD}"
```

## Mobil tarafta ne degisecek?

Su an WebView tabanli player kullaniyoruz. Yine de TURN sunucusu:

- native WebRTC fazina geciste
- farkli ag testlerinde
- signaling + gateway + mobile zincirinin dis ag dayanikliliginda

gerekecek.

## Not

Bu compose dosyasi dogrudan port mapping kullanir.

- Lokal Mac testinde Docker Desktop ile calisabilir
- VPS tarafinda da ayni compose dosyasi kullanilabilir
- Gercek dis ag testi icin yine de public IP'li bir VPS gerekir
