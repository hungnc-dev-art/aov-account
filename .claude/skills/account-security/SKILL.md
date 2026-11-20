---
name: account-security
description: Checklist và quy trình review bảo mật/an toàn dữ liệu cho app quản lý account game — API /api/accounts (GET/POST/PUT/DELETE/import), xác thực và phân quyền, lưu/hiển thị/copy/export password, log credential, import replace, Prisma transaction/migration, Neon connection, môi trường Development/Preview/Production và biến môi trường Vercel. Dùng khi được yêu cầu kiểm tra/audit bảo mật API, trước khi deploy công khai, hoặc khi thay đổi chạm tới credential, API, import, export, log hay env. Bổ sung cho /security-review (chỉ xem diff).
---

# Account Security Review

App lưu **username/password game dạng plaintext có thể đọc lại** (nghiệp vụ cần
copy password) và **chưa có xác thực**. Mọi review phải xuất phát từ hai sự thật này.

## Nguyên tắc mặc định

- Review-only: ghi nhận, phân loại, đề xuất. Không tự đổi cách lưu password, không
  tự thêm/đổi thiết kế authentication khi người dùng chưa yêu cầu.
- Không chạy thao tác ghi/xoá trên database thật; không gọi `DELETE` hay import
  `replace` để "thử". Ưu tiên đọc code; nếu cần gọi API, chỉ trên môi trường dev
  đã được người dùng xác nhận.
- Không in giá trị `.env.local`, `DATABASE_URL`, token, credential hoặc dữ liệu
  account thật. Khi cần bằng chứng, dùng tên biến, số lượng bản ghi, mã lỗi.
- Đối chiếu với baseline trong [references/baseline-2026-11.md](references/baseline-2026-11.md)
  để báo rõ vấn đề nào mới, vấn đề nào đã được xử lý.

## Quy trình

1. **Phạm vi**: toàn repo, một PR/diff, hay một endpoint. Với diff, có thể chạy
   kèm `/security-review`, rồi dùng checklist dưới đây cho phần đặc thù nghiệp vụ.
2. **Lập bản đồ bề mặt tấn công**: liệt kê `app/api/**/route.ts`, method export,
   dữ liệu trả về, có/không kiểm tra danh tính. Tìm nhanh:
   - `export async function (GET|POST|PUT|PATCH|DELETE)` trong `app/`
   - `console\.(log|error|warn|info)` trong `app/` và `src/`
   - `password` trong `src/` và `app/` (nơi đọc/ghi/hiển thị/export)
   - `NEXT_PUBLIC_`, `process.env`, `deleteMany`, `\$transaction`, `\$queryRaw`, `\$executeRaw`
3. **Chạy checklist** bên dưới, ghi `file:line` cho mỗi phát hiện.
4. **Phân loại** theo bảng mức độ.
5. **Báo cáo** theo mẫu ở cuối.

## Checklist

**Xác thực & phân quyền**
- Route nào có thể gọi không cần đăng nhập? Có `proxy.ts` (Next 16 đổi tên từ
  `middleware.ts`), Vercel Deployment Protection, hay kiểm tra session trong handler?
- Có phân biệt quyền xem password, sửa, xoá, import replace không?

**Lộ credential**
- `GET /api/accounts` trả password cho mọi người gọi? Có thể chỉ trả password khi
  người dùng chủ động yêu cầu (endpoint riêng, có audit) không?
- UI: password che mặc định, chỉ hiện/copy khi bấm; không đưa vào `title`, URL,
  `localStorage`, analytics, log.
- Export Excel chứa password plaintext — có cảnh báo/xác nhận và quyền phù hợp?

**Log & lỗi**
- Không log password; hạn chế log username (là một nửa credential).
- Response lỗi không chứa `error.message` thô của Prisma/driver, stack trace, tên
  bảng, connection string.

**Thao tác phá huỷ**
- `DELETE` và import `replace` (`deleteMany()` trong transaction): có xác nhận ở
  server không, hay chỉ dựa vào UI? Có giới hạn kích thước payload, rate limit?
- Replace phải nguyên tử trong một transaction; lỗi giữa chừng phải rollback.
- Request ghi có chống CSRF (kiểm tra `Origin`/`Content-Type`, hoặc cookie `SameSite`
  khi đã có session)?

**Database & Prisma**
- Không dùng `$queryRawUnsafe`/`$executeRawUnsafe` với input người dùng.
- Validate input ở server (`normalizeAccountInput`), kể cả khi client đã validate.
- Migration có lệnh `DROP`/đổi kiểu gây mất dữ liệu? Có chạy trên đúng môi trường?

**Môi trường & Vercel**
- `DATABASE_URL` chỉ đọc ở server, không có `NEXT_PUBLIC_`, không nằm trong
  source/`.env.example`/Build Command/log.
- Development, Preview, Production dùng Neon branch tách biệt? Preview deployment
  có công khai dữ liệu production không?
- `.env.local` và `.vercel/` không bị commit (kiểm tra `.gitignore`, `git ls-files`).

**Client & dependency**
- Không import Prisma/Neon vào Client Component.
- Dependency có lỗ hổng đã biết (ví dụ `xlsx@0.18.5` parse file người dùng chọn).
- Header bảo mật (CSP, `X-Frame-Options`/`frame-ancestors`) cho trang hiển thị credential.

## Mức độ

| Mức | Khi nào |
| --- | --- |
| Critical | Người không xác thực đọc/xoá/thay toàn bộ credential, hoặc lộ secret DB |
| High | Lộ credential trong điều kiện hẹp hơn, mất dữ liệu do thiếu nguyên tử/xác nhận, lỗ hổng dependency khai thác được |
| Medium | Rò rỉ thông tin nội bộ qua lỗi/log, thiếu giới hạn tài nguyên, CSRF khi đã có auth |
| Low | Phòng thủ chiều sâu, cấu hình header, cải thiện UX an toàn |

## Hướng xử lý tham khảo (đề xuất, không tự triển khai)

1. Chặn truy cập ngay: bật Vercel Deployment Protection/Password Protection cho mọi
   môi trường có dữ liệu thật.
2. Thêm xác thực (Auth.js, Neon Auth, hoặc kiểm tra session trong `proxy.ts` + từng
   handler) và phân quyền cho thao tác phá huỷ.
3. Tách password khỏi `GET` danh sách; endpoint lấy password riêng có audit log.
4. Mã hoá password at-rest bằng mã hoá đối xứng (vd. AES-256-GCM, key trong env
   server) — không dùng hash vì nghiệp vụ cần đọc lại.
5. Replace yêu cầu xác nhận phía server (nhập lại cụm xác nhận/token), giới hạn số
   dòng import, rate limit các route ghi.
6. Chuẩn hoá lỗi: thông điệp chung cho lỗi không xác định; log nội bộ không chứa
   username/password.

## Mẫu báo cáo

```
## Tóm tắt
<1–3 câu: rủi ro lớn nhất, có thể deploy công khai hay không>

## Phát hiện
| # | Mức | Vấn đề | Vị trí | Kịch bản khai thác | Đề xuất |

## Đã kiểm tra, không phát hiện vấn đề
## Chưa kiểm tra được (và lý do)
```
