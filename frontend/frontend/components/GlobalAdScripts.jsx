'use client'

import React, { useEffect } from 'react'

/**
 * Executes Global / Direct / Popunder / Head ad scripts registered in admin settings.
 */
export default function GlobalAdScripts({ ads = [] }) {
  useEffect(() => {
    if (!Array.isArray(ads) || ads.length === 0) return

    const globalAds = ads.filter(
      (a) =>
        a &&
        a.isActive &&
        (a.slot === 'custom_head_code' || a.slot === 'global_script' || a.slot === 'popunder_direct')
    )

    if (globalAds.length === 0) return

    const createdElements = []

    globalAds.forEach((ad) => {
      try {
        const rawHtml = String(
          ad.rawCode || ad.html || ad.content || ad.script || ad.code || ad.raw_code || ''
        ).trim()
        if (!rawHtml) return

        const parser = new DOMParser()
        const doc = parser.parseFromString(rawHtml, 'text/html')
        const scripts = Array.from(doc.querySelectorAll('script'))

        if (scripts.length === 0) {
          // If pure JS code without tags
          const scriptEl = document.createElement('script')
          scriptEl.type = 'text/javascript'
          scriptEl.textContent = rawHtml
          scriptEl.setAttribute('data-shindora-global-ad', ad.id || 'ad')
          document.head.appendChild(scriptEl)
          createdElements.push(scriptEl)
        } else {
          scripts.forEach((scr) => {
            const newScript = document.createElement('script')
            Array.from(scr.attributes).forEach((attr) => {
              newScript.setAttribute(attr.name, attr.value)
            })
            if (scr.textContent) {
              newScript.textContent = scr.textContent
            }
            newScript.setAttribute('data-shindora-global-ad', ad.id || 'ad')
            document.head.appendChild(newScript)
            createdElements.push(newScript)
          })
        }
      } catch (e) {
        console.warn('[GlobalAdScripts] Error mounting script:', e)
      }
    })

    return () => {
      createdElements.forEach((el) => {
        try {
          if (el && el.parentNode) {
            el.parentNode.removeChild(el)
          }
        } catch (_) {}
      })
    }
  }, [ads])

  return null
}
