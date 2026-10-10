'use client'

import { useState, useEffect } from 'react'
import { Download, X, Tv } from 'lucide-react'
import { isSmartTVDevice } from '@/lib/utils/tvMode'

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [isInstallable, setIsInstallable] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)
  const [isTV, setIsTV] = useState(false)

  useEffect(() => {
    setIsTV(isSmartTVDevice())

    // Check if app is already running in standalone (PWA) mode
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    if (isStandalone) {
      setIsInstallable(false);
      return;
    }

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('Service Worker registration:', err)
      })
    }

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      const dismissed = localStorage.getItem('shindora-install-dismissed') === 'true'
      if (!dismissed) {
        setIsInstallable(true)
      }
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    // Handle standard app installed event
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

  const handleInstallClick = async () => {
    if (!deferredPrompt) return

    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice

    if (outcome === 'accepted') {
      setIsInstallable(false)
    }
    setDeferredPrompt(null)
  }

  const handleDismiss = () => {
    setIsDismissed(true)
    setIsInstallable(false)
    localStorage.setItem('shindora-install-dismissed', 'true')
  }

  if (!isInstallable || isDismissed) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 p-4 bg-[#0d0e1b]/95 backdrop-blur-md border border-[#1e2038] hover:border-cyan-500/50 rounded-2xl shadow-2xl max-w-sm flex flex-col gap-3 transition-all duration-300">
      <div className="flex items-start justify-between gap-3">
        <div className="flex gap-3">
          <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border border-slate-500/10">
            <img 
              src="https://ik.imagekit.io/shindoranesub/ad_1786766331592_ChatGPT_Image_Jan_30__2026__11_27_06_PM__1__LrLxIUzE9.png?updatedAt=1786766333233" 
              alt="ShinDora Nesub" 
              className="w-full h-full object-cover"
            />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-black text-white uppercase tracking-wider">
              {isTV ? '📺 Pasang ShinDora di Smart TV' : 'Instal ShinDora App'}
            </p>
            <p className="text-[10px] text-slate-400 leading-snug">
              {isTV 
                ? 'Pasang aplikasi ShinDora di Smart TV untuk akses langsung episode favorit dengan remote control!'
                : 'Saksikan anime retro favoritmu langsung dari layar beranda tanpa navigasi browser!'}
            </p>
          </div>
        </div>
        <button 
          data-tv-focus="true"
          tabIndex={0}
          onClick={handleDismiss} 
          className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition-all cursor-pointer"
          aria-label="Tutup Banner Install"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex gap-2">
        <button
          data-tv-focus="true"
          tabIndex={0}
          onClick={handleInstallClick}
          className="w-full py-2 bg-cyan-500 hover:bg-cyan-600 text-black text-xs font-black rounded-lg transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-cyan-500/25 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          {isTV ? 'Pasang di Smart TV (OK)' : 'Pasang Sekarang'}
        </button>
      </div>
    </div>
  )
}
