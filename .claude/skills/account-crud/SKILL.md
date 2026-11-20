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
| Type dùng chung | `src/types.ts` | `Account.id` là optional; ngày là ISO string |
| Validate/normalize server | `src/lib/accounts.ts` | `normalizeAccountInput`, `serializeAccount` |
| Route list/create | `app/api/accounts/route.ts` | `runtime = 'nodejs'`, `dynamic = 'force-dynamic'` |
| Route update/delete | `app/api/accounts/[id]/route.ts` | `params` là `Promise` (Next 16), `parseId` |
| Gọi API từ client | `src/lib/account-api.ts` | `readJson` ném `Error(payload.error)` khi `!ok` |
| State + index | `src/App.tsx` | `refreshAccounts`, `accountByHero` (`useMemo`) |
| UI quản lý | `src/components/AccountManagementPage.tsx`, `AccountForm.tsx`, `AccountCard.tsx` | |
| UI chủ sở hữu tướng | `src/components/HeroDetails.tsx`, `HeroOwnerAccount.tsx` | hiện/copy credential |
| Test | `src/lib/accounts.test.ts` | Vitest, dữ liệu giả |

Route Handler import bằng đường dẫn tương đối (`../../../src/...`); repo không có
path alias. Prisma Client import từ `src/generated/prisma/client`.

## Contract hiện tại (đối chiếu trước khi sửa)

| Method | Thành công | Lỗi |
| --- | --- | --- |
| `GET /api/accounts[?hero=]` | 200 `{ accounts }`, sắp xếp `updatedAt desc` | không có try/catch → 500 mặc định |
| `POST /api/accounts` | 201 `{ account }` | 409 username trùng (`P2002`), 400 lỗi khác |
| `PUT /api/accounts/:id` | 200 `{ account }` | 400 ID sai, 404 (`P2025`), 409, 400 |
| `DELETE /api/accounts/:id` | 200 `{ success: true }` | 400 ID sai, 404, 400 |

`normalizeAccountInput` hiện tại:

- `username`: bắt buộc, `trim()`. Unique trong DB theo giá trị chính xác (phân biệt
  hoa/thường), trong khi import loại trùng theo `normalizeText` — đừng giả định hai
  cách này giống nhau.
- `heroes`: bắt buộc là mảng string, mỗi phần tử `trim()`, loại trùng **theo chuỗi
  chính xác** (`Set`), bỏ rỗng, cần ≥ 1 phần tử. Chưa loại trùng theo tên đã
  normalize (khác `splitHeroes`).
- `heroNamesNormalized = heroes.map(normalizeText)` — luôn sinh lại ở server, không
  tin giá trị client gửi.
- `password`, `gold`, `level`, `rank`, `status`, `note`: string tuỳ chọn, không trim;
  `nickname` được trim. Kiểu sai → `Error` tiếng Việt.

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

## Bẫy đã biết trong code hiện tại

- `AccountForm` đánh dấu checkbox bằng `draft.heroes.includes(hero.name)` (so khớp
  chính xác). Account import với tên khác hoa/thường/dấu (vd. `dieu thuyen`) sẽ
  không hiện là đã chọn, và người dùng có thể chọn thêm `Điêu Thuyền` → trùng
  normalize. Hero lạ được giữ trong draft nhưng không thể bỏ chọn trên UI.
- `AccountForm.submit` và `deleteAccount` trong `AccountManagementPage` không bắt
  lỗi API → lỗi 409/404/500 không hiện cho người dùng.
- `App.tsx` nuốt lỗi tải danh sách (`catch { setAccountsLoading(false) }`) → UI hiển
  thị như kho rỗng.
- Tìm kiếm ở trang quản lý chỉ theo `username`/`nickname`, chưa theo tên tướng.
- `AccountCard` nhận prop `matchedHeroes` nhưng nơi gọi luôn truyền `[]`.

Chỉ sửa các bẫy này khi người dùng yêu cầu; nếu thay đổi của bạn chạm vào đúng chỗ,
nêu rõ trong báo cáo.

## Ma trận kiểm tra bắt buộc

Thêm/cập nhật Vitest cho logic thuần trong `src/lib/accounts.ts`:

- tạo hợp lệ; username có khoảng trắng hai đầu; thiếu username;
- password rỗng (hợp lệ); trường string sai kiểu;
- hero trùng, hero rỗng, hero lạ, tên có dấu/apostrophe (`Điêu Thuyền`, `Kil’Groth`);
- `heroNamesNormalized` khớp thứ tự với `heroes`.

Với route (chưa có test tự động): kiểm tra bằng đọc code các nhánh create, update,
delete, username trùng (409), ID không tồn tại (404), ID không hợp lệ (400). Chỉ
gọi API thật khi `DATABASE_URL` trỏ tới Neon branch dev đã được người dùng xác
nhận — không bao giờ dùng database production để test.

Cuối cùng: `npm run lint`, `npm test`, `npm run typecheck`, `npm run build`.

## Bảo mật

Không log, in hoặc đưa vào test username/password thật. Dùng dữ liệu kiểu
`fixture-user`. Khi thay đổi chạm tới việc trả/hiển thị password, chạy thêm
checklist trong skill `account-security`.
