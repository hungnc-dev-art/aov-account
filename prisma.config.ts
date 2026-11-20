import { config } from 'dotenv'
import { defineConfig } from 'prisma/config'

config({ path: '.env.local', quiet: true })

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  // `prisma generate` không cần kết nối DB: để trống khi thiếu biến để `npm ci`
  // chạy được trên máy mới và CI. Lệnh migrate vẫn báo lỗi rõ nếu thiếu URL.
  datasource: {
    url: process.env.DATABASE_URL,
  },
})
