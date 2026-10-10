import { getUnifiedDb } from '@/lib/db'
import StaticPageClient from './StaticPageClient'

export async function generateMetadata({ params }) {
  const resolvedParams = await params;
  const slug = resolvedParams.slug;
  
  let pageData = null
  try {
    const db = await getUnifiedDb()
    pageData = await db.collection('pages').findOne({ slug })
  } catch (err) {
    console.error('[Page Metadata Fetch Error]:', err)
  }

  if (!pageData) {
    return {
      title: 'Halaman Tidak Ditemukan - ShinDora Nesub',
    }
  }

  const title = `${pageData.title} - ShinDora Nesub`
  const description = `Baca halaman ${pageData.title} di platform streaming anime retro ShinDora Nesub.`

  return {
    title: title,
    description: description,
    openGraph: {
      title: title,
      description: description,
      type: 'article',
    },
    twitter: {
      card: 'summary',
      title: title,
      description: description,
    },
  }
}

export default async function StaticPage({ params }) {
  const resolvedParams = await params;
  const slug = resolvedParams.slug;
  return <StaticPageClient slug={slug} />
}
