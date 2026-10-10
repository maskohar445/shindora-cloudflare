# Panduan Arsitektur: Frontend di Cloudflare Pages & Backend di Cloudflare Worker + D1

Arsitektur pemisahan ini **sangat direkomendasikan** untuk performa maksimal:
- 🎨 **Frontend (Cloudflare Pages)**: Menyajikan Next.js UI, Halaman Anime, Smart TV, Player Video, Tailwind CSS, & Assets Statis dengan loading instan di Edge CDN.
- ⚙️ **Backend (Cloudflare Worker + D1 Database)**: Menangani seluruh API REST (`/api/videos`, `/api/ads`, `/api/comments`, `/api/notifications`, `/api/settings`, dll.) langsung ke Cloudflare D1 Serverless Database.

---

## 🛠️ Langkah 1: Deploy Backend (Cloudflare Worker + D1)

1. **Inisialisasi Database D1**:
   ```bash
   # Buat database D1
   npx wrangler d1 create shindora-db

   # Import seluruh 120 episode dan skema database
   npx wrangler d1 execute shindora-db --remote --file=./d1_init.sql
   ```

2. **Deploy Backend Worker**:
   Di file `wrangler.toml`:
   ```toml
   name = "shindora-backend-worker"
   main = "cloudflare-worker.js"
   compatibility_date = "2024-09-23"
   compatibility_flags = ["nodejs_compat"]

   [vars]
   STANDALONE = "true"

   [[d1_databases]]
   binding = "DB"
   database_name = "shindora-db"
   database_id = "<DATABASE_ID_DARI_LANGKAH_1>"
   ```

   Jalankan deploy:
   ```bash
   npx wrangler deploy
   ```
   *Hasil: Anda akan mendapatkan URL backend (misal: `https://shindora-backend-worker.<account>.workers.dev` atau custom domain `https://api.shindoranesub.my.id`).*

---

## 🎨 Langkah 2: Deploy Frontend (Cloudflare Pages)

1. Masuk ke **Cloudflare Dashboard** > **Workers & Pages** > **Create application** > **Pages** > **Connect to Git**.
2. Pilih repository GitHub Anda.
3. **Build settings**:
   - **Framework preset**: `Next.js (Static HTML Export)` atau `None`
   - **Build command**: `npm run build`
   - **Build output directory**: `out` atau `public`
   - **Root directory**: `/` (kosongkan)
4. **Environment Variables di Pages**:
   - `NEXT_PUBLIC_BACKEND_URL`: URL Worker Anda dari Langkah 1 (contoh: `https://shindora-backend-worker.<account>.workers.dev` atau `https://api.shindoranesub.my.id`)

---

## 🔗 Langkah 3: Menyatukan Domain (1 Domain Tanpa Kendala CORS)

Di Cloudflare Dashboard pada domain utama Anda (misal `shindoranesub.my.id`):
- **Route 1**: `shindoranesub.my.id/api/*` ➔ Mengarah ke **`shindora-backend-worker`** (Worker).
- **Route 2**: `shindoranesub.my.id/*` ➔ Mengarah ke **Cloudflare Pages** (Frontend).

Dengan konfigurasi ini, **100% fitur berjalan sama persis dengan aslinya**:
- ✅ Video player & streaming responsive
- ✅ Banner iklan raw HTML/script (HilltopAds, Adsterra, AdSense)
- ✅ Sistem komentar bertingkat & notifikasi balasan untuk Admin & Moderator
- ✅ Mode Smart TV (`/tv`) dan Putar Manual (`/putar-manual`)
- ✅ Panel Admin (`/admin`) dan Panel Moderator (`/moderator`)
- ✅ Web Push Notifications & integrasi D1 Database
