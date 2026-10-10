# ShinDora Nesub (Ver 1.0.0) - Product Requirement Document & Overview

## 1. Project Overview
ShinDora Nesub adalah platform streaming anime dan kartun nostalgia (Doraemon, Shinchan, Ninja Hattori, Chibi Maruko-chan, dll.) berbasis Next.js 15 dan didesain untuk performa tinggi, kompatibilitas deployment Vercel, serta dukungan edge caching Cloudflare CDN.

## 2. Fitur Utama

### A. Sistem Iklan & Script Engine (Multi Slot Ads)
- **Eksekusi Script HTML/JS Dinamis**:
  - Komponen `AdSlotContainer` mengeksekusi kode script HTML (`<script>`, inline JS, dynamic script injection `document.currentScript`, `insertBefore`, `async`, `defer`).
  - Mendukung berbagai jaringan iklan (Adsterra, Google AdSense, Monetag, PropellerAds, PopAds, iframe, dll.).
  - Proteksi anti-crash dan isolasi `document.write` agar tidak merusak rendering DOM React.
- **Ekspansi 20+ Posisi Slot Iklan**:
  - **Header & Navigasi**: `banner_top`, `banner_below_header`
  - **Player & Watch Page**: `banner_above_player`, `banner_below_player`, `banner_below_player_2`, `banner_sidebar`, `banner_sidebar_2`, `banner_above_playlist`, `banner_below_playlist`, `banner_below_comments`
  - **Home & Feed Grid**: `banner_between_feed` (item 4), `banner_between_feed_2` (item 12), `banner_between_feed_3` (item 20), `banner_footer`
  - **Floating & Global**: `banner_float_bottom` (sticky bar dengan tombol tutup), `banner_float_left` (skyscraper kiri desktop), `banner_float_right` (skyscraper kanan desktop), `banner_popup` (modal Saweria), `custom_head_code` (popunder/social bar global)
  - **Putar Manual**: `banner_putar_manual_top`, `banner_putar_manual_bottom`
- **Dukungan Multi-Iklan per Slot**: Jika beberapa iklan aktif didaftarkan pada slot yang sama, semua iklan akan dirender secara rapi.

### B. VAPID Web Push Notification
- **Notifikasi Otomatis saat Video Publik**:
  - Terkirim otomatis ke seluruh subscriber saat admin membuat video baru berstatus `published` atau saat video diubah dari draft/scheduled menjadi `published`.
  - Tidak mengirim notifikasi spam yang tidak perlu saat admin hanya mengedit informasi rutin (typo, kategori, view count).
- **Broadcast Manual Admin**:
  - Tombol ikon lonceng 🔔 pada tabel daftar video admin untuk memicu notifikasi push instan kapan saja (`POST /api/videos/notify`).
  - Checkbox toggle pada modal video admin untuk mengaktifkan/menonaktifkan pengiriman push saat menyimpan.

### C. Streaming Video, Smart TV & Komunitas
- **Streaming & Watch Page**: Multi-server (Google Drive, Doodstream, dll.), download link, rekomendasi, like, watch later, dan komentar bertingkat.
- **Smart TV Mode (`/tv`)**: Navigasi D-pad/remote control (Arrow Keys, Enter, Back).
- **Putar Manual (`/putar-manual`)**: Pemutaran video mandiri dengan embed link kustom.
- **Interaktivitas Komunitas**: Floating chat widget global, polling interaktif, overlay donasi Saweria/Trakteer.
