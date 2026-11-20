# Kho Tướng & Account Liên Quân

Ứng dụng Next.js fullstack (giao diện Graphite Command) để tra cứu tướng và quản lý kho
tài khoản Liên Quân. Hero/ảnh/kỹ năng được lưu trong repo; tài khoản lưu trên Neon Postgres
qua Prisma. Toàn bộ app yêu cầu đăng nhập bằng mật khẩu chủ sở hữu.

## Cài đặt local

```bash
npm ci
copy .env.example .env.local
```

Điền `.env.local` (không commit file này):

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST/DB?sslmode=require"   # nên là Neon branch dev
AUTH_SESSION_SECRET="..."        # node scripts/auth-setup.mjs secret
AUTH_OWNER_PASSWORD_HASH="..."   # node scripts/auth-setup.mjs hash  (nhập mật khẩu, không hiển thị)
```

Thiếu một trong hai biến `AUTH_*` thì app từ chối mọi truy cập (fail closed).

```bash
npm run dev          # http://127.0.0.1:3000 (chỉ nghe trên localhost)
```

Kiểm tra trước khi commit:

```bash
npm run lint
npm test
npm run typecheck
npm run build
```

QA giao diện end-to-end (dữ liệu giả, không chạm DB): xem `.claude/skills/aov-testing/SKILL.md`.

## Kiến trúc

- Trang `/` và `/login` kiểm tra phiên ở server; `proxy.ts` chặn sớm và gắn CSP có nonce.
- API (đều cần phiên; request ghi phải cùng origin và là JSON):
  - `GET/POST /api/accounts` — danh sách không kèm mật khẩu (chỉ `hasPassword`)
  - `PUT/DELETE /api/accounts/:id`, `GET /api/accounts/:id/password`
  - `POST /api/accounts/export` (kèm mật khẩu cần nhập lại mật khẩu chủ sở hữu)
  - `POST /api/accounts/import` (`merge` / `create-only` / `replace` có xác nhận)
  - `POST /api/auth/login|logout|reauth`, `GET /api/auth/session`
- `Account` lưu `heroes` và `heroNamesNormalized` (hai mảng song song); không có bảng nối.
- Excel được parse ngay trong trình duyệt (SheetJS 0.20.3 từ CDN chính thức).

## Deploy Vercel

1. Project Settings → Environment Variables: `DATABASE_URL`, `AUTH_SESSION_SECRET`,
   `AUTH_OWNER_PASSWORD_HASH` cho Production và Preview (secret khác nhau mỗi môi trường).
2. Bật Deployment Protection (Vercel Authentication) và rate-limit rule cho `/api/auth/*`.
3. Trước khi deploy code cần schema mới: `npm run db:deploy` lên đúng database đích.
4. Build Command mặc định `npm run build` (chạy `prisma generate`).

Đổi mật khẩu chủ sở hữu: sinh hash mới bằng `scripts/auth-setup.mjs`, cập nhật env, redeploy.
Đăng xuất mọi phiên: đổi `AUTH_SESSION_SECRET` rồi redeploy.

## Cập nhật hero

```bash
npm run heroes:update
npm run heroes:check
```

Xem thêm `.claude/skills/hero-catalog/SKILL.md`.
