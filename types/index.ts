export type PropertyType = 'kos' | 'apartemen' | 'kontrakan'
export type RoomType = 'standard' | 'deluxe' | 'vip'
export type RoomStatus = 'available' | 'occupied' | 'maintenance'
export type PaymentStatus = 'pending' | 'paid' | 'overdue' | 'cancelled'
export type PaymentMethod = 'cash' | 'transfer' | 'qris' | 'other'
export type AgreementStatus = 'active' | 'ended' | 'terminated'
export type DepositStatus = 'pending' | 'paid' | 'returned'
export type ExpenseCategory = 'maintenance' | 'utilities' | 'tax' | 'salary' | 'renovation' | 'other'
export type UserRole = 'owner' | 'admin_properti'

export interface Profile {
  id: string; full_name: string | null; phone: string | null; avatar_url: string | null
  role: UserRole; created_at: string; updated_at: string
}

export interface Property {
  id: string; owner_id: string; name: string; address: string; city: string
  description: string | null; facilities: string[] | null; property_type: PropertyType
  total_rooms: number; image_url: string | null; image_urls?: string[]
  is_active: boolean; created_at: string; updated_at: string; rooms?: Room[]
}

export interface Room {
  id: string; property_id: string; room_number: string; floor: number
  room_type: RoomType; monthly_price: number; size_sqm: number | null
  facilities: string[] | null; status: RoomStatus; image_url: string | null
  image_urls?: string[]; notes: string | null; created_at: string; updated_at: string
  property?: Property
}

export interface Tenant {
  id: string; owner_id: string; full_name: string; nik: string | null
  phone: string; email: string | null; emergency_contact_name: string | null
  emergency_contact_phone: string | null; occupation: string | null
  id_card_url: string | null; photo_url: string | null; notes: string | null
  is_active: boolean; created_at: string; updated_at: string
  rental_agreements?: RentalAgreement[]
}

export interface RentalAgreement {
  id: string; room_id: string; tenant_id: string; owner_id: string
  start_date: string; end_date: string; monthly_price: number
  deposit_amount: number; deposit_status: DepositStatus
  status: AgreementStatus; notes: string | null; created_at: string; updated_at: string
  room?: Room; tenant?: Tenant; payments?: Payment[]
}

export interface Payment {
  id: string; agreement_id: string; owner_id: string; tenant_id: string
  room_id: string; amount: number; payment_month: string; due_date: string
  paid_date: string | null; payment_method: PaymentMethod | null
  payment_proof_url: string | null; status: PaymentStatus; notes: string | null
  created_at: string; updated_at: string
  tenant?: Tenant; room?: Room; agreement?: RentalAgreement
}

export interface Expense {
  id: string; property_id: string; owner_id: string; category: ExpenseCategory
  description: string; amount: number; expense_date: string
  receipt_url: string | null; notes: string | null; created_at: string
  property?: Property
}

export interface DashboardStats {
  totalProperties: number; totalRooms: number; occupiedRooms: number
  availableRooms: number; totalTenants: number; monthlyRevenue: number
  pendingPayments: number; overduePayments: number; occupancyRate: number
}