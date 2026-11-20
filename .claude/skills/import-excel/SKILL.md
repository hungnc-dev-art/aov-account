---
name: import-excel
description: Quy trình sửa import/export Excel account — parser SheetJS trong src/utils/excel.ts (ma trận cột, ma trận hàng, bảng phẳng, chọn sheet tốt nhất, kiểm tra file), wizard nhập ImportWizard và ExportDialog (src/components/excel-dialogs.tsx), POST /api/accounts/import (merge / create-only / replace có xác nhận trong transaction) và POST /api/accounts/export. Dùng khi thêm định dạng Excel mới, sửa nhận diện header/marker, xử lý cảnh báo import, sửa chế độ gộp/thay thế dữ liệu hoặc file export.
---

# Import/Export Excel

Excel được parse **trong browser** (SheetJS `xlsx@0.20.3` cài từ CDN chính thức của
SheetJS — bản trên npm có lỗ hổng), kết quả `ImportResult` được gửi tới
`POST /api/accounts/import`. Quy tắc nền ở `AGENTS.md` mục 8.

## Bản đồ file

| Phần | File |
| --- | --- |
| Parser, kiểm tra file, export | `src/utils/excel.ts` |
| Test parser | `src/utils/excel.test.ts` (workbook tạo trong memory) |
| Wizard nhập 4 bước, dialog xuất | `src/components/excel-dialogs.tsx` |
| Gọi API | `src/lib/account-api.ts` (`importAccounts`, `exportAccounts`) |
| Logic server (prepare, merge, create-only, replace) | `src/lib/import-service.ts` |
| Route | `app/api/accounts/import/route.ts`, `app/api/accounts/export/route.ts` |
| Test server | `test/lib/import-service.test.ts`, `test/api/account-routes.test.ts` |
| Fixture giả | `scripts/create-import-fixture.mjs` → `test/fixtures/import-accounts.xlsx` |

`excel.ts` chỉ được nạp bằng `await import('../utils/excel')` để SheetJS không vào
bundle khởi động. Không import tĩnh file này từ component client.

## Thuật toán phía client (đọc kỹ trước khi sửa)

0. `validateExcelFile`: chỉ `.xlsx/.xls/.csv`, ≤ 5 MB, đúng chữ ký nhị phân (zip `PK`,
   OLE `D0 CF 11 E0`, csv không có byte 0). `parseExcelFile` tắt công thức/HTML/style,
   tối đa 20 sheet × 5000 dòng.
1. Mỗi sheet → `sheet_to_json({ header: 1, raw: false, defval: null, blankrows: false })`.
2. Nếu trong 15 dòng đầu có ô `ten tuong` **và** trong 12 dòng đầu có ô username
   → chỉ chạy `parseColumnMatrix`. Ngược lại chạy `parseFlatTable` và
   `parseRowMatrix`, lấy kết quả điểm cao hơn.
3. Điểm `accountScore = 5 × số account + 3 × số account có password + tổng số hero`.
   Sheet có điểm cao nhất được chọn.
4. Hậu xử lý trong `parseWorkbook`: bỏ username rỗng; loại trùng theo
   `usernameDedupeKey` (trim + lowercase — KHÔNG dùng `normalizeText` vì sẽ gộp
   `user.a`/`user-a`); bỏ tài khoản không có tướng; cảnh báo mật khẩu rỗng.
   Mọi lần bỏ/cảnh báo đều đẩy message vào `errors`.

Header luôn so khớp sau `normalizeText`:

- Username: `ten dang nhap`, `username`, `tai khoan`, `account`
- Password: `mat khau`, `password`, `mk`
- Danh sách hero (bảng phẳng): `tuong`, `danh sach tuong`, `heroes`, `hero`; ô
  được tách bằng `splitHeroes` (dấu phẩy, chấm phẩy, xuống dòng; loại trùng theo normalize)
- Ma trận cột: metadata theo hàng — `ten nick`/`nickname`, `vang`/`gold`,
  `level`/`cap`, `rank`/`hang`, `tinh trang`/`status`; hero dưới ô `ten tuong`.
- Marker sở hữu (sau normalize): `x`, `1`, `co`, `yes`, `true`.

## Server

`parseImportRequest`: `mode` ∈ `merge | create-only | replace` (cờ cũ `replace: true`
được hiểu là replace và vẫn phải xác nhận), ≤ 2000 dòng, body ≤ 4 MB (413).
`prepareRows`: `normalizeAccountInput` từng dòng; dòng lỗi và username trùng trong
file (trim + lowercase) bị bỏ và ghi cảnh báo. Trả `ImportSummary`
`{ mode, received, created, updated, skipped, invalid, deleted, warnings }`.

| Chế độ | Hành vi |
| --- | --- |
| `merge` (mặc định) | Khớp username trim+lowercase: 0 khớp → tạo; 1 khớp → cập nhật bản ghi đó, **giữ username đang lưu**; ≥ 2 khớp (biến thể hoa/thường có sẵn) → bỏ qua + cảnh báo. Không xoá gì. |
| `create-only` | Như merge nhưng KHÔNG cập nhật bản ghi đã có (dùng cho migrate IndexedDB cũ). |
| `replace` | Cần phiên xác thực lại ≤ 5 phút + `confirm.phrase` = "THAY THẾ" + `confirm.expectedCount`. Mọi dòng phải hợp lệ. Trong một transaction: `LOCK TABLE`, đếm, lệch → 409 `COUNT_MISMATCH`, rồi `deleteMany` + `createMany`. Lỗi → rollback. |

Wizard client: mount mới mỗi lần mở (không giữ kết quả/chế độ cũ), mặc định Gộp,
Thay thế phải gõ "THAY THẾ" và có tuỳ chọn tải bản sao lưu (kèm mật khẩu, qua
`/api/accounts/export`) trước khi gửi. Màn kết quả hiển thị tổng kết và cảnh báo máy chủ.

Export: `POST /api/accounts/export` mặc định không kèm mật khẩu; `includePasswords`
cần xác thực lại. File được tạo bằng `exportAccountsToExcel(rows, includePasswords, stem)`
ngay trong trình duyệt, không upload đi đâu.

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
   `npm run typecheck`, `npm run build`, và `scripts/qa/ui-qa.mjs` nếu đổi wizard.

## Lưu ý

- Merge ghi đè toàn bộ trường của tài khoản khớp bằng dữ liệu trong file (kể cả
  mật khẩu rỗng) — đây là nghiệp vụ hiện tại; muốn đổi phải hỏi người dùng.
- Không bao giờ chạy import thử với `replace` trên database thật. Preview và
  Production đang dùng chung database.

## Bảo mật

Fixture/test chỉ dùng dữ liệu giả (`fixture-user`, `codex-import-fixture-01`). Log
server chỉ ghi tên/mã lỗi (`logSafe`), không ghi username/password. Khi sửa replace,
export hoặc log, chạy thêm checklist của skill `account-security`.
