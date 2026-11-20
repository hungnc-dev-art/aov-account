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
2. **`npm run build` lỗi `EPERM: operation not permitted, rmdir ...src\generated\prisma\models`
   hoặc `unlink ...\.next\...`.** Thư mục repo thuộc SID của một bản Windows cũ.
   Cách sửa lâu dài thuộc về người dùng (vd. `takeown /f D:\Projects\aov_acc /r /d y`
   rồi `icacls` cấp quyền) — không tự đổi ACL. Cách xác minh tạm: copy repo (trừ
   `.git`, `.next`, `node_modules`, `src/generated`, `.env.local`) vào scratchpad,
   copy thật `node_modules` (Turbopack từ chối junction/symlink trỏ ra ngoài
   project), đặt `DATABASE_URL` placeholder (`postgresql://placeholder:placeholder@localhost:5432/placeholder`)
   rồi `npm run build`. Build không truy vấn DB nên URL giả là đủ.
3. **`git` báo `detected dubious ownership`.** Dùng
   `git -c safe.directory=D:/Projects/aov_acc <lệnh>` cho từng lệnh; việc thêm
   `safe.directory` vào global config là quyết định của người dùng.

## Cấu trúc test hiện có

| File | Phạm vi |
| --- | --- |
| `src/utils/normalize.test.ts` | `normalizeText`, `splitHeroes`, `fuzzyMatch` |
| `src/utils/excel.test.ts` | `parseWorkbook` với workbook tạo bằng `XLSX.utils.aoa_to_sheet` |
| `src/lib/accounts.test.ts` | `normalizeAccountInput` |

Chưa có test cho Route Handler, component hay DOM (không có Testing Library/jsdom).
Không tự thêm dependency test mới khi người dùng chưa đồng ý; ưu tiên tách logic
thuần vào `src/lib/` hoặc `src/utils/` để test bằng Vitest node.

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

## Kiểm tra API và UI thủ công

- Không bao giờ dùng database production để test. Chạy `npm run dev` gọi API thật
  chỉ khi người dùng xác nhận `.env.local` trỏ tới Neon branch dev.
- Không thử import `replace` hay `DELETE` trên dữ liệu thật.
- Theme: toggle ở topbar ghi `localStorage['aov-theme']` và
  `document.documentElement.dataset.theme`. Lưu ý lỗi đã biết: effect ghi theme
  mặc định `light` chạy trước khi đọc giá trị đã lưu (`src/App.tsx:23-42`), nên sau
  reload theme luôn về light — đừng nhầm là do thay đổi của bạn.
- Để soát UI/a11y có hệ thống, dùng skill `web-design-guidelines`.

## Báo cáo kết quả

Liệt kê từng lệnh và kết quả (đạt/lỗi kèm dòng lỗi chính), số test đã chạy, phần
nào kiểm tra thủ công, phần nào chưa xác minh được và lý do.
