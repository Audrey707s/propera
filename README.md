# Propera - Platform Manajemen Properti

Platform web untuk mengelola properti kos, apartemen, dan kontrakan. Dibangun dengan **Next.js 15** dan **Supabase**.

---

## Fitur Utama

- **Auth**: Login & Register dengan Supabase Auth
- **Properti**: CRUD properti (kos, apartemen, kontrakan)
- **Kamar**: CRUD kamar per properti + update status (tersedia/terisi/perawatan)
- **Penyewa**: CRUD data penyewa lengkap (NIK, kontak darurat, dll)
- **Kontrak Sewa**: Buat dan kelola kontrak antara penyewa & kamar
- **Pembayaran**: Catat pembayaran, tandai lunas, filter by status/bulan
- **Dashboard**: Statistik ringkas — hunian, pendapatan, status pembayaran

---

## Setup

### 1. Clone & Install

```bash
npm install
```

### 2. Buat Project Supabase

1. Buka [supabase.com](https://supabase.com) → New Project
2. Catat **Project URL** dan **Anon Key**

### 3. Jalankan Schema Database

Di Supabase Dashboard → **SQL Editor** → jalankan file:

```
supabase/schema.sql
```

### 4. Konfigurasi Environment

Edit file `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
```

### 5. Jalankan Aplikasi

```bash
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000)

---

## Struktur Folder

```
kos-manager/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx        # Halaman login
│   │   └── register/page.tsx     # Halaman daftar
│   └── (dashboard)/
│       ├── layout.tsx            # Sidebar + topbar
│       ├── dashboard/page.tsx    # Halaman utama
│       ├── properties/page.tsx   # Manajemen properti
│       ├── rooms/page.tsx        # Manajemen kamar
│       ├── tenants/page.tsx      # Manajemen penyewa
│       ├── agreements/page.tsx   # Kontrak sewa
│       └── payments/page.tsx     # Pembayaran
├── lib/
│   ├── supabase/
│   │   ├── client.ts             # Supabase browser client
│   │   └── server.ts             # Supabase server client
│   └── utils.ts                  # Helper functions
├── types/index.ts                 # TypeScript types
├── middleware.ts                  # Auth middleware
└── supabase/schema.sql           # Database schema lengkap
```

---

## Database Schema

| Tabel | Keterangan |
|---|---|
| `profiles` | Profil pengguna (extends auth.users) |
| `properties` | Data properti/gedung |
| `rooms` | Kamar dalam properti |
| `tenants` | Data penyewa |
| `rental_agreements` | Kontrak sewa penyewa-kamar |
| `payments` | Catatan pembayaran sewa |
| `expenses` | Pengeluaran properti |

Semua tabel dilindungi **Row Level Security (RLS)** — setiap pemilik hanya melihat data miliknya sendiri.

---

## Tech Stack

- **Frontend**: Next.js 15 (App Router), TypeScript, CSS Variables
- **Backend/DB**: Supabase (PostgreSQL + Auth + RLS)
- **Icons**: Lucide React
- **Deployment**: Vercel (recommended)
