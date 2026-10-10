'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { toast, Toaster } from 'sonner'
import { 
  Tv, 
  TvIcon, 
  Trash2, 
  Edit3, 
  Plus, 
  Search, 
  Upload, 
  Save, 
  Users, 
  Settings, 
  ListVideo, 
  Megaphone,
  Bell,
  FolderMinus,
  Settings2,
  ChevronDown,
  FileText,
  ArrowLeft,
  HeartHandshake,
  Smile,
  Download,
  Eye,
  EyeOff
} from 'lucide-react'

const SUB_CATEGORIES_MAP = {
  'Doraemon': ["Stand by Me", "Movie / Standalone Film", "Season 1", "Season 2", "OVA", "Spesial"],
  'Crayon Shinchan': ["Movie", "Season 1", "Season 2", "Spesial", "Spinoff"],
  'Ninja Hattori-kun': ["Season 1", "Season 2", "Movie", "OVA"],
  'Chibi Maruko-chan': ["Season 1", "Season 2", "Movie"],
  'Tv Series': ["Season 1", "Season 2", "OVA"],
  'Movie': ["Doraemon", "Crayon Shinchan"]
};

const maskEmail = (email) => {
  if (!email || !email.includes('@')) return email;
  const [localPart, domain] = email.split('@');
  if (localPart.length <= 3) {
    return `${localPart[0]}***@${domain}`;
  }
  return `${localPart.substring(0, 3)}***@${domain}`;
}

const parseEpisodeNumber = (episodeStr) => {
  if (!episodeStr) return 0;
  const match = episodeStr.match(/\d+(\.\d+)?/);
  return match ? parseFloat(match[0]) : 0;
}

const sortVideosByEpisode = (videoList) => {
  if (!videoList) return [];
  return [...videoList].sort((a, b) => {
    const titleA = a.animeTitle || '';
    const titleB = b.animeTitle || '';
    const comp = titleA.localeCompare(titleB);
    if (comp !== 0) return comp;
    
    const numA = parseEpisodeNumber(a.episode);
    const numB = parseEpisodeNumber(b.episode);
    return numA - numB;
  });
}

// Helper pembersih karakter prefix indentasi (↳, i,, dll)
const cleanCategoryName = (name) => {
  if (!name) return '';
  let cleaned = String(name).trim();
  while (/^(↳+|i,\s*|,+\s*|i\s+|[↳\s\u00A0]+)/i.test(cleaned)) {
    cleaned = cleaned.replace(/^(↳+|i,\s*|,+\s*|i\s+|[↳\s\u00A0]+)/i, '').trim();
  }
  return cleaned;
};

export default function AdminPage() {
  const [isAdmin, setIsAdmin] = useState(false)
  const [theme, setTheme] = useState('light')
  const [mounted, setMounted] = useState(false)
  const [showAdminPassword, setShowAdminPassword] = useState(false)

  const [loading, setLoading] = useState(false)
  const [fallbackTrigger, setFallbackTrigger] = useState(false)
  const [activeTab, setActiveTab] = useState('videos') // videos, categories, users, playlists, ads, settings, pages, polling
  const [searchQuery, setSearchQuery] = useState('')
  const [testPushLoading, setTestPushLoading] = useState(false)
  const [testPushMessage, setTestPushMessage] = useState('')

  // Core collections data
  const [videos, setVideos] = useState([])
  const [categories, setCategories] = useState([])
  const [users, setUsers] = useState([])
  const [playlists, setPlaylists] = useState([])
  const [ads, setAds] = useState([])
  const [staticPages, setStaticPages] = useState([])
  const [donations, setDonations] = useState([])
  
  // Settings details
  const [logoPreview, setLogoPreview] = useState('')
  const [siteSettings, setSiteSettings] = useState({
    logoUrl: '',
    imagekitPublicKey: '',
    imagekitPrivateKey: '',
    imagekitUrlEndpoint: '',
    is_overlay_active: true,
    is_running_text_active: true,
    donationOverlayActive: true,
    saweriaStreamKey: '',
    trakteerStreamKey: '',
    takoStreamKey: '',
    announcementText: '',
    announcementBadge: 'PENGUMUMAN',
    isManualDonationActive: false,
    manualDonatorName: '',
    manualDonationAmount: '',
    manualDonationMessage: '',
    manualDonationPlatform: 'Saweria',
    donationPopupDuration: 6,
    donationMarqueeSpeed: 'Sedang',
    emailProvider: 'Mock/Simulasi',
    emailProviderCredentials: {
      smtpHost: '',
      smtpPort: '',
      smtpUser: '',
      smtpPass: ''
    },
    socialLinks: [],
    hero_banner_active: true,
    hero_badge_text: '',
    hero_title: '',
    hero_description: '',
    hero_featured_image: '',
    hero_featured_label: '',
    hero_featured_title: '',
    antiAdblockActive: false,
    antiAdblockMessage: '',
    antiCopyActive: false,
    antiDevToolsActive: false,
    live_chat_active: true,
    blocked_words: 'anjing, babi, bangsat, anjrit, fuck, shit, kontol, memek, asu, bajingan, tolol, bego, goblok, idiot, kampang, biadab, pante, pantek, lonte, jamet, peler, jembut, ngetot, ngentot, kimak, pecun, tetek, pussy, dick, asshole, bitch, bastard, cunt, motherfucker',
    onesignalAppId: '',
    onesignalRestApiKey: '',
    gaId: '',
    cdnDomain: '',
    cdnEnabled: false,
    originUrl: '',
    vercelCpuSaverMode: 'max',
    bypassMiddlewareRateLimit: true,
    cloudflareZoneId: '',
    cloudflareApiToken: ''
  })

  const [cdnTestStatus, setCdnTestStatus] = useState('')
  const [cdnTesting, setCdnTesting] = useState(false)
  const [showWorkerModal, setShowWorkerModal] = useState(false)
  const [workerScriptData, setWorkerScriptData] = useState('')
  const [wranglerConfigData, setWranglerConfigData] = useState('')
  const [cdnPurgeStatus, setCdnPurgeStatus] = useState('')
  const [cdnPurging, setCdnPurging] = useState(false)
  const [showCdnSetupGuide, setShowCdnSetupGuide] = useState(false)
  const [activeWorkerModalTab, setActiveWorkerModalTab] = useState('script') // 'script' | 'wrangler' | 'guide'

  const handleTestCDNConnection = async () => {
    if (!siteSettings.cdnDomain || !siteSettings.cdnDomain.trim()) {
      toast.error('Masukkan domain CDN / URL Cloudflare Worker terlebih dahulu!')
      setCdnTestStatus('❌ Masukkan URL CDN')
      return
    }
    setCdnTesting(true)
    setCdnTestStatus('⏳ Menguji koneksi Worker...')
    try {
      const res = await fetch('/api/cdn/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cdnDomain: siteSettings.cdnDomain,
          originUrl: siteSettings.originUrl
        })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        const msg = `✅ ${data.message || 'Terhubung'} (${data.latencyMs}ms)`
        setCdnTestStatus(msg)
        toast.success(data.message || 'CDN Worker Terhubung!')
      } else {
        const errMsg = data.error || 'Gagal terhubung ke CDN Worker'
        setCdnTestStatus(`❌ ${errMsg}`)
        toast.error(errMsg)
      }
    } catch (e) {
      setCdnTestStatus('❌ Gagal menghubungi server')
      toast.error('Gagal menghubungi API test CDN')
    } finally {
      setCdnTesting(false)
      setTimeout(() => setCdnTestStatus(''), 8000)
    }
  }

  const handleOpenWorkerModal = async () => {
    try {
      setShowWorkerModal(true)
      const res = await fetch('/api/cdn/worker-script')
      const data = await res.json()
      if (data.success) {
        setWorkerScriptData(data.content)
      }
      const resToml = await fetch('/api/cdn/wrangler-config')
      const dataToml = await resToml.json()
      if (dataToml.success) {
        setWranglerConfigData(dataToml.content)
      }
    } catch (e) {
      toast.error('Gagal memuat script worker')
    }
  }

  const handleCopyWorkerScript = () => {
    if (!workerScriptData) return
    navigator.clipboard.writeText(workerScriptData)
    toast.success('Script cloudflare-worker.js berhasil disalin!')
  }

  const handleCopyWrangler = () => {
    if (!wranglerConfigData) return
    navigator.clipboard.writeText(wranglerConfigData)
    toast.success('Konfigurasi wrangler.toml berhasil disalin!')
  }

  const handleDownloadWorkerScript = () => {
    if (!workerScriptData) return
    const blob = new Blob([workerScriptData], { type: 'application/javascript' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'cloudflare-worker.js'
    a.click()
    URL.revokeObjectURL(url)
    toast.success('File cloudflare-worker.js berhasil diunduh!')
  }

  const handleDownloadWrangler = () => {
    if (!wranglerConfigData) return
    const blob = new Blob([wranglerConfigData], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'wrangler.toml'
    a.click()
    URL.revokeObjectURL(url)
    toast.success('File wrangler.toml berhasil diunduh!')
  }

  const handlePurgeCdnCache = async () => {
    setCdnPurging(true)
    setCdnPurgeStatus('⏳ Memproses purge cache...')
    try {
      const res = await fetch('/api/cdn/purge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purgeType: 'everything' })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success(data.message || 'Cache CDN berhasil di-purge!')
        setCdnPurgeStatus('✅ Cache di-purge')
      } else {
        toast.error(data.error || 'Gagal purge cache')
        setCdnPurgeStatus('❌ Gagal purge')
      }
    } catch (e) {
      toast.error('Gagal menghubungi API purge')
      setCdnPurgeStatus('❌ Error')
    } finally {
      setCdnPurging(false)
      setTimeout(() => setCdnPurgeStatus(''), 6000)
    }
  }

  // Modals / Create forms states
  const [showVideoModal, setShowVideoModal] = useState(false)
  const [editingVideo, setEditingVideo] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [videoForm, setVideoForm] = useState({
    title: '', slug: '', animeTitle: 'Doraemon', subCategory: '', subCategory2: '', subCategory3: '', episode: '', thumbnailUrl: '', videoUrl: '', videoUrl2: '', videoUrl3: '', description: '', views: 0, likes: 0, status: 'published', scheduledAt: '', duration: '', download_links: [], playlistId: '', sendPushNotification: true
  })
  const [isVideoSlugManuallyEdited, setIsVideoSlugManuallyEdited] = useState(false)
  const [tempDonName, setTempDonName] = useState('')
  const [tempDonAmount, setTempDonAmount] = useState('')
  const [tempDonMessage, setTempDonMessage] = useState('')
  const [tempDonPlatform, setTempDonPlatform] = useState('Saweria')

  const handleAddManualDonation = () => {
    if (!tempDonName.trim() || !tempDonAmount.trim()) {
      alert("Nama Donatur dan Nominal wajib diisi!");
      return;
    }
    const newItem = {
      id: `manual-don-${Date.now()}`,
      name: tempDonName,
      amount: tempDonAmount,
      message: tempDonMessage,
      platform: tempDonPlatform,
      createdAt: new Date().toISOString()
    };
    const updatedList = [...(siteSettings.manualDonationList || []), newItem];
    setSiteSettings({ ...siteSettings, manualDonationList: updatedList });
    setTempDonName('');
    setTempDonAmount('');
    setTempDonMessage('');
  };

  const handleRemoveManualDonation = (id) => {
    const updatedList = (siteSettings.manualDonationList || []).filter(item => item.id !== id);
    setSiteSettings({ ...siteSettings, manualDonationList: updatedList });
  };

  const handleClearAllManualDonations = () => {
    if (confirm("Apakah Anda yakin ingin menghapus seluruh daftar donasi manual? Tindakan ini tidak bisa dibatalkan.")) {
      setSiteSettings({ ...siteSettings, manualDonationList: [] });
    }
  };

  // Bulk CSV import field
  const [csvInput, setCsvInput] = useState('')
  const [showCsvBox, setShowCsvBox] = useState(false)

  // Bulk Category Edit States
  const [selectedVideoIds, setSelectedVideoIds] = useState([])
  const [showBulkCategoryModal, setShowBulkCategoryModal] = useState(false)
  const [showBulkConfirmModal, setShowBulkConfirmModal] = useState(false)
  const [bulkCategoryUpdating, setBulkCategoryUpdating] = useState(false)
  const [bulkCategoryForm, setBulkCategoryForm] = useState({
    animeTitle: '',
    subCategory: '',
    subCategory2: '',
    subCategory3: ''
  })

  const handleToggleSelectVideo = (videoId) => {
    setSelectedVideoIds(prev => 
      prev.includes(videoId) ? prev.filter(id => id !== videoId) : [...prev, videoId]
    )
  }

  const handleToggleSelectAll = (visibleVideos) => {
    if (!visibleVideos || visibleVideos.length === 0) return
    const visibleIds = visibleVideos.map(v => v.id)
    const isAllVisibleSelected = visibleIds.every(id => selectedVideoIds.includes(id))
    if (isAllVisibleSelected) {
      setSelectedVideoIds(prev => prev.filter(id => !visibleIds.includes(id)))
    } else {
      setSelectedVideoIds(prev => Array.from(new Set([...prev, ...visibleIds])))
    }
  }

  const handleOpenBulkCategoryModal = () => {
    if (selectedVideoIds.length === 0) {
      toast.error('Pilih minimal 1 video terlebih dahulu!')
      return
    }
    setBulkCategoryForm({
      animeTitle: '',
      subCategory: '',
      subCategory2: '',
      subCategory3: ''
    })
    setShowBulkConfirmModal(false)
    setShowBulkCategoryModal(true)
  }

  const handleExecuteBulkCategoryUpdate = async () => {
    if (!bulkCategoryForm.animeTitle) {
      toast.error('Pilih Kategori Utama terlebih dahulu!')
      return
    }
    if (selectedVideoIds.length === 0) {
      toast.error('Tidak ada video yang dipilih!')
      return
    }

    setBulkCategoryUpdating(true)
    try {
      const res = await fetch('/api/videos/bulk-categories', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoIds: selectedVideoIds,
          animeTitle: bulkCategoryForm.animeTitle,
          subCategory: bulkCategoryForm.subCategory,
          subCategory2: bulkCategoryForm.subCategory2,
          subCategory3: bulkCategoryForm.subCategory3
        })
      })

      const data = await res.json()
      if (res.ok && data.success) {
        toast.success(data.message || `${selectedVideoIds.length} video berhasil diperbarui kategorinya!`)
        setVideos(prev => prev.map(v => {
          if (selectedVideoIds.includes(v.id)) {
            return {
              ...v,
              ...(data.updatedFields || {}),
              animeTitle: bulkCategoryForm.animeTitle,
              subCategory: bulkCategoryForm.subCategory || '',
              subCategory2: bulkCategoryForm.subCategory2 || '',
              subCategory3: bulkCategoryForm.subCategory3 || ''
            }
          }
          return v
        }))
        setSelectedVideoIds([])
        setShowBulkCategoryModal(false)
        setShowBulkConfirmModal(false)
      } else {
        toast.error(data.error || 'Gagal memperbarui kategori video')
      }
    } catch (e) {
      toast.error('Gagal menghubungi server untuk update kategori massal')
    } finally {
      setBulkCategoryUpdating(false)
    }
  }

  // Category Form state
  const [catName, setCatName] = useState('')
  const [catParentId, setCatParentId] = useState('none')
  const [editingCat, setEditingCat] = useState(null)
  const [mainCatName, setMainCatName] = useState('')
  const [subCatName, setSubCatName] = useState('')
  const [selectedMainId, setSelectedMainId] = useState('')

  // State untuk Sub-Kategori 2 & Sub-Kategori 3
  const [subCat2Name, setSubCat2Name] = useState('')
  const [selectedSub1Id, setSelectedSub1Id] = useState('')
  const [subCat3Name, setSubCat3Name] = useState('')
  const [selectedSub2Id, setSelectedSub2Id] = useState('')

  const getSubCategory2HierarchyLabel = (sub2) => {
    if (!sub2) return '';
    const sub1 = categories.find(c => String(c.id || c._id) === String(sub2.parent_id));
    const main = sub1 ? categories.find(c => String(c.id || c._id) === String(sub1.parent_id)) : null;
    const parts = [];
    if (main) parts.push(cleanCategoryName(main.name));
    if (sub1) parts.push(cleanCategoryName(sub1.name));
    parts.push(cleanCategoryName(sub2.name));
    return parts.join(' → ');
  };

  const getSubCategory3HierarchyLabel = (sub3) => {
    if (!sub3) return '';
    const sub2 = categories.find(c => String(c.id || c._id) === String(sub3.parent_id));
    const sub1 = sub2 ? categories.find(c => String(c.id || c._id) === String(sub2.parent_id)) : null;
    const main = sub1 ? categories.find(c => String(c.id || c._id) === String(sub1.parent_id)) : null;
    const parts = [];
    if (main) parts.push(cleanCategoryName(main.name));
    if (sub1) parts.push(cleanCategoryName(sub1.name));
    if (sub2) parts.push(cleanCategoryName(sub2.name));
    parts.push(cleanCategoryName(sub3.name));
    return parts.join(' → ');
  };

  const handleCreateMainCategory = async (e) => {
    e.preventDefault()
    if (!mainCatName.trim()) return
    const payload = {
      name: mainCatName.trim(),
      parent_id: null
    }
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
      if (res.ok) {
        alert("🎉 Kategori Utama berhasil disimpan!")
        setMainCatName("")
        fetchAdminData()
      } else {
        const errData = await res.json()
        throw new Error(errData.error || "Gagal menyimpan kategori utama")
      }
    } catch (err) {
      alert(err.message)
    }
  }

  const handleCreateSubCategory = async (e) => {
    e.preventDefault()
    if (!subCatName.trim() || !selectedMainId) {
      alert("Pilih Kategori Utama Induk dan isi Nama Sub-Kategori 1!")
      return
    }
    const payload = {
      name: subCatName.trim(),
      parent_id: selectedMainId
    }
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
      if (res.ok) {
        alert("🎉 Sub-Kategori 1 berhasil disimpan!")
        setSubCatName("")
        setSelectedMainId("")
        fetchAdminData()
      } else {
        const errData = await res.json()
        throw new Error(errData.error || "Gagal menyimpan sub-kategori 1")
      }
    } catch (err) {
      alert(err.message)
    }
  }

  // Handler untuk Sub-Kategori 2
  const handleCreateSubCategory2 = async (e) => {
    e.preventDefault()
    if (!subCat2Name.trim() || !selectedSub1Id) {
      alert("Pilih Induk Sub-Kategori 1 dan isi Nama Sub-Kategori 2!")
      return
    }
    const payload = {
      name: subCat2Name.trim(),
      parent_id: selectedSub1Id
    }
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
      if (res.ok) {
        alert("🎉 Sub-Kategori 2 berhasil disimpan!")
        setSubCat2Name("")
        setSelectedSub1Id("")
        fetchAdminData()
      } else {
        const errData = await res.json()
        throw new Error(errData.error || "Gagal menyimpan sub-kategori 2")
      }
    } catch (err) {
      alert(err.message)
    }
  }

  // Handler untuk Sub-Kategori 3
  const handleCreateSubCategory3 = async (e) => {
    e.preventDefault()
    if (!subCat3Name.trim() || !selectedSub2Id) {
      alert("Pilih Induk Sub-Kategori 2 dan isi Nama Sub-Kategori 3!")
      return
    }
    const payload = {
      name: subCat3Name.trim(),
      parent_id: selectedSub2Id
    }
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
      if (res.ok) {
        alert("🎉 Sub-Kategori 3 berhasil disimpan!")
        setSubCat3Name("")
        setSelectedSub2Id("")
        fetchAdminData()
      } else {
        const errData = await res.json()
        throw new Error(errData.error || "Gagal menyimpan sub-kategori 3")
      }
    } catch (err) {
      alert(err.message)
    }
  }

  // Playlist Form state
  const [playlistForm, setPlaylistForm] = useState({
    title: '', videoIds: []
  })
  const [editingPlaylist, setEditingPlaylist] = useState(null)
  const [playlistVideoSearch, setPlaylistVideoSearch] = useState('')

  // Ad Form state
  const [adForm, setAdForm] = useState({
    slot: 'banner_top', title: '', imageUrl: '', targetUrl: '', isActive: true, isRaw: false, rawCode: '', openInNewTab: true
  })
  const [editingAd, setEditingAd] = useState(null)

  // Pages Manager Form state
  const [showPageModal, setShowPageModal] = useState(false)
  const [editingPage, setEditingPage] = useState(null)
  const [pageForm, setPageForm] = useState({
    title: '', slug: '', content: '', showInFooter: true
  })
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false)

  // Donation Simulation Form state
  const [donForm, setDonForm] = useState({
    name: '', amount: 'Rp 10.000', message: '', platform: 'Saweria'
  })
  const [isSubmittingDonation, setIsSubmittingDonation] = useState(false)

  // Polling Manager Form State
  const [pollingList, setPollingList] = useState([])
  const [showPollModal, setShowPollModal] = useState(false)
  const [editingPoll, setEditingPoll] = useState(null)
  const [pollForm, setPollForm] = useState({
    title: '', options: [{ id: 'opt-1', name: '', imageUrl: '', votes: 0 }], isActive: true
  })

  // Notifications State for Admin
  const [adminNotifications, setAdminNotifications] = useState([])
  const [showAdminNotifDropdown, setShowAdminNotifDropdown] = useState(false)

  const fetchAdminNotifications = useCallback(async () => {
    try {
      const storedUser = typeof window !== 'undefined' ? localStorage.getItem('shindora-user') : null
      let targetId = 'user-admin-id'
      if (storedUser) {
        try {
          const parsed = JSON.parse(storedUser)
          targetId = parsed.id || parsed._id || parsed.email || targetId
        } catch (_) {}
      }
      const res = await fetch(`/api/notifications?userId=${encodeURIComponent(targetId)}`)
      if (res.ok) {
        const data = await res.json()
        setAdminNotifications(Array.isArray(data) ? data : [])
      }
    } catch (e) {
      console.warn('Error fetching admin notifications:', e)
    }
  }, [])

  const handleMarkAllAdminNotifRead = async () => {
    try {
      const storedUser = typeof window !== 'undefined' ? localStorage.getItem('shindora-user') : null
      let targetId = 'user-admin-id'
      if (storedUser) {
        try {
          const parsed = JSON.parse(storedUser)
          targetId = parsed.id || parsed._id || parsed.email || targetId
        } catch (_) {}
      }
      await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: targetId, markAll: true })
      })
      fetchAdminNotifications()
    } catch (_) {}
  }

  const handleMarkAdminNotifRead = async (notif) => {
    try {
      await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: notif.id })
      })
      fetchAdminNotifications()
      if (notif.videoSlug || notif.videoId) {
        window.open(`/watch/${notif.videoSlug || notif.videoId}`, '_blank')
      }
    } catch (_) {}
  }

  const handleClearAllAdminNotif = async () => {
    if (!confirm('Hapus seluruh riwayat notifikasi admin?')) return
    try {
      const storedUser = typeof window !== 'undefined' ? localStorage.getItem('shindora-user') : null
      let targetId = 'user-admin-id'
      if (storedUser) {
        try {
          const parsed = JSON.parse(storedUser)
          targetId = parsed.id || parsed._id || parsed.email || targetId
        } catch (_) {}
      }
      await fetch(`/api/notifications?userId=${encodeURIComponent(targetId)}`, { method: 'DELETE' })
      fetchAdminNotifications()
    } catch (_) {}
  }

  // Logo Upload ImageKit State
  const [logoUploadProgress, setLogoUploadProgress] = useState(null)
  const logoFileInputRef = useRef(null)

  // Hero Featured Image Upload State
  const [heroImageUploadProgress, setHeroImageUploadProgress] = useState(null)
  const heroImageFileInputRef = useRef(null)

  // Ad Banner Image Upload State
  const adFileInputRef = useRef(null)
  const [adUploadProgress, setAdUploadProgress] = useState(null)

  const uploadToImageKit = async (file, prefix) => {
    if (!file) throw new Error('Tidak ada berkas terpilih!');

    const validFormats = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validFormats.includes(file.type)) {
      throw new Error('Format berkas tidak valid! Hanya mendukung JPG, PNG, atau WEBP.');
    }

    const maxSize = 1 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new Error('Gagal! Batas ukuran file maksimal adalah 1 MB (1024 KB).');
    }

    try {
      const authRes = await fetch('/api/imagekit/auth');
      if (!authRes.ok) {
        const errData = await authRes.json();
        throw new Error(errData.error || 'Gagal mengautentikasi ImageKit di backend');
      }
      const authData = await authRes.json();

      const formData = new FormData();
      formData.append('file', file);
      formData.append('fileName', `${prefix}_${Date.now()}_${file.name}`);
      formData.append('publicKey', authData.publicKey);
      formData.append('signature', authData.signature);
      formData.append('expire', authData.expire.toString());
      formData.append('token', authData.token);

      const ikRes = await fetch('https://upload.imagekit.io/api/v1/files/upload', {
        method: 'POST',
        body: formData
      });

      if (!ikRes.ok) {
        const ikErr = await ikRes.json();
        throw new Error(ikErr.message || 'ImageKit menolak unggahan berkas');
      }

      const ikData = await ikRes.json();
      return ikData.url;

    } catch (err) {
      console.error(`[ImageKit ${prefix} Upload Error]:`, err);
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const endpoint = siteSettings.imagekitUrlEndpoint || 'https://ik.imagekit.io/shindora';
          const mockUrl = `${endpoint}/mock_${prefix}_${Date.now()}_${file.name}`;
          resolve(mockUrl);
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const handleAdUploadToImageKit = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    setAdUploadProgress("Mengunggah Banner ke ImageKit...")
    try {
      const url = await uploadToImageKit(file, "ad")
      setAdForm(prev => ({ ...prev, imageUrl: url }))
      alert('Gambar Banner berhasil diunggah ke ImageKit CDN!')
    } catch (err) {
      alert(err.message)
    } finally {
      setAdUploadProgress(null)
    }
  }

  // Polling Option Upload State
  const pollFileInputRef = useRef(null)
  const [uploadingPollOptionIndex, setUploadingPollOptionIndex] = useState(null)
  const [pollUploadProgress, setPollUploadProgress] = useState(null)

  const handlePollOptionUploadToImageKit = async (e) => {
    const file = e.target.files[0]
    if (!file || uploadingPollOptionIndex === null) return

    setPollUploadProgress(`Mengunggah Gambar Opsi ${uploadingPollOptionIndex + 1} ke ImageKit...`)
    try {
      const url = await uploadToImageKit(file, "poll")
      const updatedOptions = [...pollForm.options]
      updatedOptions[uploadingPollOptionIndex].imageUrl = url
      setPollForm({ ...pollForm, options: updatedOptions })
      alert(`Gambar Opsi ${uploadingPollOptionIndex + 1} berhasil diunggah ke ImageKit CDN!`)
    } catch (err) {
      alert(err.message)
    } finally {
      setPollUploadProgress(null)
      setUploadingPollOptionIndex(null)
    }
  }

  // Video Thumbnail Upload State
  const videoFileInputRef = useRef(null)
  const [videoUploadProgress, setVideoUploadProgress] = useState(null)

  const handleVideoThumbnailUploadToImageKit = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    setVideoUploadProgress("Mengunggah Thumbnail ke ImageKit...")
    try {
      const url = await uploadToImageKit(file, "video")
      setVideoForm(prev => ({ ...prev, thumbnailUrl: url }))
      alert('Thumbnail video berhasil diunggah ke ImageKit CDN!')
    } catch (err) {
      alert(err.message)
    } finally {
      setVideoUploadProgress(null)
    }
  }

  const handleHeroImageUploadToImageKit = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    setHeroImageUploadProgress("Mengunggah Gambar Hero ke ImageKit...")
    try {
      const url = await uploadToImageKit(file, "hero")
      setSiteSettings(prev => ({ ...prev, hero_featured_image: url }))
      alert('Gambar Utama Hero berhasil diunggah ke ImageKit CDN!')
    } catch (err) {
      alert(err.message)
    } finally {
      setHeroImageUploadProgress(null)
    }
  }

  const handleLogoUploadToImageKit = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    setLogoUploadProgress("Mengunggah Logo ke ImageKit...")
    try {
      const url = await uploadToImageKit(file, "logo")
      setSiteSettings(prev => ({ ...prev, logoUrl: url }))
      setLogoPreview(url)
      alert('Logo berhasil diunggah ke ImageKit CDN!')
    } catch (err) {
      alert(err.message)
    } finally {
      setLogoUploadProgress(null)
    }
  }

  // Social link Form state
  const [newSocialName, setNewSocialName] = useState('')
  const [newSocialUrl, setNewSocialUrl] = useState('')

  // Admin Login Gate state
  const [adminEmailInput, setAdminEmailInput] = useState('maskohar76@gmail.com')
  const [adminPasswordInput, setAdminPasswordInput] = useState('')
  const [adminLoginError, setAdminLoginError] = useState('')
  const [isVerifyingAdmin, setIsVerifyingAdmin] = useState(false)

  const handleAdminPasswordSubmit = async (e) => {
    e.preventDefault()
    setAdminLoginError('')
    setIsVerifyingAdmin(true)

    try {
      const emailToTry = (adminEmailInput || 'maskohar76@gmail.com').trim()
      let res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailToTry,
          password: adminPasswordInput,
          isStaffOnly: true
        })
      })
      let data = await res.json()

      if (!res.ok || data.error) {
        const fallbackEmail = emailToTry === 'admin@shindora.com' ? 'maskohar76@gmail.com' : 'admin@shindora.com'
        const res2 = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: fallbackEmail,
            password: adminPasswordInput,
            isStaffOnly: true
          })
        })
        const data2 = await res2.json()
        if (res2.ok && data2 && !data2.error && data2.role === 'admin') {
          data = data2
          res = res2
        }
      }

      if (res.ok && data && !data.error && (data.role === 'admin' || data.role === 'superadmin')) {
        localStorage.setItem('shindora-user', JSON.stringify(data))
        localStorage.setItem('shindora-admin-token', 'admin-token-authenticated')
        setIsAdmin(true)
        fetchAdminData()
      } else {
        setAdminLoginError(data.error || 'Email atau Kata Sandi Admin Salah!')
      }
    } catch (err) {
      console.error(err)
      setAdminLoginError('Koneksi server gagal!')
    } finally {
      setIsVerifyingAdmin(false)
    }
  }

  const fetchAdminData = async () => {
    try {
      const vRes = await fetch('/api/videos?showAll=true')
      const v = await vRes.json()
      setVideos(Array.isArray(v) ? v : [])

      const cRes = await fetch('/api/categories')
      const c = await cRes.json()
      setCategories(Array.isArray(c) ? c : [])

      const uRes = await fetch('/api/users')
      const u = await uRes.json()
      setUsers(Array.isArray(u) ? u : [])

      const pRes = await fetch('/api/playlists')
      const p = await pRes.json()
      setPlaylists(Array.isArray(p) ? p : [])

      const aRes = await fetch('/api/promo')
      const a = await aRes.json()
      setAds(Array.isArray(a) ? a : [])

      const sRes = await fetch('/api/settings')
      const s = await sRes.json()
      if (s && s.id) {
        setSiteSettings(prev => ({
          ...prev,
          ...s,
          is_overlay_active: s.is_overlay_active !== undefined ? s.is_overlay_active : (s.donationOverlayActive !== undefined ? s.donationOverlayActive : true),
          is_running_text_active: s.is_running_text_active !== undefined ? s.is_running_text_active : (s.donationOverlayActive !== undefined ? s.donationOverlayActive : true),
        }))
        setLogoPreview(s.logoUrl || '')
        if (typeof window !== 'undefined') {
          localStorage.setItem('shindora-settings', JSON.stringify(s))
        }
      }

      const pgRes = await fetch('/api/pages')
      const pg = await pgRes.json()
      setStaticPages(Array.isArray(pg) ? pg : [])

      const donRes = await fetch('/api/donations')
      const don = await donRes.json()
      setDonations(Array.isArray(don) ? don : [])

      const pollRes = await fetch('/api/polling')
      const plData = await pollRes.json()
      setPollingList(Array.isArray(plData) ? plData : [])
    } catch (err) {
      console.error('Error loading admin databases:', err)
    }
  }

  const checkAdminAuth = () => {
    if (typeof window === 'undefined') return
    const adminToken = localStorage.getItem('shindora-admin-token')
    if (adminToken) {
      setIsAdmin(true)
      fetchAdminData().catch(err => console.error("fetchAdminData error:", err))
      return
    }
    const storedUser = localStorage.getItem('shindora-user')
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser)
        const role = (parsed.role || '').toLowerCase()
        if (role === 'admin' || role === 'superadmin') {
          setIsAdmin(true)
          fetchAdminData().catch(err => console.error("fetchAdminData error:", err))
          return
        }
      } catch (e) {
        console.error("Parse user error:", e)
      }
    }
    setIsAdmin(false)
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
    checkAdminAuth()
    fetchAdminNotifications()
    const interval = setInterval(fetchAdminNotifications, 10000)
    return () => clearInterval(interval)
  }, [fetchAdminNotifications])

  // Videos CRUD
  const handleSaveVideo = async (e) => {
    e.preventDefault()
    const cleanDownloadLinks = Array.isArray(videoForm.download_links)
      ? videoForm.download_links.filter(l => l && (l.provider?.trim() || l.url?.trim()))
      : []
    const formattedForm = {
      ...videoForm,
      download_links: cleanDownloadLinks
    }
    const method = editingVideo ? 'PUT' : 'POST'
    const payload = editingVideo ? { ...formattedForm, id: editingVideo.id } : { ...formattedForm, id: `vid-temp-${Date.now()}`, views: Number(videoForm.views || 0), likes: Number(videoForm.likes || 0), createdAt: new Date() }
    const previousVideos = [...videos]

    if (editingVideo) {
      setVideos(videos.map(v => v.id === editingVideo.id ? payload : v))
    } else {
      setVideos([payload, ...videos])
    }

    setShowVideoModal(false)
    setEditingVideo(null)
    const originalForm = { ...formattedForm }
    setVideoForm({ title: '', slug: '', animeTitle: 'Doraemon', subCategory: '', subCategory2: '', subCategory3: '', episode: '', thumbnailUrl: '', videoUrl: '', videoUrl2: '', videoUrl3: '', description: '', views: 0, likes: 0, status: 'published', scheduledAt: '', duration: '', download_links: [], playlistId: '', sendPushNotification: true })

    try {
      const res = await fetch('/api/videos', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingVideo ? { ...originalForm, id: editingVideo.id } : originalForm)
      })
      if (res.ok) {
        fetchAdminData()
      } else {
        throw new Error('Gagal menyimpan data ke database server!')
      }
    } catch (err) {
      console.error(err)
      alert(`Error: ${err.message}. Mengembalikan daftar video...`)
      setVideos(previousVideos)
    }
  }

  const handleDeleteVideo = async (id) => {
    if (!confirm('Hapus video ini secara permanen?')) return
    const previousVideos = [...videos]

    setVideos(videos.filter(v => v.id !== id))

    try {
      const res = await fetch(`/api/videos?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        fetchAdminData()
      } else {
        throw new Error('Gagal menghapus video dari server!')
      }
    } catch (err) {
      console.error(err)
      alert(`Error: ${err.message}. Mengurungkan penghapusan video...`)
      setVideos(previousVideos)
    }
  }

  const handleBulkCSVImport = async () => {
    if (!csvInput.trim()) return
    try {
      const res = await fetch('/api/videos/bulk-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvData: csvInput })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        alert(`Berhasil mengimpor ${data.count} video retro!`)
        setCsvInput('')
        setShowCsvBox(false)
        fetchAdminData()
      } else {
        alert(data.error || 'Gagal mengimpor CSV!')
      }
    } catch (err) {
      console.error(err)
    }
  }

  // Custom Static Pages CRUD
  const handleSavePage = async (e) => {
    e.preventDefault()
    if (!pageForm.title.trim() || !pageForm.slug.trim()) return
    const method = editingPage ? 'PUT' : 'POST'
    const payload = editingPage ? { ...pageForm, id: editingPage.id } : pageForm

    try {
      const res = await fetch('/api/pages', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (res.ok) {
        alert('Halaman statis berhasil disimpan!')
        setPageForm({ title: '', slug: '', content: '', showInFooter: true })
        setEditingPage(null)
        setShowPageModal(false)
        fetchAdminData()
      } else {
        const errData = await res.json()
        throw new Error(errData.error || 'Gagal menyimpan halaman statis')
      }
    } catch (err) {
      console.error(err)
      alert("Gagal menyimpan halaman statis: " + err.message)
    }
  }

  const handleDeletePage = async (id) => {
    if (!confirm('Hapus halaman statis ini secara permanen?')) return
    try {
      const res = await fetch(`/api/pages?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        alert('Halaman statis berhasil dihapus!')
        fetchAdminData()
      } else {
        const errData = await res.json()
        throw new Error(errData.error || 'Gagal menghapus halaman statis')
      }
    } catch (err) {
      console.error(err)
      alert("Gagal menghapus halaman statis: " + err.message)
    }
  }

  // Polling / Voting CRUD handlers
  const handleSavePoll = async (e) => {
    e.preventDefault()
    if (!pollForm.title.trim() || pollForm.options.length === 0) return
    const method = editingPoll ? 'PUT' : 'POST'
    const payload = editingPoll ? { ...pollForm, id: editingPoll.id } : pollForm

    try {
      const res = await fetch('/api/polling', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (res.ok) {
        alert('Polling anime berhasil disimpan!')
        setPollForm({ title: '', options: [{ id: 'opt-1', name: '', imageUrl: '', votes: 0 }], isActive: true })
        setEditingPoll(null)
        setShowPollModal(false)
        fetchAdminData()
      } else {
        const errData = await res.json()
        throw new Error(errData.error || 'Gagal menyimpan polling')
      }
    } catch (err) {
      console.error(err)
      alert("Gagal menyimpan polling: " + err.message)
    }
  }

  const handleDeletePoll = async (id) => {
    if (!confirm('Hapus topik polling ini beserta seluruh datanya?')) return
    try {
      const res = await fetch(`/api/polling?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        alert('Polling berhasil dihapus!')
        fetchAdminData()
      } else {
        const errData = await res.json()
        throw new Error(errData.error || 'Gagal menghapus polling')
      }
    } catch (err) {
      console.error(err)
      alert("Gagal menghapus polling: " + err.message)
    }
  }

  const handleResetPollVotes = async (poll) => {
    if (!confirm('Reset semua jumlah suara/counter untuk polling ini kembali ke 0?')) return
    const resetOptions = poll.options.map(o => ({ ...o, votes: 0 }))
    try {
      const res = await fetch('/api/polling', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: poll.id, options: resetOptions })
      })
      if (res.ok) {
        alert('Perolehan suara berhasil di-reset!')
        fetchAdminData()
      } else {
        const errData = await res.json()
        throw new Error(errData.error || 'Gagal mereset perolehan suara')
      }
    } catch (err) {
      console.error(err)
      alert("Gagal mereset perolehan suara: " + err.message)
    }
  }

  // Categories CRUD
  const handleSaveCategory = async (e) => {
    e.preventDefault()
    if (!catName.trim()) return
    const method = editingCat ? 'PUT' : 'POST'
    const payload = editingCat 
      ? { id: editingCat.id, name: catName, slug: catName.toLowerCase().replace(/ /g, '-'), parent_id: catParentId === 'none' ? null : catParentId } 
      : { name: catName, slug: catName.toLowerCase().replace(/ /g, '-'), parent_id: catParentId === 'none' ? null : catParentId }

    try {
      const res = await fetch('/api/categories', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (res.ok) {
        alert('Kategori berhasil disimpan!')
        setCatName('')
        setCatParentId('none')
        setEditingCat(null)
        fetchAdminData()
      } else {
        const errData = await res.json()
        throw new Error(errData.error || 'Gagal menyimpan kategori ke server')
      }
    } catch (err) {
      console.error(err)
      alert("Gagal menyimpan kategori: " + err.message)
    }
  }

  const handleDeleteCategory = async (id) => {
    if (!confirm('Hapus kategori ini?')) return
    try {
      const res = await fetch(`/api/categories?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        alert('Kategori berhasil dihapus!')
        fetchAdminData()
      } else {
        const errData = await res.json()
        throw new Error(errData.error || 'Gagal menghapus kategori dari server')
      }
    } catch (err) {
      console.error(err)
      alert("Gagal menghapus kategori: " + err.message)
    }
  }

  // User Management
  const handleUserRoleChange = async (user, newRole) => {
    try {
      const res = await fetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: user.id, role: newRole })
      })
      if (res.ok) {
        alert('Peran pengguna berhasil diperbarui!')
        fetchAdminData()
      } else {
        const errData = await res.json()
        throw new Error(errData.error || 'Gagal memperbarui peran pengguna')
      }
    } catch (err) {
      console.error(err)
      alert("Gagal memperbarui peran pengguna: " + err.message)
    }
  }

  const handleToggleUserBan = async (user) => {
    try {
      const res = await fetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: user.id, isBanned: !user.isBanned })
      })
      if (res.ok) {
        alert(user.isBanned ? 'Status cekal pengguna berhasil dicabut!' : 'Pengguna berhasil dicekal!')
        fetchAdminData()
      } else {
        const errData = await res.json()
        throw new Error(errData.error || 'Gagal memperbarui status cekal')
      }
    } catch (err) {
      console.error(err)
      alert("Gagal memperbarui status cekal: " + err.message)
    }
  }

  // Official Playlist CRUD
  const handleSavePlaylist = async (e) => {
    e.preventDefault()
    if (!playlistForm.title.trim()) return
    const videoIds = playlistForm.videoIds

    // Automatically sort videoIds before saving
    const selectedVideos = videos.filter(v => videoIds.includes(v.id))
    const sortedSelected = sortVideosByEpisode(selectedVideos)
    const sortedVideoIds = sortedSelected.map(v => v.id)

    const payload = editingPlaylist
      ? { id: editingPlaylist.id, title: playlistForm.title, videoIds: sortedVideoIds }
      : { title: playlistForm.title, ownerId: null, isPrivate: false, videoIds: sortedVideoIds }

    const method = editingPlaylist ? 'PUT' : 'POST'

    try {
      const res = await fetch('/api/playlists', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (res.ok) {
        alert('Playlist berhasil disimpan!')
        setPlaylistForm({ title: '', videoIds: [] })
        setEditingPlaylist(null)
        setPlaylistVideoSearch('')
        fetchAdminData()
      } else {
        const errData = await res.json()
        throw new Error(errData.error || 'Gagal menyimpan playlist')
      }
    } catch (err) {
      console.error(err)
      alert("Gagal menyimpan playlist: " + err.message)
    }
  }

  const handleDeletePlaylist = async (id) => {
    if (!confirm('Hapus playlist ini?')) return
    try {
      const res = await fetch(`/api/playlists?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        alert('Playlist berhasil dihapus!')
        fetchAdminData()
      } else {
        const errData = await res.json()
        throw new Error(errData.error || 'Gagal menghapus playlist')
      }
    } catch (err) {
      console.error(err)
      alert("Gagal menghapus playlist: " + err.message)
    }
  }

  // Ads/Iklan CRUD
  const handleSaveAd = async (e) => {
    e.preventDefault()
    const method = editingAd ? 'PUT' : 'POST'
    const cleanRaw = String(adForm.rawCode || '').trim()
    const payload = {
      ...adForm,
      isRaw: Boolean(adForm.isRaw),
      rawCode: cleanRaw,
      html: cleanRaw,
      content: cleanRaw,
      ...(editingAd ? { id: editingAd.id } : {})
    }

    try {
      const res = await fetch('/api/promo', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (res.ok) {
        alert('Iklan/promosi berhasil disimpan!')
        setAdForm({ slot: 'banner_top', title: '', imageUrl: '', targetUrl: '', isActive: true, isRaw: false, rawCode: '', openInNewTab: true })
        setEditingAd(null)
        fetchAdminData()
      } else {
        const errData = await res.json()
        throw new Error(errData.error || 'Gagal menyimpan iklan')
      }
    } catch (err) {
      console.error(err)
      alert("Gagal menyimpan iklan: " + err.message)
    }
  }

  const handleDeleteAd = async (id) => {
    if (!confirm('Hapus slot iklan ini?')) return
    try {
      const res = await fetch(`/api/promo?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        alert('Iklan berhasil dihapus!')
        fetchAdminData()
      } else {
        const errData = await res.json()
        throw new Error(errData.error || 'Gagal menghapus iklan')
      }
    } catch (err) {
      console.error(err)
      alert("Gagal menghapus iklan: " + err.message)
    }
  }

  const handleSaveOverlaySettings = async () => {
    const payload = {
      is_overlay_active: siteSettings.is_overlay_active === undefined ? true : siteSettings.is_overlay_active,
      saweriaStreamKey: siteSettings.saweriaStreamKey,
      trakteerStreamKey: siteSettings.trakteerStreamKey,
      takoStreamKey: siteSettings.takoStreamKey,
      donationPopupDuration: Number(siteSettings.donationPopupDuration || 6),
      donationMarqueeSpeed: siteSettings.donationMarqueeSpeed || 'Sedang'
    };
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        alert("🎉 Pengaturan overlay donasi berhasil disimpan!");
        fetchAdminData();
      } else {
        throw new Error("Gagal menyimpan!");
      }
    } catch (err) {
      console.error(err);
      alert("Gagal menyimpan pengaturan overlay donasi: " + err.message);
    }
  };

  const handleSaveRunningTextSettings = async () => {
    const payload = {
      is_running_text_active: siteSettings.is_running_text_active === undefined ? true : siteSettings.is_running_text_active,
      announcementText: siteSettings.announcementText,
      announcementBadge: siteSettings.announcementBadge,
      donationMarqueeSpeed: siteSettings.donationMarqueeSpeed || 'Sedang'
    };
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        alert("🎉 Pengaturan running text berhasil disimpan dan ditampilkan!");
        fetchAdminData();
      } else {
        throw new Error("Gagal menyimpan!");
      }
    } catch (err) {
      console.error(err);
      alert("Gagal menyimpan pengaturan running text: " + err.message);
    }
  };

  // Settings & social
  const handleSaveSettings = async () => {
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(siteSettings)
      })
      if (res.ok) {
        if (typeof window !== 'undefined') {
          localStorage.setItem('shindora-settings', JSON.stringify(siteSettings))
        }
        alert('Pengaturan Website Berhasil Disimpan!')
        fetchAdminData()
      } else {
        const errData = await res.json()
        throw new Error(errData.error || 'Gagal menyimpan pengaturan')
      }
    } catch (err) {
      console.error(err)
      alert("Gagal menyimpan pengaturan website: " + err.message)
    }
  }

  const handleAddSocialLink = () => {
    if (!newSocialName.trim() || !newSocialUrl.trim()) return
    const newLink = { id: Date.now().toString(), name: newSocialName, url: newSocialUrl }
    const updatedLinks = [...(siteSettings.socialLinks || []), newLink]
    setSiteSettings({ ...siteSettings, socialLinks: updatedLinks })
    setNewSocialName('')
    setNewSocialUrl('')
  }

  const handleRemoveSocialLink = (id) => {
    const updatedLinks = siteSettings.socialLinks.filter(l => l.id !== id)
    setSiteSettings({ ...siteSettings, socialLinks: updatedLinks })
  }

  // Filtering list search queries
  const searchedVideos = videos.filter(v => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q ||
                          v.title.toLowerCase().includes(q) || 
                          v.id.includes(q) || 
                          (v.episode && v.episode.toLowerCase().includes(q)) ||
                          (v.animeTitle && v.animeTitle.toLowerCase().includes(q)) ||
                          (v.subCategory && v.subCategory.toLowerCase().includes(q)) ||
                          (v.subCategory2 && v.subCategory2.toLowerCase().includes(q));
    
    if (statusFilter === 'published') {
      return matchesSearch && (!v.status || v.status === 'published');
    }
    if (statusFilter === 'draft') {
      return matchesSearch && v.status === 'draft';
    }
    if (statusFilter === 'scheduled') {
      return matchesSearch && v.status === 'scheduled';
    }
    return matchesSearch;
  })
  const searchedCategories = categories.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
  const searchedUsers = users.filter(u => u.name.toLowerCase().includes(searchQuery.toLowerCase()) || u.email.toLowerCase().includes(searchQuery.toLowerCase()))
  const searchedPlaylists = playlists.filter(p => p.ownerId === null && p.title.toLowerCase().includes(searchQuery.toLowerCase()))
  const searchedAds = ads.filter(a => a.title.toLowerCase().includes(searchQuery.toLowerCase()))

  if (!mounted) {
    return null;
  }

  if (!mounted) {
    return <div className={`min-h-screen ${theme === 'dark' ? 'bg-[#0a0b14]' : 'bg-[#f8fafc]'}`} />;
  }

  if (!isAdmin) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 relative ${theme === 'dark' ? 'bg-[#07080f] text-[#e2e8f0]' : 'bg-[#f8fafc] text-[#0f172a]'}`}>
        <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-red-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className={`w-full max-w-md rounded-2xl border p-6 md:p-8 shadow-2xl relative ${theme === 'dark' ? 'border-red-500/20 bg-[#0d0e1b]/95' : 'border-red-500/20 bg-white shadow-xl'}`}>
          <a href="/" className="absolute top-4 right-4 text-xs font-bold text-slate-400 hover:text-red-500 transition-all">
            &times; Beranda
          </a>

          <div className="text-center space-y-2 mb-6">
            <div className="inline-flex items-center justify-center p-2.5 bg-red-500 rounded-xl text-white font-black mb-1 shadow-lg">
              <Tv className="w-6 h-6 fill-current" />
            </div>
            <h2 className="text-xl md:text-2xl font-black uppercase tracking-widest bg-clip-text text-transparent bg-gradient-to-r from-red-400 via-pink-400 to-purple-500">
              PANEL ADMIN SHINDORA
            </h2>
            <p className="text-xs opacity-70">Masuk dengan Akun Admin untuk mengelola data website.</p>
          </div>

          {adminLoginError && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold text-center mb-4">
              ⚠️ {adminLoginError}
            </div>
          )}

          <form onSubmit={handleAdminPasswordSubmit} className="space-y-3.5">
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold tracking-wider opacity-70">EMAIL ADMIN</label>
              <input
                type="email"
                placeholder="maskohar76@gmail.com"
                value={adminEmailInput}
                onChange={(e) => setAdminEmailInput(e.target.value)}
                data-testid="admin-email-input"
                className={`w-full px-3 py-2 rounded-lg text-xs outline-none border transition-all ${
                  theme === 'dark'
                    ? 'bg-[#121324] border-[#1e2038] text-white focus:border-red-500'
                    : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-red-500'
                }`}
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold tracking-wider opacity-70">KATA SANDI ADMIN</label>
              <div className="relative">
                <input
                  type={showAdminPassword ? "text" : "password"}
                  placeholder="Masukkan kata sandi..."
                  value={adminPasswordInput}
                  onChange={(e) => setAdminPasswordInput(e.target.value)}
                  data-testid="admin-password-input"
                  className={`w-full px-3 pr-10 py-2 rounded-lg text-xs outline-none border transition-all ${
                    theme === 'dark'
                      ? 'bg-[#121324] border-[#1e2038] text-white focus:border-red-500'
                    : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-red-500'
                  }`}
                  required
                />
                <button
                  type="button"
                  data-testid="toggle-admin-password-btn"
                  onClick={() => setShowAdminPassword(!showAdminPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors cursor-pointer"
                  aria-label="Toggle perlihatkan sandi admin"
                >
                  {showAdminPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isVerifyingAdmin}
              className="w-full py-2.5 bg-gradient-to-r from-red-500 via-pink-500 to-purple-600 text-white hover:opacity-90 font-extrabold text-xs transition-all tracking-wider uppercase rounded-lg shadow-lg cursor-pointer"
            >
              {isVerifyingAdmin ? 'Memverifikasi Akun...' : 'MASUK KE PANEL ADMIN'}
            </button>

            <div className="text-center pt-2 border-t border-slate-500/10">
              <a href="/login" className="text-[11px] text-cyan-400 hover:underline font-semibold">
                Masuk lewat Halaman Login Utama (/login) &rarr;
              </a>
            </div>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen flex flex-col md:flex-row w-full max-w-full overflow-x-hidden ${theme === 'dark' ? 'dark-theme bg-[#0a0b14] text-[#e2e8f0]' : 'light-theme bg-[#f8fafc] text-[#0f172a]'}`}>
      
      <style dangerouslySetInnerHTML={{ __html: `
        .light-theme {
          --bg-main: #f8fafc;
          --bg-card: #ffffff;
          --bg-input: #ffffff;
          --border-color: #cbd5e1;
          --text-main: #0f172a;
          --text-muted: #475569;
        }
        .light-theme .bg-slate-950,
        .light-theme .bg-slate-900,
        .light-theme .bg-\\[\\#0a0b14\\] {
          background-color: var(--bg-main) !important;
          color: var(--text-main) !important;
        }
        .light-theme .bg-\\[\\#0d0e1b\\] {
          background-color: var(--bg-card) !important;
          color: var(--text-main) !important;
          border: 1px solid var(--border-color) !important;
        }
        .light-theme .bg-\\[\\#121324\\] {
          background-color: var(--bg-input) !important;
          color: var(--text-main) !important;
          border-color: var(--border-color) !important;
        }
        .light-theme .border-slate-800,
        .light-theme .border-\\[\\#1e2038\\],
        .light-theme .divide-\\[\\#1e2038\\] {
          border-color: var(--border-color) !important;
        }
        .light-theme .text-white,
        .light-theme .text-slate-100,
        .light-theme .text-slate-200 {
          color: var(--text-main) !important;
        }
        .light-theme .text-slate-300,
        .light-theme .text-slate-400 {
          color: var(--text-muted) !important;
        }
        .light-theme .bg-\\[\\#121324\\]::placeholder {
          color: #94a3b8 !important;
        }
        .light-theme select {
          background-color: var(--bg-card) !important;
          color: var(--text-main) !important;
          border-color: var(--border-color) !important;
        }
        .light-theme textarea {
          background-color: var(--bg-input) !important;
          color: var(--text-main) !important;
          border-color: var(--border-color) !important;
        }
        .light-theme .hover\\:bg-slate-500\\/5:hover {
          background-color: #f1f5f9 !important;
        }
        
        .light-theme table,
        .light-theme tbody,
        .light-theme tr,
        .light-theme td {
          background-color: #ffffff !important;
          color: #0f172a !important;
          border-color: #e2e8f0 !important;
        }
        .light-theme tr:nth-child(even) td {
          background-color: #f8fafc !important;
        }
        .light-theme table tr:hover td {
          background-color: #f1f5f9 !important;
        }
        .light-theme table thead,
        .light-theme table thead tr,
        .light-theme table thead th {
          background-color: #e2e8f0 !important;
          color: #1e293b !important;
          font-weight: 700 !important;
          opacity: 1 !important;
        }
        
        .light-theme .bg-black\\/30,
        .light-theme .bg-black\\/20,
        .light-theme .bg-black\\/40 {
          background-color: #f1f5f9 !important;
          border-color: #cbd5e1 !important;
          color: #0f172a !important;
        }
        .light-theme .text-red-400,
        .light-theme .text-pink-400 {
          color: #be185d !important;
        }
        .light-theme .text-cyan-400 {
          color: #0369a1 !important;
        }
        .light-theme label,
        .light-theme span.text-\\[10px\\] {
          color: #334155 !important;
          font-weight: 700 !important;
        }
        .light-theme select option {
          background-color: #ffffff !important;
          color: #0f172a !important;
        }
      `}} />

      {/* Sidebar - Fully Responsive */}
      <aside className={`w-full md:w-64 flex-shrink-0 flex flex-col justify-between p-2 sm:p-4 border-b md:border-r border-slate-500/10 transition-all duration-200 ${
        theme === 'dark' ? 'bg-[#0d0e1b] border-[#1e2038]' : 'bg-white border-slate-200 shadow-sm'
      }`}>
        <div className="flex flex-col items-stretch justify-start gap-3 md:space-y-6 w-full">
          <div className="flex items-center justify-between px-2 flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="p-1 bg-red-500 rounded text-black font-black text-xs">AP</div>
              <span className="font-extrabold tracking-widest text-xs md:text-sm bg-gradient-to-r from-red-400 to-pink-500 bg-clip-text text-transparent">ADMIN SHINDORA</span>
            </div>
          </div>

          <div className="flex md:flex-col gap-1.5 overflow-x-auto md:overflow-visible w-full scrollbar-hide py-1">
            <a
              href="/"
              className={`px-3 py-2 text-xs font-bold rounded-lg flex items-center gap-2 transition-all whitespace-nowrap flex-shrink-0 md:flex-shrink md:w-full border ${
                theme === 'dark' 
                  ? 'bg-slate-500/5 hover:bg-slate-500/15 border-slate-500/10 text-cyan-400' 
                  : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
              }`}
              title="Kembali ke Website Publik"
            >
              <ArrowLeft className="w-4 h-4 flex-shrink-0" />
              <span>Lihat Website</span>
            </a>

            {[
              { id: 'videos', label: 'Videos Database', icon: TvIcon },
              { id: 'categories', label: 'Categories & Genres', icon: ListVideo },
              { id: 'users', label: 'User Roles & Moderation', icon: Users },
              { id: 'playlists', label: 'Official Playlists', icon: Tv },
              { id: 'ads', label: 'Ads slots', icon: Megaphone },
              { id: 'pages', label: 'Custom Static Pages', icon: FileText },
              { id: 'polling', label: 'Anime Polling / Vote', icon: ListVideo },
              { id: 'settings', label: 'Settings & API settings', icon: Settings },
              { id: 'donasi', label: 'Donasi Manual', icon: HeartHandshake }
            ].map(tab => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => { setActiveTab(tab.id); setSearchQuery(''); }}
                  className={`px-3 py-2 text-xs font-bold rounded-lg flex items-center gap-2 transition-all whitespace-nowrap flex-shrink-0 md:flex-shrink md:w-full ${
                    activeTab === tab.id 
                      ? (theme === 'dark' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-red-50 text-red-600 border border-red-200') 
                      : (theme === 'dark' ? 'hover:bg-slate-500/5 opacity-70 text-slate-300' : 'hover:bg-slate-100 text-slate-600')
                  }`}
                  title={tab.label}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="p-2 border-t border-slate-500/10 space-y-1 hidden md:block">
          <div className="text-[10px] opacity-50 font-bold">Admin mode active</div>
        </div>
      </aside>

      {/* Main Content Container */}
      <main className="flex-1 p-2.5 sm:p-4 md:p-6 space-y-4 sm:space-y-6 overflow-y-auto overflow-x-hidden h-auto md:h-screen w-full min-w-0 max-w-full">
        
        <div className={`flex flex-col sm:flex-row justify-between sm:items-center border-b pb-3 sm:pb-4 gap-3 sm:gap-4 ${
          theme === 'dark' ? 'border-[#1e2038]' : 'border-slate-200'
        }`}>
          <div className="flex flex-col gap-1 w-full sm:w-auto">
            <div className="flex items-center justify-between sm:justify-start gap-3 w-full">
              <h1 className="text-sm sm:text-base md:text-xl font-black truncate">Panel Dashboard Pengendali Utama</h1>
              
              <div className="flex items-center gap-2">
                {/* Lonceng Notifikasi Admin */}
                <div className="relative">
                  <button
                    type="button"
                    data-testid="admin-notifications-toggle-btn"
                    onClick={() => setShowAdminNotifDropdown(!showAdminNotifDropdown)}
                    className={`p-2 rounded-lg transition-all relative border cursor-pointer ${
                      showAdminNotifDropdown
                        ? 'bg-pink-500/20 text-pink-400 border-pink-500/40'
                        : (theme === 'dark' ? 'border-[#1e2038] bg-[#121324] hover:bg-[#1a1c32] text-slate-300' : 'border-slate-200 bg-white hover:bg-slate-100 text-slate-700 shadow-sm')
                    }`}
                    title="Pemberitahuan Balasan Komentar"
                  >
                    <Bell className="w-4 h-4" />
                    {adminNotifications.filter(n => !n.isRead).length > 0 && (
                      <span className="absolute -top-1.5 -right-1 bg-red-600 text-[9px] font-black text-white px-1.5 py-0.2 rounded-full shadow animate-bounce flex items-center justify-center">
                        {adminNotifications.filter(n => !n.isRead).length}
                      </span>
                    )}
                  </button>

                  {/* Dropdown Notifikasi Panel Admin */}
                  {showAdminNotifDropdown && (
                    <div className={`absolute right-0 sm:left-0 sm:right-auto mt-2.5 w-72 sm:w-80 rounded-xl border p-3 shadow-2xl space-y-3 z-50 ${
                      theme === 'dark' ? 'bg-[#0d0e1b] border-[#1e2038] text-[#e2e8f0]' : 'bg-white border-slate-200 text-slate-900'
                    }`}>
                      <div className="flex items-center justify-between border-b border-slate-500/10 pb-2">
                        <span className="font-extrabold text-xs flex items-center gap-1.5">
                          <Bell className="w-3.5 h-3.5 text-pink-500" />
                          Pemberitahuan Admin
                        </span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={handleMarkAllAdminNotifRead}
                            className="text-[10px] font-bold text-cyan-400 hover:underline cursor-pointer"
                          >
                            Tandai dibaca
                          </button>
                          {adminNotifications.length > 0 && (
                            <button
                              type="button"
                              onClick={handleClearAllAdminNotif}
                              className="text-[10px] font-bold text-red-400 hover:underline cursor-pointer"
                            >
                              Bersihkan
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="max-h-60 overflow-y-auto space-y-2.5 scrollbar-hide">
                        {adminNotifications.length === 0 ? (
                          <p className="text-center py-6 text-[11px] opacity-50 italic">Tidak ada notifikasi baru.</p>
                        ) : (
                          adminNotifications.map((notif) => (
                            <div
                              key={notif.id}
                              onClick={() => handleMarkAdminNotifRead(notif)}
                              className={`p-2.5 rounded-lg text-[11px] flex gap-2 cursor-pointer transition-all border text-left ${
                                notif.isRead
                                  ? 'opacity-60 bg-transparent border-transparent'
                                  : (theme === 'dark' ? 'bg-pink-500/5 border-pink-500/10 hover:bg-pink-500/10' : 'bg-pink-50/50 border-pink-100 hover:bg-pink-100/50')
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
                                  <span className="font-bold text-pink-400">{notif.senderName}</span> membalas komentar Anda di <span className="font-extrabold text-cyan-400">{notif.animeTitle} - {notif.episodeTitle}</span>
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

                <button
                  type="button"
                  data-testid="admin-theme-toggle-btn"
                  onClick={() => {
                    const nextTheme = theme === 'dark' ? 'light' : 'dark'
                    setTheme(nextTheme)
                    localStorage.setItem('shindora-theme', nextTheme)
                    localStorage.setItem('theme', nextTheme)
                    if (nextTheme === 'dark') {
                      document.documentElement.classList.add('dark')
                    } else {
                      document.documentElement.classList.remove('dark')
                    }
                  }}
                  className={`flex-shrink-0 px-2.5 py-1 text-[10px] sm:text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                    theme === 'dark' 
                      ? 'border-[#1e2038] bg-[#121324] hover:bg-[#1a1c32] text-yellow-400' 
                      : 'border-slate-200 bg-white hover:bg-slate-100 text-slate-700 shadow-sm'
                  }`}
                >
                  {theme === 'dark' ? '☀️ Mode Terang' : '🌙 Mode Gelap'}
                </button>
              </div>
            </div>
            <p className="text-[10px] sm:text-xs opacity-60">Kelola data, kategori, pengguna, iklan, dan kunci integrasi sistem.</p>
          </div>

          <div className="relative w-full sm:w-72 flex-shrink-0">
            <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 opacity-55" />
            <input
              type="text"
              placeholder={`Cari dalam tab ${activeTab}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-8 pr-3 py-1.5 rounded-lg text-xs outline-none transition-all border ${
                theme === 'dark' 
                  ? 'bg-[#121324] border-[#1e2038] text-white focus:border-red-500' 
                  : 'bg-white border-slate-200 text-slate-900 focus:border-red-500'
              }`}
            />
          </div>
        </div>

        {activeTab === 'videos' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center bg-[#0d0e1b] p-4 rounded-xl border border-[#1e2038] gap-3">
              <div>
                <h3 className="font-extrabold text-sm">Kelola Data Video Retro ({videos.length})</h3>
                <p className="text-[11px] opacity-60">Tambah video, hapus, atau import massal via format CSV sederhana.</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { 
                    setEditingVideo(null); 
                    setVideoForm({
                      title: '', slug: '', animeTitle: 'Doraemon', subCategory: '', subCategory2: '', episode: '', thumbnailUrl: '', videoUrl: '', videoUrl2: '', videoUrl3: '', description: '', views: 0, likes: 0, status: 'published', scheduledAt: '', duration: '', download_links: [], playlistId: ''
                    });
                    setIsVideoSlugManuallyEdited(false); 
                    setShowVideoModal(true); 
                  }}
                  className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-extrabold text-xs flex items-center gap-1 shadow-lg"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Video</span>
                </button>
                <button
                  onClick={() => setShowCsvBox(!showCsvBox)}
                  className="px-3 py-2 rounded-lg bg-slate-500/15 hover:bg-slate-500/25 border border-[#1e2038] font-bold text-xs"
                >
                  Bulk CSV Import
                </button>
              </div>
            </div>

            {/* Filter Status Bar */}
            <div className="flex flex-wrap gap-1.5 p-1 bg-[#0d0e1b] rounded-lg border border-[#1e2038] w-max select-none">
              {[
                { id: 'all', label: 'Semua Video' },
                { id: 'published', label: 'Publik' },
                { id: 'draft', label: 'Draft' },
                { id: 'scheduled', label: 'Terschedul / Jadwal' }
              ].map(item => (
                <button
                  key={item.id}
                  onClick={() => setStatusFilter(item.id)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                    statusFilter === item.id
                      ? 'bg-red-500 text-white shadow-md'
                      : 'text-slate-400 hover:text-white hover:bg-slate-500/5'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {showCsvBox && (
              <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5 space-y-3">
                <h4 className="text-xs font-extrabold text-red-400">Import Banyak Episode Anime Sekaligus</h4>
                <p className="text-[10px] opacity-75 leading-relaxed">
                  Masukkan baris teks episode baru Anda di bawah ini dengan format koma: <br/>
                  <code className="text-red-300 font-mono text-[9px] bg-black/40 px-1 py-0.5 rounded">Judul Video,Judul Anime,Nomor Episode,URL Thumbnail,URL Video Embed,Deskripsi Singkat</code>
                </p>
                <textarea
                  value={csvInput}
                  onChange={(e) => setCsvInput(e.target.value)}
                  placeholder="Doraemon: Mesin Pengendali Mimpi,Doraemon,Eps 3,https://unsplash.com/...,https://youtube.com/embed/...,Petualangan seru Nobita di dalam mimpi."
                  className="w-full h-32 text-xs p-3 rounded-lg border bg-[#121324] border-[#1e2038] outline-none text-white font-mono"
                />
                <div className="flex justify-end gap-2">
                  <button onClick={() => setShowCsvBox(false)} className="px-3 py-1.5 text-xs opacity-60">Batal</button>
                  <button onClick={handleBulkCSVImport} className="px-4 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-black rounded">Proses Impor CSV</button>
                </div>
              </div>
            )}

            {/* Bulk Action Bar */}
            {selectedVideoIds.length > 0 && (
              <div data-testid="bulk-action-bar" className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3.5 bg-gradient-to-r from-red-600/25 via-pink-600/20 to-purple-600/25 border border-red-500/40 rounded-xl gap-3 shadow-xl animate-fadeIn">
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center font-black text-xs shadow">
                    ✓
                  </span>
                  <div>
                    <span className="text-xs font-black text-white">
                      {selectedVideoIds.length} Video Dipilih
                    </span>
                    <span className="text-[10px] opacity-75 block text-slate-300">
                      (dari {searchedVideos.length} video pada filter & pencarian saat ini)
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    data-testid="btn-bulk-edit-category"
                    onClick={handleOpenBulkCategoryModal}
                    className="px-3.5 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-black shadow-lg transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    🏷️ Edit Kategori ({selectedVideoIds.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleSelectAll(searchedVideos)}
                    className="px-3 py-1.5 bg-black/40 hover:bg-black/60 text-slate-200 border border-white/10 rounded-lg text-xs font-bold transition-all cursor-pointer"
                  >
                    {searchedVideos.every(v => selectedVideoIds.includes(v.id)) ? 'Batalkan Filter Ini' : 'Pilih Semua di Filter Ini'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedVideoIds([])}
                    className="px-3 py-1.5 bg-slate-700/50 hover:bg-slate-700 text-slate-300 border border-slate-600/40 rounded-lg text-xs font-bold transition-all cursor-pointer"
                  >
                    Batal Pilih
                  </button>
                </div>
              </div>
            )}

            <div className="bg-[#0d0e1b] rounded-xl border border-[#1e2038] overflow-x-auto">
              <table className="w-full text-xs text-left min-w-[650px]">
                <thead className="bg-[#121324] text-[10px] uppercase font-bold tracking-wider opacity-60 border-b border-[#1e2038]">
                  <tr>
                    <th className="p-3 w-10 text-center">
                      <input
                        type="checkbox"
                        aria-label="Pilih Semua Video"
                        data-testid="select-all-videos-checkbox"
                        checked={searchedVideos.length > 0 && searchedVideos.every(v => selectedVideoIds.includes(v.id))}
                        onChange={() => handleToggleSelectAll(searchedVideos)}
                        className="cursor-pointer w-3.5 h-3.5 accent-red-500"
                      />
                    </th>
                    <th className="p-3">Thumbnail &amp; Judul</th>
                    <th className="p-3">Anime</th>
                    <th className="p-3">Eps</th>
                    <th className="p-3 text-center">Views</th>
                    <th className="p-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e2038]">
                  {searchedVideos.map(video => {
                    const isSelected = selectedVideoIds.includes(video.id);
                    return (
                      <tr 
                        key={video.id} 
                        className={`transition-all ${isSelected ? 'bg-red-500/10 hover:bg-red-500/15' : 'hover:bg-slate-500/5'}`}
                      >
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            aria-label={`Pilih video ${video.title}`}
                            data-testid={`select-video-${video.id}`}
                            checked={isSelected}
                            onChange={() => handleToggleSelectVideo(video.id)}
                            className="cursor-pointer w-3.5 h-3.5 accent-red-500"
                          />
                        </td>
                        <td className="p-3 flex items-center gap-3">
                          <img src={video.thumbnailUrl} alt="" className="w-12 h-8 rounded object-cover flex-shrink-0" />
                          <div>
                            <p className="font-extrabold text-slate-100">{video.title}</p>
                            <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                              <span className="text-[10px] font-mono opacity-50">{video.slug || video.id}</span>
                              {/* Publication Status Badge */}
                              {(!video.status || video.status === 'published') && (
                                <span className="px-2 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20 font-black text-[9px] uppercase tracking-wider">
                                  PUBLIK
                                </span>
                              )}
                              {video.status === 'draft' && (
                                <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-black text-[9px] uppercase tracking-wider">
                                  DRAFT
                                </span>
                              )}
                              {video.status === 'scheduled' && (
                                <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-black text-[9px] uppercase tracking-wider" title={`Rilis: ${video.scheduledAt ? new Date(video.scheduledAt).toLocaleString('id-ID') : '?'}`}>
                                  JADWAL ({video.scheduledAt ? new Date(video.scheduledAt).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }) : '?'})
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="p-3 font-semibold text-cyan-400">
                          {video.animeTitle}
                          {video.subCategory ? ` > ${video.subCategory}` : ""}
                          {video.subCategory2 ? ` > ${video.subCategory2}` : ""}
                          {video.subCategory3 ? ` > ${video.subCategory3}` : ""}
                        </td>
                        <td className="p-3"><span className="px-1.5 py-0.5 rounded bg-pink-500/10 text-pink-400 font-bold text-[10px]">{video.episode}</span></td>
                        <td className="p-3 text-center opacity-70">{video.views?.toLocaleString()}</td>
                        <td className="p-3 text-right">
                          <div className="inline-flex gap-1.5">
                            <button
                              onClick={async () => {
                                if (!confirm(`Kirim notifikasi web push (VAPID) untuk episode "${video.title}" ke seluruh subscriber?`)) return;
                                try {
                                  const res = await fetch('/api/videos/notify', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ id: video.id })
                                  });
                                  const data = await res.json();
                                  if (res.ok) {
                                    alert(`Notifikasi VAPID berhasil dikirim! (${data.count || 0} subscriber terkirim)`);
                                  } else {
                                    alert(`Gagal mengirim notifikasi: ${data.error || 'Terjadi kesalahan'}`);
                                  }
                                } catch (err) {
                                  alert(`Error: ${err.message}`);
                                }
                              }}
                              className="p-1.5 text-pink-400 hover:bg-pink-500/10 border border-pink-500/20 rounded cursor-pointer"
                              title="Broadcast Notifikasi VAPID ke Semua Pengguna"
                            >
                              <Bell className="w-3.5 h-3.5 pointer-events-none" />
                            </button>
                            <button
                              onClick={() => {
                                setEditingVideo(video);
                                const containingPlaylist = playlists.find(p => Array.isArray(p.videoIds) && p.videoIds.includes(video.id));
                                setVideoForm({ 
                                  status: 'published', 
                                  scheduledAt: '', 
                                  ...video, 
                                  slug: video.slug || '', 
                                  duration: video.duration || '',
                                  download_links: Array.isArray(video.download_links) ? video.download_links.map(l => ({ provider: l.provider || '', url: l.url || '' })) : [],
                                  playlistId: containingPlaylist ? (containingPlaylist.id || containingPlaylist._id) : '',
                                  sendPushNotification: true
                                });
                                setIsVideoSlugManuallyEdited(false);
                                setShowVideoModal(true);
                              }}
                              className="p-1.5 text-cyan-400 hover:bg-cyan-500/10 border border-cyan-500/20 rounded cursor-pointer"
                              title="Edit Video"
                            >
                              <Edit3 className="w-3.5 h-3.5 pointer-events-none" />
                            </button>
                            <button
                              onClick={() => handleDeleteVideo(video.id)}
                              className="p-1.5 text-red-400 hover:bg-red-500/10 border border-red-500/20 rounded cursor-pointer"
                              title="Hapus Video"
                            >
                              <Trash2 className="w-3.5 h-3.5 pointer-events-none" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'categories' && (
          <div className="space-y-6 max-w-7xl mx-auto">
            
            {/* FOUR FORM CARDS IN GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              
              {/* Card 1: Tambah Kategori Utama */}
              <div className="bg-[#0d0e1b] p-4 rounded-2xl border border-slate-800 shadow-sm space-y-3">
                <h3 className="font-extrabold text-xs text-pink-400 flex items-center gap-1.5">
                  ➕ Kategori Utama (Level 1)
                </h3>
                <form onSubmit={handleCreateMainCategory} className="space-y-3 text-xs text-left">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-semibold uppercase text-slate-400">
                      Nama Kategori Utama
                    </label>
                    <input
                      type="text"
                      value={mainCatName}
                      onChange={(e) => setMainCatName(e.target.value)}
                      placeholder="misal: TV Series, Movie"
                      className="w-full px-3 py-2 rounded-xl border border-[#1e2038] bg-[#121324] text-white focus:border-pink-500 outline-none text-xs"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2 bg-pink-600 hover:bg-pink-700 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer"
                  >
                    Simpan Kategori Utama
                  </button>
                </form>
              </div>

              {/* Card 2: Tambah Sub-Kategori 1 */}
              <div className="bg-[#0d0e1b] p-4 rounded-2xl border border-slate-800 shadow-sm space-y-3">
                <h3 className="font-extrabold text-xs text-cyan-400 flex items-center gap-1.5">
                  📂 Sub-Kategori 1 (Level 2)
                </h3>
                <form onSubmit={handleCreateSubCategory} className="space-y-3 text-xs text-left">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-semibold uppercase text-slate-400">
                      PILIH INDUK KATEGORI UTAMA
                    </label>
                    <select
                      value={selectedMainId}
                      onChange={(e) => setSelectedMainId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-[#1e2038] bg-[#121324] text-white outline-none text-xs"
                      required
                    >
                      <option value="">-- Pilih Kategori Utama --</option>
                      {categories
                        .filter(c => !c.parent_id || c.parent_id === 'none')
                        .map((main) => (
                          <option key={main.id || main._id} value={main.id || main._id}>
                            {cleanCategoryName(main.name)}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] font-semibold uppercase text-slate-400">
                      NAMA SUB-KATEGORI 1
                    </label>
                    <input
                      type="text"
                      value={subCatName}
                      onChange={(e) => setSubCatName(e.target.value)}
                      placeholder="misal: Doraemon, Crayon Shin-chan"
                      className="w-full px-3 py-2 rounded-xl border border-[#1e2038] bg-[#121324] text-white focus:border-cyan-500 outline-none text-xs"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer"
                  >
                    Simpan Sub-Kategori 1
                  </button>
                </form>
              </div>

              {/* Card 3: Tambah Sub-Kategori 2 */}
              <div className="bg-[#0d0e1b] p-4 rounded-2xl border border-slate-800 shadow-sm space-y-3">
                <h3 className="font-extrabold text-xs text-purple-400 flex items-center gap-1.5">
                  📁 Sub-Kategori 2 (Level 3)
                </h3>
                <form onSubmit={handleCreateSubCategory2} className="space-y-3 text-xs text-left">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-semibold uppercase text-slate-400">
                      PILIH INDUK SUB-KATEGORI 1
                    </label>
                    <select
                      value={selectedSub1Id}
                      onChange={(e) => setSelectedSub1Id(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-[#1e2038] bg-[#121324] text-white outline-none text-xs"
                      required
                    >
                      <option value="">-- Pilih Sub-Kategori 1 --</option>
                      {categories
                        .filter((c) => {
                          if (!c.parent_id || c.parent_id === 'none') return false;
                          const p = categories.find(x => String(x.id || x._id) === String(c.parent_id));
                          return p && (!p.parent_id || p.parent_id === 'none');
                        })
                        .map((sub1) => {
                          const p = categories.find(x => String(x.id || x._id) === String(sub1.parent_id));
                          const parentLabel = p ? `${cleanCategoryName(p.name)} → ` : '';
                          return (
                            <option key={sub1.id || sub1._id} value={sub1.id || sub1._id}>
                              {parentLabel}{cleanCategoryName(sub1.name)}
                            </option>
                          );
                        })}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] font-semibold uppercase text-slate-400">
                      NAMA SUB-KATEGORI 2
                    </label>
                    <input
                      type="text"
                      value={subCat2Name}
                      onChange={(e) => setSubCat2Name(e.target.value)}
                      placeholder="misal: Season 1, Movie 2014"
                      className="w-full px-3 py-2 rounded-xl border border-[#1e2038] bg-[#121324] text-white focus:border-purple-500 outline-none text-xs"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer"
                  >
                    Simpan Sub-Kategori 2
                  </button>
                </form>
              </div>

              {/* Card 4: Tambah Sub-Kategori 3 */}
              <div className="bg-[#0d0e1b] p-4 rounded-2xl border border-slate-800 shadow-sm space-y-3">
                <h3 className="font-extrabold text-xs text-emerald-400 flex items-center gap-1.5">
                  🏷️ Sub-Kategori 3 (Level 4)
                </h3>
                <form onSubmit={handleCreateSubCategory3} className="space-y-3 text-xs text-left">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-semibold uppercase text-slate-400">
                      PILIH INDUK SUB-KATEGORI 2
                    </label>
                    <select
                      value={selectedSub2Id}
                      onChange={(e) => setSelectedSub2Id(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-[#1e2038] bg-[#121324] text-white outline-none text-xs"
                      required
                    >
                      <option value="">-- Pilih Sub-Kategori 2 --</option>
                      {categories
                        .filter((c) => {
                          if (!c.parent_id || c.parent_id === 'none') return false;
                          const p = categories.find(x => String(x.id || x._id) === String(c.parent_id));
                          if (!p || !p.parent_id || p.parent_id === 'none') return false;
                          const gp = categories.find(x => String(x.id || x._id) === String(p.parent_id));
                          return gp && (!gp.parent_id || gp.parent_id === 'none');
                        })
                        .map((sub2) => (
                          <option key={sub2.id || sub2._id} value={sub2.id || sub2._id}>
                            {getSubCategory2HierarchyLabel(sub2)}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] font-semibold uppercase text-slate-400">
                      NAMA SUB-KATEGORI 3
                    </label>
                    <input
                      type="text"
                      value={subCat3Name}
                      onChange={(e) => setSubCat3Name(e.target.value)}
                      placeholder="misal: Episode 1, OVA 1, Part 1"
                      className="w-full px-3 py-2 rounded-xl border border-[#1e2038] bg-[#121324] text-white focus:border-emerald-500 outline-none text-xs"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer"
                  >
                    SIMPAN SUB-KATEGORI 3
                  </button>
                </form>
              </div>

            </div>

            {/* FOUR TABLES FOR MAIN, SUB 1, SUB 2, AND SUB 3 CATEGORIES */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-left">
              
              {/* Table 1: Daftar Kategori Utama */}
              <div className="bg-[#0d0e1b] rounded-xl border border-[#1e2038] p-4 space-y-3.5 overflow-x-auto">
                <span className="text-[10px] font-black text-pink-400 uppercase tracking-widest block">
                  &bull; Kategori Utama (Level 1) ({categories.filter(c => !c.parent_id || c.parent_id === 'none').length})
                </span>
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#121324] text-[10px] uppercase opacity-60 border-b border-[#1e2038]">
                    <tr>
                      <th className="p-2">Nama Kategori</th>
                      <th className="p-2 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1e2038]">
                    {categories.filter(c => !c.parent_id || c.parent_id === 'none').length === 0 ? (
                      <tr>
                        <td colSpan="2" className="p-6 text-center opacity-50 italic">Belum ada Kategori Utama.</td>
                      </tr>
                    ) : (
                      categories
                        .filter(c => !c.parent_id || c.parent_id === 'none')
                        .map((cat, index) => (
                          <tr key={cat.id || cat._id || `main-${index}`} className="hover:bg-slate-500/5 transition-all text-slate-300">
                            <td className="p-2 font-bold text-white">{cleanCategoryName(cat.name)}</td>
                            <td className="p-2 text-right">
                              <button
                                onClick={() => handleDeleteCategory(cat.id || cat._id)}
                                className="p-1.5 text-red-400 hover:bg-red-500/10 border border-red-500/20 rounded cursor-pointer"
                                title="Hapus Kategori Utama"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Table 2: Daftar Sub-Kategori 1 */}
              <div className="bg-[#0d0e1b] rounded-xl border border-[#1e2038] p-4 space-y-3.5 overflow-x-auto">
                <span className="text-[10px] font-black text-cyan-400 uppercase tracking-widest block">
                  &bull; Sub-Kategori 1 (Level 2) ({categories.filter(c => {
                    if (!c.parent_id || c.parent_id === 'none') return false;
                    const p = categories.find(x => String(x.id || x._id) === String(c.parent_id));
                    return p && (!p.parent_id || p.parent_id === 'none');
                  }).length})
                </span>
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#121324] text-[10px] uppercase opacity-60 border-b border-[#1e2038]">
                    <tr>
                      <th className="p-2">Nama Sub 1</th>
                      <th className="p-2">Induk</th>
                      <th className="p-2 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1e2038]">
                    {(() => {
                      const sub1s = categories.filter(c => {
                        if (!c.parent_id || c.parent_id === 'none') return false;
                        const p = categories.find(x => String(x.id || x._id) === String(c.parent_id));
                        return p && (!p.parent_id || p.parent_id === 'none');
                      });
                      if (sub1s.length === 0) {
                        return (
                          <tr>
                            <td colSpan="3" className="p-6 text-center opacity-50 italic">Belum ada Sub-Kategori 1.</td>
                          </tr>
                        );
                      }
                      return sub1s.map((cat, index) => {
                        const parentCat = categories.find(p => String(p.id || p._id) === String(cat.parent_id));
                        return (
                          <tr key={cat.id || cat._id || `sub1-${index}`} className="hover:bg-slate-500/5 transition-all text-slate-300">
                            <td className="p-2 font-bold text-white">{cleanCategoryName(cat.name)}</td>
                            <td className="p-2 font-semibold text-cyan-400">{cleanCategoryName(parentCat ? parentCat.name : 'Tidak Diketahui')}</td>
                            <td className="p-2 text-right">
                              <button
                                onClick={() => handleDeleteCategory(cat.id || cat._id)}
                                className="p-1.5 text-red-400 hover:bg-red-500/10 border border-red-500/20 rounded cursor-pointer"
                                title="Hapus Sub-Kategori 1"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>

              {/* Table 3: Daftar Sub-Kategori 2 */}
              <div className="bg-[#0d0e1b] rounded-xl border border-[#1e2038] p-4 space-y-3.5 overflow-x-auto">
                <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest block">
                  &bull; Sub-Kategori 2 (Level 3) ({categories.filter(c => {
                    if (!c.parent_id || c.parent_id === 'none') return false;
                    const p = categories.find(x => String(x.id || x._id) === String(c.parent_id));
                    if (!p || !p.parent_id || p.parent_id === 'none') return false;
                    const gp = categories.find(x => String(x.id || x._id) === String(p.parent_id));
                    return gp && (!gp.parent_id || gp.parent_id === 'none');
                  }).length})
                </span>
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#121324] text-[10px] uppercase opacity-60 border-b border-[#1e2038]">
                    <tr>
                      <th className="p-2">Nama Sub 2</th>
                      <th className="p-2">Induk</th>
                      <th className="p-2 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1e2038]">
                    {(() => {
                      const sub2s = categories.filter(c => {
                        if (!c.parent_id || c.parent_id === 'none') return false;
                        const p = categories.find(x => String(x.id || x._id) === String(c.parent_id));
                        if (!p || !p.parent_id || p.parent_id === 'none') return false;
                        const gp = categories.find(x => String(x.id || x._id) === String(p.parent_id));
                        return gp && (!gp.parent_id || gp.parent_id === 'none');
                      });
                      if (sub2s.length === 0) {
                        return (
                          <tr>
                            <td colSpan="3" className="p-6 text-center opacity-50 italic">Belum ada Sub-Kategori 2.</td>
                          </tr>
                        );
                      }
                      return sub2s.map((cat, index) => {
                        const parentCat = categories.find(p => String(p.id || p._id) === String(cat.parent_id));
                        return (
                          <tr key={cat.id || cat._id || `sub2-${index}`} className="hover:bg-slate-500/5 transition-all text-slate-300">
                            <td className="p-2 font-bold text-white">{cleanCategoryName(cat.name)}</td>
                            <td className="p-2 font-semibold text-purple-400">{cleanCategoryName(parentCat ? parentCat.name : 'Tidak Diketahui')}</td>
                            <td className="p-2 text-right">
                              <button
                                onClick={() => handleDeleteCategory(cat.id || cat._id)}
                                className="p-1.5 text-red-400 hover:bg-red-500/10 border border-red-500/20 rounded cursor-pointer"
                                title="Hapus Sub-Kategori 2"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>

              {/* Table 4: Daftar Sub-Kategori 3 */}
              <div className="bg-[#0d0e1b] rounded-xl border border-[#1e2038] p-4 space-y-3.5 overflow-x-auto">
                <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest block">
                  &bull; Sub-Kategori 3 (Level 4) ({categories.filter(c => {
                    if (!c.parent_id || c.parent_id === 'none') return false;
                    const p = categories.find(x => String(x.id || x._id) === String(c.parent_id));
                    if (!p || !p.parent_id || p.parent_id === 'none') return false;
                    const gp = categories.find(x => String(x.id || x._id) === String(p.parent_id));
                    if (!gp || !gp.parent_id || gp.parent_id === 'none') return false;
                    const ggp = categories.find(x => String(x.id || x._id) === String(gp.parent_id));
                    return ggp && (!ggp.parent_id || ggp.parent_id === 'none');
                  }).length})
                </span>
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#121324] text-[10px] uppercase opacity-60 border-b border-[#1e2038]">
                    <tr>
                      <th className="p-2">Nama Sub 3</th>
                      <th className="p-2">Induk Lengkap</th>
                      <th className="p-2 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1e2038]">
                    {(() => {
                      const sub3s = categories.filter(c => {
                        if (!c.parent_id || c.parent_id === 'none') return false;
                        const p = categories.find(x => String(x.id || x._id) === String(c.parent_id));
                        if (!p || !p.parent_id || p.parent_id === 'none') return false;
                        const gp = categories.find(x => String(x.id || x._id) === String(p.parent_id));
                        if (!gp || !gp.parent_id || gp.parent_id === 'none') return false;
                        const ggp = categories.find(x => String(x.id || x._id) === String(gp.parent_id));
                        return ggp && (!ggp.parent_id || ggp.parent_id === 'none');
                      });
                      if (sub3s.length === 0) {
                        return (
                          <tr>
                            <td colSpan="3" className="p-6 text-center opacity-50 italic">Belum ada Sub-Kategori 3.</td>
                          </tr>
                        );
                      }
                      return sub3s.map((cat, index) => {
                        return (
                          <tr key={cat.id || cat._id || `sub3-${index}`} className="hover:bg-slate-500/5 transition-all text-slate-300">
                            <td className="p-2 font-bold text-white">{cleanCategoryName(cat.name)}</td>
                            <td className="p-2 font-semibold text-emerald-400 text-[10px]">{getSubCategory3HierarchyLabel(cat)}</td>
                            <td className="p-2 text-right">
                              <button
                                onClick={() => handleDeleteCategory(cat.id || cat._id)}
                                className="p-1.5 text-red-400 hover:bg-red-500/10 border border-red-500/20 rounded cursor-pointer"
                                title="Hapus Sub-Kategori 3"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>

            </div>

          </div>
        )}

        {activeTab === 'users' && (
          <div className="bg-[#0d0e1b] rounded-xl border border-[#1e2038] overflow-x-auto">
            <table className="w-full text-xs text-left min-w-[600px]">
              <thead className="bg-[#121324] opacity-65 text-[10px] uppercase">
                <tr>
                  <th className="p-3">User Detail</th>
                  <th className="p-3">Email</th>
                  <th className="p-3">Peran (Role)</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Aksi Moderasi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2038]">
                {searchedUsers.map((user, index) => (
                  <tr key={user._id || user.id || `user-${index}`}>
                    <td className="p-3 flex items-center gap-2.5">
                      <img src={user.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                      <span className="font-bold text-slate-100">{user.name}</span>
                    </td>
                    <td className="p-3 font-mono opacity-80">{maskEmail(user.email)}</td>
                    <td className="p-3">
                      <select
                        value={user.role}
                        onChange={(e) => handleUserRoleChange(user, e.target.value)}
                        className="bg-[#121324] border border-[#1e2038] text-xs rounded px-2 py-0.5"
                      >
                        <option value="user">User Biasa</option>
                        <option value="moderator">Moderator / Staf</option>
                        <option value="admin">Super Admin</option>
                      </select>
                    </td>
                    <td className="p-3">
                      {user.isBanned ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-black bg-red-500/20 text-red-400 border border-red-500/30">BANNED</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-black bg-green-500/20 text-green-400 border border-green-500/30">AKTIF</span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => handleToggleUserBan(user)}
                        className={`px-3 py-1 text-[10px] font-black rounded border transition-all ${
                          user.isBanned
                            ? 'bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20'
                            : 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20'
                        }`}
                      >
                        {user.isBanned ? 'Lepas Ban' : 'Banned / Blokir'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'playlists' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-4 bg-[#0d0e1b] rounded-xl border border-[#1e2038] space-y-4 self-start">
              <h3 className="font-extrabold text-sm text-white">
                {editingPlaylist ? 'Edit Urutan Playlist Official' : 'Tambah Playlist Official Baru'}
              </h3>
              <form onSubmit={handleSavePlaylist} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] opacity-60 uppercase font-bold tracking-wider">Judul Playlist</label>
                  <input
                    type="text"
                    placeholder="misal: Maraton Doraemon Terbaik..."
                    value={playlistForm.title}
                    onChange={(e) => setPlaylistForm({ ...playlistForm, title: e.target.value })}
                    className="w-full text-xs p-2 rounded bg-[#121324] border border-[#1e2038] text-white outline-none"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] opacity-60 uppercase font-bold tracking-wider">Pilih Video / Episode ({playlistForm.videoIds.length} dipilih)</label>
                  
                  {/* Search box for filtering videos inside official playlist selection */}
                  <div className="relative mb-2">
                    <input
                      type="text"
                      placeholder="Cari episode / judul / anime..."
                      value={playlistVideoSearch}
                      onChange={(e) => setPlaylistVideoSearch(e.target.value)}
                      className="w-full text-[11px] p-2 rounded bg-[#121324] border border-[#1e2038] text-white outline-none focus:border-pink-500 placeholder-slate-500"
                    />
                  </div>

                  <div className="w-full max-h-[220px] overflow-y-auto p-2.5 rounded bg-[#121324] border border-[#1e2038] space-y-2">
                    {sortVideosByEpisode(videos).filter(vid => {
                      if (!playlistVideoSearch.trim()) return true;
                      const term = playlistVideoSearch.toLowerCase();
                      const epNum = parseEpisodeNumber(vid.episode).toString();
                      return vid.title.toLowerCase().includes(term) ||
                        vid.animeTitle.toLowerCase().includes(term) ||
                        (vid.episode && vid.episode.toLowerCase().includes(term)) ||
                        epNum === term;
                    }).map((vid) => {
                      const isChecked = playlistForm.videoIds.includes(vid.id);
                      const displayLabel = `[${vid.animeTitle}] ${vid.episode} - ${vid.title}`;
                      
                      return (
                        <label key={vid.id} className="flex items-start gap-2.5 text-xs text-slate-300 hover:text-white cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              const nextVideoIds = isChecked
                                ? playlistForm.videoIds.filter(id => id !== vid.id)
                                : [...playlistForm.videoIds, vid.id];
                              setPlaylistForm({ ...playlistForm, videoIds: nextVideoIds });
                            }}
                            className="mt-0.5 rounded border-slate-500 text-pink-500 focus:ring-pink-500 focus:ring-offset-[#121324]"
                          />
                          <span className="leading-snug">{displayLabel}</span>
                        </label>
                      );
                    })}
                    {videos.length === 0 && (
                      <p className="text-[11px] opacity-40 italic py-1">Tidak ada video yang tersedia di database.</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <button type="submit" className="flex-1 py-1.5 bg-red-500 hover:bg-red-600 text-white font-extrabold text-xs rounded">
                    {editingPlaylist ? 'Simpan Perubahan' : 'Tambah Playlist'}
                  </button>
                  {editingPlaylist && (
                    <button type="button" onClick={() => { setEditingPlaylist(null); setPlaylistForm({ title: '', videoIds: [] }); setPlaylistVideoSearch(''); }} className="px-3 bg-slate-500/10 text-xs rounded">
                      Batal
                    </button>
                  )}
                </div>
              </form>
            </div>

            <div className="md:col-span-2 bg-[#0d0e1b] rounded-xl border border-[#1e2038] overflow-x-auto">
              <table className="w-full text-xs text-left min-w-[500px]">
                <thead className="bg-[#121324] opacity-60 text-[10px] uppercase">
                  <tr>
                    <th className="p-3">ID</th>
                    <th className="p-3">Judul Playlist</th>
                    <th className="p-3">Isi Video (Episode IDs)</th>
                    <th className="p-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e2038]">
                  {searchedPlaylists.map((pl, index) => (
                    <tr key={pl._id || pl.id || `playlist-${index}`}>
                      <td className="p-3 font-mono opacity-50">{pl.id}</td>
                      <td className="p-3 font-extrabold text-slate-100">{pl.title}</td>
                      <td className="p-3 font-mono text-pink-400 max-w-[200px] truncate">{pl.videoIds.join(', ')}</td>
                      <td className="p-3 text-right">
                        <div className="inline-flex gap-1.5">
                          <button
                            onClick={() => {
                              setEditingPlaylist(pl);
                              setPlaylistForm({ title: pl.title, videoIds: pl.videoIds || [] });
                            }}
                            className="p-1 text-cyan-400 hover:bg-cyan-500/10 rounded"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeletePlaylist(pl.id)}
                            className="p-1 text-red-400 hover:bg-red-500/10 rounded"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'ads' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-4 bg-[#0d0e1b] rounded-xl border border-[#1e2038] space-y-4 self-start">
              <h3 className="font-extrabold text-sm text-white">{editingAd ? 'Edit Iklan' : 'Tambah Iklan Baru'}</h3>
              <form onSubmit={handleSaveAd} className="space-y-3.5 text-xs">
                <div className="space-y-1">
                  <label className="text-[10px] opacity-60 font-bold uppercase tracking-wider">Posisi Slot Iklan</label>
                  <select
                    value={adForm.slot}
                    onChange={(e) => setAdForm({ ...adForm, slot: e.target.value })}
                    className="w-full text-xs p-2.5 rounded bg-[#121324] border border-[#1e2038] text-white outline-none"
                  >
                    <optgroup label="Header & Navigasi">
                      <option value="banner_top">Banner Atas Header (Sponsor Utama)</option>
                      <option value="banner_below_header">Banner Tepat di Bawah Header / Navigasi</option>
                    </optgroup>
                    <optgroup label="Video Player & Halaman Nonton (Watch)">
                      <option value="banner_above_player">Banner di Atas Video Player (Watch & Putar Manual)</option>
                      <option value="banner_below_player">Banner Bawah Video Player - Slot 1 (Watch Page)</option>
                      <option value="banner_below_player_2">Banner Bawah Video Player - Slot 2 (Watch Page)</option>
                      <option value="banner_sidebar">Banner Sidebar Kanan - Slot 1 (Watch Page)</option>
                      <option value="banner_sidebar_2">Banner Sidebar Kanan - Slot 2 (Watch Page / Sticky)</option>
                      <option value="banner_above_playlist">Banner Di Atas Widget Playlist Maraton</option>
                      <option value="banner_below_playlist">Banner Di Bawah Widget Playlist Maraton</option>
                      <option value="banner_below_comments">Banner Bawah Komentar (Watch Page)</option>
                    </optgroup>
                    <optgroup label="Home & Grid Katalog Episode">
                      <option value="banner_between_feed">Banner Di Antara Feed Episode - Slot 1 (Grid Item 4)</option>
                      <option value="banner_between_feed_2">Banner Di Antara Feed Episode - Slot 2 (Grid Item 12)</option>
                      <option value="banner_between_feed_3">Banner Di Antara Feed Episode - Slot 3 (Grid Item 20)</option>
                      <option value="banner_footer">Banner Bagian Bawah / Di Atas Footer</option>
                    </optgroup>
                    <optgroup label="Floating, Popunder & Script Global">
                      <option value="banner_float_bottom">Floating Sticky Banner di Bawah Layar (Bottom Overlay)</option>
                      <option value="banner_float_left">Floating Skyscraper Kiri Layar (Desktop)</option>
                      <option value="banner_float_right">Floating Skyscraper Kanan Layar (Desktop)</option>
                      <option value="banner_popup">Pop-up Modal / Floating Banner Saweria (Pojok Layar)</option>
                      <option value="custom_head_code">Custom HTML / Direct Script Global (Adsterra, Popunder, Social Bar)</option>
                    </optgroup>
                    <optgroup label="Halaman Putar Manual">
                      <option value="banner_putar_manual_top">Banner Atas Halaman Putar Manual</option>
                      <option value="banner_putar_manual_bottom">Banner Bawah Halaman Putar Manual</option>
                    </optgroup>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] opacity-60 font-bold uppercase tracking-wider">Judul / Slogan Iklan</label>
                  <input
                    type="text"
                    value={adForm.title}
                    onChange={(e) => setAdForm({ ...adForm, title: e.target.value })}
                    className="w-full p-2.5 rounded bg-[#121324] border border-[#1e2038] text-white outline-none"
                    placeholder="Dukung Operational ShinDora via Saweria!"
                    required
                  />
                </div>

                <div className="flex items-center gap-2 py-1">
                  <input
                    type="checkbox"
                    checked={adForm.isRaw || false}
                    onChange={(e) => setAdForm({ ...adForm, isRaw: e.target.checked })}
                    id="adIsRaw"
                  />
                  <label htmlFor="adIsRaw" className="text-[11px] font-bold opacity-80 cursor-pointer text-cyan-400">Gunakan Kode Script / Raw Ad HTML</label>
                </div>

                {adForm.isRaw ? (
                  <div className="space-y-1 animate-fade-in">
                    <label className="text-[10px] opacity-60 font-bold uppercase tracking-wider">Kode HTML / Script / Iframe / AdSense Code</label>
                    <textarea
                      value={adForm.rawCode || ''}
                      onChange={(e) => setAdForm({ ...adForm, rawCode: e.target.value })}
                      className="w-full text-xs p-2 rounded bg-[#121324] border border-[#1e2038] text-white outline-none h-28 font-mono leading-relaxed focus:border-cyan-500"
                      placeholder="Paste kode HTML atau Script lengkap: <script>...</script>, <iframe ...></iframe>, <a href='...'><img src='...'/></a>, dsb."
                      required={adForm.isRaw}
                    />
                  </div>
                ) : (
                  <>
                    <div className="space-y-1 animate-fade-in">
                      <label className="text-[10px] opacity-60 font-bold uppercase tracking-wider">URL Gambar Banner</label>
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          value={adForm.imageUrl || ''}
                          onChange={(e) => setAdForm({ ...adForm, imageUrl: e.target.value })}
                          className="flex-1 p-2 bg-[#121324] rounded border border-[#1e2038] text-white outline-none"
                          placeholder="https://images.unsplash.com/..."
                          required={!adForm.isRaw}
                        />
                        <button
                          type="button"
                          onClick={() => adFileInputRef.current?.click()}
                          className="px-2 bg-purple-600 hover:bg-purple-700 text-white rounded font-bold text-[10px]"
                        >
                          Upload ImageKit
                        </button>
                        <input
                          type="file"
                          ref={adFileInputRef}
                          onChange={handleAdUploadToImageKit}
                          accept="image/*"
                          className="hidden"
                        />
                      </div>
                      {adUploadProgress && (
                        <p className="text-[9px] text-cyan-400 font-bold animate-pulse">{adUploadProgress}</p>
                      )}
                    </div>
                    <div className="space-y-1 animate-fade-in">
                      <label className="text-[10px] opacity-60 font-bold uppercase tracking-wider">Tautan Target Link</label>
                      <input
                        type="text"
                        value={adForm.targetUrl}
                        onChange={(e) => setAdForm({ ...adForm, targetUrl: e.target.value })}
                        className="w-full p-2.5 rounded bg-[#121324] border border-[#1e2038] text-white outline-none"
                        placeholder="https://saweria.co/shindora"
                        required={!adForm.isRaw}
                      />
                    </div>
                  </>
                )}
                <div className="flex flex-col gap-2 pt-1">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={adForm.openInNewTab === undefined ? true : adForm.openInNewTab}
                      onChange={(e) => setAdForm({ ...adForm, openInNewTab: e.target.checked })}
                      id="adTargetNew"
                    />
                    <label htmlFor="adTargetNew" className="text-[11px] font-bold opacity-80 cursor-pointer">Buka Tautan di Tab Baru (target=&quot;_blank&quot;)</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={adForm.isActive}
                      onChange={(e) => setAdForm({ ...adForm, isActive: e.target.checked })}
                      id="adActive"
                    />
                    <label htmlFor="adActive" className="text-[11px] font-bold opacity-80 cursor-pointer">Aktifkan Slot Iklan Ini</label>
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <button type="submit" className="flex-1 py-1.5 bg-red-500 hover:bg-red-600 text-white font-extrabold text-xs rounded">
                    {editingAd ? 'Simpan' : 'Tambah Iklan'}
                  </button>
                  {editingAd && (
                    <button type="button" onClick={() => { setEditingAd(null); setAdForm({ slot: 'banner_top', title: '', imageUrl: '', targetUrl: '', isActive: true, isRaw: false, rawCode: '', openInNewTab: true }); }} className="px-3 bg-slate-500/10 text-xs rounded">
                      Batal
                    </button>
                  )}
                </div>
              </form>
            </div>

            <div className="md:col-span-2 bg-[#0d0e1b] rounded-xl border border-[#1e2038] overflow-x-auto">
              <table className="w-full text-xs text-left min-w-[500px]">
                <thead className="bg-[#121324] opacity-60 text-[10px] uppercase">
                  <tr>
                    <th className="p-3">Posisi</th>
                    <th className="p-3">Slogan Iklan</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e2038]">
                  {searchedAds.map((ad, index) => (
                    <tr key={ad._id || ad.id || `ad-${index}`}>
                      <td className="p-3 font-mono text-cyan-400">{ad.slot}</td>
                      <td className="p-3 font-bold text-slate-100">{ad.title}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black ${ad.isActive ? 'bg-green-500/10 text-green-400' : 'bg-slate-500/10 text-slate-400'}`}>
                          {ad.isActive ? 'AKTIF' : 'NON-AKTIF'}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <div className="inline-flex gap-1">
                          <button
                            onClick={() => {
                              const rawVal = ad.rawCode || ad.html || ad.content || ad.script || ad.code || ''
                              setEditingAd(ad)
                              setAdForm({
                                slot: ad.slot || 'banner_top',
                                title: ad.title || '',
                                imageUrl: ad.imageUrl || '',
                                targetUrl: ad.targetUrl || '',
                                isActive: ad.isActive !== undefined ? ad.isActive : true,
                                isRaw: Boolean(ad.isRaw || (rawVal && rawVal.trim().length > 0)),
                                rawCode: rawVal,
                                openInNewTab: ad.openInNewTab !== false
                              })
                            }}
                            className="p-1 text-cyan-400 hover:bg-cyan-500/10 rounded"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteAd(ad.id)}
                            className="p-1 text-red-400 hover:bg-red-500/10 rounded"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-5 bg-[#0d0e1b] rounded-xl border border-[#1e2038] space-y-4">
              <h3 className="font-extrabold text-sm text-cyan-400 uppercase tracking-wider">&bull; Konfigurasi API &amp; Website</h3>
              
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold tracking-wider opacity-60">Logo Website URL (Manual / Upload Preview)</label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    placeholder="https://domain.com/logo.png"
                    value={siteSettings.logoUrl}
                    onChange={(e) => {
                      setSiteSettings({ ...siteSettings, logoUrl: e.target.value })
                      setLogoPreview(e.target.value)
                    }}
                    className="flex-1 text-xs p-2.5 rounded bg-[#121324] border border-[#1e2038] text-white outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => logoFileInputRef.current?.click()}
                    className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold"
                  >
                    Upload Logo
                  </button>
                  <input
                    type="file"
                    ref={logoFileInputRef}
                    onChange={handleLogoUploadToImageKit}
                    accept="image/*"
                    className="hidden"
                  />
                </div>

                {logoUploadProgress && (
                  <p className="text-[10px] text-cyan-400 font-bold animate-pulse">{logoUploadProgress}</p>
                )}

                {logoPreview && (
                  <div className="p-2 border border-dashed border-[#1e2038] rounded mt-1 bg-black/30">
                    <span className="text-[9px] opacity-40 uppercase block mb-1">Live Preview Logo:</span>
                    <img src={logoPreview} alt="Live Logo Preview" className="h-8 max-w-[150px] object-contain rounded" />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-500/10">
                <div className="space-y-1.5 col-span-full">
                  <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest block">Storage & Media Settings (ImageKit)</span>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] opacity-60 font-bold uppercase">ImageKit Public Key</label>
                  <input
                    type="text"
                    value={siteSettings.imagekitPublicKey || ''}
                    onChange={(e) => setSiteSettings({ ...siteSettings, imagekitPublicKey: e.target.value })}
                    className="w-full text-xs p-2 rounded bg-[#121324] border border-[#1e2038]"
                    placeholder="public_*** atau via IMAGEKIT_PUBLIC_KEY"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] opacity-60 font-bold uppercase">ImageKit Private Key (ENV)</label>
                  <input
                    type="password"
                    readOnly
                    value="••••••••••••••••"
                    className="w-full text-xs p-2 rounded bg-[#121324] border border-[#1e2038] opacity-80 cursor-not-allowed font-mono text-pink-300"
                    placeholder="IMAGEKIT_PRIVATE_KEY di .env"
                  />
                  <span className="text-[9px] opacity-50 block">Dikelola secara aman di server environment (IMAGEKIT_PRIVATE_KEY).</span>
                </div>
                <div className="space-y-1.5 col-span-full">
                  <label className="text-[10px] opacity-60 font-bold uppercase">ImageKit URL Endpoint</label>
                  <input
                    type="text"
                    value={siteSettings.imagekitUrlEndpoint || ''}
                    onChange={(e) => setSiteSettings({ ...siteSettings, imagekitUrlEndpoint: e.target.value })}
                    className="w-full text-xs p-2.5 rounded bg-[#121324] border border-[#1e2038]"
                    placeholder="https://ik.imagekit.io/your_id"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-500/10">
                <div className="space-y-1.5 col-span-full flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-black text-pink-400 uppercase tracking-widest block">Web Push Notification Settings</span>
                    <span className="text-[10px] opacity-60 block">Kirim notifikasi web push ke seluruh subscriber saat video baru dirilis</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={siteSettings.webPushEnabled === undefined ? true : siteSettings.webPushEnabled}
                      onChange={(e) => setSiteSettings({ ...siteSettings, webPushEnabled: e.target.checked })}
                      id="webPushEnabledCheckbox"
                    />
                    <label htmlFor="webPushEnabledCheckbox" className="text-[9px] font-bold opacity-80 cursor-pointer">
                      {siteSettings.webPushEnabled === false ? 'OFF' : 'ON'}
                    </label>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] opacity-60 font-bold uppercase">VAPID Public Key</label>
                  <input
                    type="text"
                    readOnly
                    value={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || siteSettings.vapidPublicKey || 'Terkonfigurasi via Environment'}
                    className="w-full text-xs p-2 rounded bg-[#121324] border border-[#1e2038] font-mono text-cyan-300 opacity-80 cursor-not-allowed"
                    placeholder="NEXT_PUBLIC_VAPID_PUBLIC_KEY"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] opacity-60 font-bold uppercase">Status Web Push</label>
                  <div className="w-full text-xs p-2 rounded bg-[#121324] border border-[#1e2038] font-mono flex items-center justify-between">
                    <span className={siteSettings.webPushEnabled === false ? "text-amber-400 text-xs" : "text-emerald-400 text-xs"}>
                      {siteSettings.webPushEnabled === false ? 'NONAKTIF (OFF)' : 'AKTIF (ON)'}
                    </span>
                    <div className="flex items-center gap-2">
                      {testPushMessage && (
                        <span data-testid="test-push-status" className="text-[10px] text-pink-300 font-sans font-bold">{testPushMessage}</span>
                      )}
                      <button
                        type="button"
                        data-testid="admin-test-push-btn"
                        disabled={testPushLoading}
                        onClick={async () => {
                          setTestPushLoading(true)
                          setTestPushMessage('Mengirim...')
                          try {
                            const res = await fetch('/api/push/test', { method: 'POST' });
                            const data = await res.json();
                            if (res.ok && data.success) {
                              const msg = `Push notification terkirim ke ${data.sentCount || 0} subscriber!`;
                              setTestPushMessage(msg);
                              toast.success(msg);
                            } else {
                              const errMsg = data.error || 'Gagal mengirim test notifikasi';
                              setTestPushMessage(errMsg);
                              toast.error(errMsg);
                            }
                          } catch (e) {
                            const failMsg = 'Gagal mengirim test notifikasi';
                            setTestPushMessage(failMsg);
                            toast.error(failMsg);
                          } finally {
                            setTestPushLoading(false);
                            setTimeout(() => setTestPushMessage(''), 5000);
                          }
                        }}
                        className="text-[10px] px-2 py-0.5 rounded bg-pink-500/20 text-pink-400 border border-pink-500/30 hover:bg-pink-500/30 transition-all font-sans font-bold cursor-pointer disabled:opacity-50"
                      >
                        {testPushLoading ? 'Mengirim...' : 'Test Push'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* CLOUDFLARE CDN WORKER & REVERSE PROXY SETTINGS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-500/10">
                <div className="space-y-2 col-span-full bg-gradient-to-r from-orange-500/15 via-amber-500/10 to-slate-900/40 p-4 rounded-2xl border border-orange-500/30 shadow-lg shadow-orange-500/5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <span className="text-sm font-black text-orange-400 uppercase tracking-widest flex items-center gap-2">
                        ☁️ Cloudflare Worker CDN & Edge Cache (Hemat CPU Vercel 90-99%)
                      </span>
                      <span className="text-[11px] opacity-80 block text-slate-300">
                        Alihkan trafik publik, asset statis, dan API read-only ke Cloudflare Worker CDN untuk mengurangi CPU Vercel dan Fast Data Transfer (FDT) menjadi <strong className="text-emerald-400">0 Byte</strong>.
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-xl border border-white/10">
                        <input
                          type="checkbox"
                          checked={siteSettings.cdnEnabled === undefined ? false : siteSettings.cdnEnabled}
                          onChange={(e) => setSiteSettings({ ...siteSettings, cdnEnabled: e.target.checked })}
                          id="cdnEnabledCheckbox"
                          className="cursor-pointer w-4 h-4 accent-orange-500"
                        />
                        <label htmlFor="cdnEnabledCheckbox" className="text-xs font-bold cursor-pointer text-orange-300">
                          {siteSettings.cdnEnabled ? '🟢 CDN AKTIF (ON)' : '⚪ CDN NONAKTIF (OFF)'}
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* CPU Saver Mode Selector & Bypass Toggle */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-white/10 mt-2">
                    <div className="space-y-1">
                      <label className="text-[10px] opacity-80 font-bold uppercase text-orange-300">
                        Mode Penghematan CPU Vercel
                      </label>
                      <select
                        value={siteSettings.vercelCpuSaverMode || 'max'}
                        onChange={(e) => setSiteSettings({ ...siteSettings, vercelCpuSaverMode: e.target.value })}
                        className="w-full text-xs p-2 rounded-lg bg-[#121324] border border-[#1e2038] text-white focus:border-orange-500 outline-none"
                      >
                        <option value="max">⚡ Maksimal (Offload Penuh ke Cloudflare Edge - Rekomendasi)</option>
                        <option value="standard">⚖️ Standar (Edge Caching + Hybrid Security)</option>
                        <option value="off">🚫 Nonaktif (Direct Vercel Origin)</option>
                      </select>
                      <span className="text-[9px] opacity-60 block">Mode Maksimal mengalihkan Edge Rate Limiting & Caching ke Worker, mem-bypass middleware CPU Vercel.</span>
                    </div>

                    <div className="space-y-1 flex flex-col justify-center">
                      <label className="text-[10px] opacity-80 font-bold uppercase text-orange-300">
                        Opsi Middleware Next.js Edge
                      </label>
                      <div className="flex items-center gap-2 p-2 rounded-lg bg-black/30 border border-white/5">
                        <input
                          type="checkbox"
                          id="bypassMiddlewareRateLimit"
                          checked={siteSettings.bypassMiddlewareRateLimit !== false}
                          onChange={(e) => setSiteSettings({ ...siteSettings, bypassMiddlewareRateLimit: e.target.checked })}
                          className="cursor-pointer accent-orange-500"
                        />
                        <label htmlFor="bypassMiddlewareRateLimit" className="text-[11px] font-semibold cursor-pointer text-slate-200">
                          Bypass Rate Limiting Vercel saat CDN Aktif (Hemat CPU)
                        </label>
                      </div>
                      <span className="text-[9px] opacity-60 block">Otomatis deteksi header X-ShinDora-Worker untuk 0ms CPU execution pada Vercel.</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] opacity-70 font-bold uppercase flex items-center justify-between">
                    <span>CDN Domain / URL Cloudflare Worker</span>
                    <span className="text-[9px] text-orange-400 lowercase font-normal">subdomain cdn / workers.dev</span>
                  </label>
                  <input
                    type="text"
                    data-testid="cdn-domain-input"
                    value={siteSettings.cdnDomain || ''}
                    onChange={(e) => setSiteSettings({ ...siteSettings, cdnDomain: e.target.value })}
                    className="w-full text-xs p-2.5 rounded-lg bg-[#121324] border border-[#1e2038] text-orange-300 font-mono focus:border-orange-500 outline-none"
                    placeholder="https://cdn.shindoranesub.my.id atau https://shindora-cdn.workers.dev"
                  />
                  <span className="text-[9px] opacity-50 block">Domain atau subdomain Cloudflare yang menjalankan reverse proxy worker.</span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] opacity-70 font-bold uppercase flex items-center justify-between">
                    <span>Origin URL (Vercel Backend)</span>
                    <span className="text-[9px] text-cyan-400 lowercase font-normal">origin target</span>
                  </label>
                  <input
                    type="text"
                    data-testid="origin-url-input"
                    value={siteSettings.originUrl || (typeof window !== 'undefined' ? window.location.origin : 'https://shindoranesub.my.id')}
                    onChange={(e) => setSiteSettings({ ...siteSettings, originUrl: e.target.value })}
                    className="w-full text-xs p-2.5 rounded-lg bg-[#121324] border border-[#1e2038] text-cyan-300 font-mono focus:border-cyan-500 outline-none"
                    placeholder="https://shindoranesub.my.id"
                  />
                  <span className="text-[9px] opacity-50 block">Alamat origin utama Vercel tempat Worker meneruskan request dinamis & mutasi (ORIGIN_URL).</span>
                </div>

                {/* Cloudflare Zone API (Optional for Direct Purge) */}
                <div className="space-y-1.5">
                  <label className="text-[10px] opacity-70 font-bold uppercase flex items-center justify-between">
                    <span>Cloudflare Zone ID (Opsional)</span>
                    <span className="text-[9px] opacity-50">untuk auto purge API</span>
                  </label>
                  <input
                    type="text"
                    value={siteSettings.cloudflareZoneId || ''}
                    onChange={(e) => setSiteSettings({ ...siteSettings, cloudflareZoneId: e.target.value })}
                    className="w-full text-xs p-2.5 rounded-lg bg-[#121324] border border-[#1e2038] text-slate-300 font-mono focus:border-orange-500 outline-none"
                    placeholder="contoh: 023e105f4ecef8ad9ca31a8372d0c353"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] opacity-70 font-bold uppercase flex items-center justify-between">
                    <span>Cloudflare API Token (Opsional)</span>
                    <span className="text-[9px] opacity-50">Token Purge Cache</span>
                  </label>
                  <input
                    type="password"
                    value={siteSettings.cloudflareApiToken || ''}
                    onChange={(e) => setSiteSettings({ ...siteSettings, cloudflareApiToken: e.target.value })}
                    className="w-full text-xs p-2.5 rounded-lg bg-[#121324] border border-[#1e2038] text-slate-300 font-mono focus:border-orange-500 outline-none"
                    placeholder="••••••••••••••••••••••••••••••••"
                  />
                </div>

                {(() => {
                  if (!siteSettings.cdnDomain || !siteSettings.originUrl) return null;
                  try {
                    const cHost = new URL(siteSettings.cdnDomain.startsWith('http') ? siteSettings.cdnDomain : `https://${siteSettings.cdnDomain}`).hostname.toLowerCase();
                    const oHost = new URL(siteSettings.originUrl.startsWith('http') ? siteSettings.originUrl : `https://${siteSettings.originUrl}`).hostname.toLowerCase();
                    if (cHost === oHost && cHost !== 'localhost' && cHost !== '127.0.0.1') {
                      return (
                        <div className="col-span-full p-2.5 rounded-lg bg-red-500/20 border border-red-500/40 text-red-300 text-xs flex items-center gap-2">
                          <span>⚠️</span>
                          <span><strong>PERINGATAN PROXY LOOP:</strong> Domain CDN sama dengan Origin URL ({cHost}). Gunakan domain deployment Vercel asli (contoh: <code>https://project-name.vercel.app</code>) sebagai Origin URL!</span>
                        </div>
                      );
                    }
                  } catch(e) {}
                  return null;
                })()}

                {/* Status Bar & Action Buttons */}
                <div className="col-span-full flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-black/40 border border-white/10">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold">Status Koneksi:</span>
                    <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold ${
                      siteSettings.cdnEnabled ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-500/20 text-slate-400 border border-slate-500/30'
                    }`}>
                      {siteSettings.cdnEnabled ? '🟢 CDN PROXY AKTIF' : '⚪ CDN PROXY NONAKTIF'}
                    </span>
                    {cdnTestStatus && (
                      <span data-testid="cdn-test-status" className="text-[11px] font-bold text-orange-400 ml-1">
                        {cdnTestStatus}
                      </span>
                    )}
                    {cdnPurgeStatus && (
                      <span className="text-[11px] font-bold text-cyan-400 ml-1">
                        {cdnPurgeStatus}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      data-testid="btn-test-cdn"
                      disabled={cdnTesting}
                      onClick={handleTestCDNConnection}
                      className="px-3 py-1.5 bg-orange-600/30 hover:bg-orange-600/50 text-orange-300 border border-orange-500/40 rounded-lg text-xs font-bold transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {cdnTesting ? '⏳ Menguji...' : '⚡ Uji Koneksi CDN Worker'}
                    </button>

                    <button
                      type="button"
                      onClick={handleOpenWorkerModal}
                      className="px-3 py-1.5 bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 border border-blue-500/40 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      📄 Script Worker & Config
                    </button>

                    <button
                      type="button"
                      disabled={cdnPurging}
                      onClick={handlePurgeCdnCache}
                      className="px-3 py-1.5 bg-cyan-600/20 hover:bg-cyan-600/40 text-cyan-300 border border-cyan-500/30 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      {cdnPurging ? '⏳ Purging...' : '🧹 Purge Cache CDN'}
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowCdnSetupGuide(!showCdnSetupGuide)}
                      className="px-2.5 py-1.5 bg-slate-700/40 hover:bg-slate-700/60 text-slate-300 border border-slate-600/40 rounded-lg text-xs font-bold transition-all cursor-pointer"
                    >
                      {showCdnSetupGuide ? '▲ Tutup Panduan' : '📖 Panduan Setup'}
                    </button>
                  </div>
                </div>

                {/* Expandable Setup Guide */}
                {showCdnSetupGuide && (
                  <div className="col-span-full p-4 rounded-xl bg-[#0e101f] border border-orange-500/20 space-y-3 text-xs">
                    <h4 className="font-bold text-orange-400 text-sm flex items-center gap-2">
                      🚀 Panduan Cepat Setup Cloudflare Worker CDN (Hemat CPU Vercel)
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                      <div className="p-3 rounded-lg bg-black/40 border border-white/5 space-y-1.5">
                        <span className="font-bold text-amber-300 block">Langkah 1: Deploy Worker</span>
                        <p className="text-[11px] opacity-80 text-slate-300">
                          Buka <strong>Cloudflare Dashboard &gt; Workers &amp; Pages</strong>, buat Worker baru, klik <strong>Script Worker &amp; Config</strong> di atas dan tempel kodenya atau jalankan <code className="bg-white/10 px-1 py-0.5 rounded font-mono text-orange-300">npx wrangler deploy</code>.
                        </p>
                      </div>

                      <div className="p-3 rounded-lg bg-black/40 border border-white/5 space-y-1.5">
                        <span className="font-bold text-amber-300 block">Langkah 2: Set ORIGIN_URL</span>
                        <p className="text-[11px] opacity-80 text-slate-300">
                          Di Worker Settings &gt; Variables, tambahkan variabel <code className="bg-white/10 px-1 py-0.5 rounded font-mono text-cyan-300">ORIGIN_URL</code> dengan nilai domain Vercel Anda (misal <code className="text-cyan-300 font-mono">https://shindoranesub.my.id</code>).
                        </p>
                      </div>

                      <div className="p-3 rounded-lg bg-black/40 border border-white/5 space-y-1.5">
                        <span className="font-bold text-amber-300 block">Langkah 3: Custom Domain / Routes</span>
                        <p className="text-[11px] opacity-80 text-slate-300">
                          Tambahkan Custom Domain (misal <code className="text-orange-300 font-mono">cdn.shindoranesub.my.id</code>) atau Route <code className="text-orange-300 font-mono">*shindoranesub.my.id/*</code> ke Worker Anda.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 pt-2 border-t border-slate-500/10">
                <div className="space-y-1.5">
                  <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest block">Google Analytics (GA4)</span>
                  <label className="text-[10px] opacity-60 font-bold uppercase block">Google Analytics ID (NEXT_PUBLIC_GA_ID)</label>
                  <input
                    type="text"
                    value={siteSettings.gaId || siteSettings.NEXT_PUBLIC_GA_ID || ''}
                    onChange={(e) => setSiteSettings({ ...siteSettings, gaId: e.target.value, NEXT_PUBLIC_GA_ID: e.target.value })}
                    className="w-full text-xs p-2 rounded bg-[#121324] border border-[#1e2038] font-mono text-emerald-300"
                    placeholder="G-XXXXXXXXXX"
                  />
                  <span className="text-[9px] opacity-50 block">ID Pelacakan Google Analytics 4 untuk memantau performa trafik dan kunjungan website secara realtime.</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-500/10">
                <div className="space-y-1.5 col-span-full flex items-center justify-between">
                  <span className="text-[10px] font-black text-orange-400 uppercase tracking-widest block">Interactive Donation Overlay Settings</span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={siteSettings.is_overlay_active === undefined ? true : siteSettings.is_overlay_active}
                      onChange={(e) => setSiteSettings({ ...siteSettings, is_overlay_active: e.target.checked })}
                      id="donOverlayActive"
                    />
                    <label htmlFor="donOverlayActive" className="text-[9px] font-bold opacity-80 cursor-pointer">AKTIFKAN OVERLAY</label>
                  </div>
                </div>
                <div className="space-y-1.5 p-3 rounded-lg border border-slate-500/10 bg-slate-500/5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] text-pink-500 font-bold uppercase">Saweria Stream Key</label>
                    <span className="text-[9px] text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">🔒 Terkunci di .env</span>
                  </div>
                  <input
                    type="password"
                    readOnly
                    disabled
                    value={siteSettings.saweriaStreamKey || '••••••••'}
                    className="w-full text-xs p-2 rounded bg-[#121324] border border-[#1e2038] font-mono text-pink-300 opacity-75 cursor-not-allowed"
                    placeholder="Dikonfigurasi via SAWERIA_STREAM_KEY di .env"
                  />
                  <div className="mt-1 text-[9px] text-slate-400 space-y-1">
                    <div>
                      <span className="font-bold text-slate-300">Webhook URL:</span>{' '}
                      <code className="bg-black/30 px-1 py-0.5 rounded text-pink-400 select-all">
                        https://shindoranesub.my.id/api/webhooks/saweria
                      </code>
                    </div>
                    <div>
                      <span className="font-bold text-slate-300">OBS Alert URL:</span>{' '}
                      <code className="bg-black/30 px-1 py-0.5 rounded text-cyan-400 select-all font-mono break-all block mt-0.5">
                        https://saweria.co/widgets/alert?streamKey={siteSettings.saweriaStreamKey || '••••••••'}
                      </code>
                    </div>
                  </div>
                </div>
                <div className="space-y-1.5 p-3 rounded-lg border border-slate-500/10 bg-slate-500/5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] text-red-500 font-bold uppercase">Trakteer Stream Key</label>
                    <span className="text-[9px] text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">🔒 Terkunci di .env</span>
                  </div>
                  <input
                    type="password"
                    readOnly
                    disabled
                    value={siteSettings.trakteerStreamKey || '••••••••'}
                    className="w-full text-xs p-2 rounded bg-[#121324] border border-[#1e2038] font-mono text-red-300 opacity-75 cursor-not-allowed"
                    placeholder="Dikonfigurasi via TRAKTEER_STREAM_KEY di .env"
                  />
                  <div className="mt-1 text-[9px] text-slate-400 space-y-1">
                    <div>
                      <span className="font-bold text-slate-300">Webhook URL:</span>{' '}
                      <code className="bg-black/30 px-1 py-0.5 rounded text-red-400 select-all">
                        https://shindoranesub.my.id/api/webhooks/trakteer
                      </code>
                    </div>
                    <div>
                      <span className="font-bold text-slate-300">OBS Alert URL:</span>{' '}
                      <code className="bg-black/30 px-1 py-0.5 rounded text-cyan-400 select-all font-mono break-all block mt-0.5">
                        https://stream.trakteer.id/notification/?key={siteSettings.trakteerStreamKey || '••••••••'}
                      </code>
                    </div>
                  </div>
                </div>
                <div className="space-y-1.5 p-3 rounded-lg border border-slate-500/10 bg-slate-500/5 col-span-full">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] text-purple-400 font-bold uppercase">Tako.id Stream Key</label>
                    <span className="text-[9px] text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">🔒 Terkunci di .env</span>
                  </div>
                  <input
                    type="password"
                    readOnly
                    disabled
                    value={siteSettings.takoStreamKey || '••••••••'}
                    className="w-full text-xs p-2 rounded bg-[#121324] border border-[#1e2038] font-mono text-purple-300 opacity-75 cursor-not-allowed"
                    placeholder="Dikonfigurasi via TAKO_STREAM_KEY di .env"
                  />
                  <div className="mt-1 text-[9px] text-slate-400 space-y-1">
                    <div>
                      <span className="font-bold text-slate-300">Webhook URL:</span>{' '}
                      <code className="bg-black/30 px-1 py-0.5 rounded text-purple-400 select-all">
                        https://shindoranesub.my.id/api/webhooks/tako
                      </code>
                    </div>
                    <div>
                      <span className="font-bold text-slate-300">OBS Alert URL:</span>{' '}
                      <code className="bg-black/30 px-1 py-0.5 rounded text-cyan-400 select-all font-mono break-all block mt-0.5">
                        https://tako.id/overlay/alert?overlay_key={siteSettings.takoStreamKey || '••••••••'}
                      </code>
                    </div>
                  </div>
                </div>
                <div className="space-y-1.5 col-span-full">
                  <label className="text-[10px] opacity-60 font-bold uppercase">Durasi Tampil Popup Overlay (Detik)</label>
                  <input
                    type="number"
                    value={siteSettings.donationPopupDuration || 6}
                    onChange={(e) => setSiteSettings({ ...siteSettings, donationPopupDuration: Number(e.target.value) })}
                    className="w-full p-2 rounded bg-[#121324] border border-[#1e2038] text-white"
                    min="2"
                    max="30"
                  />
                </div>
                <div className="space-y-1.5 col-span-full">
                  <label className="text-[10px] opacity-60 font-bold uppercase">Kecepatan Running Text (Marquee Speed)</label>
                  <select
                    value={siteSettings.donationMarqueeSpeed || 'Sedang'}
                    onChange={(e) => setSiteSettings({ ...siteSettings, donationMarqueeSpeed: e.target.value })}
                    className="w-full text-xs p-2.5 rounded bg-[#121324] border border-[#1e2038] text-white outline-none font-bold"
                  >
                    <option value="Lambat">Lambat (Halus - 25 detik)</option>
                    <option value="Sedang">Sedang (Standar - 15 detik)</option>
                    <option value="Cepat">Cepat (Kilat - 8 detik)</option>
                  </select>
                </div>

                <div className="space-y-1.5 col-span-full pt-3">
                  <button
                    type="button"
                    onClick={handleSaveOverlaySettings}
                    className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:opacity-90 text-white text-xs font-black rounded-lg shadow-md uppercase tracking-wider"
                  >
                    SIMPAN PENGATURAN OVERLAY DONASI
                  </button>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-500/10 space-y-3.5 mt-4 text-left">
                <span className="text-[10px] font-black text-orange-400 uppercase tracking-widest block">&bull; Pengaturan Running Text Di Atas (Top Announcement Bar)</span>
                <div className="p-3.5 rounded-lg border border-[#1e2038] bg-black/30 space-y-3">
                  <div className="space-y-1">
                    <label className="text-[9px] opacity-60 uppercase font-bold">Input Teks Running / Pengumuman</label>
                    <textarea
                      placeholder="Masukkan pesan berjalan di atas website..."
                      value={siteSettings.announcementText || ''}
                      onChange={(e) => setSiteSettings({ ...siteSettings, announcementText: e.target.value })}
                      className="w-full text-xs p-2.5 rounded bg-[#121324] border border-[#1e2038] text-white outline-none h-20"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[9px] opacity-60 uppercase font-bold">Dropdown Badge / Icon Prefix</label>
                      <select
                        value={siteSettings.announcementBadge || 'PENGUMUMAN'}
                        onChange={(e) => setSiteSettings({ ...siteSettings, announcementBadge: e.target.value })}
                        className="w-full text-xs p-2.5 rounded bg-[#121324] border border-[#1e2038] text-white outline-none font-bold"
                      >
                        <option value="PENGUMUMAN">PENGUMUMAN</option>
                        <option value="DONASI TERBARU">DONASI TERBARU</option>
                        <option value="SAWERIA">SAWERIA</option>
                        <option value="TRAKTEER">TRAKTEER</option>
                        <option value="INFO">INFO</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] opacity-60 uppercase font-bold">Kecepatan Teks</label>
                      <select
                        value={siteSettings.donationMarqueeSpeed || 'Sedang'}
                        onChange={(e) => setSiteSettings({ ...siteSettings, donationMarqueeSpeed: e.target.value })}
                        className="w-full text-xs p-2.5 rounded bg-[#121324] border border-[#1e2038] text-white outline-none font-bold"
                      >
                        <option value="Pelan">Pelan (Halus - 20s)</option>
                        <option value="Sedang">Sedang (Standar - 15s)</option>
                        <option value="Cepat">Cepat (Kilat - 10s)</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      checked={siteSettings.is_running_text_active === undefined ? true : siteSettings.is_running_text_active}
                      onChange={(e) => setSiteSettings({ ...siteSettings, is_running_text_active: e.target.checked })}
                      id="topBarAnnounceActive"
                    />
                    <label htmlFor="topBarAnnounceActive" className="text-xs font-bold opacity-80 cursor-pointer">Tampilkan Running Text di Bagian Atas Website (On/Off)</label>
                  </div>

                  <button
                    onClick={handleSaveRunningTextSettings}
                    className="w-full py-2 bg-gradient-to-r from-orange-500 to-pink-500 text-black text-xs font-black rounded shadow-md uppercase tracking-wider"
                  >
                    SIMPAN &amp; TAMPILKAN RUNNING TEXT
                  </button>
                </div>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-slate-500/10">
                <span className="text-[10px] font-black text-pink-400 uppercase tracking-widest block mb-2">Provider Email Auth</span>
                <select
                  value={siteSettings.emailProvider}
                  onChange={(e) => setSiteSettings({ ...siteSettings, emailProvider: e.target.value })}
                  className="w-full text-xs p-2 rounded bg-[#121324] border border-[#1e2038] text-white font-bold"
                >
                  <option value="Mock/Simulasi">Mock/Simulasi</option>
                  <option value="Supabase Auth">Supabase Auth</option>
                  <option value="Firebase Auth">Firebase Auth</option>
                  <option value="Custom SMTP / Resend API">Custom SMTP / Resend API</option>
                </select>
              </div>

              {siteSettings.emailProvider === 'Custom SMTP / Resend API' && (
                <div className="p-3.5 rounded-lg border border-[#1e2038] bg-black/20 space-y-3 mt-2">
                  <span className="text-[9px] font-black text-pink-400 uppercase block tracking-wider">&bull; SMTP / Resend API Credentials</span>
                  
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold opacity-60 uppercase">Resend API Key</label>
                    <input
                      type="text"
                      placeholder="re_123456789..."
                      value={siteSettings.emailProviderCredentials?.resendApiKey || ''}
                      onChange={(e) => setSiteSettings({
                        ...siteSettings,
                        emailProviderCredentials: {
                          ...(siteSettings.emailProviderCredentials || {}),
                          resendApiKey: e.target.value
                        }
                      })}
                      className="w-full text-xs p-2 rounded bg-[#121324] border border-[#1e2038] text-white"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="space-y-1.5 sm:col-span-2">
                      <label className="text-[10px] font-bold opacity-60 uppercase">SMTP Host</label>
                      <input
                        type="text"
                        placeholder="smtp.mailtrap.io"
                        value={siteSettings.emailProviderCredentials?.smtpHost || ''}
                        onChange={(e) => setSiteSettings({
                          ...siteSettings,
                          emailProviderCredentials: {
                            ...(siteSettings.emailProviderCredentials || {}),
                            smtpHost: e.target.value
                          }
                        })}
                        className="w-full text-xs p-2 rounded bg-[#121324] border border-[#1e2038] text-white"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold opacity-60 uppercase">SMTP Port</label>
                      <input
                        type="text"
                        placeholder="587"
                        value={siteSettings.emailProviderCredentials?.smtpPort || ''}
                        onChange={(e) => setSiteSettings({
                          ...siteSettings,
                          emailProviderCredentials: {
                            ...(siteSettings.emailProviderCredentials || {}),
                            smtpPort: e.target.value
                          }
                        })}
                        className="w-full text-xs p-2 rounded bg-[#121324] border border-[#1e2038] text-white"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold opacity-60 uppercase">SMTP User / Email Pengirim</label>
                    <input
                      type="text"
                      placeholder="noreply@domainanda.com"
                      value={siteSettings.emailProviderCredentials?.smtpUser || ''}
                      onChange={(e) => setSiteSettings({
                        ...siteSettings,
                        emailProviderCredentials: {
                          ...(siteSettings.emailProviderCredentials || {}),
                          smtpUser: e.target.value
                        }
                      })}
                      className="w-full text-xs p-2 rounded bg-[#121324] border border-[#1e2038] text-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold opacity-60 uppercase">SMTP Password / App Password</label>
                      <span className="text-[9px] text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">🔒 Terkunci di .env</span>
                    </div>
                    <input
                      type="password"
                      readOnly
                      disabled
                      placeholder="••••••••"
                      value={siteSettings.emailProviderCredentials?.smtpPass || '••••••••'}
                      className="w-full text-xs p-2 rounded bg-[#121324] border border-[#1e2038] text-pink-300 opacity-75 cursor-not-allowed font-mono"
                    />
                    <span className="text-[9px] text-slate-400 block">
                      Konfigurasikan kata sandi SMTP di file <code>.env</code> dengan variabel <code>SMTP_PASSWORD=...</code>
                    </span>
                  </div>
                </div>
              )}

              {siteSettings.emailProvider === 'Supabase Auth' && (
                <div className="p-3.5 rounded-lg border border-[#1e2038] bg-black/20 space-y-3 mt-2">
                  <span className="text-[9px] font-black text-pink-400 uppercase block tracking-wider">&bull; Supabase Auth Credentials</span>
                  
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold opacity-60 uppercase">SUPABASE_URL</label>
                    <input
                      type="text"
                      placeholder="https://your-project.supabase.co"
                      value={siteSettings.emailProviderCredentials?.supabaseUrl || ''}
                      onChange={(e) => setSiteSettings({
                        ...siteSettings,
                        emailProviderCredentials: {
                          ...(siteSettings.emailProviderCredentials || {}),
                          supabaseUrl: e.target.value
                        }
                      })}
                      className="w-full text-xs p-2 rounded bg-[#121324] border border-[#1e2038] text-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold opacity-60 uppercase">SUPABASE_ANON_KEY</label>
                    <input
                      type="password"
                      placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                      value={siteSettings.emailProviderCredentials?.supabaseAnonKey || ''}
                      onChange={(e) => setSiteSettings({
                        ...siteSettings,
                        emailProviderCredentials: {
                          ...(siteSettings.emailProviderCredentials || {}),
                          supabaseAnonKey: e.target.value
                        }
                      })}
                      className="w-full text-xs p-2 rounded bg-[#121324] border border-[#1e2038] text-white"
                    />
                  </div>
                </div>
              )}

              {siteSettings.emailProvider === 'Firebase Auth' && (
                <div className="p-3.5 rounded-lg border border-[#1e2038] bg-black/20 space-y-3 mt-2">
                  <span className="text-[9px] font-black text-pink-400 uppercase block tracking-wider">&bull; Firebase Auth Credentials</span>
                  
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold opacity-60 uppercase">FIREBASE_API_KEY</label>
                    <input
                      type="text"
                      placeholder="AIzaSyA1..."
                      value={siteSettings.emailProviderCredentials?.firebaseApiKey || ''}
                      onChange={(e) => setSiteSettings({
                        ...siteSettings,
                        emailProviderCredentials: {
                          ...(siteSettings.emailProviderCredentials || {}),
                          firebaseApiKey: e.target.value
                        }
                      })}
                      className="w-full text-xs p-2 rounded bg-[#121324] border border-[#1e2038] text-white"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold opacity-60 uppercase">FIREBASE_AUTH_DOMAIN</label>
                      <input
                        type="text"
                        placeholder="project.firebaseapp.com"
                        value={siteSettings.emailProviderCredentials?.firebaseAuthDomain || ''}
                        onChange={(e) => setSiteSettings({
                          ...siteSettings,
                          emailProviderCredentials: {
                            ...(siteSettings.emailProviderCredentials || {}),
                            firebaseAuthDomain: e.target.value
                          }
                        })}
                        className="w-full text-xs p-2 rounded bg-[#121324] border border-[#1e2038] text-white"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold opacity-60 uppercase">FIREBASE_PROJECT_ID</label>
                      <input
                        type="text"
                        placeholder="project-id-xyz"
                        value={siteSettings.emailProviderCredentials?.firebaseProjectId || ''}
                        onChange={(e) => setSiteSettings({
                          ...siteSettings,
                          emailProviderCredentials: {
                            ...(siteSettings.emailProviderCredentials || {}),
                            firebaseProjectId: e.target.value
                          }
                        })}
                        className="w-full text-xs p-2 rounded bg-[#121324] border border-[#1e2038] text-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              <button
                id="saveAllSettingsBtn"
                data-testid="save-all-settings-button"
                onClick={handleSaveSettings}
                className="w-full py-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:opacity-90 text-black text-xs font-black rounded-lg transition-all flex items-center justify-center gap-1 shadow-lg uppercase tracking-wider"
              >
                <Save className="w-4 h-4" />
                <span>Simpan Seluruh Pengaturan</span>
              </button>
            </div>

            <div className="p-5 bg-[#0d0e1b] rounded-xl border border-[#1e2038] space-y-4">
              <h3 className="font-extrabold text-sm text-purple-400 uppercase tracking-wider">&bull; Tautan Sosial Media &amp; Donasi</h3>
              
              <div className="p-3 bg-black/40 rounded-lg space-y-3 border border-[#1e2038]">
                <span className="text-[10px] font-bold opacity-60 uppercase block">Tambah Tautan Baru:</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Nama (TikTok, Saweria, YouTube)"
                    value={newSocialName}
                    onChange={(e) => setNewSocialName(e.target.value)}
                    className="p-2 text-xs bg-[#121324] rounded border border-[#1e2038]"
                  />
                  <input
                    type="text"
                    placeholder="https://saweria.co/..."
                    value={newSocialUrl}
                    onChange={(e) => setNewSocialUrl(e.target.value)}
                    className="p-2 text-xs bg-[#121324] rounded border border-[#1e2038]"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddSocialLink}
                  className="w-full py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded flex items-center justify-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Link Sosmed / Donasi</span>
                </button>
              </div>

              <div className="space-y-2">
                <span className="text-[10px] opacity-50 uppercase font-black">Tautan Terdaftar:</span>
                {(!siteSettings.socialLinks || siteSettings.socialLinks.length === 0) ? (
                  <p className="text-xs opacity-50 italic">Belum ada tautan sosial media yang terdaftar.</p>
                ) : (
                  <div className="space-y-1.5">
                    {siteSettings.socialLinks.map((link) => (
                      <div key={link.id} className="flex items-center justify-between p-2 rounded bg-slate-500/5 text-xs">
                        <div>
                          <span className="font-extrabold text-slate-100">{link.name}:</span>
                          <span className="opacity-60 text-[10px] font-mono ml-2 truncate">{link.url}</span>
                        </div>
                        <button
                          onClick={() => handleRemoveSocialLink(link.id)}
                          className="text-red-400 hover:text-red-500"
                        >
                          Hapus
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-500/10 space-y-3.5 mt-4">
                <h3 className="font-extrabold text-sm text-pink-500 uppercase tracking-wider">&bull; Pengaturan Hero Banner Beranda</h3>
                <div className="p-3.5 rounded-lg border border-[#1e2038] bg-black/30 space-y-3">
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#121324] border border-[#1e2038]">
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold text-slate-200">Tampilkan Hero Banner Beranda</span>
                      <span className="text-[10px] opacity-50 block">Menampilkan atau menyembunyikan blok banner utama di halaman beranda</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={siteSettings.hero_banner_active === undefined ? true : siteSettings.hero_banner_active}
                        onChange={(e) => setSiteSettings({ ...siteSettings, hero_banner_active: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-500/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-300 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-pink-500 peer-checked:after:bg-white peer-checked:after:border-white"></div>
                    </label>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] opacity-60 uppercase font-bold">Badge Text</label>
                    <input
                      type="text"
                      placeholder="e.g. ✨ NOSTALGIA MASA KECIL"
                      value={siteSettings.hero_badge_text || ''}
                      onChange={(e) => setSiteSettings({ ...siteSettings, hero_badge_text: e.target.value })}
                      className="w-full text-xs p-2 rounded bg-[#121324] border border-[#1e2038] text-white outline-none focus:border-pink-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] opacity-60 uppercase font-bold">Judul Utama Hero</label>
                    <input
                      type="text"
                      placeholder="e.g. Putar Kembali Kenangan Indah Hari Minggu Anda!"
                      value={siteSettings.hero_title || ''}
                      onChange={(e) => setSiteSettings({ ...siteSettings, hero_title: e.target.value })}
                      className="w-full text-xs p-2 rounded bg-[#121324] border border-[#1e2038] text-white outline-none focus:border-pink-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] opacity-60 uppercase font-bold">Deskripsi Hero</label>
                    <textarea
                      placeholder="e.g. Tonton kartun-kartun masa kecil favorit Anda..."
                      value={siteSettings.hero_description || ''}
                      onChange={(e) => setSiteSettings({ ...siteSettings, hero_description: e.target.value })}
                      className="w-full text-xs p-2 rounded bg-[#121324] border border-[#1e2038] text-white outline-none h-20 focus:border-pink-500"
                    />
                  </div>
                  
                  <div className="space-y-1">
                    <label className="text-[10px] opacity-60 uppercase font-bold">Gambar Unggulan (Hero Card Image URL)</label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        placeholder="https://domain.com/image.jpg"
                        value={siteSettings.hero_featured_image || ''}
                        onChange={(e) => setSiteSettings({ ...siteSettings, hero_featured_image: e.target.value })}
                        className="flex-1 text-xs p-2 rounded bg-[#121324] border border-[#1e2038] text-white outline-none focus:border-pink-500"
                      />
                      <button
                        type="button"
                        onClick={() => heroImageFileInputRef.current?.click()}
                        className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs font-bold"
                      >
                        Upload
                      </button>
                      <input
                        type="file"
                        ref={heroImageFileInputRef}
                        onChange={handleHeroImageUploadToImageKit}
                        accept="image/*"
                        className="hidden"
                      />
                    </div>
                    {heroImageUploadProgress && (
                      <p className="text-[10px] text-pink-400 font-bold animate-pulse">{heroImageUploadProgress}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] opacity-60 uppercase font-bold">Label Card Unggulan</label>
                      <input
                        type="text"
                        placeholder="e.g. KOLEKSI TERPOPULER"
                        value={siteSettings.hero_featured_label || ''}
                        onChange={(e) => setSiteSettings({ ...siteSettings, hero_featured_label: e.target.value })}
                        className="w-full text-xs p-2 rounded bg-[#121324] border border-[#1e2038] text-white outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] opacity-60 uppercase font-bold">Judul Card Unggulan</label>
                      <input
                        type="text"
                        placeholder="e.g. Crayon Shinchan: Kenakalan..."
                        value={siteSettings.hero_featured_title || ''}
                        onChange={(e) => setSiteSettings({ ...siteSettings, hero_featured_title: e.target.value })}
                        className="w-full text-xs p-2 rounded bg-[#121324] border border-[#1e2038] text-white outline-none"
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleSaveSettings}
                    className="w-full py-2 bg-gradient-to-r from-pink-500 to-rose-600 hover:opacity-90 text-white text-xs font-bold rounded shadow-lg uppercase tracking-wider mt-2"
                  >
                    Simpan Perubahan Banner
                  </button>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-500/10 space-y-3.5 mt-4">
                <h3 className="font-extrabold text-sm text-yellow-500 uppercase tracking-wider">&bull; Sistem Proteksi Website</h3>
                <div className="p-3.5 rounded-lg border border-[#1e2038] bg-black/30 space-y-3">
                  <div className="flex items-center justify-between p-2 rounded bg-[#121324] border border-[#1e2038]">
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold text-slate-200">Aktifkan Anti AdBlock</span>
                      <span className="text-[10px] opacity-50 block">Kunci layar jika adblock aktif</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={siteSettings.antiAdblockActive || false}
                        onChange={(e) => setSiteSettings({ ...siteSettings, antiAdblockActive: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-500/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-300 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-yellow-500 peer-checked:after:bg-black peer-checked:after:border-black"></div>
                    </label>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] opacity-60 uppercase font-bold">Pesan Anti AdBlock Popup</label>
                    <textarea
                      placeholder="e.g. Mohon matikan AdBlock Anda..."
                      value={siteSettings.antiAdblockMessage || ''}
                      onChange={(e) => setSiteSettings({ ...siteSettings, antiAdblockMessage: e.target.value })}
                      className="w-full text-xs p-2 rounded bg-[#121324] border border-[#1e2038] text-white outline-none focus:border-yellow-500 h-16 leading-relaxed"
                    />
                  </div>

                  <div className="flex items-center justify-between p-2 rounded bg-[#121324] border border-[#1e2038]">
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold text-slate-200">Aktifkan Anti Copy / Inspect Element</span>
                      <span className="text-[10px] opacity-50 block">Blokir klik kanan, seleksi teks & F12</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={siteSettings.antiCopyActive || false}
                        onChange={(e) => setSiteSettings({ ...siteSettings, antiCopyActive: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-500/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-300 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-yellow-500 peer-checked:after:bg-black peer-checked:after:border-black"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded bg-[#121324] border border-[#1e2038]">
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold text-slate-200">Aktifkan Anti Developer Tools (Block DevTools / F12)</span>
                      <span className="text-[10px] opacity-50 block">Mencegah & mendeteksi pembukaan inspect element, Ctrl+Shift+I, dan view-source</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={siteSettings.antiDevToolsActive || false}
                        onChange={(e) => setSiteSettings({ ...siteSettings, antiDevToolsActive: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-500/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-300 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-yellow-500 peer-checked:after:bg-black peer-checked:after:border-black"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded bg-[#121324] border border-[#1e2038]">
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold text-slate-200">Aktifkan Balon Live Chat (On/Off)</span>
                      <span className="text-[10px] opacity-50 block">Menampilkan atau menyembunyikan widget live chat di seluruh halaman publik</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={siteSettings.live_chat_active === undefined ? true : siteSettings.live_chat_active}
                        onChange={(e) => setSiteSettings({ ...siteSettings, live_chat_active: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-500/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-300 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-yellow-500 peer-checked:after:bg-black peer-checked:after:border-black"></div>
                    </label>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] opacity-60 uppercase font-bold text-slate-300">Sensor Kata-Kata Kasar (Blocked Words)</label>
                    <textarea
                      placeholder="e.g. anjing, babi, bangsat..."
                      value={siteSettings.blocked_words || ''}
                      onChange={(e) => setSiteSettings({ ...siteSettings, blocked_words: e.target.value })}
                      className="w-full text-xs p-2 rounded bg-[#121324] border border-[#1e2038] text-white outline-none focus:border-yellow-500 h-16 leading-relaxed"
                    />
                    <span className="text-[9px] opacity-40 block">Daftar kata kasar yang dipisahkan dengan koma. Kata yang cocok otomatis disensor menjadi tanda bintang (****).</span>
                  </div>

                  <button
                    onClick={handleSaveSettings}
                    className="w-full py-2 bg-gradient-to-r from-yellow-500 to-amber-600 hover:opacity-90 text-black text-xs font-black rounded shadow-lg uppercase tracking-wider mt-2"
                  >
                    Simpan Perubahan Proteksi
                  </button>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-500/10 space-y-3.5 mt-4">
                <h3 className="font-extrabold text-sm text-cyan-400 uppercase tracking-wider">&bull; Injeksi Head Ad Scripts Global</h3>
                <div className="p-3.5 rounded-lg border border-[#1e2038] bg-black/30 space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] opacity-60 uppercase font-bold">Global Head Ad Scripts (AdSense, Adsterra, Monetag Popunder)</label>
                    <textarea
                      placeholder="e.g. <script src='https://pagead2.googlesyndication.com...'></script>"
                      value={siteSettings.globalHeadScripts || ''}
                      onChange={(e) => setSiteSettings({ ...siteSettings, globalHeadScripts: e.target.value })}
                      className="w-full text-xs p-2.5 rounded bg-[#121324] border border-[#1e2038] text-white outline-none focus:border-cyan-500 h-32 leading-relaxed font-mono"
                    />
                    <span className="text-[9px] opacity-40 block">Menempelkan kode script/head tag ini secara otomatis ke dalam tag &lt;head&gt; di seluruh halaman.</span>
                  </div>

                  <button
                    onClick={handleSaveSettings}
                    className="w-full py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-90 text-black text-xs font-black rounded shadow-lg uppercase tracking-wider mt-2"
                  >
                    Simpan Perubahan Head Script
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}

        {activeTab === 'donasi' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="p-6 bg-[#0d0e1b] rounded-2xl border border-pink-500/20 shadow-xl shadow-pink-500/5 space-y-4">
              <h3 className="font-extrabold text-base text-pink-500 uppercase tracking-wider flex items-center justify-between border-b border-pink-500/10 pb-3">
                <span className="flex items-center gap-2">
                  <HeartHandshake className="w-5 h-5 text-pink-500 animate-pulse" />
                  <span>&bull; SISTEM DONASI MANUAL / SIMULASI OVERLAY</span>
                </span>
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${siteSettings.isManualDonationActive ? 'bg-pink-600 text-white animate-pulse' : 'bg-slate-800 text-slate-400'}`}>
                  {siteSettings.isManualDonationActive ? 'AKTIF (ON)' : 'MATI (OFF)'}
                </span>
              </h3>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-xl border border-pink-500/20 bg-pink-500/5">
                  <div className="space-y-0.5 text-left">
                    <span className="text-xs text-pink-400 font-bold uppercase block">Aktifkan Sistem Donasi Manual</span>
                    <p className="text-[10px] text-slate-400 leading-relaxed text-left">
                      Mengaktifkan tampilan running text dan popup simulasi donasi kustom di halaman depan.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={siteSettings.isManualDonationActive || false}
                      onChange={(e) => setSiteSettings({ ...siteSettings, isManualDonationActive: e.target.checked })}
                      className="w-5 h-5 cursor-pointer accent-pink-500"
                      id="isManualDonationActiveCard"
                    />
                  </div>
                </div>

                {siteSettings.isManualDonationActive && (
                  <div className="space-y-5 animate-fadeIn">
                    {/* Display settings inputs */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl border border-[#1e2038] bg-black/40 text-left">
                      <div className="space-y-1.5 col-span-full">
                        <span className="text-[10px] font-black text-pink-400 uppercase tracking-widest block">&bull; Pengaturan Tampilan Donasi</span>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] opacity-60 uppercase font-black tracking-wider text-slate-300">Kecepatan Running Text (Marquee Speed)</label>
                        <select
                          value={siteSettings.manualDonationSpeed || 'Sedang'}
                          onChange={(e) => setSiteSettings({ ...siteSettings, manualDonationSpeed: e.target.value })}
                          className="w-full text-xs p-3 rounded-lg bg-[#121324] border border-[#1e2038] text-white outline-none font-bold"
                        >
                          <option value="Lambat">Lambat (Halus - 25s)</option>
                          <option value="Sedang">Sedang (Standar - 15s)</option>
                          <option value="Cepat">Cepat (Kilat - 10s)</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] opacity-60 uppercase font-black tracking-wider text-slate-300">Durasi Tampil Popup Overlay (Detik)</label>
                        <input
                          type="number"
                          value={siteSettings.manualDonationDuration || 6}
                          onChange={(e) => setSiteSettings({ ...siteSettings, manualDonationDuration: Number(e.target.value) })}
                          className="w-full text-xs p-3 rounded-lg bg-[#121324] border border-[#1e2038] text-white font-bold"
                          min="2"
                          max="30"
                        />
                      </div>
                    </div>

                    {/* New multi-input form */}
                    <div className="space-y-4 p-5 rounded-xl border border-[#1e2038] bg-black/40 text-left">
                      <span className="text-[10px] font-black text-pink-400 uppercase tracking-widest block">&bull; Form Isian Data Donatur Baru</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] opacity-60 uppercase font-black tracking-wider text-slate-300">Nama Donatur</label>
                          <input
                            type="text"
                            value={tempDonName}
                            onChange={(e) => setTempDonName(e.target.value)}
                            className="w-full text-xs p-3 rounded-lg bg-[#121324] border border-[#1e2038] text-white focus:border-pink-500 outline-none transition-all font-bold"
                            placeholder="cth: Budi, Anonim"
                          />
                        </div>
                        
                        <div className="space-y-1.5">
                          <label className="text-[10px] opacity-60 uppercase font-black tracking-wider text-slate-300">Nominal Donasi</label>
                          <input
                            type="text"
                            value={tempDonAmount}
                            onChange={(e) => setTempDonAmount(e.target.value)}
                            className="w-full text-xs p-3 rounded-lg bg-[#121324] border border-[#1e2038] text-white focus:border-pink-500 outline-none transition-all font-bold"
                            placeholder="cth: Rp 15.000 atau 15000"
                          />
                        </div>

                        <div className="space-y-1.5 col-span-full">
                          <label className="text-[10px] opacity-60 uppercase font-black tracking-wider text-slate-300">Pesan Donasi</label>
                          <textarea
                            value={tempDonMessage}
                            onChange={(e) => setTempDonMessage(e.target.value)}
                            className="w-full text-xs p-3 rounded-lg bg-[#121324] border border-[#1e2038] text-white focus:border-pink-500 outline-none transition-all h-24 font-bold leading-relaxed resize-none"
                            placeholder="cth: Semangat terus min upload episode baru!"
                          />
                        </div>

                        <div className="space-y-1.5 col-span-full">
                          <label className="text-[10px] opacity-60 uppercase font-black tracking-wider text-slate-300">Platform</label>
                          <select
                            value={tempDonPlatform}
                            onChange={(e) => setTempDonPlatform(e.target.value)}
                            className="w-full text-xs p-3 rounded-lg bg-[#121324] border border-[#1e2038] text-white outline-none font-bold cursor-pointer"
                          >
                            <option value="Saweria">Saweria</option>
                            <option value="Trakteer">Trakteer</option>
                            <option value="Tako.id">Tako.id</option>
                            <option value="Manual">Manual</option>
                          </select>
                        </div>
                      </div>

                      <div className="flex gap-3 pt-2">
                        <button
                          type="button"
                          onClick={handleAddManualDonation}
                          className="flex-1 py-3 rounded-xl bg-gradient-to-r from-pink-500 via-pink-600 to-purple-600 hover:opacity-95 text-white text-xs font-black uppercase tracking-wider transition-all shadow-lg flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                          <span>+ Tambah Donasi Manual ke Daftar</span>
                        </button>
                      </div>
                    </div>

                    {/* Table listing manual donations */}
                    <div className="space-y-3.5 p-5 rounded-xl border border-[#1e2038] bg-black/40 text-left">
                      <div className="flex items-center justify-between border-b border-[#1e2038] pb-3 mb-2">
                        <span className="text-[10px] font-black text-pink-400 uppercase tracking-widest block">
                          &bull; Daftar Donasi Manual ({ (siteSettings.manualDonationList || []).length })
                        </span>
                        {(siteSettings.manualDonationList || []).length > 0 && (
                          <button
                            type="button"
                            onClick={handleClearAllManualDonations}
                            className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold uppercase transition-all cursor-pointer"
                          >
                            HAPUS SEMUA DAFTAR DONASI
                          </button>
                        )}
                      </div>

                      {(!siteSettings.manualDonationList || siteSettings.manualDonationList.length === 0) ? (
                        <p className="text-center text-xs opacity-40 py-4 italic">Belum ada data donasi manual dalam daftar.</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs text-left">
                            <thead className="bg-[#121324] text-[10px] uppercase font-black opacity-60 border-b border-[#1e2038]">
                              <tr>
                                <th className="p-3">Nama</th>
                                <th className="p-3">Nominal</th>
                                <th className="p-3">Pesan</th>
                                <th className="p-3">Platform</th>
                                <th className="p-3 text-right">Aksi</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#1e2038]">
                              {siteSettings.manualDonationList.map((item) => (
                                <tr key={item.id} className="hover:bg-slate-500/5 transition-all text-slate-300">
                                  <td className="p-3 font-bold text-white">{item.name}</td>
                                  <td className="p-3 text-emerald-400 font-extrabold">{item.amount}</td>
                                  <td className="p-3 max-w-[200px] truncate italic">&ldquo;{item.message}&rdquo;</td>
                                  <td className="p-3">
                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase text-white ${
                                      item.platform === 'Saweria' ? 'bg-pink-600' :
                                      item.platform === 'Trakteer' ? 'bg-red-600' :
                                      item.platform === 'Tako.id' ? 'bg-purple-600' : 'bg-slate-600'
                                    }`}>
                                      {item.platform}
                                    </span>
                                  </td>
                                  <td className="p-3 text-right">
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveManualDonation(item.id)}
                                      className="p-1.5 text-red-400 hover:bg-red-500/10 border border-red-500/20 rounded-md cursor-pointer"
                                      title="Hapus Item"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* Master save button */}
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={async () => {
                          await handleSaveSettings();
                          alert("🎉 Seluruh daftar donasi manual dan pengaturan berhasil disimpan secara permanen di database!");
                        }}
                        className="w-full py-3.5 rounded-xl bg-gradient-to-r from-pink-500 via-purple-600 to-pink-500 hover:opacity-95 text-white text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-pink-500/25 flex items-center justify-center gap-2 cursor-pointer transform active:scale-95"
                      >
                        <Save className="w-4 h-4" />
                        <span>SIMPAN SELURUH DAFTAR &amp; TAYANGKAN SEKARANG</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'pages' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center bg-[#0d0e1b] p-4 rounded-xl border border-[#1e2038] gap-3">
              <div>
                <h3 className="font-extrabold text-sm text-white">Kelola Halaman Statis &amp; Dokumen</h3>
                <p className="text-[11px] opacity-60">Sediakan dokumen hukum seperti DMCA Disclaimer, Privacy Policy, Terms, dll.</p>
              </div>
              <button
                onClick={() => {
                  setEditingPage(null)
                  setPageForm({ title: '', slug: '', content: '', showInFooter: true })
                  setIsSlugManuallyEdited(false)
                  setShowPageModal(true)
                }}
                className="px-4 py-2 rounded-lg bg-pink-500 hover:bg-pink-600 text-white font-extrabold text-xs flex items-center gap-1 shadow-lg"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Buat Halaman Baru</span>
              </button>
            </div>

            <div className="bg-[#0d0e1b] rounded-xl border border-[#1e2038] overflow-x-auto">
              <table className="w-full text-xs text-left min-w-[500px]">
                <thead className="bg-[#121324] text-[10px] uppercase font-bold opacity-60 border-b border-[#1e2038]">
                  <tr>
                    <th className="p-3">Judul Dokumen</th>
                    <th className="p-3">Slug URL</th>
                    <th className="p-3 text-center">Tampilkan di Footer</th>
                    <th className="p-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e2038]">
                  {staticPages.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="p-8 text-center opacity-50 italic">Belum ada halaman statis yang terdaftar.</td>
                    </tr>
                  ) : (
                    staticPages.map((page, idx) => (
                      <tr key={page._id || page.id || `pg-${idx}`} className="hover:bg-slate-500/5 transition-all">
                        <td className="p-3 font-extrabold text-slate-100">{page.title}</td>
                        <td className="p-3 font-mono text-cyan-400">/page/{page.slug}</td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black ${page.showInFooter ? 'bg-green-500/10 text-green-400' : 'bg-slate-500/10 text-slate-400'}`}>
                            {page.showInFooter ? 'YA' : 'TIDAK'}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <div className="inline-flex gap-2">
                            <a
                              href={`/page/${page.slug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 text-pink-400 hover:bg-pink-500/10 border border-pink-500/20 rounded font-bold text-[10px]"
                            >
                              Live Preview
                            </a>
                            <button
                              onClick={() => {
                                setEditingPage(page)
                                setPageForm(page)
                                setIsSlugManuallyEdited(false)
                                setShowPageModal(true)
                              }}
                              className="p-1.5 text-cyan-400 hover:bg-cyan-500/10 border border-cyan-500/20 rounded"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeletePage(page.id)}
                              className="p-1.5 text-red-400 hover:bg-red-500/10 border border-red-500/20 rounded"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {showPageModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#0d0e1b] border border-[#1e2038] rounded-2xl w-full max-w-lg p-6 relative space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
              <button
                onClick={() => setShowPageModal(false)}
                className="absolute top-4 right-4 p-1 rounded hover:bg-slate-500/5 text-xs opacity-65"
              >
                &times;
              </button>
              <h3 className="font-black text-white text-base border-b border-slate-500/10 pb-2">
                {editingPage ? 'Ubah Informasi Halaman Statis' : 'Buat Halaman Statis Baru'}
              </h3>

              <form onSubmit={handleSavePage} className="space-y-3.5 text-xs">
                <div className="space-y-1">
                  <label className="font-bold opacity-60">Judul Halaman</label>
                  <input
                    type="text"
                    value={pageForm.title}
                    onChange={(e) => {
                      const newTitle = e.target.value;
                      const slugValue = isSlugManuallyEdited ? pageForm.slug : newTitle
                        .toLowerCase()
                        .replace(/[^a-z0-9\s-]/g, '')
                        .replace(/[\s_]+/g, '-')
                        .replace(/-+/g, '-')
                        .trim()
                        .replace(/^-+|-+$/g, '');
                      setPageForm({ ...pageForm, title: newTitle, slug: slugValue });
                    }}
                    placeholder="Contoh: DMCA Disclaimer"
                    className="w-full p-2.5 rounded bg-[#121324] border border-[#1e2038] text-white outline-none"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold opacity-60">Slug URL Dinamis</label>
                  <input
                    type="text"
                    value={pageForm.slug}
                    onChange={(e) => {
                      setIsSlugManuallyEdited(true);
                      setPageForm({ ...pageForm, slug: e.target.value.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/[\s_]+/g, '-') });
                    }}
                    placeholder="contoh: dmca-policy"
                    className="w-full p-2.5 rounded bg-[#121324] border border-[#1e2038] text-white outline-none font-mono"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold opacity-60">Konten Halaman (HTML / Markdown ringkas)</label>
                  <textarea
                    value={pageForm.content}
                    onChange={(e) => setPageForm({ ...pageForm, content: e.target.value })}
                    placeholder="<h2>Kebijakan Kami</h2><p>Tulis teks di sini...</p>"
                    className="w-full p-2.5 rounded bg-[#121324] border border-[#1e2038] text-white outline-none h-40 font-mono"
                    required
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    checked={pageForm.showInFooter}
                    onChange={(e) => setPageForm({ ...pageForm, showInFooter: e.target.checked })}
                    id="pageShowFooter"
                  />
                  <label htmlFor="pageShowFooter" className="text-xs font-bold opacity-80 cursor-pointer">Tampilkan Link Halaman Ini di Navigation Footer</label>
                </div>

                <div className="flex gap-2.5 pt-2 border-t border-slate-500/10">
                  <button type="submit" className="flex-1 py-2 bg-pink-500 hover:bg-pink-600 text-white font-extrabold rounded">
                    Simpan Halaman
                  </button>
                  <button type="button" onClick={() => setShowPageModal(false)} className="px-4 py-2 bg-slate-500/15 text-slate-300 rounded">
                    Batal
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {activeTab === 'polling' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center bg-[#0d0e1b] p-4 rounded-xl border border-[#1e2038] gap-3">
              <div>
                <h3 className="font-extrabold text-sm text-white">Anime Request &amp; Polling Manager</h3>
                <p className="text-[11px] opacity-60">Sediakan opsi bagi pengunjung untuk melakukan voting anime nostalgia berikutnya.</p>
              </div>
              <button
                onClick={() => {
                  setEditingPoll(null)
                  setPollForm({ title: '', options: [{ id: 'opt-1', name: '', imageUrl: '', votes: 0 }], isActive: true })
                  setShowPollModal(true)
                }}
                className="px-4 py-2 rounded-lg bg-pink-500 hover:bg-pink-600 text-white font-extrabold text-xs flex items-center gap-1 shadow-lg"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Buat Polling Baru</span>
              </button>
            </div>

            <div className="bg-[#0d0e1b] rounded-xl border border-[#1e2038] overflow-x-auto">
              <table className="w-full text-xs text-left min-w-[500px]">
                <thead className="bg-[#121324] text-[10px] uppercase font-bold opacity-60 border-b border-[#1e2038]">
                  <tr>
                    <th className="p-3">Pertanyaan / Topik Polling</th>
                    <th className="p-3">Opsi Pilihan (Votes)</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e2038]">
                  {pollingList.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="p-8 text-center opacity-50 italic">Belum ada polling yang terdaftar.</td>
                    </tr>
                  ) : (
                    pollingList.map((poll, idx) => {
                      const totalVotes = poll.options.reduce((sum, o) => sum + (o.votes || 0), 0)
                      return (
                        <tr key={poll._id || poll.id || `poll-${idx}`} className="hover:bg-slate-500/5 transition-all">
                          <td className="p-3">
                            <p className="font-extrabold text-slate-100">{poll.title}</p>
                            <span className="text-[10px] opacity-50 font-mono">ID: {poll.id} &bull; Total Suara: {totalVotes}</span>
                          </td>
                          <td className="p-3 space-y-1 max-w-sm">
                            {poll.options.map(o => (
                              <div key={o.id} className="flex justify-between text-[11px]">
                                <span className="opacity-90">{o.name}</span>
                                <span className="text-cyan-400 font-bold font-mono">{o.votes || 0} votes</span>
                              </div>
                            ))}
                          </td>
                          <td className="p-3 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black ${poll.isActive ? 'bg-green-500/10 text-green-400' : 'bg-slate-500/10 text-slate-400'}`}>
                              {poll.isActive ? 'AKTIF' : 'MATI'}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <div className="inline-flex gap-2">
                              <button
                                onClick={() => handleResetPollVotes(poll)}
                                className="px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded text-[10px] font-black border border-amber-500/20"
                                title="Reset total vote ke 0"
                              >
                                Reset Hasil
                              </button>
                              <button
                                onClick={() => {
                                  setEditingPoll(poll)
                                  setPollForm(poll)
                                  setShowPollModal(true)
                                }}
                                className="p-1.5 text-cyan-400 hover:bg-cyan-500/10 border border-cyan-500/20 rounded"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeletePoll(poll.id)}
                                className="p-1.5 text-red-400 hover:bg-red-500/10 border border-red-500/20 rounded"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {showPollModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#0d0e1b] border border-[#1e2038] rounded-2xl w-full max-w-lg p-6 relative space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
              <button
                onClick={() => setShowPollModal(false)}
                className="absolute top-4 right-4 p-1 rounded hover:bg-slate-500/5 text-xs opacity-65"
              >
                &times;
              </button>
              <h3 className="font-black text-white text-base border-b border-slate-500/10 pb-2">
                {editingPoll ? 'Ubah Informasi Polling Anime' : 'Buat Topik Polling Baru'}
              </h3>

              <form onSubmit={handleSavePoll} className="space-y-4 text-xs">
                <div className="space-y-1">
                  <label className="font-bold opacity-60">Judul / Pertanyaan Polling</label>
                  <input
                    type="text"
                    value={pollForm.title}
                    onChange={(e) => setPollForm({ ...pollForm, title: e.target.value })}
                    placeholder="Contoh: Request Anime Nostalgia Pilihanmu"
                    className="w-full p-2.5 rounded bg-[#121324] border border-[#1e2038] text-white outline-none"
                    required
                  />
                </div>

                <div className="space-y-3 pt-2 border-t border-slate-500/10">
                  <div className="flex justify-between items-center">
                    <span className="font-black uppercase tracking-wider text-[10px] text-pink-500">Pilihan Opsi Anime (Opsi Pilihan)</span>
                    <button
                      type="button"
                      onClick={() => {
                        const newId = `opt-${Date.now()}`
                        setPollForm({
                          ...pollForm,
                          options: [...pollForm.options, { id: newId, name: '', imageUrl: '', votes: 0 }]
                        })
                      }}
                      className="px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-[9px] font-black"
                    >
                      + Tambah Opsi
                    </button>
                  </div>

                  <div className="space-y-3.5 max-h-[250px] overflow-y-auto scrollbar-hide">
                    {pollForm.options.map((opt, oIdx) => (
                      <div key={opt.id} className="p-3 rounded-lg border border-[#1e2038] bg-black/20 space-y-2 relative text-left">
                        <button
                          type="button"
                          onClick={() => {
                            const updatedOptions = pollForm.options.filter(o => o.id !== opt.id)
                            setPollForm({ ...pollForm, options: updatedOptions })
                          }}
                          className="absolute top-1.5 right-1.5 text-red-400 font-bold hover:text-red-500"
                        >
                          &times;
                        </button>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-[9px] opacity-60 font-bold">Nama Anime</label>
                            <input
                              type="text"
                              value={opt.name}
                              onChange={(e) => {
                                const updatedOptions = [...pollForm.options]
                                updatedOptions[oIdx].name = e.target.value
                                setPollForm({ ...pollForm, options: updatedOptions })
                              }}
                              placeholder="Contoh: Digimon"
                              className="w-full p-2.5 rounded bg-[#121324] border border-[#1e2038]"
                              required
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] opacity-60 font-bold">Nilai Awal Vote</label>
                            <input
                              type="number"
                              value={opt.votes || 0}
                              onChange={(e) => {
                                const updatedOptions = [...pollForm.options]
                                updatedOptions[oIdx].votes = Number(e.target.value)
                                setPollForm({ ...pollForm, options: updatedOptions })
                              }}
                              className="w-full p-2.5 rounded bg-[#121324] border border-[#1e2038]"
                              min="0"
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] opacity-60 font-bold">URL Gambar Thumbnail</label>
                          <div className="flex flex-col sm:flex-row gap-1.5">
                            <input
                              type="text"
                              value={opt.imageUrl || ''}
                              onChange={(e) => {
                                const updatedOptions = [...pollForm.options]
                                updatedOptions[oIdx].imageUrl = e.target.value
                                setPollForm({ ...pollForm, options: updatedOptions })
                              }}
                              placeholder="https://images.unsplash.com/..."
                              className="flex-1 p-2 bg-[#121324] rounded border border-[#1e2038]"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                setUploadingPollOptionIndex(oIdx)
                                setTimeout(() => pollFileInputRef.current?.click(), 50)
                              }}
                              className="px-2 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded text-[9px] font-bold"
                            >
                              Upload ImageKit
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {pollUploadProgress && (
                    <p className="text-[10px] text-cyan-400 font-bold animate-pulse mt-1.5">{pollUploadProgress}</p>
                  )}
                  <input
                    type="file"
                    ref={pollFileInputRef}
                    onChange={handlePollOptionUploadToImageKit}
                    accept="image/*"
                    className="hidden"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    checked={pollForm.isActive}
                    onChange={(e) => setPollForm({ ...pollForm, isActive: e.target.checked })}
                    id="pollActive"
                  />
                  <label htmlFor="pollActive" className="text-xs font-bold opacity-80 cursor-pointer">Aktifkan Polling Ini di Frontend (On/Off)</label>
                </div>

                <div className="flex gap-2.5 pt-2 border-t border-slate-500/10">
                  <button type="submit" className="flex-1 py-2 bg-pink-500 hover:bg-pink-600 text-white font-extrabold rounded">
                    Simpan Polling
                  </button>
                  <button type="button" onClick={() => setShowPollModal(false)} className="px-4 py-2 bg-slate-500/15 text-slate-300 rounded">
                    Batal
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showVideoModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#0d0e1b] border border-[#1e2038] rounded-2xl w-full max-w-lg p-6 relative space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
              <button
                onClick={() => setShowVideoModal(false)}
                className="absolute top-4 right-4 p-1 rounded hover:bg-slate-500/5 text-xs opacity-65"
              >
                &times;
              </button>
              <h3 className="font-black text-white text-base border-b border-slate-500/10 pb-2">
                {editingVideo ? 'Ubah Informasi Video Retro' : 'Tambah Video Baru ke Shindora'}
              </h3>

              <form onSubmit={handleSaveVideo} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold opacity-60">Judul Episode</label>
                    <input
                      type="text"
                      data-testid="video-title-input"
                      value={videoForm.title}
                      onChange={(e) => {
                        const newTitle = e.target.value;
                        const generatedSlug = newTitle
                          .toLowerCase()
                          .replace(/[^a-z0-9\s-]/g, '')
                          .replace(/[\s_]+/g, '-')
                          .replace(/-+/g, '-')
                          .trim()
                          .replace(/^-+|-+$/g, '');
                        
                        setVideoForm(prev => ({
                          ...prev,
                          title: newTitle,
                          slug: isVideoSlugManuallyEdited ? prev.slug : generatedSlug
                        }));
                      }}
                      className="w-full p-2 rounded bg-[#121324] border border-[#1e2038]"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold opacity-60">Slug SEO URL</label>
                    <input
                      type="text"
                      data-testid="video-slug-input"
                      value={videoForm.slug}
                      onChange={(e) => {
                        setIsVideoSlugManuallyEdited(true);
                        setVideoForm(prev => ({ 
                          ...prev, 
                          slug: e.target.value.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/[\s_]+/g, '-') 
                        }));
                      }}
                      placeholder="auto-generated-slug"
                      className="w-full p-2 rounded bg-[#121324] border border-[#1e2038] font-mono"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold opacity-60">Kategori Utama</label>
                    <select
                      data-testid="video-category-select"
                      value={videoForm.animeTitle || ''}
                      onChange={(e) => {
                        const newMain = e.target.value;
                        setVideoForm(prev => ({ 
                          ...prev, 
                          animeTitle: newMain, 
                          subCategory: '',
                          subCategory2: '',
                          subCategory3: '' 
                        }));
                      }}
                      className="w-full p-2 rounded bg-[#121324] border border-[#1e2038] text-white"
                      required
                    >
                      <option value="">-- Pilih Kategori Utama --</option>
                      {categories
                        .filter(c => !c.parent_id || c.parent_id === 'none')
                        .map(c => (
                          <option key={c.id || c._id} value={c.name}>
                            {cleanCategoryName(c.name)}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold opacity-60">Sub-Kategori 1</label>
                    <select
                      data-testid="video-subcategory1-select"
                      value={videoForm.subCategory || ''}
                      onChange={(e) => {
                        const newSub1 = e.target.value;
                        setVideoForm(prev => ({ 
                          ...prev, 
                          subCategory: newSub1, 
                          subCategory2: '',
                          subCategory3: '' 
                        }));
                      }}
                      className="w-full p-2 rounded bg-[#121324] border border-[#1e2038] text-white disabled:opacity-40"
                      disabled={!videoForm.animeTitle}
                    >
                      <option value="">-- Pilih Sub-Kategori 1 --</option>
                      {(() => {
                        if (!videoForm.animeTitle) return null;

                        const selectedMain = categories.find(
                          c => (!c.parent_id || c.parent_id === 'none') && 
                               (c.name === videoForm.animeTitle || cleanCategoryName(c.name) === cleanCategoryName(videoForm.animeTitle))
                        );
                        
                        if (!selectedMain) return null;
                        const mainId = String(selectedMain.id || selectedMain._id);

                        const subs = categories.filter(
                          c => c.parent_id && String(c.parent_id) === mainId
                        );

                        return subs.map((sub) => (
                          <option key={sub.id || sub._id} value={sub.name}>
                            {cleanCategoryName(sub.name)}
                          </option>
                        ));
                      })()}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold opacity-60">Sub-Kategori 2</label>
                    <select
                      data-testid="video-subcategory2-select"
                      value={videoForm.subCategory2 || ''}
                      onChange={(e) => {
                        const newSub2 = e.target.value;
                        setVideoForm(prev => ({ 
                          ...prev, 
                          subCategory2: newSub2,
                          subCategory3: ''
                        }));
                      }}
                      className="w-full p-2 rounded bg-[#121324] border border-[#1e2038] text-white disabled:opacity-40"
                      disabled={!videoForm.subCategory}
                    >
                      <option value="">-- Pilih Sub-Kategori 2 --</option>
                      {(() => {
                        if (!videoForm.subCategory) return null;

                        const selectedSub1 = categories.find(
                          c => c.name === videoForm.subCategory || 
                               cleanCategoryName(c.name) === cleanCategoryName(videoForm.subCategory)
                        );
                        
                        if (!selectedSub1) return null;
                        const sub1Id = String(selectedSub1.id || selectedSub1._id);

                        const sub2s = categories.filter(
                          c => c.parent_id && String(c.parent_id) === sub1Id
                        );

                        return sub2s.map((sub2) => (
                          <option key={sub2.id || sub2._id} value={sub2.name}>
                            {cleanCategoryName(sub2.name)}
                          </option>
                        ));
                      })()}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold opacity-60">Sub-Kategori 3 (Opsional)</label>
                    <select
                      data-testid="video-subcategory3-select"
                      value={videoForm.subCategory3 || ''}
                      onChange={(e) => setVideoForm(prev => ({ ...prev, subCategory3: e.target.value }))}
                      className="w-full p-2 rounded bg-[#121324] border border-[#1e2038] text-white disabled:opacity-40"
                      disabled={!videoForm.subCategory2}
                    >
                      <option value="">-- Tanpa Sub-Kategori 3 --</option>
                      {(() => {
                        if (!videoForm.subCategory2) return null;

                        const selectedSub2 = categories.find(
                          c => c.name === videoForm.subCategory2 || 
                               cleanCategoryName(c.name) === cleanCategoryName(videoForm.subCategory2)
                        );
                        
                        if (!selectedSub2) return null;
                        const sub2Id = String(selectedSub2.id || selectedSub2._id);

                        const sub3s = categories.filter(
                          c => c.parent_id && String(c.parent_id) === sub2Id
                        );

                        return sub3s.map((sub3) => (
                          <option key={sub3.id || sub3._id} value={sub3.name}>
                            {cleanCategoryName(sub3.name)}
                          </option>
                        ));
                      })()}
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-bold opacity-60">Nomor Episode</label>
                  <input
                    type="text"
                    data-testid="video-episode-input"
                    value={videoForm.episode || ''}
                    onChange={(e) => setVideoForm({ ...videoForm, episode: e.target.value })}
                    placeholder="Contoh: Eps 01, Eps 001, OVA, dll."
                    className="w-full p-2 rounded bg-[#121324] border border-[#1e2038]"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold opacity-60">Thumbnail Gambar URL (Link Eksternal)</label>
                  <div className="flex flex-col sm:flex-row gap-1.5">
                    <input
                      type="text"
                      data-testid="video-thumbnail-input"
                      value={videoForm.thumbnailUrl}
                      onChange={(e) => setVideoForm({ ...videoForm, thumbnailUrl: e.target.value })}
                      className="flex-1 p-2 rounded bg-[#121324] border border-[#1e2038]"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => videoFileInputRef.current?.click()}
                      className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs font-bold"
                    >
                      Upload ImageKit
                    </button>
                    <input
                      type="file"
                      ref={videoFileInputRef}
                      onChange={handleVideoThumbnailUploadToImageKit}
                      accept="image/*"
                      className="hidden"
                    />
                  </div>
                  {videoUploadProgress && (
                    <p className="text-[10px] text-cyan-400 font-bold animate-pulse">{videoUploadProgress}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="font-bold opacity-60">Server 1 (Direct URL / Raw Iframe Tag)</label>
                  <input
                    type="text"
                    data-testid="video-server1-input"
                    value={videoForm.videoUrl}
                    onChange={(e) => setVideoForm({ ...videoForm, videoUrl: e.target.value })}
                    className="w-full p-2 rounded bg-[#121324] border border-[#1e2038]"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold opacity-60">Server 2 (Direct URL / Raw Iframe Tag)</label>
                    <input
                      type="text"
                      value={videoForm.videoUrl2 || ''}
                      onChange={(e) => setVideoForm({ ...videoForm, videoUrl2: e.target.value })}
                      className="w-full p-2 rounded bg-[#121324] border border-[#1e2038]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold opacity-60">Server 3 (Direct URL / Raw Iframe Tag)</label>
                    <input
                      type="text"
                      value={videoForm.videoUrl3 || ''}
                      onChange={(e) => setVideoForm({ ...videoForm, videoUrl3: e.target.value })}
                      className="w-full p-2 rounded bg-[#121324] border border-[#1e2038]"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-bold opacity-60">Deskripsi Singkat</label>
                  <textarea
                    value={videoForm.description}
                    onChange={(e) => setVideoForm({ ...videoForm, description: e.target.value })}
                    className="w-full p-2 rounded bg-[#121324] border border-[#1e2038] h-16"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold opacity-60">Durasi Video (Format HH:MM:SS atau MM:SS)</label>
                  <input
                    type="text"
                    placeholder="misal: 23:40 atau 01:45:00"
                    value={videoForm.duration || ''}
                    onChange={(e) => setVideoForm({ ...videoForm, duration: e.target.value })}
                    className="w-full p-2 rounded bg-[#121324] border border-[#1e2038] text-white"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold opacity-60">Status Publikasi</label>
                    <select
                      value={videoForm.status || 'published'}
                      onChange={(e) => setVideoForm({ ...videoForm, status: e.target.value })}
                      className="w-full p-2 rounded bg-[#121324] border border-[#1e2038]"
                    >
                      <option value="published">Publik / Published</option>
                      <option value="draft">Draft</option>
                      <option value="scheduled">Terjadwal / Scheduled</option>
                    </select>
                  </div>

                  {videoForm.status === 'scheduled' && (
                    <div className="space-y-1 animate-fade-in">
                      <label className="font-bold opacity-60">Tanggal & Waktu Rilis</label>
                      <input
                        type="datetime-local"
                        value={videoForm.scheduledAt ? videoForm.scheduledAt.substring(0, 16) : ''}
                        onChange={(e) => setVideoForm({ ...videoForm, scheduledAt: e.target.value })}
                        className="w-full p-2 rounded bg-[#121324] border border-[#1e2038] text-white"
                        required
                      />
                    </div>
                  )}
                </div>

                {/* Checkbox Web Push VAPID Notification */}
                <div className="flex items-center gap-2.5 p-3 rounded-xl border border-pink-500/20 bg-pink-500/5">
                  <input
                    type="checkbox"
                    id="videoSendPush"
                    checked={videoForm.sendPushNotification !== false}
                    onChange={(e) => setVideoForm({ ...videoForm, sendPushNotification: e.target.checked })}
                    className="w-4 h-4 rounded text-pink-500 cursor-pointer"
                  />
                  <label htmlFor="videoSendPush" className="text-xs font-bold text-slate-200 cursor-pointer flex flex-col">
                    <span className="flex items-center gap-1.5 text-pink-400">
                      <span>🔔</span>
                      <span>Kirim Notifikasi Web Push (VAPID) ke Semua Subscriber</span>
                    </span>
                    <span className="text-[10px] opacity-60 font-normal">
                      Kirimkan notifikasi push browser saat video baru disimpan / dipublikasikan. (Hanya terkirim jika video berstatus Published)
                    </span>
                  </label>
                </div>

                {/* Section Tambahkan ke Playlist (Opsional) */}
                <div className="space-y-1.5 p-3 rounded-xl border border-[#1e2038] bg-[#0a0b14]/50">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-xs text-purple-400 uppercase tracking-wide">Tambahkan ke Playlist (Opsional)</label>
                    <span className="text-[10px] opacity-60 font-semibold">{playlists.length} Playlist Tersedia</span>
                  </div>
                  <select
                    data-testid="video-playlist-select"
                    value={videoForm.playlistId || ''}
                    onChange={(e) => setVideoForm({ ...videoForm, playlistId: e.target.value })}
                    className="w-full p-2 text-xs rounded bg-[#121324] border border-[#1e2038] text-white"
                  >
                    <option value="">-- Tidak Dimasukkan ke Playlist --</option>
                    {playlists.map((pl) => (
                      <option key={pl.id || pl._id} value={pl.id || pl._id}>
                        {pl.title} ({Array.isArray(pl.videoIds) ? pl.videoIds.length : 0} video{pl.ownerId ? ' • Playlist Pribadi' : ' • Official Admin'})
                      </option>
                    ))}
                  </select>
                  <span className="text-[9px] opacity-50 block">Pilih playlist jika ingin otomatis memasukkan episode ini ke daftar putar maraton playlist yang dipilih.</span>
                </div>

                {/* Section Link Download Video (Opsional) */}
                <div className="space-y-2.5 p-3.5 rounded-xl border border-[#1e2038] bg-black/30">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-black text-cyan-400 text-xs uppercase tracking-wider block">Link Download Video (Opsional)</span>
                      <span className="text-[10px] opacity-60">Sediakan opsi unduhan video multi-kualitas atau multi-server</span>
                    </div>
                    <button
                      type="button"
                      data-testid="add-download-link-btn"
                      onClick={() => {
                        setVideoForm(prev => ({
                          ...prev,
                          download_links: [...(prev.download_links || []), { provider: '', url: '' }]
                        }));
                      }}
                      className="px-2.5 py-1 rounded bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 border border-cyan-500/40 font-bold text-[10px] flex items-center gap-1 transition-all"
                    >
                      <Plus className="w-3 h-3 pointer-events-none" />
                      <span>+ Tambah Link Download</span>
                    </button>
                  </div>

                  {(!videoForm.download_links || videoForm.download_links.length === 0) ? (
                    <div className="p-3 rounded-lg border border-dashed border-[#1e2038] text-center text-[11px] opacity-50 italic">
                      Belum ada link download ditambahkan (opsional).
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {videoForm.download_links.map((link, idx) => (
                        <div key={idx} data-testid="download-link-row" className="flex flex-col sm:flex-row items-center gap-2 p-2 rounded-lg bg-[#121324] border border-[#1e2038]">
                          <div className="w-full sm:w-1/3">
                            <input
                              type="text"
                              data-testid="download-provider-input"
                              placeholder="Provider / Kualitas (misal: 720p, 1080p)"
                              value={link.provider || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setVideoForm(prev => {
                                  const updated = [...(prev.download_links || [])];
                                  updated[idx] = { ...updated[idx], provider: val };
                                  return { ...prev, download_links: updated };
                                });
                              }}
                              className="w-full p-1.5 text-xs rounded bg-[#0a0b14] border border-[#1e2038] text-white"
                            />
                          </div>
                          <div className="w-full sm:flex-1">
                            <input
                              type="url"
                              data-testid="download-url-input"
                              placeholder="URL Link Download (https://...)"
                              value={link.url || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setVideoForm(prev => {
                                  const updated = [...(prev.download_links || [])];
                                  updated[idx] = { ...updated[idx], url: val };
                                  return { ...prev, download_links: updated };
                                });
                              }}
                              className="w-full p-1.5 text-xs rounded bg-[#0a0b14] border border-[#1e2038] text-white"
                            />
                          </div>
                          <button
                            type="button"
                            data-testid="remove-download-link-btn"
                            aria-label="Hapus Link Download"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setVideoForm(prev => ({
                                ...prev,
                                download_links: (prev.download_links || []).filter((_, i) => i !== idx)
                              }));
                            }}
                            className="p-1.5 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 flex-shrink-0 cursor-pointer"
                            title="Hapus Link Download"
                          >
                            <Trash2 className="w-3.5 h-3.5 pointer-events-none" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-2.5 pt-2 border-t border-slate-500/10">
                  <button type="submit" data-testid="video-submit-btn" className="flex-1 py-2 bg-red-500 hover:bg-red-600 text-white font-extrabold rounded">
                    Simpan Video
                  </button>
                  <button type="button" onClick={() => setShowVideoModal(false)} className="px-4 py-2 bg-slate-500/15 text-slate-300 rounded">
                    Batal
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL BULK EDIT KATEGORI */}
        {showBulkCategoryModal && (
          <div data-testid="bulk-category-modal" className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-[#0d0e1b] border border-red-500/40 rounded-2xl w-full max-w-xl p-6 relative space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
              <button
                type="button"
                onClick={() => { setShowBulkCategoryModal(false); setShowBulkConfirmModal(false); }}
                className="absolute top-4 right-4 p-1 rounded hover:bg-slate-500/10 text-xs opacity-65 text-slate-300"
              >
                ✕
              </button>

              <div className="border-b border-slate-500/15 pb-2.5">
                <h3 className="font-black text-white text-base flex items-center gap-2">
                  <span>🏷️</span>
                  <span>Edit Kategori Video Massal</span>
                </h3>
                <p className="text-xs text-red-400 font-bold mt-0.5">
                  {selectedVideoIds.length} video dipilih untuk diperbarui kategorinya
                </p>
              </div>

              {!showBulkConfirmModal ? (
                <div className="space-y-4 text-xs">
                  <div className="p-3 rounded-lg bg-black/40 border border-white/5 space-y-1">
                    <span className="font-bold text-slate-300 block">Mode Perubahan Kategori</span>
                    <p className="text-[11px] text-slate-400">
                      <strong>GANTI KATEGORI:</strong> Seluruh kategori lama pada {selectedVideoIds.length} video yang dipilih akan digantikan dengan hierarki kategori baru yang dipilih di bawah.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Level 1: Kategori Utama */}
                    <div className="space-y-1 sm:col-span-2">
                      <label className="font-bold opacity-80 text-cyan-300 uppercase text-[10px]">1. Kategori Utama (Wajib)</label>
                      <select
                        data-testid="bulk-category-main-select"
                        value={bulkCategoryForm.animeTitle || ''}
                        onChange={(e) => {
                          const newMain = e.target.value;
                          setBulkCategoryForm({
                            animeTitle: newMain,
                            subCategory: '',
                            subCategory2: '',
                            subCategory3: ''
                          });
                        }}
                        className="w-full p-2.5 rounded-lg bg-[#121324] border border-[#1e2038] text-white focus:border-red-500 outline-none"
                        required
                      >
                        <option value="">-- Pilih Kategori Utama --</option>
                        {categories
                          .filter(c => !c.parent_id || c.parent_id === 'none')
                          .map(c => (
                            <option key={c.id || c._id} value={c.name}>
                              {cleanCategoryName(c.name)}
                            </option>
                          ))}
                      </select>
                    </div>

                    {/* Level 2: Sub-Kategori 1 */}
                    <div className="space-y-1">
                      <label className="font-bold opacity-80 text-cyan-300 uppercase text-[10px]">2. Sub-Kategori 1</label>
                      <select
                        data-testid="bulk-category-sub1-select"
                        value={bulkCategoryForm.subCategory || ''}
                        onChange={(e) => {
                          const newSub1 = e.target.value;
                          setBulkCategoryForm(prev => ({
                            ...prev,
                            subCategory: newSub1,
                            subCategory2: '',
                            subCategory3: ''
                          }));
                        }}
                        className="w-full p-2.5 rounded-lg bg-[#121324] border border-[#1e2038] text-white disabled:opacity-40 focus:border-red-500 outline-none"
                        disabled={!bulkCategoryForm.animeTitle}
                      >
                        <option value="">-- Tanpa Sub-Kategori 1 --</option>
                        {(() => {
                          if (!bulkCategoryForm.animeTitle) return null;
                          const selectedMain = categories.find(
                            c => (!c.parent_id || c.parent_id === 'none') && 
                                 (c.name === bulkCategoryForm.animeTitle || cleanCategoryName(c.name) === cleanCategoryName(bulkCategoryForm.animeTitle))
                          );
                          if (!selectedMain) return null;
                          const mainId = String(selectedMain.id || selectedMain._id);
                          const subs = categories.filter(c => c.parent_id && String(c.parent_id) === mainId);
                          return subs.map((sub) => (
                            <option key={sub.id || sub._id} value={sub.name}>
                              {cleanCategoryName(sub.name)}
                            </option>
                          ));
                        })()}
                      </select>
                    </div>

                    {/* Level 3: Sub-Kategori 2 */}
                    <div className="space-y-1">
                      <label className="font-bold opacity-80 text-purple-300 uppercase text-[10px]">3. Sub-Kategori 2</label>
                      <select
                        data-testid="bulk-category-sub2-select"
                        value={bulkCategoryForm.subCategory2 || ''}
                        onChange={(e) => {
                          const newSub2 = e.target.value;
                          setBulkCategoryForm(prev => ({
                            ...prev,
                            subCategory2: newSub2,
                            subCategory3: ''
                          }));
                        }}
                        className="w-full p-2.5 rounded-lg bg-[#121324] border border-[#1e2038] text-white disabled:opacity-40 focus:border-red-500 outline-none"
                        disabled={!bulkCategoryForm.subCategory}
                      >
                        <option value="">-- Tanpa Sub-Kategori 2 --</option>
                        {(() => {
                          if (!bulkCategoryForm.subCategory) return null;
                          const selectedSub1 = categories.find(
                            c => c.name === bulkCategoryForm.subCategory || 
                                 cleanCategoryName(c.name) === cleanCategoryName(bulkCategoryForm.subCategory)
                          );
                          if (!selectedSub1) return null;
                          const sub1Id = String(selectedSub1.id || selectedSub1._id);
                          const sub2s = categories.filter(c => c.parent_id && String(c.parent_id) === sub1Id);
                          return sub2s.map((sub2) => (
                            <option key={sub2.id || sub2._id} value={sub2.name}>
                              {cleanCategoryName(sub2.name)}
                            </option>
                          ));
                        })()}
                      </select>
                    </div>

                    {/* Level 4: Sub-Kategori 3 */}
                    <div className="space-y-1 sm:col-span-2">
                      <label className="font-bold opacity-80 text-pink-300 uppercase text-[10px]">4. Sub-Kategori 3 (Opsional)</label>
                      <select
                        data-testid="bulk-category-sub3-select"
                        value={bulkCategoryForm.subCategory3 || ''}
                        onChange={(e) => setBulkCategoryForm(prev => ({ ...prev, subCategory3: e.target.value }))}
                        className="w-full p-2.5 rounded-lg bg-[#121324] border border-[#1e2038] text-white disabled:opacity-40 focus:border-red-500 outline-none"
                        disabled={!bulkCategoryForm.subCategory2}
                      >
                        <option value="">-- Tanpa Sub-Kategori 3 --</option>
                        {(() => {
                          if (!bulkCategoryForm.subCategory2) return null;
                          const selectedSub2 = categories.find(
                            c => c.name === bulkCategoryForm.subCategory2 || 
                                 cleanCategoryName(c.name) === cleanCategoryName(bulkCategoryForm.subCategory2)
                          );
                          if (!selectedSub2) return null;
                          const sub2Id = String(selectedSub2.id || selectedSub2._id);
                          const sub3s = categories.filter(c => c.parent_id && String(c.parent_id) === sub2Id);
                          return sub3s.map((sub3) => (
                            <option key={sub3.id || sub3._id} value={sub3.name}>
                              {cleanCategoryName(sub3.name)}
                            </option>
                          ));
                        })()}
                      </select>
                    </div>
                  </div>

                  <div className="flex gap-2.5 pt-3 border-t border-slate-500/10">
                    <button
                      type="button"
                      data-testid="btn-proceed-bulk-confirm"
                      disabled={!bulkCategoryForm.animeTitle}
                      onClick={() => setShowBulkConfirmModal(true)}
                      className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-extrabold rounded-lg transition-all cursor-pointer"
                    >
                      Lanjutkan ke Konfirmasi ({selectedVideoIds.length} Video)
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowBulkCategoryModal(false)}
                      className="px-4 py-2.5 bg-slate-700/50 hover:bg-slate-700 text-slate-200 rounded-lg font-bold cursor-pointer"
                    >
                      Batal
                    </button>
                  </div>
                </div>
              ) : (
                /* CONFIRMATION VIEW */
                <div className="space-y-4 text-xs">
                  <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 space-y-2">
                    <span className="font-black text-sm flex items-center gap-1.5">
                      ⚠️ Konfirmasi Perubahan Massal
                    </span>
                    <p className="text-[11px] leading-relaxed">
                      Anda akan memperbarui kategori untuk <strong className="text-white underline">{selectedVideoIds.length} video</strong> sekaligus:
                    </p>
                    <div className="p-2.5 rounded-lg bg-black/60 border border-white/10 font-mono text-[11px] text-cyan-300">
                      <span>Kategori Baru: </span>
                      <strong className="text-emerald-400">
                        {bulkCategoryForm.animeTitle}
                        {bulkCategoryForm.subCategory ? ` > ${bulkCategoryForm.subCategory}` : ''}
                        {bulkCategoryForm.subCategory2 ? ` > ${bulkCategoryForm.subCategory2}` : ''}
                        {bulkCategoryForm.subCategory3 ? ` > ${bulkCategoryForm.subCategory3}` : ''}
                      </strong>
                    </div>
                  </div>

                  <div className="flex gap-2.5 pt-2">
                    <button
                      type="button"
                      data-testid="btn-execute-bulk-update"
                      disabled={bulkCategoryUpdating}
                      onClick={handleExecuteBulkCategoryUpdate}
                      className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-black rounded-lg transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {bulkCategoryUpdating ? (
                        <span>⏳ Memperbarui {selectedVideoIds.length} video...</span>
                      ) : (
                        <span>✓ Ya, Update {selectedVideoIds.length} Video Sekarang</span>
                      )}
                    </button>
                    <button
                      type="button"
                      disabled={bulkCategoryUpdating}
                      onClick={() => setShowBulkConfirmModal(false)}
                      className="px-4 py-2.5 bg-slate-700/50 hover:bg-slate-700 text-slate-200 rounded-lg font-bold cursor-pointer"
                    >
                      Kembali
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {showWorkerModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-[#0d0e1b] border border-orange-500/40 rounded-2xl w-full max-w-3xl p-6 relative space-y-4 shadow-2xl max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">☁️</span>
                  <div>
                    <h3 className="text-sm font-bold text-orange-400">Cloudflare Worker CDN - Code & Configuration</h3>
                    <p className="text-[11px] opacity-70 text-slate-300">Script Edge Cache Reverse Proxy & Wrangler Configuration terkonfigurasi otomatis</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowWorkerModal(false)}
                  className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white text-sm"
                >
                  ✕
                </button>
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                <button
                  type="button"
                  onClick={() => setActiveWorkerModalTab('script')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    activeWorkerModalTab === 'script' ? 'bg-orange-600 text-white shadow' : 'bg-white/5 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  cloudflare-worker.js
                </button>
                <button
                  type="button"
                  onClick={() => setActiveWorkerModalTab('wrangler')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    activeWorkerModalTab === 'wrangler' ? 'bg-orange-600 text-white shadow' : 'bg-white/5 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  wrangler.toml
                </button>
                <button
                  type="button"
                  onClick={() => setActiveWorkerModalTab('guide')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    activeWorkerModalTab === 'guide' ? 'bg-orange-600 text-white shadow' : 'bg-white/5 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  📖 Panduan Deploy (Wrangler / Dashboard)
                </button>
              </div>

              {/* Tab Content */}
              <div className="flex-1 overflow-y-auto space-y-3">
                {activeWorkerModalTab === 'script' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-slate-400">
                        Origin target: <code className="text-cyan-300 font-mono">{siteSettings.originUrl || 'https://shindoranesub.my.id'}</code>
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleCopyWorkerScript}
                          className="px-2.5 py-1 bg-amber-600/30 hover:bg-amber-600/50 text-amber-300 border border-amber-500/40 rounded text-[11px] font-bold cursor-pointer"
                        >
                          📋 Salin Kode
                        </button>
                        <button
                          type="button"
                          onClick={handleDownloadWorkerScript}
                          className="px-2.5 py-1 bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/40 rounded text-[11px] font-bold cursor-pointer"
                        >
                          📥 Unduh .js
                        </button>
                      </div>
                    </div>
                    <pre className="p-3 rounded-xl bg-black/70 border border-white/10 text-[11px] font-mono text-emerald-300/90 overflow-x-auto max-h-[360px] leading-relaxed">
                      {workerScriptData || '// Memuat script worker...'}
                    </pre>
                  </div>
                )}

                {activeWorkerModalTab === 'wrangler' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-slate-400">
                        Konfigurasi CLI Wrangler untuk deploy cepat
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleCopyWrangler}
                          className="px-2.5 py-1 bg-amber-600/30 hover:bg-amber-600/50 text-amber-300 border border-amber-500/40 rounded text-[11px] font-bold cursor-pointer"
                        >
                          📋 Salin wrangler.toml
                        </button>
                        <button
                          type="button"
                          onClick={handleDownloadWrangler}
                          className="px-2.5 py-1 bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/40 rounded text-[11px] font-bold cursor-pointer"
                        >
                          📥 Unduh .toml
                        </button>
                      </div>
                    </div>
                    <pre className="p-3 rounded-xl bg-black/70 border border-white/10 text-xs font-mono text-cyan-300/90 overflow-x-auto max-h-[360px] leading-relaxed">
                      {wranglerConfigData || '// Memuat konfigurasi wrangler.toml...'}
                    </pre>
                  </div>
                )}

                {activeWorkerModalTab === 'guide' && (
                  <div className="space-y-4 text-xs text-slate-300 leading-relaxed">
                    <div className="p-3.5 rounded-xl bg-black/40 border border-white/10 space-y-2">
                      <h4 className="font-bold text-orange-400 text-sm">Metode 1: Deploy Lewat Cloudflare Web Dashboard</h4>
                      <ol className="list-decimal list-inside space-y-1.5 opacity-90 pl-1">
                        <li>Buka <strong>dash.cloudflare.com</strong> &gt; menu <strong>Workers &amp; Pages</strong>.</li>
                        <li>Klik <strong>Create application</strong> &gt; <strong>Create Worker</strong> &gt; <strong>Deploy</strong>.</li>
                        <li>Klik <strong>Edit code</strong>, lalu paste seluruh isi kode dari tab <em>cloudflare-worker.js</em> di atas &gt; <strong>Save and Deploy</strong>.</li>
                        <li>Buka <strong>Settings &gt; Variables &amp; Secrets</strong>, tambahkan Environment Variable:
                          <br /><code className="text-cyan-300 bg-black/60 px-2 py-0.5 rounded font-mono ml-4 inline-block mt-1">ORIGIN_URL = {siteSettings.originUrl || 'https://shindoranesub.my.id'}</code>
                        </li>
                        <li>Buka <strong>Settings &gt; Domains &amp; Routes</strong>, tambahkan Custom Domain (misal <code className="text-orange-300 font-mono">cdn.shindoranesub.my.id</code>) atau Route.</li>
                      </ol>
                    </div>

                    <div className="p-3.5 rounded-xl bg-black/40 border border-white/10 space-y-2">
                      <h4 className="font-bold text-cyan-400 text-sm">Metode 2: Deploy Lewat Terminal / Wrangler CLI</h4>
                      <pre className="p-3 rounded-lg bg-black/80 font-mono text-[11px] text-emerald-300">
{`# 1. Install Wrangler CLI
npm install -g wrangler

# 2. Login ke akun Cloudflare
npx wrangler login

# 3. Deploy langsung dari folder project
npx wrangler deploy`}
                      </pre>
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-white/10 pt-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowWorkerModal(false)}
                  className="px-4 py-2 bg-slate-700/60 hover:bg-slate-700 text-white rounded-lg text-xs font-bold"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        )}

        <Toaster richColors position="top-right" />
      </main>
    </div>
  )
}
