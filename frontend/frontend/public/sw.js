const CACHE_NAME = 'shindora-cache-v4'

// ============================================================
// INSTALL
// ============================================================

self.addEventListener('install', () => {
  self.skipWaiting()
})

// ============================================================
// ACTIVATE
// ============================================================

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            console.log('[SW] Menghapus cache lama:', cacheName)
            return caches.delete(cacheName)
          })
        )
      })
      .then(() => {
        return self.clients.claim()
      })
      .catch((error) => {
        console.error('[SW] Activate error:', error)
      })
  )
})

// ============================================================
// FETCH
// ============================================================

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return
  }

  const requestUrl = event.request.url

  if (
    requestUrl.includes('/api/') ||
    requestUrl.includes('chrome-extension') ||
    !requestUrl.startsWith('http')
  ) {
    return
  }

  // Network First: fetch from live server, fallback to cache only if network offline
  event.respondWith(
    fetch(event.request).catch(async () => {
      const cachedResponse = await caches.match(event.request)
      if (cachedResponse) return cachedResponse
      if (event.request.mode === 'navigate') {
        const fallback = await caches.match('/')
        if (fallback) return fallback
      }
      throw new Error('Offline')
    })
  )
})

// ============================================================
// PUSH NOTIFICATION
// ============================================================

self.addEventListener(
  'push',
  (event) => {
    let data = {
      title: 'Episode Baru 🎬',
      body: 'Tonton episode terbaru sekarang!',
      url: '/watch/shindora-push',
      icon: '/apple-icon.png',
      badge: '/favicon.ico',
      image: null
    }

    /*
     * Parse payload.
     */
    if (event.data) {
      try {
        const payload =
          event.data.json()

        if (
          payload &&
          typeof payload === 'object'
        ) {
          data = {
            ...data,
            ...payload
          }
        }
      } catch (error) {
        try {
          data.body =
            event.data.text()
        } catch {
          // gunakan default body
        }
      }
    }

    const targetUrl =
      data.url ||
      '/watch/shindora-push'

    const options = {
      body:
        data.body ||
        'Tonton episode terbaru sekarang!',

      icon:
        data.icon ||
        '/apple-icon.png',

      badge:
        data.badge ||
        '/favicon.ico',

      data: {
        url: targetUrl
      },

      vibrate: [
        100,
        50,
        100
      ],

      tag:
        data.tag ||
        'shindora-push-notification',

      renotify: true
    }

    /*
     * image hanya ditambahkan kalau memang ada.
     */
    if (data.image) {
      options.image =
        data.image
    }

    event.waitUntil(
      self.registration
        .showNotification(
          data.title ||
            'ShinDora Nesub',
          options
        )
    )
  }
)

// ============================================================
// NOTIFICATION CLICK
// ============================================================

self.addEventListener(
  'notificationclick',
  (event) => {
    event.notification.close()

    const targetUrl =
      event.notification.data?.url ||
      '/watch/shindora-push'

    event.waitUntil(
      self.clients
        .matchAll({
          type: 'window',
          includeUncontrolled: true
        })
        .then((clientList) => {
          /*
           * Cari tab ShinDora yang sudah terbuka.
           */
          for (
            const client of clientList
          ) {
            if (
              !client.url ||
              !('focus' in client)
            ) {
              continue
            }

            try {
              const currentUrl =
                new URL(client.url)

              const desiredUrl =
                new URL(
                  targetUrl,
                  self.location.origin
                )

              /*
               * Kalau origin sama, fokus tab tersebut
               * lalu arahkan ke URL target.
               */
              if (
                currentUrl.origin ===
                desiredUrl.origin
              ) {
                client.focus()

                if (
                  'navigate' in client
                ) {
                  return client.navigate(
                    desiredUrl.href
                  )
                }

                return client
              }
            } catch (error) {
              console.warn(
                '[SW] URL notification click invalid:',
                error
              )
            }
          }

          /*
           * Tidak ada tab yang cocok:
           * buka tab baru.
           */
          if (
            self.clients.openWindow
          ) {
            return self.clients.openWindow(
              targetUrl
            )
          }

          return undefined
        })
    )
  }
)
