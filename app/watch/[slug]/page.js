import { getUnifiedDb } from '@/lib/db'
import ShindoraApp from '@/app/ShindoraApp'

export async function generateMetadata({ params }) {
  const resolvedParams = await params;
  const slug = resolvedParams?.slug;
  
  let video = null
  try {
    const db = await getUnifiedDb()
    video = await db.collection('videos').findOne({ $or: [{ slug }, { id: slug }] })
  } catch (err) {
    console.error('[Metadata Fetch Error]:', err)
  }

  if (!video) {
    return {
      title: 'Konten Tidak Ditemukan - ShinDora Nesub',
    }
  }

  const catParts = [video.animeTitle, video.subCategory, video.subCategory2, video.subCategory3].filter(Boolean);
  const title = `${video.title}${catParts.length > 0 ? ` - ${catParts.join(' | ')}` : ''} - ShinDora Nesub`
  const description = video.description || `Tonton ${video.title} sub Indo gratis di ShinDora Nesub.`
  const imageUrl = video.thumbnailUrl || '/default-og.jpg'

  return {
    title: title,
    description: description,
    openGraph: {
      title: title,
      description: description,
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: video.title,
        },
      ],
      type: 'video.other',
    },
    twitter: {
      card: 'summary_large_image',
      title: title,
      description: description,
      images: [imageUrl],
    },
  }
}

export default async function WatchSlugPage({ params }) {
  const resolvedParams = await params;
  const slug = resolvedParams?.slug;

  let video = null
  let initialVideos = []
  let initialCategories = []
  let initialSettings = null

  try {
    const db = await getUnifiedDb()
    const [v, vids, cats, sets] = await Promise.all([
      db.collection('videos').findOne({ $or: [{ slug }, { id: slug }] }).catch(() => null),
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
    video = v
    initialVideos = vids || []
    initialCategories = cats || []
    initialSettings = sets || null
  } catch (err) {
    console.error('[Watch Page Turso Fetch Error]:', err)
  }

  const jsonLd = video ? {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    'name': video.title,
    'description': video.description || `Tonton ${video.title} sub Indo gratis di ShinDora Nesub.`,
    'thumbnailUrl': [
      video.thumbnailUrl || 'https://shindoranesub.my.id/default-og.jpg'
    ],
    'uploadDate': new Date(video.createdAt || new Date()).toISOString(),
    'embedUrl': video.videoUrl || `https://shindoranesub.my.id/api/embed?id=${video.id}`,
    'interactionStatistic': {
      '@type': 'InteractionCounter',
      'interactionType': { '@type': 'WatchAction' },
      'userInteractionCount': video.views || 0
    }
  } : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <ShindoraApp 
        initialSlug={slug} 
        initialVideo={video ? JSON.parse(JSON.stringify(video)) : null} 
        initialVideos={initialVideos ? JSON.parse(JSON.stringify(initialVideos)) : []}
        initialCategories={initialCategories ? JSON.parse(JSON.stringify(initialCategories)) : []}
        initialSettings={initialSettings ? JSON.parse(JSON.stringify(initialSettings)) : null}
      />
    </>
  )
}
