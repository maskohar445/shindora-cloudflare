'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Tv, ListVideo, Play, ChevronRight, Sun, Moon } from 'lucide-react'
import AdSlotContainer from '@/components/AdSlotContainer'
import FloatingAds from '@/components/FloatingAds'
import GlobalAdScripts from '@/components/GlobalAdScripts'

const parseEpisodeNumber = (episodeStr) => {
  if (!episodeStr) return 0;
  const match = episodeStr.match(/\d+(\.\d+)?/);
  return match ? parseFloat(match[0]) : 0;
}

export default function PutarManualPage() {
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

  const [theme, setTheme] = useState('light')
  const [isMounted, setIsMounted] = useState(false)
  const [videos, setVideos] = useState([])
  const [activeVideo, setActiveVideo] = useState(null)
  const [categories, setCategories] = useState([])
  const [expandedPaths, setExpandedPaths] = useState({})
  const [settings, setSettings] = useState(null)
  const [ads, setAds] = useState([])

  const [activeServer, setActiveServer] = useState(1)

  const activeVideoRef = useRef(activeVideo);
  const videosRef = useRef(videos);

  useEffect(() => {
    activeVideoRef.current = activeVideo;
  }, [activeVideo]);

  useEffect(() => {
    videosRef.current = videos;
  }, [videos]);

  const cleanCategoryName = (name) => {
    if (!name) return '';
    let cleaned = String(name).trim();
    while (/^(↳+|i,\s*|,+\s*|i\s+|[↳\s\u00A0]+)/i.test(cleaned)) {
      cleaned = cleaned.replace(/^(↳+|i,\s*|,+\s*|i\s+|[↳\s\u00A0]+)/i, '').trim();
    }
    return cleaned;
  };

  const togglePath = (path) => {
    setExpandedPaths(prev => ({ ...prev, [path]: !prev[path] }))
  }

  const getVideoCategoryString = (v) => {
    if (!v) return '';
    const parts = [];
    if (v.animeTitle) parts.push(cleanCategoryName(v.animeTitle));
    if (v.subCategory) parts.push(cleanCategoryName(v.subCategory));
    if (v.subCategory2) parts.push(cleanCategoryName(v.subCategory2));
    return parts.join(' > ');
  };

  const sortEpisodes = (vids) => {
    return [...vids].sort((a, b) => {
      const numA = parseEpisodeNumber(a.episode)
      const numB = parseEpisodeNumber(b.episode)
      return numA - numB
    });
  };

  const getCurrentPlaylist = (video) => {
    if (!video || !videos) return [];
    const targetMain = cleanCategoryName(video.animeTitle);
    const targetSub = cleanCategoryName(video.subCategory);
    const targetSub2 = cleanCategoryName(video.subCategory2);

    return videos
      .filter(v => {
        return cleanCategoryName(v.animeTitle) === targetMain &&
               cleanCategoryName(v.subCategory) === targetSub &&
               cleanCategoryName(v.subCategory2) === targetSub2;
      })
      .sort((a, b) => {
        const numA = parseEpisodeNumber(a.episode);
        const numB = parseEpisodeNumber(b.episode);
        return numA - numB;
      });
  };

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

  const getPrevEpisode = () => {
    if (!activeVideo || !videos || videos.length === 0) return null
    const sorted = getCurrentPlaylist(activeVideo)
    const currentIndex = sorted.findIndex(v => v.id === activeVideo.id)
    if (currentIndex > 0) {
      return sorted[currentIndex - 1]
    }
    return null
  }

  const getNextEpisode = () => {
    if (!activeVideo || !videos || videos.length === 0) return null
    const sorted = getCurrentPlaylist(activeVideo)
    const currentIndex = sorted.findIndex(v => v.id === activeVideo.id)
    if (currentIndex >= 0 && currentIndex < sorted.length - 1) {
      return sorted[currentIndex + 1]
    }
    return null
  }

  const getNextEpisodeRef = () => {
    if (!activeVideoRef.current || !videosRef.current || videosRef.current.length === 0) return null;
    const sorted = getCurrentPlaylist(activeVideoRef.current);
    const currentIndex = sorted.findIndex(v => v.id === activeVideoRef.current.id);
    if (currentIndex >= 0 && currentIndex < sorted.length - 1) {
      return sorted[currentIndex + 1];
    }
    return null;
  };

  const getEmbedUrl = (video) => {
    if (!video) return ''
    let url = video.videoUrl
    if (activeServer === 2 && video.videoUrl2) {
      url = video.videoUrl2
    } else if (activeServer === 3 && video.videoUrl3) {
      url = video.videoUrl3
    }
    return `${url}${url?.includes('?') ? '&' : '?'}autoplay=1`
  }

  const getActiveServerUrl = (video) => {
    if (!video) return ''
    let url = video.videoUrl
    if (activeServer === 2 && video.videoUrl2) {
      url = video.videoUrl2
    } else if (activeServer === 3 && video.videoUrl3) {
      url = video.videoUrl3
    }
    return url || ''
  }

  // Ok.ru Player API & PostMessage autoplay listener for putar-manual (Stable against closures)
  useEffect(() => {
    const handleMessage = (event) => {
      const isVideoEnded = 
          event.data === 'SHINDORA_AUTOPLAY' || 
          event.data === 'complete' || 
          event.data?.event === 'complete' || 
          event.data?.event === 'api.video.ended' ||
          event.data === 'api.video.ended' ||
          event.data?.event === 'SHINDORA_VIDEO_ENDED' ||
          event.data === 'SHINDORA_VIDEO_ENDED' ||
          event.data?.method === 'api.video.ended' ||
          event.data?.type === 'api.video.ended' ||
          event.data === 'ended' ||
          event.data?.event === 'ended' ||
          event.data === 'sibnet_video_ended' ||
          event.data === 'video_ended' ||
          event.data?.message === 'ended' ||
          event.data?.message === 'complete';

      if (isVideoEnded) {
        console.log('[PostMessage PutarManual] Video ended event received. Jumper next!')
        const nextVideo = getNextEpisodeRef()
        if (nextVideo) {
          setActiveVideo(nextVideo)
          setActiveServer(1)
        }
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.title = 'Daftar Episode ShinDora - ShinDora Nesub'
    }
    const savedTheme = localStorage.getItem('shindora-theme') || localStorage.getItem('theme') || 'light'
    setTheme(savedTheme)
    setIsMounted(true)
    document.documentElement.classList.toggle('dark', savedTheme === 'dark')

    fetchVideos()
    fetchSettings()
    fetchAds()
  }, [])

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings')
      if (!res.ok) throw new Error('Gagal memuat pengaturan website')
      const data = await res.json()
      setSettings(data)
    } catch (err) {
      console.error(err)
    }
  }

  const fetchAds = async () => {
    try {
      const res = await fetch('/api/ads')
      if (!res.ok) throw new Error('Gagal memuat iklan')
      const data = await res.json()
      setAds(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error(err)
    }
  }

  const renderAdSlot = (slotName) => {
    const matchingAds = ads.filter(a => a.slot === slotName && a.isActive)
    if (matchingAds.length === 0) return null
    return (
      <div className="w-full flex flex-col gap-3 my-3">
        {matchingAds.map((ad, idx) => (
          <AdSlotContainer key={ad.id || ad._id || `${slotName}-${idx}`} ad={ad} theme={theme} />
        ))}
      </div>
    )
  }

  // GLOBAL HEAD AD SCRIPTS INJECTOR HOOK (With head cleanup memory leak safeguard)
  useEffect(() => {
    if (!settings || !settings.globalHeadScripts) return;

    const exist = document.querySelectorAll('.dynamic-global-head-script');
    exist.forEach(el => el.remove());

    const temp = document.createElement('div');
    temp.innerHTML = settings.globalHeadScripts;

    const others = temp.querySelectorAll('link, style, meta, font');
    others.forEach(oth => {
      const cloned = oth.cloneNode(true);
      cloned.className = 'dynamic-global-head-script';
      document.head.appendChild(cloned);
    });

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

    return () => {
      const injected = document.querySelectorAll('.dynamic-global-head-script');
      injected.forEach(el => el.remove());
    };
  }, [settings]);

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
          console.warn('[Views Increment] Error:', err);
        }
      };
      const t = setTimeout(incrementViews, 1000);
      return () => clearTimeout(t);
    }
  }, [activeVideo?.id]);

  const fetchVideos = async () => {
    try {
      const res = await fetch('/api/videos')
      if (!res.ok) throw new Error('Gagal memuat video')
      const data = await res.json()
      if (Array.isArray(data)) {
        setVideos(data)
        setExpandedPaths(prev => {
          if (Object.keys(prev).length === 0) {
            return {
              'TV SERIES': true,
              'TV SERIES > DORAEMON': true,
              'TV SERIES > DORAEMON > 1992': true,
              'MOVIE': true
            }
          }
          return prev
        })
      }
      
      const catRes = await fetch('/api/categories')
      if (catRes.ok) {
        const catData = await catRes.json()
        if (Array.isArray(catData)) {
          setCategories(catData)
        }
      }
    } catch (err) {
      console.warn('fetchVideos error:', err)
    }
  }

  const handleToggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(nextTheme)
    localStorage.setItem('shindora-theme', nextTheme)
    localStorage.setItem('theme', nextTheme)
    document.documentElement.classList.toggle('dark', nextTheme === 'dark')
  }

  const isDarkMode = isMounted && theme === 'dark'

  return (
    <div 
      suppressHydrationWarning 
      className={`min-h-screen transition-colors duration-150 ${
        isDarkMode ? 'bg-[#0a0b14] text-[#e2e8f0]' : 'bg-[#f8fafc] text-slate-900'
      }`}
    >
      
      {/* HEADER */}
      <header 
        suppressHydrationWarning
        className={`border-b px-4 py-3 sticky top-0 z-40 backdrop-blur-md transition-colors duration-150 ${
          isDarkMode ? 'bg-[#0d0e1b]/95 border-[#1e2038]' : 'bg-white/95 border-slate-200'
        }`}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="p-1.5 rounded-lg border hover:bg-slate-500/5 transition-all text-xs font-bold flex items-center gap-1">
              &larr; Kembali ke Beranda
            </Link>
            <div className="flex items-center gap-2">
              <div className="p-1 bg-purple-600 rounded text-white font-black text-xs">DE</div>
              <span className="font-extrabold tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-500 text-sm md:text-base">
                DAFTAR EPISODE SHINDORA
              </span>
            </div>
          </div>

          <button
            onClick={handleToggleTheme}
            className={`p-2 rounded-full transition-all ${
              isDarkMode
                ? 'hover:bg-[#1a1c32] text-yellow-400' 
                : 'hover:bg-slate-100 text-slate-700'
            }`}
          >
            {isMounted ? (
              theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />
            ) : (
              <div className="w-5 h-5" />
            )}
          </button>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
        
        {/* Banner info */}
        <div className="p-5 rounded-2xl border border-purple-500/20 bg-purple-500/5 space-y-2">
          <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 text-[10px] font-black uppercase tracking-wider">Katalog Lengkap</span>
          <h2 className="text-xl font-bold flex items-center gap-1.5">
            <ListVideo className="w-5 h-5 text-purple-400" />
            <span>Katalog Daftar Episode</span>
          </h2>
          <p className={`text-xs leading-relaxed max-w-3xl ${
            isDarkMode ? 'text-slate-300 opacity-70' : 'text-slate-700 font-medium'
          }`}>
            Jelajahi dan pilih seluruh daftar episode anime retro favorit Anda secara lengkap dan terstruktur.
          </p>
        </div>

        {/* STANDALONE PLAYER AREA */}
        {activeVideo && (
          <div className="space-y-4 animate-fade-in max-w-4xl mx-auto">
            {renderAdSlot('banner_above_playlist')}
            <div className="relative border-4 border-[#1e2038] rounded-2xl overflow-hidden bg-black aspect-video shadow-2xl">
              {/* CRT Glass Scanlines */}
              <div className="absolute inset-0 pointer-events-none z-10 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%)] bg-[size:100%_4px] opacity-10" />
              {activeServer === 1 ? (
                <iframe
                  src={getEmbedUrl(activeVideo)}
                  title={activeVideo.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope"
                  allowFullScreen
                  scrolling="no"
                  className="w-full h-full border-0 relative z-0"
                />
              ) : (() => {
                const currentStream = getActiveServerUrl(activeVideo);
                if (!currentStream) {
                  return (
                    <div className="w-full h-full flex items-center justify-center text-xs opacity-50 text-white">
                      Aliran video tidak tersedia.
                    </div>
                  );
                }

                const isRawIframe = currentStream.trim().startsWith('<iframe') || currentStream.toLowerCase().includes('<iframe');
                
                if (isRawIframe) {
                  let processed = currentStream
                    .replace(/width=["']\d+["']/gi, 'width="100%"')
                    .replace(/height=["']\d+["']/gi, 'height="100%"');
                  
                  if (processed.includes('class=')) {
                    processed = processed.replace(/class=["']([^"']+)["']/i, 'class="$1 w-full h-full border-0 relative z-0"');
                  } else {
                    processed = processed.replace(/<iframe/i, '<iframe class="w-full h-full border-0 relative z-0"');
                  }

                  return (
                    <div 
                      className="w-full h-full"
                      dangerouslySetInnerHTML={{ __html: processed }}
                    />
                  );
                } else {
                  const finalUrl = currentStream.includes('autoplay') ? currentStream : `${currentStream}${currentStream.includes('?') ? '&' : '?'}autoplay=1&mute=0`;
                  const isEmbedUrl = finalUrl.includes('youtube.com/embed') || finalUrl.includes('ok.ru/video') || finalUrl.includes('drive.google.com') || finalUrl.includes('sibnet.ru') || finalUrl.includes('embed');
                  
                  if (isEmbedUrl) {
                    return (
                      <iframe
                        src={finalUrl}
                        title={activeVideo.title}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        scrolling="no"
                        className="w-full h-full border-0 relative z-0"
                      />
                    );
                  } else {
                    return (
                      <video
                        src={currentStream}
                        controls
                        autoPlay
                        className="w-full h-full relative z-0 object-contain bg-black"
                        playsInline
                        onEnded={() => {
                          console.log('[HTML5 Video PutarManual] Ended. Trigger next!')
                          const nextVid = getNextEpisodeRef()
                          if (nextVid) {
                            setActiveVideo(nextVid)
                            setActiveServer(1)
                          }
                        }}
                      />
                    );
                  }
                }
              })()}
            </div>

            {/* MULTI-SERVER STREAM SWITCHER */}
            <div className={`p-3 rounded-xl border flex flex-wrap items-center justify-between gap-3 ${
              isDarkMode ? 'bg-[#0d0e1b] border-[#1e2038]' : 'bg-white border-slate-200'
            }`}>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-black text-pink-500 tracking-wider">PILIH SERVER ALIRAN (STREAM SWITCHER):</span>
              </div>
              <div className="flex items-center gap-1.5">
                {[
                  { id: 1, label: 'Server 1 - Utama' },
                  { id: 2, label: 'Server 2 - HD' },
                  { id: 3, label: 'Server 3 - Cadangan' }
                ].map((srv) => {
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
                            ? isDarkMode
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

            {/* Video Info & Navigations Card */}
            <div className="p-4 rounded-xl bg-slate-500/5 border border-slate-500/10 flex flex-col gap-4">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <span className="text-[10px] bg-purple-500/20 text-purple-400 font-bold px-2 py-0.5 rounded uppercase">{getVideoCategoryString(activeVideo)} &bull; {activeVideo.episode}</span>
                  <h3 className={`font-extrabold text-sm md:text-base mt-1.5 ${
                    isDarkMode ? 'text-white' : 'text-slate-900'
                  }`}>{activeVideo.title}</h3>
                  <p className="text-xs opacity-75 mt-1 leading-relaxed">{activeVideo.description}</p>
                </div>
                <button
                  onClick={() => setActiveVideo(null)}
                  className="px-4 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white font-black text-xs transition-all self-stretch md:self-auto text-center"
                >
                  Tutup Pemutar
                </button>
              </div>

              {renderAdSlot('banner_below_player')}

              {/* EPISODE NAVIGATION BUTTONS ROW */}
              <div className="grid grid-cols-2 gap-2 w-full pt-2 border-t border-slate-500/10">
                <button
                  onClick={() => {
                    const prevVideo = getPrevEpisode()
                    if (prevVideo) {
                      setActiveVideo(prevVideo)
                      setActiveServer(1)
                    }
                  }}
                  disabled={!getPrevEpisode()}
                  className={`flex items-center justify-center gap-1 py-2 px-3 rounded-xl text-xs font-black transition-all border ${
                    getPrevEpisode()
                      ? 'bg-purple-500/10 border-purple-500/30 text-purple-400 hover:bg-purple-500/20'
                      : 'opacity-40 cursor-not-allowed border-transparent text-slate-500 bg-slate-500/5'
                  }`}
                  title="Tonton Episode Sebelumnya"
                >
                  <span>&larr; Eps Sebelumnya</span>
                </button>

                <button
                  onClick={() => {
                    const nextVideo = getNextEpisode()
                    if (nextVideo) {
                      setActiveVideo(nextVideo)
                      setActiveServer(1)
                    }
                  }}
                  disabled={!getNextEpisode()}
                  className={`flex items-center justify-center gap-1 py-2 px-3 rounded-xl text-xs font-black transition-all border ${
                    getNextEpisode()
                      ? 'bg-purple-500/10 border-purple-500/30 text-purple-400 hover:bg-purple-500/20'
                      : 'opacity-40 cursor-not-allowed border-transparent text-slate-500 bg-slate-500/5'
                  }`}
                  title="Tonton Episode Selanjutnya"
                >
                  <span>Eps Selanjutnya &rarr;</span>
                </button>
              </div>

              {/* DAFTAR TOMBOL EPISODE BERURUTAN */}
              <div className="pt-3 border-t border-slate-500/10 space-y-2">
                <span className="text-[10px] uppercase font-black tracking-wider opacity-60">Daftar Episode ({getVideoCategoryString(activeVideo)}):</span>
                <div className="flex flex-wrap gap-1.5 max-h-[180px] overflow-y-auto pr-1">
                  {getCurrentPlaylist(activeVideo).map((epVid) => {
                    const isActive = epVid.id === activeVideo.id;
                    const rawValue = String(epVid.episode || "").trim();
                    const cleanNumber = rawValue.replace(/^EPS\s*/i, "");
                    
                    return (
                      <button
                        key={epVid.id}
                        onClick={() => {
                          setActiveVideo(epVid);
                          setActiveServer(1);
                        }}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                          isActive
                            ? "bg-pink-500 border-pink-600 text-white shadow-md font-extrabold"
                            : isDarkMode
                              ? "bg-[#121324] hover:bg-[#1a1c32] border-[#1e2038] text-slate-300"
                              : "bg-white hover:bg-slate-100 border-slate-200 text-slate-700"
                        }`}
                      >
                        {cleanNumber || "1"}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CATALOGUE GROUPED BY ANIME TITLE (3-LEVEL DYNAMIC CATEGORIES TREE) */}
        <div className="space-y-4">
          {(() => {
            // Helper to get Level 1 categories (with name cleaning)
            const mainCats = categories.filter(c => !c.parent_id || c.parent_id === 'none');
            const mainCatNames = new Set(mainCats.map(c => cleanCategoryName(c.name).toUpperCase()));
            const extraMainNames = [...new Set(videos.map(v => cleanCategoryName(v.animeTitle)))].filter(
              name => name && !mainCatNames.has(name.toUpperCase())
            );

            // Group all videos by: animeTitle -> subCategory -> subCategory2
            // To present them precisely as Kategori Utama -> Sub-Kategori 1 -> Sub-Kategori 2
            const tree = {};
            
            videos.forEach(v => {
              const main = cleanCategoryName(v.animeTitle) || 'LAIN-LAIN';
              const sub1 = cleanCategoryName(v.subCategory || v.subCategory1 || v.sub_category_1 || v.sub_category || '');
              const sub2 = cleanCategoryName(v.subCategory2 || v.sub_category_2 || '');

              if (!tree[main]) {
                tree[main] = {
                  episodes: [],
                  subs: {}
                };
              }

              if (!sub1) {
                tree[main].episodes.push(v);
              } else {
                if (!tree[main].subs[sub1]) {
                  tree[main].subs[sub1] = {
                    episodes: [],
                    subs: {}
                  };
                }

                if (!sub2) {
                  tree[main].subs[sub1].episodes.push(v);
                } else {
                  if (!tree[main].subs[sub1].subs[sub2]) {
                    tree[main].subs[sub1].subs[sub2] = {
                      episodes: []
                    };
                  }
                  tree[main].subs[sub1].subs[sub2].episodes.push(v);
                }
              }
            });

            return Object.keys(tree).map((mainName) => {
              const mainData = tree[mainName];
              const path1 = mainName;
              const isExpanded1 = expandedPaths[path1] || false;

              // Total episodes under this main category
              const countAllEpisodes = (node) => {
                if (!node) return 0;
                let count = (node.episodes || []).length;
                if (node.subs) {
                  Object.keys(node.subs).forEach(k => {
                    count += countAllEpisodes(node.subs[k]);
                  });
                }
                return count;
              };
              const totalEpisodesCount = countAllEpisodes(mainData);

              return (
                <div 
                  key={`main-${mainName}`} 
                  className={`rounded-xl border overflow-hidden transition-colors duration-150 ${
                    isDarkMode ? 'border-[#1e2038] bg-[#0d0e1b]' : 'border-slate-200 bg-white'
                  }`}
                >
                  {/* Level 1 Accordion Header */}
                  <button
                    onClick={() => togglePath(path1)}
                    className="w-full flex items-center justify-between p-4 text-left transition-all hover:bg-slate-500/5"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">📁</span>
                      <span className={`font-extrabold text-sm md:text-base uppercase tracking-wide ${
                        isDarkMode ? 'text-slate-100' : 'text-slate-900'
                      }`}>
                        {mainName}
                      </span>
                      <span className="text-[10px] bg-slate-500/15 px-2 py-0.5 rounded-full opacity-70 font-semibold">
                        {totalEpisodesCount} Episode
                      </span>
                    </div>
                    <span className={`text-xs opacity-60 transition-transform duration-300 ${isExpanded1 ? 'rotate-90' : ''}`}>
                      &bull;&bull;&bull;
                    </span>
                  </button>

                  {/* Level 1 Accordion Content */}
                  {isExpanded1 && (
                    <div className={`p-4 border-t space-y-4 animate-fade-in ${
                      isDarkMode ? 'border-[#1e2038] bg-black/20' : 'border-slate-100 bg-slate-50/50'
                    }`}>

                      {/* Level 2 Sub-Categories */}
                      {Object.keys(mainData.subs).map((sub1Name) => {
                        const sub1Data = mainData.subs[sub1Name];
                        const path2 = `${path1} > ${sub1Name}`;
                        const isExpanded2 = expandedPaths[path2] || false;
                        const sub1EpisodesCount = countAllEpisodes(sub1Data);

                        return (
                          <div 
                            key={`sub1-${sub1Name}`} 
                            className={`ml-4 md:ml-6 rounded-lg border overflow-hidden transition-colors duration-150 ${
                              isDarkMode ? 'border-[#232644] bg-[#101126]' : 'border-slate-200 bg-white shadow-sm'
                            }`}
                          >
                            {/* Level 2 Header */}
                            <button
                              onClick={() => togglePath(path2)}
                              className="w-full flex items-center justify-between p-3 text-left transition-all hover:bg-slate-500/5"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-lg">📂</span>
                                <span className={`font-bold text-xs md:text-sm uppercase tracking-wide ${
                                  isDarkMode ? 'text-slate-200' : 'text-slate-800'
                                }`}>
                                  {sub1Name}
                                </span>
                                <span className="text-[9px] bg-slate-500/20 px-1.5 py-0.5 rounded-full opacity-70">
                                  {sub1EpisodesCount} Episode
                                </span>
                              </div>
                              <span className={`text-[10px] opacity-60 transition-transform duration-300 ${isExpanded2 ? 'rotate-90' : ''}`}>
                                &bull;&bull;&bull;
                              </span>
                            </button>

                            {/* Level 2 Content */}
                            {isExpanded2 && (
                              <div className={`p-3 border-t space-y-3 ${
                                isDarkMode ? 'border-[#232644] bg-black/10' : 'border-slate-100 bg-slate-50/20'
                              }`}>

                                {/* Level 3 Sub-Categories (Sub-Category Level 2) */}
                                {Object.keys(sub1Data.subs).map((sub2Name) => {
                                  const sub2Data = sub1Data.subs[sub2Name];
                                  const path3 = `${path2} > ${sub2Name}`;
                                  const isExpanded3 = expandedPaths[path3] || false;
                                  const level3Episodes = sortEpisodes(sub2Data.episodes);

                                  return (
                                    <div 
                                      key={`sub2-${sub2Name}`} 
                                      className={`ml-4 md:ml-6 rounded-md border overflow-hidden transition-colors duration-150 ${
                                        isDarkMode ? 'border-[#2b2d5a] bg-[#141635]' : 'border-slate-100 bg-slate-50'
                                      }`}
                                    >
                                      {/* Level 3 Header (Clean of dummy labels) */}
                                      <button
                                        onClick={() => togglePath(path3)}
                                        className="w-full flex items-center justify-between p-2.5 text-left transition-all hover:bg-slate-500/5"
                                      >
                                        <div className="flex items-center gap-2">
                                          <span className="text-md">📁</span>
                                          <span className={`font-semibold text-xs uppercase tracking-wide ${
                                            isDarkMode ? 'text-slate-300' : 'text-slate-700'
                                          }`}>
                                            {sub2Name}
                                          </span>
                                          <span className="text-[8px] bg-slate-500/20 px-1.5 py-0.5 rounded-full opacity-70">
                                            {level3Episodes.length} Episode
                                          </span>
                                        </div>
                                        <span className={`text-[10px] opacity-60 transition-transform duration-300 ${isExpanded3 ? 'rotate-90' : ''}`}>
                                          &bull;&bull;&bull;
                                        </span>
                                      </button>

                                      {/* Level 3 Content - Episode Buttons Grid */}
                                      {isExpanded3 && (
                                        <div className={`p-3 border-t ${
                                          isDarkMode ? 'border-[#2b2d5a] bg-black/10' : 'border-slate-100'
                                        }`}>
                                          {level3Episodes.length === 0 ? (
                                            <p className="text-[10px] opacity-50 italic py-1">Belum ada episode.</p>
                                          ) : (
                                            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-1.5">
                                              {level3Episodes.map((video) => {
                                                const isPlaying = activeVideo && activeVideo.id === video.id
                                                const rawValue = String(video.episode || "").trim();
                                                const cleanNumber = rawValue.replace(/^EPS\s*/i, "");

                                                return (
                                                  <button
                                                    key={video.id}
                                                    data-testid="episode-select-btn"
                                                    onClick={() => {
                                                      setActiveVideo(video)
                                                      setActiveServer(1)
                                                      window.scrollTo({ top: 120, behavior: "smooth" })
                                                    }}
                                                    className={`px-2.5 py-1.5 text-xs font-bold rounded border text-center transition-all cursor-pointer ${
                                                      isPlaying
                                                        ? "bg-pink-500 border-pink-600 text-white font-extrabold shadow-md"
                                                        : isDarkMode 
                                                          ? "bg-[#181a3a] hover:bg-[#20234a] border-[#2b2d5a] text-slate-300" 
                                                          : "bg-white hover:bg-slate-100 border-slate-200 text-slate-700"
                                                    }`}
                                                    title={video.title}
                                                  >
                                                    {cleanNumber || "1"}
                                                  </button>
                                                )
                                              })}
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}

                                {/* Direct Episodes under Level 2 */}
                                {sub1Data.episodes.length > 0 && (
                                  <div className="space-y-1.5 mt-2">
                                    {Object.keys(sub1Data.subs).length > 0 && (
                                      <span className="text-[9px] uppercase font-black tracking-wider opacity-60 ml-1">Episode Lainnya:</span>
                                    )}
                                    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-1.5">
                                      {sortEpisodes(sub1Data.episodes).map((video) => {
                                        const isPlaying = activeVideo && activeVideo.id === video.id
                                        const rawValue = String(video.episode || "").trim();
                                        const cleanNumber = rawValue.replace(/^EPS\s*/i, "");

                                        return (
                                          <button
                                            key={video.id}
                                            data-testid="episode-select-btn"
                                            onClick={() => {
                                              setActiveVideo(video)
                                              setActiveServer(1)
                                              window.scrollTo({ top: 120, behavior: "smooth" })
                                            }}
                                            className={`px-2.5 py-1.5 text-xs font-bold rounded border text-center transition-all cursor-pointer ${
                                              isPlaying
                                                ? "bg-pink-500 border-pink-600 text-white font-extrabold shadow-md"
                                                : isDarkMode 
                                                  ? "bg-[#181a3a] hover:bg-[#20234a] border-[#2b2d5a] text-slate-300" 
                                                  : "bg-white hover:bg-slate-100 border-slate-200 text-slate-700"
                                            }`}
                                            title={video.title}
                                          >
                                            {cleanNumber || "1"}
                                          </button>
                                        )
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* Direct Episodes under Level 1 */}
                      {mainData.episodes.length > 0 && (
                        <div className="space-y-2 mt-2">
                          {Object.keys(mainData.subs).length > 0 && (
                            <span className="text-[10px] uppercase font-black tracking-wider opacity-60 ml-1 block">Episode Tanpa Sub-Kategori:</span>
                          )}
                          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-1.5">
                            {sortEpisodes(mainData.episodes).map((video) => {
                              const isPlaying = activeVideo && activeVideo.id === video.id
                              const rawValue = String(video.episode || "").trim();
                              const cleanNumber = rawValue.replace(/^EPS\s*/i, "");

                              return (
                                <button
                                  key={video.id}
                                  data-testid="episode-select-btn"
                                  onClick={() => {
                                    setActiveVideo(video)
                                    setActiveServer(1)
                                    window.scrollTo({ top: 120, behavior: "smooth" })
                                  }}
                                  className={`px-2.5 py-1.5 text-xs font-bold rounded border text-center transition-all cursor-pointer ${
                                    isPlaying
                                      ? "bg-pink-500 border-pink-600 text-white font-extrabold shadow-md"
                                      : isDarkMode 
                                        ? "bg-[#121324] hover:bg-[#1a1c32] border-[#1e2038] text-slate-300" 
                                        : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700"
                                  }`}
                                  title={video.title}
                                >
                                  {cleanNumber || "1"}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            });
          })()}
        </div>
          {renderAdSlot('banner_footer')}
        </main>

        <FloatingAds ads={ads} theme={isDarkMode ? 'dark' : 'light'} />
        <GlobalAdScripts ads={ads} />

        <footer className={`border-t py-6 text-center text-xs opacity-50 mt-12 transition-colors duration-150 ${
          isDarkMode ? 'bg-[#090a12] border-[#1e2038]' : 'bg-slate-100 border-slate-200'
        }`}>
          <p>&copy; ShinDora Nesub Daftar Episode &bull; Retro &amp; Nostalgia streaming platform.</p>
        </footer>
      </div>
    )
  }
