# Chavis - Secure View Counter API + Admin Panel + Discord Bot

Bu proje, güvenli bir view counter API'si, admin panel sistemi ve Discord bot entegrasyonu sağlar. JSONBlob gibi tehlikeli servisler yerine kendi güvenli backend'inizi kullanmanızı sağlar.

## 🚀 Özellikler

### View Counter API
- **Güvenli API**: Kendi backend'inizde çalışır
- **Rate Limiting**: Spam koruması
- **CORS Desteği**: Güvenli cross-origin istekler
- **Hata Yönetimi**: Kapsamlı hata yakalama
- **Health Check**: API durumu kontrolü
- **Helmet Security**: Güvenlik başlıkları
- **Discord Status Tracker**: Gerçek zamanlı Discord status takibi (Backend proxy)
- **Optimize Edilmiş**: 2GB RAM VPS için optimize edilmiş

### Admin Panel
- IP whitelist korumalı admin paneli (`/987654321admin123456789`)
- Güvenli login sistemi (session/cookie tabanlı)
- Dosya yönetimi (media ve images klasörleri)
- Sosyal ikon yönetimi (ekleme, silme, sıralama, aç/kapat)
- Modern dark theme UI
- Video upload desteği (150MB'a kadar)

### Discord Bot
- `/ipekle` - IP adresini whitelist'e ekler
- `/ipcikar` - IP adresini whitelist'ten çıkarır
- `/ipler` - Whitelist'teki tüm IP'leri listeler
- Otomatik log sistemi (Discord kanalına log gönderir)

## 📋 Gereksinimler

- Node.js (v14 veya üzeri)
- npm veya yarn

## 🛠️ Kurulum

### 1. Bağımlılıkları Yükleyin

```bash
cd frontend
npm install
```

### 2. `.env` Dosyasını Oluşturun

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

### 3. Config Dosyalarını Oluşturun
- `frontend/config/whitelist.json` - IP whitelist
- `frontend/config/social-links.json` - Sosyal ikonlar

### 4. Sunucuyu Başlatın

Geliştirme modu:
```bash
npm run dev
```

Üretim modu:
```bash
npm start
```

Sunucu varsayılan olarak `http://localhost:3000` adresinde çalışacaktır. Üretim ortamında `https://chavis.com.tr` domain'ini kullanın.

## 📖 Kullanım

### Admin Paneli
1. Whitelist'teki bir IP'den `/987654321admin123456789` adresine gidin
2. Login bilgileri:
   - Kullanıcı adı: `0101377`
   - Şifre: `71x5W)6GcIpc.`

### Discord Bot Komutları
- `/ipekle 88.234.210.45` - IP'yi whitelist'e ekler
- `/ipcikar 88.234.210.45` - IP'yi whitelist'ten çıkarır
- `/ipler` - Tüm IP'leri listeler

## 📁 Dosya Yapısı

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

### Frontend'i Güncelleyin

`js/badges2.js` dosyasındaki `API_BASE_URL` değişkenini kendi domain'inizle değiştirin:

```javascript
const API_BASE_URL = 'https://chavis.com.tr';
```

## 🔧 API Endpoints

### GET /api/views
Mevcut view sayısını getirir.

**Response:**
```json
{
  "views": 654
}
```

### POST /api/views/increment
View sayısını 1 artırır.

**Response:**
```json
{
  "views": 655,
  "message": "View count incremented successfully"
}
```

### PUT /api/views
View sayısını belirtilen değere günceller.

**Request Body:**
```json
{
  "views": 1000
}
```

**Response:**
```json
{
  "views": 1000,
  "message": "View count updated successfully"
}
```

### GET /api/discord/status
Discord kullanıcı durumunu getirir (Backend proxy).

**Response:**
```json
{
  "success": true,
  "data": {
    "discord_status": "dnd",
    "discord_user": {
      "username": ".chavis",
      "global_name": "chavis",
      "avatar": "...",
      "id": "750800056453693472"
    },
    "activities": []
  }
}
```

### GET /api/discord/status/stream (SSE)
Discord status için real-time SSE stream (Server-Sent Events).

**Event Format:**
```
data: {"success":true,"data":{"discord_status":"online",...}}
```

**Usage:**
```javascript
const eventSource = new EventSource('/api/discord/status/stream');
eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Status:', data.data.discord_status);
};
```

### GET /api/health
API durumunu kontrol eder.

**Response:**
```json
{
  "status": "OK",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "views": 654,
  "discordConnected": true
}
```

## 🔒 Güvenlik Özellikleri

- **IP Whitelist Kontrolü**: Admin panel sadece whitelist'teki IP'lerden erişilebilir
- **HTTP-only ve İmzalı Cookie'ler**: Güvenli session yönetimi
- **CSRF Koruması**: SameSite cookie ile koruma
- **Rate Limiting**: IP başına dakikada maksimum 10 istek (login denemeleri için)
- **XSS Koruması**: Çıktı kaçışları
- **Path Traversal Koruması**: Dosya upload güvenliği
- **CORS**: Sadece belirtilen origin'lerden isteklere izin
- **Helmet**: Güvenlik başlıkları
- **Input Validation**: Geçersiz veri kontrolü
- **Error Handling**: Hassas bilgi sızıntısını önleme

## 🎯 Discord Status Tracker Optimizasyonu

### Neden Backend Proxy?
- ❌ **Frontend CSP Sorunları**: Tarayıcı güvenlik politikaları external WebSocket'leri engelliyor
- ✅ **Backend'de Tek Bağlantı**: Sadece 1 WebSocket bağlantısı (sunucudan Lanyard'a)
- ✅ **Düşük RAM Kullanımı**: Frontend'de poll-based (10 saniyede bir)
- ✅ **Otomatik Yeniden Bağlanma**: Backend bağlantıyı yönetiyor
- ✅ **Kullanıcı Dostu**: Kullanıcılar CSP disable etmek zorunda değil

### Kaynak Kullanımı (2GB VPS için Optimize)
- **Backend WebSocket**: ~5MB RAM
- **SSE Connections**: ~1MB RAM per 100 users
- **Real-time Updates**: Instant (0 delay)
- **Toplam RAM**: ~20-30MB (tüm sistem)

### SSE (Server-Sent Events) Avantajları
- ✅ **Gerçek Zamanlı**: Discord status değişince anında güncellenir
- ✅ **Tek Yönlü**: Backend → Frontend (WebSocket'ten hafif)
- ✅ **Otomatik Reconnect**: Tarayıcı otomatik yeniden bağlanır
- ✅ **HTTP/1.1 Uyumlu**: Ek protokol gerekmez
- ✅ **Düşük Kaynak**: Her kullanıcı için sadece 1 HTTP connection

## 🌐 Ortam Değişkenleri

Aşağıdaki ortam değişkenlerini ayarlayabilirsiniz:

```bash
PORT=3000                                    # Sunucu portu
ALLOWED_ORIGINS=http://localhost:3000,https://chavis.com.tr  # İzin verilen origin'ler
```

## 📊 Rate Limiting

- **Pencere**: 1 dakika
- **Maksimum İstek**: IP başına 10 istek
- **Aşım Durumu**: 429 status code ile yanıt

## 🚀 Deployment

### Heroku

1. Heroku CLI'yi yükleyin
2. Projeyi Heroku'ya push edin:
```bash
git init
heroku create your-app-name
git add .
git commit -m "Initial commit"
git push heroku main
```

### Vercel

1. Vercel CLI'yi yükleyin
2. Deploy edin:
```bash
npm i -g vercel
vercel
```

### DigitalOcean App Platform

1. GitHub repository'nizi bağlayın
2. Build command: `npm install`
3. Run command: `npm start`

## 🔧 Geliştirme

### Yeni Özellik Ekleme

1. `server.js` dosyasında yeni endpoint ekleyin
2. Gerekli validasyonları ekleyin
3. Rate limiting uygulayın
4. Test edin

### Veritabanı Entegrasyonu

Şu anda in-memory storage kullanılıyor. Üretim için PostgreSQL, MongoDB veya başka bir veritabanı kullanabilirsiniz.

## 📝 Lisans

MIT License

## 🤝 Katkıda Bulunma

1. Fork edin
2. Feature branch oluşturun (`git checkout -b feature/amazing-feature`)
3. Commit edin (`git commit -m 'Add amazing feature'`)
4. Push edin (`git push origin feature/amazing-feature`)
5. Pull Request oluşturun

## 📝 Notlar

- Admin panel sadece whitelist'teki IP'lerden erişilebilir
- Tüm admin işlemleri loglanır (konsol + Discord kanalı)
- Dosya upload limiti: 150MB (video upload için)
- Sosyal ikonlar dinamik olarak frontend'e yüklenir

## 📞 Destek

Herhangi bir sorun yaşarsanız, issue oluşturun veya iletişime geçin.
