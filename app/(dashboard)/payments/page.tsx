'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate, formatMonthYear, getPaymentStatusLabel, getPaymentMethodLabel } from '@/lib/utils'
import { printNota } from '@/lib/print'
import { Plus, CreditCard, Edit2, Trash2, Search, CheckCircle, AlertCircle, Clock, Printer } from 'lucide-react'
import type { Payment, PaymentStatus, PaymentMethod } from '@/types'

const emptyForm = { agreement_id:'', tenant_id:'', room_id:'', amount:'', payment_month:'', due_date:'', paid_date:'', payment_method:'' as PaymentMethod|'', status:'pending' as PaymentStatus, notes:'' }

function toRibuan(val: string) { const n=val.replace(/\D/g,''); return n?parseInt(n).toLocaleString('id-ID'):'' }
function fromRibuan(val: string) { return parseInt(val.replace(/\./g,'').replace(/,/g,''))||0 }

export default function PaymentsPage() {
  const supabase = createClient()
  const [payments, setPayments] = useState<Payment[]>([])
  const [agreements, setAgreements] = useState<any[]>([])
  const [ownerProfile, setOwnerProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string|null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterMonth, setFilterMonth] = useState('')
  const [userId, setUserId] = useState('')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)
    const [payRes, agrRes, profileRes] = await Promise.all([
      supabase.from('payments').select('*, tenant:tenants(full_name,phone), room:rooms(room_number, property:properties(name,address,city))').eq('owner_id',user.id).order('created_at',{ascending:false}),
      supabase.from('rental_agreements').select('*, tenant:tenants(id,full_name), room:rooms(id,room_number,monthly_price,property:properties(name))').eq('owner_id',user.id).eq('status','active'),
      supabase.from('profiles').select('*').eq('id',user.id).single(),
    ])
    setPayments(payRes.data||[])
    setAgreements(agrRes.data||[])
    setOwnerProfile(profileRes.data)
    setLoading(false)
  }

  function openAdd() {
    setEditId(null)
    const now=new Date()
    setForm({...emptyForm, payment_month:`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`, due_date:`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-10`})
    setError(''); setShowModal(true)
  }
  function openEdit(p: Payment) {
    setEditId(p.id)
    setForm({agreement_id:p.agreement_id,tenant_id:p.tenant_id,room_id:p.room_id,amount:p.amount?toRibuan(String(p.amount)):'',payment_month:p.payment_month,due_date:p.due_date,paid_date:p.paid_date||'',payment_method:p.payment_method||'',status:p.status,notes:p.notes||''})
    setError(''); setShowModal(true)
  }
  function onAgreementChange(id: string) {
    const agr=agreements.find(a=>a.id===id)
    if(!agr)return
    setForm(f=>({...f,agreement_id:id,tenant_id:agr.tenant?.id||'',room_id:agr.room?.id||'',amount:toRibuan(String(agr.monthly_price))}))
  }
  async function handleSave(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    const payload={...form,amount:fromRibuan(form.amount),owner_id:userId,payment_method:form.payment_method||null,paid_date:form.paid_date||null}
    const {error:err}=editId?await supabase.from('payments').update(payload).eq('id',editId):await supabase.from('payments').insert(payload)
    if(err){setError(err.message);setSaving(false);return}
    setShowModal(false); loadData(); setSaving(false)
  }
  async function handleDelete(id: string) {
    if(!confirm('Hapus data pembayaran ini?'))return
    await supabase.from('payments').delete().eq('id',id); loadData()
  }
  async function markPaid(p: Payment) {
    await supabase.from('payments').update({status:'paid',paid_date:new Date().toISOString().split('T')[0],payment_method:'transfer'}).eq('id',p.id)
    loadData()
  }

  const filtered=payments.filter(p=>{
    const q=search.toLowerCase(),t=(p as any).tenant,r=(p as any).room
    return(!q||t?.full_name?.toLowerCase().includes(q)||r?.room_number?.toLowerCase().includes(q)||r?.property?.name?.toLowerCase().includes(q))
      &&(!filterStatus||p.status===filterStatus)
      &&(!filterMonth||p.payment_month.startsWith(filterMonth))
  })
  const totalPaid=filtered.filter(p=>p.status==='paid').reduce((s,p)=>s+Number(p.amount),0)
  const totalPending=filtered.filter(p=>p.status==='pending').reduce((s,p)=>s+Number(p.amount),0)
  const totalOverdue=filtered.filter(p=>p.status==='overdue').reduce((s,p)=>s+Number(p.amount),0)
  const statusBadge=(s:string)=>{
    const m:Record<string,{cls:string,Icon:any}>={paid:{cls:'badge-green',Icon:CheckCircle},pending:{cls:'badge-yellow',Icon:Clock},overdue:{cls:'badge-red',Icon:AlertCircle},cancelled:{cls:'badge-gray',Icon:AlertCircle}}
    const {cls,Icon}=m[s]||{cls:'badge-gray',Icon:Clock}
    return<span className={`badge ${cls}`} style={{display:'inline-flex',alignItems:'center',gap:'0.25rem'}}><Icon size={11}/>{getPaymentStatusLabel(s)}</span>
  }

  return (
    <div className="animate-in">
      <div className="page-header">
        <div><h1 className="page-title">Pembayaran</h1><p className="page-subtitle">Pantau dan kelola pembayaran sewa</p></div>
        <button className="btn btn-primary" onClick={openAdd}><Plus size={16}/> Catat Pembayaran</button>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:'1rem',marginBottom:'1.25rem'}}>
        {[
          {label:`Lunas (${filtered.filter(p=>p.status==='paid').length})`,amount:totalPaid,color:'#10b981',border:'#10b981'},
          {label:`Belum Bayar (${filtered.filter(p=>p.status==='pending').length})`,amount:totalPending,color:'#f59e0b',border:'#f59e0b'},
          {label:`Terlambat (${filtered.filter(p=>p.status==='overdue').length})`,amount:totalOverdue,color:'#ef4444',border:'#ef4444'},
        ].map(s=>(
          <div key={s.label} className="card" style={{borderLeft:`4px solid ${s.border}`}}>
            <div style={{fontSize:'0.8125rem',color:'var(--muted)',marginBottom:'0.25rem'}}>{s.label}</div>
            <div style={{fontSize:'1.125rem',fontWeight:700,color:s.color}}>{formatCurrency(s.amount)}</div>
          </div>
        ))}
      </div>

      <div style={{display:'flex',gap:'0.75rem',marginBottom:'1.25rem',flexWrap:'wrap'}}>
        <div style={{position:'relative',flex:1,minWidth:'200px'}}>
          <Search size={15} style={{position:'absolute',left:'0.75rem',top:'50%',transform:'translateY(-50%)',color:'var(--muted)'}}/>
          <input className="form-input" placeholder="Cari penyewa, kamar, properti..." value={search} onChange={e=>setSearch(e.target.value)} style={{paddingLeft:'2.25rem'}}/>
        </div>
        <select className="form-input" style={{width:'160px'}} value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}>
          <option value="">Semua Status</option>
          <option value="pending">Belum Bayar</option>
          <option value="paid">Lunas</option>
          <option value="overdue">Terlambat</option>
          <option value="cancelled">Batal</option>
        </select>
        <input type="month" className="form-input" style={{width:'160px'}} value={filterMonth} onChange={e=>setFilterMonth(e.target.value)}/>
      </div>

      <div className="card" style={{padding:0}}>
        {loading?<div style={{padding:'3rem',textAlign:'center',color:'var(--muted)'}}>Memuat...</div>
        :filtered.length===0?<div style={{padding:'3rem',textAlign:'center'}}><CreditCard size={40} style={{margin:'0 auto 1rem',color:'#cbd5e1'}}/><p style={{color:'var(--muted)'}}>Belum ada data pembayaran.</p></div>
        :<div style={{overflowX:'auto'}}>
          <table className="data-table">
            <thead><tr><th>Penyewa</th><th>Kamar</th><th>Bulan</th><th>Jumlah</th><th>Jatuh Tempo</th><th>Tgl Bayar</th><th>Metode</th><th>Status</th><th>Aksi</th></tr></thead>
            <tbody>
              {filtered.map(pay=>{
                const t=(pay as any).tenant,r=(pay as any).room
                const isOverdue=pay.status==='pending'&&new Date(pay.due_date)<new Date()
                return(
                  <tr key={pay.id}>
                    <td><div style={{fontWeight:500}}>{t?.full_name||'-'}</div><div style={{fontSize:'0.75rem',color:'var(--muted)'}}>{t?.phone}</div></td>
                    <td><div>{r?.room_number||'-'}</div><div style={{fontSize:'0.75rem',color:'var(--muted)'}}>{r?.property?.name}</div></td>
                    <td>{formatMonthYear(pay.payment_month)}</td>
                    <td style={{fontWeight:600,color:'var(--primary)'}}>{formatCurrency(Number(pay.amount))}</td>
                    <td style={{color:isOverdue?'#ef4444':'inherit',fontWeight:isOverdue?600:400}}>{formatDate(pay.due_date)}</td>
                    <td>{pay.paid_date?formatDate(pay.paid_date):<span style={{color:'var(--muted)'}}>-</span>}</td>
                    <td>{pay.payment_method?<span className="badge badge-gray">{getPaymentMethodLabel(pay.payment_method)}</span>:<span style={{color:'var(--muted)'}}>-</span>}</td>
                    <td>{statusBadge(pay.status)}</td>
                    <td>
                      <div style={{display:'flex',gap:'0.375rem'}}>
                        {pay.status!=='paid'&&<button className="btn btn-sm" style={{background:'#d1fae5',color:'#065f46',border:'none'}} onClick={()=>markPaid(pay)} title="Tandai Lunas"><CheckCircle size={13}/></button>}
                        <button className="btn btn-secondary btn-sm" onClick={()=>printNota(pay, ownerProfile)} title="Cetak Nota"><Printer size={13}/></button>
                        <button className="btn btn-secondary btn-sm" onClick={()=>openEdit(pay)}><Edit2 size={13}/></button>
                        <button className="btn btn-danger btn-sm" onClick={()=>handleDelete(pay.id)}><Trash2 size={13}/></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>}
      </div>

      {showModal&&(
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 style={{fontWeight:700,fontSize:'1.125rem',marginBottom:'1.25rem'}}>{editId?'Edit Pembayaran':'Catat Pembayaran Baru'}</h2>
            {error&&<div style={{background:'#fee2e2',borderRadius:'0.5rem',padding:'0.75rem',marginBottom:'1rem',color:'#991b1b',fontSize:'0.875rem'}}>{error}</div>}
            <form onSubmit={handleSave} style={{display:'flex',flexDirection:'column',gap:'1rem'}}>
              <div>
                <label style={{display:'block',fontWeight:500,marginBottom:'0.375rem',fontSize:'0.875rem'}}>Kontrak Sewa</label>
                <select className="form-input" value={form.agreement_id} onChange={e=>onAgreementChange(e.target.value)} required>
                  <option value="">-- Pilih Penyewa / Kontrak --</option>
                  {agreements.map(a=><option key={a.id} value={a.id}>{a.tenant?.full_name} — Kamar {a.room?.room_number} ({a.room?.property?.name})</option>)}
                </select>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1rem'}}>
                <div><label style={{display:'block',fontWeight:500,marginBottom:'0.375rem',fontSize:'0.875rem'}}>Bulan Pembayaran</label><input type="date" className="form-input" value={form.payment_month} onChange={e=>setForm({...form,payment_month:e.target.value})} required/></div>
                <div><label style={{display:'block',fontWeight:500,marginBottom:'0.375rem',fontSize:'0.875rem'}}>Jumlah (Rp)</label><input type="text" inputMode="numeric" className="form-input" value={form.amount} onChange={e=>setForm({...form,amount:toRibuan(e.target.value)})} placeholder="750.000" required/></div>
                <div><label style={{display:'block',fontWeight:500,marginBottom:'0.375rem',fontSize:'0.875rem'}}>Jatuh Tempo</label><input type="date" className="form-input" value={form.due_date} onChange={e=>setForm({...form,due_date:e.target.value})} required/></div>
                <div><label style={{display:'block',fontWeight:500,marginBottom:'0.375rem',fontSize:'0.875rem'}}>Tanggal Bayar</label><input type="date" className="form-input" value={form.paid_date} onChange={e=>setForm({...form,paid_date:e.target.value})}/></div>
                <div><label style={{display:'block',fontWeight:500,marginBottom:'0.375rem',fontSize:'0.875rem'}}>Metode Bayar</label>
                  <select className="form-input" value={form.payment_method} onChange={e=>setForm({...form,payment_method:e.target.value as PaymentMethod})}>
                    <option value="">-- Pilih --</option><option value="cash">Tunai</option><option value="transfer">Transfer Bank</option><option value="qris">QRIS</option><option value="other">Lainnya</option>
                  </select>
                </div>
                <div><label style={{display:'block',fontWeight:500,marginBottom:'0.375rem',fontSize:'0.875rem'}}>Status</label>
                  <select className="form-input" value={form.status} onChange={e=>setForm({...form,status:e.target.value as PaymentStatus})}>
                    <option value="pending">Belum Bayar</option><option value="paid">Lunas</option><option value="overdue">Terlambat</option><option value="cancelled">Dibatalkan</option>
                  </select>
                </div>
              </div>
              <div><label style={{display:'block',fontWeight:500,marginBottom:'0.375rem',fontSize:'0.875rem'}}>Catatan</label><textarea className="form-input" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} rows={2} style={{resize:'vertical'}}/></div>
              <div style={{display:'flex',gap:'0.75rem',justifyContent:'flex-end'}}>
                <button type="button" className="btn btn-secondary" onClick={()=>setShowModal(false)}>Batal</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving?'Menyimpan...':editId?'Simpan':'Catat'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}