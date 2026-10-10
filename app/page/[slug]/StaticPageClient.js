'use client'

import { useState, useEffect } from 'react'
import { Tv, Sun, Moon } from 'lucide-react'

export default function StaticPageClient({ slug }) {
  const [theme, setTheme] = useState('light')
  const [pageData, setPageData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const savedTheme = localStorage.getItem('shindora-theme') || localStorage.getItem('theme') || 'light'
    setTheme(savedTheme)
    document.documentElement.classList.toggle('dark', savedTheme === 'dark')

    if (slug) {
      fetchPage()
    }
  }, [slug])

  const fetchPage = async () => {
    try {
      const res = await fetch('/api/pages')
      const data = await res.json()
      if (Array.isArray(data)) {
        const matched = data.find(p => p.slug === slug)
        setPageData(matched)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleToggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(nextTheme)
    localStorage.setItem('shindora-theme', nextTheme)
    localStorage.setItem('theme', nextTheme)
    document.documentElement.classList.toggle('dark', nextTheme === 'dark')
  }

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-[#0a0b14] text-[#e2e8f0]' : 'bg-[#f8fafc] text-[#0f172a]'}`}>
      
      {/* HEADER */}
      <header className={`border-b px-4 py-3 sticky top-0 z-40 backdrop-blur-md ${
        theme === 'dark' ? 'bg-[#0d0e1b]/95 border-[#1e2038]' : 'bg-white/95 border-slate-200'
      }`}>
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/" className="px-3 py-1 bg-slate-500/10 hover:bg-slate-500/20 text-xs font-black rounded-lg transition-all border border-slate-500/20">
              &larr; Kembali ke Beranda
            </a>
            <div className="flex items-center gap-2">
              <div className="p-1 bg-pink-500 rounded text-white font-black text-xs">SD</div>
              <span className="font-extrabold tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-pink-500 to-purple-500 text-sm">
                SHINDORA NESUB
              </span>
            </div>
          </div>

          <button
            onClick={handleToggleTheme}
            className={`p-2 rounded-full transition-all ${theme === 'dark' ? 'hover:bg-[#1a1c32] text-yellow-400' : 'hover:bg-slate-100 text-slate-700'}`}
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* CONTENT AREA */}
      <main className="max-w-3xl mx-auto p-4 md:p-8 space-y-6">
        {pageData ? (
          <article className="space-y-4">
            <h1 className={`text-2xl md:text-3xl font-black border-b pb-4 ${
              theme === 'dark' ? 'text-white border-slate-500/10' : 'text-slate-900 border-slate-200'
            }`}>
              {pageData.title}
            </h1>
            <div 
              className={`prose text-xs md:text-sm leading-relaxed space-y-4 ${
                theme === 'dark' ? 'prose-invert text-slate-300' : 'text-slate-700'
              }`}
              dangerouslySetInnerHTML={{ __html: pageData.content }}
            />
          </article>
        ) : (
          <div className="text-center py-20 opacity-50 italic text-sm">
            Halaman statis yang Anda cari tidak dapat ditemukan atau telah dihapus oleh Admin.
          </div>
        )}
      </main>

      <footer className="border-t py-6 text-center text-xs opacity-50 mt-12 bg-[#090a12] border-[#1e2038]">
        <p>&copy; ShinDora Nesub &bull; Retro &amp; Nostalgia streaming platform.</p>
      </footer>
    </div>
  )
}
