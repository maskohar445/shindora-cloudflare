'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import OneSignalBell from '@/components/OneSignalBell'
import SmartTVInterface from '@/components/tv/SmartTVInterface'
import AdSlotContainer from '@/components/AdSlotContainer'
import FloatingAds from '@/components/FloatingAds'
import GlobalAdScripts from '@/components/GlobalAdScripts'
import { getIsTVModeActive, setTVModeActive } from '@/lib/utils/tvMode'
import { toast } from 'sonner'
import { subscribeToWebPush } from '@/lib/utils/push'
import {
  Menu,
  Tv,
  Search,
  Eye,
  EyeOff,
  Sun,
  Moon,
  Play,
  Heart,
  Clock,
  Plus,
  Trash2,
  LogOut,
  X,
  User,
  Upload,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  FolderHeart,
  ListVideo,
  Bell,
  BarChart3,
  AlertTriangle,
  Download
} from 'lucide-react'

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
    return numB - numA;
  });
}

const sortVideosByEpisodeAscending = (videoList) => {
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

const checkVideoMatchesCategory = (video, catObj, categoriesList) => {
  if (!video || !catObj) return false;

  const catId = String(catObj.id || catObj._id || '');
  const catParentId = catObj.parent_id ? String(catObj.parent_id) : null;

  let isDepth1 = !catParentId || catParentId === 'none';
  let isDepth2 = false;
  let isDepth3 = false;
  let isDepth4 = false;
  let parentCat = null;
  let grandparentCat = null;
  let greatGrandparentCat = null;

  if (!isDepth1) {
    parentCat = categoriesList.find(c => String(c.id || c._id) === catParentId);
    if (parentCat) {
      const pParentId = parentCat.parent_id ? String(parentCat.parent_id) : null;
      if (!pParentId || pParentId === 'none') {
        isDepth2 = true;
      } else {
        grandparentCat = categoriesList.find(c => String(c.id || c._id) === pParentId);
        if (grandparentCat) {
          const gpParentId = grandparentCat.parent_id ? String(grandparentCat.parent_id) : null;
          if (!gpParentId || gpParentId === 'none') {
            isDepth3 = true;
          } else {
            isDepth4 = true;
            greatGrandparentCat = categoriesList.find(c => String(c.id || c._id) === gpParentId);
          }
        } else {
          isDepth3 = true;
        }
      }
    } else {
      isDepth1 = true;
    }
  }

  const vMainId = video.category_id || video.categoryId;
  const vSub1Id = video.sub_category_1_id || video.sub_category_id || video.subCategoryId || video.sub_category;
  const vSub2Id = video.sub_category_2_id || video.sub_category_2 || video.subCategory2Id;
  const vSub3Id = video.sub_category_3_id || video.sub_category_3 || video.subCategory3Id;

  const vMainName = video.animeTitle || '';
  const vSub1Name = video.subCategory || video.sub_category || '';
  const vSub2Name = video.subCategory2 || video.sub_category_2 || '';
  const vSub3Name = video.subCategory3 || video.sub_category_3 || '';

  const cleanC = (str) => String(str || '').replace(/[^a-zA-Z0-9\s-]/g, '').trim().toUpperCase();

  // Level 1: Kategori Utama
  if (isDepth1) {
    const idMatches = vMainId && String(vMainId) === catId;
    const nameMatches = cleanC(vMainName) === cleanC(catObj.name);
    return idMatches || nameMatches;
  }

  // Level 2: Sub-Kategori 1
  if (isDepth2) {
    const parentMatches = !parentCat || 
                          (vMainId && String(vMainId) === String(parentCat.id || parentCat._id)) || 
                          (cleanC(vMainName) === cleanC(parentCat.name));
    const selfMatches = (vSub1Id && String(vSub1Id) === catId) || 
                        (cleanC(vSub1Name) === cleanC(catObj.name));
    return parentMatches && selfMatches;
  }

  // Level 3: Sub-Kategori 2
  if (isDepth3) {
    const selfMatches = (vSub2Id && String(vSub2Id) === catId) || 
                        (cleanC(vSub2Name) === cleanC(catObj.name));
    if (!selfMatches) return false;

    const parentMatches = !parentCat || 
                          (vSub1Id && String(vSub1Id) === String(parentCat.id || parentCat._id)) || 
                          (cleanC(vSub1Name) === cleanC(parentCat.name));
    return parentMatches;
  }

  // Level 4: Sub-Kategori 3
  if (isDepth4) {
    const selfMatches = (vSub3Id && String(vSub3Id) === catId) || 
                        (cleanC(vSub3Name) === cleanC(catObj.name));
    if (!selfMatches) return false;

    const parentMatches = !parentCat || 
                          (vSub2Id && String(vSub2Id) === String(parentCat.id || parentCat._id)) || 
                          (cleanC(vSub2Name) === cleanC(parentCat.name));
    return parentMatches;
  }

  return false;
};

const extractSrcFromIframe = (iframeString) => {
  if (!iframeString) return '';
  const match = iframeString.match(/src=["']([^"']+)["']/i);
  return match ? match[1] : '';
};

const formatEmbedUrl = (inputUrl) => {
  if (!inputUrl) return { type: 'embed', url: '' };

  let url = inputUrl.trim();

  if (url.startsWith('<iframe') || url.toLowerCase().includes('<iframe')) {
    const extracted = extractSrcFromIframe(url);
    if (extracted) {
      url = extracted.trim();
    }
  }

  const isDirectVideo = url.endsWith('.mp4') || url.endsWith('.webm') || url.includes('.mp4?') || url.includes('.webm?');
  if (isDirectVideo) {
    return { type: 'video', url };
  }

  if (url.includes('ok.ru/video/') && !url.includes('ok.ru/videoembed/')) {
    url = url.replace('ok.ru/video/', 'ok.ru/videoembed/');
  }

  // Ensure VK embed URLs have js_api=1 and autoplay=1 parameters
  if (url.includes('vk.com') || url.includes('vkvideo.ru')) {
    if (!url.includes('js_api=1')) {
      url = `${url}${url.includes('?') ? '&' : '?'}js_api=1`;
    }
    if (!url.includes('autoplay=1')) {
      url = `${url}${url.includes('?') ? '&' : '?'}autoplay=1`;
    }
  }

  return { type: 'embed', url };
};

const parseToSeconds = (dur) => {
  if (!dur) return 0;
  if (typeof dur === 'number') return dur;
  const parts = String(dur).split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return Number(dur) || 0;
};

const parseDurationFromString = (str) => {
  if (!str) return 0;
  
  // Try parseToSeconds first
  const seconds = parseToSeconds(str);
  if (seconds > 0) return seconds;
  
  const minMatch = str.match(/(\d+)\s*(menit|m)/i);
  const secMatch = str.match(/(\d+)\s*(detik|s)/i);
  
  let totalSeconds = 0;
  if (minMatch) {
    totalSeconds += parseInt(minMatch[1], 10) * 60;
  }
  if (secMatch) {
    totalSeconds += parseInt(secMatch[1], 10);
  }
  
  if (totalSeconds > 0) return totalSeconds;

  const timeParts = str.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (timeParts) {
    if (timeParts[3]) {
      return parseInt(timeParts[1], 10) * 3600 + parseInt(timeParts[2], 10) * 60 + parseInt(timeParts[3], 10);
    } else {
      return parseInt(timeParts[1], 10) * 60 + parseInt(timeParts[2], 10);
    }
  }

  return 0;
};

const estimateVideoDuration = (video) => {
  if (!video) return 1380;

  const titleDur = parseDurationFromString(video.title);
  if (titleDur > 0) return titleDur;

  const descDur = parseDurationFromString(video.description);
  if (descDur > 0) return descDur;

  const title = (video.title || '').toLowerCase();
  const desc = (video.description || '').toLowerCase();
  const ep = (video.episode || '').toLowerCase();
  
  if (title.includes('movie') || desc.includes('movie') || ep.includes('movie')) {
    return 5400; // 90 mins for movie
  }
  if (title.includes('ova') || title.includes('special') || ep.includes('special') || ep.includes('ova')) {
    return 600; // 10 mins for OVA/Special
  }
  return 1380; // 23 mins for standard TV episodes
};

export default function App({ initialSlug, initialVideo, initialTVMode = false, initialVideos = [], initialCategories = [], initialSettings = null, initialAds = [] } = {}) {
  const formatEpisodeBadge = (episodeStr) => {
    if (!episodeStr) return "";
    const trimmed = episodeStr.trim();
    const upper = trimmed.toUpperCase();
    
    // 1. Teks khusus langsung dikembalikan
    const specialKeywords = ["OVA", "SPECIAL", "MOVIE", "SP", "SPESIAL", "SPINOFF"];
    if (specialKeywords.some(keyword => upper === keyword || upper.startsWith(keyword + " "))) {
      return trimmed;
    }
    
    // 2. Jika sudah ada awalan \"EPS\" (case insensitive), kembalikan
    if (upper.startsWith("EPS ") || upper.startsWith("EPS")) {
      return trimmed;
    }
    
    // 3. Jika hanya angka atau kode episode lainnya (misal: \"001\", \"02\", \"100\"), beri awalan \"Eps\"
    return "Eps " + trimmed;
  };

  const cleanCategoryName = (name) => {
    if (!name) return '';
    let cleaned = String(name).trim();
    while (/^(↳+|i,\s*|,+\s*|i\s+|[↳\s\u00A0]+)/i.test(cleaned)) {
      cleaned = cleaned.replace(/^(↳+|i,\s*|,+\s*|i\s+|[↳\s\u00A0]+)/i, '').trim();
    }
    return cleaned;
  };

  const getCategoryPath = (cat) => {
    if (!cat) return '';
    const cleanName = cleanCategoryName(cat.name);
    const parent = categories.find(p => p.id && cat.parent_id && String(p.id) === String(cat.parent_id));
    if (parent) {
      return `${getCategoryPath(parent)} > ${cleanName}`;
    }
    return cleanName;
  };

  const getVideoCategoryString = (video) => {
    if (!video) return '';
    const parts = [];
    if (video.animeTitle) parts.push(cleanCategoryName(video.animeTitle));
    if (video.subCategory) parts.push(cleanCategoryName(video.subCategory));
    if (video.subCategory2) parts.push(cleanCategoryName(video.subCategory2));
    if (video.subCategory3) parts.push(cleanCategoryName(video.subCategory3));
    return parts.join(' > ');
  };

  const handleCategoryClick = (categoryNameOrId) => {
    if (!categoryNameOrId) return;
    setActiveCategory(categoryNameOrId);
    navigateToTab('home');
  };

  const [isMounted, setIsMounted] = useState(true)

  const renderCategoryBadges = (animeTitle, subCategory, textClass = "text-[8px] sm:text-[9px]", subCategory2, subCategory3, isClickable = true) => {
    if (!animeTitle) return null;
    const parts = animeTitle.split(' > ');
    const mainCat = cleanCategoryName(parts[0]);
    const subCat = cleanCategoryName(subCategory || (parts.length >= 2 ? parts[1] : null));
    const subCat2 = cleanCategoryName(subCategory2 || (parts.length >= 3 ? parts[2] : null));
    const subCat3 = cleanCategoryName(subCategory3 || (parts.length >= 4 ? parts[3] : null));

    // Find database category objects to get real IDs and relations
    const mainObj = categories.find(c => 
      (!c.parent_id || c.parent_id === 'none') && 
      (cleanCategoryName(c.name).toUpperCase() === mainCat.toUpperCase())
    );
    const mainId = mainObj ? String(mainObj.id || mainObj._id) : null;

    const sub1Obj = subCat ? categories.find(c => 
      (cleanCategoryName(c.name).toUpperCase() === subCat.toUpperCase()) &&
      (!mainId || String(c.parent_id) === mainId)
    ) : null;
    const sub1Id = sub1Obj ? String(sub1Obj.id || sub1Obj._id) : null;

    const sub2Obj = subCat2 ? categories.find(c => 
      (cleanCategoryName(c.name).toUpperCase() === subCat2.toUpperCase()) &&
      (!sub1Id || String(c.parent_id) === sub1Id)
    ) : null;
    const sub2Id = sub2Obj ? String(sub2Obj.id || sub2Obj._id) : null;

    const sub3Obj = subCat3 ? categories.find(c => 
      (cleanCategoryName(c.name).toUpperCase() === subCat3.toUpperCase()) &&
      (!sub2Id || String(c.parent_id) === sub2Id)
    ) : null;

    const onBadgeClick = (catObj, fallbackName) => (e) => {
      if (!isClickable) return;
      e.stopPropagation();
      e.preventDefault();
      const target = catObj ? String(catObj.id || catObj._id) : fallbackName;
      handleCategoryClick(target);
    };

    return (
      <div className="flex flex-wrap items-center gap-1" aria-label="Navigasi Kategori">
        {mainCat && (
          <button
            type="button"
            onClick={onBadgeClick(mainObj, mainCat)}
            className={`px-1.5 py-0.5 rounded font-extrabold bg-black/85 text-cyan-300 uppercase tracking-wider cursor-pointer hover:bg-black hover:text-cyan-200 hover:scale-105 active:scale-95 transition-all shadow-sm max-w-[95px] sm:max-w-none truncate backdrop-blur-xs ${textClass}`}
            title={`Lihat Kategori Utama: ${mainCat}`}
            aria-label={`Kategori Utama ${mainCat}`}
          >
            {mainCat}
          </button>
        )}
        {subCat && (
          <button
            type="button"
            onClick={onBadgeClick(sub1Obj, subCat)}
            className={`px-1.5 py-0.5 rounded font-bold bg-cyan-600/90 text-white uppercase tracking-wider cursor-pointer hover:bg-cyan-500 hover:scale-105 active:scale-95 transition-all shadow-sm max-w-[85px] sm:max-w-none truncate ${textClass}`}
            title={`Lihat Sub-Kategori: ${subCat}`}
            aria-label={`Sub-Kategori ${subCat}`}
          >
            {subCat}
          </button>
        )}
        {subCat2 && (
          <button
            type="button"
            onClick={onBadgeClick(sub2Obj, subCat2)}
            className={`hidden sm:inline-block px-1.5 py-0.5 rounded font-bold bg-purple-600/90 text-white uppercase tracking-wider cursor-pointer hover:bg-purple-500 hover:scale-105 active:scale-95 transition-all shadow-sm max-w-[85px] sm:max-w-none truncate ${textClass}`}
            title={`Lihat Sub-Kategori 2: ${subCat2}`}
            aria-label={`Sub-Kategori 2 ${subCat2}`}
          >
            {subCat2}
          </button>
        )}
        {subCat3 && (
          <button
            type="button"
            onClick={onBadgeClick(sub3Obj, subCat3)}
            className={`hidden sm:inline-block px-1.5 py-0.5 rounded font-bold bg-pink-600/90 text-white uppercase tracking-wider cursor-pointer hover:bg-pink-500 hover:scale-105 active:scale-95 transition-all shadow-sm max-w-[85px] sm:max-w-none truncate ${textClass}`}
            title={`Lihat Sub-Kategori 3: ${subCat3}`}
            aria-label={`Sub-Kategori 3 ${subCat3}`}
          >
            {subCat3}
          </button>
        )}
      </div>
    );
  };
  // Theme and UI state
  const [theme, setTheme] = useState('light')
  const [isTVMode, setIsTVMode] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false) // Collapse initially on desktop!
  const [activeTab, setActiveTab] = useState(() => {
    if (initialSlug || (typeof window !== 'undefined' && window.location.pathname.startsWith('/watch/'))) return 'watch';
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      return p.get('tab') || 'home';
    }
    return 'home';
  }) // home, trending, playlists, later, liked, profile, watch

  const navigateToTab = useCallback((tabName, videoObj = null) => {
    setActiveTab(tabName);
    if (tabName === 'watch') {
      if (videoObj) {
        setActiveVideo(videoObj);
        if (typeof window !== 'undefined') {
          const targetUrl = `/watch/${videoObj.slug || videoObj.id}`;
          if (window.location.pathname !== targetUrl) {
            window.history.pushState({ tab: 'watch', slug: videoObj.slug || videoObj.id }, '', targetUrl);
          }
        }
      }
    } else {
      setActiveVideo(null);
      if (typeof window !== 'undefined') {
        const targetUrl = tabName === 'home' ? '/' : `/?tab=${tabName}`;
        if (window.location.pathname !== '/' || (tabName !== 'home' && window.location.search !== `?tab=${tabName}`)) {
          window.history.pushState({ tab: tabName }, '', targetUrl);
        }
      }
    }
    setSidebarOpen(false);
  }, []);
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState('SEMUA')

  // PWA Install States
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [isInstallable, setIsInstallable] = useState(false)

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setIsInstallable(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    const handleAppInstalled = () => {
      setIsInstallable(false)
      setDeferredPrompt(null)
    }
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  const handleInstallPwa = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setIsInstallable(false)
    }
    setDeferredPrompt(null)
  }

  // Authentication State
  const [currentUser, setCurrentUser] = useState(null)

  // Core Data Lists
  const [videos, setVideos] = useState(() => (Array.isArray(initialVideos) && initialVideos.length > 0 ? initialVideos : []))
  const [categories, setCategories] = useState(() => (Array.isArray(initialCategories) && initialCategories.length > 0 ? initialCategories : []))
  const [playlists, setPlaylists] = useState([])
  const [ads, setAds] = useState(() => (Array.isArray(initialAds) && initialAds.length > 0 ? initialAds : []))
  const [staticPages, setStaticPages] = useState([])
  const [pollingList, setPollingList] = useState([])
  const [adblockDetected, setAdblockDetected] = useState(false)
  const [isDevToolsDetected, setIsDevToolsDetected] = useState(false)
  const [playlistSelectorVideo, setPlaylistSelectorVideo] = useState(null)
  const [settings, setSettings] = useState(() => {
    if (initialSettings && typeof initialSettings === 'object') return initialSettings
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('shindora-settings')
        if (cached) {
          const parsed = JSON.parse(cached)
          if (parsed && typeof parsed === 'object') return parsed
        }
      } catch (e) {}
    }
    return null
  })
  const [isSettingsLoaded, setIsSettingsLoaded] = useState(() => {
    if (initialSettings) return true
    if (typeof window !== 'undefined') {
      return !!localStorage.getItem('shindora-settings')
    }
    return false
  })

  // Watch State
  const [activeVideo, setActiveVideo] = useState(() => initialVideo || null)
  const [activeServer, setActiveServer] = useState(1)
  const [likedVideoIds, setLikedVideos] = useState([])
  const [watchLaterIds, setWatchLater] = useState([])

  useEffect(() => {
    if (initialVideo) {
      setActiveVideo(initialVideo)
      setActiveTab('watch')
    }
  }, [initialVideo])

  useEffect(() => {
    const handlePopState = () => {
      if (typeof window === 'undefined') return;
      const path = window.location.pathname;
      if (path.startsWith('/watch/')) {
        const rawSlug = path.substring('/watch/'.length).replace(/\/+$/, '');
        const decodedSlug = decodeURIComponent(rawSlug).toLowerCase().trim();
        const found = videos.find(v => (v.slug || '').toLowerCase() === decodedSlug || v.id === decodedSlug);
        if (found) {
          setActiveVideo(found);
          setActiveTab('watch');
        } else if (initialVideo && ((initialVideo.slug || '').toLowerCase() === decodedSlug || initialVideo.id === decodedSlug)) {
          setActiveVideo(initialVideo);
          setActiveTab('watch');
        } else {
          setActiveTab('watch');
        }
      } else {
        const params = new URLSearchParams(window.location.search);
        const tab = params.get('tab') || 'home';
        setActiveVideo(null);
        setActiveTab(tab);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [videos, initialVideo])
  
  // Dynamic Autoplay Countdown states
  const [isTriggeringNextEpisode, setIsTriggeringNextEpisode] = useState(false)
  const [nextEpisodeCountdown, setNextEpisodeCountdown] = useState(0)
  const [nextEpisodeTarget, setNextEpisodeTarget] = useState(null)
  
  // Comments for active video
  const [comments, setComments] = useState([])
  const [newCommentText, setNewCommentText] = useState('')
  const [activeReplyToId, setActiveReplyToId] = useState(null)
  const [replyText, setReplyText] = useState('')
  const [expandedReplies, setExpandedReplies] = useState([])
  const [showComments, setShowComments] = useState(false)

  // User-Side Notifications states
  const [userNotifications, setUserNotifications] = useState([])
  const [showNotificationsDropdown, setShowNotificationsDropdown] = useState(false)

  const [showAnnouncement, setShowAnnouncement] = useState(true)

  // Donation Overlay States

  // User custom polling creation modal state
  const [showUserPollModal, setShowUserPollModal] = useState(false)
  const [userPollForm, setUserPollForm] = useState({
    title: '',
    releaseYear: '',
    mediaType: 'TV Series',
    referenceLink: '',
    reason: ''
  })

  const [activeOverlayDonation, setActiveOverlayDonation] = useState(null)
  const [lastSeenDonationId, setLastSeenDonationId] = useState(null)
  const [manualDonationIndex, setManualDonationIndex] = useState(0)

  const [votedPollOptions, setVotedPollOptions] = useState({})

  // Playlist Mode Player State
  const [currentPlaylist, setCurrentPlaylist] = useState(null)
  const [currentPlaylistIndex, setCurrentPlaylistIndex] = useState(0)
  const [isAutoplayPlaylist, setIsAutoplayPlaylist] = useState(true)

  const activeVideoRef = useRef(activeVideo)
  const videosRef = useRef(videos)
  const currentPlaylistRef = useRef(currentPlaylist)
  const isAutoplayPlaylistRef = useRef(isAutoplayPlaylist)

  useEffect(() => {
    activeVideoRef.current = activeVideo
  }, [activeVideo])

  useEffect(() => {
    videosRef.current = videos
  }, [videos])

  useEffect(() => {
    currentPlaylistRef.current = currentPlaylist
  }, [currentPlaylist])

  useEffect(() => {
    isAutoplayPlaylistRef.current = isAutoplayPlaylist
  }, [isAutoplayPlaylist])

const getAnnouncementBadgeLabel = () => {
  if (settings?.isManualDonationActive) {
    if (Array.isArray(settings?.manualDonationList) && settings.manualDonationList.length > 0) {
      const list = settings.manualDonationList;
      const currentItem = list[manualDonationIndex % list.length];
      return (currentItem?.platform || 'DONASI').toUpperCase();
    }
    if (settings?.manualDonatorName) {
      return (settings?.manualDonationPlatform || 'DONASI').toUpperCase();
    }
  }

  // Hindari penggunaan API Key sebagai fallback UI badge
  const val = settings?.announcementBadge;
  if (!val || val.includes('key') || val.includes('secret') || val === 'onesignal-rest-key-123') {
    return 'PENGUMUMAN';
  }
  return val;
};

const getAnnouncementMessageLabel = () => {
  if (settings?.isManualDonationActive) {
    if (Array.isArray(settings?.manualDonationList) && settings.manualDonationList.length > 0) {
      return settings.manualDonationList.map(item => {
        const msg = item.message ? `: "${item.message}"` : '';
        return `${item.name} mendonasikan ${item.amount} via ${item.platform}${msg}`;
      }).join('  ||  ');
    }
    if (settings?.manualDonatorName) {
      const name = settings.manualDonatorName || 'Donatur';
      const amount = settings.manualDonationAmount || 'Rp 0';
      const platform = settings.manualDonationPlatform || 'Manual';
      const message = settings.manualDonationMessage ? `: "${settings.manualDonationMessage}"` : '';
      return `${name} mendonasikan ${amount} via ${platform}${message}`;
    }
  }

  // Mengembalikan teks pengumuman kustom atau string kosong (tanpa default fallback)
  return settings?.announcementText || '';
};

  // ANTI ADBLOCK DETECTOR HOOK
  useEffect(() => {
    if (!isMounted || !settings || !settings.antiAdblockActive) {
      setAdblockDetected(false);
      return;
    }

    const verifyAdblock = async () => {
      // DOM check
      const tester = document.createElement('div');
      tester.className = 'adsbox ad-placement ad-banner pub_300x250';
      tester.style.position = 'absolute';
      tester.style.left = '-9999px';
      tester.style.width = '1px';
      tester.style.height = '1px';
      document.body.appendChild(tester);
      const domBlocked = tester.offsetParent === null || window.getComputedStyle(tester).display === 'none';
      document.body.removeChild(tester);
      
      if (domBlocked) {
        setAdblockDetected(true);
        return;
      }

      // Fetch check
      try {
        await fetch('https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js', { method: 'HEAD', mode: 'no-cors' });
        setAdblockDetected(false);
      } catch (err) {
        setAdblockDetected(true);
      }
    };

    verifyAdblock();
    const interval = setInterval(verifyAdblock, 5000);
    return () => clearInterval(interval);
  }, [isMounted, settings]);

  // ANTI COPY / INSPECT ELEMENT HOOK
  useEffect(() => {
    if (!isMounted || !settings || !settings.antiCopyActive) return;

    const handleContextMenu = (e) => {
      e.preventDefault();
      alert('Proteksi Klik Kanan Aktif!');
    };
    window.addEventListener('contextmenu', handleContextMenu);

    const handleKeyDown = (e) => {
      if (e.key === 'F12') {
        e.preventDefault();
        alert('Proteksi Inspect Element Aktif!');
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key?.toLowerCase() === 'i') {
        e.preventDefault();
        alert('Proteksi Inspect Element Aktif!');
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key?.toLowerCase() === 'j') {
        e.preventDefault();
        alert('Proteksi Inspect Element Aktif!');
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key?.toLowerCase() === 'u') {
        e.preventDefault();
        alert('Proteksi View Source Aktif!');
        return;
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMounted, settings]);

  // ANTI DEVELOPER TOOLS PROTECTION HOOK
  useEffect(() => {
    if (!isMounted || !settings || !settings.antiDevToolsActive) return;

    const handleKeyDownDevTools = (e) => {
      if (e.key === 'F12') {
        e.preventDefault();
        setIsDevToolsDetected(true);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key?.toLowerCase() === 'i') {
        e.preventDefault();
        setIsDevToolsDetected(true);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key?.toLowerCase() === 'j') {
        e.preventDefault();
        setIsDevToolsDetected(true);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key?.toLowerCase() === 'u') {
        e.preventDefault();
        setIsDevToolsDetected(true);
        return;
      }
    };
    window.addEventListener('keydown', handleKeyDownDevTools);

    const checkDevTools = () => {
      const threshold = 160;
      const isWidthDiff = window.outerWidth - window.innerWidth > threshold;
      const isHeightDiff = window.outerHeight - window.innerHeight > threshold;
      
      if (isWidthDiff || isHeightDiff) {
        setIsDevToolsDetected(true);
        return;
      }

      const start = performance.now();
      debugger;
      const end = performance.now();
      if (end - start > 100) {
        setIsDevToolsDetected(true);
      }
    };

    const interval = setInterval(checkDevTools, 1000);

    return () => {
      window.removeEventListener('keydown', handleKeyDownDevTools);
      clearInterval(interval);
    };
  }, [isMounted, settings]);

  // GLOBAL HEAD AD SCRIPTS INJECTOR HOOK
  useEffect(() => {
    if (!isMounted || !settings || !settings.globalHeadScripts) return;

    // Clean up old scripts
    const exist = document.querySelectorAll('.dynamic-global-head-script');
    exist.forEach(el => el.remove());

    // Create temporary div to parse tags
    const temp = document.createElement('div');
    temp.innerHTML = settings.globalHeadScripts;

    // Inject non-script tags
    const others = temp.querySelectorAll('link, style, meta, font');
    others.forEach(oth => {
      const cloned = oth.cloneNode(true);
      cloned.className = 'dynamic-global-head-script';
      document.head.appendChild(cloned);
    });

    // Inject script tags
    const scripts = temp.querySelectorAll('script');
    scripts.forEach(scr => {
      const newScript = document.createElement('script');
      newScript.className = 'dynamic-global-head-script';
      Array.from(scr.attributes).forEach(attr => {
        newScript.setAttribute(attr.name, attr.value);
      });
      newScript.innerHTML = scr.innerHTML;
      document.head.appendChild(newScript);
    });
  }, [isMounted, settings]);

  // Profile Form Upload
  const [avatarPreview, setAvatarPreview] = useState(null)
  const [uploadProgress, setUploadProgress] = useState(null)
  const fileInputRef = useRef(null)
  const overlayTimeoutRef = useRef(null)

  // Create Playlist Form state in Profile page
  const [newPlaylistTitle, setNewPlaylistTitle] = useState('')
  const [playlistSearchQuery, setPlaylistSearchQuery] = useState('')

  // Reset Scroll ke Atas saat membuka video atau ganti tab
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [activeVideo, activeTab])

  const safeFetchJson = async (url, options = {}) => {
    try {
      const response = await fetch(url, options)
      if (response.ok) {
        return await response.json()
      }
      return null
    } catch (err) {
      console.warn(`[SafeFetch] network error for ${url}:`, err)
      return null
    }
  }

  const fetchPlaylists = useCallback(async () => {
    try {
      const userId = currentUser ? currentUser.id : ''
      const plList = await safeFetchJson(`/api/playlists?userId=${userId}`)
      setPlaylists(Array.isArray(plList) ? plList : [])
    } catch (err) {
      console.warn('Failed to load playlists:', err)
    }
  }, [currentUser])

  const fetchCoreData = useCallback(async () => {
    try {
      const isStaff = currentUser && (currentUser.role === 'admin' || currentUser.role === 'moderator')
      
      const [vidsRes, catsRes, promoRes, setsRes, pagesRes, pollsRes] = await Promise.all([
        fetch(`/api/videos${isStaff ? '?showAll=true' : ''}`).catch(() => null),
        fetch('/api/categories').catch(() => null),
        fetch('/api/promo').catch(() => null),
        fetch('/api/settings').catch(() => null),
        fetch('/api/pages').catch(() => null),
        fetch('/api/polling').catch(() => null)
      ]);

      if (vidsRes && vidsRes.ok) {
        const vids = await vidsRes.json().catch(() => []);
        if (Array.isArray(vids)) setVideos(vids);
      }

      if (catsRes && catsRes.ok) {
        const cats = await catsRes.json().catch(() => []);
        if (Array.isArray(cats)) setCategories(cats);
      }

      if (promoRes && promoRes.ok) {
        const promo = await promoRes.json().catch(() => []);
        if (Array.isArray(promo)) setAds(promo);
      }

      if (setsRes && setsRes.ok) {
        const sets = await setsRes.json().catch(() => null);
        if (sets && typeof sets === 'object') {
          setSettings(sets);
          setIsSettingsLoaded(true);
        }
      }

      if (pagesRes && pagesRes.ok) {
        const pages = await pagesRes.json().catch(() => []);
        if (Array.isArray(pages)) setStaticPages(pages);
      }

      if (pollsRes && pollsRes.ok) {
        const polls = await pollsRes.json().catch(() => []);
        if (Array.isArray(polls)) setPollingList(polls);
      }

      fetchPlaylists()
    } catch (err) {
      console.warn('Failed to load initial data:', err)
    }
  }, [currentUser, fetchPlaylists])

  // Load Initial Configuration and data
  useEffect(() => {
    setIsMounted(true)
    // Sync with localStorage on client
    const savedTheme = localStorage.getItem('shindora-theme') || localStorage.getItem('theme') || 'light'
    setTheme(savedTheme)
    document.documentElement.classList.toggle('dark', savedTheme === 'dark')

    if (initialTVMode) {
      setIsTVMode(true)
      setTVModeActive(true)
    } else if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      if (p.get('mode') === 'tv' || p.get('tv') === 'true' || window.location.pathname === '/tv') {
        setIsTVMode(true)
        setTVModeActive(true)
      } else {
        const tvActive = getIsTVModeActive()
        setIsTVMode(tvActive)
      }
    }

    const storedUser = localStorage.getItem('shindora-user')
    if (storedUser) {
      setCurrentUser(JSON.parse(storedUser))
    }

    const savedLiked = localStorage.getItem('shindora-liked')
    if (savedLiked) setLikedVideos(JSON.parse(savedLiked))

    const savedLater = localStorage.getItem('shindora-later')
    if (savedLater) setWatchLater(JSON.parse(savedLater))

    const initialVoted = {}
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith('shindora-voted-')) {
        const pollId = key.substring('shindora-voted-'.length)
        initialVoted[pollId] = localStorage.getItem(key)
      }
    }
    setVotedPollOptions(initialVoted)

    fetchCoreData()
  }, [])

  const getSortedCategoryEpisodes = (categoryName) => {
    if (!categoryName || !videos) return []
    return videos
      .filter(v => v.animeTitle === categoryName)
      .sort((a, b) => {
        const numA = parseEpisodeNumber(a.episode)
        const numB = parseEpisodeNumber(b.episode)
        return numA - numB
      })
  }

  const getPrevEpisode = useCallback(() => {
    if (!activeVideo || !videos || videos.length === 0) return null
    const sorted = getSortedCategoryEpisodes(activeVideo.animeTitle)
    const currentIndex = sorted.findIndex(v => v.id === activeVideo.id)
    if (currentIndex > 0) {
      return sorted[currentIndex - 1]
    }
    return null
  }, [activeVideo, videos])

  const getNextEpisode = useCallback(() => {
    if (!activeVideo || !videos || videos.length === 0) return null
    const sorted = getSortedCategoryEpisodes(activeVideo.animeTitle)
    const currentIndex = sorted.findIndex(v => v.id === activeVideo.id)
    if (currentIndex >= 0 && currentIndex < sorted.length - 1) {
      return sorted[currentIndex + 1]
    }
    return null
  }, [activeVideo, videos])

  const getActivePlayerSource = useCallback((video, serverNum) => {
    if (!video) return { type: 'embed', url: '' };
    let rawUrl = '';
    if (serverNum === 1) rawUrl = video.videoUrl;
    else if (serverNum === 2) rawUrl = video.videoUrl2;
    else if (serverNum === 3) rawUrl = video.videoUrl3;

    if (!rawUrl) return { type: 'embed', url: '' };

    const formatted = formatEmbedUrl(rawUrl);
    
    if (formatted.type === 'embed' && formatted.url) {
      if (!formatted.url.includes('autoplay=')) {
        formatted.url = `${formatted.url}${formatted.url.includes('?') ? '&' : '?'}autoplay=1&mute=0`;
      }
    }
    return formatted;
  }, []);

  const getEmbedUrl = (video) => {
    const src = getActivePlayerSource(video, activeServer);
    return src.url;
  };

  const getActiveServerUrl = (video) => {
    const src = getActivePlayerSource(video, activeServer);
    return src.url;
  };

  const handleCastVote = async (pollId, optionId) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(`shindora-voted-${pollId}`, optionId)
    }
    setVotedPollOptions(prev => ({ ...prev, [pollId]: optionId }))
    try {
      const res = await fetch('/api/polling/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          pollId, 
          optionId,
          userId: currentUser ? currentUser.id : null
        })
      })
      if (res.ok) {
        fetchCoreData()
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleCreateUserPoll = async (e) => {
    e.preventDefault()
    if (!currentUser) return
    if (!userPollForm.title.trim()) return

    const hasActivePoll = pollingList.some(p => p.ownerId === currentUser.id && p.isActive)
    if (hasActivePoll) {
      alert("Anda sudah memiliki 1 usulan yang sedang berjalan. Hapus atau tunggu usulan Anda selesai untuk membuat usulan baru.")
      setShowUserPollModal(false)
      return
    }

    try {
      // Buat satu opsi utama yang merepresentasikan usulan anime kustom
      const mainOptionId = `opt-main-${Date.now()}`
      const singleOption = {
        id: mainOptionId,
        name: userPollForm.title,
        releaseYear: userPollForm.releaseYear,
        mediaType: userPollForm.mediaType,
        referenceLink: userPollForm.referenceLink,
        reason: userPollForm.reason,
        imageUrl: '',
        votes: 0
      }

      const res = await fetch('/api/polling', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: userPollForm.title,
          options: [singleOption],
          ownerId: currentUser.id,
          isActive: true
        })
      })
      if (res.ok) {
        alert('Usulan anime Anda berhasil dibuat dan diterbitkan!')
        setUserPollForm({
          title: '',
          releaseYear: '',
          mediaType: 'TV Series',
          referenceLink: '',
          reason: ''
        })
        setShowUserPollModal(false)
        fetchCoreData()
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleDeleteUserPoll = async (pollId) => {
    if (!confirm('Hapus vote kustom Anda? Tindakan ini akan mereset kuota pembuatan vote Anda.')) return
    try {
      const res = await fetch(`/api/polling?id=${pollId}`, { method: 'DELETE' })
      if (res.ok) {
        fetchCoreData()
      }
    } catch (err) {
      console.error(err)
    }
  }

  // Update URL parameters dynamically on tab or activeVideo change
  useEffect(() => {
    if (isMounted && typeof window !== 'undefined') {
      if (activeTab === 'watch') {
        if (activeVideo && activeVideo.slug) {
          window.history.replaceState(null, '', `/watch/${activeVideo.slug}`)
        }
      } else if (activeTab && activeTab !== 'home') {
        const params = new URLSearchParams()
        params.set('tab', activeTab)
        window.history.replaceState(null, '', `?${params.toString()}`)
      } else if (activeTab === 'home' && !window.location.pathname.startsWith('/watch/')) {
        window.history.replaceState(null, '', '/')
      }
    }
  }, [isMounted, activeTab, activeVideo])

  // Re-fetch data on activeTab changes to keep the video catalogs updated in real-time
  useEffect(() => {
    fetchCoreData()
  }, [activeTab])

  const getNextEpisodeRef = () => {
    if (!activeVideoRef.current || !videosRef.current || videosRef.current.length === 0) return null;
    const sorted = videosRef.current
      .filter(v => v.animeTitle === activeVideoRef.current.animeTitle)
      .sort((a, b) => {
        const numA = parseEpisodeNumber(a.episode);
        const numB = parseEpisodeNumber(b.episode);
        return numB - numA;
      });
    const currentIndex = sorted.findIndex(v => v.id === activeVideoRef.current.id);
    if (currentIndex >= 0 && currentIndex < sorted.length - 1) {
      return sorted[currentIndex + 1];
    }
    return null;
  };

  const playNextPlaylistItemRef = () => {
    if (!currentPlaylistRef.current || !activeVideoRef.current) return;
    
    const playlistVids = sortVideosByEpisodeAscending(
      currentPlaylistRef.current.videoIds
        .map(vidId => videosRef.current.find(v => v.id === vidId))
        .filter(Boolean)
    );

    if (playlistVids.length === 0) return;

    const currentIndex = playlistVids.findIndex(v => v.id === activeVideoRef.current.id);
    const nextIndex = currentIndex + 1;

    if (nextIndex < playlistVids.length) {
      const nextVid = playlistVids[nextIndex];
      if (nextVid) {
        setActiveVideo(nextVid);
        setActiveServer(1);
      }
    } else {
      alert(`Playlist Maraton "${currentPlaylistRef.current.title}" selesai!`);
      setCurrentPlaylist(null);
    }
  };

  // Uniform callback when any video is finished (either from HTML5, postMessage, or Fallback Smart Timer)
  const onVideoFinished = useCallback(() => {
    if (isTriggeringNextEpisode) return; // avoid duplicate triggers
    
    let nextVid = null;
    if (isAutoplayPlaylistRef.current && currentPlaylistRef.current) {
      const playlistVids = sortVideosByEpisodeAscending(
        currentPlaylistRef.current.videoIds
          .map(vidId => videosRef.current.find(v => v.id === vidId))
          .filter(Boolean)
      );
      if (playlistVids.length > 0) {
        const currentIndex = playlistVids.findIndex(v => v.id === activeVideoRef.current?.id);
        const nextIndex = currentIndex + 1;
        if (nextIndex < playlistVids.length) {
          nextVid = playlistVids[nextIndex];
        }
      }
    } else {
      nextVid = getNextEpisodeRef();
    }

    if (nextVid) {
      setNextEpisodeTarget(nextVid);
      setNextEpisodeCountdown(5); // 5 seconds countdown
      setIsTriggeringNextEpisode(true);
    } else {
      console.log('No next episode found or playlist completed.');
    }
  }, [isTriggeringNextEpisode]);

  // Autoplay Countdown tick
  useEffect(() => {
    if (!isTriggeringNextEpisode || nextEpisodeCountdown <= 0) {
      if (isTriggeringNextEpisode && nextEpisodeCountdown === 0) {
        // Execute transition!
        if (nextEpisodeTarget) {
          if (isAutoplayPlaylist && currentPlaylist) {
            playNextPlaylistItem();
          } else {
            setActiveVideo(nextEpisodeTarget);
            setActiveServer(1);
          }
        }
        setIsTriggeringNextEpisode(false);
        setNextEpisodeTarget(null);
      }
      return;
    }

    const timer = setTimeout(() => {
      setNextEpisodeCountdown(prev => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [isTriggeringNextEpisode, nextEpisodeCountdown, nextEpisodeTarget, isAutoplayPlaylist, currentPlaylist]);

  // Fallback Smart Timer (Estimasi Durasi Video & Autoplay Timer Controller)
  const [playbackTimeElapsed, setPlaybackTimeElapsed] = useState(0);

  useEffect(() => {
    setPlaybackTimeElapsed(0);

    // Smart TV mempunyai player, autoplay, dan end-handler sendiri.
    // Jangan jalankan fallback timer page.js ketika TV Mode aktif.
    if (isTVMode) return;
    if (!activeVideo) return;

    const isAutoplayOn = isAutoplayPlaylist;
    const videoDuration = activeVideo.duration;

    // 1. Baca data videoDuration (atau use estimate if empty/missing)
    const totalDurationSeconds = videoDuration ? parseToSeconds(videoDuration) : estimateVideoDuration(activeVideo);
    
    if (totalDurationSeconds <= 0) return;

    // 2. Jika status Autoplay ON (isAutoplayOn === true) DAN data videoDuration tersedia (atau estimated)
    // LANGSUNG jalankan setInterval hitung mundur detik sejak halaman/video dimuat.
    const interval = setInterval(() => {
      setPlaybackTimeElapsed(prev => {
        const nextTime = prev + 1;
        
        if (isAutoplayOn) {
          // 3. Ketika waktu pemutaran menyisa 3 detik sebelum durasi habis, eksekusi pemindahan halaman secara langsung
          if (nextTime >= totalDurationSeconds - 3) {
            clearInterval(interval);
            
            // Find next episode target and its slug
            let nextVid = null;
            if (currentPlaylist) {
              const playlistVids = sortVideosByEpisodeAscending(
                currentPlaylist.videoIds
                  .map(vidId => videos.find(v => v.id === vidId))
                  .filter(Boolean)
              );
              if (playlistVids.length > 0) {
                const currentIndex = playlistVids.findIndex(v => v.id === activeVideo.id);
                const nextIndex = currentIndex + 1;
                if (nextIndex < playlistVids.length) {
                  nextVid = playlistVids[nextIndex];
                }
              }
            } else {
              nextVid = getNextEpisode();
            }

            if (nextVid && nextVid.slug) {
              console.log('[Autoplay Timer] 3 seconds remaining. Auto redirecting directly to:', nextVid.slug);
              window.location.href = `/watch/${nextVid.slug}`;
            } else {
              console.log('[Autoplay Timer] No next video found.');
            }
            return totalDurationSeconds;
          }
        } else {
          // Autoplay is OFF - normal end detection
          if (nextTime >= totalDurationSeconds) {
            clearInterval(interval);
            console.log('[Smart Timer] Video duration finished.');
            return totalDurationSeconds;
          }
        }
        
        return nextTime;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [activeVideo, activeServer, isAutoplayPlaylist, currentPlaylist, videos, getNextEpisode, isTVMode]);

  const getNextEpisodeSlug = () => {
    let nextVid = null;
    if (isAutoplayPlaylist && currentPlaylist) {
      const playlistVids = sortVideosByEpisodeAscending(
        currentPlaylist.videoIds
          .map(vidId => videos.find(v => v.id === vidId))
          .filter(Boolean)
      );
      if (playlistVids.length > 0) {
        const currentIndex = playlistVids.findIndex(v => v.id === activeVideo?.id);
        const nextIndex = currentIndex + 1;
        if (nextIndex < playlistVids.length) {
          nextVid = playlistVids[nextIndex];
        }
      }
    } else {
      nextVid = getNextEpisode();
    }
    return nextVid ? nextVid.slug : '';
  };

  const nextEpisodeSlug = getNextEpisodeSlug();
  const isAutoplayOn = isAutoplayPlaylist;

  // VK.com / VKVideo.ru Specific Message Listener
  useEffect(() => {
    const handleVkMessage = (event) => {
      if (!event.origin.includes('vk.com') && !event.origin.includes('vkvideo.ru')) return;
      
      try {
        let data = event.data;
        if (typeof data === 'string') {
          try { data = JSON.parse(data); } catch (e) {}
        }
        
        // Tangkap berbagai jenis event selesai dari VK Player API
        const isEnded = 
          data?.event === 'onVideoEnded' || 
          data?.event === 'ended' || 
          data?.type === 'ended' ||
          (Array.isArray(data) && (data[0] === 'onVideoEnded' || data[0] === 'ended')) ||
          (typeof data === 'string' && data.includes('ended'));
        if (isEnded) {
          const autoplayStatus = localStorage.getItem('autoplay_marathon') === 'true' || isAutoplayOn;
          if (autoplayStatus && nextEpisodeSlug) {
            console.log('[PostMessage VK API] Video ended. Navigating directly to:', nextEpisodeSlug);
            window.location.href = `/watch/${nextEpisodeSlug}`;
          }
        }
      } catch (err) {
        console.error('VK message parse error:', err);
      }
    };
    window.addEventListener('message', handleVkMessage);
    return () => window.removeEventListener('message', handleVkMessage);
  }, [nextEpisodeSlug, isAutoplayOn]);

  // OK.ru, VK.com, and other providers PostMessage event listener
  useEffect(() => {
    const handleMessage = (event) => {
      let data = event.data;
      if (typeof data === 'string') {
        try {
          data = JSON.parse(data);
        } catch (e) {
          // ignore
        }
      }

      // 1. VK.com origin checks
      const isVKOrigin = event.origin && (event.origin.includes('vk.com') || event.origin.includes('vkvideo.ru'));
      const isVKVideoEnded = isVKOrigin && (
        data?.event === 'onVideoEnded' || 
        data?.event === 'ended' || 
        data?.type === 'ended' || 
        (Array.isArray(data) && data[0] === 'onVideoEnded')
      );

      if (isVKVideoEnded) {
        // Smart TV menangani perpindahan videonya sendiri.
        // Jangan jalankan autoplay desktop/mobile dari page.js saat TV Mode aktif.
        if (isTVMode) return;

        let nextVid = null;
        if (isAutoplayPlaylistRef.current && currentPlaylistRef.current) {
          const playlistVids = sortVideosByEpisodeAscending(
            currentPlaylistRef.current.videoIds
              .map(vidId => videosRef.current.find(v => v.id === vidId))
              .filter(Boolean)
          );
          if (playlistVids.length > 0) {
            const currentIndex = playlistVids.findIndex(v => v.id === activeVideoRef.current?.id);
            const nextIndex = currentIndex + 1;
            if (nextIndex < playlistVids.length) {
              nextVid = playlistVids[nextIndex];
            }
          }
        } else {
          nextVid = getNextEpisodeRef();
        }

        if (nextVid && nextVid.slug) {
          console.log('[PostMessage] VK video finished. Auto navigating to:', nextVid.slug);
          window.location.href = `/watch/${nextVid.slug}`;
          return;
        }
      }

      // 2. Standard video ended checks
      const isVideoEnded = 
        // String messages
        event.data === 'SHINDORA_AUTOPLAY' || 
        event.data === 'complete' || 
        event.data === 'ended' || 
        event.data === 'finish' ||
        event.data === 'video_ended' ||
        event.data === 'sibnet_video_ended' ||
        event.data === 'api.video.ended' ||
        event.data === 'SHINDORA_VIDEO_ENDED' ||
        // Object / JSON events
        data?.event === 'complete' || 
        data?.event === 'ended' || 
        data?.event === 'finish' ||
        data?.event === 'video_ended' ||
        data?.event === 'api.video.ended' ||
        data?.event === 'SHINDORA_VIDEO_ENDED' ||
        data?.type === 'api.video.ended' ||
        data?.type === 'video_ended' ||
        data?.method === 'api.video.ended' ||
        data?.message === 'ended' ||
        data?.message === 'complete' ||
        data?.message === 'finish';

      if (isVideoEnded || isVKVideoEnded) {
        // Smart TV ditangani oleh SmartTVInterface.
        // Desktop/mobile tetap memakai onVideoFinished() seperti sebelumnya.
        if (isTVMode) {
          console.log('[PostMessage] Smart TV video ended. Handled by SmartTVInterface.');
          return;
        }

        console.log('[PostMessage] Video ended event received. Triggering dynamic countdown...');
        onVideoFinished();
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onVideoFinished]);

  // AUTOMATIC VIEWS INCREMENT HOOK
  useEffect(() => {
    if (activeVideo && activeVideo.id) {
      const incrementViews = async () => {
        try {
          const res = await fetch('/api/videos/increment-views', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: activeVideo.id })
          });
          if (res.ok) {
            const updatedVid = await res.json();
            setVideos(prev => prev.map(v => v.id === updatedVid.id ? { ...v, views: updatedVid.views } : v));
            setActiveVideo(prev => prev && prev.id === updatedVid.id ? { ...prev, views: updatedVid.views } : prev);
          }
        } catch (err) {
          console.error('[Views Increment] Error:', err);
        }
      };
      // Delay slightly to simulate watch start or debounce instant clicking
      const t = setTimeout(incrementViews, 1000);
      return () => clearTimeout(t);
    }
  }, [activeVideo?.id]);

  // Poll Donation logs every 7 seconds for real-time overlay notifications
  useEffect(() => {
    const isOverlayActive = settings?.is_overlay_active !== undefined 
      ? settings.is_overlay_active === true 
      : settings?.donationOverlayActive !== false

    if (!isOverlayActive) return

    const pollDonations = async () => {
      try {
        const latestDons = await safeFetchJson('/api/webhooks/poll')
        if (Array.isArray(latestDons) && latestDons.length > 0) {
          const newest = latestDons[0]
          
          if (!lastSeenDonationId) {
            setLastSeenDonationId(newest.id)
            return
          }

          if (newest.id !== lastSeenDonationId) {
            setLastSeenDonationId(newest.id)
            setActiveOverlayDonation(newest)

            const popupDuration = (settings?.donationPopupDuration || 6) * 1000
            if (overlayTimeoutRef.current) {
              clearTimeout(overlayTimeoutRef.current)
            }
            overlayTimeoutRef.current = setTimeout(() => {
              setActiveOverlayDonation(null)
            }, popupDuration)
          }
        }
      } catch (err) {
        console.error('Donation polling error:', err)
      }
    }

    const interval = setInterval(pollDonations, 7000)
    return () => {
      clearInterval(interval)
      if (overlayTimeoutRef.current) {
        clearTimeout(overlayTimeoutRef.current)
      }
    }
  }, [settings, lastSeenDonationId])

  // Rotate Manual Donation popup overlay persistently if active
  useEffect(() => {
    const isOverlayActive = settings?.is_overlay_active !== undefined 
      ? settings.is_overlay_active === true 
      : settings?.donationOverlayActive !== false

    if (isMounted && settings?.isManualDonationActive && isOverlayActive) {
      const list = settings?.manualDonationList;
      
      // Fallback to single legacy manual donation if list is empty
      if (!Array.isArray(list) || list.length === 0) {
        if (settings?.manualDonatorName) {
          const simDonation = {
            id: 'manual-sim-donation',
            donatorName: settings.manualDonatorName,
            amount: settings.manualDonationAmount || 'Rp 0',
            message: settings.manualDonationMessage,
            platform: settings.manualDonationPlatform || 'Manual'
          };
          setActiveOverlayDonation(simDonation);
          const duration = (settings?.manualDonationDuration || settings?.donationPopupDuration || 6) * 1000;
          const t = setTimeout(() => {
            setActiveOverlayDonation(null);
          }, duration);
          return () => clearTimeout(t);
        }
        return;
      }

      // Loop through multi-item list sequentially
      const popupDuration = (settings?.manualDonationDuration || settings?.donationPopupDuration || 6) * 1000;
      const currentItem = list[manualDonationIndex % list.length];
      
      const simDonation = {
        id: currentItem.id,
        donatorName: currentItem.name,
        amount: currentItem.amount,
        message: currentItem.message,
        platform: currentItem.platform || 'Manual'
      };

      // Show current donation
      setActiveOverlayDonation(simDonation);

      // Hide after popupDuration
      const tHide = setTimeout(() => {
        setActiveOverlayDonation(null);
      }, popupDuration);

      // Move to next item after popupDuration + 2000ms transition time
      const tNext = setTimeout(() => {
        setManualDonationIndex((prev) => prev + 1);
      }, popupDuration + 2000);

      return () => {
        clearTimeout(tHide);
        clearTimeout(tNext);
      };
    }
  }, [isMounted, settings, manualDonationIndex])


  const fetchUserNotifications = useCallback(async () => {
    if (!currentUser) return
    try {
      const res = await fetch(`/api/notifications?userId=${currentUser.id}`)
      if (res.ok) {
        const list = await res.json()
        setUserNotifications(Array.isArray(list) ? list : [])
      }
    } catch (err) {
      console.error('Failed to load notifications:', err)
    }
  }, [currentUser])

  const handleMarkAllNotificationsRead = async () => {
    if (!currentUser) return
    try {
      const res = await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, markAll: true })
      })
      if (res.ok) {
        fetchUserNotifications()
        toast.success('Semua notifikasi ditandai sebagai dibaca', { icon: '🔔' })
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleMarkNotificationRead = async (notif) => {
    try {
      await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: notif.id })
      })
      fetchUserNotifications()
      
      // Auto redirect user to watch page with target video
      const matchingVideo = videos.find(v => v.id === notif.videoId)
      if (matchingVideo) {
        navigateToTab('watch', matchingVideo)
        setShowNotificationsDropdown(false)
        setShowComments(true) // Expand accordion to see the reply
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleClearAllNotifications = async () => {
    if (!currentUser) return
    if (!confirm('Hapus seluruh riwayat notifikasi Anda?')) return
    try {
      const res = await fetch(`/api/notifications?userId=${currentUser.id}`, { method: 'DELETE' })
      if (res.ok) {
        fetchUserNotifications()
        toast.success('Riwayat notifikasi berhasil dihapus')
      }
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    if (currentUser) {
      fetchPlaylists()
      fetchUserNotifications()
      
      const interval = setInterval(fetchUserNotifications, 12000)
      return () => clearInterval(interval)
    } else {
      // Just keep public playlists
      setPlaylists(prev => prev.filter(p => p.ownerId === null))
      setUserNotifications([])
    }
  }, [currentUser])

  // Load comments for active video
  useEffect(() => {
    if (activeVideo) {
      fetchComments(activeVideo.id)
    }
  }, [activeVideo])

  const fetchComments = useCallback(async (videoId) => {
    try {
      const data = await safeFetchJson(`/api/comments?videoId=${videoId}`)
      setComments(Array.isArray(data) ? data : [])
    } catch (err) {
      console.warn('Failed to fetch comments:', err)
    }
  }, [])

  const handleToggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(nextTheme)
    localStorage.setItem('shindora-theme', nextTheme)
    localStorage.setItem('theme', nextTheme)
    document.documentElement.classList.toggle('dark', nextTheme === 'dark')
  }

  const handleLogout = () => {
    localStorage.removeItem('shindora-user')
    setCurrentUser(null)
    navigateToTab('home')
    if (typeof window !== 'undefined') {
      window.location.href = '/login'
    }
  }

  // Like video handler
  const handleLikeVideo = async (video) => {
    const isLiked = likedVideoIds.includes(video.id)
    const action = isLiked ? 'unlike' : 'like'
    
    // Snappy optimistic local state toggle
    const updated = isLiked 
      ? likedVideoIds.filter(id => id !== video.id) 
      : [...likedVideoIds, video.id]
      
    setLikedVideos(updated)
    localStorage.setItem('shindora-liked', JSON.stringify(updated))

    try {
      const res = await fetch('/api/videos/toggle-like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: video.id, action })
      })
      if (res.ok) {
        const updatedVid = await res.json()
        setVideos(prev => prev.map(v => v.id === updatedVid.id ? { ...v, likes: updatedVid.likes } : v))
        setActiveVideo(prev => prev && prev.id === updatedVid.id ? { ...prev, likes: updatedVid.likes } : prev)
      }
    } catch (err) {
      console.error('[Like Toggle Error]:', err)
    }
  }

  // Watch Later handler
  const handleWatchLater = (video) => {
    let updated = []
    const isAdded = !watchLaterIds.includes(video.id)
    if (!isAdded) {
      updated = watchLaterIds.filter(id => id !== video.id)
      toast.success(`Removed "${video.title}" from Watch Later`, {
        icon: '🗑️'
      })
    } else {
      updated = [...watchLaterIds, video.id]
      toast.success(`Added "${video.title}" to Watch Later`, {
        icon: '🕒'
      })
    }
    setWatchLater(updated)
    localStorage.setItem('shindora-later', JSON.stringify(updated))
  }

  // Create user playlist
  const handleCreatePlaylist = async (e) => {
    e.preventDefault()
    if (!newPlaylistTitle.trim() || !currentUser) return

    try {
      const res = await fetch('/api/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newPlaylistTitle,
          ownerId: currentUser.id,
          isPrivate: true,
          videoIds: []
        })
      })
      if (res.ok) {
        setNewPlaylistTitle('')
        fetchPlaylists()
      }
    } catch (err) {
      console.error('Error creating playlist:', err)
    }
  }

  // Add video to playlist
  const handleAddVideoToPlaylist = async (playlistId, videoId) => {
    const playlist = playlists.find(p => p.id === playlistId)
    if (!playlist) return

    const isAlreadyAdded = playlist.videoIds.includes(videoId)
    if (isAlreadyAdded) {
      toast.error(`Video is already in playlist "${playlist.title}"`)
      return
    }

    const updatedVideoIds = [...playlist.videoIds, videoId]

    try {
      const res = await fetch('/api/playlists', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: playlistId,
          videoIds: updatedVideoIds
        })
      })
      if (res.ok) {
        fetchPlaylists()
        toast.success(`Successfully added to playlist "${playlist.title}"`, {
          icon: '📂'
        })
      }
    } catch (err) {
      console.error('Error adding to playlist:', err)
      toast.error('Failed to update playlist')
    }
  }

  // Remove video from playlist
  const handleRemoveVideoFromPlaylist = async (playlistId, videoId) => {
    const playlist = playlists.find(p => p.id === playlistId)
    if (!playlist) return

    const updatedVideoIds = playlist.videoIds.filter(id => id !== videoId)

    try {
      const res = await fetch('/api/playlists', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: playlistId,
          videoIds: updatedVideoIds
        })
      })
      if (res.ok) {
        fetchPlaylists()
        toast.success(`Successfully removed from playlist "${playlist.title}"`, {
          icon: '🗑️'
        })
      }
    } catch (err) {
      console.error('Error removing from playlist:', err)
      toast.error('Failed to update playlist')
    }
  }

  const handleDeletePlaylist = async (id) => {
    if (!confirm('Hapus playlist ini?')) return
    try {
      const res = await fetch(`/api/playlists?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        fetchPlaylists()
      }
    } catch (err) {
      console.error(err)
    }
  }

  // Handle Comment Submission
  const handlePostComment = async (e, parentId = null) => {
    e.preventDefault()
    if (!currentUser) {
      alert('Silakan login terlebih dahulu untuk berkomentar!')
      return
    }

    const text = parentId ? replyText : newCommentText
    if (!text.trim()) return

    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId: activeVideo.id,
          userId: currentUser.id || currentUser._id || currentUser.email,
          userEmail: currentUser.email,
          userRole: currentUser.role || 'user',
          userName: currentUser.name,
          userAvatar: currentUser.avatarUrl,
          content: text,
          parentId
        })
      })

      if (res.ok) {
        if (parentId) {
          setReplyText('')
          setActiveReplyToId(null)
        } else {
          setNewCommentText('')
        }
        fetchComments(activeVideo.id)
      }
    } catch (err) {
      console.error('Error posting comment:', err)
    }
  }

  // Handle Comment Deletion (Staff or direct owner)
  const handleDeleteComment = async (commentId) => {
    if (!confirm('Hapus komentar ini beserta seluruh balasannya?')) return

    try {
      const res = await fetch(`/api/comments?id=${commentId}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        fetchComments(activeVideo.id)
      }
    } catch (err) {
      console.error('Error deleting comment:', err)
    }
  }

  // Avatar Upload (Max 1MB, JPG/PNG/WEBP validation)
  const handleAvatarChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    // Validasi format
    const validFormats = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!validFormats.includes(file.type)) {
      alert('Format berkas tidak valid! Hanya mendukung JPG, PNG, atau WEBP.')
      return
    }

    // Validasi ukuran < 1MB (1024 * 1024 bytes)
    const maxSize = 1 * 1024 * 1024
    if (file.size > maxSize) {
      alert('Gagal! Batas ukuran foto profil maksimal adalah 1 MB (1024 KB).')
      return
    }

    setUploadProgress(10)
    try {
      // 1. Ambil token autentikasi ImageKit dari backend
      const authRes = await fetch('/api/imagekit/auth')
      if (!authRes.ok) {
        const errData = await authRes.json()
        throw new Error(errData.error || 'Gagal mengautentikasi ImageKit di backend')
      }
      const authData = await authRes.json()
      setUploadProgress(40)

      // 2. Siapkan FormData untuk diunggah ke ImageKit CDN
      const formData = new FormData()
      formData.append('file', file)
      formData.append('fileName', `avatar_${currentUser.id}_${Date.now()}_${file.name}`)
      formData.append('publicKey', authData.publicKey)
      formData.append('signature', authData.signature)
      formData.append('expire', authData.expire.toString())
      formData.append('token', authData.token)

      setUploadProgress(60)

      // 3. Unggah berkas langsung ke ImageKit CDN API
      const ikRes = await fetch('https://upload.imagekit.io/api/v1/files/upload', {
        method: 'POST',
        body: formData
      })

      if (!ikRes.ok) {
        const ikErr = await ikRes.json()
        throw new Error(ikErr.message || 'ImageKit CDN menolak unggahan berkas')
      }

      setUploadProgress(80)
      const ikData = await ikRes.json()
      const ikAvatarUrl = ikData.url

      setAvatarPreview(ikAvatarUrl)

      // 4. Update data avatar ke database MongoDB via API
      const res = await fetch('/api/auth/update-avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          avatarUrl: ikAvatarUrl
        })
      })
      const updatedUser = await res.json()
      
      setUploadProgress(100)

      if (res.ok && updatedUser && !updatedUser.error) {
        setCurrentUser(updatedUser)
        localStorage.setItem('shindora-user', JSON.stringify(updatedUser))
        alert('Foto profil berhasil diperbarui!')
      } else {
        alert('Gagal memperbarui foto profil ke database: ' + (updatedUser.error || 'Server error'))
      }
    } catch (err) {
      console.error('[ImageKit Avatar Upload Error]:', err)
      alert(`Gagal Mengunggah ke ImageKit: ${err.message}. Menggunakan simulasi lokal...`)
      
      // Fallback ke simulasi base64 lokal jika kredensial ImageKit belum diset di settings
      const reader = new FileReader()
      reader.onloadend = async () => {
        const base64Data = reader.result
        setAvatarPreview(base64Data)

        try {
          const res = await fetch('/api/auth/update-avatar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: currentUser.id,
              avatarUrl: base64Data
            })
          })
          const updatedUser = await res.json()
          if (res.ok && updatedUser && !updatedUser.error) {
            setCurrentUser(updatedUser)
            localStorage.setItem('shindora-user', JSON.stringify(updatedUser))
            alert('Foto profil diperbarui menggunakan simulasi lokal!')
          } else {
            alert('Gagal memperbarui foto profil: ' + (updatedUser.error || 'Server error'))
          }
        } catch (dbErr) {
          console.error('Error saving simulated avatar:', dbErr)
        }
      }
      reader.readAsDataURL(file)
    } finally {
      setTimeout(() => setUploadProgress(null), 1000)
    }
  }

  // Playlist Navigation Player
  const startPlaylistPlayback = (playlist) => {
    if (!playlist || playlist.videoIds.length === 0) return
    setCurrentPlaylist(playlist)
    
    if (activeVideo && playlist.videoIds.includes(activeVideo.id)) {
      navigateToTab('watch', activeVideo)
    } else {
      const firstVid = videos.find(v => v.id === playlist.videoIds[0])
      if (firstVid) {
        navigateToTab('watch', firstVid)
      }
    }
  }

  const playNextPlaylistItem = () => {
    if (!currentPlaylist || !activeVideo) return
    
    const playlistVids = sortVideosByEpisodeAscending(
      currentPlaylist.videoIds
        .map(vidId => videos.find(v => v.id === vidId))
        .filter(Boolean)
    )

    if (playlistVids.length === 0) return

    const currentIndex = playlistVids.findIndex(v => v.id === activeVideo.id)
    const nextIndex = currentIndex + 1

    if (nextIndex < playlistVids.length) {
      const nextVid = playlistVids[nextIndex]
      if (nextVid) {
        navigateToTab('watch', nextVid)
        setActiveServer(1)
      }
    } else {
      alert(`Playlist Maraton "${currentPlaylist.title}" selesai!`)
      setCurrentPlaylist(null)
    }
  }

  // Video Finished simulation trigger
  const simulateVideoEnded = () => {
    if (isAutoplayPlaylist && currentPlaylist) {
      playNextPlaylistItem()
    } else {
      alert('Video selesai diputar.')
    }
  }

  // Filtered Video Catalog
  const filteredVideos = videos.filter(video => {
    if (!video) return false;
    const cleanSearch = (searchQuery || '').trim().toLowerCase();
    
    let matchesSearch = true;
    if (cleanSearch) {
      const searchNumMatch = cleanSearch.match(/\d+/);
      const searchNum = searchNumMatch ? parseInt(searchNumMatch[0], 10) : null;
      
      const epNum = video.episode ? parseEpisodeNumber(video.episode) : null;
      const matchesEpisodeNum = searchNum !== null && epNum !== null && epNum === searchNum;

      const titleMatch = (video?.title || '').toLowerCase().includes(cleanSearch);
      const animeTitleMatch = (video?.animeTitle || '').toLowerCase().includes(cleanSearch);
      const subCategoryMatch = (video?.subCategory || '').toLowerCase().includes(cleanSearch);
      const subCategoryUnderscoreMatch = (video?.sub_category || '').toLowerCase().includes(cleanSearch);
      const subCategory2Match = (video?.subCategory2 || '').toLowerCase().includes(cleanSearch);
      const subCategory2UnderscoreMatch = (video?.sub_category_2 || '').toLowerCase().includes(cleanSearch);
      const episodeMatch = (video?.episode || '').toLowerCase().includes(cleanSearch);

      matchesSearch = titleMatch ||
        animeTitleMatch ||
        subCategoryMatch ||
        subCategoryUnderscoreMatch ||
        subCategory2Match ||
        subCategory2UnderscoreMatch ||
        episodeMatch ||
        matchesEpisodeNum;
    }
    
    let matchesCategory = false;
    if (!activeCategory || activeCategory === 'SEMUA' || activeCategory === 'semua') {
      matchesCategory = true;
    } else {
      const catObj = categories.find(c => 
        String(c.id || c._id) === activeCategory || 
        c.name.replace(/[^a-zA-Z0-9\s-]/g, '').trim().toUpperCase() === activeCategory.toUpperCase()
      );
      if (catObj) {
        matchesCategory = checkVideoMatchesCategory(video, catObj, categories);
      } else {
        const cleanActive = activeCategory.toUpperCase();
        matchesCategory = 
          (video.animeTitle && video.animeTitle.replace(/[^a-zA-Z0-9\s-]/g, '').trim().toUpperCase() === cleanActive) ||
          (video.subCategory && video.subCategory.replace(/[^a-zA-Z0-9\s-]/g, '').trim().toUpperCase() === cleanActive) ||
          (video.sub_category && video.sub_category.replace(/[^a-zA-Z0-9\s-]/g, '').trim().toUpperCase() === cleanActive) ||
          (video.subCategory2 && video.subCategory2.replace(/[^a-zA-Z0-9\s-]/g, '').trim().toUpperCase() === cleanActive) ||
          (video.sub_category_2 && video.sub_category_2.replace(/[^a-zA-Z0-9\s-]/g, '').trim().toUpperCase() === cleanActive);
      }
    }

    return matchesSearch && matchesCategory
  })

  // Get active ads
  const topBannerAd = ads.find(ad => ad.slot === 'banner_top' && ad.isActive)

  const renderAdSlot = (slotName) => {
    const matchingAds = ads.filter(a => a.slot === slotName && a.isActive)
    if (matchingAds.length === 0) return null
    return (
      <div className="w-full flex flex-col gap-3 my-2.5">
        {matchingAds.map((ad, idx) => (
          <AdSlotContainer key={ad.id || ad._id || `${slotName}-${idx}`} ad={ad} theme={theme} />
        ))}
      </div>
    )
  }

  if (isDevToolsDetected) {
    return (
      <div className="min-h-screen bg-[#020308] flex flex-col items-center justify-center p-6 text-center select-none dark text-[#e2e8f0]">
        <div className="p-4 rounded-full bg-red-600/10 text-red-500 animate-bounce mb-4 border border-red-500/20">
          <AlertTriangle className="w-12 h-12" />
        </div>
        <h2 className="text-2xl font-black text-red-500 uppercase tracking-widest mb-2">Akses Ditolak! DevTools Terbuka</h2>
        <p className="text-xs text-slate-400 max-w-sm leading-relaxed mb-6">
          Sistem proteksi website mendeteksi pembukaan Developer Tools. Silakan tutup jendela Developer Tools Anda untuk melanjutkan streaming di ShinDora Nesub.
        </p>
        <button
          onClick={() => {
            window.location.reload();
          }}
          className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs rounded-lg shadow-lg tracking-wider uppercase transition-all"
        >
          Muat Ulang Halaman
        </button>
      </div>
    );
  }

  if (isTVMode) {
    return (
      <SmartTVInterface
        videos={videos}
        categories={categories}
        playlists={playlists}
        settings={settings}
        onExitTVMode={() => {
          setIsTVMode(false);
          setTVModeActive(false);
        }}
        onWatchVideo={(vid) => {
          setActiveVideo(vid);
        }}
      />
    );
  }

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-[#0a0b14] text-[#e2e8f0]' : 'bg-[#f8fafc] text-[#0f172a]'}`}>
      
      {/* 00. TOP PROGRESS BAR (NextTopLoader / NProgress Simulation) */}
      {!isMounted && (
        <div className="fixed top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-pink-500 via-cyan-400 to-purple-600 z-50 animate-pulse" />
      )}
      
      {/* 0. CUSTOM RUNNING TEXT ANNOUNCEMENT TOP BAR */}
      {showAnnouncement && isSettingsLoaded && (settings?.is_running_text_active !== undefined ? settings.is_running_text_active === true : (settings?.donationOverlayActive !== false)) && (
        <>
          <style dangerouslySetInnerHTML={{__html: `
            @keyframes marqueeAnnouncement {
              0% { transform: translateX(100vw); }
              100% { transform: translateX(-100%); }
            }
            .marquee-announcement-text {
              animation: marqueeAnnouncement var(--announcement-speed, 15s) linear infinite;
            }
            .marquee-announcement-container:hover .marquee-announcement-text {
              animation-play-state: paused;
            }
          `}} />

          <div 
            className="w-full h-8 overflow-hidden bg-gradient-to-r from-[#101226] via-[#1a1c32] to-[#101226] border-b border-pink-500/20 text-white flex items-center justify-between gap-3 px-4 relative marquee-announcement-container select-none z-50"
            style={{
              '--announcement-speed': (() => {
                const spd = settings?.donationMarqueeSpeed || 'Sedang'
                if (spd === 'Pelan') return '25s'
                if (spd === 'Cepat') return '10s'
                return '15s'
              })()
            }}
          >
            {/* Left badge prefix */}
            <div className="flex items-center gap-2 relative z-10 bg-[#101226] pr-3 h-full border-r border-pink-500/20">
              <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase text-white bg-pink-600 animate-pulse">
                {getAnnouncementBadgeLabel()}
              </span>
            </div>

            {/* Marquee text area */}
            <div className="flex-1 overflow-hidden relative h-full flex items-center">
              <div className="marquee-announcement-text whitespace-nowrap text-[11px] font-bold text-slate-100 uppercase tracking-wide absolute flex items-center gap-1.5">
                <span>{getAnnouncementMessageLabel()}</span>
              </div>
            </div>

            {/* Close button */}
            <button
              onClick={() => setShowAnnouncement(false)}
              className="p-1 rounded hover:bg-slate-500/10 text-slate-400 hover:text-white transition-all flex-shrink-0 relative z-10 bg-[#101226] pl-3 border-l border-pink-500/20 h-full"
              title="Tutup Pengumuman"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </>
      )}

      {/* 1. TOP NAVBAR / HEADER */}
      <header className={`sticky top-0 z-40 border-b px-4 py-2 ${theme === 'dark' ? 'bg-[#0d0e1b]/95 border-[#1e2038]' : 'bg-white/95 border-slate-200'} backdrop-blur-md`}>
        {/* Mobile View: Single Line Layout */}
        <div className="flex items-center justify-between gap-2 md:gap-4">
          <div className="flex items-center gap-3">
            {/* Hamburger (≡) */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className={`p-1.5 rounded-lg border transition-all ${theme === 'dark' ? 'border-[#1e2038] hover:bg-[#1a1c32]' : 'border-slate-200 hover:bg-slate-100'}`}
              aria-label="Toggle Sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Logo Website */}
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigateToTab('home')}>
              <img
                src={settings?.logoUrl || "https://customer-assets-gfyr7b9c.emergentagent.net/job_media-integration-3/artifacts/pjwjya34_56fef010-9d66-4ad2-b4d9-042a1cb87424%20%281%29.png"}
                alt="Logo ShinDora Nesub"
                className="h-9 max-w-[150px] object-contain rounded"
              />
            </div>
          </div>

          {/* Search Box in Header */}
          <div className="flex-1 max-w-md mx-2 hidden sm:block">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                suppressHydrationWarning
                placeholder="Cari judul episode anime nostalgia..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full pl-9 pr-4 py-1.5 rounded-full text-sm outline-none transition-all border ${
                  theme === 'dark'
                    ? 'bg-[#121324] border-[#1e2038] text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500'
                    : 'bg-slate-100 border-slate-200 text-slate-900 focus:border-cyan-500'
                }`}
              />
            </div>
          </div>

          {/* Right Header actions in single row */}
          <div className="flex items-center gap-2">
            {/* Lonceng Subscribe Notifikasi Web Push */}
            <OneSignalBell theme={theme} />

            {/* Smart TV Mode Switcher Button */}
            <button
              type="button"
              onClick={() => {
                setIsTVMode(true);
                setTVModeActive(true);
              }}
              data-testid="tv-mode-toggle-btn"
              className={`px-2.5 py-1 rounded-full text-xs font-bold border transition-all cursor-pointer flex items-center gap-1 ${
                theme === 'dark'
                  ? 'border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400'
                  : 'border-cyan-200 bg-cyan-50 hover:bg-cyan-100 text-cyan-700'
              }`}
              title="Buka ShinDora dalam Mode Smart TV (Layar Besar & Navigasi Remote)"
              aria-label="Aktifkan Mode Smart TV"
            >
              <Tv className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Mode TV</span>
            </button>

            {/* Theme toggle */}
            <button
              onClick={handleToggleTheme}
              data-testid="theme-toggle-btn"
              className={`p-2 rounded-full transition-all cursor-pointer ${theme === 'dark' ? 'hover:bg-[#1a1c32] text-yellow-400' : 'hover:bg-slate-100 text-slate-700'}`}
              title={theme === 'dark' ? 'Ganti ke Mode Terang' : 'Ganti ke Mode Gelap'}
              aria-label="Toggle Mode Terang atau Gelap"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            {/* Custom Links & Panels shortcuts */}
            {currentUser && (currentUser.role === 'admin' || currentUser.role === 'superadmin') && (
              <a
                href="/admin"
                className="px-2.5 py-1 rounded text-xs font-semibold bg-pink-600/20 text-pink-400 border border-pink-500/30 hover:bg-pink-600/30 transition-all flex items-center gap-1 hidden md:flex"
              >
                ⚙️ Panel Admin
              </a>
            )}

            {currentUser && (currentUser.role === 'moderator' || currentUser.role === 'staf' || currentUser.role === 'admin' || currentUser.role === 'superadmin') && (
              <a
                href="/moderator"
                className="px-2.5 py-1 rounded text-xs font-semibold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/30 transition-all hidden md:block"
              >
                Panel Staf
              </a>
            )}

            {/* User Profile avatar or Login Button */}
            {currentUser ? (
              <div className="flex items-center gap-2 relative">
                
                {/* Lonceng Notifikasi (🔔) */}
                <div className="relative">
                  <button
                    data-testid="notifications-toggle-btn"
                    onClick={() => setShowNotificationsDropdown(!showNotificationsDropdown)}
                    className={`p-2 rounded-full transition-all relative ${
                      showNotificationsDropdown 
                        ? 'bg-slate-500/10 text-cyan-400' 
                        : (theme === 'dark' ? 'hover:bg-[#1a1c32] text-slate-300' : 'hover:bg-slate-100 text-slate-700')
                    }`}
                    title="Notifikasi"
                  >
                    <Bell className="w-5 h-5" />
                    {userNotifications.filter(n => !n.isRead).length > 0 && (
                      <span className="absolute -top-1.5 -right-1 bg-red-600 text-[9px] font-black text-white px-1.5 py-0.5 rounded-full shadow animate-bounce flex items-center justify-center">
                        {userNotifications.filter(n => !n.isRead).length}
                      </span>
                    )}
                  </button>

                  {/* Dropdown Notifikasi Panel */}
                  {showNotificationsDropdown && (
                    <div className={`absolute right-0 mt-2.5 w-72 sm:w-80 rounded-xl border p-3 shadow-2xl space-y-3 z-50 ${
                      theme === 'dark' ? 'bg-[#0d0e1b] border-[#1e2038] text-[#e2e8f0]' : 'bg-white border-slate-200 text-slate-900'
                    }`}>
                      <div className="flex items-center justify-between border-b border-slate-500/10 pb-2">
                        <span className="font-extrabold text-xs">Pemberitahuan</span>
                        <div className="flex gap-2">
                          <button
                            onClick={handleMarkAllNotificationsRead}
                            className="text-[10px] font-bold text-cyan-400 hover:underline"
                          >
                            Tandai dibaca
                          </button>
                          {userNotifications.length > 0 && (
                            <button
                              onClick={handleClearAllNotifications}
                              className="text-[10px] font-bold text-red-400 hover:underline"
                            >
                              Bersihkan
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="max-h-60 overflow-y-auto space-y-2.5 scrollbar-hide">
                        {userNotifications.length === 0 ? (
                          <p className="text-center py-6 text-[11px] opacity-50 italic">Tidak ada notifikasi baru.</p>
                        ) : (
                          userNotifications.map((notif) => (
                            <div
                              key={notif.id}
                              onClick={() => handleMarkNotificationRead(notif)}
                              className={`p-2 rounded-lg text-[11px] flex gap-2 cursor-pointer transition-all border text-left ${
                                notif.isRead
                                  ? 'opacity-60 bg-transparent border-transparent'
                                  : (theme === 'dark' ? 'bg-cyan-500/5 border-cyan-500/10 hover:bg-cyan-500/10' : 'bg-cyan-50/50 border-cyan-100 hover:bg-cyan-100/50')
                              }`}
                            >
                              {notif.senderAvatar ? (
                                <img src={notif.senderAvatar} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0 mt-0.5" />
                              ) : (
                                <span className="text-base flex-shrink-0 mt-0.5">💬</span>
                              )}
                              <div className="flex-1 space-y-0.5 overflow-hidden">
                                <p className="leading-snug">
                                  <strong>{notif.senderName}</strong> membalas komentar Anda:
                                </p>
                                <p className="italic opacity-80 truncate">&ldquo;{notif.contentSnippet}&rdquo;</p>
                                <p className="text-[9px] opacity-40 font-semibold">{notif.animeTitle} &bull; {notif.episodeTitle}</p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => navigateToTab('profile')}
                  className="flex items-center gap-2 border border-purple-500/30 hover:border-purple-500/60 p-0.5 rounded-full bg-purple-500/10"
                >
                  {currentUser?.avatarUrl ? (
                    <img
                      src={currentUser.avatarUrl}
                      alt={currentUser.name || 'Avatar'}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-purple-500 text-white flex items-center justify-center text-xs font-bold">
                      {(currentUser?.name || 'U').charAt(0).toUpperCase()}
                    </div>
                  )}
                </button>
                <button
                  onClick={handleLogout}
                  className={`p-2 rounded-full text-red-400 hover:bg-red-500/10 transition-all hidden md:block`}
                  title="Keluar"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <a
                href="/login"
                className="px-4 py-1.5 rounded-full text-xs font-semibold bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:from-cyan-600 hover:to-blue-700 transition-all shadow-md flex items-center gap-1"
              >
                <User className="w-3.5 h-3.5" />
                <span>Masuk</span>
              </a>
            )}
          </div>
        </div>

        {/* Mobile-only Search input line underneath to prevent crowded row if screen too small */}
        <div className="mt-2 block sm:hidden">
          <div className="relative">
            <Search className="absolute left-3 top-2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              suppressHydrationWarning
              placeholder="Cari episode anime..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-8 pr-3 py-1 rounded-full text-xs outline-none border ${
                theme === 'dark' ? 'bg-[#121324] border-[#1e2038] text-white' : 'bg-slate-100 border-slate-200'
              }`}
            />
          </div>
        </div>
      </header>

      {/* 2. BODY LAYOUT (SIDEBAR + MAIN CENTER) */}
      <div className="flex min-h-[calc(100vh-60px)] relative">
        
        {/* SIDEBAR NAVIGATION
            - Initial State Desktop: CLOSED/COLLAPSED if isOpen=false
            - Mobile Drawer: limit width to 70-75% screen with padding-compact and backdrop blur outside
         */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <aside
          className={`fixed lg:sticky top-[60px] h-[calc(100vh-60px)] z-30 transition-all duration-300 border-r flex flex-col justify-between ${
            sidebarOpen 
              ? 'w-[72%] max-w-[280px] sm:w-[260px] translate-x-0' 
              : 'w-0 lg:w-16 lg:translate-x-0 -translate-x-full'
          } ${
            theme === 'dark'
              ? 'bg-[#0d0e1b]/95 border-[#1e2038] text-[#a9adc1]'
              : 'bg-white border-slate-200 text-slate-600'
          }`}
        >
          {/* Main list items */}
          <div className="p-3 flex-1 space-y-1.5 overflow-y-auto">
            {sidebarOpen && <div className="text-[10px] uppercase font-bold tracking-wider opacity-40 px-3 mb-2">Navigasi</div>}
            
            <button
              onClick={() => navigateToTab('home')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
                activeTab === 'home'
                  ? (theme === 'dark' ? 'bg-gradient-to-r from-cyan-500/10 to-blue-500/10 text-cyan-400 font-medium border border-cyan-500/20' : 'bg-cyan-50 border border-cyan-500/30 text-cyan-700 font-black')
                  : 'hover:bg-slate-500/5'
              }`}
            >
              <Tv className="w-4 h-4 flex-shrink-0" />
              {sidebarOpen && <span>Beranda</span>}
            </button>

            <button
              onClick={() => navigateToTab('trending')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
                activeTab === 'trending'
                  ? (theme === 'dark' ? 'bg-gradient-to-r from-cyan-500/10 to-blue-500/10 text-cyan-400 font-medium border border-cyan-500/20' : 'bg-cyan-50 border border-cyan-500/30 text-cyan-700 font-black')
                  : 'hover:bg-slate-500/5'
              }`}
            >
              <TrendingUp className="w-4 h-4 flex-shrink-0" />
              {sidebarOpen && <span>Trending</span>}
            </button>

            <button
              onClick={() => navigateToTab('later')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
                activeTab === 'later'
                  ? (theme === 'dark' ? 'bg-gradient-to-r from-cyan-500/10 to-blue-500/10 text-cyan-400 font-medium border border-cyan-500/20' : 'bg-cyan-50 border border-cyan-500/30 text-cyan-700 font-black')
                  : 'hover:bg-slate-500/5'
              }`}
            >
              <Clock className="w-4 h-4 flex-shrink-0" />
              {sidebarOpen && (
                <div className="flex justify-between items-center w-full">
                  <span>Tonton Nanti</span>
                  <span className="text-xs bg-slate-500/20 px-1.5 py-0.2 rounded-full font-bold">{watchLaterIds.length}</span>
                </div>
              )}
            </button>

            <button
              onClick={() => navigateToTab('liked')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
                activeTab === 'liked'
                  ? (theme === 'dark' ? 'bg-gradient-to-r from-cyan-500/10 to-blue-500/10 text-cyan-400 font-medium border border-cyan-500/20' : 'bg-cyan-50 border border-cyan-500/30 text-cyan-700 font-black')
                  : 'hover:bg-slate-500/5'
              }`}
            >
              <Heart className="w-4 h-4 flex-shrink-0" />
              {sidebarOpen && (
                <div className="flex justify-between items-center w-full">
                  <span>Video Disukai</span>
                  <span className="text-xs bg-slate-500/20 px-1.5 py-0.2 rounded-full font-bold">{likedVideoIds.length}</span>
                </div>
              )}
            </button>

            <button
              onClick={() => navigateToTab('playlists')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
                activeTab === 'playlists'
                  ? (theme === 'dark' ? 'bg-gradient-to-r from-cyan-500/10 to-blue-500/10 text-cyan-400 font-medium border border-cyan-500/20' : 'bg-cyan-50 border border-cyan-500/30 text-cyan-700 font-black')
                  : 'hover:bg-slate-500/5'
              }`}
            >
              <FolderHeart className="w-4 h-4 flex-shrink-0" />
              {sidebarOpen && <span>Playlist</span>}
            </button>

            <a
              href="/putar-manual"
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all hover:bg-slate-500/5 text-purple-400"
              onClick={() => setSidebarOpen(false)}
              title="Daftar Episode"
            >
              <ListVideo className="w-4 h-4 flex-shrink-0 text-purple-400" />
              {sidebarOpen && <span>Daftar Episode</span>}
            </a>

            <button
              onClick={() => navigateToTab('vote')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
                activeTab === 'vote'
                  ? 'bg-gradient-to-r from-pink-500/10 to-purple-500/10 text-pink-400 font-medium border border-pink-500/20'
                  : 'hover:bg-slate-500/5'
              }`}
            >
              <BarChart3 className="w-4 h-4 flex-shrink-0 text-pink-400" />
              {sidebarOpen && <span>Vote Anime</span>}
            </button>

            {isInstallable && (
              <button
                onClick={handleInstallPwa}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all bg-gradient-to-r from-cyan-500/10 to-blue-500/10 hover:from-cyan-500/20 hover:to-blue-500/20 text-cyan-400 font-extrabold border border-cyan-500/20 hover:border-cyan-500/40 shadow-md shadow-cyan-500/5"
              >
                <Download className="w-4 h-4 flex-shrink-0 text-cyan-400" />
                {sidebarOpen && <span>Install Aplikasi</span>}
              </button>
            )}

            {/* Nostalgia Category List in Sidebar */}
            {sidebarOpen && (
              <div className="pt-4 border-t border-slate-500/10 mt-4">
                <div className="text-[10px] uppercase font-bold tracking-wider opacity-40 px-3 mb-2">Kategori Nostalgia</div>
                {(() => {
                  const sortedCategoriesList = [];
                  const visited = new Set();
                  
                  const addCategoryWithChildren = (cat, level) => {
                    const catIdStr = String(cat.id || cat._id);
                    if (visited.has(catIdStr)) return;
                    visited.add(catIdStr);
                    sortedCategoriesList.push({ ...cat, depth: level });
                    const children = categories.filter(c => c.parent_id && String(c.parent_id) === catIdStr);
                    children.forEach(child => {
                      addCategoryWithChildren(child, level + 1);
                    });
                  };

                  const mainCats = categories.filter(c => !c.parent_id || c.parent_id === 'none');
                  mainCats.forEach(main => {
                    addCategoryWithChildren(main, 1);
                  });

                  const addedIds = new Set(sortedCategoriesList.map(c => String(c.id)));
                  const orphans = categories.filter(c => !addedIds.has(String(c.id)));
                  orphans.forEach(orphan => {
                    addCategoryWithChildren(orphan, 1);
                  });

                  return sortedCategoriesList.map((catObj) => {
                    const filterValue = catObj.name.replace(/[^a-zA-Z0-9\s-]/g, '').trim();
                    const cleanName = catObj.name.replace(/[^a-zA-Z0-9\s-]/g, '').trim();
                    const depth = catObj.depth || 1;
                    const indent = "\u00A0\u00A0".repeat(depth - 1);
                    
                    // Count calculation
                    const count = videos.filter(v => checkVideoMatchesCategory(v, catObj, categories)).length;

                    return (
                      <button
                        key={catObj.id}
                        onClick={() => handleCategoryClick(String(catObj.id || catObj._id))}
                        className={`w-full flex items-center justify-between px-3 py-1.5 text-xs rounded transition-all hover:bg-slate-500/5 ${
                          (activeCategory === String(catObj.id || catObj._id) || activeCategory.toUpperCase() === filterValue.toUpperCase()) && activeTab === 'home' ? 'text-cyan-400 font-semibold' : ''
                        }`}
                      >
                        <span className="truncate">
                          {indent}{cleanName}
                        </span>
                        <span className="text-[10px] opacity-60 bg-slate-500/10 px-1.5 py-0.5 rounded font-bold">{count}</span>
                      </button>
                    );
                  });
                })()}
              </div>
            )}
          </div>

          {/* Social Icons inside Sidebar footer */}
          {sidebarOpen && settings?.socialLinks && settings?.socialLinks.length > 0 && (
            <div className={`p-4 border-t ${theme === 'dark' ? 'border-[#1e2038]' : 'border-slate-200'} text-xs`}>
              <p className="font-bold uppercase tracking-wider text-[10px] opacity-40 mb-2">Ikuti Kami</p>
              <div className="flex flex-wrap gap-1.5">
                {settings.socialLinks.map((link) => (
                  <a
                    key={link.id}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-0.5 px-2 py-1 rounded bg-slate-500/5 border border-slate-500/10 hover:text-cyan-400 transition-all font-semibold"
                  >
                    <span>{link.name}</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* 3. CENTER CONTENT SECTION */}
        <main className="flex-1 p-4 md:p-6 overflow-x-hidden max-w-full">
          
          {/* TOP AD BANNER */}
          {renderAdSlot('banner_top')}
          {renderAdSlot('banner_below_header')}

          {/* DYNAMIC VIEW ROOT SWITCH */}

          {/* VIEW: HOME */}
          {activeTab === 'home' && !activeVideo && (
            <div className="space-y-6 animate-fade-in">
              {/* HERO BANNER */}
              {isSettingsLoaded && (settings?.hero_banner_active !== false) && (
                <div className={`rounded-2xl border p-6 md:p-8 flex flex-col md:flex-row items-center gap-6 justify-between ${
                  theme === 'dark' 
                    ? 'border-[#1e2038] bg-gradient-to-r from-[#101226] to-[#0d0e1b]' 
                    : 'border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100'
                }`}>
                  <div className="max-w-xl space-y-4">
                    <span className="px-3 py-1 rounded-full text-[10px] font-black bg-pink-500/10 text-pink-400 border border-pink-500/20 uppercase tracking-widest">
                      {settings?.hero_badge_text || "✨ NOSTALGIA MASA KECIL"}
                    </span>
                    <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight leading-tight">
                      {settings?.hero_title || "Putar Kembali Kenangan Indah Hari Minggu Anda!"}
                    </h1>
                    <p className="text-xs md:text-sm opacity-80 leading-relaxed">
                      {settings?.hero_description || "Saksikan petualangan ajaib Doraemon, kekonyolan Shinchan, teknik ninja Hattori, dan keceriaan Maruko-chan terlengkap dengan kualitas modern."}
                    </p>
                      <div className="flex flex-wrap gap-3 pt-2">
                        <button
                          onClick={() => {
                            if (videos.length > 0) {
                              navigateToTab('watch', videos[0])
                            }
                          }}
                          className="px-6 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-cyan-400 to-blue-500 text-black hover:opacity-90 flex items-center gap-2 transition-all shadow-lg"
                        >
                          <Play className="w-4 h-4 fill-current" />
                          <span>Mulai Menonton</span>
                        </button>
                        {playlists.length > 0 && (
                          <button
                            onClick={() => startPlaylistPlayback(playlists[0])}
                            className={`px-5 py-2.5 rounded-xl text-xs font-bold border transition-all ${
                              theme === 'dark' 
                                ? 'border-[#1e2038] hover:bg-slate-500/5 text-white' 
                                : 'border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            Lihat Playlist
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="relative w-full max-w-[260px] h-[160px] md:h-[180px] rounded-xl overflow-hidden border border-[#1e2038] shadow-2xl flex-shrink-0">
                      <img
                        src={settings?.hero_featured_image || "https://images.unsplash.com/photo-1581833971358-2c8b550f87b3?w=500"}
                        alt="ShinDora Retro Anime"
                        className="w-full h-full object-cover"
                        loading="eager"
                        fetchPriority="high"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-3">
                        <span className="text-[9px] uppercase tracking-wider text-pink-400 font-black">
                          {settings?.hero_featured_label || "KOLEKSI TERPOPULER"}
                        </span>
                        <p className="text-xs font-bold text-white truncate">
                          {settings?.hero_featured_title || "Crayon Shinchan: Kenakalan Menolong Ibu"}
                        </p>
                      </div>
                    </div>
                  </div>
              )}

              {/* CATALOUGE TABS & COUNT */}
              <div className="border-b border-slate-500/10 pb-4 flex flex-col gap-3">
                <div className="w-full">
                  {/* Petunjuk Teks Kategori (Mobile Only) */}
                  <div className="md:hidden text-xs text-slate-400 dark:text-slate-500 mb-1.5 flex items-center gap-1 font-semibold select-none">
                    <span>&larr; Geser kategori ke samping &rarr;</span>
                  </div>
                  <div className="flex flex-row flex-nowrap md:flex-wrap overflow-x-auto md:overflow-x-visible scrollbar-hide scroll-smooth touch-pan-x gap-2 py-1 md:py-2 w-full">
                    {(() => {
                      const sortedCategoriesList = [];
                      const visited = new Set();
                      
                      const addCategoryWithChildren = (cat, level) => {
                        const catIdStr = String(cat.id || cat._id);
                        if (visited.has(catIdStr)) return;
                        visited.add(catIdStr);
                        sortedCategoriesList.push({ ...cat, depth: level });
                        const children = categories.filter(c => c.parent_id && String(c.parent_id) === catIdStr);
                        children.forEach(child => {
                          addCategoryWithChildren(child, level + 1);
                        });
                      };

                      const mainCats = categories.filter(c => !c.parent_id || c.parent_id === 'none');
                      mainCats.forEach(main => {
                        addCategoryWithChildren(main, 1);
                      });

                      const addedIds = new Set(sortedCategoriesList.map(c => String(c.id)));
                      const orphans = categories.filter(c => !addedIds.has(String(c.id)));
                      orphans.forEach(orphan => {
                        addCategoryWithChildren(orphan, 1);
                      });

                      const tabList = [
                        { value: 'SEMUA', label: 'SEMUA' },
                        ...sortedCategoriesList.map(c => {
                          return {
                            value: String(c.id || c._id),
                            label: c.name.replace(/[^a-zA-Z0-9\s-]/g, '').trim().toUpperCase()
                          };
                        })
                      ];

                      return tabList.map((tab) => (
                        <button
                          key={tab.value}
                          onClick={() => handleCategoryClick(tab.value)}
                          className={`px-3.5 py-1.5 rounded-full text-xs font-bold uppercase transition-all select-none whitespace-nowrap flex-shrink-0 ${
                            activeCategory.toUpperCase() === tab.value.toUpperCase()
                              ? 'bg-cyan-500 text-black font-extrabold shadow-md'
                              : theme === 'dark' 
                                ? 'bg-[#121324] hover:bg-[#1a1c32] text-slate-300' 
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-900 font-extrabold'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ));
                    })()}
                  </div>
                </div>
                <div className="text-right text-[11px] sm:text-xs opacity-60 font-semibold mt-1">
                  Menampilkan {filteredVideos.length} Episode
                </div>
              </div>

              {/* DIRECT CATALOG LIST GRID */}
              {!isMounted ? (
                <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 lg:grid-cols-4">
                  {[...Array(8)].map((_, idx) => (
                    <div
                      key={`skeleton-${idx}`}
                      className={`rounded-xl overflow-hidden border p-3.5 space-y-3.5 animate-pulse ${
                        theme === 'dark' ? 'border-[#1e2038] bg-[#0d0e1b]' : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className={`aspect-[16/10] w-full rounded-lg ${
                        theme === 'dark' ? 'bg-[#18192d]' : 'bg-slate-200'
                      }`} />
                      <div className="space-y-2.5">
                        <div className={`h-4 w-3/4 rounded-md ${
                          theme === 'dark' ? 'bg-[#18192d]' : 'bg-slate-200'
                        }`} />
                        <div className={`h-3 w-1/2 rounded-md ${
                          theme === 'dark' ? 'bg-[#18192d]' : 'bg-slate-200'
                        }`} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredVideos.length === 0 ? (
                <div className="text-center py-16 opacity-60 text-sm">
                  Tidak ada episode nostalgia yang cocok dengan filter atau kata kunci pencarian Anda.
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 lg:grid-cols-4">
                  {sortVideosByEpisode(filteredVideos).reduce((acc, video, idx) => {
                    acc.push(
                      <div
                        key={video.id}
                        onClick={() => navigateToTab('watch', video)}
                        className={`group rounded-xl overflow-hidden border cursor-pointer transition-all hover:scale-[1.02] hover:shadow-xl ${
                          theme === 'dark'
                            ? 'border-[#1e2038] bg-[#0d0e1b] hover:border-cyan-500/40'
                            : 'border-slate-200 bg-white hover:border-cyan-400'
                        }`}
                      >
                        <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-800">
                          <img
                            src={video.thumbnailUrl}
                            alt={video.title}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                          <div className="absolute top-1.5 left-1.5 flex flex-col gap-1">
                            {renderCategoryBadges(video.animeTitle, video.subCategory, "text-[8px]", video.subCategory2, video.subCategory3)}
                            <span className="self-start px-1.5 py-0.5 rounded text-[8px] font-bold bg-pink-600 text-white uppercase">
                              {formatEpisodeBadge(video.episode)}
                            </span>
                          </div>
                          {video.duration && (
                            <div className="absolute top-1.5 right-1.5">
                              <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-black/70 text-cyan-400">
                                ⏱️ {video.duration.replace(/\s+/g, '')}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="p-2 md:p-3 space-y-1">
                          <h3 className={`text-xs md:text-sm font-bold leading-snug transition-all line-clamp-1 ${
                            theme === 'dark'
                              ? 'text-slate-100 group-hover:text-cyan-400'
                              : 'text-slate-900 group-hover:text-cyan-600'
                          }`}>
                            {video.title}
                          </h3>
                          <p className="text-[10px] md:text-[11px] opacity-70 line-clamp-1 sm:line-clamp-2 leading-relaxed">
                            {video.description}
                          </p>
                          <div className={`flex items-center justify-between pt-1 text-[9px] md:text-[10px] font-bold border-t border-slate-500/10 mt-1.5 pt-1.5 ${
                            theme === 'dark' ? 'text-slate-400' : 'text-slate-700'
                          }`}>
                            <span>{video.views ? video.views.toLocaleString() : 0} views</span>
                            
                            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                              {/* Like Button */}
                              <button
                                onClick={() => handleLikeVideo(video)}
                                className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-all border ${
                                  likedVideoIds.includes(video.id)
                                    ? (theme === 'dark' ? 'bg-pink-500/20 border-pink-500/40 text-pink-400 font-extrabold shadow-sm' : 'bg-pink-50 border-pink-300 text-pink-700 font-extrabold shadow-sm')
                                    : (theme === 'dark' ? 'bg-slate-500/5 hover:bg-slate-500/10 border-transparent text-slate-300 hover:text-white' : 'bg-slate-100 hover:bg-slate-200 border-transparent text-slate-700 hover:text-slate-900')
                                }`}
                              >
                                <span>❤️</span>
                                <span>{video.likes || 0}</span>
                              </button>

                              {/* + Playlist Button */}
                              <button
                                onClick={() => {
                                  if (!currentUser) {
                                    alert('Silakan login untuk mengelola playlist pribadi!');
                                    return;
                                  }
                                  setPlaylistSelectorVideo(video);
                                }}
                                className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-slate-500/5 hover:bg-cyan-500/20 border border-transparent hover:border-cyan-500/20 text-slate-300 hover:text-cyan-400 transition-all"
                                title="Tambah ke Playlist"
                              >
                                <span>➕</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );

                    // Insert the inline ad after the 4th item (index 3)
                    if (idx === 3) {
                      acc.push(
                        <div key="grid-inline-ad-1" className="col-span-full my-2">
                          {renderAdSlot('banner_between_feed')}
                        </div>
                      );
                    }
                    if (idx === 11) {
                      acc.push(
                        <div key="grid-inline-ad-2" className="col-span-full my-2">
                          {renderAdSlot('banner_between_feed_2')}
                        </div>
                      );
                    }
                    if (idx === 19) {
                      acc.push(
                        <div key="grid-inline-ad-3" className="col-span-full my-2">
                          {renderAdSlot('banner_between_feed_3')}
                        </div>
                      );
                    }

                    return acc;
                  }, [])}
                </div>
              )}
            </div>
          )}

          {/* VIEW: TRENDING */}
          {activeTab === 'trending' && !activeVideo && (
            <div className="space-y-6 animate-fade-in">
              <div className="border-b border-slate-500/10 pb-3">
                <h2 className={`text-xl md:text-2xl font-black flex items-center gap-2 ${
                  theme === 'dark' ? 'text-cyan-400' : 'text-slate-900'
                }`}>
                  <TrendingUp className={`w-5 h-5 ${theme === 'dark' ? 'text-cyan-400' : 'text-slate-700'}`} />
                  <span>Trending Minggu Ini</span>
                </h2>
                <p className="text-xs opacity-60">Episode paling banyak ditonton oleh pecinta retro anime.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {[...videos].sort((a,b) => b.views - a.views).map((video) => (
                  <div
                    key={video.id}
                    onClick={() => navigateToTab('watch', video)}
                    className={`group rounded-xl overflow-hidden border cursor-pointer transition-all hover:scale-[1.02] ${
                      theme === 'dark' ? 'border-[#1e2038] bg-[#0d0e1b]' : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="relative aspect-video w-full overflow-hidden bg-slate-800">
                      <img src={video.thumbnailUrl} alt={video.title} className="w-full h-full object-cover" />
                      <div className="absolute top-2 left-2 flex flex-col gap-1.5">
                        {renderCategoryBadges(video.animeTitle, video.subCategory, "text-[9px]", video.subCategory2, video.subCategory3)}
                        <div className="flex gap-1.5">
                          <span className="self-start px-2 py-0.5 rounded text-[9px] font-bold bg-pink-600 text-white">{formatEpisodeBadge(video.episode)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="p-3.5 space-y-1">
                      <h3 className={`text-xs md:text-sm font-bold line-clamp-1 transition-all ${
                        theme === 'dark'
                          ? 'text-slate-100 group-hover:text-cyan-400'
                          : 'text-slate-900 group-hover:text-cyan-600'
                      }`}>
                        {video.title}
                      </h3>
                      <p className="text-[11px] opacity-70 line-clamp-2">{video.description}</p>
                      <div className={`flex justify-between items-center text-[10px] border-t border-slate-500/10 mt-1.5 pt-1.5 ${
                        theme === 'dark' ? 'text-slate-400' : 'text-slate-700 font-bold'
                      }`}>
                        <span>🔥 {video.views ? video.views.toLocaleString() : 0} kali diputar</span>
                        
                        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          {/* Like Button */}
                          <button
                            onClick={() => handleLikeVideo(video)}
                            className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-all border ${
                              likedVideoIds.includes(video.id)
                                ? (theme === 'dark' ? 'bg-pink-500/20 border-pink-500/40 text-pink-400 font-extrabold shadow-sm' : 'bg-pink-50 border-pink-300 text-pink-700 font-extrabold shadow-sm')
                                : (theme === 'dark' ? 'bg-slate-500/5 hover:bg-slate-500/10 border-transparent text-slate-300 hover:text-white' : 'bg-slate-100 hover:bg-slate-200 border-transparent text-slate-700 hover:text-slate-900')
                            }`}
                          >
                            <span>❤️</span>
                            <span>{video.likes || 0}</span>
                          </button>

                          {/* + Playlist Button */}
                          <button
                            onClick={() => {
                              if (!currentUser) {
                                alert('Silakan login untuk mengelola playlist pribadi!');
                                return;
                              }
                              setPlaylistSelectorVideo(video);
                            }}
                            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-slate-500/5 hover:bg-cyan-500/20 border border-transparent hover:border-cyan-500/20 text-slate-300 hover:text-cyan-400 transition-all"
                            title="Tambah ke Playlist"
                          >
                            <span>➕</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* VIEW: WATCH LOADING STATE */}
          {activeTab === 'watch' && !activeVideo && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-pulse">
              <div className="lg:col-span-2 space-y-4">
                <div className="w-full aspect-video rounded-xl bg-[#121324] border border-[#1e2038] flex items-center justify-center">
                  <span className="text-xs text-cyan-400 font-bold uppercase tracking-wider animate-pulse">Memuat Video...</span>
                </div>
                <div className="p-4 rounded-xl bg-[#0d0e1b] border border-[#1e2038] space-y-3">
                  <div className="h-5 w-2/3 bg-[#18192d] rounded" />
                  <div className="h-4 w-1/3 bg-[#18192d] rounded" />
                </div>
              </div>
            </div>
          )}

          {/* VIEW: WATCH PAGE PLAYER */}
          {activeTab === 'watch' && activeVideo && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
              {/* Left column - Player and description */}
              <div className="lg:col-span-2 space-y-4">
                
                {/* Banner di Atas Video Player */}
                {renderAdSlot('banner_above_player')}

                {/* Vintage TV Player Frame */}
                <div className="relative border-4 border-[#1e2038] shadow-2xl" style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', overflow: 'hidden', backgroundColor: '#000', borderRadius: '12px' }}>
                  {/* CRT Glass Scanlines layer */}
                  <div className="absolute inset-0 pointer-events-none z-10 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[size:100%_4px,6px_100%] opacity-15" />
                  
                  {(() => {
                    const playSource = getActivePlayerSource(activeVideo, activeServer);
                    if (!playSource.url) {
                      return (
                        <div className="w-full h-full flex items-center justify-center text-xs opacity-50 text-white">
                          Aliran video tidak tersedia.
                        </div>
                      );
                    }

                    const showNextOverlay = isTriggeringNextEpisode && nextEpisodeTarget;

                    if (playSource.type === 'video') {
                      return (
                        <video
                          src={playSource.url}
                          controls
                          autoPlay
                          className={`w-full h-full relative z-0 object-contain bg-black ${showNextOverlay ? 'hidden' : ''}`}
                          playsInline
                          onEnded={() => {
                            console.log('[HTML5 Video] Ended. Triggering countdown...');
                            onVideoFinished();
                          }}
                        />
                      );
                    }

                    return (
                      <iframe
                        src={playSource.url}
                        title={activeVideo.title}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        scrolling="no"
                        className={`w-full h-full border-0 relative z-0 ${showNextOverlay ? 'hidden' : ''}`}
                      />
                    );
                  })()}

                  {/* Autoplay Countdown Pop-up Overlay inside the Vintage Player Container */}
                  {isTriggeringNextEpisode && nextEpisodeTarget && (
                    <div className="animate-fade-in" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 50, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0, 0, 0, 0.9)' }}>
                      <div className="p-2 md:p-3 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 mb-2 md:mb-3 animate-pulse">
                        <Play className="w-6 h-6 md:w-8 md:h-8 fill-current animate-bounce" />
                      </div>
                      <h4 className="font-black text-cyan-400 uppercase tracking-widest mb-1 animate-pulse" style={{ fontSize: 'clamp(1rem, 2.5vw, 1.5rem)' }}>
                        Episode Selesai Diputar!
                      </h4>
                      <p className="text-[9px] md:text-xs text-slate-400 max-w-[280px] md:max-w-xs mb-3 md:mb-4 line-clamp-1">
                        Memutar otomatis: <span className="text-pink-400 font-extrabold">{nextEpisodeTarget.title} ({nextEpisodeTarget.episode})</span>
                      </p>
                      <div className="relative flex items-center justify-center w-12 h-14 md:w-14 md:h-14 max-w-[60px] max-h-[60px] mb-3 md:mb-4">
                        <div className="absolute inset-0 rounded-full border-4 border-slate-700" />
                        <div className="absolute inset-0 rounded-full border-4 border-t-cyan-500 border-r-cyan-500 animate-spin" />
                        <span className="text-base md:text-lg font-black text-cyan-400">
                          {nextEpisodeCountdown}s
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          setIsTriggeringNextEpisode(false);
                          setNextEpisodeTarget(null);
                        }}
                        className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white font-black text-[9px] md:text-[10px] rounded-lg transition-all shadow-md uppercase tracking-wider max-w-[120px] max-h-[36px]"
                      >
                        Batal
                      </button>
                    </div>
                  )}
                </div>

                {/* MULTI-SERVER STREAM SWITCHER */}
                <div className={`p-3 rounded-xl border flex flex-wrap items-center justify-between gap-3 ${
                  theme === 'dark' ? 'bg-[#0d0e1b] border-[#1e2038]' : 'bg-white border-slate-200'
                }`}>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-black text-pink-500 tracking-wider">PILIH SERVER ALIRAN (STREAM SWITCHER):</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {[
                      { id: 1, label: 'ShinDora' },
                      { id: 2, label: 'Server 2' },
                      { id: 3, label: 'Server 3' }
                    ].filter(srv => {
                      if (srv.id === 1) return true;
                      if (srv.id === 2) return activeVideo.videoUrl2 && activeVideo.videoUrl2.trim() !== '';
                      if (srv.id === 3) return activeVideo.videoUrl3 && activeVideo.videoUrl3.trim() !== '';
                      return false;
                    }).map((srv) => {
                      const isActive = activeServer === srv.id
                      const isAvailable = srv.id === 1 || (srv.id === 2 ? activeVideo.videoUrl2 : activeVideo.videoUrl3)
                      return (
                        <button
                          key={srv.id}
                          onClick={() => {
                            if (isAvailable) {
                              setActiveServer(srv.id)
                            } else {
                              alert('Server aliran ini tidak tersedia untuk episode ini! Menggunakan Server 1 Utama.')
                              setActiveServer(1)
                            }
                          }}
                          className={`px-3 py-1.5 rounded-lg text-[10px] md:text-xs font-black transition-all ${
                            isActive
                              ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-md'
                              : isAvailable
                                ? theme === 'dark'
                                  ? 'bg-[#121324] hover:bg-[#1a1c32] text-slate-300 border border-[#1e2038]'
                                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border'
                                : 'opacity-40 cursor-not-allowed bg-slate-500/10 text-slate-500 line-through'
                          }`}
                        >
                          {srv.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Banner Bawah Video Player */}
                {renderAdSlot('banner_below_player')}
                {renderAdSlot('banner_below_player_2')}

                {/* Video Info Headers */}
                <div className={`p-4 rounded-xl border ${theme === 'dark' ? 'bg-[#0d0e1b] border-[#1e2038]' : 'bg-white border-slate-200'}`}>
                  <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
                    {renderCategoryBadges(activeVideo.animeTitle, activeVideo.subCategory, "text-[10px]", activeVideo.subCategory2, activeVideo.subCategory3)}
                    {activeVideo.episode && (
                      <span data-testid="video-episode-badge" className="px-2 py-0.5 rounded font-bold bg-pink-600 text-white uppercase text-[10px]">
                        {activeVideo.episode}
                      </span>
                    )}
                  </div>
                  <h1 className="text-lg md:text-xl font-extrabold">{activeVideo.title}</h1>
                  
                  {/* Actions Bar */}
                  <div className="flex flex-col gap-3 mt-3 pt-3 border-t border-slate-500/10 mb-2">
                    <div className={`flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] sm:text-xs font-semibold ${
                      theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
                    }`}>
                      <span className="flex items-center gap-1">
                        🔥 {activeVideo.views ? activeVideo.views.toLocaleString('en-US') : 0} views
                      </span>
                      <span className="opacity-40">|</span>
                      <span className="flex items-center gap-1">
                        🗓️ <span className="hidden xs:inline">Diposting:</span> {activeVideo.createdAt ? new Date(activeVideo.createdAt).toLocaleDateString('id-ID') : '12/8/2026'}
                      </span>
                      <span className="opacity-40">|</span>
                      <span className="flex items-center gap-1">
                        ❤️ {activeVideo.likes} suka
                      </span>
                    </div>

                    <div className="flex flex-col gap-3">
                      {/* Row 1: Action Buttons (Suka, Tonton Nanti, + Playlist) */}
                      <div className="grid grid-cols-3 gap-2 w-full">
                        <button
                          onClick={() => handleLikeVideo(activeVideo)}
                          className={`w-full flex items-center justify-center gap-1 px-1 py-1.5 sm:px-2.5 sm:py-2 rounded-full text-[10px] sm:text-xs font-bold transition-all border whitespace-nowrap ${
                            likedVideoIds.includes(activeVideo.id)
                              ? (theme === 'dark' ? 'bg-pink-500/20 border-pink-500 text-pink-400' : 'bg-pink-50 border-pink-300 text-pink-700')
                              : (theme === 'dark' ? 'border-[#1e2038] hover:bg-[#1a1c32] text-slate-300' : 'border-slate-200 hover:bg-slate-100 text-slate-700')
                          }`}
                        >
                          <Heart className={`w-3.5 h-3.5 flex-shrink-0 ${likedVideoIds.includes(activeVideo.id) ? 'fill-current' : ''}`} />
                          <span className="truncate">Suka</span>
                        </button>

                        <button
                          onClick={() => handleWatchLater(activeVideo)}
                          className={`w-full flex items-center justify-center gap-1 px-1 py-1.5 sm:px-2.5 sm:py-2 rounded-full text-[10px] sm:text-xs font-bold transition-all border whitespace-nowrap ${
                            watchLaterIds.includes(activeVideo.id)
                              ? (theme === 'dark' ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400' : 'bg-cyan-50 border-cyan-300 text-cyan-700')
                              : (theme === 'dark' ? 'border-[#1e2038] hover:bg-[#1a1c32] text-slate-300' : 'border-slate-200 hover:bg-slate-100 text-slate-700')
                          }`}
                        >
                          <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="truncate">Tonton Nanti</span>
                        </button>

                        {/* Dropdown Add to Playlist */}
                        {currentUser ? (
                          <button 
                            onClick={() => setPlaylistSelectorVideo(activeVideo)}
                            className={`w-full flex items-center justify-center gap-1 px-1 py-1.5 sm:px-2.5 sm:py-2 rounded-full text-[10px] sm:text-xs font-bold border transition-all cursor-pointer select-none whitespace-nowrap ${
                              theme === 'dark' ? 'border-[#1e2038] hover:bg-[#1a1c32] text-slate-300' : 'border-slate-200 hover:bg-slate-100 text-slate-700'
                            }`}
                          >
                            <Plus className="w-3.5 h-3.5 flex-shrink-0" />
                            <span className="truncate">Playlist</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => alert('Silakan login untuk mengelola playlist pribadi!')}
                            className={`w-full flex items-center justify-center gap-1 px-1 py-1.5 sm:px-2.5 sm:py-2 rounded-full text-[10px] sm:text-xs font-bold border opacity-50 cursor-not-allowed whitespace-nowrap ${
                              theme === 'dark' ? 'border-[#1e2038] text-slate-400' : 'border-slate-200 text-slate-500'
                            }`}
                          >
                            <Plus className="w-3.5 h-3.5 flex-shrink-0" />
                            <span className="truncate">Playlist</span>
                          </button>
                        )}
                      </div>

                      {/* Row 2: Episode Navigation (← Eps Sebelum / Eps Selanjutnya →) */}
                      {/* Grid 2-column on mobile, compact text and padding */}
                      <div className="grid grid-cols-2 gap-2 w-full pt-1">
                        <button
                          onClick={() => {
                            const prevVideo = getPrevEpisode()
                            if (prevVideo) {
                              navigateToTab('watch', prevVideo)
                              setActiveServer(1)
                            }
                          }}
                          disabled={!getPrevEpisode()}
                          className={`flex items-center justify-center gap-1 py-2 px-2.5 rounded-xl text-[10px] md:text-xs font-black transition-all border ${
                            getPrevEpisode()
                              ? 'bg-purple-500/10 border-purple-500/30 text-purple-400 hover:bg-purple-500/20'
                              : 'opacity-40 cursor-not-allowed border-transparent text-slate-500 bg-slate-500/5'
                          }`}
                          title="Tonton Episode Sebelumnya"
                        >
                          <span>&larr; Eps Sebelum</span>
                        </button>

                        <button
                          onClick={() => {
                            const nextVideo = getNextEpisode()
                            if (nextVideo) {
                              navigateToTab('watch', nextVideo)
                              setActiveServer(1)
                            }
                          }}
                          disabled={!getNextEpisode()}
                          className={`flex items-center justify-center gap-1 py-2 px-2.5 rounded-xl text-[10px] md:text-xs font-black transition-all border ${
                            getNextEpisode()
                              ? 'bg-purple-500/10 border-purple-500/30 text-purple-400 hover:bg-purple-500/20'
                              : 'opacity-40 cursor-not-allowed border-transparent text-slate-500 bg-slate-500/5'
                          }`}
                          title="Tonton Episode Selanjutnya"
                        >
                          <span>Eps Selanjutnya &rarr;</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs md:text-sm opacity-80 mt-4 leading-relaxed border-t border-slate-500/10 pt-4">
                    {activeVideo.description}
                  </p>
                </div>

                {/* MULTI-LINK DOWNLOAD SECTION (KONDISIONAL) */}
                {Array.isArray(activeVideo.download_links) && activeVideo.download_links.filter(l => l && (l.url || l.provider)).length > 0 && (
                  <div data-testid="video-download-section" className={`p-4 rounded-xl border space-y-3 ${
                    theme === 'dark' ? 'bg-[#0d0e1b] border-cyan-500/30 shadow-lg shadow-cyan-500/5' : 'bg-white border-cyan-300 shadow-sm'
                  }`}>
                    <div className="flex items-center justify-between border-b border-slate-500/10 pb-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-xs">
                          <Download className="w-4 h-4" />
                        </div>
                        <div>
                          <h3 className="text-xs md:text-sm font-black text-cyan-400 uppercase tracking-wider">
                            Link Download Video
                          </h3>
                          <span className="text-[10px] opacity-60">Pilih tautan server / resolusi untuk mengunduh</span>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                        {activeVideo.download_links.filter(l => l && (l.url || l.provider)).length} Opsi Unduhan
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2.5 pt-1">
                      {activeVideo.download_links.filter(l => l && (l.url || l.provider)).map((link, idx) => {
                        const rawProvider = (link.provider || `Server ${idx + 1}`).trim();
                        const labelText = rawProvider.startsWith('[') ? rawProvider : `[📥 ${rawProvider}]`;

                        return (
                          <a
                            key={idx}
                            data-testid="video-download-btn"
                            href={link.url || '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black transition-all border shadow-sm ${
                              theme === 'dark' 
                                ? 'bg-gradient-to-r from-cyan-950/60 to-blue-950/60 border-cyan-500/40 text-cyan-300 hover:border-cyan-400 hover:text-white hover:shadow-cyan-500/20 hover:scale-[1.02]' 
                                : 'bg-cyan-50 border-cyan-300 text-cyan-800 hover:bg-cyan-100 hover:border-cyan-400 hover:scale-[1.02]'
                            }`}
                          >
                            <span>{labelText}</span>
                          </a>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Banner Di Atas Widget Playlist Maraton */}
                {renderAdSlot('banner_above_playlist')}

                {/* PLAYLIST MARATON QUEUE WIDGET */}
                {currentPlaylist && (
                  <div className={`p-4 rounded-xl border space-y-3 ${theme === 'dark' ? 'bg-[#0d0e1b] border-[#1e2038]' : 'bg-white border-slate-200'}`}>
                    <div className="flex items-center justify-between border-b border-slate-500/10 pb-2">
                      <div>
                        <span className="text-[9px] font-black uppercase text-pink-500">PLAYLIST MARATON</span>
                        <h4 className="text-xs md:text-sm font-black line-clamp-1">{currentPlaylist.title}</h4>
                      </div>
                      <button onClick={() => setCurrentPlaylist(null)} className="text-xs opacity-60 hover:opacity-100 hover:text-red-400 font-bold">Tutup</button>
                    </div>

                    {/* Maraton Autoplay Mode Selector */}
                    <div className="flex items-center justify-between p-2 rounded-lg bg-slate-500/5 border border-slate-500/10 text-xs">
                      <span className="font-bold">Putar Maraton / Autoplay:</span>
                      <button
                        onClick={() => setIsAutoplayPlaylist(!isAutoplayPlaylist)}
                        className={`px-3 py-1 rounded font-black tracking-wide text-[10px] uppercase transition-all ${
                          isAutoplayPlaylist ? 'bg-cyan-500 text-black' : 'bg-slate-500/20 text-slate-300'
                        }`}
                      >
                        {isAutoplayPlaylist ? 'ON (Pindah Otomatis)' : 'OFF (Pilih Manual)'}
                      </button>
                    </div>

                    {/* Playlist Items Queue */}
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {sortVideosByEpisodeAscending(
                        currentPlaylist.videoIds
                          .map(vidId => videos.find(v => v.id === vidId))
                          .filter(Boolean)
                      ).map((vid) => {
                          const isActive = activeVideo.id === vid.id

                          return (
                            <div
                              key={vid.id}
                              onClick={() => {
                                navigateToTab('watch', vid)
                                setActiveServer(1)
                              }}
                              className={`p-2 rounded-lg flex gap-2.5 items-center cursor-pointer transition-all border text-xs ${
                                isActive
                                  ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-400 font-bold'
                                  : 'bg-slate-500/5 hover:bg-slate-500/10 border-transparent'
                              }`}
                            >
                              <img src={vid.thumbnailUrl} alt={vid.title} className="w-12 h-8 rounded object-cover flex-shrink-0" />
                              <div className="flex-1 truncate">
                                <span className="text-[10px] text-pink-400 mr-1">{vid.episode}</span>
                                <span className="truncate">{vid.title}</span>
                              </div>
                              {isActive && <div className="text-[10px] text-cyan-400 flex items-center gap-0.5">● Playing</div>}
                            </div>
                          )
                        })
                      }
                    </div>
                  </div>
                )}

                {/* NESTED COMMENTS SECTION */}
                <div className="space-y-3">
                  {/* Toggle Button / Accordion Header */}
                  <button
                    onClick={() => setShowComments(!showComments)}
                    className={`w-full flex items-center justify-between p-3.5 rounded-xl border font-bold text-xs sm:text-sm transition-all shadow-sm ${
                      theme === 'dark' 
                        ? 'bg-[#0d0e1b] border-[#1e2038] hover:bg-[#121324] text-cyan-400' 
                        : 'bg-slate-100 border-slate-200 hover:bg-slate-200 text-slate-800'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      💬 {showComments ? 'Sembunyikan Komentar' : `Lihat Komentar (${comments.length})`}
                    </span>
                    <span className="text-xs opacity-60">
                      {showComments ? '▲' : '▼'}
                    </span>
                  </button>

                  {/* Comments Content (Expandable area) */}
                  {showComments && (
                    <div className={`p-4 rounded-xl border space-y-4 animate-fade-in ${theme === 'dark' ? 'bg-[#0d0e1b] border-[#1e2038]' : 'bg-white border-slate-200'}`}>
                      <h3 className={`font-extrabold text-sm md:text-base ${
                        theme === 'dark' ? 'text-cyan-400' : 'text-slate-900'
                      }`}>Komentar Fansub ({comments.length})</h3>
                    
                      {/* New comment input */}
                      {currentUser ? (
                        <form onSubmit={(e) => handlePostComment(e)} className="flex gap-2">
                          {currentUser.avatarUrl ? (
                            <img src={currentUser.avatarUrl} alt={currentUser.name || 'User'} className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-xs font-bold flex-shrink-0">
                              {(currentUser.name || 'U').charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="flex-1 space-y-2">
                            <div className="relative">
                              <textarea
                                placeholder="Tulis opini nostalgia Anda tentang episode ini..."
                                value={newCommentText}
                                onChange={(e) => setNewCommentText(e.target.value)}
                                className={`w-full text-xs p-2.5 rounded-lg border outline-none min-h-[70px] ${
                                  theme === 'dark' ? 'bg-[#121324] border-[#1e2038] text-white focus:border-cyan-500' : 'bg-slate-50 border-slate-200'
                                }`}
                              />
                            </div>
                            <div className="flex justify-end">
                              <button type="submit" className="px-4 py-1.5 bg-cyan-500 hover:bg-cyan-600 text-black font-extrabold rounded-lg text-xs cursor-pointer">
                                Kirim Komentar
                              </button>
                            </div>
                          </div>
                        </form>
                      ) : (
                        <div className="text-center py-4 bg-slate-500/5 rounded-lg text-xs">
                          Silakan <a href="/login" className="text-cyan-400 font-bold underline">Login</a> terlebih dahulu untuk menuangkan kenangan Anda di kolom komentar.
                        </div>
                      )}

                      {/* Comments Threads List */}
                      <div className="space-y-4 pt-2">
                        {comments.filter(c => c.parentId === null).map((parent) => {
                          const childReplies = comments.filter(c => c.parentId === parent.id)
                          const isStaff = currentUser && (currentUser.role === 'admin' || currentUser.role === 'moderator')

                          return (
                            <div key={parent.id || parent._id} className="border-b border-slate-500/5 pb-4 space-y-3">
                              {/* Parent Comment */}
                              <div className="flex gap-3">
                                <img src={parent.userAvatar} alt={parent.userName} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                                <div className="flex-1 space-y-1">
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <span className={`text-xs font-bold ${
                                        theme === 'dark' ? 'text-slate-100' : 'text-slate-900'
                                      }`}>{parent.userName}</span>
                                      {(() => {
                                        const isCommentAdmin = parent.userId === 'user-admin-id' || parent.role === 'admin';
                                        const isCommentStaff = parent.userId === 'user-mod-id' || parent.role === 'moderator' || parent.role === 'staf';
                                        if (isCommentAdmin) {
                                          return (
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold border whitespace-nowrap ${
                                              theme === 'dark' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-rose-100 text-rose-800 border-rose-200'
                                            }`}>
                                              ADMIN
                                            </span>
                                          );
                                        }
                                        if (isCommentStaff) {
                                          return (
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold border whitespace-nowrap ${
                                              theme === 'dark' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' : 'bg-cyan-100 text-cyan-800 border-cyan-200'
                                            }`}>
                                              STAF
                                            </span>
                                          );
                                        }
                                        return null;
                                      })()}
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                      <span className="text-[10px] opacity-40">{new Date(parent.createdAt).toLocaleDateString()}</span>
                                      
                                      {/* Direct Moderation Delete on Watch Page */}
                                      {isStaff && (
                                        <button
                                          onClick={() => handleDeleteComment(parent.id)}
                                          className="text-red-400 hover:text-red-500 p-1 rounded hover:bg-red-500/10"
                                          title="Hapus Komentar beserta Rantai Balasannya"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                  <div className={`text-xs opacity-90 leading-relaxed break-words ${
                                    theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
                                  }`}>
                                    {parent.content}
                                  </div>
                                  
                                  {/* Reply Trigger button */}
                                  {currentUser && (
                                    <button
                                      onClick={() => {
                                        setActiveReplyToId(parent.id);
                                        setReplyText('');
                                      }}
                                      className={`text-xs font-bold hover:underline pt-1 block w-fit ${
                                        theme === 'dark' ? 'text-cyan-400' : 'text-cyan-600'
                                      }`}
                                    >
                                      Balas
                                    </button>
                                  )}

                                  {/* Nested Reply form */}
                                  {activeReplyToId === parent.id && (
                                    <form 
                                      onSubmit={(e) => handlePostComment(e, parent.id)} 
                                      className="w-full flex flex-col gap-2 mt-2 pt-2 border-t border-slate-500/10 box-border"
                                    >
                                      <div className="relative">
                                        <textarea
                                          placeholder="Tulis balasan nostalgia Anda..."
                                          value={replyText}
                                          onChange={(e) => setReplyText(e.target.value)}
                                          className={`w-full text-xs p-2.5 rounded-lg border outline-none resize-none min-h-[60px] ${
                                            theme === 'dark' ? 'bg-[#121324] border-[#1e2038] text-white focus:border-cyan-500' : 'bg-slate-50 border-slate-200'
                                          }`}
                                          required
                                        />
                                      </div>
                                      <div className="flex justify-end gap-2">
                                        <button 
                                          type="button"
                                          onClick={() => { setActiveReplyToId(null); setReplyText(''); }}
                                          className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                                            theme === 'dark' ? 'border-[#1e2038] text-slate-300 hover:bg-[#1a1c32]' : 'border-slate-200 text-slate-700 hover:bg-slate-100'
                                          }`}
                                        >
                                          Batal
                                        </button>
                                        <button 
                                          type="submit" 
                                          className="px-4 py-1.5 bg-cyan-500 hover:bg-cyan-600 text-black font-extrabold rounded-lg text-xs transition-all"
                                        >
                                          Balas
                                        </button>
                                      </div>
                                    </form>
                                  )}
                                </div>
                              </div>

                              {/* Toggle/Accordion for replies like YouTube */}
                              {childReplies.length > 0 && (
                                <button
                                  onClick={() => {
                                    if (expandedReplies.includes(parent.id)) {
                                      setExpandedReplies(expandedReplies.filter(id => id !== parent.id));
                                    } else {
                                      setExpandedReplies([...expandedReplies, parent.id]);
                                    }
                                  }}
                                  className="flex items-center gap-1.5 text-xs font-bold text-cyan-400 hover:underline mt-1 ml-11 select-none w-fit"
                                >
                                  {expandedReplies.includes(parent.id) ? (
                                    <span>▲ Sembunyikan {childReplies.length} balasan</span>
                                  ) : (
                                    <span>▼ Lihat {childReplies.length} balasan</span>
                                  )}
                                </button>
                              )}

                              {/* Children Nested Replies */}
                              {expandedReplies.includes(parent.id) && childReplies.length > 0 && (
                                <div className="pl-3 border-l-2 border-slate-500/10 dark:border-slate-500/20 space-y-4 mt-2 ml-4 sm:ml-11 sm:pl-4">
                                  {childReplies.map((reply) => (
                                    <div key={reply.id || reply._id} className="flex flex-col gap-2 w-full box-border">
                                      {/* Reply main card block */}
                                      <div className="flex gap-2.5 items-start">
                                        <img src={reply.userAvatar} alt={reply.userName} className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
                                        <div className="flex-1 space-y-1 overflow-hidden">
                                          <div className="flex items-center justify-between gap-2">
                                            <div className="flex flex-wrap items-center gap-1.5">
                                              <span className={`text-xs font-bold ${
                                                theme === 'dark' ? 'text-slate-100' : 'text-slate-900'
                                              }`}>{reply.userName}</span>
                                              {(() => {
                                                const isRepAdmin = reply.userId === 'user-admin-id' || reply.role === 'admin';
                                                const isRepStaff = reply.userId === 'user-mod-id' || reply.role === 'moderator' || reply.role === 'staf';
                                                if (isRepAdmin) {
                                                  return (
                                                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold border whitespace-nowrap ${
                                                      theme === 'dark' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-rose-100 text-rose-800 border-rose-200'
                                                    }`}>
                                                      ADMIN
                                                    </span>
                                                  );
                                                }
                                                if (isRepStaff) {
                                                  return (
                                                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold border whitespace-nowrap ${
                                                      theme === 'dark' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' : 'bg-cyan-100 text-cyan-800 border-cyan-200'
                                                    }`}>
                                                      STAF
                                                    </span>
                                                  );
                                                }
                                                return null;
                                              })()}
                                            </div>
                                            <div className="flex items-center gap-1.5 flex-shrink-0">
                                              <span className="text-[9px] opacity-40">{new Date(reply.createdAt).toLocaleDateString()}</span>
                                              {isStaff && (
                                                <button
                                                  onClick={() => handleDeleteComment(reply.id)}
                                                  className="text-red-400 hover:text-red-500 p-0.5 rounded"
                                                  title="Hapus Balasan"
                                                >
                                                  <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                              )}
                                            </div>
                                          </div>
                                          <div className={`text-xs opacity-90 leading-relaxed break-words ${
                                            theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
                                          }`}>
                                            {reply.content}
                                          </div>
                                          
                                          {/* Reply Button for a Reply Comment */}
                                          {currentUser && (
                                            <button
                                              onClick={() => {
                                                setActiveReplyToId(reply.id);
                                                setReplyText(`@${reply.userName} `);
                                              }}
                                              className={`text-[10px] font-bold hover:underline pt-1 block w-fit ${
                                                theme === 'dark' ? 'text-cyan-400' : 'text-cyan-600'
                                              }`}
                                            >
                                              Balas
                                            </button>
                                          )}
                                        </div>
                                      </div>

                                      {/* Inline Form directly under the child reply being replied to */}
                                      {activeReplyToId === reply.id && (
                                        <form 
                                          onSubmit={(e) => handlePostComment(e, parent.id)} 
                                          className="w-full flex flex-col gap-2 mt-1 pl-9 pr-2 py-2 border-t border-slate-500/5 box-border"
                                        >
                                          <textarea
                                            placeholder={`Balas ${reply.userName}...`}
                                            value={replyText}
                                            onChange={(e) => setReplyText(e.target.value)}
                                            className={`w-full text-xs p-2 rounded-lg border outline-none resize-none min-h-[50px] ${
                                              theme === 'dark' ? 'bg-[#121324] border-[#1e2038] text-white focus:border-cyan-500' : 'bg-slate-50 border-slate-200'
                                            }`}
                                            required
                                          />
                                          <div className="flex justify-end gap-2">
                                            <button 
                                              type="button"
                                              onClick={() => { setActiveReplyToId(null); setReplyText(''); }}
                                              className={`px-2.5 py-1 rounded-md text-xs font-bold border transition-all ${
                                                theme === 'dark' ? 'border-[#1e2038] text-slate-300 hover:bg-[#1a1c32]' : 'border-slate-200 text-slate-700 hover:bg-slate-100'
                                              }`}
                                            >
                                              Batal
                                            </button>
                                            <button 
                                              type="submit" 
                                              className="px-3.5 py-1 bg-cyan-500 hover:bg-cyan-600 text-black font-extrabold rounded-md text-xs transition-all"
                                            >
                                              Balas
                                            </button>
                                          </div>
                                        </form>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Banner Bawah Komentar */}
                {renderAdSlot('banner_below_comments')}

              </div>

              {/* Right column - Playlist & Playlist Queue Sidebar */}
              <div className="space-y-4">

                {/* Banner Sidebar Kanan */}
                {renderAdSlot('banner_sidebar')}
                {renderAdSlot('banner_sidebar_2')}

                {/* More Retro Episode recommendations */}
                <div className={`p-4 rounded-xl border space-y-3.5 ${theme === 'dark' ? 'bg-[#0d0e1b] border-[#1e2038]' : 'bg-white border-slate-200'}`}>
                  <h4 className="text-xs md:text-sm font-black border-b border-slate-500/10 pb-2">Rekomendasi Nostalgia Lainnya</h4>
                  <div className="space-y-3">
                    {videos.filter(v => v.id !== activeVideo.id).slice(0, 5).map((vid) => (
                      <div
                        key={vid.id}
                        onClick={() => navigateToTab('watch', vid)}
                        className="group flex gap-2.5 cursor-pointer hover:bg-slate-500/5 p-1 rounded-lg transition-all"
                      >
                        <img src={vid.thumbnailUrl} alt={vid.title} className="w-16 h-10 rounded object-cover flex-shrink-0" />
                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                          <span className="text-[9px] text-cyan-400 uppercase font-black">{vid.animeTitle} &bull; {vid.episode}</span>
                          <h5 className={`text-xs font-bold truncate transition-all ${
                            theme === 'dark'
                              ? 'text-slate-200 group-hover:text-cyan-400'
                              : 'text-slate-900 group-hover:text-cyan-600'
                          }`}>
                            {vid.title}
                          </h5>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* VIEW: LATER (WATCH LATER) */}
          {activeTab === 'later' && (
            <div className="space-y-6 animate-fade-in">
              <div className="border-b border-slate-500/10 pb-3">
                <h2 className={`text-xl md:text-2xl font-black flex items-center gap-2 ${
                  theme === 'dark' ? 'text-cyan-400' : 'text-slate-900'
                }`}>
                  <Clock className={`w-5 h-5 ${theme === 'dark' ? 'text-cyan-400' : 'text-slate-700'}`} />
                  <span>Daftar Tonton Nanti Anda</span>
                </h2>
                <p className="text-xs opacity-60">Saksikan episode-episode yang Anda simpan di waktu senggang Anda.</p>
              </div>

              {watchLaterIds.length === 0 ? (
                <div className="text-center py-20 bg-slate-500/5 rounded-2xl p-6 border border-slate-500/10">
                  <Clock className="w-12 h-12 text-slate-500 mx-auto mb-3 opacity-45" />
                  <h4 className={`text-base font-bold ${
                    theme === 'dark' ? 'text-slate-300' : 'text-slate-800'
                  }`}>Daftar Tonton Nanti Kosong</h4>
                  <p className="text-xs opacity-60 mt-1">Gunakan tombol &quot;Tonton Nanti&quot; pada halaman detail video untuk menyimpannya.</p>
                  <button onClick={() => navigateToTab('home')} className="mt-4 px-5 py-2 rounded bg-cyan-500 text-black text-xs font-black">
                    Jelajahi Beranda
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {videos.filter(v => watchLaterIds.includes(v.id)).map((video) => (
                    <div
                      key={video.id}
                      onClick={() => navigateToTab('watch', video)}
                      className={`group rounded-xl overflow-hidden border cursor-pointer transition-all hover:scale-[1.02] ${
                        theme === 'dark' ? 'border-[#1e2038] bg-[#0d0e1b]' : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className="relative aspect-video w-full overflow-hidden">
                        <img src={video.thumbnailUrl} alt={video.title} className="w-full h-full object-cover" />
                        <div className="absolute top-2 left-2 flex flex-col gap-1">
                          {renderCategoryBadges(video.animeTitle, video.subCategory, "text-[9px]", video.subCategory2, video.subCategory3)}
                        </div>
                      </div>
                      <div className="p-3.5 space-y-1">
                        <h3 className={`text-xs md:text-sm font-bold line-clamp-1 transition-all ${
                          theme === 'dark'
                            ? 'text-slate-100 group-hover:text-cyan-400'
                            : 'text-slate-900 group-hover:text-cyan-600'
                        }`}>{video.title}</h3>
                        <p className="text-[11px] opacity-70 line-clamp-2">{video.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* VIEW: LIKED */}
          {activeTab === 'liked' && (
            <div className="space-y-6 animate-fade-in">
              <div className="border-b border-slate-500/10 pb-3">
                <h2 className={`text-xl md:text-2xl font-black flex items-center gap-2 ${
                  theme === 'dark' ? 'text-cyan-400' : 'text-slate-900'
                }`}>
                  <Heart className={`w-5 h-5 ${theme === 'dark' ? 'text-cyan-400 fill-current' : 'text-slate-700 fill-current'}`} />
                  <span>Koleksi Video Disukai</span>
                </h2>
                <p className="text-xs opacity-60">Semua episode nostalgia yang paling Anda sukai.</p>
              </div>

              {likedVideoIds.length === 0 ? (
                <div className="text-center py-20 bg-slate-500/5 rounded-2xl p-6 border border-slate-500/10">
                  <Heart className="w-12 h-12 text-slate-500 mx-auto mb-3 opacity-45" />
                  <h4 className={`text-base font-bold ${
                    theme === 'dark' ? 'text-slate-300' : 'text-slate-800'
                  }`}>Belum Ada Video Disukai</h4>
                  <p className="text-xs opacity-60 mt-1">Berikan jempol atau suka pada episode retro yang Anda tonton.</p>
                  <button onClick={() => navigateToTab('home')} className="mt-4 px-5 py-2 rounded bg-cyan-500 text-black text-xs font-black">
                    Jelajahi Beranda
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 lg:grid-cols-4">
                  {videos.filter(v => likedVideoIds.includes(v.id)).map((video) => (
                    <div
                      key={video.id}
                      onClick={() => navigateToTab('watch', video)}
                      className={`group rounded-xl overflow-hidden border cursor-pointer transition-all hover:scale-[1.02] hover:shadow-xl ${
                        theme === 'dark'
                          ? 'border-[#1e2038] bg-[#0d0e1b] hover:border-cyan-500/40'
                          : 'border-slate-200 bg-white hover:border-cyan-400'
                      }`}
                    >
                      <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-800">
                        <img
                          src={video.thumbnailUrl}
                          alt={video.title}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                        <div className="absolute top-1.5 left-1.5 flex flex-col gap-1">
                          {renderCategoryBadges(video.animeTitle, video.subCategory, "text-[8px]", video.subCategory2, video.subCategory3)}
                          <span className="self-start px-1.5 py-0.5 rounded text-[8px] font-bold bg-pink-600 text-white uppercase">
                            {formatEpisodeBadge(video.episode)}
                          </span>
                        </div>
                      </div>
                      <div className="p-2 md:p-3 space-y-1">
                        <h3 className={`text-xs md:text-sm font-bold leading-snug transition-all line-clamp-1 ${
                          theme === 'dark'
                            ? 'text-slate-100 group-hover:text-cyan-400'
                            : 'text-slate-900 group-hover:text-cyan-600'
                        }`}>
                          {video.title}
                        </h3>
                        <p className="text-[10px] md:text-[11px] opacity-70 line-clamp-1 sm:line-clamp-2 leading-relaxed">
                          {video.description}
                        </p>
                        <div className={`flex items-center justify-between pt-1 text-[9px] md:text-[10px] font-bold border-t border-slate-500/10 mt-1.5 pt-1.5 ${
                          theme === 'dark' ? 'text-slate-400' : 'text-slate-700'
                        }`}>
                          <span>{video.views ? video.views.toLocaleString() : 0} views</span>
                          
                          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                            {/* Like Button */}
                            <button
                              onClick={() => handleLikeVideo(video)}
                              className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-all border ${
                                likedVideoIds.includes(video.id)
                                  ? (theme === 'dark' ? 'bg-pink-500/20 border-pink-500/40 text-pink-400 font-extrabold shadow-sm' : 'bg-pink-50 border-pink-300 text-pink-700 font-extrabold shadow-sm')
                                  : (theme === 'dark' ? 'bg-slate-500/5 hover:bg-slate-500/10 border-transparent text-slate-300 hover:text-white' : 'bg-slate-100 hover:bg-slate-200 border-transparent text-slate-700 hover:text-slate-900')
                              }`}
                            >
                              <span>❤️</span>
                              <span>{video.likes || 0}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* VIEW: PLAYLISTS GENERAL INDEX */}
          {activeTab === 'playlists' && (
            <div className="space-y-6 animate-fade-in">
              <div className="border-b border-slate-500/10 pb-3 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className={`text-xl md:text-2xl font-black flex items-center gap-2 ${
                    theme === 'dark' ? 'text-cyan-400' : 'text-slate-900'
                  }`}>
                    <FolderHeart className={`w-5 h-5 ${theme === 'dark' ? 'text-cyan-400' : 'text-slate-700'}`} />
                    <span>Daftar Playlist Official & Pribadi</span>
                  </h2>
                  <p className="text-xs opacity-60">Mainkan maraton secara autoplay atau maraton manual sesuka hati.</p>
                </div>

                {currentUser && (
                  <button
                    onClick={() => navigateToTab('profile')}
                    className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all self-start md:self-auto"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Kelola Playlist di Profil</span>
                  </button>
                )}
              </div>

              {/* Official Playlists Grid */}
              <div className="space-y-4">
                <h3 className="text-sm md:text-base font-black text-pink-500 uppercase tracking-widest">&bull; Playlist Official Admin</h3>
                
                {playlists.filter(p => p.ownerId === null).length === 0 ? (
                  <p className="text-xs opacity-60 italic">Belum ada playlist official dari admin.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {playlists.filter(p => p.ownerId === null).map((pl) => (
                      <div
                        key={pl.id || pl._id}
                        className={`p-4 rounded-xl border flex flex-col justify-between gap-4 transition-all hover:border-cyan-500/20 ${
                          theme === 'dark' ? 'bg-[#0d0e1b] border-[#1e2038]' : 'bg-white border-slate-200'
                        }`}
                      >
                        <div className="space-y-1.5">
                          <h4 className={`font-extrabold text-sm md:text-base ${
                            theme === 'dark' ? 'text-slate-100' : 'text-slate-900'
                          }`}>{pl.title}</h4>
                          <span className="px-2 py-0.5 rounded text-[9px] font-black bg-cyan-500/20 text-cyan-400 uppercase tracking-wider">OFFICIAL PUBLIC</span>
                          <p className="text-xs opacity-60 pt-1">{pl.videoIds.length} video episode terurut.</p>
                        </div>
                        <button
                          onClick={() => startPlaylistPlayback(pl)}
                          className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-black font-extrabold text-xs rounded-lg flex items-center justify-center gap-1.5 shadow-md"
                          disabled={pl.videoIds.length === 0}
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Mulai Maraton Autoplay</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* User Private Playlists */}
              {currentUser && (
                <div className="space-y-4 pt-4 border-t border-slate-500/10">
                  <h3 className="text-sm md:text-base font-black text-purple-400 uppercase tracking-widest">&bull; Playlist Pribadi Anda</h3>
                  {playlists.filter(p => p.ownerId === currentUser.id).length === 0 ? (
                    <div className="text-center py-10 bg-slate-500/5 rounded-xl border border-dashed border-slate-500/20 text-xs">
                      <p className="opacity-60">Anda belum membuat playlist pribadi apa pun.</p>
                      <button onClick={() => navigateToTab('profile')} className="mt-2 text-cyan-400 font-bold underline">
                        Buat Playlist Pertama Anda &rarr;
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {playlists.filter(p => p.ownerId === currentUser.id).map((pl) => (
                        <div
                          key={pl.id}
                          className={`p-4 rounded-xl border flex flex-col justify-between gap-4 transition-all hover:border-purple-500/20 ${
                            theme === 'dark' ? 'bg-[#0d0e1b] border-[#1e2038]' : 'bg-white border-slate-200'
                          }`}
                        >
                          <div className="space-y-1.5">
                            <h4 className={`font-extrabold text-sm md:text-base ${
                              theme === 'dark' ? 'text-slate-100' : 'text-slate-900'
                            }`}>{pl.title}</h4>
                            <span className="px-2 py-0.5 rounded text-[9px] font-black bg-purple-500/20 text-purple-400 uppercase tracking-wider">PRIVATE PLAYLIST</span>
                            <p className="text-xs opacity-60 pt-1">{pl.videoIds.length} video episode tersimpan.</p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => startPlaylistPlayback(pl)}
                              className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs rounded-lg flex items-center justify-center gap-1.5 shadow-md"
                              disabled={pl.videoIds.length === 0}
                            >
                              <Play className="w-3.5 h-3.5 fill-current" />
                              <span>Mulai Maraton</span>
                            </button>
                            <button
                              onClick={() => handleDeletePlaylist(pl.id)}
                              className="px-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 hover:border-red-500/50 rounded-lg text-red-400 flex items-center justify-center"
                              title="Hapus Playlist"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* VIEW: DEDICATED VOTE PAGE */}
          {activeTab === 'vote' && (
            <div className="space-y-6 animate-fade-in">
              <div className="border-b border-slate-500/10 pb-3 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl md:text-2xl font-black text-pink-500 uppercase tracking-wider">PILIH ANIME NOSTALGIA SELANJUTNYA</h2>
                  <p className="text-xs opacity-60">Suarakan aspirasi Anda! Vote anime favorit masa kecil Anda untuk dirilis di ShinDora Nesub berikutnya.</p>
                </div>

                {currentUser ? (
                  <button
                    onClick={() => {
                      const hasActivePoll = pollingList.some(p => p.ownerId === currentUser.id && p.isActive)
                      if (hasActivePoll) {
                        alert("Anda sudah memiliki 1 vote yang sedang berjalan. Hapus atau tunggu vote Anda selesai untuk membuat vote baru.")
                      } else {
                        setShowUserPollModal(true)
                      }
                    }}
                    className="px-5 py-2.5 rounded-lg bg-pink-500 hover:bg-pink-600 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-md"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Buat Vote Baru (+)</span>
                  </button>
                ) : (
                  <button
                    onClick={() => alert('Silakan login terlebih dahulu untuk membuat voting kustom!')}
                    className="px-5 py-2.5 rounded-lg bg-slate-500/10 text-slate-400 border border-transparent font-bold text-xs"
                  >
                    Masuk Untuk Membuat Vote
                  </button>
                )}
              </div>

              {/* Grid cards of all voting topics */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {(() => {
                  const maxVotes = Math.max(...pollingList.map(p => p.options.reduce((sum, o) => sum + (o.votes || 0), 0)), 0);
                  const sortedList = [...pollingList].sort((a, b) => {
                    // Keep official polls first, then user requests sorted by votes descending
                    if (a.ownerId === null && b.ownerId !== null) return -1;
                    if (a.ownerId !== null && b.ownerId === null) return 1;
                    
                    const votesA = a.options.reduce((sum, o) => sum + (o.votes || 0), 0);
                    const votesB = b.options.reduce((sum, o) => sum + (o.votes || 0), 0);
                    return votesB - votesA;
                  });
                  return sortedList.map((poll) => {
                    const hasVotedOptionId = votedPollOptions[poll.id] || null
                    const totalVotes = poll.options.reduce((sum, o) => sum + (o.votes || 0), 0) || 0
                    const isUserOwned = currentUser && poll.ownerId === currentUser.id
                    const isUserRequest = poll.ownerId !== null
                    const isTopVoted = totalVotes === maxVotes && totalVotes > 0

                    return (
                      <div
                        key={poll.id}
                        className={`p-5 rounded-2xl border flex flex-col justify-between gap-4 shadow-xl ${
                          theme === 'dark' ? 'bg-[#0d0e1b] border-[#1e2038]' : 'bg-white border-slate-200'
                        }`}
                      >
                        <div className="space-y-4 w-full">
                          <div className="flex justify-between items-start gap-4">
                            <div>
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                                  poll.ownerId === null ? 'bg-cyan-500/20 text-cyan-400' : 'bg-pink-500/20 text-pink-500'
                                }`}>
                                  {poll.ownerId === null ? 'Official Vote' : 'Usulan Anime'}
                                </span>
                                {isTopVoted && (
                                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-gradient-to-r from-amber-500 via-orange-500 to-red-600 text-white shadow-md animate-pulse flex items-center gap-0.5">
                                    <span>🔥</span>
                                    <span>TOP VOTE</span>
                                  </span>
                                )}
                              </div>
                              <h3 className={`text-sm md:text-base font-black mt-1 leading-snug flex items-center gap-1.5 ${
                                theme === 'dark' ? 'text-slate-100' : 'text-slate-900'
                              }`}>
                                {isTopVoted && <span className="text-orange-500 text-lg flex-shrink-0 animate-bounce">🔥</span>}
                                <span>{poll.title}</span>
                              </h3>
                              <span className="text-[10px] opacity-50 font-bold block mt-1">Total: {totalVotes} dukungan &bull; Status: {poll.isActive ? 'Aktif' : 'Selesai'}</span>
                            </div>

                            {/* User custom delete button */}
                            {isUserOwned && (
                              <button
                                onClick={() => handleDeleteUserPoll(poll.id)}
                                className="px-2.5 py-1 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded text-red-400 text-[10px] font-bold"
                                title="Hapus usulan kustom saya"
                              >
                                Hapus
                              </button>
                            )}
                          </div>

                          {/* IF USER SINGLE ITEM REQUEST CARD */}
                          {isUserRequest ? (
                            (() => {
                              const opt = poll.options[0] || { id: 'opt-main', name: poll.title, votes: 0 };
                              const isOptionVoted = hasVotedOptionId === opt.id;
                              return (
                                <div className="space-y-3.5 pt-2 border-t border-slate-500/5 text-xs text-left">
                                  {(opt.releaseYear || opt.mediaType || opt.referenceLink || opt.reason) && (
                                    <div className={`p-3 rounded-xl border text-[11px] space-y-2 ${
                                      theme === 'dark' ? 'bg-black/20 border-[#1e2038]' : 'bg-slate-50 border-slate-200'
                                    }`}>
                                      <div className="flex items-center gap-3 font-extrabold">
                                        {opt.releaseYear && <span className="opacity-80">📅 {opt.releaseYear}</span>}
                                        {opt.mediaType && (
                                          <span className="px-2 py-0.5 rounded text-[10px] font-black bg-cyan-500/20 text-cyan-400 uppercase tracking-wider">
                                            {opt.mediaType}
                                          </span>
                                        )}
                                      </div>
                                      {opt.referenceLink && (
                                        <a
                                          href={opt.referenceLink}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-cyan-400 hover:underline block truncate font-bold"
                                        >
                                          🔗 Info/Referensi MyAnimeList/IMDb
                                        </a>
                                      )}
                                      {opt.reason && (
                                        <div className="opacity-80 border-t border-slate-500/5 pt-1.5 leading-relaxed">
                                          <p className="font-bold opacity-60 text-[9px] uppercase tracking-wide">Pesan / Alasan Pengajuan:</p>
                                          <p className="italic mt-0.5">&ldquo;{opt.reason}&rdquo;</p>
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {poll.isActive && !hasVotedOptionId && (
                                    <button
                                      onClick={() => handleCastVote(poll.id, opt.id)}
                                      className="w-full py-2.5 bg-pink-500 hover:bg-pink-600 text-white rounded-xl text-xs font-black shadow-md transition-all uppercase tracking-wider flex items-center justify-center gap-1"
                                    >
                                      <span>▲ DUKUNG / UPVOTE ANIME INI</span>
                                    </button>
                                  )}

                                  {isOptionVoted && (
                                    <div className="w-full py-2 bg-pink-500/20 text-pink-400 rounded-xl text-xs font-black text-center uppercase tracking-wider border border-pink-500/30">
                                      ✓ TELAH DIDUKUNG
                                    </div>
                                  )}
                                </div>
                              );
                            })()
                          ) : (
                            /* IF OFFICIAL MULTI-CHOICE POLL CARD */
                            <div className="space-y-3.5 pt-2 border-t border-slate-500/5">
                              {[...poll.options].sort((a, b) => (b.votes || 0) - (a.votes || 0)).map((opt) => {
                                const isOptionVoted = hasVotedOptionId === opt.id
                                const percentage = Math.round(((opt.votes || 0) / totalVotes) * 100)

                                return (
                                  <div key={opt.id} className="space-y-1.5 text-xs text-left">
                                    <div className="flex justify-between items-center gap-2">
                                      <div className="flex items-center gap-2.5">
                                        {opt.imageUrl && (
                                          <img src={opt.imageUrl} alt="" className="w-8 h-8 rounded-lg object-cover flex-shrink-0 border border-slate-500/10" />
                                        )}
                                        <span className={`font-extrabold ${
                                          theme === 'dark' ? 'text-slate-200' : 'text-slate-800'
                                        }`}>{opt.name}</span>
                                      </div>
                                      <span className="text-[10px] font-mono text-cyan-400 font-bold">{opt.votes || 0} votes ({percentage}%)</span>
                                    </div>

                                    <div className="w-full bg-slate-500/15 h-2 rounded-full overflow-hidden">
                                      <div 
                                        className="bg-gradient-to-r from-pink-500 to-purple-600 h-full transition-all duration-500"
                                        style={{ width: `${percentage}%` }}
                                      />
                                    </div>

                                    {poll.isActive && !hasVotedOptionId && (
                                      <button
                                        onClick={() => handleCastVote(poll.id, opt.id)}
                                        className="w-full py-1.5 bg-slate-500/10 hover:bg-cyan-500/20 text-cyan-400 hover:text-white rounded text-[10px] font-black border border-cyan-500/20 transition-all uppercase"
                                      >
                                        PILIH / VOTE
                                      </button>
                                    )}

                                    {isOptionVoted && (
                                      <div className="text-[9px] text-pink-400 font-black tracking-wide uppercase pt-1 text-right">★ Pilihan Anda</div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  });
                })()}
              </div>

              {/* USER CREATION POLL MODAL */}
              {showUserPollModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                  <div className={`rounded-2xl w-full max-w-lg p-6 relative space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto border ${
                    theme === 'dark' ? 'bg-[#0d0e1b] border-[#1e2038] text-slate-100' : 'bg-white border-slate-200 text-slate-900'
                  }`}>
                    <button
                      onClick={() => setShowUserPollModal(false)}
                      className={`absolute top-4 right-4 p-1.5 rounded transition-all text-xs font-black hover:bg-slate-500/10 ${
                        theme === 'dark' ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      &times; Tutup
                    </button>
                    <h3 className={`font-black text-base border-b pb-2 ${
                      theme === 'dark' ? 'text-white border-slate-500/10' : 'text-slate-900 border-slate-200'
                    }`}>
                      Buat Polling Anime Nostalgia Baru
                    </h3>

                    <form onSubmit={handleCreateUserPoll} className="space-y-4 text-xs text-left">
                      <div className="space-y-1">
                        <label className={`font-bold block text-xs ${
                          theme === 'dark' ? 'text-slate-200' : 'text-slate-800'
                        }`}>
                          Judul / Pertanyaan Polling
                        </label>
                        <input
                          type="text"
                          value={userPollForm.title}
                          onChange={(e) => setUserPollForm({ ...userPollForm, title: e.target.value })}
                          placeholder="Contoh: Tolong tayangkan Digimon Adventure dong!"
                          className={`w-full p-2.5 rounded outline-none border transition-all ${
                            theme === 'dark'
                              ? 'bg-[#121324] border-[#1e2038] text-white focus:border-cyan-500'
                              : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-cyan-500 focus:bg-white'
                          }`}
                          required
                        />
                      </div>

                      {/* Options fields */}
                      <div className={`space-y-4 pt-2 border-t ${
                        theme === 'dark' ? 'border-slate-500/10' : 'border-slate-200'
                      }`}>
                        <span className="font-black uppercase tracking-wider text-[9px] text-pink-500 block">Detail Pengajuan Usulan Anime</span>
                        
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className={`text-[10px] font-bold block ${
                              theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
                            }`}>
                              Tahun Rilis
                            </label>
                            <input
                              type="text"
                              value={userPollForm.releaseYear || ''}
                              onChange={(e) => setUserPollForm({ ...userPollForm, releaseYear: e.target.value })}
                              placeholder="Contoh: 1999"
                              className={`w-full p-2.5 rounded outline-none border transition-all ${
                                theme === 'dark'
                                  ? 'bg-[#121324] border-[#1e2038] text-white focus:border-cyan-500'
                                  : 'bg-white border-slate-200 text-slate-900 focus:border-cyan-500'
                              }`}
                              required
                            />
                          </div>

                          <div className="space-y-1">
                            <label className={`text-[10px] font-bold block ${
                              theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
                            }`}>
                              Tipe Media
                            </label>
                            <select
                              value={userPollForm.mediaType || 'TV Series'}
                              onChange={(e) => setUserPollForm({ ...userPollForm, mediaType: e.target.value })}
                              className={`w-full p-2.5 rounded outline-none border transition-all ${
                                theme === 'dark'
                                  ? 'bg-[#121324] border-[#1e2038] text-white focus:border-cyan-500'
                                  : 'bg-white border-slate-200 text-slate-900 focus:border-cyan-500'
                              }`}
                            >
                              <option value="TV Series">TV Series</option>
                              <option value="Movie">Movie</option>
                              <option value="OVA/Special">OVA/Special</option>
                            </select>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className={`text-[10px] font-bold block ${
                            theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
                          }`}>
                            Link Referensi MyAnimeList / IMDb (Opsional)
                          </label>
                          <input
                            type="url"
                            value={userPollForm.referenceLink || ''}
                            onChange={(e) => setUserPollForm({ ...userPollForm, referenceLink: e.target.value })}
                            placeholder="https://myanimelist.net/anime/..."
                            className={`w-full p-2.5 rounded outline-none border transition-all ${
                              theme === 'dark'
                                ? 'bg-[#121324] border-[#1e2038] text-white focus:border-cyan-500'
                                : 'bg-white border-slate-200 text-slate-900 focus:border-cyan-500'
                            }`}
                          />
                        </div>

                        <div className="space-y-1">
                          <label className={`text-[10px] font-bold block ${
                            theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
                          }`}>
                            Pesan / Alasan Pengajuan (Opsional)
                          </label>
                          <textarea
                            value={userPollForm.reason || ''}
                            onChange={(e) => setUserPollForm({ ...userPollForm, reason: e.target.value })}
                            placeholder="Mengapa Anda merekomendasikan anime ini?"
                            rows={3}
                            className={`w-full p-2.5 rounded outline-none border transition-all ${
                              theme === 'dark'
                                ? 'bg-[#121324] border-[#1e2038] text-white focus:border-cyan-500'
                                : 'bg-white border-slate-200 text-slate-900 focus:border-cyan-500'
                            }`}
                          />
                        </div>
                      </div>

                      <div className={`flex gap-2.5 pt-2 border-t ${
                        theme === 'dark' ? 'border-slate-500/10' : 'border-slate-200'
                      }`}>
                        <button type="submit" className="flex-1 py-2 bg-pink-500 hover:bg-pink-600 text-white font-extrabold rounded transition-all shadow-md">
                          Terbitkan Vote Saya
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowUserPollModal(false)}
                          className={`px-4 py-2 rounded font-extrabold transition-all border ${
                            theme === 'dark'
                              ? 'bg-slate-500/10 border-slate-500/15 text-slate-300 hover:bg-slate-500/20'
                              : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          Batal
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* VIEW: PROFILE */}
          {activeTab === 'profile' && currentUser && (
            <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
              <div className="border-b border-slate-500/10 pb-3">
                <h2 className={`text-xl md:text-2xl font-black ${
                  theme === 'dark' ? 'text-cyan-400' : 'text-slate-900'
                }`}>Profil Anggota Shindora</h2>
                <p className="text-xs opacity-60">Kelola foto profil Anda (maks 1 MB), info akun, dan playlist pribadi.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Profile Card & Avatar single Upload */}
                <div className={`p-6 rounded-2xl border text-center space-y-4 ${theme === 'dark' ? 'bg-[#0d0e1b] border-[#1e2038]' : 'bg-white border-slate-200'}`}>
                  
                  {/* Single Upload Avatar Component with live preview & validations */}
                  <div className="relative w-28 h-28 mx-auto group">
                    <img
                      src={avatarPreview || currentUser.avatarUrl}
                      alt={currentUser.name}
                      className="w-full h-full rounded-full object-cover border-4 border-purple-500/40 group-hover:opacity-75 transition-all shadow-xl"
                    />
                    
                    {/* Trigger file dialog overlay */}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-all text-white text-xs font-bold"
                    >
                      <Upload className="w-4 h-4 mr-1" />
                      <span>Ubah</span>
                    </button>
                    
                    {/* Hidden Native File Input */}
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleAvatarChange}
                      accept=".jpg,.jpeg,.png,.webp"
                      className="hidden"
                    />
                  </div>

                  {/* Progress Indicator */}
                  {uploadProgress !== null && (
                    <div className="w-full space-y-1">
                      <div className="w-full bg-slate-500/20 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-cyan-500 h-full transition-all" style={{ width: `${uploadProgress}%` }} />
                      </div>
                      <span className="text-[10px] text-cyan-400 font-bold">Mengompres & Mengupload ({uploadProgress}%)</span>
                    </div>
                  )}

                  <div className="space-y-1">
                    <h3 className={`font-extrabold ${
                      theme === 'dark' ? 'text-slate-100' : 'text-slate-900'
                    }`}>{currentUser.name}</h3>
                    <p className="text-xs opacity-60">{currentUser.email}</p>
                    <span className="inline-block px-2.5 py-0.5 mt-1 rounded text-[10px] font-black uppercase tracking-wider bg-purple-500/20 text-purple-400 border border-purple-500/30">
                      Role: {currentUser.role}
                    </span>
                  </div>

                  {/* Custom quick staff link inside card */}
                  {currentUser.role === 'moderator' && (
                    <a
                      href="/moderator"
                      className="block w-full py-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:opacity-90 text-black text-xs font-black rounded-lg transition-all text-center uppercase tracking-wider hidden md:block"
                    >
                      Masuk Panel Moderator
                    </a>
                  )}

                  {/* Mobile-only navigation and account management buttons */}
                  <div className="block md:hidden pt-4 border-t border-slate-500/10 space-y-2.5">
                    {/* Tombol Panel Admin */}
                    {(currentUser.role === 'admin' || currentUser.role === 'superadmin') && (
                      <a
                        href="/admin"
                        className="block w-full py-3 bg-gradient-to-r from-pink-600 to-purple-600 hover:opacity-95 text-white text-xs font-bold rounded-xl transition-all text-center uppercase tracking-wider shadow-lg flex items-center justify-center gap-1.5"
                      >
                        ⚙️ Panel Admin
                      </a>
                    )}

                    {/* Tombol Panel Staf */}
                    {(currentUser.role === 'admin' || currentUser.role === 'superadmin' || currentUser.role === 'moderator' || currentUser.role === 'staf' || currentUser.role === 'staff') && (
                      <a
                        href="/moderator"
                        className="block w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-500 hover:opacity-95 text-black text-xs font-bold rounded-xl transition-all text-center uppercase tracking-wider shadow-md flex items-center justify-center gap-1.5"
                      >
                        🛡️ Panel Staf
                      </a>
                    )}

                    {/* Tombol Keluar Akun (Logout) */}
                    <button
                      onClick={handleLogout}
                      className="block w-full py-3 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition-all text-center uppercase tracking-wider shadow-md flex items-center justify-center gap-1.5"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Keluar Akun</span>
                    </button>
                  </div>
                </div>

                {/* Playlist Manager in Profile Page */}
                <div className="md:col-span-2 space-y-4">
                  <div className={`p-6 rounded-2xl border space-y-4 ${theme === 'dark' ? 'bg-[#0d0e1b] border-[#1e2038]' : 'bg-white border-slate-200'}`}>
                    <h3 className={`font-extrabold text-sm md:text-base ${
                      theme === 'dark' ? 'text-cyan-400' : 'text-slate-900'
                    }`}>Buat Playlist Pribadi Baru</h3>
                    
                    <form onSubmit={handleCreatePlaylist} className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Nama playlist baru (misal: Maraton Shinchan)..."
                        value={newPlaylistTitle}
                        onChange={(e) => setNewPlaylistTitle(e.target.value)}
                        className={`flex-1 text-xs p-2.5 rounded-lg border outline-none ${
                          theme === 'dark' ? 'bg-[#121324] border-[#1e2038] text-white focus:border-cyan-500' : 'bg-slate-50 border-slate-200'
                        }`}
                        required
                      />
                      <button type="submit" className="px-5 bg-purple-600 hover:bg-purple-700 text-white font-extrabold rounded-lg text-xs flex items-center gap-1">
                        <Plus className="w-3.5 h-3.5" />
                        <span>Buat</span>
                      </button>
                    </form>
                  </div>

                  <div className={`p-6 rounded-2xl border space-y-4 ${theme === 'dark' ? 'bg-[#0d0e1b] border-[#1e2038]' : 'bg-white border-slate-200'}`}>
                    <h3 className="font-extrabold text-sm md:text-base text-purple-400">Kelola Playlist Pribadi Anda</h3>

                    <div className="space-y-3.5 max-h-[350px] overflow-y-auto">
                      {playlists.filter(p => p.ownerId === currentUser.id).length === 0 ? (
                        <p className="text-xs opacity-60 italic text-center py-4">Belum ada playlist pribadi. Silakan buat menggunakan form di atas!</p>
                      ) : (
                        playlists.filter(p => p.ownerId === currentUser.id).map((pl) => (
                          <div key={pl.id} className="p-3.5 rounded-xl border border-slate-500/10 space-y-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <h4 className={`font-extrabold text-xs md:text-sm ${
                                  theme === 'dark' ? 'text-slate-100' : 'text-slate-900'
                                }`}>{pl.title}</h4>
                                <span className="text-[10px] opacity-50">{pl.videoIds.length} video tersimpan</span>
                              </div>
                              <button
                                onClick={() => handleDeletePlaylist(pl.id)}
                                className="text-red-400 hover:text-red-500 p-1.5 rounded hover:bg-red-500/5 transition-all"
                                title="Hapus Playlist"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>

                            {/* Playlist inner content management list */}
                            {pl.videoIds.length > 0 && (
                              <div className="space-y-1.5 pt-1 border-t border-slate-500/5">
                                {pl.videoIds.map((vidId) => {
                                  const vid = videos.find(v => v.id === vidId)
                                  if (!vid) return null
                                  return (
                                    <div key={vidId} className="flex justify-between items-center text-xs p-1 rounded hover:bg-slate-500/5">
                                      <span className="truncate opacity-80">{vid.episode} &bull; {vid.title}</span>
                                      <button
                                        onClick={() => handleRemoveVideoFromPlaylist(pl.id, vidId)}
                                        className="text-slate-500 hover:text-red-400 font-extrabold"
                                        title="Keluarkan dari Playlist"
                                      >
                                        &times;
                                      </button>
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Banner Bagian Bawah / Di Atas Footer */}
          {renderAdSlot('banner_footer')}

        </main>
      </div>

      {/* GLOBAL AD SCRIPTS (Popunder, Direct link, Social Bar, Adsterra tags) */}
      <GlobalAdScripts ads={ads} />

      {/* FLOATING ADS (Sticky Bottom Bar, Skyscraper Left, Skyscraper Right) */}
      <FloatingAds ads={ads} theme={theme} />

      {/* 4. FOOTER */}
      <footer className={`border-t py-6 text-center text-xs opacity-50 mt-12 ${theme === 'dark' ? 'border-[#1e2038] bg-[#090a12]' : 'border-slate-200 bg-slate-50'} space-y-3`}>
        {staticPages && staticPages.filter(p => p.showInFooter).length > 0 && (
          <div className="flex flex-wrap justify-center gap-4 font-bold text-[10px] md:text-xs">
            {staticPages.filter(p => p.showInFooter).map(p => (
              <a key={p.id} href={`/page/${p.slug}`} className="hover:text-cyan-400 transition-all uppercase tracking-wider">
                {p.title}
              </a>
            ))}
          </div>
        )}
        <p>&copy; {new Date().getFullYear()} ShinDora Nesub &bull; Retro &amp; Nostalgia Anime Watch Platform.</p>
        <p className="mt-1 text-[10px]">Dibuat dengan sepenuh cinta demi melestarikan tontonan masa kecil hari Minggu.</p>
      </footer>

      {/* POP-UP / FLOATING BANNER AD SAWERIA */}
      {(() => {
        const ad = ads.find(a => a.slot === 'banner_popup' && a.isActive)
        if (!ad) return null
        return (
          <div className="fixed bottom-4 right-4 z-50 max-w-xs p-4 rounded-xl border border-pink-500/30 bg-[#0d0e1b]/95 shadow-2xl space-y-3 animate-bounce">
            <div className="flex items-center gap-3">
              {ad.imageUrl && <img src={ad.imageUrl} alt="" className="w-12 h-12 rounded object-cover flex-shrink-0" />}
              <div>
                <span className="text-[8px] uppercase tracking-wider text-pink-400 font-bold block">SPONSOR / PROMO</span>
                <p className="text-xs font-extrabold text-slate-100">{ad.title}</p>
              </div>
            </div>
            <a
              href={ad.targetUrl}
              target={ad.openInNewTab !== false ? "_blank" : "_self"}
              rel="noopener noreferrer"
              className="block w-full py-1.5 bg-pink-600 hover:bg-pink-700 text-white font-extrabold rounded text-xs text-center transition-all"
            >
              Lihat Promo
            </a>
          </div>
        )
      })()}

      {/* MODAL: ADD TO PLAYLIST SELECTOR */}
      {playlistSelectorVideo && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`rounded-2xl w-full max-w-md p-6 relative space-y-4 shadow-2xl border ${
            theme === 'dark' ? 'bg-[#0d0e1b] border-[#1e2038] text-slate-100' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <button
              onClick={() => setPlaylistSelectorVideo(null)}
              className={`absolute top-4 right-4 p-1 rounded text-xs font-black hover:bg-slate-500/10 ${
                theme === 'dark' ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              &times; Tutup
            </button>
            <div>
              <span className="text-[9px] font-black text-cyan-400 uppercase tracking-widest">TAMBAH KE PLAYLIST</span>
              <h3 className="font-extrabold text-sm line-clamp-1 mt-0.5">{playlistSelectorVideo.title}</h3>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pt-2 border-t border-slate-500/10">
              {playlists.filter(p => p.ownerId === currentUser?.id).length === 0 ? (
                <div className="text-center py-6 text-xs opacity-60">
                  <p>Anda belum memiliki playlist pribadi.</p>
                  <button
                    onClick={() => {
                      setPlaylistSelectorVideo(null)
                      navigateToTab('profile')
                    }}
                    className="text-cyan-400 font-bold underline mt-1 block w-full"
                  >
                    Buat Playlist Baru &rarr;
                  </button>
                </div>
              ) : (
                playlists.filter(p => p.ownerId === currentUser?.id).map((pl) => {
                  const isAdded = pl.videoIds.includes(playlistSelectorVideo.id)
                  return (
                    <div key={pl.id} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-500/5 text-xs">
                      <span className="font-bold truncate max-w-[200px]">{pl.title}</span>
                      {isAdded ? (
                        <button
                          onClick={() => handleRemoveVideoFromPlaylist(pl.id, playlistSelectorVideo.id)}
                          className="px-2.5 py-1 rounded bg-red-500/10 text-red-400 font-bold hover:bg-red-500/20 text-[10px]"
                        >
                          Hapus
                        </button>
                      ) : (
                        <button
                          onClick={() => handleAddVideoToPlaylist(pl.id, playlistSelectorVideo.id)}
                          className="px-2.5 py-1 rounded bg-cyan-500 text-black font-extrabold hover:bg-cyan-600 text-[10px]"
                        >
                          + Tambah
                        </button>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* OVERLAY NOTIFIKASI DONASI SAWERIA / WHITESPACE POPUP */}
      {activeOverlayDonation && (settings?.is_overlay_active !== undefined ? settings.is_overlay_active === true : settings?.donationOverlayActive !== false) && (
        <div className="fixed top-16 left-4 right-4 sm:left-auto sm:right-4 z-50 max-w-[92%] sm:max-w-sm w-full mx-auto sm:mx-0 p-4 rounded-2xl bg-gradient-to-r from-purple-900/90 via-pink-900/90 to-black/90 border-2 border-pink-500/50 text-white shadow-2xl animate-bounce flex items-center gap-3 backdrop-blur-md box-border">
          <div className="w-10 h-10 rounded-full bg-pink-500 flex items-center justify-center font-black text-xl flex-shrink-0 animate-pulse">
            💖
          </div>
          <div className="flex-1 min-w-0 overflow-hidden text-left">
            <span className="text-[9px] font-black text-pink-400 uppercase tracking-widest block">DUKUNGAN BARU {activeOverlayDonation.platform?.toUpperCase() || 'DONASI'}!</span>
            <p className="text-xs sm:text-sm font-black break-words leading-tight mt-0.5">
              {activeOverlayDonation.donatorName || 'Dermawan'} &bull; <span className="text-emerald-400">{activeOverlayDonation.amount || 'Rp 0'}</span>
            </p>
            {activeOverlayDonation.message && (
              <p className="text-[10px] sm:text-[11px] italic opacity-90 break-words leading-relaxed mt-1">&ldquo;{activeOverlayDonation.message}&rdquo;</p>
            )}
          </div>
        </div>
      )}

      {/* ADBLOCK DETECTED MODAL OVERLAY */}
      {adblockDetected && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full p-6 rounded-2xl bg-[#0d0e1b] border-2 border-red-500 text-center space-y-4 shadow-2xl">
            <div className="w-16 h-16 mx-auto rounded-full bg-red-500/20 text-red-500 flex items-center justify-center text-3xl font-black animate-pulse">
              🚫
            </div>
            <h3 className="text-lg font-black text-white">AdBlocker Terdeteksi!</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Mohon matikan ekstensi AdBlocker atau pemblokir iklan pada peramban Anda untuk terus menonton streaming anime nostalgia di <strong>ShinDora Nesub</strong>.
            </p>
            <p className="text-[11px] text-slate-400">
              Dukungan iklan sangat membantu kami menjaga server tetap beroperasi gratis untuk seluruh penggemar.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black text-xs uppercase tracking-wider shadow-lg transition-all"
            >
              Saya Sudah Mematikan AdBlocker (Muat Ulang)
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
