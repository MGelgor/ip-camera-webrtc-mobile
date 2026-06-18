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
- [x] Opsiyonel bearer token dogrulamasi destegi ekle
- [ ] HTTPS/WSS'i gercek sertifika ile aktif et
- [ ] Kullanici auth akisina bagli token dogrulamasi ekle
- [ ] Oda/kamera yetkilendirmesi ekle
- [x] Rate limit ve temel loglama ekle

### Mobil Uygulama

- [x] Uygulama iskeleti
- [x] Light/dark mode
- [x] Turkce, English, العربية
- [x] Profil menusu ve ayarlar
- [x] Signaling baglanti paneli
- [x] WebView ile go2rtc player canli goruntu
- [x] Canli ekran loading/error/retry durumu
- [x] Kamera config modelinin ilk hali
- [ ] Kamera listesi ekranini gercek veriyle doldur
- [ ] Kamera secimine gore player URL uret
- [ ] Fiziksel Android cihazda test et
- [ ] Tam ekran canli izleme modu ekle
- [ ] Native `react-native-webrtc` yolunu tekrar degerlendir

### NAT / Dis Ag

- [x] Lokal STUN ayari
- [x] Bulut deploy icin coturn Docker dosyalarini hazirla
- [x] Lokal Docker ile coturn ayağa kaldir ve portlarini dogrula
- [ ] Bulutta coturn kur
- [ ] TURN username/password veya token ekle
- [ ] Mobil veri ile test et
- [ ] Farkli Wi-Fi agindan test et
- [ ] Port forwarding kullanmadan calisma senaryosunu dogrula

### Guvenlik

- [x] `.env.example` icinden gercek sifreyi temizle
- [x] Gercek `.env` dosyasini `.gitignore` ile disarida tut
- [x] go2rtc API auth
- [x] Signaling icin opsiyonel auth destegi
- [x] HTTPS/WSS icin kod ve script hazirligi
- [ ] HTTPS
- [ ] WSS
- [ ] Kamera bilgilerini mobil istemciye acmama kontrolu
- [ ] Uretim loglarinda RTSP URL/sifre maskeleme

## 4. Siradaki En Mantikli Sira

1. Fiziksel Android telefonu ayni Wi-Fi uzerinde auth aktif halde test et
2. Kamera listesini UI tarafinda gercek modele bagla
3. Signaling server'i gercek sertifika ile WSS destekleyecek sekilde deploy et
4. Public VPS uzerinde coturn kur
5. Mobil veri / farkli Wi-Fi testi yap
6. Native WebRTC yolunu fiziksel cihazda tekrar dene

## 5. Karar Notu

WebView yaklasimi su an bilincli bir ara cozumdur.
PDF'te alternatif olarak yer alir ve demo icin uygundur.

Final urunde iki secenek vardir:

1. WebView yaklasimini kabul edip UX ve guvenligi guclendirmek
2. Native `react-native-webrtc` entegrasyonuna geri donmek

Native WebRTC daha dogru final mimaridir.
WebView daha hizli ve su an daha stabil calisan yoldur.
