import { createClient } from '@/lib/supabase/client'

export type UserRole = 'owner' | 'admin_properti'

export interface Permissions {
  manage_tenants: boolean
  manage_rooms: boolean
  view_payments: boolean
  manage_payments: boolean
  view_agreements: boolean
  view_dashboard: boolean
}

export interface AdminContext {
  role: UserRole
  ownerId: string
  propertyIds: string[]
  permissions: Permissions
}

const DEFAULT_OWNER_PERMISSIONS: Permissions = {
  manage_tenants: true, manage_rooms: true, view_payments: true,
  manage_payments: true, view_agreements: true, view_dashboard: true,
}

// Cache per session
let _cachedContext: AdminContext | null = null
let _cachedUserId: string | null = null

export async function getAdminContext(): Promise<AdminContext | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Pakai cache kalau user sama
  if (_cachedUserId === user.id && _cachedContext) return _cachedContext

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile) {
    // Profile belum ada (baru daftar), default sebagai owner
    _cachedContext = {
      role: 'owner',
      ownerId: user.id,
      propertyIds: [],
      permissions: DEFAULT_OWNER_PERMISSIONS,
    }
    _cachedUserId = user.id
    return _cachedContext
  }

  if (profile.role === 'owner' || !profile.role) {
    // Owner — akses penuh, ownerId = dirinya sendiri
    _cachedContext = {
      role: 'owner',
      ownerId: user.id,
      propertyIds: [],
      permissions: DEFAULT_OWNER_PERMISSIONS,
    }
  } else {
    // Admin properti — ambil data dari property_admins
    const { data: adminData } = await supabase
      .from('property_admins')
      .select('owner_id, property_ids, permissions')
      .eq('admin_id', user.id)
      .eq('is_active', true)
      .single()

    if (!adminData) {
      // Tidak ditemukan di property_admins, fallback owner
      _cachedContext = {
        role: 'owner',
        ownerId: user.id,
        propertyIds: [],
        permissions: DEFAULT_OWNER_PERMISSIONS,
      }
    } else {
      _cachedContext = {
        role: 'admin_properti',
        ownerId: adminData.owner_id,
        propertyIds: adminData.property_ids || [],
        permissions: { ...DEFAULT_OWNER_PERMISSIONS, ...(adminData.permissions || {}) },
      }
    }
  }

  _cachedUserId = user.id
  return _cachedContext
}

export function clearPermissionCache() {
  _cachedContext = null
  _cachedUserId = null
}