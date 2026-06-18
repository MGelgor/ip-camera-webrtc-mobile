# Signaling Server

Bu klasor, WebRTC baglantisindan once taraflar arasindaki mesajlari tasir.

## Su an ne yapar?

- HTTP saglik kontrolu verir
- Oda bilgisi listeler
- WebSocket uzerinden baglanti kabul eder
- `join`, `leave`, `offer`, `answer`, `ice-candidate` mesajlarini relaye eder

## HTTP Uç Noktalari

### `GET /health`
Server calisiyor mu ve kac oda var, onu gosterir.

### `GET /rooms`
Aktif odalari ve onlara bagli client'lari listeler.

### `GET /cameras`
Gateway host, stream name, player URL ve opsiyonel go2rtc auth header bilgisini dondurur.

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
Ayrica go2rtc player ile calisan `Canli` sekmesi bu signaling server'i kullanarak acilmiyor.

Su an iki ayri dogrulama var:

- `Durum` sekmesi signaling server'a baglanir
- `Canli` sekmesi go2rtc player'i WebView icinde acar

Bu ayrim bilincli olarak korunuyor.
Cunku native `react-native-webrtc` denemesi Android emulator tarafinda native crash uretmistir.

## Opsiyonel Guvenlik Katmanlari

`.env` ile su alanlar desteklenir:

- `SIGNALING_AUTH_TOKEN`
  - doluysa `/rooms`, `/cameras` ve `/ws` bearer token ister
  - WebSocket tarafinda `?token=...` query param de kabul edilir
- `SIGNALING_TLS_CERT_PATH`
- `SIGNALING_TLS_KEY_PATH`
  - ikisi de doluysa server `https` ve `wss` olarak ayaga kalkar

## Yardimci Scriptler

### `./start-signaling.sh`
`.env` dosyasini yukleyip signaling server'i baslatir.

### `./generate-dev-cert.sh`
Lokal HTTPS/WSS testi icin self-signed sertifika uretir.

## Sonraki Adim

PDF'teki final mimariye yaklasmak icin siradaki isler:

1. HTTPS/WSS'i gercek sertifika ile aktif etmek
2. Oda/kamera yetkilendirmesini uygulama auth akisina baglamak
3. Native WebRTC tekrar denenirse offer/answer/ICE mesajlarini buradan tasimak
4. TURN bilgisini public VPS uzerinden kullanmak
5. Dis ag ve mobil veri testini yapmak
