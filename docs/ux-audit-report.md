# Swiip UX Audit Report

**Tarih:** 2026-03-27
**Durum:** V1 oncesi kapsamli audit

---

## A. Kirик Akislar (Calismayan seyler)

### A1. [KRITIK] Dosya yukleme sessizce kayboluyor
- **Dosya:** `apps/web/src/components/messaging/MessageComposer.tsx` (satir 259)
- Kullanici dosya surukleyip birakiyor, preview goruyor, send'e basiyor ama dosya gonderilmiyor
- `sendMessage()` cagrisi dosyalari dahil etmiyor, `requestAttachmentUpload` hic cagrilmiyor

### A2. [KRITIK] "Discover Servers" butonu 404 veriyor
- **Dosya:** `apps/web/src/components/layout/ServerRail.tsx` (satir 270)
- `/discover` route'u yok

### A3. [YUKSEK] "Create DM" butonu calismiyorU
- **Dosya:** `apps/web/src/components/layout/DMConversationList.tsx` (satir 163-170)
- `// TODO: open create DM modal` yorumu var, handler bos

### A4. [YUKSEK] DM voice/video call butonlari olu
- **Dosya:** `apps/web/src/components/messaging/DMChatView.tsx` (satir 113-129)
- Phone ve Video butonlarinda onClick yok

### A5. [YUKSEK] Kanal hover Invite/Settings ikonlari olu
- **Dosya:** `apps/web/src/components/layout/ChannelSidebar.tsx` (satir 273-292)
- `e.stopPropagation()` var ama handler logic yok

### A6. [YUKSEK] Pinned Messages butonu calismiyorr
- **Dosya:** `apps/web/src/components/layout/ChannelHeader.tsx` (satir 109)
- `onClick: () => {}` — bos

### A7. [YUKSEK] Search ve Inbox butonlari olu
- **Dosya:** `apps/web/src/components/layout/ChannelHeader.tsx` (satir 119, 124)
- Her iki butonun da onClick'i bos

### A8. [ORTA] "Join Server" modali UI'dan erisilemiyorr
- **Dosya:** `apps/web/src/components/modals/ModalRoot.tsx` (satir 27-28)
- `JoinGuildModal` var ama "Add a Server" sadece `create-guild` aciyor
- Kullanicilar invite code ile sadece `/invite/[code]` URL'inden katilabilir

### A9. [ORTA] Server icon upload butonu calismiyorr
- **Dosya:** `apps/web/src/components/modals/CreateGuildModal.tsx` (satir 73-93)
- File input yok, onChange yok, upload logic yok

### A10. [ORTA] Settings "Edit" butonlari (username/email) calismiyorr
- **Dosya:** `apps/web/src/components/layout/SettingsOverlay.tsx` (satir 111, 134)
- onClick handler yok

### A11. [ORTA] Tema toggle (Dark/Light) calismiyorr
- **Dosya:** `apps/web/src/components/layout/SettingsOverlay.tsx` (satir 175-193)
- onClick yok, state yok, "Dark" surekli secili gorunuyor

### A12. [ORTA] Formatting toolbar (Bold/Italic/Code) dekoratif
- **Dosya:** `apps/web/src/components/messaging/MessageComposer.tsx` (satir 571-621)
- onClick yok, klavye kisayollari yok

### A13. [ORTA] Reply gostergesinde kullanici adi yerine raw ID
- **Dosya:** `apps/web/src/components/messaging/MessageComposer.tsx` (satir 367)
- `replyTo.author.id` yerine `replyTo.author.globalName ?? replyTo.author.username` olmali

### A14. [ORTA] Resim attachment'lari kirik
- **Dosya:** `apps/web/src/components/messaging/MessageItem.tsx` (satir 638)
- `att.filename` src olarak kullaniliyor, `att.url` veya CDN URL olmali

---

## B. UX Problemleri

### B1. [YUKSEK] Mesaj gonderme hatasinda feedback yok
- **Dosya:** `apps/web/src/components/messaging/MessageComposer.tsx` (satir 268)
- Catch blogu sadece `// show toast` yorumu iceriyor

### B2. [YUKSEK] 6+ component'ta tekrarlanan mobil breakpoint detection
- Layout, DMHomePage, GuildPage, ChannelPage, ChannelSidebar hepsinde ayni matchMedia pattern
- Resize sirasinda component'lar farkli state'te olabilir

### B3. [YUKSEK] Friends listesi yuklenirken loading state yok
- **Dosya:** `apps/web/src/components/friends/FriendsList.tsx` (satir 269-275)

### B4. [ORTA] Unread/mention badge'ler hic doldurulmuyor
- **Dosya:** `apps/web/src/components/layout/ServerRail.tsx` (satir 221-234)
- `hasUnread` ve `mentionCount` props'lari hic pass edilmiyor

### B5. [ORTA] unreadCount hic arttirilmiyor
- **Dosya:** `apps/web/src/components/messaging/MessageList.tsx` (satir 157, 232-234, 318-325)
- "N new" badge'i hic gorunmuyor

### B6. [ORTA] Logout'ta onay dialogu yok
- **Dosya:** `apps/web/src/components/layout/SettingsOverlay.tsx` (satir 236-243)

### B7. [ORTA] Edit/delete hatalari sessizce yutuluyorr
- **Dosya:** `apps/web/src/components/messaging/MessageItem.tsx` (satir 397, 419)
- Bos catch bloklari

### B8. [ORTA] 0 kanalli guild placeholder'da takiliyor
- **Dosya:** `apps/web/src/app/(app)/channels/[guildId]/page.tsx` (satir 48-65)

### B9. [DUSUK] (edited) gostergesi iki kez gorunuyor
- **Dosya:** `apps/web/src/components/messaging/MessageItem.tsx` (satir 529-541, 611-618)

---

## C. Eksik Discord Ozellikleri

| Ozellik | Durum |
|---|---|
| Kullanici status degistirme (online/idle/dnd/invisible) | UI yok |
| Bildirim sesleri | Hicbir yerde ses yok |
| Arama (search) | API var, UI yok |
| Pinned messages | API ve UI stub |
| Reply context (orijinal mesaji gosterme) | Sadece statik text |
| Sag-tik context menu (mesajlarda) | Yok, sadece hover toolbar |
| Kanal siralama (drag-and-drop) | Yok |
| Custom status/activity | Store var, UI yok |
| Profil popup (member click) | Yok |

---

## D. Gorsel/CSS Sorunlari

### D1. Drop overlay pozisyonu yanlis
- `MessageComposer.tsx` satir 414 — parent'ta `position: relative` yok

### D2. Hover handler'lari inline style ile
- Keyboard focus/tab ile calismiyor, mobilde touch-hover problemi

### D3. Settings overlay mobil layout yok
- `SettingsOverlay.tsx` satir 287 — sabit 218px genislik

### D4. Server icon kisaltmasi edge case
- `ServerRail.tsx` satir 32-37 — bosluklu isimle undefined uretebilir

---

## V1 Oncelikleri

1. **Invite to channel** duzgun calismali
2. **Mesajlasma** duzgun calismali (dosya yukleme, hata feedback, reply label)
3. **Sesli sohbet** duzgun calismali (gecikme, speaking indicator, ses iletimi)
