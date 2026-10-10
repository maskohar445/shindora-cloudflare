'use client';

import { useState, useEffect } from 'react';

export default function ScrollToTop() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const toggleVisibility = () => {
      if (window.scrollY > 300) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };
    window.addEventListener('scroll', toggleVisibility);
    return () => window.removeEventListener('scroll', toggleVisibility);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  if (!isVisible) return null;

  return (
    <button
      onClick={scrollToTop}
      title="Kembali ke Atas"
      className="fixed bottom-6 left-6 z-50 flex flex-col items-center group transition-all duration-300 hover:scale-110 active:scale-95 cursor-pointer"
    >
      {/* GIF Shin-chan Animasi */}
      <img
        src="https://ik.imagekit.io/shindoranesub/animasi-bergerak-shin-chan-0050-ezgif.com-remove-background.gif"
        alt="Back to Top Shin-chan"
        className="w-16 h-16 md:w-20 md:h-20 object-contain drop-shadow-[0_5px_10px_rgba(0,0,0,0.5)]"
      />
      {/* Label Tooltip Melayang */}
      <span className="mt-1 bg-black/80 text-white text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur-sm border border-white/20 opacity-90 group-hover:opacity-100 transition-opacity">
        Ke Atas ▲
      </span>
    </button>
  );
}
