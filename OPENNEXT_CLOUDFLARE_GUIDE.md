# Panduan Resmi: Deploy Next.js ke Cloudflare Workers Menggunakan @opennextjs/cloudflare

Project **ShinDora Nesub** telah dikonfigurasi penuh dengan adapter resmi **`@opennextjs/cloudflare`** sehingga Anda dapat mengubah output `next build` menjadi aplikasi Cloudflare Worker yang berjalan 100% di atas infrastruktur Edge Cloudflare dengan database Cloudflare D1.

---

## ⚡ 1. File Konfigurasi yang Telah Disiapkan:

1. **`package.json`**:
   - Skrip OpenNext:
     ```json
     "build:worker": "npx @opennextjs/cloudflare build",
     "preview:worker": "npx @opennextjs/cloudflare preview",
     "deploy:worker": "npx @opennextjs/cloudflare deploy",
     "deploy": "npx @opennextjs/cloudflare deploy"
     ```
2. **`open-next.config.ts`**:
   - Adapter konfigurasi resmi OpenNext Cloudflare.
3. **`wrangler.json`**:
   - Menghubungkan output `.open-next/worker.js`, `.open-next/assets`, dan database D1 (`binding: "DB"`).
4. **`d1_init.sql`**:
   - Skema dan 120 episode anime siap import ke database Cloudflare D1.

---

## 🚀 2. Langkah-Langkah Deploy dari Komputer / Terminal:

### Langkah A: Inisialisasi Database Cloudflare D1
```bash
# 1. Login ke Cloudflare
npx wrangler login

# 2. Buat database D1
npx wrangler d1 create shindora-db

# 3. Import seluruh 120 episode dan data anime ke D1
npx wrangler d1 execute shindora-db --remote --file=./d1_init.sql
```
*Salin `database_id` yang dihasilkan ke dalam file `wrangler.json` pada bagian `database_id`.*

### Langkah B: Build & Deploy dengan OpenNext
```bash
# Build project untuk Cloudflare Worker
npm run build:worker

# Deploy ke Cloudflare Workers
npm run deploy:worker
```

---

## 🌐 3. Langkah-Langkah Deploy via Cloudflare Dashboard (Git Integration):

1. Masuk ke [dash.cloudflare.com](https://dash.cloudflare.com) > **Workers & Pages** > **Create application** > **Pages** atau **Workers** > **Connect to Git**.
2. Pilih repository GitHub Anda.
3. Atur **Build settings**:
   - **Framework preset**: `None`
   - **Build command**: `npx @opennextjs/cloudflare build`
   - **Build output directory**: `.open-next/assets`
   - **Root directory**: `/` *(kosongkan)*
4. Di bagian **D1 database bindings**:
   - Tambahkan binding:
     - **Variable name**: `DB`
     - **D1 Database**: `shindora-db`
5. Klik **Save and Deploy**!
