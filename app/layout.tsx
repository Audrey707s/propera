import type { Metadata } from 'next'
import { Poppins } from 'next/font/google'
import './globals.css'

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-logo',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Propera - Platform Manajemen Properti',
  description: 'Kelola kos, apartemen, dan properti sewaan Anda dengan mudah bersama Propera',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={poppins.variable}>
      <body>{children}</body>
    </html>
  )
}