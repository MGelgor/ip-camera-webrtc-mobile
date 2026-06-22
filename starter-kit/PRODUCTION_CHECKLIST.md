# Production Checklist

Bu dosya, lokal ortamda calisan kamera izleme iskeletini PDF'teki final mimariye
yaklastirmak icin takip listesidir.

## 1. Su An Calisan Lokal Akis

```text
IP Kamera
  -> RTSP
  -> go2rtc
  -> go2rtc player
  -> React Native WebView
  -> Android uygulama
```

Bu akis lokal demo icin calisiyor.
Ancak final urun icin yeterli degil.

## 2. PDF'in Ana Hedef Akisi

```text
IP Kamera
  -> RTSP
  -> Media Gateway
  -> WebRTC
  -> Signaling Server
  -> STUN/TURN
  -> Native Mobil WebRTC Client
```

## 3. Kapatilacak Eksikler

### Gateway

- [x] RTSP kaynagini go2rtc'ye bagla
- [x] RTSP sifresini `go2rtc.yaml` icinde duz metin tutma
- [x] `run-go2rtc.sh` ile gerekli env alanlarini kontrol et
- [x] Android tabanli akilli diyafonda ARM64 `go2rtc` binary'sini calistir
- [x] Android gateway icin start/status/stop script'lerini ekle
- [x] go2rtc API authentication ekle
- [x] Android gateway uzerinde `10.1.1.3:5555` ADB baglantisini dogrula
- [x] Android gateway uzerinde `/data/local/tmp/staj-gateway/start-go2rtc-device.sh` ile go2rtc baslat
- [x] Android gateway uzerinde `1984` API ve `8555` WebRTC portlarinin dinledigini dogrula
- [x] Android gateway uzerinde `ofis_kamera` RTSP producer bilgisini dogrula
- [x] Android gateway uzerinde HLS playlist ve MP4/fMP4 endpoint yanitlarini dogrula
- [ ] sub stream path'i bulunursa `ofis_kamera_sub` olarak ekle
- [x] gateway'i Mac yerine kamera lokasyonundaki akilli diyafon uzerinde calistir
- [x] Android gateway icin cihaz ici start script uret
- [x] Android gateway autostart helper APK iskeleti ekle
- [x] Android gateway autostart helper APK'yi foreground service/watchdog olarak gelistir
- [x] Android gateway autostart helper APK'yi cihaza kur
- [x] Android gateway autostart helper APK foreground service olarak ayakta kaliyor mu dogrula
- [x] Multitek cihazda normal APK kullanicisinin `su` calistiramadigini dogrula
- [x] Multitek cihazda APK kullanicisiyle baslayan go2rtc'nin `:1984` bind edemedigini dogrula
- [x] Android gateway icin root-level vendor boot script autostart mekanizmasi ekle
- [x] Android gateway acilisinda otomatik baslama mekanizmasini cihazda dogrula

### Gateway Test Notlari

- 2026-06-22 kontrolunde gateway `10.1.1.3:1984` kimlik dogrulamali API'si 200
  dondu ve `ofis_kamera` icin bir aktif producer raporladi. ADB `:5555` portu agda
  acik olsa da transport offline kaldi; reconnect sonrasi ADB oturumu geri gelmedi.
  Gateway medya servisi calisiyor, cihaz shell erisimi yeniden yetkilendirme bekliyor.

- Kamera web arayuzu `viewer_index.asp` Flash eklentisi istiyor. Bu sayfa dogrulama icin
  referans alinmayacak.
- Dogru kaynak VLC'de calisan RTSP adresidir.
- Android gateway'in stock browser'i `stream.html?src=ofis_kamera` sayfasinda siyah ekran
  gosterebilir. Bu, go2rtc'nin RTSP alamadigi anlamina gelmez; eski Android tarayicisinin
  WebRTC/MSE/HLS player destegi kisitli olabilir.
- JPEG snapshot endpoint'i Android gateway'de `ffmpeg` gerektirdigi icin su an 500 donebilir.
  Bu beklenen bir durumdur; final hedef RTSP/H.264 akisini WebRTC/HLS/fMP4 olarak servis etmektir.
- 2026-06-18 saha testinde `api/stream.m3u8?src=ofis_kamera` ve
  `api/stream.mp4?src=ofis_kamera` yanit verdi. Bu, gateway'in kameradan H.264 aldigini ve
  servis edebildigini dogrular.
- 2026-06-18 saha testinde helper APK cihaza kuruldu ve foreground service olarak ayakta
  kaldi. Ancak cihazdaki `su` sadece `root:shell` tarafindan calistirilabildigi icin normal APK
  kullanicisi root-level go2rtc restart yapamadi.
- APK kullanicisi start script'i dogrudan calistirdiginde go2rtc process'i acilsa da `:1984`
  API portunda `permission denied` alindi. Bu nedenle root-level autostart icin init/vendor boot
  mekanizmasi gerekiyor.
- 2026-06-18 saha testinde `/system/bin/starapp.sh` yedeklenip sonuna
  `staj-gateway-autostart` hook'u eklendi. Hook, boot sonrasinda 20 saniye bekleyip
  `/data/local/tmp/staj-gateway/start-go2rtc-root.sh` calistiriyor.
- Reboot testi basarili: `boot-hook.log` boot hook'unu, `autostart.log` yeni go2rtc PID'ini
  kaydetti. `http://10.1.1.3:1984` reboot sonrasinda `401 Unauthorized` dondu.

### Signaling Server

- [x] HTTP health endpoint ekle
- [x] Room listeleme endpoint'i ekle
- [x] WebSocket `/ws` ekle
- [x] `join`, `leave`, `offer`, `answer`, `ice-candidate` relay et
- [x] HTTPS/WSS destegi icin TLS alanlarini ve start script'ini ekle
- [x] Zorunlu bearer/session token dogrulamasi ekle
- [ ] HTTPS/WSS'i gercek sertifika ile aktif et
- [x] Kullanici auth akisina bagli kisa omurlu token dogrulamasi ekle
- [x] Tek katalog kamerasi icin oda/kamera yetkilendirmesi ekle
- [x] Rate limit ve temel loglama ekle
- [x] Login brute-force icin ayri rate limit ekle
- [x] Session/rate-limit bellek kayitlarini sureli temizle ve ust sinir koy
- [x] Gecici public tunnel ile gercek sertifikali WSS baglantisini fiziksel cihazda dogrula
- [x] Yerel signaling'i Mac kullanici oturumu acildiginda otomatik baslat
- [ ] Named tunnel'i Mac reboot sonrasi otomatik baslat

### 2026-06-22 Servis Dogrulamasi

- `com.multitek.ip-camera.signaling` ve `com.multitek.ip-camera.metro` LaunchAgent
  olarak kuruldu; Node.js `v25.2.1` ile calisiyor.
- Signaling `*:3000`, Metro `*:8081` dinliyor; LaunchAgent error loglari bos.
- Signaling process'ine `SIGTERM` gonderildikten sonra LaunchAgent yeni PID ile yeniden
  baslatti ve `/health` tekrar 200 dondu; `KeepAlive` davranisi dogrulandi.
- Login, `/cameras`, `/player` ve `/gateway/status` zinciri gercek lokal `.env` ile
  200 dondu. Katalog/status yanitlarinda gateway/RTSP credential sizintisi gorulmedi.
- `.env`, izinleri `600` olan Application Support yedegine alindi; init/backup/restore
  akisi `services/manage-env-macos.sh` ile tanimlandi.

### Mobil Uygulama

- [x] Uygulama iskeleti
- [x] Light/dark mode
- [x] Turkce, English, العربية
- [x] Profil menusu ve ayarlar
- [x] Signaling baglanti paneli
- [x] WebView ile go2rtc player canli goruntu
- [x] Canli ekran loading/error/retry durumu
- [x] Kamera config modelinin ilk hali
- [x] Kamera listesi ekranini gercek veriyle doldur
- [x] Kamera secimine gore player URL uret
- [x] Fiziksel Android cihazda test et
- [x] Tam ekran canli izleme modu ekle
- [x] Login ekrani ve kisa omurlu signaling session'i ekle
- [x] Native SDP/ICE akisini signaling server uzerinden go2rtc'ye koprule
- [x] Yeni login -> katalog -> player akisinin Samsung S24 FE'de testini tamamla
- [ ] Native WebRTC'yi Samsung S24 FE'de ayri build ile dogrula
- [ ] Native basarisizken otomatik WebView fallback'ini cihazda dogrula
- [x] Android 16 native WebRTC SIGABRT durumunda native yolu cihaz seviyesinde kapat
- [x] Mobil veride erisilemeyen LAN signaling icin sonsuz login yerine 10 saniye timeout ekle
- [x] Canli ekranda secilen ICE yolunu Dogrudan/STUN/TURN olarak goster
- [x] Tek agda test icin Otomatik/STUN-only/TURN-only ICE debug secicisi ekle
- [ ] Metro/USB gerektirmeyen imzali Android release build uret
- [ ] Native `react-native-webrtc` yolunu tekrar degerlendir

### Mobil Test Notlari

- 2026-06-22 testinde native-acik APK, Samsung S24 FE Android 16'da canli ekran
  acilirken `libjingle_peerconnection_so.so` network thread uzerinde SIGABRT ile
  tekrar tekrar kapandi. Ayni cihazda WebView build'i login, katalog, canli goruntu,
  gateway consumer ve tam ekran testlerini crash olmadan gecti. PDF 6.3 WebView'i
  alternatif WebRTC istemci kabi olarak kabul ettigi icin stabil yol WebView olarak
  tutuldu; native final hedefi Android 16 uyumlu kutuphane gelene kadar kapali.
- 2026-06-22 public WS APK testi Wi-Fi kapali ve 5G aktifken tekrarlandi. Public
  `:13000` signaling uzerinden login, katalog ve WebView icindeki WebRTC canli
  goruntu calisti; uygulama process'i ayakta kaldi ve gateway `1 producer / 1
  consumer` raporladi. Yanlis TURN kullanici kaydi duzeltildikten sonra mobil
  logdaki TURN authentication hatasi kayboldu.
- Gateway durum kontrolundeki tek seferlik hata artik canli videoyu hemen kapatmaz;
  offline katmani art arda uc basarisiz kontrolden sonra gosterilir ve durum
  duzeldiginde otomatik toparlanir.
- 2026-06-22 Samsung 5G testinde uygulamadaki ICE yol gostergesi Chromium'un secili
  candidate pair raporundan `Dogrudan (STUN)` sonucunu gosterdi. Normal APK'da
  relay zorlama yoktur; TURN yalnizca dogrudan ICE yolu kurulamazsa yedek olarak
  kullanilir.
- Ayni cihazda `STUN` modu TURN sunucularini listeden cikararak `Dogrudan (STUN)`,
  `TURN` modu ise yalniz TURN sunucusunu ve `iceTransportPolicy=relay` kullanarak
  `TURN relay` sonucunu verdi. Iki modda da canli goruntu ve uygulama process'i
  ayakta kaldi. `Otomatik` modu normal ICE tercih davranisini korur.

- 2026-06-19 testinde Samsung S24 FE (Android 16 / API 36) USB ADB ile baglandi.
- Uygulama fiziksel telefona kuruldu; gateway auth aktifken `ofis_kamera` WebRTC
  consumer'i olustu ve normal/tam ekran canli goruntu dogrulandi.
- WebView alt kaynaklari ve WebSocket auth'u icin `basicAuthCredential` kullanildi.
- Telefon `ws://10.0.2.128:3000/ws` signaling servisine baglandi, `ofis_kamera`
  odasina `viewer` olarak katildi ve uye sayisi `1` goruldu.
- 2026-06-19 testinde `/cameras` katalog yaniti Genel ekraninda listelendi. Secili
  `Ofis Kamera` kaydindaki `Canli izle` komutu dogru player URL'sini acip `ws+udp`
  consumer olusturdu.

### NAT / Dis Ag

- [x] Lokal STUN ayari
- [x] Bulut deploy icin coturn Docker dosyalarini hazirla
- [x] Lokal Docker ile coturn ayağa kaldir ve portlarini dogrula
- [x] macOS coturn LaunchAgent ve Keychain tabanli kimlik bilgisi hazirla
- [x] TURN hosting karari: router arkasindaki Mac'i public coturn olarak kullan
- [x] Lokal TURN username/password bilgisini macOS Keychain'e ekle
- [x] Mac coturn'u public IP ve router port forwarding ile dis aga ac
- [x] 5G uzerinden TURN `relay-only` candidate testini dogrula
- [ ] TURN adresi icin statik public IP veya otomatik DDNS tanimla
- [ ] Production icin kisa omurlu TURN credential mekanizmasi ekle
- [x] Mobil veri ile signaling ve gecici tunnel video testi yap
- [ ] Farkli Wi-Fi agindan test et
- [x] Port forwarding kullanmadan gecici tunnel senaryosunu dogrula

### Dis Ag Test Notlari

- 2026-06-22 karari: ortak agdaki public `80/443` portlari projeye ayrilmayacak.
  Ilk global fonksiyon testi icin ayrik `13000/TCP -> Mac:3000/TCP` forwarding
  kullanilacak. Bu asama sifresiz `ws://` oldugu icin yalnizca kontrollu debug
  testidir; sonraki guvenlik asamasinda ayni public port WSS/TLS arkasina alinacak.
- Public WS arm64 debug APK akisi `npm run android:build:public-ws` olarak eklendi.
  `13000/TCP -> Mac:3000/TCP` router mapping'i ile fiziksel Samsung S24 FE'de 5G
  login, katalog, player ve canli goruntu testi tamamlandi.

- 2026-06-19 testinde Mac sirket Wi-Fi aginda signaling servisini tum arayuzlerde
  `:3000` portunda dinledi; macOS application firewall kapaliydi.
- Samsung S24 FE Wi-Fi kapatilarak mobil veriye gecirildi. Telefon mobil internet
  erisimini dogruladi, ancak sirketin public IP adresindeki `:3000` baglantisi zaman
  asimina ugradi. Sirket router/NAT katmani inbound portu Mac'e yonlendirmiyor.
- Bir sonraki hizli secenek router degisikligi gerektirmeyen outbound HTTPS/WSS
  tunnel testidir. Kalici TURN icin yine public UDP erisimli sunucu gerekir.
- 2026-06-19 tarihinde Cloudflare Quick Tunnel ile lokal signaling servisi public
  HTTPS/WSS adresine tasindi. Samsung S24 FE Wi-Fi ayarlarindan kapatildi, 5G uzerinde
  yeni Client ID alarak `ofis_kamera` odasina `viewer` olarak katildi. Bu test,
  port forwarding olmadan signaling erisimini dogruladi; video/TURN erisimini degil.
- Ayni test yeni bir Quick Tunnel adresiyle tekrarlandi. Public `health` ve `cameras`
  endpointleri ile WSS el sikismasi dogrulandi; fiziksel telefon 5G uzerinden
  `mobile-viewer` olarak odaya katildi.
- go2rtc `:1984` HTTP/WebSocket yuzu ayri bir outbound Quick Tunnel ile yayinlandi.
  Telefon Wi-Fi kapali ve 5G uzerindeyken WebView player gercek kamera goruntusunu
  acti; gateway tarafinda aktif consumer olustugu dogrulandi. Bu gecici MSE/WebSocket
  demo yolu TURN kurulumunun yerini tutmaz ve production icin kalici tunnel/domain
  ile erisim politikasi gerektirir.
- Canli 5G WebRTC oturumunda gateway `ws+udp` ve `srflx` remote candidate raporladi;
  bu, STUN ile NAT dis adresinin bulunup dogrudan UDP medya yolunun kuruldugunu
  dogruladi. Bu oturum TURN relay kullanmadi.
- Mac uzerinde coturn 4.13.1 LaunchAgent olarak kuruldu. Lokal STUN binding ile
  kimlik dogrulamali TURN allocation/channel bind testleri gecti ve paket kaybi
  olmadi. Router'da `3478/tcp+udp` ve `48160-48200/udp` Mac'e yonlendirildi.
- Samsung S24 FE Wi-Fi kapali ve 5G'deyken public IP'ye ham STUN istegi yanitlandi,
  `3478/tcp` erisimi gecti ve relay araliginin iki ucu (`48160`, `48200`) Mac'e
  ulasti. WebRTC Trickle ICE testi `relay-only` modunda kimlik dogrulamali
  `relay / UDP / <public-ip>:48198` candidate uretti. Public TURN zinciri uctan
  uca dogrulandi.
- TURN kullanicisi plaintext process argumanindan kaldirilip izinleri `600` olan
  coturn SQLite user DB'ye tasindi. Keychain parolasi ile lokal allocation ve 5G
  `relay-only` testi tekrar gecti (`<public-ip>:48192`).

### Guvenlik

- [x] `.env.example` icinden gercek sifreyi temizle
- [x] Gercek `.env` dosyasini `.gitignore` ile disarida tut
- [x] go2rtc API auth
- [x] Signaling icin opsiyonel auth destegi
- [x] Gecici public signaling'i Keychain tabanli bearer token ile koru
- [x] HTTPS/WSS icin kod ve script hazirligi
- [x] Gecici public HTTPS/WSS dis ag testi
- [x] Named Cloudflare Tunnel ingress config ornegini hazirla
- [ ] Cloudflare hesabini ve alan adini Mac'e yetkilendir
- [ ] Kalici domain ve production HTTPS/WSS kurulumu
- [x] Signaling kamera katalogundan auth header ve RTSP credential cikmadigini dogrula
- [x] go2rtc auth bilgisini mobil uygulama paketinden cikarip signaling player/proxy arkasina al
- [x] TURN ve kamera parolalarinin mobil build-time environment'ina aktarilmasini kaldir
- [x] Statik signaling admin tokenini APK'dan cikarip kisa omurlu login session'i ekle
- [x] Mobil WebSocket session tokenini URL query yerine Authorization header ile gonder
- [x] Player cookie yetkisini yalnizca player WebSocket oturumuna sinirla
- [x] Login icin ayri rate limit ve guvenli proxy-IP politikasi ekle
- [ ] Lokal `.env` kullanicisini production kullanici veritabani ve kamera yetkileriyle degistir
- [ ] Uretim loglarinda RTSP URL/sifre maskeleme

## 4. Siradaki En Mantikli Sira

1. Android 16 uyumlu bir native WebRTC surumuyle native/fallback yolunu yeniden test et
2. Mevcut public IP degisirse manuel guncelleme veya DDNS secenegini degerlendir
3. Production asamasinda public signaling'i WSS/TLS arkasina al
4. Farkli Wi-Fi agindan test et

## 5. Karar Notu

WebView yaklasimi su an bilincli bir ara cozumdur.
PDF'te alternatif olarak yer alir ve demo icin uygundur.

Final urunde iki secenek vardir:

1. WebView yaklasimini kabul edip UX ve guvenligi guclendirmek
2. Native `react-native-webrtc` entegrasyonuna geri donmek

Native WebRTC daha dogru final mimaridir.
WebView daha hizli ve su an daha stabil calisan yoldur.
