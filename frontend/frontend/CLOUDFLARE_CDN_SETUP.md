# Panduan Arsitektur & Setup Cloudflare Worker CDN ShinDora Nesub

Dokumen ini menjelaskan implementasi **Cloudflare Worker Reverse Proxy + Edge Cache Layer** di depan origin Vercel untuk mengurangi **Fast Origin Transfer (FOT)** dan **Fast Data Transfer (FDT)** secara drastis pada platform **ShinDora Nesub**.

---

## 1. Arsitektur Alur Request

```
                    ┌────────────────────────┐
                    │      USER / CLIENT     │
                    └───────────┬────────────┘
                                │
                                ▼
                    ┌────────────────────────┐
                    │   CLOUDFLARE WORKER    │
                    │  (cloudflare-worker.js)│
                    └───────────┬────────────┘
                                │
               ┌────────────────┴────────────────┐
               │                                 │
     [GET/HEAD Public Asset]          [POST/Auth/Dynamic/Admin]
               │                                 │
               ▼                                 ▼
       ┌───────────────┐                  ┌──────────────┐
       │ CLOUDFLARE    │                  │ BYPASS CACHE │
       │ EDGE CACHE    │                  └──────┬───────┘
       └───────┬───────┘                         │
         HIT   │   MISS                          │
    ┌──────────┴──────────┐                      │
    ▼                     ▼                      │
[Layani Langsung    [Minta ke Vercel]            │
 ke User (0 FOT)]         │                      │
                          ▼                      │
                   ┌──────────────┐              │
                   │ VERCEL ORIGIN│◄─────────────┘
                   └──────────────┘
```

---

## 2. Tabel Audit & Klasifikasi Route

| Pola Route / Endpoint | Tipe Penanganan | Kebijakan Cache | Header Cache-Control |
| :--- | :--- | :--- | :--- |
| `/_next/static/*` | **CACHE** | 1 Tahun (Immutable) | `public, max-age=31536000, immutable` |
| `/favicon.ico`, `/apple-icon.png`, `/icon.png` | **CACHE** | 1 Tahun | `public, max-age=31536000, immutable` |
| `/manifest.webmanifest`, `/robots.txt`, `/ads.txt` | **CACHE** | 1 Hari | `public, max-age=86400, s-maxage=86400` |
| `/api/categories`, `/api/promo`, `/api/pages` | **CACHE** | 5 Menit + SWR | `public, max-age=60, s-maxage=300, stale-while-revalidate=86400` |
| `/api/videos` *(GET publik)* | **CACHE** | 5 Menit + SWR | `public, max-age=60, s-maxage=300, stale-while-revalidate=86400` |
| `/`, `/watch/*`, `/page/*`, `/putar-manual` | **CACHE** | 10 Menit + SWR | `public, max-age=60, s-maxage=600, stale-while-revalidate=86400` |
| `/admin/*`, `/moderator`, `/login` | **BYPASS** | Tidak Disimpan (0s) | `no-store, no-cache, must-revalidate` |
| `/api/auth/*`, `/api/push/*`, `/api/settings` | **BYPASS** | Tidak Disimpan (0s) | `no-store, no-cache, must-revalidate` |
| `/api/chat/*`, `/api/webhooks/*` | **BYPASS** | Tidak Disimpan (0s) | `no-store, no-cache, must-revalidate` |
| Mutasi (`POST`, `PUT`, `DELETE`, `PATCH`) | **BYPASS** | Diteruskan Langsung | `no-store` |
| Media ImageKit (`https://ik.imagekit.io/...`) | **DIRECT CDN** | Langsung dari ImageKit | Tidak lewat Vercel (0 FOT/FDT) |
| Video Stream Embed Provider (`ok.ru`, `gdrive`, dll) | **DIRECT EMBED** | Langsung dari Provider | Tidak lewat Vercel (0 FOT/FDT) |

---

## 3. Konfigurasi Environment Variable (`ORIGIN_URL`)

Di dalam file `wrangler.toml` atau Cloudflare Dashboard (Workers & Pages > Settings > Variables):

```toml
name = "shindora-cdn-worker"
main = "cloudflare-worker.js"
compatibility_date = "2026-06-01"
workers_dev = true

[vars]
ORIGIN_URL = "https://shindoranesub.my.id" # Domain Origin Vercel Anda
```

---

## 4. Cara Deploy ke Cloudflare

### Langkah 1: Install Wrangler CLI (jika belum)
```bash
npm install -g wrangler
# atau
yarn global add wrangler
```

### Langkah 2: Login ke Akun Cloudflare
```bash
npx wrangler login
```

### Langkah 3: Deploy Worker
```bash
npx wrangler deploy
```

---

## 5. Konfigurasi DNS & Custom Domain

### Opsi A: Subdomain CDN (`cdn.shindoranesub.my.id`)
1. Buka Cloudflare Dashboard > Domain Anda > **DNS**.
2. Tambahkan record CNAME:
   - **Type**: `CNAME`
   - **Name**: `cdn`
   - **Target**: `<worker-name>.<your-subdomain>.workers.dev`
   - **Proxy status**: `Proxied (Orange Cloud ☁️)`
3. Buka **Workers & Pages** > Worker Anda > **Custom Domains** > Tambahkan `cdn.shindoranesub.my.id`.

### Opsi B: Domain Utama (`shindoranesub.my.id`)
1. Di Cloudflare Dashboard > **Workers & Pages** > Worker Anda > **Routes**.
2. Tambahkan Route: `shindoranesub.my.id/*` ke worker ini.

---

## 6. Cara Menguji CACHE HIT / MISS

### Uji Menggunakan cURL:
```bash
# Request 1 (Cache MISS - mengambil dari Vercel):
curl -I https://cdn.shindoranesub.my.id/api/categories

# Output Response Headers:
# HTTP/2 200
# cf-cache-status: MISS
# x-shindora-cache: MISS
# x-shindora-worker: active

# Request 2 (Cache HIT - dilayani dari Cloudflare Edge tanpa kontak ke Vercel):
curl -I https://cdn.shindoranesub.my.id/api/categories

# Output Response Headers:
# HTTP/2 200
# cf-cache-status: HIT
# x-shindora-cache: HIT
# x-shindora-worker: active
```

---

## 7. Mekanisme Purge Cache

Jika Anda melakukan update data video atau kategori di admin, Anda dapat melakukan purge cache publik via Cloudflare Dashboard atau API:
1. Masuk ke **Cloudflare Dashboard** > **Caching** > **Configuration**.
2. Klik **Purge Everything** atau **Custom Purge** untuk URL spesifik (`/api/categories`, `/api/videos`).
