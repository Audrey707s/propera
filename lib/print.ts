import { formatCurrency, formatDate, formatMonthYear, getPaymentStatusLabel, getPaymentMethodLabel } from '@/lib/utils'

export function printNota(payment: any, ownerProfile: any) {
  const tenant = payment.tenant
  const room = payment.room

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Nota Pembayaran</title><style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:Arial,sans-serif;font-size:13px;color:#111;padding:28px;max-width:380px;margin:0 auto}
    .hdr{text-align:center;border-bottom:2px solid #111;padding-bottom:14px;margin-bottom:16px}
    .logo{font-size:20px;font-weight:800}.sub{font-size:11px;color:#666;margin-top:3px}
    .title{font-size:13px;font-weight:700;margin:10px 0 2px;text-transform:uppercase;letter-spacing:1px}
    .num{font-size:11px;color:#888}
    table{width:100%;border-collapse:collapse;margin:10px 0}
    td{padding:4px 0;vertical-align:top}
    td:first-child{color:#666;width:42%;font-size:12px}td:last-child{font-weight:500;font-size:12px}
    .dash{border-top:1px dashed #ccc;margin:10px 0}
    .big td{font-size:15px;font-weight:700;padding-top:6px}
    .badge{display:inline-block;padding:2px 10px;border-radius:999px;font-size:11px;font-weight:700}
    .paid{background:#d1fae5;color:#065f46}.pending{background:#fef3c7;color:#92400e}.overdue{background:#fee2e2;color:#991b1b}
    .ttd{margin-top:44px;text-align:right;font-size:12px}
    .ttd-line{margin-top:52px;border-top:1px solid #111;display:inline-block;min-width:140px;text-align:center;padding-top:4px}
    .ftr{text-align:center;margin-top:20px;padding-top:12px;border-top:1px dashed #ccc;font-size:11px;color:#888}
  </style></head><body>
  <div class="hdr">
    <div class="logo">🏠 KosManager</div>
    <div class="sub">${ownerProfile?.full_name||'Pemilik Properti'}${ownerProfile?.phone?' · '+ownerProfile.phone:''}</div>
    <div class="title">Nota Pembayaran Sewa</div>
    <div class="num">No: #${payment.id.substring(0,8).toUpperCase()}</div>
  </div>
  <table><tbody>
    <tr><td>Penyewa</td><td>${tenant?.full_name||'-'}</td></tr>
    <tr><td>No. HP</td><td>${tenant?.phone||'-'}</td></tr>
    <tr><td>Kamar</td><td>${room?.room_number||'-'} — ${room?.property?.name||'-'}</td></tr>
    <tr><td>Alamat</td><td>${(room?.property?.address||'')+', '+(room?.property?.city||'')}</td></tr>
  </tbody></table>
  <div class="dash"></div>
  <table><tbody>
    <tr><td>Periode Sewa</td><td>${formatMonthYear(payment.payment_month)}</td></tr>
    <tr><td>Jatuh Tempo</td><td>${formatDate(payment.due_date)}</td></tr>
    ${payment.paid_date?`<tr><td>Tanggal Bayar</td><td>${formatDate(payment.paid_date)}</td></tr>`:''}
    ${payment.payment_method?`<tr><td>Metode Bayar</td><td>${getPaymentMethodLabel(payment.payment_method)}</td></tr>`:''}
    ${payment.notes?`<tr><td>Catatan</td><td>${payment.notes}</td></tr>`:''}
  </tbody></table>
  <div class="dash"></div>
  <table class="big"><tbody>
    <tr><td>Total Pembayaran</td><td>${formatCurrency(Number(payment.amount))}</td></tr>
    <tr><td>Status</td><td><span class="badge ${payment.status==='paid'?'paid':payment.status==='overdue'?'overdue':'pending'}">${getPaymentStatusLabel(payment.status)}</span></td></tr>
  </tbody></table>
  <div class="ttd"><div>Hormat kami,</div><div class="ttd-line">${ownerProfile?.full_name||'Pemilik Properti'}</div></div>
  <div class="ftr">
    <div>Dicetak: ${new Date().toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'})}</div>
    <div style="margin-top:4px">Terima kasih atas kepercayaan Anda 🙏</div>
  </div>
  </body></html>`

  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const iframe = document.createElement('iframe')
  iframe.style.cssText = 'display:none;position:fixed;width:0;height:0'
  document.body.appendChild(iframe)
  iframe.src = url
  iframe.onload = () => {
    try {
      iframe.contentWindow?.print()
    } catch(e) {
      window.open(url, '_blank')
    }
    setTimeout(() => { document.body.removeChild(iframe); URL.revokeObjectURL(url) }, 2000)
  }
}