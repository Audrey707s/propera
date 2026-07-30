'use client'
import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Mail, Lock, Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError('Email atau password salah. Silakan coba lagi.'); setLoading(false); return }
    const inviteToken = new URLSearchParams(window.location.search).get('invite') || localStorage.getItem('pending_invite_token')
    if (inviteToken) {
      localStorage.setItem('pending_invite_token', inviteToken)
      window.location.href = `/accept-invite?token=${inviteToken}`
      return
    }
    window.location.href = '/dashboard'
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', background:'linear-gradient(135deg, #0f1f4b 0%, #1e3a8a 60%, #1e40af 100%)' }}>
      {/* Left branding */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', justifyContent:'center', padding:'3rem', color:'white' }} className="hidden lg:flex">
        <div style={{ display:'flex', alignItems:'center', gap:'1rem', marginBottom:'3rem' }}>
          <img src="/propera-icon.png" alt="Propera" style={{ width:'6rem', height:'6rem', objectFit:'contain' }}/>
          <span style={{ fontFamily:'var(--font-logo)', fontSize:'2.25rem', fontWeight:800, letterSpacing:'0.5px' }}>PROPERA</span>
        </div>
        <h1 style={{ fontSize:'2.5rem', fontWeight:700, lineHeight:1.2, marginBottom:'1.5rem' }}>
          Kelola properti Anda<br/>dengan lebih cerdas
        </h1>
        <p style={{ fontSize:'1.1rem', opacity:0.8, lineHeight:1.7, maxWidth:'420px' }}>
          Platform manajemen kos dan apartemen terpadu. Pantau penyewa, tagihan, dan pendapatan dalam satu dasbor.
        </p>
        <div style={{ marginTop:'3rem', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem', maxWidth:'380px' }}>
          {[{ num:'500+', label:'Pemilik Properti' },{ num:'10K+', label:'Kamar Terkelola' },{ num:'99%', label:'Kepuasan Pengguna' },{ num:'24/7', label:'Akses Platform' }].map(s => (
            <div key={s.num} style={{ background:'rgba(255,255,255,0.1)', borderRadius:'0.75rem', padding:'1rem' }}>
              <div style={{ fontSize:'1.5rem', fontWeight:700 }}>{s.num}</div>
              <div style={{ fontSize:'0.8125rem', opacity:0.7 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right form */}
      <div style={{ width:'100%', maxWidth:'480px', display:'flex', alignItems:'center', justifyContent:'center', padding:'2rem', background:'white' }} className="lg:rounded-l-3xl">
        <div style={{ width:'100%', maxWidth:'380px' }}>
          {/* Mobile logo */}
          <div style={{ display:'flex', alignItems:'center', gap:'0.625rem', marginBottom:'2rem' }} className="lg:hidden">
            <img src="/propera-icon.png" alt="Propera" style={{ width:'3.5rem', height:'3.5rem', objectFit:'contain' }}/>
            <span style={{ fontFamily:'var(--font-logo)', fontWeight:800, fontSize:'1.375rem', color:'#1e3a8a', letterSpacing:'0.3px' }}>PROPERA</span>
          </div>
          <div style={{ marginBottom:'2rem' }}>
            <h2 style={{ fontSize:'1.625rem', fontWeight:700, color:'var(--foreground)' }}>Masuk ke akun Anda</h2>
            <p style={{ color:'var(--muted)', marginTop:'0.25rem' }}>Selamat datang kembali!</p>
          </div>

          {error && <div style={{ background:'#fee2e2', border:'1px solid #fecaca', borderRadius:'0.5rem', padding:'0.75rem', marginBottom:'1rem', color:'#991b1b', fontSize:'0.875rem' }}>{error}</div>}

          <form onSubmit={handleLogin} style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
            <div>
              <label style={{ display:'block', fontWeight:500, marginBottom:'0.375rem', fontSize:'0.875rem' }}>Email</label>
              <div style={{ position:'relative' }}>
                <Mail size={16} style={{ position:'absolute', left:'0.75rem', top:'50%', transform:'translateY(-50%)', color:'var(--muted)' }}/>
                <input type="email" className="form-input" value={email} onChange={e=>setEmail(e.target.value)} placeholder="nama@email.com" style={{ paddingLeft:'2.25rem' }} required/>
              </div>
            </div>
            <div>
              <label style={{ display:'block', fontWeight:500, marginBottom:'0.375rem', fontSize:'0.875rem' }}>Password</label>
              <div style={{ position:'relative' }}>
                <Lock size={16} style={{ position:'absolute', left:'0.75rem', top:'50%', transform:'translateY(-50%)', color:'var(--muted)' }}/>
                <input type={showPassword?'text':'password'} className="form-input" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password Anda" style={{ paddingLeft:'2.25rem', paddingRight:'2.5rem' }} required/>
                <button type="button" onClick={()=>setShowPassword(!showPassword)} style={{ position:'absolute', right:'0.75rem', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--muted)' }}>
                  {showPassword ? <EyeOff size={16}/> : <Eye size={16}/>}
                </button>
              </div>
            </div>
            <button type="submit" className="btn" disabled={loading} style={{ width:'100%', justifyContent:'center', padding:'0.75rem', fontSize:'0.9375rem', marginTop:'0.5rem', background:'#1e3a8a', color:'white', borderRadius:'0.5rem' }}>
              {loading ? 'Memproses...' : 'Masuk'}
            </button>
          </form>

          <p style={{ textAlign:'center', marginTop:'1.5rem', color:'var(--muted)', fontSize:'0.875rem' }}>
            Belum punya akun?{' '}
            <Link href="/register" style={{ color:'#1e3a8a', fontWeight:600, textDecoration:'none' }}>Daftar sekarang</Link>
          </p>
        </div>
      </div>
    </div>
  )
}