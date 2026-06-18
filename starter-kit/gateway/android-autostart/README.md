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

3. Event geldiginde:

```text
su -c /data/local/tmp/staj-gateway/start-go2rtc-device.sh
```

komutunu calistirir.

## On kosullar

- Cihaz root/su erisimi vermeli
- `run-go2rtc-android.sh` en az bir kez calismis olmali
- `start-go2rtc-device.sh` cihazda olusmus olmali

## Not

Bu klasor repo icinde autostart mantigini somutlastirmak icin eklendi.
Gercek devreye alma:

- cihazin vendor Android kisitlari
- su binary'sinin gercek davranisi
- boot receiver izinleri

gibi nedenlerle sahada ayrıca test edilmelidir.
