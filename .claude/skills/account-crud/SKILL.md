---
name: account-crud
description: Quy trình sửa luồng CRUD account Liên Quân — Route Handler app/api/accounts (GET/POST/PUT/DELETE), validate/normalize bằng normalizeAccountInput, serializeAccount, lớp gọi API src/lib/account-api.ts, type Account/AccountDraft và các component AccountForm, AccountCard, AccountManagementPage, HeroOwnerAccount. Dùng khi thêm/sửa trường account, đổi contract API, sửa form thêm/sửa/xoá/tìm account, xử lý lỗi username trùng hoặc index account–hero.
---

# Account CRUD

Dùng skill này khi thay đổi bất kỳ phần nào của vòng đời account: nhận input →
validate/normalize ở server → Prisma → serialize → client state → UI. Các quy tắc
nền nằm ở `AGENTS.md` mục 6–7; skill này là quy trình thao tác.

## Bản đồ file

| Lớp | File | Ghi chú |
| --- | --- | --- |
| Type dùng chung | `src/types.ts` | `Account` (không có password, có `hasPassword`), `AccountDraft`, `AccountImportRow` |
| Validate/normalize server | `src/lib/accounts.ts` | `normalizeAccountInput`, `dedupeHeroNames`, `usernameKey`, `toPublicAccount` |
| Lỗi/phản hồi | `src/lib/http.ts` | `readJson` (giới hạn kích thước), `ValidationError`, `errorResponse` |
| Quyền | `src/lib/auth/guard.ts` | `requireOwner(request, { write, recentAuth })` — gọi ở MỌI handler |
| Route list/create | `app/api/accounts/route.ts` | `runtime = 'nodejs'`, `dynamic = 'force-dynamic'` |
| Route update/delete | `app/api/accounts/[id]/route.ts` | `params` là `Promise` (Next 16), `parseAccountId` |
| Mật khẩu một tài khoản | `app/api/accounts/[id]/password/route.ts` | gọi khi bấm xem/sao chép |
| Gọi API từ client | `src/lib/account-api.ts` | ném `ApiError(status, code, message)`; 401 → về `/login` |
| State + index | `src/App.tsx`, `src/lib/catalog.ts` | `refresh`, `buildOwnerIndex` (`useMemo`, Set theo tài khoản) |
| UI | `src/components/accounts.tsx`, `account-form.tsx`, `hero-drawer.tsx` | mật khẩu qua `PasswordSecret` |
| Test | `src/lib/accounts.test.ts`, `test/api/account-routes.test.ts` | Vitest, mock Prisma, dữ liệu giả |

Route Handler import bằng đường dẫn tương đối (`../../../src/...`); repo không có
path alias. Prisma Client import từ `src/generated/prisma/client`.

## Contract hiện tại (đối chiếu trước khi sửa)

Mọi route: chưa đăng nhập → 401 `UNAUTHENTICATED`; route ghi khác origin → 403
`CSRF_REJECTED`; không phải `application/json` → 415. Lỗi không xác định → 500 message chung.

| Method | Thành công | Lỗi |
| --- | --- | --- |
| `GET /api/accounts[?hero=]` | 200 `{ accounts }` (không có `password`), `updatedAt desc` | 500 JSON |
| `GET /api/accounts/:id/password` | 200 `{ password }`, `no-store` | 400, 404 |
| `POST /api/accounts` | 201 `{ account }` | 409 `USERNAME_TAKEN` (so sánh không phân biệt hoa/thường), 400 |
| `PUT /api/accounts/:id` | 200 `{ account }`; trường không gửi được giữ nguyên | 400, 404, 409 |
| `DELETE /api/accounts/:id` | 200 `{ success: true }` | 400, 404 |

`normalizeAccountInput`:

- `username`: bắt buộc, `trim()`, ≤ 128 ký tự. Unique trong DB theo giá trị chính xác;
  so sánh logic (trùng, import) theo `usernameKey` = trim + lowercase. Không tự đổi
  username đã lưu, không gộp bản ghi.
- `heroes`: mảng string ≤ 300, mỗi tên ≤ 64; `dedupeHeroNames` trim, gộp khoảng trắng,
  bỏ tên normalize rỗng, loại trùng theo `normalizeText`, giữ tên hiển thị đầu tiên.
- `heroNamesNormalized` luôn sinh lại ở server, cùng thứ tự với `heroes`.
- `password` (≤ 256) có thể rỗng; `passwordOptional` (PUT) → `undefined` = giữ nguyên.
  `nickname` được trim; các trường khác ≤ 64, `note` ≤ 1000.

## Quy trình khi sửa

1. **Đọc trước**: file trong bảng trên liên quan tới thay đổi + `src/lib/accounts.test.ts`.
   Chạy `git status` để không ghi đè thay đổi chưa commit của người dùng.
2. **Xác định có đổi contract không** (trường mới, response mới, status code mới).
   Nếu có, sửa đồng bộ theo thứ tự: `prisma/schema.prisma` (+ migration, xem skill
   `neon-prisma`) → `src/types.ts` → `src/lib/accounts.ts` → route → `account-api.ts`
   → component. Không để client và server lệch contract.
3. **Giữ các bất biến**:
   - Cặp `heroes`/`heroNamesNormalized` cùng độ dài, cùng thứ tự, sinh cùng lúc.
   - Chỉ dùng `normalizeText`/`splitHeroes` từ `src/utils/normalize.ts`.
   - Hero lạ (không có trong catalog) vẫn được lưu nguyên.
   - Password rỗng hợp lệ; UI hiển thị "Chưa có", không chặn lưu.
   - `createdAt`/`updatedAt` do Prisma sinh; client nhận ISO string qua `serializeAccount`.
4. **Xử lý lỗi ở route**: map `P2002` → 409, `P2025` → 404. Lỗi validate (do
   `normalizeAccountInput` ném) được phép trả message tiếng Việt. Lỗi không xác định
   phải trả message chung — **không** trả `error.message` của Prisma/driver. (Hiện
   `POST`/`PUT` đang trả `error.message` cho mọi lỗi; khi chạm vào hãy tách lớp lỗi
   validate riêng thay vì mở rộng hành vi này.)
5. **Client**: sau mọi mutation gọi `onAccountsChanged()` (→ `GET /api/accounts`)
   thay vì tự vá state. Mọi `await` gọi API trong UI phải có nhánh hiển thị lỗi
   cho người dùng; không để promise bị reject im lặng.
6. **Xoá**: luôn xác nhận có username trước khi gọi `DELETE`; xoá account không
   được đụng tới catalog tướng.
7. **Test + kiểm tra**: xem mục dưới và skill `aov-testing`.

## Bất biến cần giữ (đã sửa, có test hồi quy)

- Form so khớp tướng bằng `normalizeText` (tên import khác hoa/thường/dấu vẫn hiện là đã chọn);
  tướng ngoài danh mục hiện thành tag cảnh báo và gỡ được.
- Lỗi lưu/xoá được ném lại cho form/dialog để hiển thị tại chỗ; không bỏ rơi promise.
- Lỗi tải danh sách là trạng thái lỗi riêng (có Thử lại), không giả làm kho rỗng.
- Danh sách và command palette không bao giờ chứa mật khẩu; mật khẩu lấy qua
  `/api/accounts/:id/password` khi bấm (`PasswordSecret`), form sửa tải riêng và chỉ gửi
  lại khi người dùng sửa ô mật khẩu.
- Tìm kiếm trang tài khoản theo username, tên tài khoản và tên tướng.

## Ma trận kiểm tra bắt buộc

Thêm/cập nhật Vitest cho logic thuần trong `src/lib/accounts.ts`:

- tạo hợp lệ; username có khoảng trắng hai đầu; thiếu username;
- password rỗng (hợp lệ); trường string sai kiểu;
- hero trùng, hero rỗng, hero lạ, tên có dấu/apostrophe (`Điêu Thuyền`, `Kil’Groth`);
- `heroNamesNormalized` khớp thứ tự với `heroes`.

Với route: thêm test vào `test/api/account-routes.test.ts` (mock Prisma bằng `vi.mock`,
cookie phiên bằng `test/helpers/api.ts`) cho create, update, delete, username trùng (409),
ID không tồn tại (404), ID sai (400), 401/403/415 và không lộ mật khẩu. Chỉ
gọi API thật khi `DATABASE_URL` trỏ tới Neon branch dev đã được người dùng xác
nhận — không bao giờ dùng database production để test.

Cuối cùng: `npm run lint`, `npm test`, `npm run typecheck`, `npm run build`.

## Bảo mật

Không log, in hoặc đưa vào test username/password thật. Dùng dữ liệu kiểu
`fixture-user`. Khi thay đổi chạm tới việc trả/hiển thị password, chạy thêm
checklist trong skill `account-security`.
