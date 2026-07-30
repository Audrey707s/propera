'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatMonthYear } from '@/lib/utils'
import { TrendingUp, Download, Calendar, AlertCircle, BarChart2 } from 'lucide-react'

type Range = '1bulan' | '6bulan' | '1tahun' | '5tahun'

interface DataPoint { label: string; income: number; pending: number; overdue: number }
interface PropertySummary { id: string; name: string; income: number; rooms: number; occupied: number }

export default function ReportsPage() {
  const supabase = createClient()
  const [data, setData] = useState<DataPoint[]>([])
  const [propertySummary, setPropertySummary] = useState<PropertySummary[]>([])
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState<Range>('1tahun')
  const [totalIncome, setTotalIncome] = useState(0)
  const [totalPending, setTotalPending] = useState(0)
  const [totalOverdue, setTotalOverdue] = useState(0)

  useEffect(() => { loadReports() }, [range])

  function getRangeDates(): { start: string; end: string; groupBy: 'day'|'month'|'year' } {
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const today = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`
    if (range === '1bulan') {
      const start = new Date(now); start.setDate(start.getDate() - 30)
      return { start: `${start.getFullYear()}-${pad(start.getMonth()+1)}-${pad(start.getDate())}`, end: today, groupBy: 'day' }
    }
    if (range === '6bulan') {
      const start = new Date(now); start.setMonth(start.getMonth() - 6)
      return { start: `${start.getFullYear()}-${pad(start.getMonth()+1)}-01`, end: today, groupBy: 'month' }
    }
    if (range === '1tahun') {
      return { start: `${now.getFullYear()}-01-01`, end: today, groupBy: 'month' }
    }
    // 5 tahun
    return { start: `${now.getFullYear()-4}-01-01`, end: today, groupBy: 'year' }
  }

  async function loadReports() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { start, end, groupBy } = getRangeDates()

    const [paymentsRes, propsRes] = await Promise.all([
      supabase.from('payments').select('amount, status, payment_month, room_id').eq('owner_id', user.id).gte('payment_month', start).lte('payment_month', end),
      supabase.from('properties').select('id, name, total_rooms').eq('owner_id', user.id),
    ])
    const payments = paymentsRes.data || []
    const props = propsRes.data || []

    // Build data points
    const map: Record<string, DataPoint> = {}
    const now = new Date()

    if (groupBy === 'day') {
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now); d.setDate(d.getDate() - i)
        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
        map[key] = { label: `${d.getDate()}/${d.getMonth()+1}`, income:0, pending:0, overdue:0 }
      }
      payments.forEach(p => {
        const key = p.payment_month.substring(0,10)
        if (!map[key]) return
        if (p.status==='paid') map[key].income += Number(p.amount)
        else if (p.status==='pending') map[key].pending += Number(p.amount)
        else if (p.status==='overdue') map[key].overdue += Number(p.amount)
      })
    } else if (groupBy === 'month') {
      const months = range === '6bulan' ? 6 : 12
      for (let i = months-1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth()-i, 1)
        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`
        const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']
        map[key] = { label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`, income:0, pending:0, overdue:0 }
      }
      payments.forEach(p => {
        const key = p.payment_month.substring(0,7)+'-01'
        if (!map[key]) return
        if (p.status==='paid') map[key].income += Number(p.amount)
        else if (p.status==='pending') map[key].pending += Number(p.amount)
        else if (p.status==='overdue') map[key].overdue += Number(p.amount)
      })
    } else {
      for (let i = 4; i >= 0; i--) {
        const yr = now.getFullYear()-i
        map[String(yr)] = { label: String(yr), income:0, pending:0, overdue:0 }
      }
      payments.forEach(p => {
        const yr = p.payment_month.substring(0,4)
        if (!map[yr]) return
        if (p.status==='paid') map[yr].income += Number(p.amount)
        else if (p.status==='pending') map[yr].pending += Number(p.amount)
        else if (p.status==='overdue') map[yr].overdue += Number(p.amount)
      })
    }

    const points = Object.values(map)
    setData(points)
    setTotalIncome(points.reduce((s,d)=>s+d.income,0))
    setTotalPending(points.reduce((s,d)=>s+d.pending,0))
    setTotalOverdue(points.reduce((s,d)=>s+d.overdue,0))

    // Per properti
    const propIds = props.map(p => p.id)
    if (propIds.length > 0) {
      const [roomsRes, paidRes] = await Promise.all([
        supabase.from('rooms').select('id,property_id,status').in('property_id', propIds),
        supabase.from('payments').select('amount,room_id').eq('owner_id', user.id).eq('status','paid').gte('payment_month', start).lte('payment_month', end),
      ])
      const rooms = roomsRes.data || []
      const paidPays = paidRes.data || []
      setPropertySummary(props.map(p => {
        const pr = rooms.filter(r=>r.property_id===p.id)
        const ids = pr.map(r=>r.id)
        return { id:p.id, name:p.name, income:paidPays.filter(pay=>ids.includes(pay.room_id)).reduce((s,pay)=>s+Number(pay.amount),0), rooms:pr.length, occupied:pr.filter(r=>r.status==='occupied').length }
      }))
    }
    setLoading(false)
  }

  function exportCSV() {
    const rows = [['Periode','Pendapatan (Rp)','Belum Bayar (Rp)','Terlambat (Rp)'], ...data.map(d=>[d.label,d.income,d.pending,d.overdue])]
    const blob = new Blob([rows.map(r=>r.join(',')).join('\n')],{type:'text/csv'})
    const a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`laporan-${range}.csv`; a.click()
  }

  // Line chart: skala berdasarkan nilai TERTINGGI dari ketiga garis (bukan jumlah/stacked)
  const maxVal = Math.max(...data.flatMap(d=>[d.income,d.pending,d.overdue]),1)
  const CHART_H = 160
  const pointSpacing = range==='5tahun' ? 90 : range==='1bulan' ? 28 : 60
  const chartWidth = Math.max(data.length*pointSpacing, 300)

  const xOf = (i: number) => i*pointSpacing + pointSpacing/2
  const yOf = (val: number) => CHART_H - (val/maxVal)*CHART_H
  const lineOf = (key: 'income'|'pending'|'overdue') => data.map((d,i)=>`${xOf(i)},${yOf(d[key])}`).join(' ')

  const rangeLabels: Record<Range,string> = { '1bulan':'30 Hari Terakhir', '6bulan':'6 Bulan Terakhir', '1tahun':'Tahun Ini', '5tahun':'5 Tahun Terakhir' }

  return (
    <div className="animate-in">
      <div className="page-header">
        <div><h1 className="page-title">Laporan Keuangan</h1><p className="page-subtitle">Grafik dan ringkasan pendapatan properti Anda</p></div>
        <button className="btn btn-secondary" onClick={exportCSV}><Download size={15}/> Export CSV</button>
      </div>

      {/* Summary */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))', gap:'1rem', marginBottom:'1.5rem' }}>
        {[
          { label:'Total Pendapatan', value:formatCurrency(totalIncome), icon:TrendingUp, bg:'#d1fae5', color:'#10b981' },
          { label:'Belum Dibayar', value:formatCurrency(totalPending), icon:Calendar, bg:'#fef3c7', color:'#f59e0b' },
          { label:'Terlambat', value:formatCurrency(totalOverdue), icon:AlertCircle, bg:'#fee2e2', color:'#ef4444' },
        ].map(({ label, value, icon:Icon, bg, color }) => (
          <div key={label} className="stat-card">
            <div className="stat-icon" style={{ background:bg }}><Icon size={20} color={color}/></div>
            <div><div className="stat-value" style={{ fontSize:'1.2rem', color }}>{value}</div><div className="stat-label">{label}</div></div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="card" style={{ marginBottom:'1.5rem' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.25rem', flexWrap:'wrap', gap:'0.75rem' }}>
          <h3 style={{ fontWeight:600, display:'flex', alignItems:'center', gap:'0.5rem' }}><BarChart2 size={18} color="var(--primary)"/> Grafik Pembayaran</h3>
          <div style={{ display:'flex', gap:'0.5rem', flexWrap:'wrap' }}>
            {(['1bulan','6bulan','1tahun','5tahun'] as Range[]).map(r => (
              <button key={r} onClick={()=>setRange(r)} className="btn btn-sm" style={{ background:range===r?'var(--primary)':'var(--surface-2)', color:range===r?'white':'var(--muted)', border:'none' }}>
                {r==='1bulan'?'1 Bln':r==='6bulan'?'6 Bln':r==='1tahun'?'1 Thn':'5 Thn'}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display:'flex', gap:'1rem', fontSize:'0.75rem', color:'var(--muted)', marginBottom:'1rem' }}>
          {[['#10b981','Lunas'],['#fbbf24','Belum Bayar'],['#ef4444','Terlambat']].map(([c,l])=>(
            <span key={l} style={{ display:'flex', alignItems:'center', gap:'0.375rem' }}>
              <span style={{ width:'14px', height:'3px', borderRadius:'2px', background:c, display:'inline-block' }}/>{l}
            </span>
          ))}
        </div>

        {loading ? (
          <div style={{ height:'200px', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--muted)' }}>Memuat grafik...</div>
        ) : data.length === 0 ? (
          <div style={{ height:'200px', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--muted)' }}>Belum ada data</div>
        ) : (
          <div style={{ overflowX:'auto' }}>
            <svg width={chartWidth} height={CHART_H+34} viewBox={`0 0 ${chartWidth} ${CHART_H+34}`} style={{ display:'block', minWidth:`${chartWidth}px` }}>
              {/* grid lines + y labels */}
              {[100,75,50,25].map(pct => {
                const y = CHART_H - (CHART_H*pct/100)
                return (
                  <g key={pct}>
                    <line x1={0} x2={chartWidth} y1={y} y2={y} stroke="#e2e8f0" strokeDasharray="4 4"/>
                    <text x={2} y={y-3} fontSize="9" fill="#94a3b8">
                      {formatCurrency(maxVal*pct/100).replace('Rp\u00a0','').replace('Rp ','').replace(',00','')}
                    </text>
                  </g>
                )
              })}

              {/* garis: terlambat (merah), belum bayar (kuning), lunas (hijau) */}
              <polyline points={lineOf('overdue')} fill="none" stroke="#ef4444" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
              <polyline points={lineOf('pending')} fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
              <polyline points={lineOf('income')} fill="none" stroke="#10b981" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>

              {/* titik + label sumbu-x */}
              {data.map((d, i) => {
                const x = xOf(i)
                const skip = range==='1bulan' && data.length>14 && i%2!==0
                return (
                  <g key={i}>
                    <circle cx={x} cy={yOf(d.overdue)} r="3" fill="#ef4444"><title>{`${d.label}\nTerlambat: ${formatCurrency(d.overdue)}`}</title></circle>
                    <circle cx={x} cy={yOf(d.pending)} r="3" fill="#fbbf24"><title>{`${d.label}\nBelum Bayar: ${formatCurrency(d.pending)}`}</title></circle>
                    <circle cx={x} cy={yOf(d.income)} r="3" fill="#10b981"><title>{`${d.label}\nLunas: ${formatCurrency(d.income)}`}</title></circle>
                    {!skip && <text x={x} y={CHART_H+20} fontSize="9" fill="var(--muted)" textAnchor="middle">{d.label}</text>}
                  </g>
                )
              })}
            </svg>
          </div>
        )}
        <div style={{ textAlign:'center', marginTop:'0.5rem', fontSize:'0.8125rem', color:'var(--muted)' }}>{rangeLabels[range]}</div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
        {/* Per properti */}
        <div className="card" style={{ padding:0 }}>
          <div style={{ padding:'1rem 1.25rem', borderBottom:'1px solid var(--border)' }}>
            <h3 style={{ fontWeight:600 }}>Pendapatan per Properti</h3>
            <p style={{ fontSize:'0.75rem', color:'var(--muted)', marginTop:'0.125rem' }}>{rangeLabels[range]}</p>
          </div>
          {propertySummary.length===0 ? (
            <div style={{ padding:'2rem', textAlign:'center', color:'var(--muted)' }}>Belum ada data</div>
          ) : (
            <table className="data-table">
              <thead><tr><th>Properti</th><th>Hunian</th><th>Pendapatan</th></tr></thead>
              <tbody>
                {propertySummary.sort((a,b)=>b.income-a.income).map(p => (
                  <tr key={p.id}>
                    <td style={{ fontWeight:500 }}>{p.name}</td>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
                        <div style={{ background:'var(--border)', borderRadius:'999px', height:'6px', width:'50px', overflow:'hidden' }}>
                          <div style={{ height:'100%', width:`${p.rooms>0?Math.round(p.occupied/p.rooms*100):0}%`, background:'#10b981', borderRadius:'999px' }}/>
                        </div>
                        <span style={{ fontSize:'0.8125rem', color:'var(--muted)' }}>{p.rooms>0?Math.round(p.occupied/p.rooms*100):0}%</span>
                      </div>
                    </td>
                    <td style={{ fontWeight:600, color:'var(--primary)' }}>{formatCurrency(p.income)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Tabel detail */}
        <div className="card" style={{ padding:0 }}>
          <div style={{ padding:'1rem 1.25rem', borderBottom:'1px solid var(--border)' }}>
            <h3 style={{ fontWeight:600 }}>Detail Periode</h3>
            <p style={{ fontSize:'0.75rem', color:'var(--muted)', marginTop:'0.125rem' }}>{rangeLabels[range]}</p>
          </div>
          <div style={{ overflowX:'auto', maxHeight:'340px', overflowY:'auto' }}>
            <table className="data-table">
              <thead><tr><th>Periode</th><th>Lunas</th><th>Belum</th><th>Terlambat</th></tr></thead>
              <tbody>
                {data.filter(d=>d.income+d.pending+d.overdue>0).length===0 ? (
                  <tr><td colSpan={4} style={{ textAlign:'center', color:'var(--muted)', padding:'2rem' }}>Belum ada data periode ini</td></tr>
                ) : [...data].reverse().filter(d=>d.income+d.pending+d.overdue>0).map((d,i) => (
                  <tr key={i}>
                    <td style={{ fontWeight:500, whiteSpace:'nowrap' }}>{d.label}</td>
                    <td style={{ color:'#10b981', fontWeight:600 }}>{d.income>0?formatCurrency(d.income):'-'}</td>
                    <td style={{ color:'#f59e0b' }}>{d.pending>0?formatCurrency(d.pending):'-'}</td>
                    <td style={{ color:'#ef4444' }}>{d.overdue>0?formatCurrency(d.overdue):'-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}