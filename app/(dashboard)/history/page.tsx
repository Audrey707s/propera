'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate } from '@/lib/utils'
import { History, CreditCard, UserPlus, FileText, CheckCircle, AlertCircle, Clock, Filter, ChevronDown } from 'lucide-react'

type ActivityType = 'all' | 'payment' | 'tenant' | 'agreement'

interface Activity {
  id: string; type: 'payment'|'tenant'|'agreement'; title: string; subtitle: string
  time: string; status?: string; amount?: number
}

export default function HistoryPage() {
  const supabase = createClient()
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState<ActivityType>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const PER_PAGE = 20

  useEffect(() => { loadActivities() }, [typeFilter, dateFrom, dateTo])

  async function loadActivities() {
    setLoading(true); setPage(1)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const from = dateFrom || '2020-01-01'
    const to = dateTo || new Date().toISOString().split('T')[0]

    const [paymentsRes, tenantsRes, agreementsRes] = await Promise.all([
      (typeFilter==='all'||typeFilter==='payment')
        ? supabase.from('payments').select('id,amount,status,created_at,tenant:tenants(full_name),room:rooms(room_number,property:properties(name))').eq('owner_id',user.id).gte('created_at',from+'T00:00:00').lte('created_at',to+'T23:59:59').order('created_at',{ascending:false}).limit(100)
        : Promise.resolve({data:[]}),
      (typeFilter==='all'||typeFilter==='tenant')
        ? supabase.from('tenants').select('id,full_name,created_at,occupation').eq('owner_id',user.id).gte('created_at',from+'T00:00:00').lte('created_at',to+'T23:59:59').order('created_at',{ascending:false}).limit(100)
        : Promise.resolve({data:[]}),
      (typeFilter==='all'||typeFilter==='agreement')
        ? supabase.from('rental_agreements').select('id,status,created_at,monthly_price,tenant:tenants(full_name),room:rooms(room_number)').eq('owner_id',user.id).gte('created_at',from+'T00:00:00').lte('created_at',to+'T23:59:59').order('created_at',{ascending:false}).limit(100)
        : Promise.resolve({data:[]}),
    ])

    const acts: Activity[] = []
    ;(paymentsRes.data||[]).forEach((p:any) => acts.push({
      id:`pay-${p.id}`, type:'payment',
      title: p.status==='paid'?'Pembayaran diterima':p.status==='overdue'?'Pembayaran terlambat':'Tagihan dicatat',
      subtitle:`${p.tenant?.full_name} — Kamar ${p.room?.room_number} · ${p.room?.property?.name}`,
      time:p.created_at, status:p.status, amount:Number(p.amount)
    }))
    ;(tenantsRes.data||[]).forEach((t:any) => acts.push({
      id:`ten-${t.id}`, type:'tenant', title:'Penyewa baru ditambahkan',
      subtitle:`${t.full_name}${t.occupation?` · ${t.occupation}`:''}`,
      time:t.created_at
    }))
    ;(agreementsRes.data||[]).forEach((a:any) => acts.push({
      id:`agr-${a.id}`, type:'agreement',
      title:a.status==='active'?'Kontrak sewa dibuat':'Kontrak sewa diakhiri',
      subtitle:`${a.tenant?.full_name} — Kamar ${a.room?.room_number}`,
      time:a.created_at, status:a.status, amount:a.monthly_price
    }))

    acts.sort((a,b)=>new Date(b.time).getTime()-new Date(a.time).getTime())
    setActivities(acts)
    setLoading(false)
  }

  function timeAgo(dateStr: string) {
    const diff = Date.now()-new Date(dateStr).getTime()
    const mins=Math.floor(diff/60000),hours=Math.floor(diff/3600000),days=Math.floor(diff/86400000)
    if(mins<1)return'Baru saja';if(mins<60)return`${mins} menit lalu`;if(hours<24)return`${hours} jam lalu`;if(days<7)return`${days} hari lalu`;return formatDate(dateStr)
  }

  const actBg = (type:string,status?:string) => {
    if(type==='payment')return status==='paid'?'#d1fae5':status==='overdue'?'#fee2e2':'#fef3c7'
    if(type==='tenant')return'#ede9fe'
    return'#dbeafe'
  }
  const actIcon = (type:string,status?:string) => {
    if(type==='payment')return status==='paid'?<CheckCircle size={16} color="#10b981"/>:status==='overdue'?<AlertCircle size={16} color="#ef4444"/>:<Clock size={16} color="#f59e0b"/>
    if(type==='tenant')return<UserPlus size={16} color="#7c3aed"/>
    return<FileText size={16} color="#2563eb"/>
  }

  // Group by date
  const grouped: Record<string, Activity[]> = {}
  activities.slice(0, page*PER_PAGE).forEach(a => {
    const date = new Date(a.time).toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'})
    if (!grouped[date]) grouped[date] = []
    grouped[date].push(a)
  })

  const hasMore = activities.length > page*PER_PAGE

  return (
    <div className="animate-in">
      <div className="page-header">
        <div><h1 className="page-title">Riwayat Aktivitas</h1><p className="page-subtitle">Semua aktivitas properti Anda</p></div>
      </div>

      {/* Filter */}
      <div className="card" style={{ marginBottom:'1.5rem' }}>
        <div style={{ display:'flex', gap:'1rem', flexWrap:'wrap', alignItems:'flex-end' }}>
          <div style={{ flex:1, minWidth:'160px' }}>
            <label style={{ display:'block', fontSize:'0.8125rem', fontWeight:500, marginBottom:'0.375rem', color:'var(--muted)' }}>Jenis Aktivitas</label>
            <select className="form-input" value={typeFilter} onChange={e=>setTypeFilter(e.target.value as ActivityType)}>
              <option value="all">Semua Aktivitas</option>
              <option value="payment">Pembayaran</option>
              <option value="tenant">Penyewa</option>
              <option value="agreement">Kontrak Sewa</option>
            </select>
          </div>
          <div style={{ flex:1, minWidth:'140px' }}>
            <label style={{ display:'block', fontSize:'0.8125rem', fontWeight:500, marginBottom:'0.375rem', color:'var(--muted)' }}>Dari Tanggal</label>
            <input type="date" className="form-input" value={dateFrom} onChange={e=>setDateFrom(e.target.value)}/>
          </div>
          <div style={{ flex:1, minWidth:'140px' }}>
            <label style={{ display:'block', fontSize:'0.8125rem', fontWeight:500, marginBottom:'0.375rem', color:'var(--muted)' }}>Sampai Tanggal</label>
            <input type="date" className="form-input" value={dateTo} onChange={e=>setDateTo(e.target.value)}/>
          </div>
          <button className="btn btn-secondary" onClick={()=>{setDateFrom('');setDateTo('');setTypeFilter('all')}}>Reset</button>
        </div>
        {(dateFrom||dateTo||typeFilter!=='all') && (
          <div style={{ marginTop:'0.75rem', fontSize:'0.8125rem', color:'var(--primary)', fontWeight:500 }}>
            Menampilkan {activities.length} aktivitas
            {typeFilter!=='all'?` · Jenis: ${typeFilter==='payment'?'Pembayaran':typeFilter==='tenant'?'Penyewa':'Kontrak'}`:''}
            {dateFrom?` · Dari: ${formatDate(dateFrom)}`:''}
            {dateTo?` · s/d: ${formatDate(dateTo)}`:''}
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:'3rem', color:'var(--muted)' }}>Memuat riwayat...</div>
      ) : activities.length===0 ? (
        <div style={{ textAlign:'center', padding:'3rem', background:'white', borderRadius:'0.75rem', border:'1px solid var(--border)' }}>
          <History size={40} style={{ margin:'0 auto 1rem', color:'#cbd5e1' }}/>
          <p style={{ color:'var(--muted)' }}>Tidak ada aktivitas pada periode ini.</p>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:'1.25rem' }}>
          {Object.entries(grouped).map(([date, acts]) => (
            <div key={date}>
              <div style={{ fontSize:'0.8125rem', fontWeight:600, color:'var(--muted)', marginBottom:'0.625rem', display:'flex', alignItems:'center', gap:'0.5rem' }}>
                <div style={{ height:'1px', flex:1, background:'var(--border)' }}/>
                <span style={{ background:'var(--surface-2)', padding:'0.125rem 0.75rem', borderRadius:'999px', border:'1px solid var(--border)' }}>{date}</span>
                <div style={{ height:'1px', flex:1, background:'var(--border)' }}/>
              </div>
              <div className="card" style={{ padding:0 }}>
                {acts.map((act, i) => (
                  <div key={act.id} style={{ display:'flex', alignItems:'flex-start', gap:'1rem', padding:'1rem 1.25rem', borderBottom:i<acts.length-1?'1px solid var(--border)':'none' }}>
                    <div style={{ width:'2.25rem', height:'2.25rem', borderRadius:'50%', background:actBg(act.type,act.status), display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      {actIcon(act.type, act.status)}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'1rem' }}>
                        <div>
                          <div style={{ fontWeight:500, fontSize:'0.9375rem' }}>{act.title}</div>
                          <div style={{ fontSize:'0.8125rem', color:'var(--muted)', marginTop:'0.125rem' }}>{act.subtitle}</div>
                        </div>
                        <div style={{ textAlign:'right', flexShrink:0 }}>
                          {act.amount && <div style={{ fontWeight:700, color:'var(--primary)', fontSize:'0.9375rem' }}>{formatCurrency(act.amount)}</div>}
                          <div style={{ fontSize:'0.75rem', color:'#94a3b8', marginTop:'0.125rem' }}>{timeAgo(act.time)}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {hasMore && (
            <div style={{ textAlign:'center' }}>
              <button className="btn btn-secondary" onClick={()=>setPage(p=>p+1)} style={{ gap:'0.5rem' }}>
                <ChevronDown size={16}/> Tampilkan lebih banyak ({activities.length - page*PER_PAGE} lagi)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}