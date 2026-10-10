# Panduan Lengkap: Migrasi & Setup Database Turso (LibSQL) untuk ShinDora Nesub di Cloudflare Workers

Proyek **ShinDora Nesub** kini telah sepenuhnya dimigrasikan menggunakan database **Turso (LibSQL)** yang kompatibel 100% dengan **OpenNext Cloudflare Workers Edge Runtime (`@opennextjs/cloudflare`)** dan Node.js.

---

## ⚡ 1. Keunggulan Database Turso di Cloudflare Workers
- **Zero Cold Start & Edge Replicas**: Database SQLite terdistribusi global yang dapat diakses dengan latensi ultra-rendah dari Cloudflare Edge.
- **Pure Fetch HTTP Pipeline Engine**: Berjalan tanpa dependensi binary C++ native sehingga tidak pernah error saat dibundel ke Cloudflare Worker `workerd`.
- **Hybrid Local Fallback**: Jika environment variable Turso belum diisi saat proses development lokal atau build, aplikasi otomatis menggunakan `file:local_sqlite.db` sehingga `next build` dan preview selalu sukses tanpa error.

---

## 🚀 2. Langkah-Langkah Membuat & Menyiapkan Database Turso

### A. Buat Database di Turso CLI atau Dashboard
1. Install Turso CLI (opsional jika menggunakan CLI):
   ```bash
   # Di Linux / macOS
   curl -sSfL https://get.tur.so/install.sh | bash

   # Login ke Turso
   turso auth login
   ```
   *Atau login melalui website [turso.tech](https://turso.tech).*

2. Buat database baru:
   ```bash
   turso db create shindora-db
   ```

3. Dapatkan **Database URL**:
   ```bash
   turso db show shindora-db --url
   ```
   *Contoh output:* `libsql://shindora-db-yourusername.turso.io`

4. Buat dan dapatkan **Auth Token**:
   ```bash
   turso db tokens create shindora-db
   ```
   *Contoh output:* `eyJh...`

---

## 📦 3. Import Data Awal (120 Episode Anime & Pengaturan) ke Turso

Anda dapat mengimpor seluruh data anime, kategori, pengguna, dan pengaturan ke database Turso dengan salah satu cara berikut:

### Cara 1: Menggunakan Script Seeder Bawaan (Paling Mudah)
Jalankan di terminal:
```bash
TURSO_DATABASE_URL="libsql://shindora-db-yourusername.turso.io" \
TURSO_AUTH_TOKEN="your-turso-token-here" \
node scripts/seed-turso.js
```

### Cara 2: Menggunakan Turso CLI
```bash
turso db shell shindora-db < turso_init.sql
```

---

## 🌐 4. Konfigurasi Cloudflare Workers (OpenNext)

### Langkah A: Tambahkan Secrets / Environment Variables ke Cloudflare Workers
Jika deploy menggunakan Wrangler CLI:
```bash
# 1. Masukkan URL Database Turso
npx wrangler secret put TURSO_DATABASE_URL
# (Paste: libsql://shindora-db-yourusername.turso.io)

# 2. Masukkan Auth Token Turso
npx wrangler secret put TURSO_AUTH_TOKEN
# (Paste: your-turso-auth-token)
```

Atau jika mengatur melalui **Cloudflare Dashboard**:
1. Masuk ke **[dash.cloudflare.com](https://dash.cloudflare.com)** > **Workers & Pages** > Pilih Worker Anda (`shindora-nesub`).
2. Masuk ke **Settings** > **Variables and Secrets**.
3. Tambahkan:
   - `TURSO_DATABASE_URL`: `libsql://shindora-db-yourusername.turso.io`
   - `TURSO_AUTH_TOKEN`: `your-turso-auth-token`

---

## 🛠️ 5. Build & Deploy ke Cloudflare Workers

1. **Build OpenNext Cloudflare Worker**:
   ```bash
   npm run build:worker
   # atau: npx @opennextjs/cloudflare build
   ```

2. **Deploy ke Cloudflare**:
   ```bash
   npm run deploy:worker
   # atau: npx @opennextjs/cloudflare deploy
   ```

3. **Verifikasi Output**:
   Wrangler akan mengupload `.open-next/worker.js` dan aset statis ke Cloudflare Workers. Seluruh fitur (Player Video, Smart TV, Putar Manual, Katalog Episode, Panel Admin & Moderator, Komentar, Sistem Notifikasi) langsung aktif 100%!
