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

## Canli Goruntu Nasil Calisiyor?

Su anki stabil akis:

```text
IP Kamera
  -> RTSP
  -> go2rtc
  -> go2rtc web player
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
  - Emulator veya fiziksel cihaz adresleri `EXPO_PUBLIC_*` degiskenleriyle verilebilir.
  - WebView Basic Auth bilgisi native `basicAuthCredential` ile aktarilir.
  - `playerUrl` su an aktif canli goruntu yoludur.
  - `wsUrl` ileride native WebRTC denemesi icin ayrilmistir.

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
EXPO_PUBLIC_SIGNALING_URL="wss://<gecici-host>.trycloudflare.com/ws" npm run android:device
```

Bu script gateway cihazini hedef listesinden ayirir, yerel `.env` varsa yukler ve yoksa
go2rtc test kimlik bilgisini bagli gateway start script'inden alir. Kimlik bilgisi repoya
yazilmaz; bu akis yalnizca LAN gelistirme testi icindir.

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

1. Dis ag icin TURN server eklemek
2. Kullanici girisi ve yetkilendirme eklemek
3. Sifreleri mobil uygulamaya koymadan backend/gateway tarafinda tutmak
