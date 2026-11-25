import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { Be_Vietnam_Pro } from 'next/font/google'
import { headers } from 'next/headers'
import { THEME_BOOT_SCRIPT } from '../src/lib/theme'
import '../src/styles/index.css'

// Font tự host qua next/font (không gọi Google lúc chạy; đúng CSP font-src 'self').
const sans = Be_Vietnam_Pro({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-be-vietnam',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Kho tài khoản Liên Quân',
  description: 'Quản lý kho tài khoản, tra cứu tướng và tìm tài khoản sở hữu tướng trong Liên Quân Mobile.',
  robots: { index: false, follow: false },
  icons: {
    icon: '/assets/lien-quan-favicon.jpg',
    shortcut: '/assets/lien-quan-favicon.jpg',
    apple: '/assets/lien-quan-favicon.jpg',
  },
}

export const viewport: Viewport = {
  themeColor: '#0b0e14',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Nonce do proxy.ts tạo cho CSP; script boot theme chạy trước lần vẽ đầu (không nháy, B7).
  const nonce = (await headers()).get('x-nonce') ?? undefined
  return (
    <html lang="vi" className={sans.variable} suppressHydrationWarning>
      <head>
        {/* Trình duyệt ẩn thuộc tính nonce khỏi DOM sau khi parse → React thấy lệch khi hydrate. */}
        <script nonce={nonce} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
