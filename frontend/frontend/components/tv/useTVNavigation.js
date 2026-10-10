'use client'

import { useEffect, useRef, useCallback } from 'react'
import { TV_KEYCODES } from '@/lib/utils/tvMode'

export function useTVNavigation({
  isActive = true,
  onBack = null,
  onPlayPause = null,
  containerRef = null
}) {
  const isNavigatingRef = useRef(false)

  const getFocusableElements = useCallback(() => {
    const root = containerRef?.current || document;
    const selector = '[data-tv-focus="true"], [tabindex="0"], button:not([disabled]), a[href]:not([disabled]), input:not([disabled])';
    const rawElements = Array.from(root.querySelectorAll(selector));
    
    // Filter visible elements
    return rawElements.filter(el => {
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return (
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        style.opacity !== '0' &&
        rect.width > 0 &&
        rect.height > 0
      );
    });
  }, [containerRef]);

  const moveFocus = useCallback((direction) => {
    const elements = getFocusableElements();
    if (elements.length === 0) return;

    const currentActive = document.activeElement;
    const currentIndex = elements.indexOf(currentActive);

    if (currentIndex === -1) {
      // Focus the first element if none is currently focused
      elements[0].focus();
      elements[0].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      return;
    }

    const currentRect = currentActive.getBoundingClientRect();
    const currentCenter = {
      x: currentRect.left + currentRect.width / 2,
      y: currentRect.top + currentRect.height / 2
    };

    let bestCandidate = null;
    let shortestDistance = Infinity;

    for (let i = 0; i < elements.length; i++) {
      if (i === currentIndex) continue;
      const el = elements[i];
      const rect = el.getBoundingClientRect();
      const center = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      };

      const dx = center.x - currentCenter.x;
      const dy = center.y - currentCenter.y;

      let isCandidate = false;

      switch (direction) {
        case 'right':
          isCandidate = dx > 10 && Math.abs(dy) <= rect.height * 1.5;
          break;
        case 'left':
          isCandidate = dx < -10 && Math.abs(dy) <= rect.height * 1.5;
          break;
        case 'down':
          isCandidate = dy > 10;
          break;
        case 'up':
          isCandidate = dy < -10;
          break;
        default:
          break;
      }

      if (isCandidate) {
        // Weighted distance giving priority to primary direction
        const primaryDist = direction === 'left' || direction === 'right' ? Math.abs(dx) : Math.abs(dy);
        const secondaryDist = direction === 'left' || direction === 'right' ? Math.abs(dy) * 2 : Math.abs(dx) * 1.5;
        const totalDist = Math.sqrt(primaryDist * primaryDist + secondaryDist * secondaryDist);

        if (totalDist < shortestDistance) {
          shortestDistance = totalDist;
          bestCandidate = el;
        }
      }
    }

    // Fallback: simple sequential index if geometric jump fails in single row / column
    if (!bestCandidate) {
      if (direction === 'right' && currentIndex + 1 < elements.length) {
        bestCandidate = elements[currentIndex + 1];
      } else if (direction === 'left' && currentIndex - 1 >= 0) {
        bestCandidate = elements[currentIndex - 1];
      } else if (direction === 'down' && currentIndex + 1 < elements.length) {
        bestCandidate = elements[currentIndex + 1];
      } else if (direction === 'up' && currentIndex - 1 >= 0) {
        bestCandidate = elements[currentIndex - 1];
      }
    }

    if (bestCandidate) {
      bestCandidate.focus();
      bestCandidate.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    }
  }, [getFocusableElements]);

  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e) => {
      const code = e.keyCode || e.which;
      const key = e.key;

      // D-Pad Arrows
      if (key === 'ArrowRight' || code === TV_KEYCODES.RIGHT) {
        // Allow native cursor in text inputs if not at end
        if (e.target.tagName === 'INPUT' && e.target.type === 'text') {
          if (e.target.selectionStart < e.target.value.length) return;
        }
        e.preventDefault();
        moveFocus('right');
        return;
      }

      if (key === 'ArrowLeft' || code === TV_KEYCODES.LEFT) {
        if (e.target.tagName === 'INPUT' && e.target.type === 'text') {
          if (e.target.selectionStart > 0) return;
        }
        e.preventDefault();
        moveFocus('left');
        return;
      }

      if (key === 'ArrowDown' || code === TV_KEYCODES.DOWN) {
        e.preventDefault();
        moveFocus('down');
        return;
      }

      if (key === 'ArrowUp' || code === TV_KEYCODES.UP) {
        e.preventDefault();
        moveFocus('up');
        return;
      }

      // Enter / OK
      if (key === 'Enter' || code === TV_KEYCODES.ENTER) {
        if (document.activeElement && document.activeElement !== document.body) {
          // If activeElement is a button or link, trigger it
          if (document.activeElement.tagName !== 'INPUT') {
            e.preventDefault();
            document.activeElement.click();
          }
        }
        return;
      }

      // Back button
      if (
        key === 'Escape' ||
        key === 'Backspace' ||
        code === TV_KEYCODES.ESCAPE ||
        code === TV_KEYCODES.BACK ||
        code === TV_KEYCODES.TIZEN_BACK ||
        code === TV_KEYCODES.WEBOS_BACK ||
        code === TV_KEYCODES.ANDROID_BACK
      ) {
        if (e.target.tagName === 'INPUT' && e.target.value.length > 0 && key === 'Backspace') {
          return; // Let backspace delete text in input
        }
        e.preventDefault();
        if (typeof onBack === 'function') {
          onBack();
        }
        return;
      }

      // Media Play / Pause
      if (
        code === TV_KEYCODES.MEDIA_PLAY ||
        code === TV_KEYCODES.MEDIA_PAUSE ||
        code === TV_KEYCODES.MEDIA_PLAY_PAUSE ||
        key === 'MediaPlayPause'
      ) {
        e.preventDefault();
        if (typeof onPlayPause === 'function') {
          onPlayPause();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, { passive: false });
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, moveFocus, onBack, onPlayPause]);

  return {
    getFocusableElements,
    moveFocus
  };
}
