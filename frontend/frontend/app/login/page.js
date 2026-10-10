'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { X, User, Lock, Mail, Tv, Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [isMounted, setIsMounted] = useState(false)
  const [theme, setTheme] = useState('light')
  
  // Login form states
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showLoginPassword, setShowLoginPassword] = useState(false)
  const [showRegisterPassword, setShowRegisterPassword] = useState(false)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Staf/Staff Mode state
  const [isStaffMode, setIsStaffMode] = useState(false)

  // Registration Mode option
  const [isRegister, setIsRegister] = useState(false)
  const [regName, setRegName] = useState('')

  // Forgot password states
  const [isForgotPassword, setIsForgotPassword] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetSuccessMessage, setResetSuccessMessage] = useState('')
  const [resetStep, setResetStep] = useState(1) // 1 = Request PIN, 2 = Verify PIN & Reset Password
  const [pinCode, setPinCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  useEffect(() => {
    setIsMounted(true)
    const savedTheme = localStorage.getItem('shindora-theme') || localStorage.getItem('theme') || 'light'
    setTheme(savedTheme)
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [])

  // State Cleanup Helper
  const resetFormFields = () => {
    setEmail('')
    setPassword('')
    setRegName('')
    setResetEmail('')
    setResetSuccessMessage('')
    setResetStep(1)
    setPinCode('')
    setNewPassword('')
    setConfirmPassword('')
    setError('')
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          isStaffOnly: isStaffMode
        })
      })
      const data = await res.json()

      if (res.ok && data && !data.error) {
        localStorage.setItem('shindora-user', JSON.stringify(data))
        if (data.role === 'admin' || data.role === 'superadmin') {
          localStorage.setItem('shindora-admin-token', 'admin-token-authenticated')
          router.push('/admin')
        } else {
          router.push('/')
        }
        router.refresh()
      } else {
        setError(data.error || 'Terjadi kesalahan sistem saat masuk!')
      }
    } catch (err) {
      console.error(err)
      setError('Koneksi server gagal! Silakan coba beberapa saat lagi.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRegisterSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: regName,
          email,
          password
        })
      })
      const data = await res.json()

      if (res.ok && data && !data.error) {
        alert('Pendaftaran Berhasil! Silakan masuk dengan akun Anda.')
        resetFormFields()
        setIsRegister(false)
      } else {
        setError(data.error || 'Pendaftaran gagal!')
      }
    } catch (err) {
      console.error(err)
      setError('Gagal mendaftar. Silakan coba lagi.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleForgotPasswordSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setResetSuccessMessage('')
    setIsSubmitting(true)

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail })
      })
      const data = await res.json()
      if (res.ok && data && !data.error) {
        setResetSuccessMessage(data.message || 'Kode PIN verifikasi telah dikirim ke email Anda. Silakan periksa inbox/spam.')
        setResetStep(2)
      } else {
        setError(data.error || 'Gagal mengirim kode verifikasi reset password!')
      }
    } catch (err) {
      console.error(err)
      setError('Koneksi server gagal! Silakan coba beberapa saat lagi.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setResetSuccessMessage('')

    if (newPassword !== confirmPassword) {
      setError('Kata sandi baru dan konfirmasi kata sandi tidak cocok!')
      return
    }

    setIsSubmitting(true)

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: resetEmail,
          pinCode,
          newPassword
        })
      })
      const data = await res.json()
      if (res.ok && data && !data.error) {
        alert(data.message || 'Kata sandi Anda berhasil diperbarui! Silakan masuk kembali.')
        resetFormFields()
        setIsForgotPassword(false)
      } else {
        setError(data.error || 'Gagal mereset kata sandi!')
      }
    } catch (err) {
      console.error(err)
      setError('Koneksi server gagal! Silakan coba beberapa saat lagi.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative bg-slate-100 dark:bg-[#020817] text-slate-900 dark:text-slate-100">
      
      {/* Ambient background glows */}
      <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-pink-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* LOGIN CARD */}
      <div className="w-full max-w-md rounded-2xl border p-6 md:p-8 relative shadow-2xl backdrop-blur-md bg-white dark:bg-[#0f172a] text-slate-900 dark:text-white border-slate-200 dark:border-slate-800">
        
        {/* CLOSE BUTTON (X) - REDIRECT TO HOME */}
        <Link
          href="/"
          className="absolute top-4 right-4 p-1.5 rounded-full border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="Kembali ke Beranda"
        >
          <X className="w-4 h-4" />
        </Link>

        {/* Logo and Titles */}
        <div className="text-center space-y-2 mb-6">
          <div className="inline-flex items-center justify-center p-2 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-xl text-black font-black mb-1">
            <Tv className="w-5 h-5 fill-current" />
          </div>
          <h2 className="text-xl md:text-2xl font-black uppercase tracking-widest bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-pink-400 to-purple-500">
            {isForgotPassword ? 'RESET PASSWORD' : isRegister ? 'BUAT AKUN BARU' : isStaffMode ? 'MASUK KHUSUS STAF' : 'MASUK KE SHINDORA'}
          </h2>
          <p className="text-xs opacity-60">
            {isForgotPassword
              ? 'Masukkan email untuk menerima kode/instruksi reset.'
              : isRegister 
                ? 'Daftar untuk mengelola playlist pribadi hari Minggu Anda.' 
                : isStaffMode 
                  ? 'Validasi otentikasi peran Moderator / Admin.' 
                  : 'Temukan kembali kebahagiaan masa kecil Anda.'}
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold text-center mb-4">
            ⚠️ {error}
          </div>
        )}

        {resetSuccessMessage && (
          <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 text-xs font-semibold text-center mb-4">
            ✓ {resetSuccessMessage}
          </div>
        )}

        {/* FORMS */}
        {isForgotPassword ? (
          /* FORGOT PASSWORD MULTI-STEP FORM */
          resetStep === 1 ? (
            /* Step 1: Request PIN */
            <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold tracking-wider text-slate-700 dark:text-slate-400">Alamat Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                  <input
                    type="email"
                    placeholder="Ketik email terdaftar Anda..."
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 rounded-lg text-xs outline-none border bg-slate-50 dark:bg-[#020817] border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:border-cyan-500 transition-colors"
                    required
                    autoComplete="email"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 bg-gradient-to-r from-cyan-400 to-blue-500 text-black hover:opacity-90 font-extrabold text-xs transition-all tracking-wider uppercase"
              >
                {isSubmitting ? 'Mengirim...' : 'KIRIM PIN VERIFIKASI'}
              </button>
            </form>
          ) : (
            /* Step 2: Verify PIN & Reset Password */
            <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold tracking-wider text-slate-700 dark:text-slate-400">Kode PIN Verifikasi (6 Digit)</label>
                <div className="relative">
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="Masukkan 6 digit kode PIN..."
                    value={pinCode}
                    onChange={(e) => setPinCode(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg text-xs outline-none border bg-slate-50 dark:bg-[#020817] border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:border-cyan-500 transition-colors font-mono tracking-widest text-center font-bold"
                    required
                    autoComplete="one-time-code"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold tracking-wider text-slate-700 dark:text-slate-400">Kata Sandi Baru</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                  <input
                    type={showNewPassword ? "text" : "password"}
                    placeholder="Masukkan kata sandi baru..."
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-9 pr-10 py-2 rounded-lg text-xs outline-none border bg-slate-50 dark:bg-[#020817] border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:border-cyan-500 transition-colors"
                    required
                    minLength={6}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors cursor-pointer"
                    aria-label="Toggle perlihatkan kata sandi baru"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold tracking-wider text-slate-700 dark:text-slate-400">Konfirmasi Kata Sandi Baru</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Ketik ulang kata sandi baru..."
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-9 pr-10 py-2 rounded-lg text-xs outline-none border bg-slate-50 dark:bg-[#020817] border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:border-cyan-500 transition-colors"
                    required
                    minLength={6}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors cursor-pointer"
                    aria-label="Toggle perlihatkan konfirmasi kata sandi"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 bg-gradient-to-r from-pink-500 to-purple-600 text-white hover:opacity-90 font-extrabold text-xs transition-all tracking-wider uppercase rounded-lg shadow-md"
              >
                {isSubmitting ? 'Memverifikasi...' : 'VERIFIKASI & UBAH KATA SANDI'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setResetStep(1);
                  setError('');
                  setResetSuccessMessage('');
                }}
                className="w-full text-center text-xs opacity-60 hover:opacity-100 transition-all pt-1 font-bold block text-slate-500 hover:text-cyan-400"
              >
                &larr; Kembali ke Step 1 (Minta PIN baru)
              </button>
            </form>
          )
        ) : isRegister ? (
          /* REGISTRATION FORM */
          <form onSubmit={handleRegisterSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold tracking-wider text-slate-700 dark:text-slate-400">Nama Lengkap</label>
              <div className="relative">
                <User className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Ketik nama lengkap Anda..."
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-lg text-xs outline-none border bg-slate-50 dark:bg-[#020817] border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:border-cyan-500 transition-colors"
                  required
                  autoComplete="name"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold tracking-wider text-slate-700 dark:text-slate-400">Alamat Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <input
                  type="email"
                  placeholder="Ketik email terdaftar..."
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-lg text-xs outline-none border bg-slate-50 dark:bg-[#020817] border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:border-cyan-500 transition-colors"
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold tracking-wider text-slate-700 dark:text-slate-400">Kata Sandi</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <input
                  type={showRegisterPassword ? "text" : "password"}
                  placeholder="Min. 6 karakter..."
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  data-testid="register-password-input"
                  className="w-full pl-9 pr-10 py-2 rounded-lg text-xs outline-none border bg-slate-50 dark:bg-[#020817] border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:border-cyan-500 transition-colors"
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  data-testid="toggle-register-password-btn"
                  onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors cursor-pointer"
                  aria-label="Toggle perlihatkan sandi pendaftaran"
                >
                  {showRegisterPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 rounded-lg bg-pink-500 hover:bg-pink-600 text-white font-extrabold text-xs transition-all tracking-wider uppercase mt-2"
            >
              {isSubmitting ? 'Mendaftar...' : 'Daftar Sekarang'}
            </button>
          </form>
        ) : (
          /* LOGIN FORM */
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold tracking-wider text-slate-700 dark:text-slate-400">Alamat Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <input
                  type="email"
                  placeholder="Masukkan email Anda..."
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-lg text-xs outline-none border bg-slate-50 dark:bg-[#020817] border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:border-cyan-500 transition-colors"
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold tracking-wider text-slate-700 dark:text-slate-400">Kata Sandi</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <input
                  type={showLoginPassword ? "text" : "password"}
                  placeholder="Masukkan kata sandi..."
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  data-testid="login-password-input"
                  className="w-full pl-9 pr-10 py-2 rounded-lg text-xs outline-none border bg-slate-50 dark:bg-[#020817] border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:border-cyan-500 transition-colors"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  data-testid="toggle-login-password-btn"
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors cursor-pointer"
                  aria-label="Toggle perlihatkan sandi masuk"
                >
                  {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => { resetFormFields(); setIsForgotPassword(true); }}
                  className={`text-[10px] font-bold hover:underline ${
                    theme === 'dark' ? 'text-pink-400' : 'text-pink-600'
                  }`}
                >
                  Lupa Password?
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 bg-gradient-to-r from-cyan-400 to-blue-500 text-black hover:opacity-90 font-extrabold text-xs transition-all tracking-wider uppercase"
            >
              {isSubmitting ? 'Memverifikasi...' : isStaffMode ? 'MASUK SEBAGAI STAF' : 'MASUK SEKARANG'}
            </button>
          </form>
        )}



        {/* Navigation toggles & Links */}
        <div className="mt-5 text-center space-y-2.5">
          {isForgotPassword ? (
            <button
              onClick={() => { resetFormFields(); setIsForgotPassword(false); }}
              className={`text-xs font-bold hover:underline ${
                theme === 'dark' ? 'text-cyan-400' : 'text-cyan-600'
              }`}
            >
              Sudah ingat kata sandi? Masuk di sini
            </button>
          ) : isRegister ? (
            <button
              onClick={() => { resetFormFields(); setIsRegister(false); }}
              className={`text-xs font-bold hover:underline ${
                theme === 'dark' ? 'text-cyan-400' : 'text-cyan-600'
              }`}
            >
              Sudah punya akun? Masuk di sini
            </button>
          ) : (
            <div className="flex flex-col gap-2">
              <button
                onClick={() => { resetFormFields(); setIsRegister(true); }}
                className={`text-xs font-bold hover:underline ${
                  theme === 'dark' ? 'text-pink-400' : 'text-pink-600'
                }`}
              >
                Belum punya akun? Daftar sebagai Anggota
              </button>

              <button
                onClick={() => { resetFormFields(); setIsStaffMode(!isStaffMode); }}
                className={`text-[10px] font-semibold hover:underline ${
                  theme === 'dark' ? 'text-purple-400' : 'text-purple-600'
                }`}
              >
                {isStaffMode ? 'Beralih ke Login Anggota Biasa?' : 'Masuk sebagai Moderator / Staf?'}
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}