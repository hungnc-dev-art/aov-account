import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { LoginForm } from '../../src/components/LoginForm'
import { getAuthConfig } from '../../src/lib/auth/config'
import { getPageSession } from '../../src/lib/auth/server-session'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Đăng nhập — Kho tài khoản Liên Quân' }

export default async function LoginPage() {
  if (await getPageSession()) redirect('/')
  return <LoginForm configured={Boolean(getAuthConfig())} />
}
