import { redirect } from 'next/navigation'
import App from '../src/App'
import { getPageSession } from '../src/lib/auth/server-session'

export const dynamic = 'force-dynamic'

export default async function Page() {
  // Kiểm tra phiên ngay tại server (Proxy chỉ là lớp kiểm tra sớm).
  if (!(await getPageSession())) redirect('/login')
  return <App />
}
