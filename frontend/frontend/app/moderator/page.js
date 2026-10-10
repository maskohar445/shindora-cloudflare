'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Trash2, Search, Filter, Shield, AlertTriangle, ArrowLeft, Bell } from 'lucide-react'

export default function ModeratorPage() {
  const router = useRouter()
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [loading, setLoading] = useState(false)
  const [theme, setTheme] = useState('light')
  const [mounted, setMounted] = useState(false)
  
  // Real-time lists and tools
  const [comments, setComments] = useState([])
  const [videos, setVideos] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [episodeFilter, setEpisodeFilter] = useState('ALL')
  const [currentUser, setCurrentUser] = useState(null)

  // Moderator Notifications State
  const [modNotifications, setModNotifications] = useState([])
  const [showModNotifDropdown, setShowModNotifDropdown] = useState(false)

  const fetchModNotifications = useCallback(async () => {
    try {
      const storedUser = typeof window !== 'undefined' ? (localStorage.getItem('shindora-user') || localStorage.getItem('user')) : null
      if (!storedUser) return
      let targetId = ''
      try {
        const parsed = JSON.parse(storedUser)
        targetId = parsed.id || parsed._id || parsed.email || ''
      } catch (_) {}
      if (!targetId) return

      const res = await fetch(`/api/notifications?userId=${encodeURIComponent(targetId)}`)
      if (res.ok) {
        const data = await res.json()
        setModNotifications(Array.isArray(data) ? data : [])
      }
    } catch (e) {
      console.warn('Error fetching moderator notifications:', e)
    }
  }, [])

  const handleMarkAllModNotifRead = async () => {
    try {
      const storedUser = typeof window !== 'undefined' ? (localStorage.getItem('shindora-user') || localStorage.getItem('user')) : null
      if (!storedUser) return
      const parsed = JSON.parse(storedUser)
      const targetId = parsed.id || parsed._id || parsed.email
      await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: targetId, markAll: true })
      })
      fetchModNotifications()
    } catch (_) {}
  }

  const handleMarkModNotifRead = async (notif) => {
    try {
      await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: notif.id })
      })
      fetchModNotifications()
      if (notif.videoSlug || notif.videoId) {
        window.open(`/watch/${notif.videoSlug || notif.videoId}`, '_blank')
      }
    } catch (_) {}
  }

  const handleClearAllModNotif = async () => {
    if (!confirm('Hapus seluruh riwayat notifikasi moderator?')) return
    try {
      const storedUser = typeof window !== 'undefined' ? (localStorage.getItem('shindora-user') || localStorage.getItem('user')) : null
      if (!storedUser) return
      const parsed = JSON.parse(storedUser)
      const targetId = parsed.id || parsed._id || parsed.email
      await fetch(`/api/notifications?userId=${encodeURIComponent(targetId)}`, { method: 'DELETE' })
      fetchModNotifications()
    } catch (_) {}
  }

  const checkAuth = () => {
    if (typeof window === 'undefined') return
    const storedUser = localStorage.getItem('shindora-user') || localStorage.getItem('user')
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser)
        setCurrentUser(parsed)
        const role = (parsed.role || '').toLowerCase()
        if (['moderator', 'admin', 'staf', 'staff', 'superadmin'].includes(role)) {
          setIsAuthorized(true)
          fetchCommentsAndVideos()
          return
        }
      } catch (e) {
        console.error(e)
      }
    }
    setIsAuthorized(false)
  }

  useEffect(() => {
    setMounted(true)
    const savedTheme = localStorage.getItem('shindora-theme') || localStorage.getItem('theme') || 'light'
    setTheme(savedTheme)
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }

    checkAuth()
    fetchModNotifications()
    const interval = setInterval(fetchModNotifications, 10000)
    window.addEventListener('storage', checkAuth)
    return () => {
      clearInterval(interval)
      window.removeEventListener('storage', checkAuth)
    }
  }, [fetchModNotifications])

  const fetchCommentsAndVideos = async () => {
    try {
      const comRes = await fetch('/api/comments')
      if (!comRes.ok) throw new Error('Gagal mengambil data komentar dari server!')
      const comData = await comRes.json()
      setComments(Array.isArray(comData) ? comData : [])

      const vidRes = await fetch('/api/videos')
      if (!vidRes.ok) throw new Error('Gagal mengambil data video dari server!')
      const vidData = await vidRes.json()
      setVideos(Array.isArray(vidData) ? vidData : [])
    } catch (err) {
      console.error(err)
      alert('Koneksi Gagal: ' + err.message)
    }
  }

  // Deleting comment and all nested replying children
  const handleDeleteComment = async (commentId) => {
    if (!confirm('Hapus komentar ini beserta seluruh rantai balasannya? Tindakan ini tidak dapat dibatalkan.')) return

    try {
      const res = await fetch(`/api/comments?id=${commentId}`, {
        method: 'DELETE'
      })
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Server menolak penghapusan komentar')
      }
      const data = await res.json()
      alert(`Berhasil menghapus ${data.deletedCount || 1} komentar/balasan!`)
      fetchCommentsAndVideos()
    } catch (err) {
      console.error(err)
      alert('Gagal menghapus komentar: ' + err.message)
    }
  }

  // Searched & Filtered comment lists
  const filteredComments = comments.filter(comment => {
    const matchesSearch = (comment.content || comment.text || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (comment.userName || '').toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesEpisode = episodeFilter === 'ALL' || comment.videoId === episodeFilter

    return matchesSearch && matchesEpisode
  })

  if (!mounted) {
    return null
  }

  const isDark = theme === 'dark'

  if (!isAuthorized) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 ${isDark ? 'bg-[#07080f] text-[#e2e8f0]' : 'bg-[#f8fafc] text-[#0f172a]'}`}>
        <div className="w-full max-w-md rounded-2xl border border-cyan-500/20 bg-[#0d0e1b]/95 p-6 md:p-8 shadow-2xl text-center space-y-4">
          <div className="inline-flex p-3 rounded-full bg-cyan-500/10 text-cyan-400 mb-2">
            <Shield className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black uppercase tracking-wider text-cyan-400">Akses Panel Moderator</h2>
          <p className="text-xs opacity-70">Silakan masuk dengan akun Moderator atau Admin untuk mengelola komentar dan konten.</p>
          <Link
            href="/login"
            className="inline-block w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-xs font-bold shadow-lg hover:opacity-90 transition-all"
          >
            Masuk ke Akun Moderator &rarr;
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-200 ${
      isDark ? 'bg-[#0a0b14] text-[#e2e8f0]' : 'bg-[#f8fafc] text-[#0f172a]'
    }`}>
      
      {/* NAVBAR HEADER */}
      <header className={`border-b px-3 sm:px-6 py-3 sticky top-0 z-40 ${
        isDark ? 'border-slate-800 bg-[#0d0e1b]' : 'border-slate-200 bg-white shadow-sm'
      }`}>
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center justify-between w-full sm:w-auto">
            <Link href="/" className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all border flex items-center gap-1 ${
              isDark 
                ? 'bg-slate-500/10 hover:bg-slate-500/20 border-slate-500/20 text-slate-300' 
                : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
            }`}>
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Website</span>
            </Link>

            <div className="flex items-center gap-2 sm:hidden">
              <span className="px-2 py-0.5 rounded text-[10px] font-black bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30">MODE STAF</span>
            </div>
          </div>

          <div className="flex items-center justify-center sm:justify-start gap-2 w-full sm:w-auto">
            <Shield className="w-5 h-5 text-cyan-500 fill-cyan-500/10 flex-shrink-0" />
            <span className="font-extrabold tracking-wider text-xs sm:text-sm bg-gradient-to-r from-cyan-500 to-blue-600 bg-clip-text text-transparent uppercase">
              Panel Moderasi Komentar
            </span>
          </div>
          
          <div className="flex items-center justify-end gap-2.5 w-full sm:w-auto border-t sm:border-0 pt-2 sm:pt-0 border-slate-500/10">
            {/* Lonceng Notifikasi Moderator */}
            <div className="relative">
              <button
                type="button"
                data-testid="mod-notifications-toggle-btn"
                onClick={() => setShowModNotifDropdown(!showModNotifDropdown)}
                className={`p-2 rounded-lg transition-all relative border cursor-pointer ${
                  showModNotifDropdown
                    ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40'
                    : (isDark ? 'border-slate-800 bg-[#121324] hover:bg-slate-800 text-slate-300' : 'border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-700 shadow-sm')
                }`}
                title="Pemberitahuan Balasan Komentar"
              >
                <Bell className="w-4 h-4" />
                {modNotifications.filter(n => !n.isRead).length > 0 && (
                  <span className="absolute -top-1.5 -right-1 bg-red-600 text-[9px] font-black text-white px-1.5 py-0.2 rounded-full shadow animate-bounce flex items-center justify-center">
                    {modNotifications.filter(n => !n.isRead).length}
                  </span>
                )}
              </button>

              {/* Dropdown Notifikasi Panel Moderator */}
              {showModNotifDropdown && (
                <div className={`absolute right-0 mt-2.5 w-72 sm:w-80 rounded-xl border p-3 shadow-2xl space-y-3 z-50 ${
                  isDark ? 'bg-[#0d0e1b] border-[#1e2038] text-[#e2e8f0]' : 'bg-white border-slate-200 text-slate-900'
                }`}>
                  <div className="flex items-center justify-between border-b border-slate-500/10 pb-2">
                    <span className="font-extrabold text-xs flex items-center gap-1.5">
                      <Bell className="w-3.5 h-3.5 text-cyan-500" />
                      Pemberitahuan Staf
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleMarkAllModNotifRead}
                        className="text-[10px] font-bold text-cyan-400 hover:underline cursor-pointer"
                      >
                        Tandai dibaca
                      </button>
                      {modNotifications.length > 0 && (
                        <button
                          type="button"
                          onClick={handleClearAllModNotif}
                          className="text-[10px] font-bold text-red-400 hover:underline cursor-pointer"
                        >
                          Bersihkan
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="max-h-60 overflow-y-auto space-y-2.5 scrollbar-hide">
                    {modNotifications.length === 0 ? (
                      <p className="text-center py-6 text-[11px] opacity-50 italic">Tidak ada notifikasi baru.</p>
                    ) : (
                      modNotifications.map((notif) => (
                        <div
                          key={notif.id}
                          onClick={() => handleMarkModNotifRead(notif)}
                          className={`p-2.5 rounded-lg text-[11px] flex gap-2 cursor-pointer transition-all border text-left ${
                            notif.isRead
                              ? 'opacity-60 bg-transparent border-transparent'
                              : (isDark ? 'bg-cyan-500/5 border-cyan-500/10 hover:bg-cyan-500/10' : 'bg-cyan-50/50 border-cyan-100 hover:bg-cyan-100/50')
                          }`}
                        >
                          {notif.senderAvatar ? (
                            <img src={notif.senderAvatar} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0 mt-0.5" />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-[10px] flex-shrink-0 mt-0.5">
                              {notif.senderName ? notif.senderName.charAt(0).toUpperCase() : 'U'}
                            </div>
                          )}
                          <div className="flex-1 space-y-0.5 min-w-0">
                            <p className="leading-snug">
                              <span className="font-bold text-cyan-400">{notif.senderName}</span> membalas komentar Anda di <span className="font-extrabold text-pink-400">{notif.animeTitle} - {notif.episodeTitle}</span>
                            </p>
                            <p className="italic opacity-80 text-[10px] line-clamp-2 bg-black/20 p-1.5 rounded">
                              "{notif.contentSnippet}"
                            </p>
                            <span className="text-[9px] opacity-40 block">
                              {notif.createdAt ? new Date(notif.createdAt).toLocaleDateString('id-ID', { hour: '2-digit', minute: '2-digit' }) : ''}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Theme switcher toggle */}
            <button
              onClick={() => {
                const nextTheme = isDark ? 'light' : 'dark'
                setTheme(nextTheme)
                localStorage.setItem('shindora-theme', nextTheme)
              }}
              className={`px-3 py-1 text-xs font-bold rounded-lg border transition-all ${
                isDark 
                  ? 'border-slate-800 bg-[#121324] hover:bg-slate-800 text-yellow-400' 
                  : 'border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-700 shadow-sm'
              }`}
            >
              {isDark ? '☀️ Terang' : '🌙 Gelap'}
            </button>
            
            {/* Cross-navigation button for Admin */}
            {currentUser && currentUser.role === 'admin' && (
              <Link
                href="/admin"
                className="px-2.5 py-1 rounded-lg text-[10px] font-black bg-pink-500/20 text-pink-600 dark:text-pink-400 border border-pink-500/30 hover:bg-pink-500/30 transition-all uppercase flex items-center gap-1"
                title="Menuju Panel Admin Utama"
              >
                ⚙️ PANEL ADMIN
              </Link>
            )}

            <span className="hidden sm:inline-block px-2.5 py-1 rounded-lg text-[10px] font-black bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30">MODE STAF</span>
          </div>
        </div>
      </header>

      {/* CORE MODERATION WORKSPACE */}
      <main className="max-w-7xl mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6 flex-1 w-full">
        
        {/* Banner info */}
        <div className={`p-3.5 sm:p-4 rounded-xl border flex items-start gap-3 ${
          isDark ? 'border-cyan-500/20 bg-cyan-500/5' : 'border-cyan-200 bg-cyan-50/50'
        }`}>
          <AlertTriangle className="w-5 h-5 text-cyan-500 flex-shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <h3 className="font-extrabold text-xs sm:text-sm">Panduan Moderasi Opini Retro</h3>
            <p className={`text-[11px] sm:text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Halaman ini memantau seluruh komentar/balasan. Menghapus komentar induk (parent) akan <strong>otomatis menghapus seluruh rantai balasannya</strong>.
            </p>
          </div>
        </div>

        {/* SEARCH AND FILTERS BAR */}
        <div className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 p-3 sm:p-4 rounded-xl border ${
          isDark ? 'bg-[#0d0e1b] border-[#1e2038]' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <div className="relative">
            <Search className={`absolute left-3 top-2.5 w-3.5 h-3.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
            <input
              type="text"
              placeholder="Cari isi komentar atau nama user..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full text-xs pl-8 pr-3 py-2 rounded-lg outline-none transition-all border ${
                isDark 
                  ? 'bg-[#121324] border-[#1e2038] text-white placeholder-slate-500 focus:border-cyan-500' 
                  : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-cyan-600'
              }`}
            />
          </div>

          <div className="relative flex items-center">
            <Filter className={`absolute left-3 top-2.5 w-3.5 h-3.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
            <select
              value={episodeFilter}
              onChange={(e) => setEpisodeFilter(e.target.value)}
              className={`w-full text-xs pl-8 pr-3 py-2 rounded-lg outline-none font-bold border ${
                isDark 
                  ? 'bg-[#121324] border-[#1e2038] text-white focus:border-cyan-500' 
                  : 'bg-white border-slate-300 text-slate-900 focus:border-cyan-600'
              }`}
            >
              <option value="ALL">Semua Video Episode</option>
              {videos.map(video => (
                <option key={video.id} value={video.id}>{video.animeTitle} - {video.episode} ({video.title})</option>
              ))}
            </select>
          </div>

          <div className={`text-right flex items-center justify-between sm:justify-end text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            <span>Total Komentar:</span>
            <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 ml-2">{filteredComments.length}</span>
          </div>
        </div>

        {/* DATA CONTAINER (RESPONSIVE CARD VIEW FOR MOBILE & TABLE VIEW FOR DESKTOP) */}
        
        {/* MOBILE CARD VIEW (< md breakpoint) */}
        <div className="block md:hidden space-y-3">
          {filteredComments.length === 0 ? (
            <div className={`p-6 text-center text-xs italic rounded-xl border ${isDark ? 'bg-[#0d0e1b] border-[#1e2038] text-slate-500' : 'bg-white border-slate-200 text-slate-400'}`}>
              Komentar tidak ditemukan atau database kosong.
            </div>
          ) : (
            filteredComments.map((comment) => {
              const targetVid = videos.find(v => v.id === comment.videoId)
              const commentId = comment.id || comment._id

              return (
                <div 
                  key={commentId}
                  className={`p-3.5 rounded-xl border space-y-3 ${isDark ? 'bg-[#0d0e1b] border-[#1e2038]' : 'bg-white border-slate-200 shadow-sm'}`}
                >
                  <div className="flex items-center justify-between border-b border-slate-500/10 pb-2">
                    <div className="flex items-center gap-2">
                      <img 
                        src={comment.userAvatar || comment.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=80'} 
                        alt="" 
                        className="w-7 h-7 rounded-full object-cover flex-shrink-0"
                      />
                      <div>
                        <p className={`font-extrabold text-xs ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{comment.userName || 'Anonim'}</p>
                        <span className="text-[9px] font-mono text-cyan-600 dark:text-cyan-400 font-semibold block">
                          {targetVid ? `${targetVid.animeTitle} - ${targetVid.episode}` : comment.videoId}
                        </span>
                      </div>
                    </div>

                    {comment.parentId ? (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-pink-500/10 text-pink-600 dark:text-pink-400 border border-pink-500/20">REPLY</span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">PARENT</span>
                    )}
                  </div>

                  <div className={`p-2.5 rounded-lg border text-xs leading-relaxed ${isDark ? 'bg-[#121324] border-[#1e2038] text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-800'}`}>
                    {comment.content || comment.text}
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className={`text-[9px] font-mono ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                      {comment.createdAt ? new Date(comment.createdAt).toLocaleDateString() : 'Baru saja'}
                    </span>

                    <button
                      onClick={() => handleDeleteComment(commentId)}
                      className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-600 dark:text-red-400 font-extrabold text-[11px] rounded-lg flex items-center gap-1.5 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Hapus</span>
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* DESKTOP TABLE VIEW (>= md breakpoint) */}
        <div className={`hidden md:block rounded-xl border overflow-hidden ${
          isDark ? 'bg-[#0d0e1b] border-[#1e2038]' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <table className="w-full text-xs text-left">
            <thead className={`text-[10px] uppercase font-bold tracking-wider border-b ${
              isDark ? 'bg-[#121324] border-[#1e2038] text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-600'
            }`}>
              <tr>
                <th className="p-3">Pengirim</th>
                <th className="p-3">Episode Target</th>
                <th className="p-3">Isi Komentar / Pesan</th>
                <th className="p-3 text-center">Tipe</th>
                <th className="p-3 text-right">Aksi Hapus</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-[#1e2038]' : 'divide-slate-200'}`}>
              {filteredComments.length === 0 ? (
                <tr>
                  <td colSpan="5" className={`p-8 text-center italic ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    Komentar tidak ditemukan atau database kosong.
                  </td>
                </tr>
              ) : (
                filteredComments.map((comment) => {
                  const targetVid = videos.find(v => v.id === comment.videoId)
                  const commentId = comment.id || comment._id

                  return (
                    <tr key={commentId} className="hover:bg-slate-500/5 transition-all">
                      <td className="p-3 flex items-center gap-2">
                        <img 
                          src={comment.userAvatar || comment.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=80'} 
                          alt="" 
                          className="w-7 h-7 rounded-full object-cover flex-shrink-0" 
                        />
                        <div>
                          <p className={`font-extrabold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{comment.userName || 'Anonim'}</p>
                          <span className={`text-[9px] font-mono ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{comment.userId || commentId}</span>
                        </div>
                      </td>
                      <td className="p-3 font-semibold text-cyan-600 dark:text-cyan-400">
                        {targetVid ? `${targetVid.animeTitle} - ${targetVid.episode}` : comment.videoId}
                      </td>
                      <td className="p-3 max-w-sm">
                        <p className={`leading-relaxed ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{comment.content || comment.text}</p>
                        <span className={`text-[9px] mt-1 block ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                          Diposting: {comment.createdAt ? new Date(comment.createdAt).toLocaleString() : 'Baru saja'}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        {comment.parentId ? (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-pink-500/10 text-pink-600 dark:text-pink-400 border border-pink-500/20">REPLY</span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">PARENT</span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => handleDeleteComment(commentId)}
                          className="p-1.5 text-red-500 hover:bg-red-500/10 border border-red-500/20 hover:border-red-500/50 rounded-lg transition-all"
                          title="Hapus Komentar beserta Rantai Balasannya secara Rekursif"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

      </main>

      <footer className={`border-t py-4 text-center text-xs mt-8 ${
        isDark ? 'border-[#1e2038] bg-[#090a12] text-slate-500' : 'border-slate-200 bg-white text-slate-500 shadow-inner'
      }`}>
        <p>&copy; ShinDora Nesub Moderator Dashboard.</p>
      </footer>

    </div>
  )
}
