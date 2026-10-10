import { getUnifiedDb } from '@/lib/db'
import ShindoraApp from './ShindoraApp'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  let initialVideos = []
  let initialCategories = []
  let initialAds = []
  let initialSettings = null

  try {
    const db = await getUnifiedDb()
    
    const [vids, cats, ads, sets] = await Promise.all([
      db.collection('videos').find({
        $and: [{
          $or: [
            { status: { $exists: false } },
            { status: 'published' }
          ]
        }]
      }).toArray().catch(() => []),
      db.collection('categories').find({}).toArray().catch(() => []),
      db.collection('promo').find({}).toArray().catch(() => []),
      db.collection('settings').findOne({ id: 'site_settings' }).catch(() => null)
    ])

    if (Array.isArray(vids)) initialVideos = JSON.parse(JSON.stringify(vids))
    if (Array.isArray(cats)) initialCategories = JSON.parse(JSON.stringify(cats))
    if (Array.isArray(ads)) initialAds = JSON.parse(JSON.stringify(ads))
    if (sets) initialSettings = JSON.parse(JSON.stringify(sets))
  } catch (err) {
    console.warn('[HomePage SSR Fetch Error]:', err?.message)
  }

  return (
    <ShindoraApp 
      initialVideos={initialVideos}
      initialCategories={initialCategories}
      initialAds={initialAds}
      initialSettings={initialSettings}
    />
  )
}
