---
name: import-excel
description: Quy trình sửa import/export Excel account — parser SheetJS trong src/utils/excel.ts (ma trận cột, ma trận hàng, bảng phẳng, chọn sheet tốt nhất), ImportDialog, POST /api/accounts/import (upsert theo username, chế độ replace trong transaction) và exportAccountsToExcel. Dùng khi thêm định dạng Excel mới, sửa nhận diện header/marker, xử lý cảnh báo import, sửa chế độ gộp/thay thế dữ liệu hoặc file export.
---

# Import/Export Excel

Excel được parse **trong browser** (SheetJS `xlsx@0.18.5`), kết quả `ImportResult`
được gửi tới `POST /api/accounts/import`. Quy tắc nền ở `AGENTS.md` mục 8.

## Bản đồ file

| Phần | File |
| --- | --- |
| Parser + export | `src/utils/excel.ts` |
| Test parser | `src/utils/excel.test.ts` (workbook tạo trong memory) |
| UI chọn file, preview, replace | `src/components/ImportDialog.tsx` |
| Gửi import / export | `src/components/AccountManagementPage.tsx`, `src/lib/account-api.ts` |
| Server upsert/replace | `app/api/accounts/import/route.ts` |
| Fixture giả | `scripts/create-import-fixture.mjs` → `test/fixtures/import-accounts.xlsx` |

`excel.ts` chỉ được nạp bằng `await import('../utils/excel')` để SheetJS không vào
bundle khởi động. Không import tĩnh file này từ component client.

## Thuật toán hiện tại (đọc kỹ trước khi sửa)

1. Mỗi sheet → `sheet_to_json({ header: 1, raw: false, defval: null, blankrows: false })`.
2. Nếu trong 15 dòng đầu có ô `ten tuong` **và** trong 12 dòng đầu có ô username
   → chỉ chạy `parseColumnMatrix`. Ngược lại chạy `parseFlatTable` và
   `parseRowMatrix`, lấy kết quả điểm cao hơn.
3. Điểm `accountScore = 5 × số account + 3 × số account có password + tổng số hero`.
   Sheet có điểm cao nhất được chọn.
4. Hậu xử lý trong `parseWorkbook`: bỏ username rỗng; loại trùng theo
   `normalizeText(username)`; bỏ account không có hero; cảnh báo password rỗng.
   Mọi lần bỏ/cảnh báo đều đẩy message vào `errors`.

Header luôn so khớp sau `normalizeText`:

- Username: `ten dang nhap`, `username`, `tai khoan`, `account`
- Password: `mat khau`, `password`, `mk`
- Danh sách hero (bảng phẳng): `tuong`, `danh sach tuong`, `heroes`, `hero`; ô
  được tách bằng `splitHeroes` (dấu phẩy, chấm phẩy, xuống dòng; loại trùng theo normalize)
- Ma trận cột: metadata theo hàng — `ten nick`/`nickname`, `vang`/`gold`,
  `level`/`cap`, `rank`/`hang`, `tinh trang`/`status`; hero dưới ô `ten tuong`.
- Marker sở hữu (sau normalize): `x`, `1`, `co`, `yes`, `true`.

Server (`import/route.ts`): validate `accounts` là mảng không rỗng, `replace` là
boolean; chạy `normalizeAccountInput` từng dòng (lỗi → 400 kèm số dòng); trong một
`prisma.$transaction` (timeout 120s): nếu `replace` thì `deleteMany()` rồi upsert
tuần tự theo `username`. Trả `{ imported, warnings }`.

## Quy trình thêm định dạng mới

1. Thu thập cấu trúc mẫu bằng mô tả hoặc dữ liệu **giả** — không mở/commit file
   Excel cá nhân của người dùng.
2. Viết hàm `parseXxx(rows: Row[]): Account[]` dùng lại `findCell`, `normalizedCell`,
   `isOwnershipMarker`, `createAccount`. Không tự viết normalize cục bộ.
3. Thêm vào nhánh chọn parser trong `parseWorkbook` sao cho định dạng cũ vẫn thắng
   ở dữ liệu cũ (kiểm tra lại logic `hasColumnMatrix` và điểm số).
4. Thêm regression test trong `src/utils/excel.test.ts` bằng
   `XLSX.utils.aoa_to_sheet` cho: định dạng mới; ít nhất một định dạng cũ; workbook
   nhiều sheet (sheet nhiễu + sheet đúng); dòng thiếu username; username trùng;
   password rỗng (cảnh báo, vẫn import); hero lạ (giữ nguyên); marker `có`/`TRUE`.
5. Chạy `npm test` (xem lưu ý Windows trong skill `aov-testing`), `npm run lint`,
   `npm run typecheck`, `npm run build`.

## Chế độ gộp và thay thế

- Gộp (mặc định): upsert theo `username`, **không** xoá account không có trong file.
  Upsert ghi đè toàn bộ trường của account trùng username (kể cả password rỗng).
- Thay thế: xoá toàn bộ rồi nhập lại trong **cùng** transaction. Mọi thay đổi ở
  đây phải giữ nguyên tính nguyên tử và yêu cầu người dùng chọn rõ ràng.
- Không bao giờ chạy import thử với `replace: true` trên database thật.

## Bẫy đã biết

- `ImportDialog` chỉ `return null` khi đóng nên state (`result`, `replace`) vẫn giữ
  giữa các lần mở: checkbox "Xoá dữ liệu hiện tại" có thể còn được tick từ lần trước.
- Replace chỉ có một checkbox, không có bước xác nhận thứ hai.
- Client bỏ qua `warnings` server trả về (`importAccounts` chỉ đọc `imported`).
- Loại trùng username bằng `normalizeText` gộp cả các username chỉ khác dấu câu
  (`user.a` và `user-a` → `user a`): username thứ hai bị bỏ (có cảnh báo).
- Server không giới hạn số dòng/kích thước payload.
- Export (`exportAccountsToExcel`) ghi password dạng plaintext vào file `.xlsx`.
- `xlsx@0.18.5` trên npm có lỗ hổng đã công bố (prototype pollution, ReDoS) — bản
  vá chỉ phát hành qua CDN của SheetJS. Không tự đổi dependency; nêu trong báo cáo
  nếu thay đổi của bạn liên quan.

## Bảo mật

Fixture/test chỉ dùng dữ liệu giả (`fixture-user`, `codex-import-fixture-01`). Log
server không được chứa password; hạn chế log username. Khi sửa replace, export
hoặc log, chạy thêm checklist của skill `account-security`.
