import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import '../src/style.css'

export const metadata: Metadata = {
  title: 'Kho tài khoản Liên Quân',
  description:
    'Quản lý kho tài khoản, tra cứu tướng và tìm account sở hữu tướng trong Liên Quân Mobile.',
  icons: {
    icon: '/assets/lien-quan-favicon.jpg',
    shortcut: '/assets/lien-quan-favicon.jpg',
    apple: '/assets/lien-quan-favicon.jpg',
  },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  )
}
