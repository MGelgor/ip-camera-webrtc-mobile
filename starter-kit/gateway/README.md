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

1. RTSP kaynagini sabitle
2. Android reboot sonrasinda otomatik baslatma mekanizmasi ekle
3. Sub stream varsa onu da ekle
4. Public TURN sunucusunu bagla
5. WebRTC tarafini native mobil uygulama ile tekrar test et

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

Ilk testte foreground calisma halen en guvenli yoldur. Ancak bu script'ler,
yeniden kurulum ve tekrar baslatma adimlarini tek komutta ve daha az hatayla
yapabilmek icin eklendi.

## Kontrol Noktalari

go2rtc calistiktan sonra su adresler kontrol edilir:

- API: `http://localhost:1984`
- WebRTC portu: `8555`

Burada ana hedef, RTSP kaynağının go2rtc tarafında gorunmesi ve WebRTC uyumlu sekilde servis edilebilmesidir.
Bu hedef lokal test icin tamamlandi.
Dış ağ ve üretim için TURN, auth ve HTTPS/WSS katmanlari hala gereklidir.
