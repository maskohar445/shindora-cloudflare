'use client'

import React, { useEffect, useRef, useState } from 'react'

/**
 * Robust Ad Slot Component for ShinDora Nesub
 * Handles:
 * 1. Raw HTML, Banners, IFrames, Ins (AdSense), Images, Styles
 * 2. HilltopAds, Adsterra, Monetag, PropellerAds, Google AdSense, PopAds, etc.
 * 3. Dynamic Script Injection (<script>, (function(){})(), document.currentScript, insertBefore)
 * 4. Image + Link Custom Banners
 * 5. Isolated placement strictly OUTSIDE the video player frame
 */
export default function AdSlotContainer({ ad, theme = 'dark', className = '' }) {
  const containerRef = useRef(null)
  const executedCodeRef = useRef('')
  const [hasError, setHasError] = useState(false)

  const rawCode = String(
    ad?.rawCode || ad?.html || ad?.content || ad?.script || ad?.code || ad?.raw_code || ''
  ).trim()

  const isRawAd = Boolean(
    ad?.isRaw || ad?.is_raw || (rawCode && (rawCode.includes('<') || rawCode.startsWith('function') || rawCode.startsWith('(function') || rawCode.startsWith('var ') || rawCode.startsWith('let ') || rawCode.startsWith('const ') || rawCode.startsWith('window.')))
  )

  useEffect(() => {
    if (!ad || !ad.isActive) return
    if (!isRawAd || !rawCode || !containerRef.current) return

    // If already executed this exact code for this slot, do not wipe or re-execute
    if (executedCodeRef.current === `${ad.id || ad.slot}_${rawCode}` && containerRef.current.childNodes.length > 0) {
      return
    }

    const container = containerRef.current
    container.innerHTML = ''
    executedCodeRef.current = `${ad.id || ad.slot}_${rawCode}`
    setHasError(false)

    try {
      // 1. If plain JS without HTML tags
      const isPlainJs = (!rawCode.includes('<') && (
        rawCode.startsWith('function') ||
        rawCode.startsWith('(function') ||
        rawCode.startsWith('var ') ||
        rawCode.startsWith('const ') ||
        rawCode.startsWith('let ') ||
        rawCode.startsWith('window.')
      ))

      if (isPlainJs) {
        const scriptEl = document.createElement('script')
        scriptEl.type = 'text/javascript'
        scriptEl.textContent = rawCode
        container.appendChild(scriptEl)
        return
      }

      // 2. Parse HTML snippet using temp div so all elements & scripts are preserved in order
      const tempDiv = document.createElement('div')
      tempDiv.innerHTML = rawCode

      // Monkey-patch document.write to append into container safely without replacing whole page
      const origWrite = document.write
      const origWriteln = document.writeln
      document.write = (content) => {
        if (container) {
          container.insertAdjacentHTML('beforeend', content)
        }
      }
      document.writeln = (content) => {
        if (container) {
          container.insertAdjacentHTML('beforeend', content + '\n')
        }
      }

      // Function to recursively create executable DOM nodes
      const appendExecutableNode = (node, target) => {
        if (node.nodeName === 'SCRIPT') {
          const newScript = document.createElement('script')
          Array.from(node.attributes || []).forEach(attr => {
            newScript.setAttribute(attr.name, attr.value)
          })
          if (node.textContent) {
            newScript.textContent = node.textContent
          }
          target.appendChild(newScript)
          return
        }

        const clone = node.cloneNode(true)
        if (clone.querySelectorAll) {
          const nestedScripts = Array.from(clone.querySelectorAll('script'))
          nestedScripts.forEach(scr => {
            const executableScr = document.createElement('script')
            Array.from(scr.attributes || []).forEach(attr => {
              executableScr.setAttribute(attr.name, attr.value)
            })
            if (scr.textContent) {
              executableScr.textContent = scr.textContent
            }
            if (scr.parentNode) {
              scr.parentNode.replaceChild(executableScr, scr)
            }
          })
        }
        target.appendChild(clone)
      }

      const childNodes = Array.from(tempDiv.childNodes)
      childNodes.forEach(child => {
        appendExecutableNode(child, container)
      })

      // Trigger Google AdSense if present
      if (rawCode.includes('adsbygoogle') || rawCode.includes('ins class="adsbygoogle"')) {
        try {
          ;(window.adsbygoogle = window.adsbygoogle || []).push({})
        } catch (e) {
          console.warn('[AdSense Info]: adsbygoogle push caught:', e)
        }
      }

      // Restore document.write
      setTimeout(() => {
        document.write = origWrite
        document.writeln = origWriteln
      }, 500)

    } catch (err) {
      console.warn('[AdSlotContainer Warning]: Error executing ad code:', err)
      setHasError(true)
    }
  }, [ad, rawCode, isRawAd])

  if (!ad || !ad.isActive) return null

  // If Raw HTML/Script Ad
  if (isRawAd) {
    if (!rawCode) return null // If raw is checked but code is empty, do not show title banner box

    return (
      <div 
        className={`w-full flex justify-center items-center relative z-10 transition-all duration-300 my-2.5 overflow-hidden ${className}`}
      >
        <div 
          ref={containerRef} 
          data-slot-name={ad.slot || 'ad-slot'}
          className="w-full flex flex-col justify-center items-center text-center overflow-hidden min-h-[40px]"
        />
      </div>
    )
  }

  // Standard Image Banner Ad (Only rendered when NOT a raw HTML/script ad)
  return (
    <div className={`my-3 w-full rounded-xl overflow-hidden border border-purple-500/20 bg-purple-500/5 backdrop-blur-sm p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs shadow-md transition-all hover:border-purple-500/40 ${className}`}>
      <div className="flex items-center gap-3 w-full sm:w-auto">
        {ad.imageUrl && (
          <img 
            src={ad.imageUrl} 
            alt={ad.title || 'Iklan Sponsor'} 
            className="w-12 h-12 rounded-lg object-cover flex-shrink-0 shadow border border-white/10" 
          />
        )}
        <div>
          <span className="text-[9px] uppercase tracking-wider text-pink-400 font-extrabold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-pink-400 animate-pulse inline-block" />
            SPONSOR SHINDORA
          </span>
          <p className={`font-black text-sm tracking-tight ${
            theme === 'dark' ? 'text-slate-100' : 'text-slate-900'
          }`}>
            {ad.title}
          </p>
        </div>
      </div>
      
      {ad.targetUrl && (
        <a
          href={ad.targetUrl}
          target={ad.openInNewTab !== false ? '_blank' : '_self'}
          rel="noopener noreferrer"
          className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-extrabold rounded-lg shadow-md hover:shadow-lg transition-all duration-200 text-center flex-shrink-0 flex items-center justify-center gap-1.5 text-xs"
        >
          <span>Kunjungi Link</span>
          <span className="text-xs">↗</span>
        </a>
      )}
    </div>
  )
}
