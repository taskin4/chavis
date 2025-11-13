# Admin Panel Sistemi + Discord Bot

Modern, güvenli ve self-host edilebilir admin panel sistemi ve Discord bot entegrasyonu.

## Özellikler

### Admin Panel
- IP whitelist korumalı admin paneli (`/987654321admin123456789`)
- Güvenli login sistemi (session/cookie tabanlı)
- Dosya yönetimi (media ve images klasörleri)
- Sosyal ikon yönetimi (ekleme, silme, sıralama, aç/kapat)
- Modern dark theme UI

### Discord Bot
- `/ipekle` - IP adresini whitelist'e ekler
- `/ipcikar` - IP adresini whitelist'ten çıkarır
- `/ipler` - Whitelist'teki tüm IP'leri listeler
- Otomatik log sistemi (Discord kanalına log gönderir)

## Kurulum

1. Bağımlılıkları yükleyin:
```bash
cd frontend
npm install
```

2. `.env` dosyasını oluşturun:
```env
SESSION_SECRET=your-secret-key-here
COOKIE_SECURE=false
SESSION_TTL_MS=3600000
ALLOWED_ORIGINS=http://localhost:3000,https://chavis.com.tr
DISCORD_BOT_TOKEN=your-discord-bot-token
DISCORD_APP_ID=1438295937859715177
DISCORD_GUILD_ID=1361514717751017664
DISCORD_CHANNEL_ID=1438293793349828708
PORT=3000
```

3. Config dosyalarını oluşturun:
- `frontend/config/whitelist.json` - IP whitelist
- `frontend/config/social-links.json` - Sosyal ikonlar

4. Sunucuyu başlatın:
```bash
npm start
```

## Kullanım

### Admin Paneli
1. Whitelist'teki bir IP'den `/987654321admin123456789` adresine gidin
2. Login bilgileri:
   - Kullanıcı adı: `0101377`
   - Şifre: `71x5W)6GcIpc.`

### Discord Bot Komutları
- `/ipekle 88.234.210.45` - IP'yi whitelist'e ekler
- `/ipcikar 88.234.210.45` - IP'yi whitelist'ten çıkarır
- `/ipler` - Tüm IP'leri listeler

## Güvenlik

- IP whitelist kontrolü
- HTTP-only ve imzalı cookie'ler
- CSRF koruması (SameSite cookie)
- Rate limiting (login denemeleri için)
- XSS koruması (çıktı kaçışları)
- Path traversal koruması (dosya upload)

## Dosya Yapısı

```
frontend/
├── admin/
│   ├── login.html      # Admin login sayfası
│   └── panel.html      # Admin panel
├── config/
│   ├── whitelist.json  # IP whitelist
│   └── social-links.json # Sosyal ikonlar
├── media/              # Müzik dosyaları
├── images/             # Görseller ve ikonlar
├── bot.js              # Discord bot
└── server.js           # Express server
```

## Notlar

- Admin panel sadece whitelist'teki IP'lerden erişilebilir
- Tüm admin işlemleri loglanır (konsol + Discord kanalı)
- Dosya upload limiti: 20MB
- Sosyal ikonlar dinamik olarak frontend'e yüklenir



