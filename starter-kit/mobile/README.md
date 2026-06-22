# Mobile Kismi

Bu klasor, Android emulator ve fiziksel cihazda calisan mobil kamera izleme uygulamasini tutar.
Uygulama React Native + Expo ile hazirlandi.

## Simdiki Durum

- Ana ekran, sekmeler, profil menusu ve ayarlar hazir
- Light mode / dark mode secimi hazir
- Turkce, English ve العربية dil secimi hazir
- Signaling server baglantisi `Durum` sekmesinde calisiyor
- go2rtc player `Canli` sekmesinde uygulama icinde aciliyor
- Gercek kamera goruntusu artik mobil uygulama icinde gorulebiliyor
- Samsung S24 FE uzerinde auth, WebRTC, tam ekran ve signaling baglantisi dogrulandi
- `/cameras` katalogu Genel ekraninda listeleniyor ve secili kamera canli ekrana aktariliyor
- Uygulama acilisinda kullanici adi/parola ile 60 dakikalik signaling oturumu aciliyor
- Statik signaling admin tokeni APK'ya gomulmuyor

## Canli Goruntu Nasil Calisiyor?

Su anki stabil akis:

```text
IP Kamera
  -> RTSP
  -> go2rtc
  -> Signaling Server WebRTC bridge
  -> kimlik dogrulamali player
  -> React Native WebView
  -> Android uygulama ekrani
```

Yani mobil uygulama RTSP adresini dogrudan acmaz.
RTSP, mobil uygulamalar icin dogrudan uygun bir oynatma protokolu degildir.
Bu yuzden araya go2rtc koyuyoruz.

## Neden WebView Kullanildi?

Ilk denemede `react-native-webrtc` ile native WebRTC baglantisi acildi.
Fakat Android emulatorde `RTCPeerConnection.setLocalDescription` asamasinda
native kutuphane uygulamayi kapatti.

Bu JavaScript hatasi degil.
React Native tarafindaki native WebRTC kutuphanesinin Android icinde crash
uretmesi anlamina gelir.

Projeyi ilerletmek icin daha stabil olan yol secildi:

- go2rtc zaten kamerayi basariyla oynatiyor
- Chrome icinde goruntu calisiyor
- Aynisi `react-native-webview` ile uygulama icine alindi
- Boylece canli izleme ekrani calisan hale geldi

## Dosya Yapisi

- `src/AppShell.tsx`
  - Uygulamanin ana yoneticisidir.
  - Aktif sekmeyi, temayi, dili ve ana ekran akisini burada toplar.

- `src/cameras.ts`
  - Mobil uygulamada bilinen kamera listesini tutar.
  - Su an tek kamera vardir: `ofis_kamera`.
  - Ileride bu liste backend API'den gelebilir.

- `src/screens/LiveScreen.tsx`
  - Canli kamera ekranidir.
  - go2rtc player adresini WebView icinde acar.

- `src/webrtc/config.ts`
  - go2rtc adreslerini tek yerde tutar.
  - Player ve gateway durum adreslerini signaling server uzerinden uretir.
  - go2rtc kullanici adi ve parolasi mobil uygulamaya verilmez.
  - TURN bilgileri build-time secret olarak APK'ya gomulmez; yetkili katalogdan runtime gelir.

- `src/webrtc/useGo2RtcWebrtc.ts`
  - Native WebRTC denemesi icin hazirlanan hook'tur.
  - Su an uygulama tarafindan otomatik kullanilmiyor.
  - Daha sonra fiziksel cihaz veya daha uyumlu kutuphane surumuyle tekrar test edilebilir.

- `src/signaling/useSignalingConnection.ts`
  - Signaling server ile WebSocket baglantisini kurar.
  - `join`, `members`, `offer`, `answer`, `ice-candidate` gibi mesajlari tasimak icin temel katmandir.

## Calistirma

Gateway ve server ayakta olmalidir:

```bash
cd /Users/macbookpro/Desktop/StajProject/starter-kit/gateway
./run-go2rtc.sh
```

```bash
cd /Users/macbookpro/Desktop/StajProject/starter-kit/server
node signaling-server.js
```

Mobil uygulama:

```bash
cd /Users/macbookpro/Desktop/StajProject/starter-kit/mobile
JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" \
ANDROID_HOME="/Users/macbookpro/Library/Android/sdk" \
PATH="/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin:$PATH" \
npm run android
```

Fiziksel Android telefon USB ADB ile bagliyken:

```bash
npm run android:device
```

Gecici public WSS tunnel testi icin:

```bash
EXPO_PUBLIC_SIGNALING_URL="wss://<signaling-host>.trycloudflare.com/ws" \
GATEWAY_PUBLIC_BASE_URL="https://<gateway-host>.trycloudflare.com" \
npm run android:device
```

Bu script gateway cihazini hedef listesinden ayirir ve yerel `.env` icindeki signaling
adresiyle mobil build'i olusturur. Signaling admin tokenini, login parolasini, go2rtc ve
TURN parolalarini Expo public degiskenlerine aktarmaz.

Uygulama her yeniden acildiginda giris ister. Session tokeni yalnizca uygulama belleginde
tutulur ve server tarafinda 60 dakika sonra gecersiz olur.

Native WebRTC hedef Android surumunde dogrulanana kadar varsayilan olarak kapalidir.
Kontrollu test icin ek olarak `EXPO_PUBLIC_NATIVE_WEBRTC_ENABLED=true` verilebilir.

## Kontrol Noktalari

- go2rtc arayuzu: `http://localhost:1984`
- go2rtc stream: `ofis_kamera`
- Android emulator icinden go2rtc player:
  `http://10.0.2.2:1984/stream.html?src=ofis_kamera`
- Signaling health:
  `http://localhost:3000/health`
- Fiziksel cihaz gateway player:
  `http://10.1.1.3:1984/stream.html?src=ofis_kamera`

## Siradaki Eksikler

1. Tek `.env` kullanicisini veritabani ve kamera bazli yetkilendirmeyle degistirmek
2. TURN icin kisa omurlu credential servisi eklemek
3. Native WebRTC yolunu hedef Android surumunde dogrulamak
