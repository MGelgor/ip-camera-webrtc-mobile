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
- [ ] sub stream path'i bulunursa `ofis_kamera_sub` olarak ekle
- [x] gateway'i Mac yerine kamera lokasyonundaki akilli diyafon uzerinde calistir
- [ ] Android gateway acilisinda otomatik baslama mekanizmasi ekle

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
- [ ] Rate limit ve temel loglama ekle

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
