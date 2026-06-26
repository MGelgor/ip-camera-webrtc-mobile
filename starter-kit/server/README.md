# Signaling Server

Bu klasor, WebRTC baglantisindan once taraflar arasindaki mesajlari tasir.

## Su an ne yapar?

- HTTP saglik kontrolu verir
- Oda bilgisi listeler
- WebSocket uzerinden baglanti kabul eder
- `join`, `leave`, `offer`, `answer`, `ice-candidate` mesajlarini relaye eder
- gateway kamera panelinden yeni RTSP kamerasi ekler
- temel rate-limit uygular
- maskeli baglanti loglari yazar

## HTTP Uç Noktalari

### `POST /auth/login`
`.env` icindeki signaling kullanici adi/parolasini dogrular ve 60 dakikalik rastgele
access token dondurur. Token server memory'sinde tutulur; mobil uygulama da tokeni
yalnizca calisan uygulamanin belleğinde saklar.

### `GET /health`
Server calisiyor mu ve kac oda var, onu gosterir.

### `GET /rooms`
Aktif odalari ve onlara bagli client'lari listeler.

### `GET /cameras`
Stream name, signaling player yolu ve ICE server bilgisini dondurur.
Gateway adresi veya go2rtc kimlik bilgisi dondurmez.

### `GET /admin`
Browser'da gateway kamera panelini acar. `SIGNALING_AUTH_USERNAME` ve
`SIGNALING_AUTH_PASSWORD` ile Basic Auth kullanir.

### `POST /admin/cameras`
Panelin kullandigi endpointtir. Kamera adi, konum, stream adi ve RTSP adresini alir;
go2rtc'ye `PUT /api/streams` ile stream ekler ve server-side katalog dosyasina kaydeder.
RTSP adresi mobil `/cameras` yanitina eklenmez.

### `GET /player?src=ofis_kamera`
Bearer token ile acilir, kisa omurlu HttpOnly player oturumu olusturur ve
WebRTC player sayfasini sunar. Player ayni origin `/ws` signaling baglantisini kullanir.

### `GET /gateway/status?src=ofis_kamera`
go2rtc durumunu server tarafinda Basic Auth ile kontrol eder. RTSP URL veya credential
istemciye aktarilmaz.

## WebSocket Uç Noktasi

### `ws://localhost:3000/ws`

Mesaj ornegi:

```json
{ "type": "join", "room": "ofis_kamera", "role": "viewer" }
```

## Mesaj Akisi

1. Mobil uygulama `join` gonderir
2. Server client'i ilgili odaya ekler
3. Ayni odaya baska client girerse `peer-joined` mesaji yayinlanir
4. `offer`, `answer` ve `ice-candidate` mesajlari oda icindeki diger client'lara relaye edilir
5. Client ayrilinca `peer-left` mesaji yayinlanir

## Su Anki Sinir

Bu server su an video tasimaz.
Native WebRTC istemcisinden gelen SDP/ICE mesajlarini yetkili bir WebSocket ile
yerel go2rtc `/api/ws` endpoint'ine kopruler. Medya signaling server'dan gecmez;
ICE tarafindan secilen dogrudan veya TURN relay yolu uzerinden akar.

Canli ekran iki katmanli calisir:

- `Durum` sekmesi signaling server'a baglanir
- `Canli` sekmesi varsayilan olarak signaling server'in kimlik dogrulamali WebRTC
  player sayfasini acar
- `EXPO_PUBLIC_NATIVE_WEBRTC_ENABLED=true` verilirse once native WebRTC +
  signaling koprusunu dener ve basarisiz olursa WebView fallback'e doner

Bu ayrim bilincli olarak korunuyor.
Cunku native `react-native-webrtc` denemesi hedef Android 16 cihazda native crash uretmistir.

## Opsiyonel Guvenlik Katmanlari

`.env` ile su alanlar desteklenir:

- `SIGNALING_AUTH_TOKEN`
  - server yonetim/operasyon tokenidir, en az 32 karakter olmalidir
  - mobil APK'ya verilmez
- `SIGNALING_AUTH_USERNAME`
- `SIGNALING_AUTH_PASSWORD`
  - mobil kullanici girisi icin server tarafinda tutulur
  - parola en az 12 karakter olmalidir
  - basarili giris `/rooms`, `/cameras`, `/player`, `/gateway/status` ve `/ws`
    icin kisa omurlu session tokeni uretir
- Yetkili endpointler
  - admin tokenini veya gecerli session tokenini bearer olarak kabul eder
  - mobil WebSocket tokenini URL'e yazmaz; `Authorization` header kullanir
  - WebView player yalnizca kendi HttpOnly, kisa omurlu cookie'siyle `/ws` acar
- `SIGNALING_TLS_CERT_PATH`
- `SIGNALING_TLS_KEY_PATH`
  - ikisi de doluysa server `https` ve `wss` olarak ayaga kalkar
- `SIGNALING_RATE_LIMIT_WINDOW_MS`
- `SIGNALING_RATE_LIMIT_MAX_REQUESTS`
  - HTTP ve WebSocket girisleri icin basit IP bazli oran siniri uygular
- `SIGNALING_LOGIN_RATE_LIMIT_WINDOW_MS`
- `SIGNALING_LOGIN_RATE_LIMIT_MAX_REQUESTS`
  - login brute-force denemeleri icin genel trafikten ayri oran siniri uygular
- `SIGNALING_TRUST_PROXY=true`
  - yalnizca loopback'ten baglanan guvenilir reverse proxy icin
    `CF-Connecting-IP`/`X-Forwarded-For` basliklarini istemci IP'si olarak kabul eder
- `CAMERA_CATALOG_PATH`
  - panelden eklenen kameralarin server-side JSON dosyasidir
  - RTSP credential bilgisi burada tutulabilir; mobil katalog yanitina dondurulmez
  - server acilista bu dosyadaki RTSP'li kameralar icin go2rtc stream'lerini tekrar senkronize eder

## Yardimci Scriptler

### `./start-signaling.sh`
`.env` dosyasini yukleyip signaling server'i baslatir.
Token yoksa veya 32 karakterden kisaysa server guvensiz sekilde acilmaz.

Yeni token:

```bash
openssl rand -hex 32
```

### `./generate-dev-cert.sh`
Lokal HTTPS/WSS testi icin self-signed sertifika uretir.

### `./start-signaling-tunnel.sh`

Calisan lokal signaling server'i gecici, public ve gercek sertifikali bir
`trycloudflare.com` adresine tasir:

```bash
./start-signaling-tunnel.sh
```

Tunnel ciktisindaki `https://<gecici-host>` adresinin WebSocket karsiligi
`wss://<gecici-host>/ws` olur. Fiziksel Android build'i bu adresle baslatmak icin:

```bash
EXPO_PUBLIC_SIGNALING_URL="wss://<gecici-host>/ws" npm run android:device
```

Quick Tunnel yalnizca gelistirme/test icindir. Process kapaninca adres gecersiz olur;
uretimde sabit domain, erisim politikasi ve yonetilen tunnel kullanilmalidir.
Tunnel betikleri, QUIC engellenen kurumsal aglarda calisabilmesi icin varsayilan olarak
TCP/443 uzerinden `http2` kullanir.

## Sonraki Adim

PDF'teki final mimariye yaklasmak icin siradaki isler:

1. Quick Tunnel yerine sabit domainli named tunnel veya VPS kullanmak
2. Tek lokal kullaniciyi gercek kullanici veritabani ve kamera yetkileriyle degistirmek
3. Android 16 ile uyumlu native WebRTC surumunu fiziksel cihazda dogrulamak
4. Native yol dogrulandiktan sonra `EXPO_PUBLIC_NATIVE_WEBRTC_ENABLED=true` yapmak
5. Statik TURN kimlik bilgilerini kisa omurlu kimlik bilgileriyle degistirmek
