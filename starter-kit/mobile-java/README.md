# Mobile Java

Bu klasor, `starter-kit/mobile` altindaki React Native/Expo uygulamasinin Android Java karsiligidir.
Eski TypeScript React Native uygulamasi silinmedi; iki uygulama yan yana durur.

## Kapsam

- Kullanici adi/parola ile `POST /auth/login`
- Kisa omurlu access tokenin yalnizca bellek icinde tutulmasi
- `GET /cameras` kamera katalogu
- Secili kamerayi canli ekrana aktarma
- go2rtc/signaling player sayfasini Android `WebView` icinde acma
- `GET /gateway/status` ile producer kontrolu
- Signaling WebSocket `join` baglantisi ve durum ekrani
- Basit kurulum, ayarlar ve notlar sekmeleri

Native WebRTC yolu bu Java surumune alinmadi. Mevcut mobil README'de belirtildigi gibi stabil yol,
kimlik dogrulamali go2rtc player'in WebView icinde acilmasidir.

## Build

Scriptler `../.env` dosyasini otomatik yukler. Fiziksel cihaz icin genelde
`EXPO_PUBLIC_SIGNALING_URL` veya `MOBILE_SIGNALING_URL` degeri gerekir.

```bash
cd starter-kit/mobile-java
./scripts/build-android-debug.sh
```

APK:

```text
app/build/outputs/apk/debug/app-debug.apk
```

## Telefona Kurma

```bash
cd starter-kit/mobile-java
./scripts/run-android-device.sh
```

Varsayilan adres sirasi:

1. `MOBILE_SIGNALING_URL`
2. `EXPO_PUBLIC_SIGNALING_URL`
3. `SIGNALING_PUBLIC_HOST` / `SIGNALING_PUBLIC_PORT`
4. `SIGNALING_HOST` / `SIGNALING_PORT`
5. `ws://10.0.2.2:3000/ws` emulatore fallback

Fiziksel telefonda `10.0.2.2` calismaz; cihaz ile bilgisayarin erisebildigi LAN veya public
signaling adresini kullanin.
