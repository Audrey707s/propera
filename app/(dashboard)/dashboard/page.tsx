'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getAdminContext, type AdminContext } from '@/lib/permissions'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Building2, DoorOpen, Users, TrendingUp, AlertCircle, CheckCircle, Clock, Plus, CreditCard, UserPlus, FileText, Shield } from 'lucide-react'
import type { Payment } from '@/types'

interface Stats { totalProperties:number;totalRooms:number;occupiedRooms:number;availableRooms:number;totalTenants:number;monthlyRevenue:number;pendingPayments:number;overduePayments:number }
interface Activity { id:string;type:'payment'|'tenant'|'agreement';title:string;subtitle:string;time:string;status?:string;amount?:number }

export default function DashboardPage() {
  const supabase = createClient()
  const [stats, setStats] = useState<Stats>({totalProperties:0,totalRooms:0,occupiedRooms:0,availableRooms:0,totalTenants:0,monthlyRevenue:0,pendingPayments:0,overduePayments:0})
  const [recentPayments, setRecentPayments] = useState<Payment[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [properties, setProperties] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [userName, setUserName] = useState('')
  const [ctx, setCtx] = useState<AdminContext|null>(null)

  useEffect(() => { loadDashboard() }, [])

  async function loadDashboard() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [profileRes, context] = await Promise.all([
      supabase.from('profiles').select('full_name').eq('id', user.id).single(),
      getAdminContext(),
    ])
    setUserName(profileRes.data?.full_name || '')
    setCtx(context)

    const isAdmin = context?.role === 'admin_properti'
    const ownerId = context?.ownerId || user.id

    // Query pakai ownerId yang benar (untuk admin, ini adalah owner yang menugaskan)
    const { data: propsData } = await supabase.from('properties').select('*').eq('owner_id', ownerId)
    let props = propsData || []

    // Kalau admin, filter hanya properti yang diizinkan
    if (isAdmin && context?.propertyIds?.length) {
      props = props.filter(p => context.propertyIds.includes(p.id))
    }
    setProperties(props)

    if (props.length === 0) { setLoading(false); return }
    const propIds = props.map((p:any) => p.id)

    const [roomsRes, tenantsRes, paymentsRes, allPaysRes, tenantsRecentRes, agreementsRecentRes] = await Promise.all([
      supabase.from('rooms').select('*').in('property_id', propIds),
      supabase.from('tenants').select('*').eq('owner_id', ownerId),
      supabase.from('payments').select('*, tenant:tenants(full_name), room:rooms(room_number, property:properties(name))').eq('owner_id', ownerId).order('created_at',{ascending:false}).limit(6),
      supabase.from('payments').select('status,amount,paid_date').eq('owner_id', ownerId),
      supabase.from('tenants').select('id,full_name,created_at').eq('owner_id', ownerId).order('created_at',{ascending:false}).limit(5),
      supabase.from('rental_agreements').select('id,created_at,status,tenant:tenants(full_name),room:rooms(room_number)').eq('owner_id', ownerId).order('created_at',{ascending:false}).limit(5),
    ])

    const rooms = roomsRes.data||[]
    const payments = paymentsRes.data||[]
    const allPays = allPaysRes.data||[]
    const now = new Date()
    const monthStart = new Date(now.getFullYear(),now.getMonth(),1).toISOString().split('T')[0]
    const monthEnd = new Date(now.getFullYear(),now.getMonth()+1,0).toISOString().split('T')[0]
    const monthlyRev = allPays.filter((p:any)=>p.status==='paid'&&p.paid_date>=monthStart&&p.paid_date<=monthEnd).reduce((s:number,p:any)=>s+Number(p.amount),0)

    setStats({totalProperties:props.length,totalRooms:rooms.length,occupiedRooms:rooms.filter((r:any)=>r.status==='occupied').length,availableRooms:rooms.filter((r:any)=>r.status==='available').length,totalTenants:tenantsRes.data?.length||0,monthlyRevenue:monthlyRev,pendingPayments:allPays.filter((p:any)=>p.status==='pending').length,overduePayments:allPays.filter((p:any)=>p.status==='overdue').length})
    setRecentPayments(payments)

    const acts: Activity[] = []
    payments.slice(0,3).forEach((p:any) => acts.push({id:`pay-${p.id}`,type:'payment',title:`Pembayaran ${p.status==='paid'?'diterima':'dicatat'}`,subtitle:`${p.tenant?.full_name} — Kamar ${p.room?.room_number} ${p.room?.property?.name}`,time:p.created_at,status:p.status,amount:Number(p.amount)}))
    ;(tenantsRecentRes.data||[]).slice(0,2).forEach((t:any) => acts.push({id:`ten-${t.id}`,type:'tenant',title:'Penyewa baru ditambahkan',subtitle:t.full_name,time:t.created_at}))
    ;(agreementsRecentRes.data||[]).slice(0,2).forEach((a:any) => acts.push({id:`agr-${a.id}`,type:'agreement',title:`Kontrak sewa ${a.status==='active'?'dibuat':'diakhiri'}`,subtitle:`${a.tenant?.full_name} — Kamar ${a.room?.room_number}`,time:a.created_at,status:a.status}))
    acts.sort((a,b)=>new Date(b.time).getTime()-new Date(a.time).getTime())
    setActivities(acts.slice(0,3))
    setLoading(false)
  }

  function timeAgo(dateStr: string) {
    const diff=Date.now()-new Date(dateStr).getTime()
    const mins=Math.floor(diff/60000),hours=Math.floor(diff/3600000),days=Math.floor(diff/86400000)
    if(mins<1)return'Baru saja';if(mins<60)return`${mins} menit lalu`;if(hours<24)return`${hours} jam lalu`;if(days<7)return`${days} hari lalu`;return formatDate(dateStr)
  }

  const isOwner = ctx?.role === 'owner'
  const occupancyRate = stats.totalRooms>0?Math.round((stats.occupiedRooms/stats.totalRooms)*100):0
  const statusBadge=(s:string)=>{const m:Record<string,string>={paid:'badge-green',pending:'badge-yellow',overdue:'badge-red',cancelled:'badge-gray',active:'badge-green',ended:'badge-gray'};const l:Record<string,string>={paid:'Lunas',pending:'Belum Bayar',overdue:'Terlambat',cancelled:'Batal',active:'Aktif',ended:'Selesai'};return<span className={`badge ${m[s]||'badge-gray'}`}>{l[s]||s}</span>}
  const actBg=(type:string,status?:string)=>{if(type==='payment')return status==='paid'?'#d1fae5':status==='overdue'?'#fee2e2':'#fef3c7';if(type==='tenant')return'#ede9fe';return'#dbeafe'}
  const actIcon=(type:string,status?:string)=>{if(type==='payment')return status==='paid'?<CheckCircle size={14} color="#10b981"/>:status==='overdue'?<AlertCircle size={14} color="#ef4444"/>:<Clock size={14} color="#f59e0b"/>;if(type==='tenant')return<UserPlus size={14} color="#7c3aed"/>;return<FileText size={14} color="#2563eb"/>}

  if(loading)return<div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'300px',color:'var(--muted)'}}>Memuat dashboard...</div>

  if(properties.length===0){
    // Admin empty state — hanya tampil menu sesuai permission
    const adminCards = []
    if(!isOwner && ctx?.permissions?.manage_tenants) adminCards.push({href:'/tenants',icon:Users,color:'#7c3aed',bg:'#ede9fe',title:'Tambah Penyewa',desc:'Catat data penyewa yang masuk'})
    if(!isOwner && ctx?.permissions?.manage_payments) adminCards.push({href:'/payments',icon:CreditCard,color:'#d97706',bg:'#fef3c7',title:'Catat Pembayaran',desc:'Pantau tagihan bulanan'})
    // Owner full cards
    const ownerCards = [
      {href:'/properties',icon:Building2,color:'#2563eb',bg:'#dbeafe',title:'Tambah Properti',desc:'Daftarkan kos atau apartemen Anda'},
      {href:'/rooms',icon:DoorOpen,color:'#10b981',bg:'#d1fae5',title:'Tambah Kamar',desc:'Atur kamar beserta harganya'},
      {href:'/tenants',icon:Users,color:'#7c3aed',bg:'#ede9fe',title:'Tambah Penyewa',desc:'Catat data penyewa yang masuk'},
      {href:'/payments',icon:CreditCard,color:'#d97706',bg:'#fef3c7',title:'Catat Pembayaran',desc:'Pantau tagihan bulanan'},
    ]
    const cards = isOwner ? ownerCards : adminCards

    return (
      <div className="animate-in">
        <div className="page-header">
          <div>
            <h1 className="page-title">Selamat datang{userName?`, ${userName.split(' ')[0]}`:''}! 👋</h1>
            <p className="page-subtitle">
              {isOwner ? 'Mulai dengan menambahkan properti pertama Anda' : 'Belum ada data properti yang dapat Anda akses saat ini'}
            </p>
          </div>
        </div>
        {cards.length > 0 && (
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))',gap:'1rem',marginBottom:'2rem'}}>
            {cards.map(({href,icon:Icon,color,bg,title,desc})=>(
              <a key={href} href={href} style={{textDecoration:'none'}}>
                <div className="card" style={{cursor:'pointer',transition:'box-shadow 0.15s'}} onMouseEnter={e=>(e.currentTarget.style.boxShadow='0 4px 16px rgba(0,0,0,0.08)')} onMouseLeave={e=>(e.currentTarget.style.boxShadow='none')}>
                  <div style={{width:'3rem',height:'3rem',background:bg,borderRadius:'0.75rem',display:'flex',alignItems:'center',justifyContent:'center',marginBottom:'1rem'}}><Icon size={22} color={color}/></div>
                  <div style={{fontWeight:600,marginBottom:'0.25rem'}}>{title}</div>
                  <div style={{fontSize:'0.8125rem',color:'var(--muted)'}}>{desc}</div>
                </div>
              </a>
            ))}
          </div>
        )}
        {!isOwner && cards.length === 0 && (
          <div className="card" style={{textAlign:'center',padding:'3rem'}}>
            <Shield size={48} style={{margin:'0 auto 1rem',color:'#cbd5e1'}}/>
            <p style={{color:'var(--muted)'}}>Hubungi pemilik properti untuk mendapatkan akses ke data properti.</p>
          </div>
        )}
      </div>
    )
  }

  return(
    <div className="animate-in">
      <div className="page-header"><div><h1 className="page-title">Dashboard</h1><p className="page-subtitle">Ringkasan properti dan keuangan Anda</p></div></div>
      {stats.overduePayments>0&&<div style={{background:'#fef2f2',border:'1px solid #fecaca',borderRadius:'0.75rem',padding:'0.875rem 1rem',marginBottom:'1.5rem',display:'flex',alignItems:'center',gap:'0.75rem',color:'#991b1b'}}><AlertCircle size={18}/><span style={{fontWeight:500}}>{stats.overduePayments} pembayaran terlambat</span><a href="/payments" style={{marginLeft:'auto',color:'#ef4444',fontWeight:600,fontSize:'0.875rem',textDecoration:'none'}}>Lihat →</a></div>}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))',gap:'1rem',marginBottom:'1.5rem'}}>
        {[{label:'Total Properti',value:stats.totalProperties,icon:Building2,bg:'#dbeafe',color:'#2563eb',sub:`${stats.totalRooms} kamar total`},{label:'Kamar Terisi',value:`${stats.occupiedRooms}/${stats.totalRooms}`,icon:DoorOpen,bg:'#d1fae5',color:'#10b981',sub:`${occupancyRate}% tingkat hunian`},{label:'Total Penyewa',value:stats.totalTenants,icon:Users,bg:'#ede9fe',color:'#7c3aed',sub:'Penyewa aktif'},{label:'Pendapatan Bulan Ini',value:formatCurrency(stats.monthlyRevenue),icon:TrendingUp,bg:'#fef3c7',color:'#d97706',sub:'Dari pembayaran lunas'}].map(({label,value,icon:Icon,bg,color,sub})=>(
          <div key={label} className="stat-card"><div className="stat-icon" style={{background:bg}}><Icon size={20} color={color}/></div><div><div className="stat-value">{value}</div><div className="stat-label">{label}</div><div style={{fontSize:'0.75rem',color:'var(--muted)',marginTop:'0.25rem'}}>{sub}</div></div></div>
        ))}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 320px',gap:'1rem',alignItems:'start'}}>
        <div style={{display:'flex',flexDirection:'column',gap:'1rem'}}>
          <div className="card" style={{padding:0}}>
            <div style={{padding:'1rem 1.25rem',borderBottom:'1px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'center'}}><h3 style={{fontWeight:600}}>Pembayaran Terbaru</h3><a href="/payments" style={{fontSize:'0.8125rem',color:'var(--primary)',textDecoration:'none'}}>Lihat semua →</a></div>
            {recentPayments.length===0?<div style={{padding:'2.5rem',textAlign:'center',color:'var(--muted)'}}><CreditCard size={32} style={{margin:'0 auto 0.75rem',opacity:0.3}}/><p style={{marginBottom:'0.75rem'}}>Belum ada pembayaran</p>{ctx?.permissions?.manage_payments&&<a href="/payments" className="btn btn-primary btn-sm" style={{textDecoration:'none',display:'inline-flex'}}><Plus size={14}/> Catat</a>}</div>:(
              <div style={{overflowX:'auto'}}><table className="data-table"><thead><tr><th>Penyewa</th><th>Kamar</th><th>Jumlah</th><th>Status</th></tr></thead><tbody>{recentPayments.map(p=><tr key={p.id}><td style={{fontWeight:500}}>{(p as any).tenant?.full_name||'-'}</td><td style={{color:'var(--muted)',fontSize:'0.8125rem'}}>{(p as any).room?.room_number} · {(p as any).room?.property?.name}</td><td style={{fontWeight:600}}>{formatCurrency(Number(p.amount))}</td><td>{statusBadge(p.status)}</td></tr>)}</tbody></table></div>
            )}
          </div>
          <div className="card" style={{padding:0}}>
            <div style={{padding:'1rem 1.25rem',borderBottom:'1px solid var(--border)'}}><h3 style={{fontWeight:600}}>Aktivitas Terbaru</h3></div>
            {activities.length===0?<div style={{padding:'2rem',textAlign:'center',color:'var(--muted)',fontSize:'0.875rem'}}>Belum ada aktivitas</div>:(
              <>
                <div style={{padding:'0.25rem 0'}}>
                  {activities.map((act,i)=>(
                    <div key={act.id} style={{display:'flex',alignItems:'flex-start',gap:'0.875rem',padding:'0.75rem 1.25rem',borderBottom:i<activities.length-1?'1px solid var(--border)':'none'}}>
                      <div style={{width:'2rem',height:'2rem',borderRadius:'50%',background:actBg(act.type,act.status),display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginTop:'0.125rem'}}>{actIcon(act.type,act.status)}</div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:'0.5rem'}}>
                          <span style={{fontWeight:500,fontSize:'0.875rem'}}>{act.title}</span>
                          {act.amount&&<span style={{fontSize:'0.8125rem',fontWeight:600,color:'var(--primary)',flexShrink:0}}>{formatCurrency(act.amount)}</span>}
                        </div>
                        <div style={{fontSize:'0.8125rem',color:'var(--muted)',marginTop:'0.125rem',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{act.subtitle}</div>
                        <div style={{fontSize:'0.75rem',color:'#94a3b8',marginTop:'0.25rem'}}>{timeAgo(act.time)}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{padding:'0.75rem 1.25rem',borderTop:'1px solid var(--border)'}}>
                  <a href="/history" style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'0.5rem',fontSize:'0.8125rem',color:'var(--primary)',fontWeight:500,textDecoration:'none',padding:'0.5rem',borderRadius:'0.5rem',background:'var(--primary-light)'}}>
                    Lihat Semua Riwayat Aktivitas →
                  </a>
                </div>
              </>
            )}
          </div>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:'1rem'}}>
          <div className="card">
            <h3 style={{fontWeight:600,marginBottom:'1rem'}}>Tingkat Hunian</h3>
            <div style={{fontSize:'2.5rem',fontWeight:700,color:occupancyRate>=80?'#10b981':occupancyRate>=50?'#f59e0b':'#ef4444'}}>{occupancyRate}%</div>
            <div style={{background:'var(--border)',borderRadius:'999px',height:'8px',marginTop:'0.75rem',overflow:'hidden'}}><div style={{height:'100%',width:`${occupancyRate}%`,background:occupancyRate>=80?'#10b981':occupancyRate>=50?'#f59e0b':'#ef4444',borderRadius:'999px',transition:'width 0.6s ease'}}/></div>
            <div style={{display:'flex',justifyContent:'space-between',marginTop:'0.75rem',fontSize:'0.8125rem'}}><span style={{color:'#10b981',fontWeight:500}}>● Terisi: {stats.occupiedRooms}</span><span style={{color:'#64748b'}}>● Kosong: {stats.availableRooms}</span></div>
          </div>
          <div className="card">
            <h3 style={{fontWeight:600,marginBottom:'1rem'}}>Status Pembayaran</h3>
            {[{label:'Lunas',count:recentPayments.filter(p=>p.status==='paid').length,icon:CheckCircle,color:'#10b981'},{label:'Belum Bayar',count:stats.pendingPayments,icon:Clock,color:'#f59e0b'},{label:'Terlambat',count:stats.overduePayments,icon:AlertCircle,color:'#ef4444'}].map(({label,count,icon:Icon,color})=>(
              <div key={label} style={{display:'flex',alignItems:'center',gap:'0.75rem',padding:'0.5rem 0',borderBottom:'1px solid var(--border)'}}><Icon size={16} color={color}/><span style={{flex:1,fontSize:'0.875rem'}}>{label}</span><span style={{fontWeight:600,color}}>{count}</span></div>
            ))}
          </div>
          <div className="card">
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1rem'}}><h3 style={{fontWeight:600}}>Properti</h3>{isOwner&&<a href="/properties" style={{fontSize:'0.75rem',color:'var(--primary)',textDecoration:'none'}}>Kelola →</a>}</div>
            {properties.map((p:any)=>(
              <div key={p.id} style={{display:'flex',alignItems:'center',gap:'0.75rem',padding:'0.5rem 0',borderBottom:'1px solid var(--border)'}}>
                {p.image_url?<img src={p.image_url} alt={p.name} style={{width:'2rem',height:'2rem',borderRadius:'0.375rem',objectFit:'cover',flexShrink:0}}/>:<div style={{width:'2rem',height:'2rem',background:'var(--primary-light)',borderRadius:'0.375rem',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><Building2 size={14} color="var(--primary)"/></div>}
                <div style={{minWidth:0}}><div style={{fontWeight:500,fontSize:'0.875rem',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.name}</div><div style={{fontSize:'0.75rem',color:'var(--muted)'}}>{p.city} · {p.total_rooms} kamar</div></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}