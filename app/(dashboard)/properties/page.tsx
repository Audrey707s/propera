'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { uploadImage } from '@/lib/upload'
import { getPropertyTypeLabel } from '@/lib/utils'
import { Plus, Building2, MapPin, Edit2, Trash2 } from 'lucide-react'
import ImageCarousel from '@/components/ImageCarousel'
import type { Property, PropertyType } from '@/types'

const emptyForm = { name:'', address:'', city:'', description:'', property_type:'kos' as PropertyType, total_rooms:'0', facilities:'' }

export default function PropertiesPage() {
  const supabase = createClient()
  const [properties, setProperties] = useState<(Property & { image_urls?: string[] })[]>([])
  const [userId, setUserId] = useState('')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string|null>(null)
  const [form, setForm] = useState(emptyForm)
  const [images, setImages] = useState<string[]>([]) // current saved image URLs
  const [saving, setSaving] = useState(false)
  const [uploadingImg, setUploadingImg] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) { setUserId(user.id); loadProperties(user.id) }
    })
  }, [])

  async function loadProperties(uid: string) {
    const { data } = await supabase.from('properties').select('*').eq('owner_id', uid).order('created_at', { ascending:false })
    setProperties(data || []); setLoading(false)
  }

  function openAdd() {
    setEditId(null); setForm(emptyForm); setImages([]); setError(''); setShowModal(true)
  }
  function openEdit(p: Property & { image_urls?: string[] }) {
    setEditId(p.id)
    setForm({ name:p.name, address:p.address, city:p.city, description:p.description||'', property_type:p.property_type, total_rooms:String(p.total_rooms), facilities:(p.facilities||[]).join(', ') })
    // Support both old single image_url and new image_urls array
    const imgs = p.image_urls?.length ? p.image_urls : (p.image_url ? [p.image_url] : [])
    setImages(imgs); setError(''); setShowModal(true)
  }

  async function handleAddImage(file: File) {
    if (!userId) return
    setUploadingImg(true)
    const path = `properties/${editId||userId+'_new'}/${Date.now()}/img`
    const url = await uploadImage(file, 'property-images', path)
    if (url) setImages(prev => [...prev, url])
    setUploadingImg(false)
  }

  async function handleDeleteImage(index: number) {
    setImages(prev => prev.filter((_,i) => i !== index))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    const payload = {
      name:form.name, address:form.address, city:form.city, description:form.description,
      property_type:form.property_type, total_rooms:parseInt(form.total_rooms)||0,
      facilities:form.facilities?form.facilities.split(',').map(f=>f.trim()).filter(Boolean):[],
      image_url: images[0]||null,       // backward compat
      image_urls: images,               // new multi-image
      owner_id: userId
    }
    const { error:err } = editId
      ? await supabase.from('properties').update(payload).eq('id', editId)
      : await supabase.from('properties').insert(payload)
    if (err) { setError(err.message); setSaving(false); return }
    setShowModal(false); loadProperties(userId); setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Hapus properti ini?')) return
    await supabase.from('properties').delete().eq('id', id); loadProperties(userId)
  }

  const typeColors: Record<string,string> = { kos:'badge-blue', apartemen:'badge-purple', kontrakan:'badge-green' }

  return (
    <div className="animate-in">
      <div className="page-header">
        <div><h1 className="page-title">Properti</h1><p className="page-subtitle">Kelola semua properti sewaan Anda</p></div>
        <button className="btn btn-primary" onClick={openAdd}><Plus size={16}/> Tambah Properti</button>
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:'3rem', color:'var(--muted)' }}>Memuat properti...</div>
      ) : properties.length===0 ? (
        <div style={{ textAlign:'center', padding:'4rem', background:'white', borderRadius:'0.75rem', border:'1px solid var(--border)' }}>
          <Building2 size={48} style={{ margin:'0 auto 1rem', color:'#cbd5e1' }}/>
          <h3 style={{ fontWeight:600, marginBottom:'0.5rem' }}>Belum ada properti</h3>
          <p style={{ color:'var(--muted)', marginBottom:'1.5rem' }}>Tambahkan properti pertama Anda</p>
          <button className="btn btn-primary" onClick={openAdd}><Plus size={16}/> Tambah Properti</button>
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(320px, 1fr))', gap:'1rem' }}>
          {properties.map(p => {
            const imgs = p.image_urls?.length ? p.image_urls : (p.image_url ? [p.image_url] : [])
            return (
              <div key={p.id} className="card" style={{ padding:0, overflow:'hidden' }}>
                <ImageCarousel images={imgs} alt={p.name} height={170}/>
                <div style={{ padding:'1rem' }}>
                  <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'0.5rem', marginBottom:'0.5rem' }}>
                    <div>
                      <div style={{ fontWeight:600, fontSize:'0.9375rem' }}>{p.name}</div>
                      <span className={`badge ${typeColors[p.property_type]||'badge-gray'}`}>{getPropertyTypeLabel(p.property_type)}</span>
                    </div>
                    <div style={{ display:'flex', gap:'0.25rem', flexShrink:0 }}>
                      <button className="btn btn-secondary btn-sm" onClick={()=>openEdit(p)}><Edit2 size={13}/></button>
                      <button className="btn btn-danger btn-sm" onClick={()=>handleDelete(p.id)}><Trash2 size={13}/></button>
                    </div>
                  </div>
                  <div style={{ display:'flex', alignItems:'flex-start', gap:'0.375rem', color:'var(--muted)', fontSize:'0.8125rem', marginBottom:'0.625rem' }}>
                    <MapPin size={13} style={{ marginTop:'2px', flexShrink:0 }}/><span>{p.address}, {p.city}</span>
                  </div>
                  {p.description && <p style={{ fontSize:'0.8125rem', color:'var(--muted)', lineHeight:1.5, marginBottom:'0.625rem' }}>{p.description}</p>}
                  <div style={{ display:'flex', gap:'1rem', paddingTop:'0.625rem', borderTop:'1px solid var(--border)' }}>
                    <div><div style={{ fontSize:'1.125rem', fontWeight:700, color:'var(--primary)' }}>{p.total_rooms}</div><div style={{ fontSize:'0.75rem', color:'var(--muted)' }}>Total Kamar</div></div>
                    {p.facilities && p.facilities.length>0 && (
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:'0.75rem', color:'var(--muted)', marginBottom:'0.25rem' }}>Fasilitas:</div>
                        <div style={{ display:'flex', flexWrap:'wrap', gap:'0.25rem' }}>
                          {p.facilities.slice(0,4).map(f=><span key={f} style={{ background:'var(--surface-2)', borderRadius:'0.25rem', padding:'0.125rem 0.375rem', fontSize:'0.7rem', color:'var(--muted)' }}>{f}</span>)}
                          {p.facilities.length>4 && <span style={{ fontSize:'0.7rem', color:'var(--primary)' }}>+{p.facilities.length-4}</span>}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth:'580px' }}>
            <h2 style={{ fontWeight:700, fontSize:'1.125rem', marginBottom:'1.25rem' }}>{editId?'Edit Properti':'Tambah Properti Baru'}</h2>
            {error && <div style={{ background:'#fee2e2', borderRadius:'0.5rem', padding:'0.75rem', marginBottom:'1rem', color:'#991b1b', fontSize:'0.875rem' }}>{error}</div>}
            <form onSubmit={handleSave} style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
              {/* Image carousel in form */}
              <div>
                <label style={{ display:'block', fontWeight:500, marginBottom:'0.375rem', fontSize:'0.875rem' }}>
                  Foto Properti <span style={{ fontWeight:400, color:'var(--muted)' }}>(bisa lebih dari 1)</span>
                  {uploadingImg && <span style={{ marginLeft:'0.5rem', color:'var(--primary)', fontSize:'0.8125rem' }}>Mengupload...</span>}
                </label>
                <div style={{ borderRadius:'0.625rem', overflow:'hidden', border:'1px solid var(--border)' }}>
                  <ImageCarousel images={images} alt="Properti" height={160} editable onAdd={handleAddImage} onDelete={handleDeleteImage}/>
                </div>
                <p style={{ fontSize:'0.75rem', color:'var(--muted)', marginTop:'0.375rem' }}>Klik "Tambah" di foto untuk upload gambar baru · Maks. 50MB per foto</p>
              </div>

              {[{label:'Nama Properti',key:'name',placeholder:'Mis: Kos Melati Indah'},{label:'Alamat Lengkap',key:'address',placeholder:'Jl. Mawar No. 15'},{label:'Kota',key:'city',placeholder:'Surabaya'}].map(({label,key,placeholder})=>(
                <div key={key}>
                  <label style={{ display:'block', fontWeight:500, marginBottom:'0.375rem', fontSize:'0.875rem' }}>{label}</label>
                  <input type="text" className="form-input" value={form[key as keyof typeof form] as string} onChange={e=>setForm({...form,[key]:e.target.value})} placeholder={placeholder} required/>
                </div>
              ))}

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
                <div>
                  <label style={{ display:'block', fontWeight:500, marginBottom:'0.375rem', fontSize:'0.875rem' }}>Tipe Properti</label>
                  <select className="form-input" value={form.property_type} onChange={e=>setForm({...form,property_type:e.target.value as PropertyType})}>
                    <option value="kos">Kos</option><option value="apartemen">Apartemen</option><option value="kontrakan">Kontrakan</option>
                  </select>
                </div>
                <div>
                  <label style={{ display:'block', fontWeight:500, marginBottom:'0.375rem', fontSize:'0.875rem' }}>Jumlah Kamar</label>
                  <input type="text" inputMode="numeric" className="form-input" value={form.total_rooms} onChange={e=>setForm({...form,total_rooms:e.target.value.replace(/\D/g,'')})} placeholder="10"/>
                </div>
              </div>

              <div>
                <label style={{ display:'block', fontWeight:500, marginBottom:'0.375rem', fontSize:'0.875rem' }}>Deskripsi <span style={{ fontWeight:400, color:'var(--muted)' }}>(opsional)</span></label>
                <textarea className="form-input" value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Deskripsi singkat..." rows={3} style={{ resize:'vertical' }}/>
              </div>
              <div>
                <label style={{ display:'block', fontWeight:500, marginBottom:'0.375rem', fontSize:'0.875rem' }}>Fasilitas <span style={{ fontWeight:400, color:'var(--muted)' }}>(pisahkan koma)</span></label>
                <input type="text" className="form-input" value={form.facilities} onChange={e=>setForm({...form,facilities:e.target.value})} placeholder="WiFi, Parkir Motor, CCTV"/>
              </div>

              <div style={{ display:'flex', gap:'0.75rem', justifyContent:'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={()=>setShowModal(false)}>Batal</button>
                <button type="submit" className="btn btn-primary" disabled={saving||uploadingImg}>{saving?'Menyimpan...':editId?'Simpan Perubahan':'Tambah Properti'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}