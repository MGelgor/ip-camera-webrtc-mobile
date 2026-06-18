# IP Kamera WebRTC Mobil İzleme Projesi

Bu proje, bir IP kameranın görüntüsünü statik IP olmadan mobil uygulamadan canlı izletmek için hazırlanmış bir sistem taslağıdır.

Bu dokümanın amacı şudur:
- Projenin ne yaptığını sade şekilde anlatmak
- Sistemdeki parçaların görevini açıklamak
- Uygulamayı hangi sırayla kuracağımızı göstermek
- Staj sürecinde hangi adımları izleyeceğimizi netleştirmek

## 1. Projenin Kısa Özeti

Bir IP kamera genellikle yerel ağda çalışır. Kamera görüntüsü çoğu zaman `RTSP` ile alınır. Ancak `RTSP`, mobil uygulamalarda ve tarayıcılarda doğrudan rahat çalışmaz. Bu yüzden görüntü, `WebRTC` ile izlenebilir hale getirilir.

Bu projede hedeflenen yapı şudur:

```text
IP Kamera -> Media Gateway -> WebRTC -> Mobil Uygulama
```

Gerekirse bağlantı için ayrıca:

```text
Signaling Server -> STUN/TURN Server
```

kullanılır.

## 2. Bu Proje Ne İşe Yarıyor

Bu sistem sayesinde:
- Kamera görüntüsü telefondan canlı izlenir
- Statik IP ihtiyacı azalır veya ortadan kalkar
- NAT ve firewall arkasındaki cihazlara daha kolay erişilir
- Düşük gecikmeli yayın elde edilir
- Mobil uygulama üzerinden güvenli izleme yapılır

## 3. Temel Terimler

Bu projede sık geçen kavramlar:

- `IP Kamera`: Ağa bağlı çalışan kamera
- `RTSP`: Kameranın canlı video yayını için kullandığı protokol
- `WebRTC`: Tarayıcı ve mobilde gerçek zamanlı ses/video aktarımı sağlayan teknoloji
- `NAT`: Modemin içerideki cihazları dış dünyadan gizlemesi
- `STUN`: Cihazın dış dünyada hangi IP/port ile göründüğünü öğrenmesini sağlar
- `TURN`: Doğrudan bağlantı kurulamazsa videoyu aradan geçirir
- `Signaling`: Bağlantı kurmak için gerekli mesajların değiş tokuşu
- `Media Gateway`: Kameradan gelen RTSP yayınını WebRTC’ye çeviren köprü yazılım

## 4. Sistemin Çalışma Mantığı

Sistemi en sade haliyle şöyle düşünebilirsin:

1. Kamera görüntü üretir.
2. Bu görüntü ağ içinde RTSP olarak alınır.
3. `go2rtc` veya benzeri bir medya geçidi, bu yayını WebRTC uyumlu hale getirir.
4. Mobil uygulama, signaling server üzerinden bağlantı kurar.
5. Gerekirse STUN/TURN yardımıyla NAT arkasındaki bağlantı çözülür.
6. Kullanıcı telefondan canlı görüntüyü izler.

## 5. Önerilen Bileşenler

Bu proje için önerilen temel bileşenler şunlardır:

- `IP Kamera`: Görüntü kaynağı
- `go2rtc`: RTSP yayınını WebRTC’ye dönüştürmek için
- `Signaling Server`: Tarafları eşleştirmek için
- `coturn`: STUN/TURN sunucusu olarak
- `React Native`: Mobil uygulama için

## 6. Neden Bu Mimari Seçildi

Bu mimari seçildi çünkü:
- Düşük gecikme sağlar
- Mobil cihazlarda çalışır
- Tarayıcı desteği vardır
- Güvenlik açısından RTSP’yi doğrudan internete açmaktan daha iyidir
- Statik IP olmadan çalışabilir

## 7. Uygulamayı Nasıl Kuracağız

Projeyi kurarken sıralama önemlidir. En doğru ilerleme şu şekildedir:

### 7.1 Kamera Yayınını Doğrula

Önce kameranın RTSP adresi bulunur ve yerelde çalıştığı doğrulanır.

Kontrol edilmesi gereken şeyler:
- Kamera ağda erişilebilir mi
- RTSP adresi doğru mu
- Kullanıcı adı ve şifre doğru mu
- Görüntü yerel bilgisayarda açılıyor mu

### 7.2 Media Gateway Kur

Sonra `go2rtc` ya da benzeri bir araç kurulur.

Bu katmanın görevi:
- RTSP akışını almak
- WebRTC’ye dönüştürmek
- Gerektiğinde HLS, MSE gibi başka formatlar sunmak

### 7.3 Signaling Server Kur

Mobil uygulama ile medya sunucusunun birbirini bulması gerekir. Bunun için bir signaling server kurulur.

Bu sunucu:
- Video taşımaz
- Sadece bağlantı bilgilerini taşır
- SDP ve ICE candidate mesajlarını iletir

### 7.4 STUN/TURN Kur

Eğer doğrudan bağlantı kurulamazsa TURN devreye girer.

STUN/TURN özellikle şu durumlarda önemlidir:
- Kullanıcı mobil veri kullanıyorsa
- Kamera tarafı NAT arkasındaysa
- Modem firewall kısıtları varsa

### 7.5 Mobil Uygulamayı Kur

Son adımda mobil uygulama yazılır.

Mobil uygulamanın görevi:
- Kullanıcıyı giriş yaptırmak
- Kamera seçtirmek
- Signaling server ile konuşmak
- WebRTC bağlantısını kurmak
- Canlı görüntüyü ekranda göstermek

## 8. Geliştirme Sırası

Bu proje için önerilen geliştirme sırası:

1. Yerel ağda RTSP yayınını çalıştır
2. `go2rtc` ile bu yayını WebRTC’ye çevir
3. Tarayıcıda canlı yayını aç
4. Mobilde WebRTC bağlantısını kur
5. Signaling server ekle
6. STUN/TURN ekle
7. Dış ağdan test yap
8. Güvenlik ve kullanıcı yönetimini ekle

## 9. İlk Hedefler

İlk aşamada amaç eksiksiz ürün çıkarmak değil, sistemi parça parça doğrulamaktır.

İlk hedefler:
- Kamera yayınını görmek
- RTSP akışını almak
- WebRTC üzerinden bir istemciye ulaştırmak
- Mobil uygulamada canlı görüntü göstermek

## 10. Test Planı

Her adımda şu testler yapılmalıdır:

- RTSP yayını açılıyor mu
- go2rtc yayını görüyor mu
- Tarayıcı görüntüyü oynatıyor mu
- Mobil uygulama bağlanıyor mu
- NAT arkasından bağlantı kurulabiliyor mu
- TURN devreye girdiğinde yayın devam ediyor mu

## 11. Güvenlik Notları

Bu sistem internete açılabileceği için güvenlik önemli:

- Kamera RTSP adresini istemci tarafında açık bırakma
- Signaling server için güvenli bağlantı kullan
- TURN sunucusunda kimlik doğrulama kullan
- Mümkünse HTTPS ve WSS kullan
- Kamera erişimini ayrı bir ağda tut

## 12. Staj İçin Nasıl Sunulur

Şirkete anlatırken şu sırayı kullanmak faydalı olur:

1. Problem: Kamera görüntüsü dışarıdan izlenemiyor
2. Neden: RTSP, NAT ve statik IP sorunları var
3. Çözüm: RTSP -> WebRTC dönüşümü
4. Köprü: go2rtc gibi media gateway
5. Bağlantı: signaling server + STUN/TURN
6. Uygulama: React Native mobil istemci
7. Sonuç: Düşük gecikmeli ve güvenli canlı izleme

## 13. Bu Repo İçinde Sonraki Adım Ne Olmalı

Bu klasörde şu işleri sırayla yapabiliriz:

1. Önce teknik terimler için kısa bir sözlük çıkarabiliriz
2. Sonra örnek klasör yapısı tasarlayabiliriz
3. Ardından `go2rtc` ve signaling server için örnek konfigürasyon hazırlayabiliriz
4. Son olarak mobil uygulama tarafında temel ekran akışını oluşturabiliriz

## 14. Kısa Sözlük

- `Codec`: Videonun nasıl sıkıştırıldığını belirler
- `H.264`: Kameralarda çok yaygın video codec’i
- `ICE Candidate`: Bağlantı kurmak için aday yollar
- `Peer`: WebRTC bağlantısındaki iki uçtan biri
- `Offer/Answer`: WebRTC bağlantı kurma mesajları
- `Relay`: Trafiğin sunucu üzerinden aktarılması

## 15. Sonuç

Bu proje, kameradan gelen görüntüyü dış dünyaya güvenli ve düşük gecikmeli şekilde ulaştırmayı hedefler.

En doğru yaklaşım:
- Önce yerel RTSP yayınını doğrulamak
- Sonra WebRTC’ye çevirmek
- Sonra mobil istemciyi bağlamak
- En son STUN/TURN ile dış ağ bağlantısını çözmek

Bu README, proje ilerledikçe güncellenebilir.
