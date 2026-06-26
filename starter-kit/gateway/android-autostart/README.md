# Android Gateway Autostart

Bu klasor, Android tabanli akilli diyafonda `go2rtc`'yi cihaz acilisinda
yeniden baslatmak icin kucuk bir helper APK iskeleti tutar.

## Nasil calisir?

1. Host bilgisayardaki `run-go2rtc-android.sh`
   cihaz icine su script'i yazar:

```text
/data/local/tmp/staj-gateway/start-go2rtc-device.sh
```

2. Bu APK:
   - `BOOT_COMPLETED`
   - `MY_PACKAGE_REPLACED`

   event'lerini dinler.

3. Event geldiginde foreground `GatewayWatchdogService` baslar.

4. Watchdog service su komutu dener:

```text
su -c /data/local/tmp/staj-gateway/start-go2rtc-device.sh
```

Bu komut basarili olursa `go2rtc` baslar. Watchdog service `go2rtc` process'i olurse
yeniden baslatmaya calisir.

## Kamera Ekleme Ekrani

APK ana ekrani artik kamera ekleme formu da icerir:

- Kamera adi
- Konum
- Stream adi
- RTSP adresi

APK `POST /admin/cameras` endpoint'ine kayit gonderir. Bu yol, signaling server
katalogunu guncelledigi icin kamera mobil uygulamadaki `/cameras` listesine de eklenir.

Signaling URL/kullanici/parola formda istenmez. Build sirasinda `.env` uzerinden
`SIGNALING_HOST`, `SIGNALING_PORT`, `SIGNALING_AUTH_USERNAME` ve
`SIGNALING_AUTH_PASSWORD` degerleri APK build config'ine yazilir.

Kamera RTSP adresi mobil uygulamaya gonderilmez.

## Multitek Cihaz Notu

2026-06-18 saha testinde cihazda `su` su izinlerle goruldu:

```text
-rwsr-x--- root shell /system/xbin/su
```

Bu nedenle ADB shell root yetkisiyle `go2rtc` baslatabiliyor, ancak normal APK kullanicisi
`su` calistiramiyor. APK kullanicisi start script'i dogrudan calistirdiginde process acilsa bile
Android izinleri nedeniyle `:1984` API portu `permission denied` hatasi ile acilamiyor.

Bu cihazda helper APK tek basina guvenilir root-level autostart saglamaz. Uretim icin daha
dogru yol:

- vendor/firmware seviyesinde init service,
- root shell tarafindan calisan boot script,
- ya da Multitek'in saglayacagi sistem yetkili servis entegrasyonudur.

## On kosullar

- Cihaz root/su erisimi vermeli
- `run-go2rtc-android.sh` en az bir kez calismis olmali
- `start-go2rtc-device.sh` cihazda olusmus olmali
- Helper APK cihazda bir kez acilip "Simdi Baslat" ile manuel test edilmeli

## Not

Bu klasor repo icinde autostart mantigini somutlastirmak icin eklendi.
APK sahadaki Android 6.0.1 gateway cihazina sideload edilecek yardimci uygulama olarak
tasarlandigi icin `targetSdk` dusuk tutulur. Bu, eski cihazlarda boot receiver ve foreground
service davranisini daha ongorulebilir yapar. Play Store dagitimi hedeflenirse bu karar tekrar
degerlendirilmelidir.

Gercek devreye alma:

- cihazin vendor Android kisitlari
- su binary'sinin gercek davranisi
- boot receiver izinleri
- foreground service bildiriminin cihaz UI'inda kabul edilebilirligi

gibi nedenlerle sahada ayrıca test edilmelidir.
