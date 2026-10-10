import { getBaseUrl } from '@/lib/utils/baseUrl'

export default function robots() {
  const baseUrl = getBaseUrl()
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/api/'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
