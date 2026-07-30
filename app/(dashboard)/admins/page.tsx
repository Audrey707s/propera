'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'
import { Shield, Plus, Trash2, Check, X, UserCheck, Clock, Mail, Copy, ExternalLink, UserPlus, Edit2 } from 'lucide-react'

interface PropertyAdmin {
  id: string; admin_id: string; owner_id: string
  property_ids: string[]; permissions: Record<string, boolean>
  is_active: boolean; created_at: string
  profile: { full_name: string | null; phone: string | null; avatar_url: string | null }
}
interface Invitation {
  id: string; email: string; token: string; property_ids: string[]
  permissions: Record<string, boolean>; status: string
  expires_at: string; created_at: string
}
interface Property { id: string; name: string }

const DEFAULT_PERMISSIONS = {
  manage_tenants: true, manage_rooms: true, view_payments: true,
  manage_payments: true, view_agreements: true, view_dashboard: true,
}
const PERMISSION_LABELS: Record<string, string> = {
  view_dashboard: 'Lihat Dashboard',
  manage_rooms: 'Lihat & Kelola Kamar',
  manage_tenants: 'Kelola Penyewa',
  view_agreements: 'Lihat Kontrak Sewa',
  view_payments: 'Lihat Pembayaran',
  manage_payments: 'Catat Pembayaran',
}

type ModalMode = 'new' | 'existing' | 'edit'

export default function AdminsPage() {
  const supabase = useMemo(() => createClient(), [])
  const [admins, setAdmins] = useState<PropertyAdmin[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [modalMode, setModalMode] = useState<ModalMode>('new')
  const [editingAdmin, setEditingAdmin] = useState<PropertyAdmin | null>(null)

  // Form state — semua dikelola di level komponen utama (bukan sub-komponen)
  const [email, setEmail] = useState('')
  const [selectedProps, setSelectedProps] = useState<string[]>([])
  const [permissions, setPermissions] = useState<Record<string, boolean>>({ ...DEFAULT_PERMISSIONS })
  const [expiryDays, setExpiryDays] = useState('30')

  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [inviteLink, setInviteLink] = useState('')
  const [userId, setUserId] = useState('')

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)
    const [propsRes, adminsRes, invitesRes] = await Promise.all([
      supabase.from('properties').select('id, name').eq('owner_id', user.id),
      supabase.from('property_admins').select('*, profile:profiles(full_name, phone, avatar_url)').eq('owner_id', user.id),
      supabase.from('admin_invitations').select('*').eq('owner_id', user.id).order('created_at', { ascending: false }),
    ])
    setProperties(propsRes.data || [])
    setAdmins(adminsRes.data || [])
    setInvitations(invitesRes.data || [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { void Promise.resolve().then(loadData) }, [loadData])

  function openModal(mode: ModalMode, admin?: PropertyAdmin) {
    setModalMode(mode)
    setError(''); setSuccess(''); setInviteLink('')
    if (mode === 'edit' && admin) {
      setEditingAdmin(admin)
      setEmail('')
      setSelectedProps([...admin.property_ids])
      setPermissions({ ...DEFAULT_PERMISSIONS, ...admin.permissions })
    } else {
      setEditingAdmin(null)
      setEmail('')
      setSelectedProps(properties.map(p => p.id))
      setPermissions({ ...DEFAULT_PERMISSIONS })
      setExpiryDays('30')
    }
    setShowModal(true)
  }

  function getInviteLink(token: string) {
    if (!token) return ''
    if (typeof window === 'undefined') return `/accept-invite?token=${token}`
    return `${window.location.origin}/accept-invite?token=${token}`
  }

  async function copyInviteLink(tokenOrLink: string) {
    const link = tokenOrLink.startsWith('http') ? tokenOrLink : getInviteLink(tokenOrLink)
    if (!link) return
    await navigator.clipboard.writeText(link)
    alert('Link undangan berhasil disalin!')
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault(); setSending(true); setError('')
    if (selectedProps.length === 0) { setError('Pilih minimal satu properti.'); setSending(false); return }
    const token = crypto.randomUUID()
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + parseInt(expiryDays || '30'))
    const { data: invite, error: err } = await supabase.from('admin_invitations').insert({
      owner_id: userId, email, token,
      property_ids: selectedProps, permissions,
      status: 'pending', expires_at: expiresAt.toISOString(),
    }).select('*').single()
    if (err) { setError(err.message); setSending(false); return }
    setInviteLink(getInviteLink(invite?.token || token))
    setSuccess(modalMode === 'existing'
      ? `Link aktivasi untuk ${email} berhasil dibuat.`
      : `Undangan untuk ${email} berhasil dibuat. Mereka perlu daftar dengan email ini terlebih dahulu.`)
    setSending(false); loadData()
  }

  async function handleEditSave(e: React.FormEvent) {
    e.preventDefault()
    if (!editingAdmin) return
    setSending(true); setError('')
    if (selectedProps.length === 0) { setError('Pilih minimal satu properti.'); setSending(false); return }
    const { error: err } = await supabase.from('property_admins')
      .update({ property_ids: selectedProps, permissions })
      .eq('id', editingAdmin.id)
    if (err) { setError(err.message); setSending(false); return }
    setShowModal(false); setSending(false); loadData()
  }

  async function handleToggleAdmin(adminId: string, currentActive: boolean) {
    await supabase.from('property_admins').update({ is_active: !currentActive }).eq('id', adminId)
    loadData()
  }

  async function handleRemoveAdmin(adminId: string, name: string) {
    if (!confirm(`Hapus akses admin untuk ${name}? Mereka tidak bisa lagi mengakses properti Anda.`)) return
    await supabase.from('property_admins').delete().eq('id', adminId)
    loadData()
  }

  async function handleCancelInvite(id: string) {
    await supabase.from('admin_invitations').delete().eq('id', id); loadData()
  }

  function toggleProp(id: string) {
    setSelectedProps(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id])
  }
  function togglePerm(key: string) {
    setPermissions(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const statusBadge = (status: string) => {
    const m: Record<string, { cls: string; label: string }> = {
      pending: { cls: 'badge-yellow', label: 'Menunggu' },
      accepted: { cls: 'badge-green', label: 'Diterima' },
      expired: { cls: 'badge-gray', label: 'Kedaluwarsa' },
    }
    const s = m[status] || { cls: 'badge-gray', label: status }
    return <span className={`badge ${s.cls}`}>{s.label}</span>
  }

  const modalTitle: Record<ModalMode, string> = {
    new: 'Undang Admin Properti',
    existing: 'Tambah Admin (Sudah Punya Akun)',
    edit: `Edit Admin — ${editingAdmin?.profile?.full_name || 'Admin'}`,
  }
  const modalDesc: Record<ModalMode, string> = {
    new: 'Admin harus mendaftar dengan email ini di KosManager, lalu membuka link undangan.',
    existing: 'Masukkan email akun KosManager yang sudah ada. Sistem akan membuat link aktivasi.',
    edit: 'Ubah properti yang bisa diakses dan hak akses admin ini.',
  }

  return (
    <div className="animate-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Kelola Admin</h1>
          <p className="page-subtitle">Undang dan kelola admin properti Anda</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-secondary" onClick={() => openModal('existing')}><UserPlus size={15} /> Sudah Punya Akun</button>
          <button className="btn btn-primary" onClick={() => openModal('new')}><Plus size={16} /> Undang Admin Baru</button>
        </div>
      </div>

      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '0.75rem', padding: '1rem 1.25rem', marginBottom: '1.5rem', display: 'flex', gap: '0.875rem' }}>
        <Shield size={18} color="#2563eb" style={{ flexShrink: 0, marginTop: '2px' }} />
        <div style={{ fontSize: '0.875rem', color: '#1e40af' }}>
          <strong>Cara menambah admin:</strong>
          <div style={{ marginTop: '0.375rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <div>• <strong>Admin baru</strong> → klik <em>Undang Admin Baru</em>, bagikan link, mereka daftar lalu klik link.</div>
            <div>• <strong>Sudah punya akun KosManager</strong> → klik <em>Sudah Punya Akun</em>, masukkan email, bagikan link aktivasi.</div>
          </div>
        </div>
      </div>

      {/* Admin aktif */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: 0 }}>
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}><UserCheck size={16} color="var(--primary)" /> Admin Aktif</h3>
          <span className="badge badge-blue">{admins.length} admin</span>
        </div>
        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)' }}>Memuat...</div>
        ) : admins.length === 0 ? (
          <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--muted)' }}>
            <Shield size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.3 }} />
            <p>Belum ada admin. Undang admin untuk membantu mengelola properti.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead><tr><th>Admin</th><th>Properti</th><th>Hak Akses</th><th>Status</th><th>Aksi</th></tr></thead>
              <tbody>
                {admins.map(a => {
                  const assignedProps = properties.filter(p => a.property_ids.includes(p.id))
                  const perms = Object.entries(a.permissions).filter(([, v]) => v).map(([k]) => PERMISSION_LABELS[k]).filter(Boolean)
                  const initials = a.profile?.full_name?.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase() || '?'
                  return (
                    <tr key={a.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                          <div style={{ width: '2rem', height: '2rem', borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, flexShrink: 0, overflow: 'hidden' }}>
                            {a.profile?.avatar_url ? <img src={a.profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} /> : initials}
                          </div>
                          <div>
                            <div style={{ fontWeight: 500 }}>{a.profile?.full_name || 'Admin'}</div>
                            {a.profile?.phone && <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{a.profile.phone}</div>}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                          {assignedProps.length === 0
                            ? <span style={{ color: 'var(--muted)', fontSize: '0.8125rem' }}>Semua properti</span>
                            : assignedProps.map(p => <span key={p.id} className="badge badge-blue">{p.name}</span>)}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', maxWidth: '220px' }}>
                          {perms.slice(0, 3).map(p => <span key={p} style={{ background: 'var(--surface-2)', borderRadius: '0.25rem', padding: '0.125rem 0.375rem', fontSize: '0.7rem', color: 'var(--muted)' }}>{p}</span>)}
                          {perms.length > 3 && <span style={{ fontSize: '0.7rem', color: 'var(--primary)' }}>+{perms.length - 3} lainnya</span>}
                        </div>
                      </td>
                      <td><span className={`badge ${a.is_active ? 'badge-green' : 'badge-gray'}`}>{a.is_active ? 'Aktif' : 'Nonaktif'}</span></td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.375rem' }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => openModal('edit', a)} title="Edit"><Edit2 size={13} /></button>
                          <button className="btn btn-secondary btn-sm" onClick={() => handleToggleAdmin(a.id, a.is_active)}>{a.is_active ? 'Nonaktifkan' : 'Aktifkan'}</button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleRemoveAdmin(a.id, a.profile?.full_name || 'admin ini')}><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Undangan terkirim */}
      {invitations.length > 0 && (
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
            <h3 style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Clock size={16} color="#f59e0b" /> Undangan Terkirim</h3>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead><tr><th>Email</th><th>Properti</th><th>Dikirim</th><th>Berlaku s/d</th><th>Status</th><th>Link</th><th></th></tr></thead>
              <tbody>
                {invitations.map(inv => {
                  const assignedProps = properties.filter(p => inv.property_ids.includes(p.id))
                  return (
                    <tr key={inv.id}>
                      <td><div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Mail size={14} color="var(--muted)" />{inv.email}</div></td>
                      <td><div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>{assignedProps.map(p => <span key={p.id} className="badge badge-blue">{p.name}</span>)}</div></td>
                      <td style={{ color: 'var(--muted)', fontSize: '0.8125rem' }}>{formatDate(inv.created_at)}</td>
                      <td style={{ color: 'var(--muted)', fontSize: '0.8125rem' }}>{formatDate(inv.expires_at)}</td>
                      <td>{statusBadge(inv.status)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.375rem' }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => copyInviteLink(inv.token)} disabled={!inv.token}><Copy size={13} /> Salin</button>
                          {inv.token && <a className="btn btn-secondary btn-sm" href={getInviteLink(inv.token)} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}><ExternalLink size={13} /></a>}
                        </div>
                      </td>
                      <td><button className="btn btn-danger btn-sm" onClick={() => handleCancelInvite(inv.id)}><X size={13} /></button></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '520px' }}>
            <h2 style={{ fontWeight: 700, fontSize: '1.125rem', marginBottom: '0.375rem' }}>{modalTitle[modalMode]}</h2>
            <p style={{ fontSize: '0.8125rem', color: 'var(--muted)', marginBottom: '1.25rem' }}>{modalDesc[modalMode]}</p>
            {error && <div style={{ background: '#fee2e2', borderRadius: '0.5rem', padding: '0.75rem', marginBottom: '1rem', color: '#991b1b', fontSize: '0.875rem' }}>{error}</div>}

            {/* EDIT MODE */}
            {modalMode === 'edit' && (
              <form onSubmit={handleEditSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.125rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', background: 'var(--surface-2)', borderRadius: '0.625rem' }}>
                  <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9375rem', fontWeight: 700, flexShrink: 0, overflow: 'hidden' }}>
                    {editingAdmin?.profile?.avatar_url
                      ? <img src={editingAdmin.profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : editingAdmin?.profile?.full_name?.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?'}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600 }}>{editingAdmin?.profile?.full_name || 'Admin'}</div>
                    {editingAdmin?.profile?.phone && <div style={{ fontSize: '0.8125rem', color: 'var(--muted)' }}>{editingAdmin.profile.phone}</div>}
                  </div>
                  <span className={`badge ${editingAdmin?.is_active ? 'badge-green' : 'badge-gray'}`} style={{ marginLeft: 'auto' }}>{editingAdmin?.is_active ? 'Aktif' : 'Nonaktif'}</span>
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: 500, marginBottom: '0.5rem', fontSize: '0.875rem' }}>Properti yang Bisa Diakses</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {properties.map(p => (
                      <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', cursor: 'pointer', padding: '0.625rem', borderRadius: '0.5rem', border: `1px solid ${selectedProps.includes(p.id) ? 'var(--primary)' : 'var(--border)'}`, background: selectedProps.includes(p.id) ? '#eff6ff' : 'white' }}>
                        <input type="checkbox" checked={selectedProps.includes(p.id)} onChange={() => toggleProp(p.id)} style={{ accentColor: 'var(--primary)' }} />
                        <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{p.name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: 500, marginBottom: '0.5rem', fontSize: '0.875rem' }}>Hak Akses</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    {Object.entries(PERMISSION_LABELS).map(([key, label]) => (
                      <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', padding: '0.5rem 0.625rem', borderRadius: '0.5rem', border: `1px solid ${permissions[key] ? 'var(--primary)' : 'var(--border)'}`, background: permissions[key] ? '#eff6ff' : 'white', fontSize: '0.8125rem' }}>
                        <input type="checkbox" checked={!!permissions[key]} onChange={() => togglePerm(key)} style={{ accentColor: 'var(--primary)' }} />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Batal</button>
                  <button type="submit" className="btn btn-primary" disabled={sending}>{sending ? 'Menyimpan...' : 'Simpan Perubahan'}</button>
                </div>
              </form>
            )}

            {/* INVITE / EXISTING MODE */}
            {modalMode !== 'edit' && (
              <>
                {success ? (
                  <div style={{ background: '#d1fae5', border: '1px solid #a7f3d0', borderRadius: '0.75rem', padding: '1.25rem', textAlign: 'center' }}>
                    <Check size={32} color="#10b981" style={{ margin: '0 auto 0.75rem' }} />
                    <p style={{ color: '#065f46', fontWeight: 500, marginBottom: '0.75rem' }}>{success}</p>
                    {inviteLink && (
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.875rem' }}>
                        <input className="form-input" value={inviteLink} readOnly style={{ fontSize: '0.8125rem' }} />
                        <button className="btn btn-primary" onClick={() => copyInviteLink(inviteLink)}><Copy size={14} /> Salin</button>
                      </div>
                    )}
                    <p style={{ fontSize: '0.8125rem', color: '#064e3b', marginTop: '0.75rem' }}>
                      {modalMode === 'existing' ? 'Kirim link ini ke admin. Mereka tinggal klik untuk aktivasi.' : 'Mereka perlu daftar dengan email yang sama, lalu klik link.'}
                    </p>
                    <button className="btn btn-secondary" style={{ marginTop: '1rem' }} onClick={() => { setShowModal(false); setSuccess(''); setInviteLink('') }}>Tutup</button>
                  </div>
                ) : (
                  <form onSubmit={handleInvite} style={{ display: 'flex', flexDirection: 'column', gap: '1.125rem' }}>
                    <div>
                      <label style={{ display: 'block', fontWeight: 500, marginBottom: '0.375rem', fontSize: '0.875rem' }}>Email Admin</label>
                      <input
                        type="email"
                        className="form-input"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="email@admin.com"
                        autoComplete="off"
                        required
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontWeight: 500, marginBottom: '0.5rem', fontSize: '0.875rem' }}>Properti yang Bisa Diakses</label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {properties.map(p => (
                          <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', cursor: 'pointer', padding: '0.625rem', borderRadius: '0.5rem', border: `1px solid ${selectedProps.includes(p.id) ? 'var(--primary)' : 'var(--border)'}`, background: selectedProps.includes(p.id) ? '#eff6ff' : 'white' }}>
                            <input type="checkbox" checked={selectedProps.includes(p.id)} onChange={() => toggleProp(p.id)} style={{ accentColor: 'var(--primary)' }} />
                            <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{p.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontWeight: 500, marginBottom: '0.5rem', fontSize: '0.875rem' }}>Hak Akses</label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                        {Object.entries(PERMISSION_LABELS).map(([key, label]) => (
                          <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', padding: '0.5rem 0.625rem', borderRadius: '0.5rem', border: `1px solid ${permissions[key] ? 'var(--primary)' : 'var(--border)'}`, background: permissions[key] ? '#eff6ff' : 'white', fontSize: '0.8125rem' }}>
                            <input type="checkbox" checked={!!permissions[key]} onChange={() => togglePerm(key)} style={{ accentColor: 'var(--primary)' }} />
                            {label}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontWeight: 500, marginBottom: '0.375rem', fontSize: '0.875rem' }}>Masa Berlaku Undangan</label>
                      <select className="form-input" value={expiryDays} onChange={e => setExpiryDays(e.target.value)}>
                        <option value="1">1 hari</option>
                        <option value="3">3 hari</option>
                        <option value="7">7 hari</option>
                        <option value="14">14 hari</option>
                        <option value="30">30 hari</option>
                        <option value="90">90 hari</option>
                        <option value="365">1 tahun</option>
                      </select>
                      <p style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.375rem' }}>Link undangan akan kedaluwarsa setelah {expiryDays} hari.</p>
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                      <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Batal</button>
                      <button type="submit" className="btn btn-primary" disabled={sending}>
                        {sending ? 'Memproses...' : modalMode === 'existing' ? 'Buat Link Aktivasi' : 'Buat Undangan'}
                      </button>
                    </div>
                  </form>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}