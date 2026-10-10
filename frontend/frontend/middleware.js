import { NextResponse } from 'next/server'

/**
 * ShinDora Nesub - Ultra-Low CPU Next.js Edge Middleware
 * 
 * Pengoptimalan Penggunaan CPU Vercel (Mengurangi Middleware Invocations):
 * 1. Fast-Path Bypass: Jika request datang melalui Cloudflare Worker CDN (X-ShinDora-Worker: active),
 *    middleware langsung mengembalikan NextResponse.next() tanpa komputasi tambahan (0ms CPU).
 * 2. Fast-Path Bypass untuk Healthcheck, Prefetch, dan CDN ping endpoints.
 * 3. O(1) Bounded Rate Limiting untuk direct origin requests tanpa looping memory.
 * 4. Matcher presisi: Hanya mencegat /api/* yang membutuhkan proteksi origin.
 */

const rateLimitMap = new Map()
const MAX_MAP_SIZE = 500

export function middleware(request) {
  const headers = request.headers
  const pathname = request.nextUrl.pathname

  // 1. FAST-PATH: Cloudflare Worker CDN Bypass (0ms CPU Vercel)
  // Ketika trafik sudah diverifikasi oleh Cloudflare Worker CDN di Edge, lewati pemrosesan Vercel
  const isFromWorker = headers.get('x-shindora-worker') === 'active' || headers.has('cf-worker')
  if (isFromWorker) {
    const res = NextResponse.next()
    res.headers.set('x-edge-cpu-saver', 'active')
    res.headers.set('x-powered-by-cdn', 'cloudflare-worker')
    return res
  }

  // 2. FAST-PATH: Healthcheck & CDN ping endpoints (0ms CPU)
  if (pathname === '/api/cdn/worker-health' || pathname === '/cdn-health' || pathname === '/api/health') {
    const res = NextResponse.next()
    res.headers.set('x-edge-cpu-saver', 'active')
    return res
  }

  // 3. FAST-PATH: Prefetch & Internal Next.js requests
  if (headers.get('purpose') === 'prefetch' || headers.get('x-middleware-prefetch') === '1') {
    return NextResponse.next()
  }

  // 4. Lightweight Rate Limiting for Direct Unproxied Origin Requests (/api/*)
  if (pathname.startsWith('/api')) {
    const ip = headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.ip || '127.0.0.1'
    const isLocalhost = ip === '127.0.0.1' || ip === '::1' || ip.includes('127.0.0.1')
    const hasRateLimitHeader = headers.get('x-test-rate-limit') === 'true'
    
    // Testing thresholds vs standard thresholds
    const maxRequests = (hasRateLimitHeader || isLocalhost) ? 100 : 10000
    const windowMs = isLocalhost ? 5000 : 60000 // 5 detik untuk localhost, 1 menit untuk publik
    const now = Date.now()

    let rateData = rateLimitMap.get(ip)

    if (!rateData) {
      if (rateLimitMap.size >= MAX_MAP_SIZE) {
        const oldestKey = rateLimitMap.keys().next().value
        if (oldestKey) rateLimitMap.delete(oldestKey)
      }
      rateLimitMap.set(ip, { count: 1, startTime: now })
    } else {
      if (now - rateData.startTime > windowMs) {
        rateData.count = 1
        rateData.startTime = now
      } else {
        rateData.count += 1
      }
    }

    if (rateData && rateData.count > maxRequests) {
      return new NextResponse(
        JSON.stringify({ error: 'Terlalu banyak permintaan! Silakan coba lagi dalam beberapa saat.' }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': '60',
            'x-edge-cpu-saver': 'rate-limited'
          }
        }
      )
    }
  }

  const response = NextResponse.next()
  response.headers.set('x-edge-cpu-saver', 'optimized')
  return response
}

export const config = {
  matcher: [
    /*
     * Match all API routes while strictly excluding static assets, images, and metadata
     */
    '/api/:path*',
  ],
}
