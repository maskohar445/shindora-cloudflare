'use client'

import React, { useState } from 'react'
import AdSlotContainer from './AdSlotContainer'
import { X } from 'lucide-react'

export default function FloatingAds({ ads = [], theme = 'dark' }) {
  const [bottomClosed, setBottomClosed] = useState(false)
  const [leftClosed, setLeftClosed] = useState(false)
  const [rightClosed, setRightClosed] = useState(false)

  if (!Array.isArray(ads) || ads.length === 0) return null

  // Only take the first active floating ad per slot to prevent stacking overlays
  const bottomAds = ads.filter(a => a.slot === 'banner_float_bottom' && a.isActive).slice(0, 1)
  const leftAds = ads.filter(a => a.slot === 'banner_float_left' && a.isActive).slice(0, 1)
  const rightAds = ads.filter(a => a.slot === 'banner_float_right' && a.isActive).slice(0, 1)

  return (
    <>
      {/* Bottom Sticky Floating Ad (Compact & Fixed max height so it NEVER blocks the screen) */}
      {!bottomClosed && bottomAds.length > 0 && (
        <aside 
          aria-label="Floating Advertisement"
          className="fixed bottom-0 left-0 right-0 z-40 bg-[#090a14]/95 backdrop-blur-md border-t border-purple-500/30 p-1.5 shadow-2xl flex flex-col items-center justify-center max-h-[110px] overflow-visible"
        >
          <div className="relative max-w-4xl w-full flex items-center justify-center px-4">
            <button
              onClick={() => setBottomClosed(true)}
              className="absolute -top-3.5 right-2 bg-pink-600 hover:bg-pink-700 text-white rounded-full p-0.5 shadow-lg transition-transform hover:scale-110 text-[9px] flex items-center gap-1 px-2 cursor-pointer z-50 font-bold"
              title="Tutup Iklan"
            >
              <X className="w-2.5 h-2.5" />
              <span>Tutup</span>
            </button>
            <div className="w-full flex justify-center items-center overflow-hidden max-h-[90px]">
              {bottomAds.map(ad => (
                <AdSlotContainer key={ad.id || ad._id} ad={ad} theme={theme} className="my-0" />
              ))}
            </div>
          </div>
        </aside>
      )}

      {/* Left Fixed Skyscraper (Desktop only) */}
      {!leftClosed && leftAds.length > 0 && (
        <aside 
          aria-label="Left Side Advertisement"
          className="hidden xl:flex fixed top-24 left-2 z-30 flex-col items-center max-w-[160px] bg-[#090a14]/90 backdrop-blur-sm border border-purple-500/20 rounded-xl p-2 shadow-xl"
        >
          <button
            onClick={() => setLeftClosed(true)}
            className="self-end mb-1 text-slate-400 hover:text-white text-[10px] flex items-center gap-0.5 bg-black/40 px-1.5 py-0.5 rounded cursor-pointer"
          >
            <X className="w-2.5 h-2.5" />
            <span>X</span>
          </button>
          <div className="flex flex-col gap-2 w-full">
            {leftAds.map(ad => (
              <AdSlotContainer key={ad.id || ad._id} ad={ad} theme={theme} className="my-0" />
            ))}
          </div>
        </aside>
      )}

      {/* Right Fixed Skyscraper (Desktop only) */}
      {!rightClosed && rightAds.length > 0 && (
        <aside 
          aria-label="Right Side Advertisement"
          className="hidden xl:flex fixed top-24 right-2 z-30 flex-col items-center max-w-[160px] bg-[#090a14]/90 backdrop-blur-sm border border-purple-500/20 rounded-xl p-2 shadow-xl"
        >
          <button
            onClick={() => setRightClosed(true)}
            className="self-end mb-1 text-slate-400 hover:text-white text-[10px] flex items-center gap-0.5 bg-black/40 px-1.5 py-0.5 rounded cursor-pointer"
          >
            <X className="w-2.5 h-2.5" />
            <span>X</span>
          </button>
          <div className="flex flex-col gap-2 w-full">
            {rightAds.map(ad => (
              <AdSlotContainer key={ad.id || ad._id} ad={ad} theme={theme} className="my-0" />
            ))}
          </div>
        </aside>
      )}
    </>
  )
}
