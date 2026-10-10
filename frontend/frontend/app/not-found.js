'use client'

import { HelpCircle, Home } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0b14] text-white p-4">
      <div className="max-w-md w-full bg-[#0d0e1b] border border-cyan-500/20 rounded-2xl p-6 md:p-8 text-center space-y-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl -z-10" />

        <div className="flex justify-center">
          <div className="p-4 bg-cyan-500/10 rounded-full border border-cyan-500/20 text-cyan-400">
            <HelpCircle className="w-12 h-12" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-pink-500 to-purple-500 tracking-wider">
            404 - NOT FOUND
          </h1>
          <p className="text-sm text-slate-400">
            Waduh! Halaman atau video retro yang kamu cari tidak dapat ditemukan. Mungkin sudah terhapus atau pindah dimensi!
          </p>
        </div>

        <div className="pt-2">
          <a
            href="/"
            className="w-full py-2.5 bg-cyan-500 hover:bg-cyan-600 text-black font-black text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-cyan-500/20"
          >
            <Home className="w-3.5 h-3.5" />
            Kembali ke Beranda
          </a>
        </div>
      </div>
    </div>
  )
}
