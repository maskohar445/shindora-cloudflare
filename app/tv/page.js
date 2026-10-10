import { getUnifiedDb } from '@/lib/db'
import ShindoraApp from '@/app/ShindoraApp'

export const metadata = {
  title: 'TV Mode - ShinDora Nesub',
  description: 'Nonton marathon anime nostalgia layaknya siaran TV Minggu pagi!',
}

export default async function TVPage() {
  let initialVideos = []
  let initialCategories = []
  let initialSettings = null

  try {
    const db = await getUnifiedDb()
    const [vids, cats, sets] = await Promise.all([
      db.collection('videos').find({
        $and: [{
          $or: [
            { status: { $exists: false } },
            { status: 'published' }
          ]
        }]
      }).toArray().catch(() => []),
      db.collection('categories').find({}).toArray().catch(() => []),
      db.collection('settings').findOne({ id: 'site_settings' }).catch(() => null)
    ])
    initialVideos = vids || []
    initialCategories = cats || []
    initialSettings = sets || null
  } catch (err) {
    console.error('[TV Page Turso Fetch Error]:', err)
  }

  return (
    <ShindoraApp 
      initialTVMode={true} 
      initialVideos={initialVideos ? JSON.parse(JSON.stringify(initialVideos)) : []}
      initialCategories={initialCategories ? JSON.parse(JSON.stringify(initialCategories)) : []}
      initialSettings={initialSettings ? JSON.parse(JSON.stringify(initialSettings)) : null}
    />
  )
}
