# Voice Bugfix Progress

## Raporlanan 3 Bug

### Bug 1: Ses Bağlı çubuğu 3-4 saniye sonra 0 oluyor
- **Durum**: ✅ Analiz tamamlandı, ✅ Fix uygulandı
- **Root Cause**: `useLiveKitRoom.ts` room.connect()'te `rtcConfig.iceServers` hardcode edilmişti. Bu, LiveKit sunucusunun token içinde gönderdiği TURN sunucularını EZİYORDU. Sadece STUN kaldığı için symmetric NAT arkasında media path kurulamıyordu.
- **Fix**: `iceServers` override'ı kaldırıldı → LiveKit'in kendi ICE konfigürasyonu (STUN + TURN) kullanılıyor.

### Bug 2: Sağ üst Connection "Lost" oluyor
- **Durum**: ✅ Fix uygulandı (Bug 1 ile aynı fix)
- **Root Cause**: Bug 1 ile aynı. ICE/TURN eksikliği düzeltilince connection quality da düzelecek.

### Bug 3: Konuşma göstergesi gecikmeli ve düşük hassasiyetli
- **Durum**: ✅ Analiz tamamlandı, ✅ Fix uygulandı
- **Root Cause**: `voiceActivityThreshold` ayarı store'da ve UI'da var ama hiçbir yerde kullanılmıyordu. LiveKit'in dahili VAD'ı yüksek eşikli ve ~300-500ms gecikmeli.
- **Fix**: Custom Web Audio API VAD implementasyonu eklendi:
  - `AnalyserNode` ile mikrofon seviyesi ~16ms aralıklarla ölçülüyor
  - `voiceActivityThreshold` store değeri eşik olarak kullanılıyor
  - Otomatik mod: varsayılan eşik 8 (düşük, hassas)
  - 150ms silence debounce (flicker önleme)
  - Mute kontrolü: mute'ken speaking=false
  - Reconnect sonrası otomatik restart

---

## Uygulama Planı

### Adım 1: TURN Sunucusu Desteği (Bug 1 & 2)
**Dosya**: `useLiveKitRoom.ts` satır 657-666

Seçenek A (Önerilen): LiveKit sunucu tarafında TURN konfigürasyonu yapılır, token içinde otomatik gelir.
Seçenek B: Client-side TURN credential'ları environment variable olarak eklenir.

**Yapılacaklar**:
1. LiveKit sunucusunun `livekit.yaml` veya `config.yaml`'ına TURN sunucusu ekle (coturn veya LiveKit'in built-in TURN'ü)
2. Alternatif: `useLiveKitRoom.ts`'de room.connect() çağrısına TURN iceServers ekle
3. `docker-compose` dosyalarına TURN env variables ekle
4. Media-signalling service'e TURN credential rotation desteği ekle

### Adım 2: voiceActivityThreshold'u LiveKit'e Bağla (Bug 3)
**Dosya**: `useLiveKitRoom.ts` Room oluşturma bölümü

**Yapılacaklar**:
1. Custom AudioAnalyser implementasyonu:
   - Web Audio API ile mikrofon seviyesini ölç
   - `voiceActivityThreshold` store değerini eşik olarak kullan
   - Eşiğin altındaysa `setSpeaking(false)`, üstündeyse `setSpeaking(true)` çağır
   - Debounce: 50ms (gecikmeyi minimuma indir)
2. VEYA LiveKit'in `AudioAnalyserOptions` kullan (eğer destekliyorsa)

### Adım 3: Mikrofon Hassasiyetini Artır (Bug 3)
**Dosya**: `apps/web/src/lib/audio/types.ts`

**Yapılacaklar**:
1. Standard mode'da AGC'yi aktif tut (zaten aktif)
2. Room oluşturmada `audioCaptureDefaults`'a `channelCount: 1`, `sampleRate: 48000` ekle
3. Input volume amplification: store'daki `inputVolume` değerini GainNode ile uygula

### Adım 4: Test & Doğrulama
1. Voice Debug Overlay (Ctrl+Shift+D) ile bağlantı kalitesini kontrol et
2. Farklı ağ koşullarında test et (WiFi, 4G, NAT arkası)
3. Mikrofon hassasiyetini farklı mesafelerden test et

---

---

## Desktop App Donma Sorunları - Analiz & Fix

### Bug 4: GatewayClient.disconnect() destroyed flag YANLIŞ (KRİTİK)
- **Durum**: ✅ Fix uygulandı
- **Root Cause**: `GatewayClient.ts:143` → `this.destroyed = false` olması gereken `true` idi. Disconnect sonrası sendQueue sınırsız büyüyordu çünkü `destroyed=false` olduğu için mesajlar queue'lanmaya devam ediyordu.
- **Fix**: `this.destroyed = true` + sendQueue'ye 500 mesaj limiti eklendi.

### Bug 5: Electron webRequest hook'ları her HTTP isteğinde çalışıyor
- **Durum**: ✅ Fix uygulandı
- **Root Cause**: `main.js` → `onBeforeSendHeaders` ve `onHeadersReceived` tüm isteklerde (JS, CSS, images dahil) senkron çalışıyordu, main thread'i blokluyordu.
- **Fix**: `onBeforeSendHeaders`'e URL filtresi eklendi (sadece http/https), local server istekleri skip ediliyor. `onHeadersReceived` CSP'yi sadece document isteklerine uyguluyor.

### Bug 6: Window resize'da her pixel için senkron disk yazma
- **Durum**: ✅ Fix uygulandı
- **Root Cause**: `main.js` → `mainWindow.on('resize')` her pixel'de `store.set()` çağırıyordu. electron-store senkron yazdığı için main thread bloklanıyordu.
- **Fix**: 500ms debounce eklendi.

### Bug 7: useDesktopTray badge count her store değişikliğinde IPC yapıyor
- **Durum**: ✅ Fix uygulandı
- **Root Cause**: `useDesktopTray.ts:72` → `useMessagesStore.subscribe()` her store mutation'ında (mesaj, typing, her şey) `computeUnread()` + IPC çağrısı yapıyordu.
- **Fix**: 500ms throttle + değer değişmediyse IPC skip.

### Bug 8: useVoiceActions callback'leri her mute/deafen'da yeniden oluşuyor
- **Durum**: ✅ Fix uygulandı
- **Root Cause**: `toggleMute`, `toggleDeafen` vb. `useCallback` dependency'leri `selfMuted`, `selfDeafened` gibi sık değişen state'lerdi. Her mute/unmute'da callback referansı değişiyor → `useVoiceKeyboardShortcuts`'un global shortcut'ları unregister/register etmesine neden oluyordu.
- **Fix**: Tüm toggle callback'leri `useVoiceStore.getState()` kullanacak şekilde refactor edildi. Dependency array'ler `[]` oldu → stabil referanslar, gereksiz re-render yok.

## Notlar
- LiveKit Cloud kullanılıyorsa TURN otomatik gelir - self-hosted ise manuel konfigürasyon gerekli
- `voiceActivityThreshold` artık custom Web Audio API VAD ile kullanılıyor
- `ConnectionQualityBars` bileşeni düzgün çalışıyor - sorun quality değerinin kendisiydi (ICE/TURN)
- Desktop app donma sorunu çok katmanlı: destroyed flag + sınırsız queue + senkron disk yazma + sık IPC + callback instability
