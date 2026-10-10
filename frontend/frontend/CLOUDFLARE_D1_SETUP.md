# Panduan Setup Database Cloudflare D1 untuk ShinDora Nesub

Platform **ShinDora Nesub** kini telah mendukung penuh database **Cloudflare D1** (Serverless SQLite by Cloudflare) dengan **zero-friction migration**.

---

## 🚀 Cara 1: Menggunakan Cloudflare D1 di Vercel / Serverless (REST API Mode)

Jika Anda deploy di **Vercel** atau serverless provider lainnya, aplikasi akan langsung terhubung ke Cloudflare D1 tanpa perlu server khusus.

### Langkah 1: Buat Database D1 di Cloudflare
```bash
# 1. Login ke Cloudflare
npx wrangler login

# 2. Buat database D1
npx wrangler d1 create shindora-db
```
*Catatan: Simpan `database_id` dan `account_id` yang muncul di terminal.*

### Langkah 2: Import Seluruh Data & Skema Anime (120 Episode)
Jalankan perintah ini di direktori project:
```bash
npx wrangler d1 execute shindora-db --remote --file=./d1_init.sql
```

### Langkah 3: Buat API Token Cloudflare
1. Buka [Cloudflare Dashboard](https://dash.cloudflare.com/profile/api-tokens) > **API Tokens** > **Create Token**.
2. Pilih Template **Create Custom Token**:
   - **Permissions**: `Account` > `D1` > `Edit`
   - **Account Resources**: Include > `All accounts` (atau akun Anda)
3. Salin API Token yang dibuat.

### Langkah 4: Tambahkan Environment Variable di Vercel / Hosting
Masuk ke **Vercel Dashboard** > **Project Settings** > **Environment Variables**:
- `CLOUDFLARE_ACCOUNT_ID`: *[Account ID Cloudflare Anda]*
- `CLOUDFLARE_D1_DATABASE_ID`: *[Database ID D1 Anda]*
- `CLOUDFLARE_API_TOKEN`: *[API Token Cloudflare Anda]*

Selesai! Saat project di-deploy ke Vercel atau GitHub, Next.js akan langsung membaca dan menulis data ke Cloudflare D1 secara otomatis.

---

## ⚡ Cara 2: Menggunakan Cloudflare Pages / Workers (Native D1 Binding)

Jika Anda deploy langsung ke **Cloudflare Pages / Workers**:

1. Di file `wrangler.toml`:
```toml
[[d1_databases]]
binding = "DB" # Jangan diubah
database_name = "shindora-db"
database_id = "<DATABASE_ID_ANDA>"
```
2. Aplikasi di `lib/db.js` akan otomatis mendeteksi binding `process.env.DB` atau `env.DB` dan berjalan native di Edge Network Cloudflare!

---

## 🛡️ Fallback Otomatis
- **Lokal / Offline Build**: Jika variabel D1 belum diisi, aplikasi otomatis menggunakan `file:local_sqlite.db` sehingga proses build Next.js tidak akan pernah error!
- **Turso / LibSQL**: Jika menggunakan Turso, cukup isi `TURSO_DATABASE_URL` dan `TURSO_AUTH_TOKEN`.
