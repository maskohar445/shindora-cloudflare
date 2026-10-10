export default function manifest() {
  return {
    name: 'ShinDora Nesub',
    short_name: 'ShinDora',
    description:
      'Tempat Nonton Doraemon, Crayon Shin-chan Dan Ninja Hattori-kun Takarir Indonesia Gratis',

    // PWA Mobile + Desktop membuka halaman utama
    start_url: '/',
    scope: '/',
    id: 'shindora-nesub-pwa',

    // Tampilan seperti aplikasi
    display: 'standalone',
    display_override: [
      'window-controls-overlay',
      'standalone',
    ],

    background_color: '#07080f',
    theme_color: '#07080f',

    prefer_related_applications: false,

    icons: [
      {
        src: '/favicon.ico',
        sizes: '64x64 32x32 24x24 16x16',
        type: 'image/x-icon',
      },
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any maskable',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any maskable',
      },
      {
        src: '/apple-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
    ],

    shortcuts: [
      {
        name: 'Beranda',
        short_name: 'Beranda',
        description: 'Buka beranda ShinDora Nesub',
        url: '/',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
          },
        ],
      },
      {
        name: 'Daftar Episode',
        short_name: 'Episode',
        description: 'Lihat daftar episode anime',
        url: '/putar-manual',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
          },
        ],
      },
    ],
  }
}
