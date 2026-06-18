# Gateway Katmani

Bu klasor, kameradan gelen RTSP yayininin WebRTC'ye hazirlanmasi icin kullanilir.

## Bu katman ne yapar?

- IP kameradan RTSP akisini alir
- Gerekirse ayni yayini birden fazla istemciye ulastirir
- WebRTC icin uygun yayin yuzunu hazirlar
- Tarayici ve mobil uygulamanin kullanacagi cekirdegi saglar

## Neden burada basliyoruz?

Cunku kamera tarafi netlesmeden mobil uygulamada ilerlemek sadece tahmin yapmaya neden olur.
Bu projede elimize gecen dogru kaynak:

```text
rtsp://${CAMERA_USER}:${CAMERA_PASSWORD}@${CAMERA_IP}:${CAMERA_PORT}${CAMERA_RTSP_MAIN_PATH}
```

Bu adres VLC ile calistigi icin artik gateway tarafina tasinabilir.

## Su Anki Durum

- `ofis_kamera` stream'i go2rtc tarafinda calisiyor
- RTSP kaynagi `.env` icindeki parcalardan uretiliyor
- Kamera sifresi `go2rtc.yaml` icinde duz metin olarak tutulmuyor
- go2rtc API basic auth aktif edildi
- Tarayici ve mobil WebView bu stream'i izleyebiliyor
- Multitek Android gateway cihazinda `go2rtc` ARM64 binary calistirildi
- Android gateway uzerinde `1984` API ve `8555` WebRTC portlari dinliyor
- Android gateway uzerinde `ofis_kamera` RTSP producer olarak gorunuyor
- Android gateway uzerinde HLS playlist ve MP4/fMP4 endpoint yanitlari dogrulandi
- Android gateway uzerinde root-level boot autostart dogrulandi

## Android Saha Test Notlari

Multitek cihazdaki kamera web arayuzu Flash tabanli viewer kullaniyor olabilir. Bu nedenle
`viewer_index.asp` sayfasinda Flash hatasi alinmasi bu mimari icin bloklayici degildir.
Dogru referans, VLC'de calisan RTSP adresidir.

Android gateway'in kendi stock browser'i `stream.html?src=ofis_kamera` sayfasinda siyah ekran
gosterebilir. Bu durumda once go2rtc API kontrol edilmelidir:

```text
http://127.0.0.1:1984/api/streams
http://127.0.0.1:1984/api/stream.m3u8?src=ofis_kamera
http://127.0.0.1:1984/api/stream.mp4?src=ofis_kamera
```

`api/streams` icinde `ofis_kamera` altinda RTSP producer ve H.264 video gorunuyorsa kamera
baglantisi vardir. Siyah ekran buyuk ihtimalle cihazdaki eski tarayicinin WebRTC/MSE/HLS
oynatma destegiyle ilgilidir.

JPEG snapshot endpoint'i Android gateway uzerinde `ffmpeg` gerektirebilir. Cihazda `ffmpeg`
yoksa `api/frame.jpeg?src=ofis_kamera` 500 donebilir; bu RTSP/H.264 akisinin calismadigi
anlamina gelmez.

## Android Root Autostart

Multitek cihazda normal APK kullanicisi `su` calistiramadigi ve app-user olarak baslayan
go2rtc `:1984` portunu acamadigi icin kalici baslatma root-level vendor hook ile yapilir.

Kurulum script'i:

```bash
./install-root-autostart-android.sh
```

Bu script:

1. `/data/local/tmp/staj-gateway/start-go2rtc-root.sh` wrapper'ini cihaza kopyalar
2. wrapper'i test eder
3. `/system` partition'ini gecici olarak read-write yapar
4. `/system/bin/starapp.sh` dosyasini `/system/bin/starapp.sh.staj.bak` olarak yedekler
5. `starapp.sh` sonuna `staj-gateway-autostart` hook'u ekler
6. `/system` partition'ini tekrar read-only yapar

Boot hook su isi yapar:

```text
sleep 20
/data/local/tmp/staj-gateway/start-go2rtc-root.sh
```

Wrapper idempotent calisir: PID dosyasindaki process halen go2rtc ise yeni process acmaz.

Kontrol dosyalari:

```text
/data/local/tmp/staj-gateway/boot-hook.log
/data/local/tmp/staj-gateway/autostart.log
/data/local/tmp/staj-gateway/go2rtc.log
/data/local/tmp/staj-gateway/go2rtc.pid
```

2026-06-18 reboot testinde hook basariyla calisti ve `http://10.1.1.3:1984` boot sonrasinda
`401 Unauthorized` dondu.

## Eksik Olanlar

Bu noktada hala tamamlanmasi gereken alanlar:

- `CAMERA_RTSP_SUB_PATH`
  - Alt akis varsa onun path bolumu
- `TURN_URL`
  - Sadece dis agda dogrudan baglanti basarisiz olursa
- `TURN_USER`
  - TURN kimlik dogrulamasi icin
- `TURN_PASSWORD`
  - TURN kimlik dogrulamasi icin

Iste bu yüzden `go2rtc.yaml` dosyasinda sifreyi degil, parcalardan uretilen URL'yi tutuyoruz.

## go2rtc.yaml icindeki ana alanlar

### `streams`
Kamera kaynaklarini tutar.

- `ofis_kamera`: su an dogrulanan ana RTSP yayini
- ileride `ofis_kamera_sub`: alt akis icin ayrilabilir

### `webrtc`
WebRTC yayinini dinleyen portu ve STUN bilgisini tutar.

### `api`
Servisin durumunu kontrol etmek icin kullanilir.
Bu alanda `GO2RTC_API_USERNAME` ve `GO2RTC_API_PASSWORD` ile basic auth aktiftir.

## Bu klasorde sonraki adim

1. Fiziksel Android telefonu ayni Wi-Fi uzerinde gateway'e bagla
2. Sub stream varsa onu da ekle
3. Public TURN sunucusunu bagla
4. WebRTC tarafini native mobil uygulama ile tekrar test et

## Calistirma

Bu klasorde bir baslatma scripti var:

```bash
./run-go2rtc.sh
```

Script su sirayi izler:

1. Proje kokundeki `.env` dosyasini yukler
2. `go2rtc.yaml` dosyasini okur
3. `go2rtc -c go2rtc.yaml` komutunu calistirir

Eger script calismadan once `go2rtc` binary'si sistemde kurulu degilse, once onu kurman gerekir.

## Android gateway icin kaliciya yakin baslatma

Akilli diyafon Android tabanli gateway olarak kullaniliyorsa, ayni klasorde
Android'e ozel yardimci script'ler bulunur:

```bash
./run-go2rtc-android.sh
./status-go2rtc-android.sh
./stop-go2rtc-android.sh
```

Bu script'lerin amaci mevcut mobil yapıyı degistirmeden Android cihazda:

1. ARM64 `go2rtc` binary'sini dogru klasore kopyalamak
2. `go2rtc.yaml` dosyasini cihaza tasimak
3. `.env` icindeki kamera bilgilerini shell ortaminda vermek
4. go2rtc API auth ve TURN/STUN bilgilerini shell ortaminda vermek
5. `go2rtc`'yi `nohup` ile log dosyasina yazarak arka planda baslatmak

Varsayilan hedef cihaz:

```text
10.1.1.3:5555
```

Gerekirse hedef seri numarasi degistirilebilir:

```bash
ANDROID_GATEWAY_SERIAL=10.1.1.3:5555 ./run-go2rtc-android.sh
```

Android cihaz tarafinda kullanilan calisma klasoru:

```text
/data/local/tmp/staj-gateway
```

Bu script artik cihaz icinde su kalici komutu da uretir:

```text
/data/local/tmp/staj-gateway/start-go2rtc-device.sh
```

Bu dosya, boot receiver veya benzeri bir Android autostart mekanizmasi tarafindan
dogrudan cagrilabilir.

Ilk testte foreground calisma halen en guvenli yoldur. Ancak bu script'ler,
yeniden kurulum ve tekrar baslatma adimlarini tek komutta ve daha az hatayla
yapabilmek icin eklendi.

## Android Autostart Yardimci APK

`android-autostart/` klasorunde, Android cihaz acilisinda
`start-go2rtc-device.sh` komutunu calistirmak icin kucuk bir helper APK
iskeleti bulunur.

Bu iskelet:

- `BOOT_COMPLETED` dinler
- `MY_PACKAGE_REPLACED` dinler
- `su -c /data/local/tmp/staj-gateway/start-go2rtc-device.sh` calistirir

Bu sayede autostart mantigi repo seviyesinde somutlastirilmis olur.
Ancak son adim olan gercek boot testi hala cihaz uzerinde yapilmalidir.

## Kontrol Noktalari

go2rtc calistiktan sonra su adresler kontrol edilir:

- API: `http://localhost:1984`
- WebRTC portu: `8555`

Burada ana hedef, RTSP kaynağının go2rtc tarafında gorunmesi ve WebRTC uyumlu sekilde servis edilebilmesidir.
Bu hedef lokal test icin tamamlandi.
Dış ağ ve üretim için TURN, auth ve HTTPS/WSS katmanlari hala gereklidir.
