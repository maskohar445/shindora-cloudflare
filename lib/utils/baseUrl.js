/**
 * Helper to dynamically detect the base URL in Next.js Server & Client components
 * Works natively on Vercel, Cloudflare Pages, local dev, and custom domains.
 */
export function getBaseUrl(request = null) {
  // 1. Check process.env.NEXT_PUBLIC_BASE_URL (manual override)
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL.replace(/\/$/, '');
  }

  // 2. Try Vercel system environment variables
  if (process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.NEXT_PUBLIC_VERCEL_URL) {
    return `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`;
  }

  // 3. Try Cloudflare Pages system variables
  if (process.env.CF_PAGES_URL) {
    return process.env.CF_PAGES_URL.replace(/\/$/, '');
  }

  // 4. Try parsing from incoming HTTP request headers (Server Components / API Routes)
  if (request) {
    try {
      const host = request.headers.get('host') || request.headers.get('x-forwarded-host');
      const proto = request.headers.get('x-forwarded-proto') || 'https';
      if (host) {
        return `${proto}://${host}`;
      }
    } catch (e) {
      // safe fallback
    }
  }

  // 5. Fallback for static builds or default domain
  return "https://shindoranesub.my.id";
}
