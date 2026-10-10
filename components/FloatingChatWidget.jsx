'use client'

import { useState, useEffect, useRef } from 'react'
import { MessageSquare, X, Send } from 'lucide-react'

export default function FloatingChatWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [inputText, setInputText] = useState('')
  const [currentUser, setCurrentUser] = useState(null)
  const [isMounted, setIsMounted] = useState(false)
  const chatEndRef = useRef(null)

  const syncUser = () => {
    try {
      const stored = localStorage.getItem('shindora-user');
      if (stored) {
        setCurrentUser(JSON.parse(stored));
      } else {
        setCurrentUser(null);
      }
    } catch (e) {}
  };

  useEffect(() => {
    setIsMounted(true);
    syncUser();
    window.addEventListener('storage', syncUser);
    return () => window.removeEventListener('storage', syncUser);
  }, [isOpen]);

  const fetchChatMessages = async () => {
    try {
      const res = await fetch('/api/chat')
      if (res.ok) {
        const data = await res.json()
        setMessages(Array.isArray(data) ? data : [])
      }
    } catch (err) {
      console.warn('Failed to load chat:', err)
    }
  }

  // Poll for new messages every 4 seconds when open
  useEffect(() => {
    if (!isMounted) return
    fetchChatMessages()
    const interval = setInterval(fetchChatMessages, 4000)
    return () => clearInterval(interval)
  }, [isMounted])

  // Scroll to bottom when messages list changes or chat opens
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isOpen])

  const handleSendMessage = async (e) => {
    e.preventDefault()
    if (!inputText.trim()) return

    const textToSend = inputText.trim()
    const userToUse = currentUser || { name: 'Pecinta Retro', avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=80' }
    
    const payload = {
      userName: userToUse.name,
      userAvatar: userToUse.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=80',
      content: textToSend
    }

    const optimisticMsg = {
      id: `temp-${Date.now()}`,
      ...payload,
      createdAt: new Date().toISOString()
    }
    setMessages(prev => [...prev, optimisticMsg])
    setInputText('')

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (res.ok) {
        fetchChatMessages()
      }
    } catch (err) {
      console.warn('Failed to send message:', err)
    }
  }

  if (!isMounted) return null

  return (
    <>
      {/* FLOATING ACTION BUTTON */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 right-4 sm:bottom-5 sm:right-5 z-50 w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 text-black flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95 transition-all group border border-cyan-400/20"
        title="Buka Live Chat"
      >
        <MessageSquare className="w-5 h-5 sm:w-6 sm:h-6 transition-transform group-hover:rotate-12" />
        <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-[#0a0b14] animate-pulse" />
      </button>

      {/* CHAT WINDOW POPUP */}
      {isOpen && (
        <div className="fixed bottom-20 right-4 sm:right-5 z-50 w-[92%] sm:w-[350px] h-[460px] rounded-2xl border border-[#1e2038] bg-[#0d0e1b]/95 backdrop-blur-md text-white shadow-2xl flex flex-col overflow-hidden animate-fade-in box-border">
          {/* Header */}
          <div className="p-3 bg-gradient-to-r from-[#101226] via-[#1a1c32] to-[#101226] border-b border-[#1e2038] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-emerald-400 animate-pulse text-xs">●</span>
              <div className="text-left">
                <h4 className="font-extrabold text-xs tracking-wider uppercase bg-gradient-to-r from-cyan-400 to-pink-500 bg-clip-text text-transparent">💬 ShinDora Live Chat</h4>
                <p className="text-[9px] opacity-60">Saluran Opini Nostalgia Publik</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-full hover:bg-slate-500/10 text-slate-400 hover:text-white transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 scroll-smooth scrollbar-hide">
            {messages.length === 0 ? (
              <div className="text-center py-20 text-xs opacity-50 italic">
                Belum ada percakapan. Mari sapa penonton lainnya!
              </div>
            ) : (
              messages.map((msg) => {
                const isMe = currentUser && currentUser.name === msg.userName
                return (
                  <div key={msg.id} className={`flex gap-2 items-start ${isMe ? 'flex-row-reverse text-right' : 'text-left'}`}>
                    <img
                      src={msg.userAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=80'}
                      alt=""
                      className="w-7 h-7 rounded-full object-cover flex-shrink-0 border border-slate-500/10 mt-0.5"
                    />
                    <div className="space-y-0.5 max-w-[75%]">
                      <span className="text-[10px] font-bold opacity-60 block">{msg.userName || 'Anonim'}</span>
                      <div className={`p-2.5 rounded-2xl text-[11px] leading-relaxed break-words ${
                        isMe 
                          ? 'bg-cyan-500 text-black font-semibold rounded-tr-none' 
                          : 'bg-[#121324] border border-[#1e2038] text-slate-100 rounded-tl-none'
                      }`}>
                        {msg.content}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input Footer */}
          <form onSubmit={handleSendMessage} className="p-2.5 border-t border-[#1e2038] bg-[#0c0d18] flex gap-2 items-center">
            <input
              type="text"
              placeholder={currentUser ? "Tulis pesan chat..." : "Silakan login untuk mengirim..."}
              disabled={!currentUser}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="flex-1 text-xs p-2.5 rounded-xl bg-[#121324] border border-[#1e2038] text-white outline-none focus:border-cyan-500 placeholder-slate-500"
            />
            <button
              type="submit"
              disabled={!currentUser || !inputText.trim()}
              className="p-2.5 rounded-xl bg-cyan-500 text-black hover:bg-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center flex-shrink-0 cursor-pointer"
              title="Kirim Pesan"
              aria-label="Kirim Pesan"
            >
              <Send className="w-4 h-4 fill-current" />
            </button>
          </form>
        </div>
      )}
    </>
  )
}