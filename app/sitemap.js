import { getUnifiedDb } from '@/lib/db'
import { getBaseUrl } from '@/lib/utils/baseUrl'

// Helper sanitasi slug yang aman dari error undefined
function cleanSlug(str) {
  if (!str || typeof str !== 'string') return ''
  return str
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/--+/g, '-')
}

export default async function sitemap() {
  // 1. Tentukan Base URL Utama Web Anda
  const baseUrl = getBaseUrl()

  let videos = []
  let categories = []

  try {
    const db = await getUnifiedDb()

    // Proyeksi Field: Ambil hanya field yang diperlukan
    videos = await db
      .collection('videos')
      .find({ status: 'published' })
      .toArray()

    categories = await db.collection('categories').find({}).toArray()
  } catch (err) {
    console.error('[Sitemap Generation Error]:', err)
  }

  // 2. Map Data Halaman Utama (Home)
  const routes = [
    {
      url: `${baseUrl}`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
  ]

  // 3. Map Data Kategori & Sub-Kategori
  if (Array.isArray(categories)) {
    categories.forEach((cat) => {
      if (!cat) return

      const isSub = Boolean(cat.parent_id && cat.parent_id !== 'none')
      const parent = isSub
        ? categories.find((p) => p && String(p._id || p.id) === String(cat.parent_id))
        : null

      const slug = cleanSlug(cat.slug || cat.name)
      const parentSlug = parent ? cleanSlug(parent.slug || parent.name) : ''

      if (slug) {
        const urlPath = isSub && parentSlug ? `/page/${parentSlug}/${slug}` : `/page/${slug}`

        routes.push({
          url: `${baseUrl}${urlPath}`,
          lastModified: new Date(),
          changeFrequency: 'weekly',
          priority: isSub ? 0.7 : 0.8,
        })
      }
    })
  }

  // 4. Map Data Detail Video
  if (Array.isArray(videos)) {
    videos.forEach((video) => {
      if (!video) return

      const videoSlug = cleanSlug(video.slug)
      if (videoSlug) {
        const validDate = video.createdAt ? new Date(video.createdAt) : new Date()
        const lastmod = !isNaN(validDate.getTime()) ? validDate : new Date()

        routes.push({
          url: `${baseUrl}/watch/${videoSlug}`,
          lastModified: lastmod,
          changeFrequency: 'weekly',
          priority: 0.6,
        })
      }
    })
  }

  return routes
}
