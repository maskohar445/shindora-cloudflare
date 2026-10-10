# Panduan Resmi: Deploy Next.js ke Cloudflare Workers Menggunakan @opennextjs/cloudflare & Turso Database

Project **ShinDora Nesub** telah dikonfigurasi penuh dengan adapter resmi **`@opennextjs/cloudflare`** dan database **Turso (LibSQL)** sehingga Anda dapat mengubah output `next build` menjadi aplikasi Cloudflare Worker yang berjalan 100% di atas infrastruktur Edge Cloudflare.

---

## ⚡ 1. File Konfigurasi yang Telah Disiapkan:

1. **`package.json`**:
   - Skrip OpenNext & Seeder:
     ```json
     "build:worker": "npx @opennextjs/cloudflare build",
     "preview:worker": "npx @opennextjs/cloudflare preview",
     "deploy:worker": "npx @opennextjs/cloudflare deploy",
     "deploy": "npx @opennextjs/cloudflare deploy",
     "seed:turso": "node scripts/seed-turso.js"
     ```
2. **`open-next.config.ts`**:
   - Adapter konfigurasi resmi OpenNext Cloudflare.
3. **`wrangler.json`**:
   - Menghubungkan output `.open-next/worker.js`, `.open-next/assets`, dan variable `TURSO_DATABASE_URL` serta `TURSO_AUTH_TOKEN`.
4. **`turso_init.sql`** & **`scripts/seed-turso.js`**:
   - Skema dan 120 episode anime siap import ke database Turso.
5. **`lib/db.js`**:
   - Unified Database Driver dengan Turso HTTP Edge Engine (`/v2/pipeline`), `@libsql/client`, serta local SQLite fallback.

---

## 🚀 2. Langkah-Langkah Deploy dari Komputer / Terminal:

### Langkah A: Inisialisasi Database Turso
```bash
# 1. Buat database di Turso
turso db create shindora-db

# 2. Ambil URL dan Token
turso db show shindora-db --url
turso db tokens create shindora-db

# 3. Import data awal (120 episode Doraemon)
turso db shell shindora-db < turso_init.sql
# Atau gunakan: TURSO_DATABASE_URL="libsql://..." TURSO_AUTH_TOKEN="..." npm run seed:turso
```

### Langkah B: Set Secrets & Deploy dengan OpenNext
```bash
# 1. Set Turso secrets di Cloudflare Worker
npx wrangler secret put TURSO_DATABASE_URL
npx wrangler secret put TURSO_AUTH_TOKEN

# 2. Build project untuk Cloudflare Worker
npm run build:worker

# 3. Deploy ke Cloudflare Workers
npm run deploy:worker
```
