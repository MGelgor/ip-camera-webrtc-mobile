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

- Signaling server gerçek sertifika ile HTTPS/WSS arkasına alınacak
- TURN endpoint'i statik public IP veya otomatik DDNS adresine bağlanacak
- Named tunnel Mac yeniden başladığında otomatik açılacak
- Signaling yetkilendirmesi kullanıcı auth akışına bağlanacak
- TURN için kısa ömürlü production credential mekanizması eklenecek
- Metro/USB gerektirmeyen imzalı Android release build üretilecek
- Native `react-native-webrtc` yolu tekrar değerlendirilecek

Gerçek `.env` dosyası repoya eklenmemelidir.

Yerel `.env` olusturma ve izinleri `600` olan Application Support yedegini
yonetmek icin secret degerlerini ekrana basmayan yardimci kullanilir:

```bash
./services/manage-env-macos.sh init
./services/manage-env-macos.sh backup
./services/manage-env-macos.sh restore
./services/manage-env-macos.sh status
```

`restore` ve `init` mevcut `.env` dosyasinin uzerine varsayilan olarak yazmaz;
bilincli degistirme icin `--force` gerekir.

## macOS Otomatik Servisleri

Yerel signaling ve Metro servislerini terminalden bağımsız çalıştırmak için:

```bash
./services/install-macos-services.sh
./services/manage-macos-services.sh status
```

Servisler kullanıcı oturumu açıldığında başlar ve beklenmedik şekilde kapanırsa
`launchd` tarafından yeniden çalıştırılır. macOS Desktop erişimini LaunchAgent
süreçlerine kapattığı için çalışma kopyası
`~/Library/Application Support/ip-camera-webrtc-mobile/` altına kurulur.
Projede değişiklik yapıldığında kurulum komutu tekrar çalıştırılmalıdır.
Loglar `~/Library/Logs/ip-camera-webrtc-mobile/` altındadır.
Servisler Homebrew, NVM, Volta veya asdf altindaki Node.js 20+ kurulumunu bulur;
tek bir NVM/Node major yoluna sabitlenmez.

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

go2rtc API basic auth aktiftir. Signaling server `/cameras` katalog cevabinda gateway
adresi, auth header veya RTSP credential dondurmez. WebView player ve durum kontrolu
signaling server uzerinden gecerek go2rtc kimlik bilgisini server tarafinda tutar.
Mobil APK'ya go2rtc veya TURN build-time parolasi gomulmez.
Signaling admin tokeni ve login parolasi da mobil build'e verilmez. Uygulama kullanici
girisinden sonra server'in urettiği 60 dakikalik session tokenini sadece bellekte tutar.

## PDF ile Uyum Notu

PDF'in ana mimarisi native WebRTC client hedefler:

```text
IP Kamera -> RTSP -> go2rtc -> WebRTC -> native mobil istemci
```

Bu starter kit'te şu an çalışan yol PDF'teki alternatif WebView yaklaşımıdır:

```text
IP Kamera -> RTSP -> go2rtc -> signaling WebRTC bridge -> React Native WebView
```

Bu yol proje için geçerli bir ara aşamadır. Canlı görüntüyü hızlı ve stabil şekilde gösterir.
TURN ve dış ağ akışı fiziksel cihazda doğrulandı. Kalıcı WSS, kullanıcı yetkilendirmesi
ve native WebRTC kararı tamamlanmadan final ürün sayılmaz.

## TURN Katmani

PDF'teki final mimariyi takip etmek icin `turn/` klasorune Docker tabanli coturn
kurulumu ve bu Mac'te surekli calisan LaunchAgent kurulumu eklendi.

Bu katman:

- symmetric NAT durumlarinda relay olur
- mobil veri testlerini mumkun kilar
- statik IP gerektirmeyen dis ag senaryosuna yaklastirir

Alternatif Docker kurulumu su komutla ayaga kaldirilabilir:

```bash
cd starter-kit/turn
./run-coturn-local.sh
```

## Not

Bu klasördeki dosyalar tam ürün değil, öğrenme ve başlangıç için sadeleştirilmiş örneklerdir.
