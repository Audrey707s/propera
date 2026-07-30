'use client'
import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Mail, Lock, User, Phone, Eye, EyeOff } from 'lucide-react'

export default function RegisterPage() {
  const supabase = createClient()
  const [form, setForm] = useState({ full_name:'', phone:'', email:'', password:'', confirm_password:'' })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault(); setError('')
    if (form.password !== form.confirm_password) { setError('Password tidak cocok.'); return }
    if (form.password.length < 6) { setError('Password minimal 6 karakter.'); return }
    setLoading(true)
    const { error } = await supabase.auth.signUp({
      email: form.email, password: form.password,
      options: { data: { full_name: form.full_name, phone: form.phone } }
    })
    if (error) { setError(error.message); setLoading(false); return }
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
      {/* Left */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', justifyContent:'center', padding:'3rem', color:'white' }} className="hidden lg:flex">
        <div style={{ display:'flex', alignItems:'center', gap:'1rem', marginBottom:'3rem' }}>
          <img src="/propera-icon.png" alt="Propera" style={{ width:'6rem', height:'6rem', objectFit:'contain' }}/>
          <span style={{ fontFamily:'var(--font-logo)', fontSize:'2.25rem', fontWeight:800, letterSpacing:'0.5px' }}>PROPERA</span>
        </div>
        <h1 style={{ fontSize:'2.5rem', fontWeight:700, lineHeight:1.2, marginBottom:'1.5rem' }}>Mulai kelola properti Anda hari ini</h1>
        <p style={{ fontSize:'1.1rem', opacity:0.8, lineHeight:1.7, maxWidth:'420px' }}>Daftar gratis dan nikmati kemudahan mengelola kos, apartemen, dan properti sewa lainnya.</p>
        <div style={{ marginTop:'2.5rem', display:'flex', flexDirection:'column', gap:'1rem' }}>
          {['Manajemen penyewa & kamar terpusat','Tagihan & pembayaran otomatis','Laporan keuangan real-time','Sistem admin dengan hak akses terbatas'].map(f => (
            <div key={f} style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
              <div style={{ width:'1.25rem', height:'1.25rem', borderRadius:'50%', background:'rgba(255,255,255,0.25)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.75rem', flexShrink:0 }}>✓</div>
              <span style={{ opacity:0.9 }}>{f}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right */}
      <div style={{ width:'100%', maxWidth:'480px', display:'flex', alignItems:'center', justifyContent:'center', padding:'2rem', background:'white' }} className="lg:rounded-l-3xl">
        <div style={{ width:'100%', maxWidth:'380px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'0.625rem', marginBottom:'1.75rem' }} className="lg:hidden">
            <img src="/propera-icon.png" alt="Propera" style={{ width:'3.5rem', height:'3.5rem', objectFit:'contain' }}/>
            <span style={{ fontFamily:'var(--font-logo)', fontWeight:800, fontSize:'1.375rem', color:'#1e3a8a', letterSpacing:'0.3px' }}>PROPERA</span>
          </div>
          <div style={{ marginBottom:'1.75rem' }}>
            <h2 style={{ fontSize:'1.625rem', fontWeight:700 }}>Buat akun baru</h2>
            <p style={{ color:'var(--muted)', marginTop:'0.25rem' }}>Gratis untuk pemilik properti</p>
          </div>
          {error && <div style={{ background:'#fee2e2', border:'1px solid #fecaca', borderRadius:'0.5rem', padding:'0.75rem', marginBottom:'1rem', color:'#991b1b', fontSize:'0.875rem' }}>{error}</div>}
          <form onSubmit={handleRegister} style={{ display:'flex', flexDirection:'column', gap:'0.875rem' }}>
            {[
              { label:'Nama Lengkap', key:'full_name', type:'text', placeholder:'Nama lengkap Anda', icon:User },
              { label:'Nomor HP', key:'phone', type:'tel', placeholder:'08xx-xxxx-xxxx', icon:Phone },
              { label:'Email', key:'email', type:'email', placeholder:'nama@email.com', icon:Mail },
            ].map(({ label, key, type, placeholder, icon:Icon }) => (
              <div key={key}>
                <label style={{ display:'block', fontWeight:500, marginBottom:'0.375rem', fontSize:'0.875rem' }}>{label}</label>
                <div style={{ position:'relative' }}>
                  <Icon size={16} style={{ position:'absolute', left:'0.75rem', top:'50%', transform:'translateY(-50%)', color:'var(--muted)' }}/>
                  <input type={type} className="form-input" value={form[key as keyof typeof form]} onChange={e=>setForm({...form,[key]:e.target.value})} placeholder={placeholder} style={{ paddingLeft:'2.25rem' }} required/>
                </div>
              </div>
            ))}
            {[{ label:'Password', key:'password' },{ label:'Konfirmasi Password', key:'confirm_password' }].map(({ label, key }) => (
              <div key={key}>
                <label style={{ display:'block', fontWeight:500, marginBottom:'0.375rem', fontSize:'0.875rem' }}>{label}</label>
                <div style={{ position:'relative' }}>
                  <Lock size={16} style={{ position:'absolute', left:'0.75rem', top:'50%', transform:'translateY(-50%)', color:'var(--muted)' }}/>
                  <input type={showPassword?'text':'password'} className="form-input" value={form[key as keyof typeof form]} onChange={e=>setForm({...form,[key]:e.target.value})} placeholder="Min. 6 karakter" style={{ paddingLeft:'2.25rem', paddingRight:'2.5rem' }} required/>
                  {key==='password' && (
                    <button type="button" onClick={()=>setShowPassword(!showPassword)} style={{ position:'absolute', right:'0.75rem', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--muted)' }}>
                      {showPassword ? <EyeOff size={16}/> : <Eye size={16}/>}
                    </button>
                  )}
                </div>
              </div>
            ))}
            <button type="submit" className="btn" disabled={loading} style={{ width:'100%', justifyContent:'center', padding:'0.75rem', fontSize:'0.9375rem', marginTop:'0.25rem', background:'#1e3a8a', color:'white', borderRadius:'0.5rem' }}>
              {loading ? 'Memproses...' : 'Daftar Sekarang'}
            </button>
          </form>
          <p style={{ textAlign:'center', marginTop:'1.5rem', color:'var(--muted)', fontSize:'0.875rem' }}>
            Sudah punya akun? <Link href="/login" style={{ color:'#1e3a8a', fontWeight:600, textDecoration:'none' }}>Masuk di sini</Link>
          </p>
        </div>
      </div>
    </div>
  )
}