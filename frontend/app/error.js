'use client'

import { useEffect } from 'react'
import { AlertCircle, RotateCcw, Home } from 'lucide-react'

export default function Error({ error, reset }) {
  useEffect(() => {
    console.error('[Global App Error Handler]:', error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0b14] text-white p-4">
      <div className="max-w-md w-full bg-[#0d0e1b] border border-red-500/30 rounded-2xl p-6 md:p-8 text-center space-y-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-red-500/10 rounded-full blur-3xl -z-10" />

        <div className="flex justify-center">
          <div className="p-4 bg-red-500/10 rounded-full border border-red-500/20 text-red-500 animate-pulse">
            <AlertCircle className="w-12 h-12" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-red-500 via-pink-500 to-purple-500 tracking-wider">
            500 - ERROR SERVER
          </h1>
          <p className="text-sm text-slate-400">
            Terjadi kesalahan yang tidak terduga pada sistem kami. Jangan khawatir, tim teknis kami sedang memperbaikinya!
          </p>
        </div>

        {error?.message && (
          <div className="p-3 bg-black/40 border border-slate-500/10 rounded-xl font-mono text-[10px] text-red-400/90 text-left max-h-24 overflow-y-auto scrollbar-hide break-all">
            <strong>Error:</strong> {error.message}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            onClick={() => reset()}
            className="flex-1 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-black font-black text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-cyan-500/20"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Coba Lagi
          </button>
          <a
            href="/"
            className="flex-1 py-2.5 bg-slate-500/10 hover:bg-slate-500/20 text-white font-bold text-xs rounded-xl transition-all border border-slate-500/20 flex items-center justify-center gap-1.5"
          >
            <Home className="w-3.5 h-3.5" />
            Ke Beranda
          </a>
        </div>
      </div>
    </div>
  )
}
