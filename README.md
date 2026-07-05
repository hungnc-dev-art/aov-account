# Kho Tướng & Account Liên Quân

Ứng dụng Next.js fullstack hiển thị hero catalog và quản lý account Liên Quân.
Hero/ảnh/kỹ năng được lưu local; account được lưu trên Neon Postgres qua Prisma.

## Cài đặt local

```bash
npm install
copy .env.example .env.local
```

Điền biến môi trường trong `.env.local`:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST/DB?sslmode=require"
```

Không commit `.env.local`.

Khởi tạo database và chạy app:

```bash
npm run db:generate
npm run db:migrate -- --name init
npm run dev
```

Các lệnh kiểm tra:

```bash
npm run lint
npm test
npm run typecheck
npm run build
```

## Kiến trúc dữ liệu

`Account` nằm trong Neon Postgres. Danh sách tướng được lưu bằng hai mảng
`heroes` và `heroNamesNormalized`; không cần bảng nối vì hero catalog là static.
API nằm tại:

- `GET/POST /api/accounts`
- `PUT/DELETE /api/accounts/:id`
- `POST /api/accounts/import`

Excel vẫn được parse ở browser. Kết quả import được gửi tới API và upsert vào Neon.
App tự thử migrate dữ liệu từ IndexedDB cũ một lần trên từng trình duyệt.

## Deploy Vercel

1. Import repository vào Vercel và chọn framework Next.js.
2. Tại **Project Settings → Environment Variables**, thêm `DATABASE_URL` cho
   Production, Preview và Development.
3. Không đặt connection string trong source hoặc Build Command.
4. Trước deploy schema mới, chạy:

```bash
npm run db:deploy
```

5. Deploy với Build Command mặc định `npm run build`.

Vercel chạy `prisma generate` qua `postinstall` và build script. Hero assets trong
`public/heroes/` được deploy như static files.

> Màn quản lý hiện chưa có authentication. Không public credential account trên
> deployment production trước khi bổ sung lớp đăng nhập/phân quyền.

## Cập nhật hero

```bash
npm run heroes:update
npm run heroes:check
```

Xem thêm `.agents/skills/update-hero-data.md`.
