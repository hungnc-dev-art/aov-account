# Baseline bảo mật — audit 2026-11-21

Trạng thái tại commit `0807b1c` (branch `main`). Dùng để so sánh ở lần review sau:
đánh dấu mục nào đã xử lý, mục nào còn, mục nào mới. Số dòng có thể lệch khi code đổi.

| ID | Mức | Vấn đề | Vị trí |
| --- | --- | --- | --- |
| S1 | Critical | Không có xác thực/phân quyền cho mọi route; không có `proxy.ts` | `app/api/accounts/**` |
| S2 | Critical | `GET /api/accounts` trả toàn bộ username + password plaintext cho bất kỳ ai gọi | `app/api/accounts/route.ts:9-19` |
| S3 | Critical | `POST /api/accounts/import` với `replace: true` xoá toàn bộ bảng, không xác nhận phía server, không auth | `app/api/accounts/import/route.ts:94-95` |
| S4 | High | `DELETE /api/accounts/:id` không auth; ID tuần tự dễ liệt kê | `app/api/accounts/[id]/route.ts:47-72` |
| S5 | High | Password lưu plaintext trong Postgres (cần đọc lại nên phải dùng mã hoá đối xứng, không hash) | `prisma/schema.prisma` (`password`) |
| S6 | Medium (CVSS gốc High) | `xlsx@0.18.5` (npm, bản mới nhất) dính CVE-2023-30533 (prototype pollution, < 0.19.3) và CVE-2024-22363 (ReDoS, < 0.20.2); bản vá chỉ có trên CDN SheetJS. Khai thác cần chủ sở hữu tự mở file độc hại, tác động nằm trong tab trình duyệt | `package.json`, `src/utils/excel.ts:249` |
| S7 | Medium | `POST`/`PUT` trả `error.message` của mọi `Error`. Đã kiểm chứng: lỗi `JSON.parse` bị lộ; lỗi kết nối Neon **không** lộ (adapter ném `ErrorEvent`, không phải `Error`); lỗi Prisma dạng `Error` (validation, P2000…) thì tiềm ẩn | `app/api/accounts/route.ts:36-38`, `app/api/accounts/[id]/route.ts:41-43` |
| S8 | Medium | Log server ghi username khi import lỗi (không ghi password) | `app/api/accounts/import/route.ts:75-78, 105-110` |
| S9 | Medium | Không giới hạn kích thước/số dòng import; transaction tới 120s; không rate limit | `app/api/accounts/import/route.ts:56, 6-7` |
| S10 | Medium | Export Excel ghi password plaintext, không cảnh báo | `src/utils/excel.ts:253-270` |
| S11 | High | Dialog import giữ cả `replace` **và** `result` cũ sau khi đóng (component chỉ `return null`), nên mở lại thì chỉ một cú bấm là replace bằng dữ liệu cũ; không có xác nhận thứ hai | `src/components/ImportDialog.tsx:13-19,117-124` |
| S12 | Medium | `.env.local` có dấu hiệu kéo từ Vercel; `prisma migrate dev` dùng chính URL này — nguy cơ migrate/reset nhầm DB dùng chung | `prisma.config.ts:4` |
| S13 | Low | Không có security header/CSP cho trang hiển thị credential | `next.config.ts` |
| S14 | Low | Không kiểm tra `Origin`/CSRF cho route ghi (sẽ quan trọng khi có session cookie) | `app/api/accounts/**` |
| S15 | Low | `.vercel/` chỉ được ignore qua `.git/info/exclude` (cục bộ), không có trong `.gitignore` → clone khác có thể commit nhầm | `.gitignore` |
| S16 | High (khi đã có cookie auth) | Route ghi chấp nhận body `Content-Type: text/plain` và không kiểm tra `Origin` → CSRF "simple request" tới `POST /api/accounts` và `/import` (kể cả `replace: true`). PUT/DELETE cross-origin bị chặn bởi preflight | `app/api/accounts/route.ts:23`, `app/api/accounts/import/route.ts:52` |
| S17 | Low | `next dev` bind mọi network interface; nếu `.env.local` trỏ DB thật, máy khác cùng LAN/VPN gọi được API | `package.json` (`dev`) |

Kiểm chứng ngày 2026-11-21 (sandbox, DB giả): xem `docs/audit/2026-11-21-phase2-security-stability.md`
và `docs/audit/2026-11-21-phase2-evidence.md`.

## Trạng thái sau release Graphite Command (branch `feat/graphite-command-secure-release`)

| ID | Trạng thái | Cách xử lý / kiểm chứng |
| --- | --- | --- |
| S1 | Đã xử lý | Owner session + `requireOwner` ở mọi handler + `proxy.ts`; test 401 cho 7 route |
| S2 | Đã xử lý | Danh sách chỉ trả `hasPassword`; mật khẩu lấy từng cái qua `/api/accounts/:id/password` |
| S3 | Đã xử lý | Replace cần xác thực lại + "THAY THẾ" + `expectedCount`, khoá bảng, rollback; test |
| S4 | Đã xử lý | DELETE cần phiên + cùng origin |
| S5 | **Còn** (chấp nhận) | Mã hoá at-rest cần đổi cách lưu → quyết định riêng của chủ sở hữu |
| S6 | Đã xử lý | `xlsx@0.20.3` từ CDN SheetJS (integrity đã đối chiếu) + kiểm tra file/giới hạn kích thước |
| S7 | Đã xử lý | `errorResponse` trả message chung; test JSON hỏng/lỗi DB |
| S8 | Đã xử lý | `logSafe` chỉ ghi tên/mã lỗi; test không có username trong log |
| S9 | Đã xử lý | ≤ 2000 dòng, body ≤ 4 MB, transaction 60s; rate limit đăng nhập (WAF + instance) |
| S10 | Đã xử lý | Export mặc định không kèm mật khẩu; kèm mật khẩu cần xác thực lại + cảnh báo |
| S11 | Đã xử lý | Wizard mount mới mỗi lần mở; QA end-to-end kiểm |
| S12 | **Còn** (vận hành) | Preview và Production dùng chung `DATABASE_URL`; `.env.local` chưa xác minh trỏ đâu |
| S13 | Đã xử lý | CSP nonce + header bảo mật; `X-Powered-By` tắt |
| S14/S16 | Đã xử lý | Route ghi bắt buộc cùng origin + `application/json` (403/415); cookie SameSite=Strict |
| S15 | Đã xử lý | `.vercel` trong `.gitignore` |
| S17 | Đã xử lý | `npm run dev` bind 127.0.0.1 |

Đã kiểm tra, không phát hiện vấn đề:

- Không có `NEXT_PUBLIC_*` chứa secret; `DATABASE_URL` chỉ đọc ở server (`src/lib/prisma.ts`, `prisma.config.ts`).
- `.env.local` và `src/generated/prisma` nằm trong `.gitignore`; `.env.local`, `.vercel/` không được track.
- `.env.example` chỉ chứa placeholder.
- Không dùng raw SQL (`$queryRaw*`/`$executeRaw*`).
- Không import Prisma/Neon vào client; chỉ `src/App.tsx` có `'use client'`.
- Replace và upsert import nằm trong cùng một `$transaction`.
- Log import chỉ ghi `hasPassword`, không ghi password.
