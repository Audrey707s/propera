'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { uploadImage } from '@/lib/upload'
import { formatCurrency, getRoomTypeLabel, getRoomStatusLabel } from '@/lib/utils'
import { Plus, DoorOpen, Edit2, Trash2, Search } from 'lucide-react'
import ImageCarousel from '@/components/ImageCarousel'
import type { Room, RoomType, RoomStatus, Property } from '@/types'

const emptyForm = { property_id:'', room_number:'', floor:'1', room_type:'standard' as RoomType, monthly_price:'', size_sqm:'', facilities:'', notes:'' }

function toRibuan(val: string) { const n=val.replace(/\D/g,''); return n?parseInt(n).toLocaleString('id-ID'):'' }
function fromRibuan(val: string) { return parseInt(val.replace(/\./g,'').replace(/,/g,''))||0 }

export default function RoomsPage() {
  const supabase = createClient()
  const [rooms, setRooms] = useState<(Room & { image_urls?: string[] })[]>([])
  const [properties, setProperties] = useState<Property[]>([])
  const [userId, setUserId] = useState('')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string|null>(null)
  const [form, setForm] = useState(emptyForm)
  const [images, setImages] = useState<string[]>([])
  const [uploadingImg, setUploadingImg] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [filterProperty, setFilterProperty] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) { setUserId(user.id); loadData(user.id) }
    })
  }, [])

  async function loadData(uid: string) {
    const { data: props } = await supabase.from('properties').select('*').eq('owner_id', uid).order('name')
    setProperties(props||[])
    const propIds = (props||[]).map(p=>p.id)
    if (propIds.length>0) {
      const { data } = await supabase.from('rooms').select('*, property:properties(name)').in('property_id', propIds).order('room_number')
      setRooms(data||[])
    }
    setLoading(false)
  }

  function openAdd() {
    setEditId(null); setForm({...emptyForm, property_id:properties[0]?.id||''})
    setImages([]); setError(''); setShowModal(true)
  }
  function openEdit(r: Room & { image_urls?: string[] }) {
    setEditId(r.id)
    setForm({ property_id:r.property_id, room_number:r.room_number, floor:String(r.floor), room_type:r.room_type, monthly_price:r.monthly_price?toRibuan(String(r.monthly_price)):'', size_sqm:r.size_sqm?String(r.size_sqm):'', facilities:(r.facilities||[]).join(', '), notes:r.notes||'' })
    const imgs = r.image_urls?.length ? r.image_urls : (r.image_url ? [r.image_url] : [])
    setImages(imgs); setError(''); setShowModal(true)
  }

  async function handleAddImage(file: File) {
    setUploadingImg(true)
    const path = `rooms/${editId||userId+'_new'}/${Date.now()}/img`
    const url = await uploadImage(file, 'property-images', path)
    if (url) setImages(prev=>[...prev, url])
    setUploadingImg(false)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    const payload = {
      property_id:form.property_id, room_number:form.room_number, floor:parseInt(form.floor)||1,
      room_type:form.room_type, monthly_price:fromRibuan(form.monthly_price),
      size_sqm:form.size_sqm?parseFloat(form.size_sqm):null,
      facilities:form.facilities?form.facilities.split(',').map(f=>f.trim()).filter(Boolean):[],
      notes:form.notes||null, image_url:images[0]||null, image_urls:images,
    }
    const {error:err} = editId ? await supabase.from('rooms').update(payload).eq('id',editId) : await supabase.from('rooms').insert(payload)
    if (err) { setError(err.message); setSaving(false); return }
    setShowModal(false); loadData(userId); setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Hapus kamar ini?')) return
    await supabase.from('rooms').delete().eq('id',id); loadData(userId)
  }

  async function updateStatus(id: string, status: RoomStatus) {
    await supabase.from('rooms').update({status}).eq('id',id); loadData(userId)
  }

  const filtered = rooms.filter(r=>{
    const q=search.toLowerCase()
    return (!q||r.room_number.toLowerCase().includes(q)||(r as any).property?.name?.toLowerCase().includes(q))
      &&(!filterProperty||r.property_id===filterProperty)
      &&(!filterStatus||r.status===filterStatus)
  })

  const typeBadge=(t:string)=>{const m:Record<string,string>={standard:'badge-gray',deluxe:'badge-blue',vip:'badge-purple'};return<span className={`badge ${m[t]||'badge-gray'}`}>{getRoomTypeLabel(t)}</span>}
  const statusBadge=(s:string)=>{const m:Record<string,string>={available:'badge-green',occupied:'badge-blue',maintenance:'badge-yellow'};return<span className={`badge ${m[s]||'badge-gray'}`}>{getRoomStatusLabel(s)}</span>}

  return (
    <div className="animate-in">
      <div className="page-header">
        <div><h1 className="page-title">Kamar</h1><p className="page-subtitle">Kelola semua kamar di properti Anda</p></div>
        <button className="btn btn-primary" onClick={openAdd}><Plus size={16}/> Tambah Kamar</button>
      </div>

      <div style={{ display:'flex', gap:'0.75rem', marginBottom:'1.25rem', flexWrap:'wrap' }}>
        <div style={{ position:'relative', flex:1, minWidth:'200px' }}>
          <Search size={15} style={{ position:'absolute', left:'0.75rem', top:'50%', transform:'translateY(-50%)', color:'var(--muted)' }}/>
          <input className="form-input" placeholder="Cari nomor kamar..." value={search} onChange={e=>setSearch(e.target.value)} style={{ paddingLeft:'2.25rem' }}/>
        </div>
        <select className="form-input" style={{ width:'180px' }} value={filterProperty} onChange={e=>setFilterProperty(e.target.value)}>
          <option value="">Semua Properti</option>
          {properties.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select className="form-input" style={{ width:'160px' }} value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}>
          <option value="">Semua Status</option>
          <option value="available">Tersedia</option>
          <option value="occupied">Terisi</option>
          <option value="maintenance">Perawatan</option>
        </select>
      </div>

      <div style={{ display:'flex', gap:'1rem', marginBottom:'1.25rem', flexWrap:'wrap' }}>
        {[{label:'Total',count:rooms.length,color:'#64748b'},{label:'Tersedia',count:rooms.filter(r=>r.status==='available').length,color:'#10b981'},{label:'Terisi',count:rooms.filter(r=>r.status==='occupied').length,color:'#2563eb'},{label:'Perawatan',count:rooms.filter(r=>r.status==='maintenance').length,color:'#f59e0b'}].map(s=>(
          <div key={s.label} style={{ background:'white', border:'1px solid var(--border)', borderRadius:'0.5rem', padding:'0.5rem 1rem', display:'flex', gap:'0.5rem', alignItems:'center' }}>
            <span style={{ fontSize:'0.8125rem', color:'var(--muted)' }}>{s.label}</span>
            <span style={{ fontWeight:700, color:s.color }}>{s.count}</span>
          </div>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:'3rem', color:'var(--muted)' }}>Memuat data kamar...</div>
      ) : filtered.length===0 ? (
        <div style={{ textAlign:'center', padding:'3rem', background:'white', borderRadius:'0.75rem', border:'1px solid var(--border)' }}>
          <DoorOpen size={40} style={{ margin:'0 auto 1rem', color:'#cbd5e1' }}/>
          <p style={{ color:'var(--muted)' }}>{rooms.length===0?'Belum ada kamar.':'Tidak ada kamar sesuai filter.'}</p>
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:'1rem' }}>
          {filtered.map(r=>{
            const imgs = r.image_urls?.length ? r.image_urls : (r.image_url ? [r.image_url] : [])
            return (
              <div key={r.id} className="card" style={{ padding:0, overflow:'hidden' }}>
                <div style={{ position:'relative' }}>
                  <ImageCarousel images={imgs} alt={`Kamar ${r.room_number}`} height={140}/>
                  <div style={{ position:'absolute', top:'0.5rem', left:'0.5rem', display:'flex', gap:'0.375rem', zIndex:5 }}>
                    {typeBadge(r.room_type)}
                  </div>
                  <div style={{ position:'absolute', top:'0.5rem', right:'0.5rem', zIndex:5 }}>
                    {statusBadge(r.status)}
                  </div>
                </div>
                <div style={{ padding:'0.875rem' }}>
                  <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'0.5rem' }}>
                    <div>
                      <div style={{ fontWeight:700, fontSize:'1rem' }}>Kamar {r.room_number}</div>
                      <div style={{ fontSize:'0.8125rem', color:'var(--muted)' }}>{(r as any).property?.name} · Lt. {r.floor}</div>
                    </div>
                    <div style={{ fontWeight:700, color:'var(--primary)', fontSize:'0.9375rem', textAlign:'right' }}>
                      {formatCurrency(r.monthly_price)}<span style={{ fontSize:'0.75rem', fontWeight:400, color:'var(--muted)' }}>/bln</span>
                    </div>
                  </div>
                  {r.facilities && r.facilities.length>0 && (
                    <div style={{ display:'flex', flexWrap:'wrap', gap:'0.25rem', marginBottom:'0.75rem' }}>
                      {r.facilities.slice(0,4).map(f=><span key={f} style={{ background:'var(--surface-2)', borderRadius:'0.25rem', padding:'0.125rem 0.375rem', fontSize:'0.7rem', color:'var(--muted)' }}>{f}</span>)}
                      {r.facilities.length>4 && <span style={{ fontSize:'0.7rem', color:'var(--primary)' }}>+{r.facilities.length-4}</span>}
                    </div>
                  )}
                  <div style={{ display:'flex', gap:'0.375rem', alignItems:'center' }}>
                    <select value={r.status} onChange={e=>updateStatus(r.id,e.target.value as RoomStatus)}
                      style={{ flex:1, background:'var(--surface-2)', border:'1px solid var(--border)', borderRadius:'0.375rem', padding:'0.375rem 0.5rem', fontSize:'0.8125rem', cursor:'pointer', color:r.status==='available'?'#065f46':r.status==='occupied'?'#1e40af':'#92400e', fontWeight:500 }}>
                      <option value="available">Tersedia</option>
                      <option value="occupied">Terisi</option>
                      <option value="maintenance">Perawatan</option>
                    </select>
                    <button className="btn btn-secondary btn-sm" onClick={()=>openEdit(r)}><Edit2 size={13}/></button>
                    <button className="btn btn-danger btn-sm" onClick={()=>handleDelete(r.id)}><Trash2 size={13}/></button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth:'560px' }}>
            <h2 style={{ fontWeight:700, fontSize:'1.125rem', marginBottom:'1.25rem' }}>{editId?'Edit Kamar':'Tambah Kamar Baru'}</h2>
            {error && <div style={{ background:'#fee2e2', borderRadius:'0.5rem', padding:'0.75rem', marginBottom:'1rem', color:'#991b1b', fontSize:'0.875rem' }}>{error}</div>}
            <form onSubmit={handleSave} style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
              <div>
                <label style={{ display:'block', fontWeight:500, marginBottom:'0.375rem', fontSize:'0.875rem' }}>
                  Foto Kamar <span style={{ fontWeight:400, color:'var(--muted)' }}>(bisa lebih dari 1)</span>
                  {uploadingImg && <span style={{ marginLeft:'0.5rem', color:'var(--primary)', fontSize:'0.8125rem' }}>Mengupload...</span>}
                </label>
                <div style={{ borderRadius:'0.625rem', overflow:'hidden', border:'1px solid var(--border)' }}>
                  <ImageCarousel images={images} alt="Kamar" height={140} editable onAdd={handleAddImage} onDelete={i=>setImages(prev=>prev.filter((_,idx)=>idx!==i))}/>
                </div>
              </div>
              <div>
                <label style={{ display:'block', fontWeight:500, marginBottom:'0.375rem', fontSize:'0.875rem' }}>Properti</label>
                <select className="form-input" value={form.property_id} onChange={e=>setForm({...form,property_id:e.target.value})} required>
                  <option value="">-- Pilih Properti --</option>
                  {properties.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'1rem' }}>
                <div><label style={{ display:'block', fontWeight:500, marginBottom:'0.375rem', fontSize:'0.875rem' }}>No. Kamar</label><input type="text" className="form-input" value={form.room_number} onChange={e=>setForm({...form,room_number:e.target.value})} placeholder="A1" required/></div>
                <div><label style={{ display:'block', fontWeight:500, marginBottom:'0.375rem', fontSize:'0.875rem' }}>Lantai</label><input type="text" inputMode="numeric" className="form-input" value={form.floor} onChange={e=>setForm({...form,floor:e.target.value.replace(/\D/g,'')||'1'})} placeholder="1"/></div>
                <div><label style={{ display:'block', fontWeight:500, marginBottom:'0.375rem', fontSize:'0.875rem' }}>Ukuran (m²)</label><input type="text" inputMode="decimal" className="form-input" value={form.size_sqm} onChange={e=>setForm({...form,size_sqm:e.target.value.replace(/[^0-9.]/g,'')})} placeholder="12"/></div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
                <div><label style={{ display:'block', fontWeight:500, marginBottom:'0.375rem', fontSize:'0.875rem' }}>Tipe Kamar</label>
                  <select className="form-input" value={form.room_type} onChange={e=>setForm({...form,room_type:e.target.value as RoomType})}>
                    <option value="standard">Standard</option><option value="deluxe">Deluxe</option><option value="vip">VIP</option>
                  </select>
                </div>
                <div><label style={{ display:'block', fontWeight:500, marginBottom:'0.375rem', fontSize:'0.875rem' }}>Harga/Bulan (Rp)</label><input type="text" inputMode="numeric" className="form-input" value={form.monthly_price} onChange={e=>setForm({...form,monthly_price:toRibuan(e.target.value)})} placeholder="750.000" required/></div>
              </div>
              <div><label style={{ display:'block', fontWeight:500, marginBottom:'0.375rem', fontSize:'0.875rem' }}>Fasilitas <span style={{ fontWeight:400, color:'var(--muted)' }}>(pisahkan koma)</span></label><input type="text" className="form-input" value={form.facilities} onChange={e=>setForm({...form,facilities:e.target.value})} placeholder="AC, Kamar Mandi Dalam, Lemari, TV"/></div>
              <div><label style={{ display:'block', fontWeight:500, marginBottom:'0.375rem', fontSize:'0.875rem' }}>Catatan</label><textarea className="form-input" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} rows={2} style={{ resize:'vertical' }}/></div>
              <div style={{ display:'flex', gap:'0.75rem', justifyContent:'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={()=>setShowModal(false)}>Batal</button>
                <button type="submit" className="btn btn-primary" disabled={saving||uploadingImg}>{saving?'Menyimpan...':editId?'Simpan':'Tambah Kamar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}