# Starter Kit

Bu klasör, IP kamera WebRTC mobil izleme projesi için başlangıç iskeletidir.

Amaç:
- Sistemin parçalarını tek tek ayırmak
- Her parçanın ne yaptığını yorum satırlarıyla anlatmak
- Sonradan gerçek projeye çevrilebilecek temiz bir başlangıç oluşturmak

## Klasörler

- `gateway/`: Kamera akışını WebRTC'ye hazırlayan kısım
- `server/`: Signaling gibi bağlantı yönetimi işlerinin başlangıç iskeleti
- `mobile/`: Mobil uygulama tarafı
- `turn/`: Dış ağ ve NAT geçişi için coturn katmanı

## Başlangıç Sırası

1. Önce `gateway/go2rtc.yaml` içindeki çalışan RTSP kaynağı sabitlenir
2. Sonra `server/signaling-server.js` içindeki bağlantı mantığı geliştirilir
3. Sonra `mobile` tarafında canlı görüntü ekranı doğrulanır
4. En son native WebRTC, TURN, dış ağ ve güvenlik parçaları tamamlanır

## Şu Ana Kadar Doğrulanan Bilgi

- Kamera RTSP adresi VLC ile doğrulandı
- RTSP kaynağı `go2rtc` içine taşındı
- `go2rtc` içinde `ofis_kamera` stream'i çalışıyor
- Multitek Android gateway cihazinda `go2rtc` ARM64 binary calistirildi
- Android gateway uzerinde HLS playlist ve MP4/fMP4 endpoint yanitlari dogrulandi
- Android gateway uzerinde reboot sonrasi root-level autostart dogrulandi
- Tarayıcıda `go2rtc` player ile görüntü alındı
- Android emülatörde mobil uygulama içinde görüntü alındı
- Samsung S24 FE fiziksel cihazda auth aktif canlı/tam ekran görüntü alındı
- Fiziksel cihaz signaling WebSocket bağlantısı ve oda katılımı doğrulandı

Çalışan RTSP formatı:

```text
rtsp://${CAMERA_USER}:${CAMERA_PASSWORD}@${CAMERA_IP}:${CAMERA_PORT}${CAMERA_RTSP_MAIN_PATH}
```

Gerçek değerler `.env` içinde tutulur. Örnek dosyada gerçek şifre veya şirket içi IP bulunmamalıdır.

## Ortam Değişkenleri

Bu klasörün kökünde iki ortam dosyası mantığı var:

- `.env.example`
  - Sadece örnek alanları gösterir
  - Gerçek şifre içermez
  - Repoya konabilir
- `.env`
  - Gerçek çalışma değerlerini tutar
  - Repoya konmamalıdır

Bu dosyalarda şu bilgiler bulunur:
- Kamera IP ve portu
- Kamera kullanıcı adı
- Kamera şifresi
- RTSP path parçaları
- go2rtc portları
- signaling portu
- STUN/TURN bilgileri

## Şu anda eksik kalanlar

- Public TURN sunucusu dış ağ testi için ayağa kaldırılacak
- Signaling server gerçek sertifika ile HTTPS/WSS arkasına alınacak
- Mobil uygulamada kamera listesi dinamik hale getirilecek
- Native `react-native-webrtc` yolu tekrar değerlendirilecek
- WebView yaklaşımı üretim kararı olacaksa hata/yüklenme/tam ekran davranışları güçlendirilecek

Gerçek `.env` dosyası repoya eklenmemelidir.

## Gateway'i Calistirma

Gateway klasorunde su script var:

```bash
./run-go2rtc.sh
```

Bu script:
- `.env` dosyasini yukler
- `go2rtc.yaml` dosyasini okur
- `go2rtc` binary'sini baslatir

Gerekli kontrol adresleri:
- `http://localhost:1984`
- `:8555`

go2rtc API basic auth aktiftir. Mobil uygulama bu auth bilgisini signaling server'in
`/cameras` katalog cevabindan alir ve header olarak kullanir.

## Signaling Server'i Calistirma

```bash
cd server
./start-signaling.sh
```

Script ilk calismada kendi Node.js bagimliliklarini otomatik kurar. Oda gecisi,
ayrilma ve yeniden katilma regresyon testi icin:

```bash
cd server
npm test
```

## PDF ile Uyum Notu

PDF'in ana mimarisi native WebRTC client hedefler:

```text
IP Kamera -> RTSP -> go2rtc -> WebRTC -> native mobil istemci
```

Bu starter kit'te şu an çalışan yol PDF'teki alternatif WebView yaklaşımıdır:

```text
IP Kamera -> RTSP -> go2rtc -> go2rtc player -> React Native WebView
```

Bu yol proje için geçerli bir ara aşamadır. Canlı görüntüyü hızlı ve stabil şekilde gösterir.
Ancak dış ağ, TURN, WSS, yetkilendirme ve native WebRTC tarafı tamamlanmadan final ürün sayılmaz.

## TURN Katmani

PDF'teki final mimariyi takip etmek icin `turn/` klasorune Linux VPS uzerinde
calisacak bir Docker tabanli coturn kurulumu eklendi.

Bu katman:

- symmetric NAT durumlarinda relay olur
- mobil veri testlerini mumkun kilar
- statik IP gerektirmeyen dis ag senaryosuna yaklastirir

Lokal entegrasyon testi icin Docker ile bilgisayarda da ayaga kaldirilabilir:

```bash
cd starter-kit/turn
./run-coturn-local.sh
```

## Not

Bu klasördeki dosyalar tam ürün değil, öğrenme ve başlangıç için sadeleştirilmiş örneklerdir.
