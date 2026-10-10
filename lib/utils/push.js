import { toast } from 'sonner'

/**
 * Jalankan Promise dengan batas waktu.
 */
function withTimeout(promise, timeoutMs, errorMessage) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(errorMessage))
      }, timeoutMs)
    })
  ])
}

/**
 * Convert VAPID public key Base64URL ke Uint8Array.
 */
export function urlBase64ToUint8Array(base64String) {
  if (!base64String) {
    throw new Error('VAPID Public Key kosong.')
  }

  const padding =
    '='.repeat(
      (4 - (base64String.length % 4)) % 4
    )

  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/')

  let rawData

  try {
    rawData = window.atob(base64)
  } catch (error) {
    throw new Error(
      'VAPID Public Key tidak valid.'
    )
  }

  const outputArray =
    new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] =
      rawData.charCodeAt(i)
  }

  return outputArray
}

/**
 * Ambil user ID dari localStorage.
 */
function getUserIdFromStorage() {
  try {
    const raw =
      localStorage.getItem('shindora-user')

    if (!raw) {
      return null
    }

    const user = JSON.parse(raw)

    return (
      user?.id ||
      user?._id ||
      user?.userId ||
      null
    )
  } catch (error) {
    console.warn(
      '[WebPush] Gagal membaca shindora-user:',
      error
    )

    return null
  }
}

/**
 * Subscribe Web Push.
 */
export async function subscribeToWebPush(
  userId = null
) {
  if (typeof window === 'undefined') {
    return {
      success: false,
      error: 'Window tidak tersedia.'
    }
  }

  /**
   * =========================================================
   * 1. BROWSER SUPPORT
   * =========================================================
   */

  if (!('Notification' in window)) {
    toast.error(
      'Browser Anda tidak mendukung Notifikasi.'
    )

    return {
      success: false,
      error:
        'Notification API not supported'
    }
  }

  if (!('serviceWorker' in navigator)) {
    toast.error(
      'Browser Anda tidak mendukung Service Worker.'
    )

    return {
      success: false,
      error:
        'Service Worker not supported'
    }
  }

  if (!('PushManager' in window)) {
    toast.error(
      'Browser Anda tidak mendukung Web Push Notification.'
    )

    return {
      success: false,
      error:
        'PushManager not supported'
    }
  }

  try {
    /**
     * =======================================================
     * 2. REQUEST NOTIFICATION PERMISSION
     *
     * Harus dilakukan langsung dari klik user.
     * =======================================================
     */

    let permission =
      Notification.permission

    console.log(
      '[WebPush] Permission sebelum request:',
      permission
    )

    if (permission === 'default') {
      permission =
        await withTimeout(
          Notification.requestPermission(),
          30000,
          'Permintaan izin notifikasi timeout. Coba klik lagi.'
        )
    }

    console.log(
      '[WebPush] Permission sesudah request:',
      permission
    )

    if (permission !== 'granted') {
      if (permission === 'denied') {
        toast.error(
          'Notifikasi diblokir. Izinkan Notifikasi dari pengaturan situs browser.'
        )
      } else {
        toast.info(
          'Izin notifikasi belum diberikan.'
        )
      }

      return {
        success: false,
        error:
          'Permission not granted',
        permission
      }
    }

    /**
     * =======================================================
     * 3. VAPID PUBLIC KEY
     * =======================================================
     */

    const vapidPublicKey = (
      process.env
        .NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
      'BIcdPCZmFC9l9UivZ7avsx0-inl9NJfY6r78XoqD5nA-LqJC3PIZIW4BGZ_tKTnLjHcrYyR_H8Q6mOK-3sE9-FA'
    ).trim()

    if (!vapidPublicKey) {
      throw new Error(
        'VAPID Public Key belum dikonfigurasi.'
      )
    }

    /**
     * =======================================================
     * 4. REGISTER SERVICE WORKER
     * =======================================================
     */

    console.log(
      '[WebPush] Register /sw.js...'
    )

    const registration =
      await withTimeout(
        navigator.serviceWorker.register(
          '/sw.js',
          {
            scope: '/',
            updateViaCache: 'none'
          }
        ),
        10000,
        'Service Worker timeout saat registrasi.'
      )

    console.log(
      '[WebPush] Service Worker registered:',
      registration
    )

    /**
     * =======================================================
     * 5. TUNGGU SERVICE WORKER AKTIF
     * =======================================================
     */

    let activeRegistration =
      registration

    if (!registration.active) {
      console.log(
        '[WebPush] Menunggu Service Worker aktif...'
      )

      try {
        activeRegistration =
          await withTimeout(
            navigator.serviceWorker.ready,
            10000,
            'Service Worker tidak menjadi aktif.'
          )
      } catch (error) {
        console.warn(
          '[WebPush] navigator.serviceWorker.ready timeout, menggunakan registration langsung.',
          error
        )

        activeRegistration =
          registration
      }
    }

    if (
      !activeRegistration.pushManager
    ) {
      throw new Error(
        'PushManager tidak tersedia pada Service Worker.'
      )
    }

    /**
     * =======================================================
     * 6. CEK SUBSCRIPTION YANG SUDAH ADA
     * =======================================================
     */

    console.log(
      '[WebPush] Mengecek subscription lama...'
    )

    let subscription =
      await withTimeout(
        activeRegistration.pushManager.getSubscription(),
        10000,
        'Timeout saat membaca Web Push subscription.'
      )

    /**
     * =======================================================
     * 7. BUAT SUBSCRIPTION BARU
     * =======================================================
     */

    if (!subscription) {
      console.log(
        '[WebPush] Membuat subscription baru...'
      )

      const applicationServerKey =
        urlBase64ToUint8Array(
          vapidPublicKey
        )

      subscription =
        await withTimeout(
          activeRegistration.pushManager.subscribe(
            {
              userVisibleOnly: true,
              applicationServerKey
            }
          ),
          15000,
          'Push subscription timeout. Periksa Service Worker dan VAPID Public Key.'
        )
    }

    if (!subscription) {
      throw new Error(
        'Subscription Web Push tidak berhasil dibuat.'
      )
    }

    console.log(
      '[WebPush] Subscription berhasil dibuat.'
    )

    /**
     * =======================================================
     * 8. SERIALIZE SUBSCRIPTION
     * =======================================================
     */

    const subJson =
      typeof subscription.toJSON === 'function'
        ? subscription.toJSON()
        : subscription

    const endpoint =
      subscription.endpoint ||
      subJson?.endpoint

    let p256dh =
      subJson?.keys?.p256dh ||
      subscription?.keys?.p256dh

    let auth =
      subJson?.keys?.auth ||
      subscription?.keys?.auth

    if (!p256dh && typeof subscription.getKey === 'function') {
      try {
        const rawKey = subscription.getKey('p256dh')
        if (rawKey) {
          p256dh = btoa(String.fromCharCode.apply(null, new Uint8Array(rawKey)))
        }
      } catch (e) {
        console.warn('[WebPush] Error extracting p256dh:', e)
      }
    }

    if (!auth && typeof subscription.getKey === 'function') {
      try {
        const rawAuth = subscription.getKey('auth')
        if (rawAuth) {
          auth = btoa(String.fromCharCode.apply(null, new Uint8Array(rawAuth)))
        }
      } catch (e) {
        console.warn('[WebPush] Error extracting auth:', e)
      }
    }

    if (
      !endpoint ||
      !p256dh ||
      !auth
    ) {
      throw new Error(
        'Data subscription Web Push tidak lengkap.'
      )
    }

    /**
     * =======================================================
     * 9. USER ID
     * =======================================================
     */

    const resolvedUserId =
      userId ||
      getUserIdFromStorage() ||
      null

    console.log(
      '[WebPush] User ID:',
      resolvedUserId
    )

    /**
     * =======================================================
     * 10. KIRIM KE SERVER
     * =======================================================
     */

    console.log(
      '[WebPush] Mengirim subscription ke server...'
    )

    const controller =
      new AbortController()

    const fetchTimeout =
      setTimeout(() => {
        controller.abort()
      }, 15000)

    let res

    try {
      res = await fetch(
        '/api/push/subscribe',
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json'
          },

          credentials: 'include',

          signal:
            controller.signal,

          body: JSON.stringify({
            endpoint,
            p256dh,
            auth,
            userId:
              resolvedUserId
          })
        }
      )
    } finally {
      clearTimeout(fetchTimeout)
    }

    /**
     * =======================================================
     * 11. PARSE RESPONSE
     * =======================================================
     */

    let data = null

    try {
      data = await res.json()
    } catch (error) {
      data = null
    }

    if (!res.ok) {
      throw new Error(
        data?.error ||
        `Gagal menyimpan subscription. HTTP ${res.status}`
      )
    }

    /**
     * =======================================================
     * 12. SIMPAN STATUS LOCAL
     * =======================================================
     */

    localStorage.setItem(
      'webpush-subscribed',
      'true'
    )

    localStorage.setItem(
      'webpush-endpoint',
      endpoint
    )

    /**
     * =======================================================
     * 13. SUCCESS
     * =======================================================
     */

    console.log(
      '[WebPush] Web Push berhasil diaktifkan.'
    )

    toast.success(
      '🎉 Notifikasi Web Push berhasil diaktifkan!'
    )

    return {
      success: true,
      subscription: subJson,
      data
    }

  } catch (error) {
    console.error(
      '[WebPush Subscribe Error]:',
      error
    )

    let message =
      error?.message ||
      'Gagal mengaktifkan notifikasi Web Push.'

    if (
      error?.name === 'AbortError'
    ) {
      message =
        'Request Web Push timeout. Coba lagi.'
    }

    toast.error(message)

    return {
      success: false,
      error: message
    }
  }
}

/**
 * ===========================================================
 * UNSUBSCRIBE WEB PUSH
 * ===========================================================
 */
export async function unsubscribeFromWebPush() {
  if (typeof window === 'undefined') {
    return {
      success: false
    }
  }

  try {
    const registration =
      await withTimeout(
        navigator.serviceWorker.ready,
        10000,
        'Service Worker tidak aktif.'
      )

    const subscription =
      await withTimeout(
        registration.pushManager.getSubscription(),
        10000,
        'Timeout saat membaca subscription.'
      )

    if (subscription) {
      const controller =
        new AbortController()

      const timeout =
        setTimeout(() => {
          controller.abort()
        }, 10000)

      try {
        await fetch(
          '/api/push/unsubscribe',
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json'
            },

            credentials: 'include',

            signal:
              controller.signal,

            body: JSON.stringify({
              endpoint:
                subscription.endpoint
            })
          }
        )
      } finally {
        clearTimeout(timeout)
      }

      await withTimeout(
        subscription.unsubscribe(),
        10000,
        'Timeout saat menghapus subscription.'
      )
    }

    localStorage.removeItem(
      'webpush-subscribed'
    )

    localStorage.removeItem(
      'webpush-endpoint'
    )

    toast.info(
      'Notifikasi Web Push telah dinonaktifkan.'
    )

    return {
      success: true
    }

  } catch (error) {
    console.error(
      '[WebPush Unsubscribe Error]:',
      error
    )

    toast.error(
      error?.message ||
      'Gagal menonaktifkan notifikasi.'
    )

    return {
      success: false,
      error:
        error?.message
    }
  }
}
