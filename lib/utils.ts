export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(amount)
}

export function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric',
  }).format(new Date(dateStr))
}

export function formatMonthYear(dateStr: string): string {
  return new Intl.DateTimeFormat('id-ID', {
    month: 'long', year: 'numeric',
  }).format(new Date(dateStr))
}

export function getRoomTypeLabel(type: string): string {
  const labels: Record<string, string> = { standard:'Standard', deluxe:'Deluxe', vip:'VIP' }
  return labels[type] || type
}

export function getRoomStatusLabel(status: string): string {
  const labels: Record<string, string> = { available:'Tersedia', occupied:'Terisi', maintenance:'Perawatan' }
  return labels[status] || status
}

export function getPaymentStatusLabel(status: string): string {
  const labels: Record<string, string> = { pending:'Belum Bayar', paid:'Lunas', overdue:'Terlambat', cancelled:'Dibatalkan' }
  return labels[status] || status
}

export function getPaymentMethodLabel(method: string): string {
  const labels: Record<string, string> = { cash:'Tunai', transfer:'Transfer Bank', qris:'QRIS', other:'Lainnya' }
  return labels[method] || method
}

export function getPropertyTypeLabel(type: string): string {
  const labels: Record<string, string> = { kos:'Kos', apartemen:'Apartemen', kontrakan:'Kontrakan' }
  return labels[type] || type
}

export function getExpenseCategoryLabel(cat: string): string {
  const labels: Record<string, string> = { maintenance:'Perawatan', utilities:'Utilitas', tax:'Pajak', salary:'Gaji', renovation:'Renovasi', other:'Lainnya' }
  return labels[cat] || cat
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}