'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { uploadImage } from '@/lib/upload'
import { formatDate } from '@/lib/utils'
import { Plus, Users, Edit2, Trash2, Search, Phone, Mail, Camera } from 'lucide-react'
import type { Tenant } from '@/types'

const emptyForm = { full_name:'', nik:'', phone:'', email:'', emergency_contact_name:'', emergency_contact_phone:'', occupation:'', notes:'' }

export default function TenantsPage() {
  const supabase = createClient()
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [userId, setUserId] = useState('')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [detailTenant, setDetailTenant] = useState<Tenant|null>(null)
  const [editId, setEditId] = useState<string|null>(null)
  const [form, setForm] = useState(emptyForm)
  const [photoFile, setPhotoFile] = useState<File|null>(null)
  const [photoPreview, setPhotoPreview] = useState<string|null>(null)
  const [currentPhotoUrl, setCurrentPhotoUrl] = useState<string|null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const photoInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) { setUserId(user.id); loadTenants(user.id) }
    })
  }, [])

  async function loadTenants(uid: string) {
    const { data } = await supabase.from('tenants').select('*').eq('owner_id', uid).order('full_name')
    setTenants(data||[]); setLoading(false)
  }

  function openAdd() {
    setEditId(null); setForm(emptyForm)
    setPhotoFile(null); setPhotoPreview(null); setCurrentPhotoUrl(null)
    setError(''); setShowModal(true)
  }
  function openEdit(t: Tenant) {
    setEditId(t.id)
    setForm({ full_name:t.full_name, nik:t.nik||'', phone:t.phone, email:t.email||'', emergency_contact_name:t.emergency_contact_name||'', emergency_contact_phone:t.emergency_contact_phone||'', occupation:t.occupation||'', notes:t.notes||'' })
    setPhotoFile(null); setPhotoPreview(null); setCurrentPhotoUrl(t.photo_url||null)
    setError(''); setDetailTenant(null); setShowModal(true)
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10*1024*1024) { alert('Ukuran foto maksimal 10MB'); return }
    setPhotoFile(file); setPhotoPreview(URL.createObjectURL(file))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    let photo_url = currentPhotoUrl
    if (photoFile && userId) {
      const path = editId ? `tenants/${editId}/photo` : `tenants/${userId}/${Date.now()}/photo`
      const url = await uploadImage(photoFile, 'property-images', path)
      if (url) photo_url = url
    }
    const payload = { ...form, owner_id: userId, photo_url }
    const { error: err } = editId
      ? await supabase.from('tenants').update(payload).eq('id', editId)
      : await supabase.from('tenants').insert(payload)
    if (err) { setError(err.message); setSaving(false); return }
    setShowModal(false); loadTenants(userId); setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Hapus penyewa ini?')) return
    await supabase.from('tenants').delete().eq('id', id); loadTenants(userId)
  }

  const filtered = tenants.filter(t => {
    const q = search.toLowerCase()
    return !q || t.full_name.toLowerCase().includes(q) || t.phone.includes(q) || t.email?.toLowerCase().includes(q)
  })

  const displayPhoto = photoPreview || currentPhotoUrl

  return (
    <div className="animate-in">
      <div className="page-header">
        <div><h1 className="page-title">Penyewa</h1><p className="page-subtitle">Kelola data penyewa properti Anda</p></div>
        <button className="btn btn-primary" onClick={openAdd}><Plus size={16}/> Tambah Penyewa</button>
      </div>

      <div style={{ display:'flex', gap:'0.75rem', marginBottom:'1.25rem' }}>
        <div style={{ position:'relative', flex:1, maxWidth:'360px' }}>
          <Search size={15} style={{ position:'absolute', left:'0.75rem', top:'50%', transform:'translateY(-50%)', color:'var(--muted)' }}/>
          <input className="form-input" placeholder="Cari nama, HP, email..." value={search} onChange={e=>setSearch(e.target.value)} style={{ paddingLeft:'2.25rem' }}/>
        </div>
        <div style={{ background:'white', border:'1px solid var(--border)', borderRadius:'0.5rem', padding:'0.5rem 1rem', display:'flex', gap:'0.5rem', alignItems:'center' }}>
          <span style={{ fontSize:'0.8125rem', color:'var(--muted)' }}>Total:</span>
          <span style={{ fontWeight:700, color:'var(--primary)' }}>{tenants.length}</span>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:'3rem', color:'var(--muted)' }}>Memuat penyewa...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign:'center', padding:'4rem', background:'white', borderRadius:'0.75rem', border:'1px solid var(--border)' }}>
          <Users size={48} style={{ margin:'0 auto 1rem', color:'#cbd5e1' }}/>
          <p style={{ color:'var(--muted)', marginBottom:'1rem' }}>{tenants.length===0?'Belum ada penyewa.':'Tidak ditemukan.'}</p>
          {tenants.length===0 && <button className="btn btn-primary" onClick={openAdd}><Plus size={16}/> Tambah Penyewa</button>}
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:'1rem' }}>
          {filtered.map(t => (
            <div key={t.id} className="card" style={{ cursor:'pointer', padding:0, overflow:'hidden' }} onClick={()=>setDetailTenant(t)}>
              <div style={{ padding:'1.125rem', display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'0.5rem' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
                  <div style={{ width:'3rem', height:'3rem', borderRadius:'50%', overflow:'hidden', background:'var(--primary)', color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.125rem', fontWeight:700, flexShrink:0 }}>
                    {t.photo_url ? <img src={t.photo_url} alt={t.full_name} style={{ width:'100%', height:'100%', objectFit:'cover' }}/> : t.full_name[0].toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight:600, fontSize:'0.9375rem' }}>{t.full_name}</div>
                    <div style={{ fontSize:'0.8125rem', color:'var(--muted)' }}>{t.occupation||'Penyewa'}</div>
                  </div>
                </div>
                <span className={`badge ${t.is_active?'badge-green':'badge-gray'}`}>{t.is_active?'Aktif':'Nonaktif'}</span>
              </div>
              <div style={{ padding:'0 1.125rem 1rem', display:'flex', flexDirection:'column', gap:'0.375rem' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', fontSize:'0.8125rem', color:'var(--muted)' }}><Phone size={13}/><span>{t.phone}</span></div>
                {t.email && <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', fontSize:'0.8125rem', color:'var(--muted)' }}><Mail size={13}/><span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.email}</span></div>}
              </div>
              <div style={{ borderTop:'1px solid var(--border)', padding:'0.75rem 1.125rem', display:'flex', gap:'0.5rem' }} onClick={e=>e.stopPropagation()}>
                <button className="btn btn-secondary btn-sm" style={{ flex:1, justifyContent:'center' }} onClick={()=>openEdit(t)}><Edit2 size={13}/> Edit</button>
                <button className="btn btn-danger btn-sm" onClick={()=>handleDelete(t.id)}><Trash2 size={13}/></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {detailTenant && (
        <div className="modal-overlay" onClick={()=>setDetailTenant(null)}>
          <div className="modal-content" onClick={e=>e.stopPropagation()} style={{ maxWidth:'440px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'1rem', marginBottom:'1.5rem' }}>
              <div style={{ width:'4rem', height:'4rem', borderRadius:'50%', overflow:'hidden', background:'var(--primary)', color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.375rem', fontWeight:700, flexShrink:0 }}>
                {detailTenant.photo_url ? <img src={detailTenant.photo_url} alt={detailTenant.full_name} style={{ width:'100%', height:'100%', objectFit:'cover' }}/> : detailTenant.full_name[0].toUpperCase()}
              </div>
              <div>
                <h2 style={{ fontWeight:700, fontSize:'1.125rem' }}>{detailTenant.full_name}</h2>
                <span className={`badge ${detailTenant.is_active?'badge-green':'badge-gray'}`}>{detailTenant.is_active?'Aktif':'Nonaktif'}</span>
              </div>
            </div>
            {[
              {label:'NIK',value:detailTenant.nik},{label:'No. HP',value:detailTenant.phone},
              {label:'Email',value:detailTenant.email},{label:'Pekerjaan',value:detailTenant.occupation},
              {label:'Kontak Darurat',value:detailTenant.emergency_contact_name},{label:'HP Darurat',value:detailTenant.emergency_contact_phone},
              {label:'Catatan',value:detailTenant.notes},{label:'Terdaftar',value:formatDate(detailTenant.created_at)},
            ].filter(r=>r.value).map(({label,value})=>(
              <div key={label} style={{ display:'flex', gap:'1rem', padding:'0.625rem 0', borderBottom:'1px solid var(--border)', fontSize:'0.875rem' }}>
                <span style={{ color:'var(--muted)', minWidth:'120px' }}>{label}</span>
                <span style={{ fontWeight:500 }}>{value}</span>
              </div>
            ))}
            <div style={{ display:'flex', gap:'0.75rem', marginTop:'1.25rem' }}>
              <button className="btn btn-secondary" style={{ flex:1, justifyContent:'center' }} onClick={()=>openEdit(detailTenant)}>Edit Data</button>
              <button className="btn btn-secondary" style={{ flex:1, justifyContent:'center' }} onClick={()=>setDetailTenant(null)}>Tutup</button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 style={{ fontWeight:700, fontSize:'1.125rem', marginBottom:'1.25rem' }}>{editId?'Edit Data Penyewa':'Tambah Penyewa Baru'}</h2>
            {error && <div style={{ background:'#fee2e2', borderRadius:'0.5rem', padding:'0.75rem', marginBottom:'1rem', color:'#991b1b', fontSize:'0.875rem' }}>{error}</div>}
            <form onSubmit={handleSave} style={{ display:'flex', flexDirection:'column', gap:'0.875rem' }}>
              {/* Foto */}
              <div style={{ display:'flex', alignItems:'center', gap:'1rem', padding:'0.75rem', background:'var(--surface-2)', borderRadius:'0.625rem' }}>
                <div style={{ position:'relative', flexShrink:0 }}>
                  <div style={{ width:'4rem', height:'4rem', borderRadius:'50%', overflow:'hidden', background:displayPhoto?'transparent':'var(--primary)', color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.25rem', fontWeight:700, border:'2px solid var(--border)' }}>
                    {displayPhoto ? <img src={displayPhoto} alt="foto" style={{ width:'100%', height:'100%', objectFit:'cover' }}/> : (form.full_name?form.full_name[0].toUpperCase():'?')}
                  </div>
                  <button type="button" onClick={()=>photoInputRef.current?.click()} style={{ position:'absolute', bottom:0, right:0, width:'1.5rem', height:'1.5rem', borderRadius:'50%', background:'var(--primary)', color:'white', border:'2px solid white', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
                    <Camera size={11}/>
                  </button>
                </div>
                <div>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={()=>photoInputRef.current?.click()}>
                    <Camera size={13}/> {photoFile ? `✓ ${photoFile.name}` : 'Pilih Foto Penyewa'}
                  </button>
                  <p style={{ fontSize:'0.75rem', color:'var(--muted)', marginTop:'0.25rem' }}>Maks. 10MB · JPG, PNG</p>
                </div>
                <input ref={photoInputRef} type="file" accept="image/*" onChange={handlePhotoChange} style={{ display:'none' }}/>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.875rem' }}>
                <div style={{ gridColumn:'1/-1' }}>
                  <label style={{ display:'block', fontWeight:500, marginBottom:'0.375rem', fontSize:'0.875rem' }}>Nama Lengkap</label>
                  <input type="text" className="form-input" value={form.full_name} onChange={e=>setForm({...form,full_name:e.target.value})} placeholder="Nama lengkap penyewa" required/>
                </div>
                <div>
                  <label style={{ display:'block', fontWeight:500, marginBottom:'0.375rem', fontSize:'0.875rem' }}>NIK <span style={{ fontWeight:400, color:'var(--muted)' }}>(opsional)</span></label>
                  <input type="text" className="form-input" value={form.nik} onChange={e=>setForm({...form,nik:e.target.value})} placeholder="16 digit NIK"/>
                </div>
                <div>
                  <label style={{ display:'block', fontWeight:500, marginBottom:'0.375rem', fontSize:'0.875rem' }}>Nomor HP</label>
                  <input type="tel" className="form-input" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="08xx-xxxx-xxxx" required/>
                </div>
                <div>
                  <label style={{ display:'block', fontWeight:500, marginBottom:'0.375rem', fontSize:'0.875rem' }}>Email</label>
                  <input type="email" className="form-input" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="email@contoh.com"/>
                </div>
                <div>
                  <label style={{ display:'block', fontWeight:500, marginBottom:'0.375rem', fontSize:'0.875rem' }}>Pekerjaan</label>
                  <input type="text" className="form-input" value={form.occupation} onChange={e=>setForm({...form,occupation:e.target.value})} placeholder="Mahasiswa, Karyawan..."/>
                </div>
              </div>

              <div style={{ background:'var(--surface-2)', borderRadius:'0.625rem', padding:'1rem' }}>
                <p style={{ fontWeight:500, fontSize:'0.875rem', marginBottom:'0.75rem' }}>Kontak Darurat</p>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.75rem' }}>
                  <div>
                    <label style={{ display:'block', fontWeight:400, marginBottom:'0.375rem', fontSize:'0.8125rem', color:'var(--muted)' }}>Nama</label>
                    <input type="text" className="form-input" value={form.emergency_contact_name} onChange={e=>setForm({...form,emergency_contact_name:e.target.value})} placeholder="Nama kontak darurat"/>
                  </div>
                  <div>
                    <label style={{ display:'block', fontWeight:400, marginBottom:'0.375rem', fontSize:'0.8125rem', color:'var(--muted)' }}>No. HP</label>
                    <input type="tel" className="form-input" value={form.emergency_contact_phone} onChange={e=>setForm({...form,emergency_contact_phone:e.target.value})} placeholder="08xx-xxxx-xxxx"/>
                  </div>
                </div>
              </div>

              <div>
                <label style={{ display:'block', fontWeight:500, marginBottom:'0.375rem', fontSize:'0.875rem' }}>Catatan</label>
                <textarea className="form-input" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} rows={2} style={{ resize:'vertical' }}/>
              </div>
              <div style={{ display:'flex', gap:'0.75rem', justifyContent:'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={()=>setShowModal(false)}>Batal</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving?'Menyimpan...':editId?'Simpan Perubahan':'Tambah Penyewa'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}