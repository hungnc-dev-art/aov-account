---
name: aov-testing
description: Cách chạy và viết kiểm thử cho repo kho account Liên Quân — npm run lint, npm test (Vitest 4), npm run typecheck, npm run build; test case bắt buộc theo từng loại thay đổi (normalize, parser Excel, CRUD/API, import, schema, dữ liệu tướng, UI); xử lý lỗi môi trường Windows (Vitest "reading 'config'", EPERM khi build, git dubious ownership). Dùng khi viết/sửa test, xác minh trước khi bàn giao hoặc commit, hoặc khi lệnh test/build lỗi bất thường.
---

# Kiểm thử và xác minh

## Lệnh chuẩn

```bash
npm run lint        # eslint . (flat config, eslint.config.js)
npm test            # vitest run — chưa có vitest.config, môi trường node
npm run typecheck   # tsc --noEmit (strict, noUnusedLocals/Parameters)
npm run build       # prisma generate && next build (Turbopack)
npm run heroes:check  # khi đổi dữ liệu tướng
```

Trước khi bàn giao/commit phải chạy đủ bốn lệnh đầu. Nếu lệnh nào không chạy được,
ghi rõ lệnh, nguyên nhân và phần chưa được xác minh — không báo "đạt" khi chưa chạy.

## Lỗi môi trường Windows đã gặp (máy phát triển hiện tại)

1. **Vitest báo `TypeError: Cannot read properties of undefined (reading 'config')`
   ở dòng `describe(` cho mọi file test, `Tests no tests`.** Nguyên nhân: thư mục
   làm việc dùng ổ đĩa chữ thường (`d:\...`, dòng `RUN` in `d:/Projects/aov_acc`)
   làm Vitest nạp hai instance. Chạy lại từ đường dẫn chữ hoa:
   PowerShell `Set-Location 'D:\Projects\aov_acc'; npm test`. Đây không phải lỗi code.
2. **`npm run build`/`git add` lỗi `EPERM` hoặc `Unable to write new index file`.** Thư mục repo
   gốc thuộc SID của một bản Windows cũ; user hiện tại không có quyền xoá file cũ. Cách đã dùng:
   làm việc trên một bản clone mới trong thư mục do user hiện tại tạo (đủ quyền), giữ nguyên
   thư mục cũ. Không chạy `takeown`/`icacls` diện rộng.
3. **`git` báo `detected dubious ownership`.** Dùng
   `git -c safe.directory=D:/Projects/aov_acc <lệnh>` cho từng lệnh; việc thêm
   `safe.directory` vào global config là quyết định của người dùng.

## Cấu trúc test hiện có

| File | Phạm vi |
| --- | --- |
| `src/utils/normalize.test.ts` | `normalizeText`, `splitHeroes`, `fuzzyMatch` |
| `src/utils/excel.test.ts` | `parseWorkbook`, loại trùng username, `validateExcelFile` |
| `src/lib/accounts.test.ts` | `normalizeAccountInput`, `dedupeHeroNames`, `usernameKey`, `parseAccountId` |
| `test/auth/session-password.test.ts` | hash scrypt, token phiên (giả mạo, hết hạn), script `auth-setup.mjs` |
| `test/api/auth-routes.test.ts` | login/logout/session/reauth, CSRF, rate limit, chưa cấu hình |
| `test/api/account-routes.test.ts` | mọi route account với Prisma mock: 401/403/415, không lộ mật khẩu/log, replace |
| `test/lib/import-service.test.ts` | merge / create-only / replace, dòng lỗi, trùng hoa/thường |
| `test/lib/client-logic.test.ts` | script boot theme (vm), route hash + link cũ, migrate IndexedDB |

Route Handler được test trực tiếp bằng `new Request(...)` (helper `test/helpers/api.ts`
dựng cookie phiên hợp lệ/hết hạn/giả) và `vi.mock('../../src/lib/prisma')`. UI được kiểm
bằng `scripts/qa/ui-qa.mjs` (xem dưới) thay vì jsdom.

Quy ước: file `*.test.ts` đặt cạnh source, `describe`/`it` mô tả bằng tiếng Anh như
code hiện tại, import từ `vitest`, style hai khoảng trắng, nháy đơn, không chấm phẩy.
Chỉ dùng dữ liệu giả (`fixture-user`, `account01`, `secret`); không đọc file Excel
cá nhân, không dùng credential thật.

## Test bắt buộc theo loại thay đổi

| Thay đổi | Cần thêm/kiểm tra |
| --- | --- |
| `normalize.ts` | Có dấu, `đ/Đ`, apostrophe thẳng/cong (`Kil’Groth`), khoảng trắng thừa, ký tự đặc biệt; đồng bộ bản sao trong `scripts/update-hero-data.mjs` |
| Parser Excel | Định dạng mới + định dạng cũ, nhiều sheet, username trùng, thiếu username, password rỗng, hero lạ, các marker sở hữu |
| CRUD/API | Create, update, delete, username trùng (409), ID không tồn tại (404), ID sai (400), password rỗng, hero lạ, hero trùng |
| Import | Merge không xoá dữ liệu cũ, replace nguyên tử, cảnh báo hiển thị cho người dùng |
| Schema | Migration SQL đã soát; chạy trên Neon branch dev (xem skill `neon-prisma`) |
| Dữ liệu tướng | `npm run heroes:check`, xem `src/data/hero-data-report.json` |
| UI/style | Mobile (~375px) và desktop, light/dark, loading/rỗng/dài/lỗi API, `#accounts` ↔ catalog, modal và bàn phím |

## QA trình duyệt (UI + auth thật, dữ liệu giả)

```bash
# Env QA riêng (không phải secret production), lưu ngoài repo:
#   mật khẩu QA ngẫu nhiên → node scripts/auth-setup.mjs hash < pw.txt → AUTH_OWNER_PASSWORD_HASH
#   node scripts/auth-setup.mjs secret → AUTH_SESSION_SECRET
#   DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder
npm run build && npx next start -H 127.0.0.1 -p 3400
node scripts/qa/ui-qa.mjs http://127.0.0.1:3400 <thư-mục-ngoài-repo> <file-mật-khẩu-QA>
```

Đăng nhập chạy thật; `/api/accounts*` được mock qua CDP nên không chạm database. Kết quả
gồm ảnh 3 kích thước × 2 theme, số đo a11y và 31 kiểm thử (phải đạt 31/31). Nếu port bị chiếm
bởi server QA cũ, tắt đúng process đang nghe port đó trước khi chạy lại (server cũ phục vụ build cũ).

- Không bao giờ dùng database production để test. Preview và Production đang dùng chung
  `DATABASE_URL`, nên cũng không chạy thao tác ghi thử nghiệm trên Preview.
- CI (`.github/workflows/ci.yml`) chạy lint, typecheck, test, heroes:check, build với `DATABASE_URL` giả.

## Báo cáo kết quả

Liệt kê từng lệnh và kết quả (đạt/lỗi kèm dòng lỗi chính), số test đã chạy, phần
nào kiểm tra thủ công, phần nào chưa xác minh được và lý do.
