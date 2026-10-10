'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import {
  Play,
  Pause,
  Search,
  Tv,
  ArrowLeft,
  RotateCcw,
  Volume2,
  Clock,
  Heart,
  Plus,
  Maximize2,
  Minimize2,
  ChevronRight,
  ChevronLeft,
  X,
  Radio,
  Sliders,
  Check
} from 'lucide-react'
import { useTVNavigation } from './useTVNavigation'
import { setTVModeActive } from '@/lib/utils/tvMode'

const VIRTUAL_KEYBOARD_ROWS = [
  ['A', 'B', 'C', 'D', 'E', 'F', '1', '2', '3'],
  ['G', 'H', 'I', 'J', 'K', 'L', '4', '5', '6'],
  ['M', 'N', 'O', 'P', 'Q', 'R', '7', '8', '9'],
  ['S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', '0'],
  ['Spasi', 'Hapus', 'Bersihkan', 'Cari']
]

export default function SmartTVInterface({
  videos = [],
  categories = [],
  playlists = [],
  settings = null,
  onExitTVMode,
  onWatchVideo = null
}) {
  const containerRef = useRef(null)
  const [activeTab, setActiveTab] = useState('home') // 'home', 'search', 'playlists', 'categories'
  const [activeVideo, setActiveVideo] = useState(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [showPlayerControls, setShowPlayerControls] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('ALL')
  const [timeClock, setTimeClock] = useState('')
  const [focusedSection, setFocusedSection] = useState('hero')
  const [activePlaylist, setActivePlaylist] = useState(null)
  const videoPlayerRef = useRef(null)
  const controlsTimeoutRef = useRef(null)
  const endedHandledVideoRef = useRef(null)

  // =========================================================================
  // INTEGRASI SINKRONISASI AUTOPLAY KE SHINDORA NESUB
  // =========================================================================
  // Mengirim sinyal ke parent iframe bahwa video telah selesai.
  // Shindora Nesub dapat menggunakan event ini untuk melanjutkan
  // ke episode berikutnya pada playlist.
  const sendShinDoraEndedSignal = useCallback(() => {
    if (
      typeof window !== 'undefined' &&
      window.parent &&
      window.parent !== window
    ) {
      window.parent.postMessage(
        { event: 'SHINDORA_VIDEO_ENDED' },
        '*'
      )
    }
  }, [])

  // Clock in TV Header
  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      setTimeClock(
        now.toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit'
        }) + ' WIB'
      )
    }

    updateTime()

    const timer = setInterval(updateTime, 30000)

    return () => clearInterval(timer)
  }, [])

  // Cleanup controls timeout
  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current)
      }
    }
  }, [])

  // Reset player state when active video changes
  useEffect(() => {
    endedHandledVideoRef.current = null

    if (activeVideo) {
      setCurrentTime(0)
      setDuration(0)
      setIsPlaying(true)
      setShowPlayerControls(true)
    } else {
      setCurrentTime(0)
      setDuration(0)
      setIsPlaying(false)
    }
  }, [activeVideo])

  // Hero Video selection
  const heroVideo = useMemo(() => {
    if (videos.length === 0) return null

    // Pick popular video or first video
    const popular = [...videos].sort(
      (a, b) => (b.views || 0) - (a.views || 0)
    )[0]

    return popular || videos[0]
  }, [videos])

  // Categorized Video Rails
  const rails = useMemo(() => {
    const list = []

    // 1. Rekomendasi Terpopuler
    const popularVideos = [...videos]
      .sort((a, b) => (b.views || 0) - (a.views || 0))
      .slice(0, 10)

    if (popularVideos.length > 0) {
      list.push({
        id: 'popular',
        title: '🔥 REKOMENDASI TERPOPULER',
        subtitle: 'Koleksi episode paling banyak ditonton minggu ini',
        videos: popularVideos
      })
    }

    // 2. Doraemon Series
    const doraemonVideos = videos.filter(v => {
      const title =
        (v.animeTitle || '') +
        ' ' +
        (v.title || '') +
        ' ' +
        (v.subCategory || '')

      return title.toLowerCase().includes('doraemon')
    })

    if (doraemonVideos.length > 0) {
      list.push({
        id: 'doraemon',
        title: '📺 TV SERIES: DORAEMON',
        subtitle: 'Petualangan ajaib Nobita dan kantong ajaib Doraemon',
        videos: doraemonVideos
      })
    }

    // 3. Crayon Shin-chan
    const shinchanVideos = videos.filter(v => {
      const title =
        (v.animeTitle || '') +
        ' ' +
        (v.title || '') +
        ' ' +
        (v.subCategory || '')

      return (
        title.toLowerCase().includes('shinchan') ||
        title.toLowerCase().includes('shin-chan')
      )
    })

    if (shinchanVideos.length > 0) {
      list.push({
        id: 'shinchan',
        title: '👦 CRAYON SHIN-CHAN',
        subtitle: 'Kekonyolan harian Shinnosuke dan geng Kasukabe',
        videos: shinchanVideos
      })
    }

    // 4. Ninja Hattori & Retro Anime Lainnya
    const hattoriVideos = videos.filter(v => {
      const title =
        (v.animeTitle || '') +
        ' ' +
        (v.title || '') +
        ' ' +
        (v.subCategory || '')

      return (
        title.toLowerCase().includes('hattori') ||
        title.toLowerCase().includes('maruko') ||
        title.toLowerCase().includes('shiro')
      )
    })

    if (hattoriVideos.length > 0) {
      list.push({
        id: 'hattori',
        title: '🥷 NINJA HATTORI & ANIME LAINNYA',
        subtitle: 'Jurus ninja rahasia dan kisah nostalgia masa kecil',
        videos: hattoriVideos
      })
    }

    // 5. Film / Movie Standalone
    const movieVideos = videos.filter(v => {
      const title =
        (v.animeTitle || '') +
        ' ' +
        (v.title || '') +
        ' ' +
        (v.subCategory || '') +
        ' ' +
        (v.episode || '')

      return (
        title.toLowerCase().includes('movie') ||
        title.toLowerCase().includes('stand by me')
      )
    })

    if (movieVideos.length > 0) {
      list.push({
        id: 'movie',
        title: '🎥 MOVIE & SPESIAL STANDALONE',
        subtitle: 'Film layar lebar kualitas sinematik takarir Indonesia',
        videos: movieVideos
      })
    }

    // Fallback: Recent videos if rails empty
    if (list.length === 0 && videos.length > 0) {
      list.push({
        id: 'recent',
        title: '🎬 SEMUA EPISODE RETRO',
        subtitle: 'Daftar tontonan lengkap',
        videos: videos
      })
    }

    return list
  }, [videos])

  // Search Results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return []

    const q = searchQuery.toLowerCase().trim()

    return videos.filter(v => {
      const text = [
        v.title,
        v.animeTitle,
        v.subCategory,
        v.subCategory2,
        v.subCategory3,
        v.episode,
        v.description
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return text.includes(q)
    })
  }, [videos, searchQuery])

  // Handle Play Video on TV
  const handlePlayVideo = useCallback(
    (video, playlist = null) => {
      setActiveVideo(video)
      setActivePlaylist(playlist)
      setIsPlaying(true)
      setShowPlayerControls(true)

      if (typeof onWatchVideo === 'function') {
        onWatchVideo(video)
      }
    },
    [onWatchVideo]
  )

  // Handle Back on Remote
  const handleRemoteBack = useCallback(() => {
    if (activeVideo) {
      // Exit player back to TV catalogue
      setActiveVideo(null)
      setActivePlaylist(null)
      setIsPlaying(false)
      return
    }

    if (activeTab === 'search') {
      if (searchQuery.length > 0) {
        setSearchQuery('')
      } else {
        setActiveTab('home')
      }

      return
    }

    if (activeTab !== 'home') {
      setActiveTab('home')
      return
    }

    // On home, focus top header navigation
    const topNav = containerRef.current?.querySelector(
      '[data-tv-focus="true"]'
    )

    if (topNav) {
      topNav.focus()
    }
  }, [activeVideo, activeTab, searchQuery])

  // Handle Play/Pause on Remote
  const handleRemotePlayPause = useCallback(() => {
    if (activeVideo && videoPlayerRef.current) {
      if (videoPlayerRef.current.paused) {
        videoPlayerRef.current.play().catch(() => {})
        setIsPlaying(true)
      } else {
        videoPlayerRef.current.pause()
        setIsPlaying(false)
      }

      triggerControlsVisibility()
    }
  }, [activeVideo])

  // TV Navigation Hook
  useTVNavigation({
    isActive: true,
    onBack: handleRemoteBack,
    onPlayPause: handleRemotePlayPause,
    containerRef
  })

  const triggerControlsVisibility = () => {
    setShowPlayerControls(true)

    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current)
    }

    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowPlayerControls(false)
      }
    }, 4000)
  }

  const handleVirtualKeyClick = key => {
    const upper = String(key).toUpperCase()

    if (upper === 'SPASI' || key === ' ') {
      setSearchQuery(prev => prev + ' ')
    } else if (upper === 'HAPUS' || key === 'Backspace') {
      setSearchQuery(prev => prev.slice(0, -1))
    } else if (upper === 'BERSIHKAN') {
      setSearchQuery('')
    } else if (upper === 'CARI') {
      const firstResult = containerRef.current?.querySelector(
        '[data-tv-result="true"]'
      )

      if (firstResult) {
        firstResult.focus()
      }
    } else {
      setSearchQuery(prev => prev + key)
    }
  }

  // =========================================================================
  // VIDEO ENDED HANDLER
  // =========================================================================
  const handleVideoEnded = useCallback(() => {
    // Beberapa provider bisa mengirim event selesai lebih dari sekali.
    // Pastikan satu video hanya diproses satu kali.
    if (activeVideo && endedHandledVideoRef.current === activeVideo.id) {
      return
    }

    if (activeVideo) {
      endedHandledVideoRef.current = activeVideo.id
    }

    setIsPlaying(false)
    setCurrentTime(duration || 0)

    // -------------------------------------------------------------------------
    // SMART TV PLAYBACK
    // -------------------------------------------------------------------------
    // Playlist -> episode berikutnya dalam playlist.
    // Video biasa -> pilih video lain secara random.
    //
    // SHINDORA_VIDEO_ENDED tetap dikirim ke parent. page.js mengabaikan
    // event ini ketika TV Mode aktif agar autoplay desktop/mobile tidak ikut
    // mengambil alih player Smart TV.
    if (activePlaylist && Array.isArray(activePlaylist.videoIds)) {
      const playlistVideos = activePlaylist.videoIds
        .map(videoId =>
          videos.find(v => String(v.id) === String(videoId))
        )
        .filter(Boolean)
        .sort((a, b) => {
          const getEpisodeNumber = value => {
            const match = String(value || '').match(/\d+(?:\.\d+)?/)
            return match ? parseFloat(match[0]) : 0
          }

          const animeCompare = String(a.animeTitle || '').localeCompare(
            String(b.animeTitle || '')
          )

          if (animeCompare !== 0) return animeCompare

          return getEpisodeNumber(a.episode) - getEpisodeNumber(b.episode)
        })

      const currentIndex = playlistVideos.findIndex(
        video => String(video.id) === String(activeVideo?.id)
      )
      const nextVideo = playlistVideos[currentIndex + 1]

      if (nextVideo) {
        handlePlayVideo(nextVideo, activePlaylist)
      } else {
        setActivePlaylist(null)
        setActiveVideo(null)
        setIsPlaying(false)
      }
    } else {
      const randomCandidates = videos.filter(
        video => String(video.id) !== String(activeVideo?.id)
      )

      if (randomCandidates.length > 0) {
        const randomVideo =
          randomCandidates[Math.floor(Math.random() * randomCandidates.length)]

        handlePlayVideo(randomVideo)
      } else {
        setActiveVideo(null)
      }
    }

    sendShinDoraEndedSignal()
  }, [
    activeVideo,
    activePlaylist,
    duration,
    videos,
    handlePlayVideo,
    sendShinDoraEndedSignal
  ])

  // Provider/embed completion events for Smart TV.
  // page.js juga menerima event yang sama, tetapi akan mengabaikannya
  // selama TV Mode aktif.
  useEffect(() => {
    const handleProviderEndedMessage = event => {
      let data = event.data

      if (typeof data === 'string') {
        try {
          data = JSON.parse(data)
        } catch (e) {
          // plain string
        }
      }

      const isEnded =
        event.data === 'SHINDORA_VIDEO_ENDED' ||
        event.data === 'complete' ||
        event.data === 'ended' ||
        event.data === 'finish' ||
        event.data === 'video_ended' ||
        event.data === 'sibnet_video_ended' ||
        event.data === 'api.video.ended' ||
        data?.event === 'SHINDORA_VIDEO_ENDED' ||
        data?.event === 'complete' ||
        data?.event === 'ended' ||
        data?.event === 'finish' ||
        data?.event === 'video_ended' ||
        data?.event === 'api.video.ended' ||
        data?.type === 'video_ended' ||
        data?.method === 'api.video.ended' ||
        data?.message === 'ended' ||
        (Array.isArray(data) &&
          (data[0] === 'onVideoEnded' || data[0] === 'ended'))

      if (activeVideo && isEnded) {
        handleVideoEnded()
      }
    }

    window.addEventListener('message', handleProviderEndedMessage)
    return () =>
      window.removeEventListener('message', handleProviderEndedMessage)
  }, [activeVideo, handleVideoEnded])


  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[99999] bg-[#07080f] text-white flex flex-col overflow-hidden font-sans select-none"
      style={{
        width: '100vw',
        height: '100vh',
        boxSizing: 'border-box'
      }}
    >
      {/* GLOBAL TV STYLES */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        /* TV Focus Ring & Glow Effect */
        [data-tv-focus="true"]:focus,
        [tabindex="0"]:focus,
        button:focus,
        a:focus,
        input:focus {
          outline: none !important;
          box-shadow: 0 0 0 4px #22d3ee, 0 0 35px rgba(34, 211, 238, 0.7) !important;
          transform: scale(1.05) !important;
          z-index: 40 !important;
          transition: transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.2s !important;
        }

        /* TV Safe margins & smooth scroll */
        .tv-scroll-rail {
          scroll-behavior: smooth;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }

        .tv-scroll-rail::-webkit-scrollbar {
          display: none;
        }
      `
        }}
      />

      {/* ============================================================ */}
      {/* 1. SMART TV HEADER                                            */}
      {/* ============================================================ */}
      <header className="px-6 py-3.5 bg-gradient-to-b from-[#0e1022] to-transparent flex items-center justify-between border-b border-white/10 flex-shrink-0 z-30">
        <div className="flex items-center gap-6">
          {/* Logo Brand */}
          <div className="flex items-center gap-2.5">
            <div className="px-2.5 py-1 bg-gradient-to-r from-cyan-400 to-pink-500 rounded-lg text-black font-black text-sm tracking-wider shadow-lg">
              TV
            </div>

            <div className="text-left">
              <span className="text-base font-black tracking-widest bg-clip-text text-transparent bg-gradient-to-r from-cyan-300 via-pink-400 to-purple-400">
                SHINDORA NESUB
              </span>

              <span className="text-[10px] text-cyan-400 font-bold block tracking-widest uppercase">
                Smart TV Edition
              </span>
            </div>
          </div>

          {/* Navigation Bar */}
          <nav className="flex items-center gap-2">
            {[
              { id: 'home', label: '🏠 Beranda' },
              { id: 'search', label: '🔍 Cari Anime' },
              { id: 'categories', label: '📂 Kategori' },
              { id: 'playlists', label: '📺 Playlist' }
            ].map(tab => (
              <button
                key={tab.id}
                data-tv-focus="true"
                tabIndex={0}
                onClick={() => {
                  setActiveTab(tab.id)

                  if (tab.id !== 'search') {
                    setSearchQuery('')
                  }
                }}
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/20'
                    : 'bg-white/5 hover:bg-white/10 text-slate-200 border border-white/5'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Right Info: Clock & Exit TV Mode */}
        <div className="flex items-center gap-4">
          <div className="px-3 py-1.5 rounded-lg bg-black/40 border border-white/10 text-xs font-mono font-bold text-cyan-300">
            {timeClock || '12:00 WIB'}
          </div>

          <button
            data-tv-focus="true"
            tabIndex={0}
            onClick={() => {
              setTVModeActive(false)

              if (typeof onExitTVMode === 'function') {
                onExitTVMode()
              }
            }}
            className="px-3 py-1.5 rounded-xl bg-red-600/20 hover:bg-red-600/40 text-red-400 border border-red-500/30 text-xs font-bold transition-all cursor-pointer"
            title="Keluar dari Smart TV Mode dan kembali ke tampilan standar"
          >
            ✕ Keluar Mode TV
          </button>
        </div>
      </header>

      {/* ============================================================ */}
      {/* 2. TV CONTENT AREA                                           */}
      {/* ============================================================ */}
      <div className="flex-1 overflow-y-auto tv-scroll-rail p-6 space-y-8">
        {/* TAB 1: HOME (HERO + HORIZONTAL RAILS) */}
        {activeTab === 'home' && (
          <>
            {/* HERO SHOWCASE BANNER */}
            {heroVideo && (
              <div className="relative w-full h-[280px] sm:h-[340px] rounded-3xl overflow-hidden border border-white/10 shadow-2xl flex items-center p-8 bg-gradient-to-r from-black via-black/80 to-transparent">
                {/* Background Image */}
                <img
                  src={
                    heroVideo.thumbnailUrl ||
                    'https://images.unsplash.com/photo-1581833971358-2c8b550f87b3?w=1200'
                  }
                  alt={heroVideo.title}
                  className="absolute inset-0 w-full h-full object-cover -z-10 opacity-50"
                />

                <div className="absolute inset-0 bg-gradient-to-t from-[#07080f] via-transparent to-transparent -z-10" />

                {/* Hero Info */}
                <div className="max-w-xl space-y-3.5 text-left">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-full bg-pink-500 text-white text-[10px] font-black uppercase tracking-widest shadow-md">
                      🔥 REKOMENDASI TERPOPULER
                    </span>

                    <span className="px-2.5 py-1 rounded-full bg-black/60 border border-cyan-500/40 text-cyan-400 text-[10px] font-bold uppercase">
                      {heroVideo.animeTitle || 'ANIME RETRO'}
                    </span>

                    <span className="px-2 py-0.5 rounded bg-white/20 text-white text-[10px] font-bold">
                      {heroVideo.episode || 'Eps 1'}
                    </span>
                  </div>

                  <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight drop-shadow-md">
                    {heroVideo.title}
                  </h2>

                  <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed opacity-90 max-w-lg">
                    {heroVideo.description ||
                      'Nonton episode anime retro nostalgia dengan kualitas takarir bahasa Indonesia terbaik di layar Smart TV Anda.'}
                  </p>

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      data-tv-focus="true"
                      tabIndex={0}
                      onClick={() => handlePlayVideo(heroVideo)}
                      className="px-6 py-3 rounded-2xl bg-gradient-to-r from-cyan-400 to-blue-500 text-black font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-xl hover:opacity-95 cursor-pointer"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      <span>Putar Sekarang (OK)</span>
                    </button>

                    <button
                      data-tv-focus="true"
                      tabIndex={0}
                      onClick={() =>
                        alert(
                          `Episode ${heroVideo.title} berhasil ditandai!`
                        )
                      }
                      className="px-5 py-3 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
                    >
                      + Simpan Nanti
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* HORIZONTAL CAROUSEL RAILS */}
            <div className="space-y-8">
              {rails.map((rail, railIdx) => (
                <div key={rail.id} className="space-y-3">
                  <div className="flex items-baseline justify-between text-left px-1">
                    <div>
                      <h3 className="text-base sm:text-lg font-black tracking-wide text-cyan-300">
                        {rail.title}
                      </h3>

                      <p className="text-[11px] text-slate-400">
                        {rail.subtitle}
                      </p>
                    </div>

                    <span className="text-xs text-slate-500 font-mono font-bold">
                      {rail.videos.length} Item
                    </span>
                  </div>

                  {/* Horizontal Scroll Shelf */}
                  <div className="flex gap-4 overflow-x-auto tv-scroll-rail py-3 px-1">
                    {rail.videos.map((vid, vidIdx) => (
                      <div
                        key={vid.id || `rail-${railIdx}-${vidIdx}`}
                        data-tv-focus="true"
                        tabIndex={0}
                        onClick={() => handlePlayVideo(vid)}
                        className="flex-shrink-0 w-[220px] sm:w-[260px] rounded-2xl overflow-hidden bg-[#101226] border border-white/10 cursor-pointer group transition-all"
                      >
                        {/* Poster Aspect 16:9 */}
                        <div className="relative aspect-video w-full overflow-hidden bg-slate-900">
                          <img
                            src={
                              vid.thumbnailUrl ||
                              'https://images.unsplash.com/photo-1581833971358-2c8b550f87b3?w=500'
                            }
                            alt={vid.title}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />

                          <div className="absolute top-2 left-2 flex gap-1">
                            <span className="px-1.5 py-0.5 rounded bg-pink-600 text-white text-[9px] font-black uppercase">
                              {vid.episode || 'EPS'}
                            </span>
                          </div>

                          <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/70 text-cyan-300 text-[9px] font-bold">
                            👁️ {(vid.views || 0).toLocaleString()}
                          </div>
                        </div>

                        {/* Card Info */}
                        <div className="p-3 text-left space-y-1">
                          <span className="text-[9px] text-cyan-400 font-black uppercase tracking-wider block truncate">
                            {vid.animeTitle || 'RETRO ANIME'}
                          </span>

                          <h4 className="text-xs font-extrabold text-slate-100 truncate group-hover:text-cyan-300">
                            {vid.title}
                          </h4>

                          <p className="text-[10px] text-slate-400 truncate opacity-70">
                            {vid.description || 'Tonton sekarang di Smart TV.'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* TAB 2: SEARCH (VIRTUAL KEYBOARD + SEARCH RESULTS) */}
        {activeTab === 'search' && (
          <div className="max-w-5xl mx-auto space-y-6">
            <div className="text-left space-y-1">
              <h2 className="text-2xl font-black text-cyan-400">
                🔍 PENCARIAN SMART TV
              </h2>

              <p className="text-xs text-slate-400">
                Ketik judul anime atau gunakan tombol keyboard virtual di bawah
                dengan remote.
              </p>
            </div>

            {/* Live Search Input Box */}
            <div className="relative">
              <input
                data-tv-focus="true"
                tabIndex={0}
                type="text"
                placeholder="Ketik judul anime (cth: Doraemon, Shinchan, Nobita)..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full px-5 py-3.5 rounded-2xl bg-[#12142a] border-2 border-cyan-500/40 text-white text-base font-bold outline-none shadow-xl"
              />
            </div>

            {/* Virtual On-Screen TV Keyboard */}
            <div className="p-4 rounded-2xl bg-[#0e1022] border border-white/10 space-y-2 max-w-2xl mx-auto shadow-xl">
              {VIRTUAL_KEYBOARD_ROWS.map((row, rowIdx) => (
                <div
                  key={`row-${rowIdx}`}
                  className="flex justify-center gap-2"
                >
                  {row.map(k => (
                    <button
                      key={k}
                      data-tv-focus="true"
                      tabIndex={0}
                      onClick={() => handleVirtualKeyClick(k)}
                      className={`py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                        k.length > 1
                          ? 'px-4 bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500 hover:text-black'
                          : 'w-10 h-10 bg-white/5 hover:bg-cyan-500 hover:text-black text-white border border-white/10'
                      }`}
                    >
                      {k}
                    </button>
                  ))}
                </div>
              ))}
            </div>

            {/* Results Grid */}
            <div className="space-y-3 text-left">
              <h3 className="text-sm font-bold text-slate-300">
                Hasil Pencarian:{' '}
                <span className="text-cyan-400 font-extrabold">
                  {searchResults.length} Episode
                </span>
              </h3>

              {searchResults.length === 0 ? (
                <div className="py-16 text-center text-slate-500 italic text-xs bg-white/5 rounded-2xl border border-white/5">
                  {searchQuery
                    ? 'Tidak ada episode yang cocok dengan kata kunci tersebut.'
                    : 'Gunakan keyboard di atas untuk mulai mencari.'}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {searchResults.map(vid => (
                    <div
                      key={vid.id}
                      data-tv-focus="true"
                      data-tv-result="true"
                      tabIndex={0}
                      onClick={() => handlePlayVideo(vid)}
                      className="rounded-2xl overflow-hidden bg-[#101226] border border-white/10 cursor-pointer group transition-all"
                    >
                      <div className="aspect-video w-full overflow-hidden bg-slate-900 relative">
                        <img
                          src={vid.thumbnailUrl}
                          alt={vid.title}
                          className="w-full h-full object-cover"
                        />

                        <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-pink-600 text-white text-[9px] font-bold">
                          {vid.episode || 'EPS'}
                        </span>
                      </div>

                      <div className="p-3 space-y-1">
                        <span className="text-[9px] text-cyan-400 font-black block truncate">
                          {vid.animeTitle}
                        </span>

                        <h4 className="text-xs font-bold text-white truncate">
                          {vid.title}
                        </h4>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: CATEGORIES LIST */}
        {activeTab === 'categories' && (
          <div className="max-w-5xl mx-auto space-y-6 text-left">
            <h2 className="text-2xl font-black text-cyan-400">
              📂 HIERARKI KATEGORI ANIME
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {categories.map(cat => {
                const isMain =
                  !cat.parent_id || cat.parent_id === 'none'

                const count = videos.filter(
                  v =>
                    v.animeTitle === cat.name ||
                    v.subCategory === cat.name
                ).length

                return (
                  <button
                    key={cat.id || cat._id}
                    data-tv-focus="true"
                    tabIndex={0}
                    onClick={() => {
                      setSearchQuery(cat.name)
                      setActiveTab('search')
                    }}
                    className={`p-4 rounded-2xl border text-left flex items-center justify-between cursor-pointer transition-all ${
                      isMain
                        ? 'bg-gradient-to-r from-pink-500/10 to-purple-500/10 border-pink-500/30 hover:border-pink-500'
                        : 'bg-[#101226] border-white/10 hover:border-cyan-400'
                    }`}
                  >
                    <div>
                      <span className="text-[10px] text-pink-400 font-black uppercase tracking-wider block">
                        {isMain ? 'Kategori Utama' : 'Sub-Kategori'}
                      </span>

                      <h4 className="text-sm font-bold text-white">
                        {cat.name}
                      </h4>
                    </div>

                    <span className="text-xs px-2 py-1 rounded bg-black/40 text-cyan-300 font-mono font-bold">
                      {count} Video
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* TAB 4: PLAYLISTS */}
        {activeTab === 'playlists' && (
          <div className="max-w-5xl mx-auto space-y-6 text-left">
            <h2 className="text-2xl font-black text-cyan-400">
              📺 DAFTAR PLAYLIST RESMI
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {playlists.map(pl => (
                <div
                  key={pl.id || pl._id}
                  data-tv-focus="true"
                  tabIndex={0}
                  onClick={() => {
                    if (
                      pl.videoIds &&
                      pl.videoIds.length > 0
                    ) {
                      const playlistVideos = pl.videoIds
                        .map(videoId =>
                          videos.find(
                            v => String(v.id) === String(videoId)
                          )
                        )
                        .filter(Boolean)
                        .sort((a, b) => {
                          const getEpisodeNumber = value => {
                            const match = String(value || '').match(
                              /\d+(?:\.\d+)?/
                            )
                            return match ? parseFloat(match[0]) : 0
                          }

                          const animeCompare = String(
                            a.animeTitle || ''
                          ).localeCompare(
                            String(b.animeTitle || '')
                          )

                          if (animeCompare !== 0) return animeCompare

                          return (
                            getEpisodeNumber(a.episode) -
                            getEpisodeNumber(b.episode)
                          )
                        })

                      const firstVid = playlistVideos[0]

                      if (firstVid) {
                        handlePlayVideo(firstVid, pl)
                      }
                    } else {
                      alert(
                        'Playlist ini belum memiliki video.'
                      )
                    }
                  }}
                  className="p-5 rounded-2xl bg-[#101226] border border-white/10 hover:border-cyan-400 cursor-pointer transition-all space-y-2"
                >
                  <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider block">
                    Playlist
                  </span>

                  <h4 className="text-base font-bold text-white">
                    {pl.title}
                  </h4>

                  <p className="text-xs text-slate-400">
                    {Array.isArray(pl.videoIds)
                      ? pl.videoIds.length
                      : 0}{' '}
                    Episode
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* 3. EMBED VIDEO PLAYER (LANGSUNG DARI PROVIDER)                */}
      {/* ============================================================ */}
      {activeVideo && (
        <div className="fixed inset-0 z-[100000] bg-black flex flex-col justify-between overflow-hidden">
          {/* Top Bar for closing if needed */}
          <div className="p-3 bg-black/90 flex items-center justify-between z-10 border-b border-white/10 flex-shrink-0">
            <span className="text-xs font-bold text-slate-200 truncate max-w-lg">
              {activeVideo.title}
            </span>

            <button
              data-tv-focus="true"
              tabIndex={0}
              onClick={() => {
                setActiveVideo(null)
                setActivePlaylist(null)
              }}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-red-600 text-white font-bold text-xs transition-all cursor-pointer"
            >
              ✕ Tutup (Kembali)
            </button>
          </div>

          <div className="relative flex-1 w-full h-full bg-black">
            {(() => {
              const url = activeVideo.videoUrl || ''

              const isDirectMp4 =
                url.endsWith('.mp4') ||
                url.endsWith('.webm') ||
                url.includes('.mp4?')

              if (isDirectMp4) {
                return (
                  <video
                    ref={videoPlayerRef}
                    src={url}
                    autoPlay
                    controls
                    playsInline
                    className="w-full h-full object-contain"
                    onPlay={() => {
                      setIsPlaying(true)
                      triggerControlsVisibility()
                    }}
                    onPause={() => {
                      setIsPlaying(false)
                    }}
                    onTimeUpdate={e => {
                      setCurrentTime(
                        e.currentTarget.currentTime
                      )
                    }}
                    onLoadedMetadata={e => {
                      setDuration(
                        e.currentTarget.duration || 0
                      )
                    }}
                    onEnded={handleVideoEnded}
                  />
                )
              }

              return (
                <iframe
                  src={url}
                  title={activeVideo.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                  allowFullScreen
                  className="w-full h-full border-0"
                />
              )
            })()}
          </div>
        </div>
      )}
    </div>
  )
}
