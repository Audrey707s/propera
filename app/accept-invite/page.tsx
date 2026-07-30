'use client'
import { useCallback, useEffect, useMemo, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Check, X, Shield, Building2 } from 'lucide-react'

interface AdminInvitation {
  id: string
  owner_id: string
  email: string
  token: string
  property_ids: string[]
  permissions: Record<string, boolean>
  status: string
  expires_at: string
}

function AcceptInviteContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const supabase = useMemo(() => createClient(), [])
  const [status, setStatus] = useState<'loading' | 'ready' | 'success' | 'error' | 'already'>('loading')
  const [invitation, setInvitation] = useState<AdminInvitation | null>(null)
  const [ownerName, setOwnerName] = useState('')
  const [propertyNames, setPropertyNames] = useState<string[]>([])
  const [error, setError] = useState('')
  const [processing, setProcessing] = useState(false)

  const loadInvitation = useCallback(async () => {
    if (!token) {
      setError('Token undangan tidak ditemukan.')
      setStatus('error')
      return
    }

    const { data: inv } = await supabase
      .from('admin_invitations')
      .select('*')
      .eq('token', token)
      .single<AdminInvitation>()

    if (!inv) { setError('Undangan tidak ditemukan atau sudah tidak valid.'); setStatus('error'); return }
    if (inv.status !== 'pending') { setError('Undangan ini sudah digunakan atau kedaluwarsa.'); setStatus('error'); return }
    if (new Date(inv.expires_at) < new Date()) { setError('Undangan ini sudah kedaluwarsa.'); setStatus('error'); return }

    setInvitation(inv)

    // Ambil nama owner & properti lewat RPC (bypass RLS dengan aman, hanya utk token valid)
    const { data: details, error: detailsErr } = await supabase.rpc('get_invitation_details', { invite_token: token })
    if (detailsErr) {
      console.error('get_invitation_details error:', detailsErr)
    }
    const detail = details?.[0]
    setOwnerName(detail?.owner_name || 'Pemilik Properti')
    setPropertyNames(detail?.property_names || [])
    setStatus('ready')
  }, [supabase, token])

  useEffect(() => { void Promise.resolve().then(loadInvitation) }, [loadInvitation])

  async function handleAccept() {
    if (!invitation) {
      setError('Data undangan belum siap. Coba muat ulang halaman.')
      return
    }

    setProcessing(true)
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      // Simpan token ke localStorage lalu redirect ke register
      localStorage.setItem('pending_invite_token', token || '')
      window.location.href = `/register?invite=${token}`
      return
    }

    // Semua proses (update role, insert property_admins, update status undangan)
    // dijalankan atomic di server lewat RPC agar tidak diblokir RLS dan tidak ada state setengah jalan.
    const { error: rpcErr } = await supabase.rpc('accept_admin_invitation', { invite_token: token })

    if (rpcErr) {
      const messages: Record<string, string> = {
        email_mismatch: `Akun Anda (${user.email}) tidak sesuai dengan undangan (${invitation.email}). Silakan login dengan email yang benar.`,
        invitation_expired: 'Undangan ini sudah kedaluwarsa.',
        invitation_already_used: 'Undangan ini sudah digunakan atau kedaluwarsa.',
        invitation_not_found: 'Undangan tidak ditemukan atau sudah tidak valid.',
        not_authenticated: 'Sesi Anda berakhir. Silakan login kembali.',
      }
      setError(messages[rpcErr.message] || rpcErr.message)
      setProcessing(false)
      return
    }

    localStorage.removeItem('pending_invite_token')

    setStatus('success')
    setTimeout(() => { window.location.href = '/dashboard' }, 2000)
  }

  async function handleAuthRedirect(path: 'login' | 'register') {
    if (!token) return
    localStorage.setItem('pending_invite_token', token)
    await supabase.auth.signOut()
    window.location.href = `/${path}?invite=${token}`
  }

  if (status === 'loading') return (
    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)' }}>Memverifikasi undangan...</div>
  )

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--background)', padding: '1.5rem' }}>
      <div style={{ background: 'white', borderRadius: '1rem', padding: '2rem', width: '100%', maxWidth: '440px', boxShadow: '0 8px 32px rgba(0,0,0,0.08)', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <img src="/propera-icon.png" alt="Propera" style={{ width: '2.75rem', height: '2.75rem', objectFit: 'contain' }}/>
          <span style={{ fontFamily: 'var(--font-logo)', fontWeight: 800, fontSize: '1.125rem', color: '#1e3a8a', letterSpacing: '0.3px' }}>PROPERA</span>
        </div>

        {status === 'error' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: '3.5rem', height: '3.5rem', borderRadius: '50%', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
              <X size={24} color="#ef4444"/>
            </div>
            <h2 style={{ fontWeight: 700, marginBottom: '0.5rem' }}>Undangan Tidak Valid</h2>
            <p style={{ color: 'var(--muted)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>{error}</p>
            <a href="/login" className="btn btn-primary" style={{ textDecoration: 'none' }}>Kembali ke Login</a>
          </div>
        )}

        {status === 'ready' && (
          <>
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{ width: '3.5rem', height: '3.5rem', borderRadius: '50%', background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                <Shield size={24} color="var(--primary)"/>
              </div>
              <h2 style={{ fontWeight: 700, marginBottom: '0.375rem' }}>Undangan Admin Properti</h2>
              <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>
                <strong>{ownerName}</strong> mengundang Anda menjadi Admin Properti di Propera
              </p>
            </div>

            <div style={{ background: 'var(--surface-2)', borderRadius: '0.75rem', padding: '1rem', marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--muted)', marginBottom: '0.625rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Properti yang dapat Anda kelola</div>
              {propertyNames.map(n => (
                <div key={n} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.375rem 0', fontSize: '0.875rem' }}>
                  <Building2 size={14} color="var(--primary)"/><span>{n}</span>
                </div>
              ))}
            </div>

            {error && <div style={{ background: '#fee2e2', borderRadius: '0.5rem', padding: '0.75rem', marginBottom: '1rem', color: '#991b1b', fontSize: '0.875rem' }}>{error}</div>}

            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '0.75rem' }} onClick={handleAccept} disabled={processing}>
              {processing ? 'Memproses...' : 'Terima Undangan'}
            </button>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem' }}>
              <button type="button" onClick={() => handleAuthRedirect('login')} className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>Login</button>
              <button type="button" onClick={() => handleAuthRedirect('register')} className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>Daftar</button>
            </div>
            <p style={{ textAlign: 'center', fontSize: '0.8125rem', color: 'var(--muted)', marginTop: '0.875rem' }}>
              Undangan untuk: <strong>{invitation?.email}</strong>
            </p>
          </>
        )}

        {status === 'success' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: '3.5rem', height: '3.5rem', borderRadius: '50%', background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
              <Check size={24} color="#10b981"/>
            </div>
            <h2 style={{ fontWeight: 700, marginBottom: '0.5rem' }}>Berhasil!</h2>
            <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>Anda sudah menjadi Admin Properti. Mengalihkan ke dashboard...</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={<div style={{ textAlign: 'center', padding: '3rem' }}>Memuat...</div>}>
      <AcceptInviteContent />
    </Suspense>
  )
}