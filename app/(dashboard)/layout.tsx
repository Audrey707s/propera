'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { uploadImage } from '@/lib/upload'
import { getAdminContext, clearPermissionCache, type AdminContext } from '@/lib/permissions'
import { LayoutDashboard, Home, Users, CreditCard, DoorOpen, LogOut, Menu, X, FileText, User, Phone, Mail, Edit2, Check, Camera, Shield, BarChart2, History } from 'lucide-react'
import type { Profile } from '@/types'

const ALL_NAV = [
  { href:'/dashboard',   label:'Dashboard',    icon:LayoutDashboard, ownerOnly:false, permKey:null },
  { href:'/properties',  label:'Properti',     icon:Home,            ownerOnly:true,  permKey:null },
  { href:'/rooms',       label:'Kamar',        icon:DoorOpen,        ownerOnly:false, permKey:null },
  { href:'/tenants',     label:'Penyewa',      icon:Users,           ownerOnly:false, permKey:'manage_tenants' },
  { href:'/agreements',  label:'Kontrak Sewa', icon:FileText,        ownerOnly:false, permKey:'view_agreements' },
  { href:'/payments',    label:'Pembayaran',   icon:CreditCard,      ownerOnly:false, permKey:'view_payments' },
  { href:'/history',     label:'Riwayat',      icon:History,         ownerOnly:false, permKey:null },
  { href:'/reports',     label:'Laporan',      icon:BarChart2,       ownerOnly:true,  permKey:null },
  { href:'/admins',      label:'Kelola Admin', icon:Shield,          ownerOnly:true,  permKey:null },
]

function EmailDisplay() {
  const supabase = createClient()
  const [email, setEmail] = useState('')
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setEmail(user?.email || ''))
  }, [])
  return <>{email || '-'}</>
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [ctx, setCtx] = useState<AdminContext | null>(null)
  const [userId, setUserId] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editForm, setEditForm] = useState({ full_name:'', phone:'' })
  const [avatarPreview, setAvatarPreview] = useState<string|null>(null)
  const [avatarFile, setAvatarFile] = useState<File|null>(null)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/login'); return }
      setUserId(user.id)
      const [profileRes, context] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        getAdminContext(),
      ])
      setProfile(profileRes.data)
      setCtx(context)
      setEditForm({ full_name: profileRes.data?.full_name || '', phone: profileRes.data?.phone || '' })
    })
  }, [])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => { setSidebarOpen(false) }, [pathname])

  async function handleLogout() {
    clearPermissionCache()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 30*1024*1024) { alert('Ukuran foto maksimal 30MB'); return }
    setAvatarFile(file); setAvatarPreview(URL.createObjectURL(file))
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    let avatarUrl = profile?.avatar_url || null
    if (avatarFile && userId) {
      setUploadingAvatar(true)
      const url = await uploadImage(avatarFile, 'avatars', `${userId}/avatar`)
      if (url) avatarUrl = url
      setUploadingAvatar(false)
    }
    await supabase.from('profiles').update({ full_name: editForm.full_name, phone: editForm.phone, avatar_url: avatarUrl }).eq('id', userId)
    setProfile(prev => prev ? { ...prev, ...editForm, avatar_url: avatarUrl } : prev)
    setAvatarFile(null); setAvatarPreview(null); setSaving(false); setSaveSuccess(true)
    setTimeout(() => { setSaveSuccess(false); setShowEditModal(false) }, 1200)
  }

  const navItems = ALL_NAV.filter(nav => {
    if (!ctx) return false
    if (nav.ownerOnly && ctx.role !== 'owner') return false
    if (nav.permKey && ctx.role === 'admin_properti') {
      return ctx.permissions[nav.permKey as keyof typeof ctx.permissions] === true
    }
    return true
  })

  const isOwner = ctx?.role === 'owner'
  const currentNav = navItems.find(n => pathname === n.href || (n.href !== '/dashboard' && pathname.startsWith(n.href)))
  const initials = profile?.full_name?.split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase() || 'U'
  const avatarUrl = avatarPreview || profile?.avatar_url

  const mainNav = navItems.filter(n => ['/dashboard','/properties','/rooms','/tenants','/agreements','/payments'].includes(n.href))
  const toolNav = navItems.filter(n => ['/history','/reports'].includes(n.href))
  const adminNav = navItems.filter(n => ['/admins'].includes(n.href))

  const AvatarCircle = ({ size=36, fontSize='0.8125rem' }: { size?:number; fontSize?:string }) => (
    <div style={{ width:size, height:size, borderRadius:'50%', background:avatarUrl?'transparent':'#1e3a8a', color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontSize, fontWeight:700, flexShrink:0, overflow:'hidden' }}>
      {avatarUrl ? <img src={avatarUrl} alt="avatar" style={{ width:'100%', height:'100%', objectFit:'cover' }}/> : initials}
    </div>
  )

  const NavGroup = ({ items, label }: { items: typeof navItems; label?: string }) => (
    <>
      {label && items.length > 0 && <p style={{ fontSize:'0.6875rem', fontWeight:600, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.08em', padding:'0.75rem 0.875rem 0.25rem', marginTop:'0.25rem' }}>{label}</p>}
      {items.map(({ href, label:lbl, icon:Icon }) => {
        const isActive = pathname===href || (href!=='/dashboard' && pathname.startsWith(href))
        return (
          <Link key={href} href={href} className={`nav-item ${isActive?'active':''}`}>
            <Icon size={17}/><span>{lbl}</span>
          </Link>
        )
      })}
    </>
  )

  const SidebarContent = () => (
    <>
      {/* Logo Propera */}
      <div style={{ padding:'1rem 1.25rem', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
          <img src="/propera-icon.png" alt="Propera" style={{ width:'3rem', height:'3rem', objectFit:'contain' }}/>
          <span style={{ fontFamily:'var(--font-logo)', fontWeight:800, fontSize:'1.125rem', color:'#1e3a8a', letterSpacing:'0.3px' }}>PROPERA</span>
        </div>
        <button onClick={() => setSidebarOpen(false)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--muted)', padding:'0.25rem', display:'none' }} id="sidebar-close-btn"><X size={20}/></button>
      </div>

      <nav style={{ flex:1, padding:'0.5rem 0.75rem', overflowY:'auto' }}>
        <NavGroup items={mainNav} label="Menu Utama"/>
        <NavGroup items={toolNav} label="Alat Bantu"/>
        <NavGroup items={adminNav} label="Pengaturan"/>
      </nav>

      <div style={{ padding:'0.75rem', borderTop:'1px solid var(--border)' }}>
        {!isOwner && (
          <div style={{ background:'#fef3c7', borderRadius:'0.5rem', padding:'0.5rem 0.75rem', marginBottom:'0.5rem', display:'flex', alignItems:'center', gap:'0.5rem' }}>
            <Shield size={13} color="#d97706"/>
            <span style={{ fontSize:'0.75rem', color:'#92400e', fontWeight:500 }}>Admin Properti</span>
          </div>
        )}
        <div style={{ display:'flex', alignItems:'center', gap:'0.625rem', padding:'0.625rem', background:'var(--surface-2)', borderRadius:'0.5rem' }}>
          <AvatarCircle size={32} fontSize="0.75rem"/>
          <div style={{ minWidth:0 }}>
            <div style={{ fontWeight:600, fontSize:'0.8125rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{profile?.full_name||'Pengguna'}</div>
            <div style={{ fontSize:'0.75rem', color:'var(--muted)' }}>{isOwner?'Pemilik Properti':'Admin Properti'}</div>
          </div>
        </div>
      </div>
    </>
  )

  return (
    <>
      <style>{`
        .layout-wrapper{display:flex;min-height:100vh;background:var(--background)}
        .sidebar-desktop{width:var(--sidebar-width);background:white;border-right:1px solid var(--border);display:flex;flex-direction:column;flex-shrink:0;height:100vh;position:sticky;top:0}
        .sidebar-mobile{display:none;position:fixed;top:0;left:0;width:var(--sidebar-width);height:100vh;background:white;border-right:1px solid var(--border);flex-direction:column;z-index:50;transform:translateX(-100%);transition:transform 0.25s ease}
        .sidebar-mobile.open{transform:translateX(0)}
        .mobile-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:49;backdrop-filter:blur(2px)}
        .hamburger-btn{display:none}
        @media(max-width:1023px){
          .sidebar-desktop{display:none}
          .sidebar-mobile{display:flex}
          .mobile-overlay{display:block}
          .hamburger-btn{display:flex}
          #sidebar-close-btn{display:flex!important}
        }
      `}</style>

      <div className="layout-wrapper">
        <aside className="sidebar-desktop"><SidebarContent/></aside>
        {sidebarOpen && <div className="mobile-overlay" onClick={()=>setSidebarOpen(false)}/>}
        <aside className={`sidebar-mobile ${sidebarOpen?'open':''}`}><SidebarContent/></aside>

        <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0, overflow:'hidden' }}>
          <header style={{ background:'white', borderBottom:'1px solid var(--border)', padding:'0 1.25rem', height:'3.5rem', display:'flex', alignItems:'center', gap:'0.875rem', position:'sticky', top:0, zIndex:30 }}>
            <button className="hamburger-btn" onClick={()=>setSidebarOpen(p=>!p)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--foreground)', alignItems:'center', justifyContent:'center', padding:'0.375rem', borderRadius:'0.375rem' }}>
              <Menu size={22}/>
            </button>
            <span style={{ fontWeight:600, fontSize:'0.9375rem' }}>{currentNav?.label||'Propera'}</span>
            {!isOwner && (
              <span style={{ display:'inline-flex', alignItems:'center', gap:'0.375rem', background:'#fef3c7', color:'#92400e', borderRadius:'999px', padding:'0.125rem 0.625rem', fontSize:'0.75rem', fontWeight:600 }}>
                <Shield size={11}/> Admin Properti
              </span>
            )}

            <div ref={profileRef} style={{ marginLeft:'auto', position:'relative' }}>
              <button onClick={()=>setProfileOpen(p=>!p)} style={{ background:'none', border:'none', cursor:'pointer', padding:0, borderRadius:'50%' }}>
                <AvatarCircle size={36}/>
              </button>

              {profileOpen && (
                <div style={{ position:'absolute', right:0, top:'calc(100% + 0.5rem)', background:'white', border:'1px solid var(--border)', borderRadius:'0.75rem', boxShadow:'0 8px 30px rgba(0,0,0,0.12)', width:'280px', zIndex:50, overflow:'hidden' }} className="animate-in">
                  <div style={{ padding:'1.125rem 1.25rem', background:'linear-gradient(135deg,#1e3a8a,#1e40af)', color:'white' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
                      <div style={{ width:'2.75rem', height:'2.75rem', borderRadius:'50%', overflow:'hidden', background:'rgba(255,255,255,0.25)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1rem', fontWeight:700, flexShrink:0 }}>
                        {avatarUrl ? <img src={avatarUrl} alt="avatar" style={{ width:'100%', height:'100%', objectFit:'cover' }}/> : initials}
                      </div>
                      <div style={{ minWidth:0 }}>
                        <div style={{ fontWeight:700, fontSize:'0.9375rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{profile?.full_name||'Pengguna'}</div>
                        <div style={{ fontSize:'0.75rem', opacity:0.85, marginTop:'0.125rem' }}>{isOwner?'Pemilik Properti':'Admin Properti'}</div>
                      </div>
                    </div>
                  </div>
                  <div style={{ padding:'0.75rem 1rem', borderBottom:'1px solid var(--border)' }}>
                    {profile?.phone && <div style={{ display:'flex', alignItems:'center', gap:'0.625rem', padding:'0.3rem 0', fontSize:'0.8125rem', color:'var(--muted)' }}><Phone size={13}/><span>{profile.phone}</span></div>}
                    <div style={{ display:'flex', alignItems:'center', gap:'0.625rem', padding:'0.3rem 0', fontSize:'0.8125rem', color:'var(--muted)' }}><Mail size={13}/><span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}><EmailDisplay/></span></div>
                  </div>
                  <div style={{ padding:'0.5rem' }}>
                    <button onClick={()=>{setProfileOpen(false);setShowEditModal(true)}} style={{ width:'100%', display:'flex', alignItems:'center', gap:'0.625rem', padding:'0.625rem 0.75rem', borderRadius:'0.5rem', background:'none', border:'none', cursor:'pointer', fontSize:'0.875rem', color:'var(--foreground)', fontWeight:500 }} onMouseEnter={e=>(e.currentTarget.style.background='var(--surface-2)')} onMouseLeave={e=>(e.currentTarget.style.background='none')}>
                      <Edit2 size={15} color="#1e3a8a"/> Edit Profil
                    </button>
                    <button onClick={handleLogout} style={{ width:'100%', display:'flex', alignItems:'center', gap:'0.625rem', padding:'0.625rem 0.75rem', borderRadius:'0.5rem', background:'none', border:'none', cursor:'pointer', fontSize:'0.875rem', color:'#ef4444', fontWeight:500 }} onMouseEnter={e=>(e.currentTarget.style.background='#fee2e2')} onMouseLeave={e=>(e.currentTarget.style.background='none')}>
                      <LogOut size={15}/> Keluar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </header>

          <main style={{ flex:1, padding:'1.5rem', width:'100%', maxWidth:'1280px', margin:'0 auto', boxSizing:'border-box' }}>
            {children}
          </main>
        </div>
      </div>

      {showEditModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth:'440px' }}>
            <h2 style={{ fontWeight:700, fontSize:'1.125rem', marginBottom:'1.5rem' }}>Edit Profil</h2>
            <form onSubmit={handleSaveProfile} style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'0.75rem', marginBottom:'0.5rem' }}>
                <div style={{ position:'relative' }}>
                  <div style={{ width:'5rem', height:'5rem', borderRadius:'50%', overflow:'hidden', background:avatarUrl?'transparent':'#1e3a8a', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.5rem', fontWeight:700, color:'white', border:'3px solid var(--border)' }}>
                    {avatarUrl ? <img src={avatarUrl} alt="avatar" style={{ width:'100%', height:'100%', objectFit:'cover' }}/> : initials}
                  </div>
                  <button type="button" onClick={()=>avatarInputRef.current?.click()} style={{ position:'absolute', bottom:0, right:0, width:'1.75rem', height:'1.75rem', borderRadius:'50%', background:'#1e3a8a', color:'white', border:'2px solid white', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
                    <Camera size={13}/>
                  </button>
                </div>
                <input ref={avatarInputRef} type="file" accept="image/*" onChange={handleAvatarChange} style={{ display:'none' }}/>
                <button type="button" onClick={()=>avatarInputRef.current?.click()} style={{ fontSize:'0.8125rem', color:'#1e3a8a', background:'none', border:'none', cursor:'pointer', fontWeight:500 }}>
                  {avatarFile ? `✓ ${avatarFile.name}` : 'Ganti foto profil'}
                </button>
              </div>
              <div>
                <label style={{ display:'block', fontWeight:500, marginBottom:'0.375rem', fontSize:'0.875rem' }}>Nama Lengkap</label>
                <div style={{ position:'relative' }}>
                  <User size={15} style={{ position:'absolute', left:'0.75rem', top:'50%', transform:'translateY(-50%)', color:'var(--muted)' }}/>
                  <input type="text" className="form-input" value={editForm.full_name} onChange={e=>setEditForm({...editForm,full_name:e.target.value})} style={{ paddingLeft:'2.25rem' }} required/>
                </div>
              </div>
              <div>
                <label style={{ display:'block', fontWeight:500, marginBottom:'0.375rem', fontSize:'0.875rem' }}>Nomor HP</label>
                <div style={{ position:'relative' }}>
                  <Phone size={15} style={{ position:'absolute', left:'0.75rem', top:'50%', transform:'translateY(-50%)', color:'var(--muted)' }}/>
                  <input type="tel" className="form-input" value={editForm.phone} onChange={e=>setEditForm({...editForm,phone:e.target.value})} style={{ paddingLeft:'2.25rem' }}/>
                </div>
              </div>
              <div style={{ background:'var(--surface-2)', borderRadius:'0.5rem', padding:'0.75rem', fontSize:'0.8125rem', color:'var(--muted)' }}>
                ⓘ Email tidak bisa diubah karena digunakan untuk login.
              </div>
              <div style={{ display:'flex', gap:'0.75rem', justifyContent:'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={()=>{setShowEditModal(false);setAvatarFile(null);setAvatarPreview(null)}}>Batal</button>
                <button type="submit" className="btn btn-primary" disabled={saving} style={{ minWidth:'130px', justifyContent:'center', background:'#1e3a8a' }}>
                  {saveSuccess?<><Check size={15}/> Tersimpan!</>:saving?(uploadingAvatar?'Mengupload...':'Menyimpan...'):'Simpan Profil'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}