---
name: neon-prisma
description: Quy trình an toàn cho Prisma 7 + Neon Postgres + Vercel trong repo này — sửa prisma/schema.prisma, tạo/xem migration, prisma.config.ts, Prisma Client singleton với PrismaNeon (src/lib/prisma.ts), transaction, biến môi trường DATABASE_URL theo Development/Preview/Production và kiểm tra trước/sau deploy. Dùng khi đổi schema hoặc migration, chạy bất kỳ lệnh prisma/db:*, sửa kết nối database, hoặc chuẩn bị deploy Vercel.
---

# Neon + Prisma + Vercel

## Quy tắc số 0: xác định database đích trước mọi lệnh chạm DB

`prisma.config.ts` nạp `.env.local` bằng dotenv và lấy `env('DATABASE_URL')`. File
`.env.local` của repo có dấu hiệu được kéo từ Vercel (`vercel env pull`), nên
`DATABASE_URL` có thể trỏ tới Neon branch dùng chung hoặc production.

- Không in, log, echo hay đưa giá trị `DATABASE_URL` (kể cả host) vào câu trả lời.
- Trước khi chạy lệnh có kết nối DB, **hỏi người dùng xác nhận** `.env.local` đang
  trỏ tới Neon branch dev riêng. Không tự suy đoán từ nội dung file.
- Không chạy migration, seed, reset, truncate, `deleteMany` hay import `replace`
  trên database thật khi chưa có yêu cầu rõ ràng và xác nhận đúng môi trường.

| Mức | Lệnh | Ghi chú |
| --- | --- | --- |
| An toàn (không kết nối) | `npm run db:generate`, `npx prisma validate`, `npx prisma format` | `validate`/`format` vẫn đọc config nhưng không ghi DB |
| Chỉ đọc | `npx prisma migrate status` | Kết nối DB đích |
| Ghi schema — chỉ trên branch dev | `npm run db:migrate -- --name <ten>` (`prisma migrate dev`) | Có thể đề nghị **reset toàn bộ DB** khi phát hiện drift |
| Ghi schema — đích triển khai | `npm run db:deploy` (`prisma migrate deploy`) | Chỉ áp migration đã commit; người dùng tự chọn đích |
| Cấm nếu chưa được yêu cầu rõ | `prisma migrate reset`, `prisma db push` (nhất là `--accept-data-loss`/`--force-reset`), `prisma db execute`, sửa dữ liệu qua Studio | Phá huỷ hoặc bỏ qua lịch sử migration |

## Cấu hình hiện tại

- Prisma ORM 7.6: generator `prisma-client`, output `src/generated/prisma`
  (gitignored, import từ `src/generated/prisma/client`). Datasource **không** có
  `url` trong schema — URL nằm ở `prisma.config.ts`.
- Runtime: `src/lib/prisma.ts` tạo một `PrismaClient({ adapter: new PrismaNeon({ connectionString }) })`,
  cache trên `globalThis` ở non-production để tránh nhân connection khi hot reload.
  Ném lỗi nếu thiếu `DATABASE_URL`. Không tạo client mới trong handler.
- Route dùng Prisma phải giữ `export const runtime = 'nodejs'`.
- `npm run build` = `prisma generate && next build`; `postinstall` cũng generate.
  Build **không** migrate. Không thêm `migrate dev`/`db push` vào build.
- Model duy nhất `Account`; `heroes` và `heroNamesNormalized` là `text[]`; index
  `updatedAt`; unique `username`. Migration đầu: `prisma/migrations/20260625151240_init`.

## Quy trình đổi schema

1. Sửa `prisma/schema.prisma`; chạy `npx prisma format` và `npx prisma validate`.
2. Trên Neon branch dev đã xác nhận: `npm run db:migrate -- --name <mo_ta_ro>`.
   Muốn xem SQL trước khi áp: `npx prisma migrate dev --create-only --name <ten>`,
   đọc `migration.sql`, rồi chạy lại `npm run db:migrate`.
3. Soát `migration.sql`:
   - Cột mới `NOT NULL` phải có `DEFAULT` hoặc bước backfill.
   - Đổi tên cột/bảng: Prisma sinh `DROP` + `ADD` → mất dữ liệu. Sửa tay thành
     `ALTER TABLE ... RENAME COLUMN ...`.
   - `DROP`/thu hẹp kiểu dữ liệu cần người dùng duyệt riêng.
4. `npm run db:generate`, cập nhật `src/types.ts`, `serializeAccount`,
   `normalizeAccountInput` và client (xem skill `account-crud`).
5. `npm run lint`, `npm test`, `npm run typecheck`, `npm run build`.
6. Commit `schema.prisma` **và** thư mục migration mới cùng nhau (khi người dùng yêu cầu commit).
7. Triển khai: người dùng chạy `npm run db:deploy` lên đúng database đích **trước**
   khi deploy code cần schema mới. Ghi rõ bước này trong PR.

## Transaction

- Thao tác nhiều bước phải nguyên tử dùng `prisma.$transaction(async (tx) => ...)`
  và chỉ gọi `tx.*` bên trong. Import hiện dùng `maxWait 10s`, `timeout 120s`, upsert
  tuần tự — giữ phần việc trong transaction tối thiểu, không gọi mạng ngoài DB.
- Không bắt lỗi rồi tiếp tục trong transaction: ném lỗi để rollback.

## Biến môi trường và Vercel

- Local: `.env.local` (đã gitignore). `.env.example` chỉ chứa placeholder.
- Vercel: Project Settings → Environment Variables, đặt `DATABASE_URL` riêng cho
  Development, Preview, Production. Khuyến nghị Preview dùng Neon branch riêng
  (không trỏ production) vì app chưa có xác thực.
- Không đặt connection string dưới tên `NEXT_PUBLIC_*`, không đưa vào Build Command,
  source, log hay tài liệu.
- Thêm/đổi tên biến: ghi tên (không ghi giá trị) trong PR và `.env.example`.

## Kiểm tra sau deploy (do người dùng thực hiện)

- `/` hiển thị catalog; `/api/accounts` trả JSON và không lộ biến môi trường.
- `#accounts` tạo/sửa/xoá/import được trên môi trường **không phải** production thật.
- Network/console của trình duyệt không chứa connection string.

Không tự deploy Vercel hay chạy `vercel` CLI có tác động trong các tác vụ thông thường.
