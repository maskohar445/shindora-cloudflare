'use client'

import { useEffect, useState } from 'react'
import { subscribeToWebPush } from '@/lib/utils/push'
import { toast } from 'sonner'

export default function OneSignalBell({ theme = 'light' }) {
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isSubscribing, setIsSubscribing] = useState(false)
  const [showTooltip, setShowTooltip] = useState(false)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)

    if (typeof window === 'undefined') return

    const checkStatus = () => {
      const saved = localStorage.getItem('webpush-subscribed') === 'true'
      const permission = 'Notification' in window ? Notification.permission : 'default'
      setIsSubscribed(saved && permission === 'granted')
    }

    checkStatus()
    window.addEventListener('storage', checkStatus)
    return () => window.removeEventListener('storage', checkStatus)
  }, [])

  const handleSubscribe = async (event) => {
    event?.preventDefault()
    event?.stopPropagation()

    if (isSubscribing) return

    if (isSubscribed) {
      toast.success('🔔 Notifikasi Web Push sudah aktif di perangkat ini!')
      return
    }

    setIsSubscribing(true)

    try {
      const result = await subscribeToWebPush()

      if (result?.success) {
        localStorage.setItem('webpush-subscribed', 'true')
        setIsSubscribed(true)
      }
    } catch (error) {
      console.error('[WebPush Bell Error]:', error)
    } finally {
      setIsSubscribing(false)
    }
  }

  if (!isMounted) {
    return (
      <div className="w-8 h-8 sm:w-9 sm:h-9" />
    )
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes bellVibrate {
          0% { transform: rotate(0deg) scale(1); }
          5% { transform: rotate(14deg) scale(1.08); }
          10% { transform: rotate(-14deg) scale(1.08); }
          15% { transform: rotate(12deg) scale(1.05); }
          20% { transform: rotate(-12deg) scale(1.05); }
          25% { transform: rotate(8deg) scale(1.02); }
          30% { transform: rotate(-8deg) scale(1.02); }
          35% { transform: rotate(4deg); }
          40% { transform: rotate(-4deg); }
          45% { transform: rotate(0deg); }
          100% { transform: rotate(0deg) scale(1); }
        }

        .bell-vibrate-anim {
          animation: bellVibrate 2.5s cubic-bezier(0.36, 0.07, 0.19, 0.97) infinite;
          transform-origin: top center;
        }
      ` }} />

      <div className="relative flex items-center group">
        {/* Tooltip on Hover */}
        <div
          className={`absolute top-11 right-0 sm:right-auto sm:left-1/2 sm:-translate-x-1/2 whitespace-nowrap bg-[#0d0e1b]/95 border border-pink-500/30 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg shadow-2xl backdrop-blur-md transition-all duration-200 pointer-events-none z-50 ${
            showTooltip
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 -translate-y-1 pointer-events-none'
          }`}
        >
          {isSubscribed ? (
            <span><span className="text-emerald-400">✅</span> Notifikasi Aktif</span>
          ) : (
            <span><span className="text-pink-400">🔔</span> Nyalakan Notifikasi Episode!</span>
          )}
        </div>

        <button
          type="button"
          onClick={handleSubscribe}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          onTouchStart={() => setShowTooltip(true)}
          onTouchEnd={() => setTimeout(() => setShowTooltip(false), 2000)}
          disabled={isSubscribing}
          data-testid="onesignal-bell-button"
          data-push-subscribe="true"
          aria-label={isSubscribed ? "Notifikasi Web Push Aktif" : "Aktifkan Notifikasi Web Push"}
          title={
            isSubscribing
              ? 'Mengaktifkan notifikasi...'
              : (isSubscribed ? 'Notifikasi Web Push sudah aktif' : 'Nyalakan Notifikasi Episode Baru!')
          }
          className={`relative w-8 h-8 sm:w-9 sm:h-9 rounded-full border transition-all flex items-center justify-center p-1.5 cursor-pointer hover:scale-110 active:scale-95 disabled:opacity-70 ${
            theme === 'dark'
              ? 'bg-[#121324] border-pink-500/40 hover:border-pink-500 shadow-md shadow-pink-500/10'
              : 'bg-pink-50 border-pink-300 hover:border-pink-500 shadow-sm'
          }`}
        >
          <img
            src="https://ik.imagekit.io/shindoranesub/bell-7-removebg-preview.png"
            alt="Lonceng Notifikasi"
            className={`w-full h-full object-contain ${isSubscribed ? '' : 'bell-vibrate-anim'} drop-shadow-[0_0_6px_rgba(236,72,153,0.5)]`}
          />

          {isSubscribing ? (
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60 text-white text-[9px] font-bold">
              ...
            </span>
          ) : isSubscribed ? (
            <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-emerald-500 text-white text-[8px] font-black border-2 border-white dark:border-[#0d0e1b]">
              ✓
            </span>
          ) : (
            <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-pink-500 border border-white dark:border-[#0d0e1b]" />
            </span>
          )}
        </button>
      </div>
    </>
  )
}
