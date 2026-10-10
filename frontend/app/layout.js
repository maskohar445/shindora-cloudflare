import './globals.css'
import { Providers } from './providers'
import { Toaster } from '@/components/ui/sonner'
import Script from 'next/script'
import { getUnifiedDb } from '@/lib/db'

// 1. METADATA
export const metadata = {
  title: 'ShinDora Nesub',
  description: 'Tempat Nonton Doraemon, Crayon Shin-chan Dan Ninja Hattori-kun Takarir Indonesia Gratis',
  keywords: 'Doraemon, Crayon Shin-chan, Ninja Hattori, Takarir Indonesia, Nonton Retro Anime, Streaming Gratis',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/apple-icon.png',
  },
  openGraph: {
    title: 'ShinDora Nesub',
    description: 'Tempat Nonton Doraemon, Crayon Shin-chan Dan Ninja Hattori-kun Takarir Indonesia Gratis',
    url: 'https://shindoranesub.my.id',
    siteName: 'ShinDora Nesub',
    images: [
      {
        url: '/apple-icon.png',
        width: 512,
        height: 512,
        alt: 'ShinDora Nesub Icon',
      },
    ],
    locale: 'id_ID',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ShinDora Nesub',
    description: 'Tempat Nonton Doraemon, Crayon Shin-chan Dan Ninja Hattori-kun Takarir Indonesia Gratis',
    images: ['/apple-icon.png'],
  },
  verification: {
    google: 'google-site-verification-placeholder',
  },
}

// 2. VIEWPORT
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#0a0b14',
}

export default async function RootLayout({ children }) {
  let dbGaId = null

  try {
    const db = await getUnifiedDb()

    const settings = await db.collection('settings').findOne({
      id: 'site_settings',
    })

    dbGaId =
      settings?.gaId ||
      settings?.NEXT_PUBLIC_GA_ID ||
      null
  } catch (err) {
    console.error('[Layout Settings Fetch Error]:', err)
  }

  // GA4
  const gaId =
    process.env.NEXT_PUBLIC_GA_ID ||
    dbGaId ||
    null

  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=5"
        />
        <meta
          name="apple-mobile-web-app-title"
          content="ShinDora Nesub"
        />

        <meta
          name="apple-mobile-web-app-capable"
          content="yes"
        />

        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />

        {/* Google AdSense */}
        <Script
          async
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${
            process.env.NEXT_PUBLIC_ADSENSE_ID ||
            'ca-pub-XXXXXXXXXXXXXXXX'
          }`}
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />

        {/* Anti-DataCloneError patch */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              'window.addEventListener("error",function(e){if(e.error instanceof DOMException&&e.error.name==="DataCloneError"&&e.message&&e.message.includes("PerformanceServerTiming")){e.stopImmediatePropagation();e.preventDefault()}},true);',
          }}
        />

        {/* Theme Inserter */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var saved = localStorage.getItem('shindora-theme') || localStorage.getItem('theme');
                  if (saved === 'dark') {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                } catch (e) {
                  document.documentElement.classList.remove('dark');
                }
              })();
            `,
          }}
        />

        {/* Google Analytics GA4 */}
        {gaId && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
              strategy="afterInteractive"
            />

            <Script
              id="google-analytics"
              strategy="afterInteractive"
            >
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${gaId}');
              `}
            </Script>
          </>
        )}
      </head>

      <body className="bg-[#f8fafc] dark:bg-[#0a0b14] text-[#0f172a] dark:text-[#e2e8f0] transition-colors duration-150">
        <Providers>
          {children}
          <Toaster
            richColors
            position="top-right"
          />
        </Providers>
      </body>
    </html>
  )
}
