# SyncLine — "Hattını taşı, telefonu bırak"

SyncLine, çift cihazlı bir köprüleme (bridging) platformudur. Evde veya ofiste bıraktığınız SIM kart takılı bir Android telefonu (Companion), gelen tüm SMS, çağrı ve bildirimleri WebSocket/WebRTC aracılığıyla, SIM kartı bulunmayan iOS cihazınıza (Client) uçtan uca şifreli (E2E AES-256-GCM) olarak yönlendirir.

---

## 1. Mimari Genel Bakış

```
+--------------------------+     WebSocket (WSS)     +--------------------------+
|  Android Companion (SIM) | <=====================> |    Sync-Service (Node)   |
|  - Foreground Listener   |                         |    - Redis Streams Queue |
|  - BootCompletedReceiver |                         |    - PostgreSQL Storage  |
+--------------------------+                         +--------------------------+
             ^                                                     ^
             |                                                     | WebSocket (WSS)
             | WebRTC Audio (DTLS-SRTP)                            v
             | P2P voice bridge                      +--------------------------+
             +-------------------------------------> |      iOS Client (SIM)    |
                                                     |      - PushKit / CallKit |
                                                     |      - CryptoManager     |
                                                     +--------------------------+
```

---

## 2. İlk Çalıştırma Checklist'i

Sistemi sıfırdan kurarken aşağıdaki adımları sırasıyla takip edin:

1. **Docker Altyapısı**: Postgres, Redis ve Coturn servislerinin ayakta olduğundan emin olun.
2. **Backend Göçleri (Migrations)**: Database tablolarını oluşturmak için migrator script'ini çalıştırın.
3. **Android İzinleri**: Android cihazda uygulamayı açtıktan sonra; *SMS Alma*, *Telefon Durumu*, *Arama Kayıtları* ve *Pil Optimizasyonu Muafiyeti* izinlerini onaylayın.
4. **iOS Push Sertifikaları**: Apple Developer portalında APNs VoIP Push sertifikalarını oluşturun ve `push-service` altındaki `certs/` klasörüne yerleştirin.
5. **Eşleştirme (Pairing)**: Android'de üretilen 6 haneli kodu iOS cihazında taratarak veya manuel girerek güvenli E2E anahtar alışverişini gerçekleştirin.

---

## 3. Kurulum ve Geliştirme Adımları

Sistemin kurulumu sırasıyla **Backend**, **Android** ve **iOS** şeklinde yapılmalıdır:

### Adım 1: Backend Altyapısının Kurulması
Backend monorepo Turborepo ile yönetilmektedir.

```bash
# Bağımlılıkları yükleyin
cd syncline-backend
npm install

# PostgreSQL veri tabanı şemasını güncelleyin
npm run migrate

# Docker altyapısını başlatın (Redis, Postgres, Coturn)
docker-compose up -d
```

*Not: Coturn (TURN) sunucusu `syncline-backend/infrastructure/coturn/turnserver.conf` dosyasındaki statik HMAC secret anahtarı ile dış dünyaya UDP `3478` portundan hizmet verecek şekilde ayağa kalkar.*

---

### Adım 2: Android Companion Derleme
Android uygulaması Kotlin, Hilt DI ve Room veri tabanı kullanmaktadır.

```bash
cd syncline-android

# Debug APK paketini derleyin
./gradlew assembleDebug
```
*Eğer yerel bilgisayarınızda Gradle kurulu değilse, projeyi Android Studio ile açarak otomatik Gradle sync sonrasında `Run` veya `Build > Build APK` menüsünden APK alabilirsiniz.*

> [!IMPORTANT]
> **Kritik Kontrol Noktası**: Android Companion uygulamasında `BOOT_COMPLETED` alıcısı (`BootCompletedReceiver`) manifest dosyasında tanımlanmıştır. Cihaz yeniden başladığında arka plan servisi otomatik olarak ayağa kalkacaktır.

---

### Adım 3: iOS Client Derleme
iOS uygulaması Swift 5.9, SwiftUI, Combine, CallKit ve PushKit kullanmaktadır.

```bash
cd syncline-ios

# Paket bağımlılıklarını çözün (SPM)
swift package resolve

# Uygulamayı derleyin ve arşivi oluşturun
xcodebuild -scheme SyncLine -configuration Release archive -archivePath ./build/SyncLine.xcarchive
```

> [!WARNING]
> **Kritik Kontrol Noktası**: iOS tarafında CallKit ekranlarının kilit ekranında veya arka planda açılabilmesi için `SyncLine.entitlements` dosyasında `aps-environment` (PushKit) tanımlı olmalı ve `Info.plist` içinde `UIBackgroundModes` altında `voip` ve `remote-notification` modları aktif edilmiş olmalıdır. Sideloading yaparken (AltStore veya Sideloadly) bu entitlement'ların imza profiliyle eşleştiğinden emin olun.

---

## 4. Bilinen Sınırlamalar ve v2 Backlog

### Bilinen Sınırlamalar (v1.0 MVP)
* **Tek SIM Desteği**: v1.0 sürümünde sadece birincil etkin SIM kart yuvasındaki çağrılar ve SMS'ler yönlendirilir.
* **Apple Developer Hesabı Bağımlılığı**: PushKit / VoIP Push bildirimlerinin iletilmesi ve CallKit kilit ekranı entegrasyonu için geçerli bir Apple Developer sertifikası ile imzalama veya özel sideloading konfigürasyonu gereklidir.
* **Medya (MMS) Kısıtlaması**: Şimdilik sadece düz metin (text) SMS mesajları ve çağrı durumları yönlendirilir; MMS fotoğrafları veya sesli mesajlar desteklenmemektedir.

### v2.0 Yol Haritası (Backlog)
- **Dual-SIM Desteği**: Her iki SIM slotunu bağımsız olarak takip etme ve iOS üzerinden hangi hattan SMS/Arama çıkılacağını seçebilme.
- **MMS / Görsel Yönlendirme**: SMS ile gelen resimli/dosyalı içeriklerin E2E şifreli olarak AWS S3 / MinIO üzerinden aktarılması.
- **Web App / Desktop Companion**: iOS'un yanı sıra macOS, Windows veya tarayıcı üzerinden çağrı ve SMS yönetimi.
