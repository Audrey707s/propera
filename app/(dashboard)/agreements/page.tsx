'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getAdminContext } from '@/lib/permissions'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Plus, FileText, Edit2, Trash2, Search } from 'lucide-react'
import type { RentalAgreement, AgreementStatus, DepositStatus } from '@/types'

const emptyForm = { room_id:'', tenant_id:'', start_date:'', end_date:'', monthly_price:0, deposit_amount:0, deposit_status:'pending' as DepositStatus, notes:'' }

export default function AgreementsPage() {
  const supabase = createClient()
  const [agreements, setAgreements] = useState<RentalAgreement[]>([])
  const [rooms, setRooms] = useState<any[]>([])
  const [tenants, setTenants] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string|null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [userId, setUserId] = useState('')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const context = await getAdminContext()
    if (!context) { setLoading(false); return }
    setUserId(context.ownerId)
    if (context.role === 'admin_properti' && context.propertyIds.length === 0) {
      setAgreements([])
      setRooms([])
      setTenants([])
      setLoading(false)
      return
    }
    let propQuery = supabase.from('properties').select('id').eq('owner_id', context.ownerId)
    if (context.role === 'admin_properti') propQuery = propQuery.in('id', context.propertyIds)
    const propRes = await propQuery
    const propIds = propRes.data?.map(p=>p.id) || []
    const roomIdsRes = propIds.length ? await supabase.from('rooms').select('id').in('property_id', propIds) : { data: [] as { id: string }[] }
    const roomIds = roomIdsRes.data?.map(r => r.id) || []
    let agrQuery = supabase.from('rental_agreements').select('*, tenant:tenants(full_name,phone), room:rooms(room_number, monthly_price, property:properties(name))').eq('owner_id', context.ownerId).order('created_at', { ascending: false })
    if (context.role === 'admin_properti') agrQuery = roomIds.length ? agrQuery.in('room_id', roomIds) : agrQuery.eq('room_id', '__none__')
    const [agrRes, roomRes, tenRes] = await Promise.all([
      agrQuery,
      propIds.length ? supabase.from('rooms').select('id, room_number, monthly_price, status, property:properties(name)').in('property_id', propIds) : Promise.resolve({ data: [] }),
      supabase.from('tenants').select('id, full_name, phone').eq('owner_id', context.ownerId).eq('is_active', true),
    ])
    setAgreements(agrRes.data || [])
    setRooms(roomRes.data || [])
    setTenants(tenRes.data || [])
    setLoading(false)
  }

  function openAdd() {
    setEditId(null)
    const today = new Date().toISOString().split('T')[0]
    const nextYear = new Date(new Date().setFullYear(new Date().getFullYear()+1)).toISOString().split('T')[0]
    setForm({ ...emptyForm, start_date: today, end_date: nextYear })
    setError(''); setShowModal(true)
  }

  function openEdit(a: RentalAgreement) {
    setEditId(a.id)
    setForm({ room_id:a.room_id, tenant_id:a.tenant_id, start_date:a.start_date, end_date:a.end_date, monthly_price:a.monthly_price, deposit_amount:a.deposit_amount, deposit_status:a.deposit_status, notes:a.notes||'' })
    setError(''); setShowModal(true)
  }

  function onRoomChange(roomId: string) {
    const room = rooms.find(r => r.id === roomId)
    setForm(f => ({ ...f, room_id: roomId, monthly_price: room?.monthly_price || 0 }))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    const payload = { ...form, owner_id: userId, status: 'active' }
    const { error: err } = editId
      ? await supabase.from('rental_agreements').update(payload).eq('id', editId)
      : await supabase.from('rental_agreements').insert(payload)
    if (err) { setError(err.message); setSaving(false); return }
    await supabase.from('rooms').update({ status: 'occupied' }).eq('id', form.room_id)
    setShowModal(false); loadData(); setSaving(false)
  }

  async function endAgreement(id: string) {
    if (!confirm('Akhiri kontrak ini? Status kamar akan berubah menjadi Tersedia.')) return
    const agreement = agreements.find(a => a.id === id)
    const { error: agreementErr } = await supabase.from('rental_agreements').update({ status: 'ended' }).eq('id', id)
    if (agreementErr) { alert(agreementErr.message); return }
    if (agreement?.room_id) {
      const { error: roomErr } = await supabase.from('rooms').update({ status: 'available' }).eq('id', agreement.room_id)
      if (roomErr) { alert(roomErr.message); return }
    }
    loadData()
  }

  async function handleDelete(id: string) {
    if (!confirm('Hapus kontrak ini?')) return
    await supabase.from('rental_agreements').delete().eq('id', id)
    loadData()
  }

  const filtered = agreements.filter(a => {
    const q = search.toLowerCase()
    return !q || (a as any).tenant?.full_name?.toLowerCase().includes(q) || (a as any).room?.room_number?.toLowerCase().includes(q)
  })

  const statusBadge = (s: string) => {
    const m: Record<string, string> = { active:'badge-green', ended:'badge-gray', terminated:'badge-red' }
    const l: Record<string, string> = { active:'Aktif', ended:'Selesai', terminated:'Dihentikan' }
    return <span className={`badge ${m[s]||'badge-gray'}`}>{l[s]||s}</span>
  }

  const depositBadge = (s: string) => {
    const m: Record<string, string> = { pending:'badge-yellow', paid:'badge-green', returned:'badge-blue' }
    const l: Record<string, string> = { pending:'Belum Dibayar', paid:'Dibayar', returned:'Dikembalikan' }
    return <span className={`badge ${m[s]||'badge-gray'}`}>{l[s]||s}</span>
  }

  return (
    <div className="animate-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Kontrak Sewa</h1>
          <p className="page-subtitle">Kelola kontrak sewa penyewa</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}><Plus size={16}/> Buat Kontrak</button>
      </div>

      <div style={{ display:'flex', gap:'0.75rem', marginBottom:'1.25rem' }}>
        <div style={{ position:'relative', flex:1, maxWidth:'360px' }}>
          <Search size={15} style={{ position:'absolute', left:'0.75rem', top:'50%', transform:'translateY(-50%)', color:'var(--muted)' }}/>
          <input className="form-input" placeholder="Cari penyewa atau nomor kamar..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft:'2.25rem' }}/>
        </div>
      </div>

      <div className="card" style={{ padding:0 }}>
        {loading ? (
          <div style={{ padding:'3rem', textAlign:'center', color:'var(--muted)' }}>Memuat kontrak...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding:'3rem', textAlign:'center' }}>
            <FileText size={40} style={{ margin:'0 auto 1rem', color:'#cbd5e1' }}/>
            <p style={{ color:'var(--muted)', marginBottom:'1rem' }}>{agreements.length===0 ? 'Belum ada kontrak sewa.' : 'Kontrak tidak ditemukan.'}</p>
            {agreements.length===0 && <button className="btn btn-primary" onClick={openAdd}><Plus size={16}/> Buat Kontrak</button>}
          </div>
        ) : (
          <div style={{ overflowX:'auto' }}>
            <table className="data-table">
              <thead><tr><th>Penyewa</th><th>Kamar</th><th>Mulai</th><th>Selesai</th><th>Harga/Bulan</th><th>Deposit</th><th>Status</th><th>Aksi</th></tr></thead>
              <tbody>
                {filtered.map(a => (
                  <tr key={a.id}>
                    <td>
                      <div style={{ fontWeight:500 }}>{(a as any).tenant?.full_name || '-'}</div>
                      <div style={{ fontSize:'0.75rem', color:'var(--muted)' }}>{(a as any).tenant?.phone}</div>
                    </td>
                    <td>
                      <div>{(a as any).room?.room_number || '-'}</div>
                      <div style={{ fontSize:'0.75rem', color:'var(--muted)' }}>{(a as any).room?.property?.name}</div>
                    </td>
                    <td>{formatDate(a.start_date)}</td>
                    <td>{formatDate(a.end_date)}</td>
                    <td style={{ fontWeight:600, color:'var(--primary)' }}>{formatCurrency(a.monthly_price)}</td>
                    <td>
                      <div>{formatCurrency(a.deposit_amount)}</div>
                      <div style={{ marginTop:'0.25rem' }}>{depositBadge(a.deposit_status)}</div>
                    </td>
                    <td>{statusBadge(a.status)}</td>
                    <td>
                      <div style={{ display:'flex', gap:'0.375rem' }}>
                        {a.status === 'active' && (
                          <button className="btn btn-secondary btn-sm" onClick={() => endAgreement(a.id)} title="Akhiri Kontrak" style={{ fontSize:'0.75rem' }}>Akhiri</button>
                        )}
                        <button className="btn btn-secondary btn-sm" onClick={() => openEdit(a)}><Edit2 size={13}/></button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(a.id)}><Trash2 size={13}/></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 style={{ fontWeight:700, fontSize:'1.125rem', marginBottom:'1.25rem' }}>{editId ? 'Edit Kontrak' : 'Buat Kontrak Baru'}</h2>
            {error && <div style={{ background:'#fee2e2', borderRadius:'0.5rem', padding:'0.75rem', marginBottom:'1rem', color:'#991b1b', fontSize:'0.875rem' }}>{error}</div>}
            <form onSubmit={handleSave} style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
              <div>
                <label style={{ display:'block', fontWeight:500, marginBottom:'0.375rem', fontSize:'0.875rem' }}>Penyewa</label>
                <select className="form-input" value={form.tenant_id} onChange={e => setForm({...form, tenant_id:e.target.value})} required>
                  <option value="">-- Pilih Penyewa --</option>
                  {tenants.map(t => <option key={t.id} value={t.id}>{t.full_name} ({t.phone})</option>)}
                </select>
              </div>
              <div>
                <label style={{ display:'block', fontWeight:500, marginBottom:'0.375rem', fontSize:'0.875rem' }}>Kamar</label>
                <select className="form-input" value={form.room_id} onChange={e => onRoomChange(e.target.value)} required>
                  <option value="">-- Pilih Kamar --</option>
                  {rooms.map(r => (
                    <option key={r.id} value={r.id} disabled={r.status==='occupied'}>
                      {r.room_number} — {r.property?.name} ({r.status==='occupied'?'Terisi':'Tersedia'}) — {formatCurrency(r.monthly_price)}/bulan
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
                <div>
                  <label style={{ display:'block', fontWeight:500, marginBottom:'0.375rem', fontSize:'0.875rem' }}>Tanggal Mulai</label>
                  <input type="date" className="form-input" value={form.start_date} onChange={e => setForm({...form, start_date:e.target.value})} required />
                </div>
                <div>
                  <label style={{ display:'block', fontWeight:500, marginBottom:'0.375rem', fontSize:'0.875rem' }}>Tanggal Selesai</label>
                  <input type="date" className="form-input" value={form.end_date} onChange={e => setForm({...form, end_date:e.target.value})} required />
                </div>
                <div>
                  <label style={{ display:'block', fontWeight:500, marginBottom:'0.375rem', fontSize:'0.875rem' }}>Harga/Bulan (Rp)</label>
                  <input type="number" className="form-input" value={form.monthly_price} onChange={e => setForm({...form, monthly_price:parseInt(e.target.value)||0})} min="0" required />
                </div>
                <div>
                  <label style={{ display:'block', fontWeight:500, marginBottom:'0.375rem', fontSize:'0.875rem' }}>Deposit (Rp)</label>
                  <input type="number" className="form-input" value={form.deposit_amount} onChange={e => setForm({...form, deposit_amount:parseInt(e.target.value)||0})} min="0" />
                </div>
                <div>
                  <label style={{ display:'block', fontWeight:500, marginBottom:'0.375rem', fontSize:'0.875rem' }}>Status Deposit</label>
                  <select className="form-input" value={form.deposit_status} onChange={e => setForm({...form, deposit_status:e.target.value as any})}>
                    <option value="pending">Belum Dibayar</option>
                    <option value="paid">Sudah Dibayar</option>
                    <option value="returned">Dikembalikan</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={{ display:'block', fontWeight:500, marginBottom:'0.375rem', fontSize:'0.875rem' }}>Catatan</label>
                <textarea className="form-input" value={form.notes} onChange={e => setForm({...form, notes:e.target.value})} rows={2} placeholder="Syarat dan catatan kontrak..." style={{ resize:'vertical' }}/>
              </div>
              <div style={{ display:'flex', gap:'0.75rem', justifyContent:'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Batal</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Menyimpan...' : editId ? 'Simpan' : 'Buat Kontrak'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
