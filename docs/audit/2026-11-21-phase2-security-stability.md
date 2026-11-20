# Phase 2 — Security & Stability Audit

- Ngày: 2026-11-21 · Commit: `0807b1c` (branch `main`, code nghiệp vụ không đổi so với HEAD)
- Phạm vi: toàn bộ API account, import/export, auth, các lỗi logic/UX từ audit trước, tooling.
- Không sửa code nghiệp vụ, không ghi Neon, không deploy, không commit.
- Bằng chứng chi tiết (lệnh, output, script tái hiện): [2026-11-21-phase2-evidence.md](2026-11-21-phase2-evidence.md)

**Phương pháp:**

1. Chạy bản sao repo trong sandbox (`next dev`), không có `.env.local`. `DATABASE_URL` là placeholder `localhost`, nên không request nào chạm được Neon.
2. Gọi API bằng `curl`.
3. Điều khiển Edge headless qua Chrome DevTools Protocol, mock `/api/accounts*` bằng dữ liệu giả.
4. Viết unit test tạm trong sandbox (không nằm trong repo).
5. Tra cứu nguồn chính thức: GitHub Advisory, `npm view`, docs Vercel, docs Next.js 16 đi kèm `node_modules/next/dist/docs`.

**Ký hiệu mức xác minh:**

| Ký hiệu | Nghĩa |
| --- | --- |
| ✅ Tái hiện | Đã chạy và quan sát được hành vi |
| 🔎 Xác minh bằng code | Đọc code chắc chắn, nhưng không chạy được vì cần DB thật hoặc dữ liệu người dùng |
| ⚠️ Tiềm ẩn | Suy luận hợp lý, chưa tái hiện |
| ❔ Chưa đủ bằng chứng | Thiếu dữ liệu để kết luận |

---

## Tóm tắt điều hành

**Chưa sẵn sàng phát hành công khai.** Bất kỳ ai có URL đều có thể:

- đọc toàn bộ username/password;
- xoá từng account;
- xoá sạch kho bằng một request `POST /api/accounts/import` với `replace: true`.

Request này còn có thể gửi cross-site ở dạng `text/plain`, vì server parse body mà không kiểm tra `Content-Type` hay `Origin`.

**Có biện pháp chặn ngay, không cần code.** Bật **Vercel Authentication** với phạm vi **All Deployments**. Tính năng này miễn phí ở mọi gói, kể cả cho production (đã xác minh trên docs Vercel). Sau đó bổ sung lớp **owner session** trong app để phòng thủ chiều sâu.

**Ổn định.** Cả 7 lỗi UX/logic trong danh sách đều tái hiện được. Ba điểm khác với nhận định trước:

1. **Migrate IndexedDB thất bại nặng hơn đã nghĩ.** App không bao giờ gọi `GET /api/accounts` trên trình duyệt đó, nên kho luôn hiển thị "0 tài khoản", ở mọi lần tải trang.
2. **Audit trước đã nói quá về lộ lỗi Prisma.** Lỗi kết nối Neon là `ErrorEvent`, không phải `Error`, nên **không** bị lộ. Lỗi `JSON.parse` thì có bị lộ.
3. **Phát hiện mới về rủi ro dữ liệu.** Migrate IndexedDB dùng upsert, nên khi sửa cho nó chạy lại, dữ liệu cũ có thể ghi đè dữ liệu mới trên server.

**Tooling.** Shell không elevate **không ghi được git index**: `git add`/`git commit` sẽ lỗi. Đây cũng là cùng nguyên nhân gây EPERM khi build. Cần xử lý trước khi làm PR.

---

## 1. Security architecture đề xuất

### 1.1 Bề mặt tấn công hiện tại

| Endpoint | Dữ liệu / tác động | Auth | Bằng chứng |
| --- | --- | --- | --- |
| `GET /api/accounts[?hero=]` | Toàn bộ account, **gồm password plaintext** | Không | 🔎 [route.ts:9-19](../../app/api/accounts/route.ts#L9-L19) + [accounts.ts:67-87](../../src/lib/accounts.ts#L67-L87). Không gọi được với dữ liệu thật vì sandbox không có DB |
| `POST /api/accounts` | Tạo account | Không | ✅ curl #2, #4 (chấp nhận `text/plain`, Origin lạ) |
| `PUT /api/accounts/:id` | Ghi đè account | Không | ✅ curl #5. Cross-origin bị chặn bởi preflight (#11) |
| `DELETE /api/accounts/:id` | Xoá account, ID tuần tự | Không | ✅ curl #7 (tới bước DB) |
| `POST /api/accounts/import` | Upsert hàng loạt; `replace: true` → `deleteMany()` | Không, không xác nhận server | ✅ curl #8: `text/plain` + Origin lạ + `replace: true` qua hết kiểm tra, chỉ dừng vì DB giả không kết nối được |
| Trang `/` | Hiển thị/copy password, export Excel plaintext | Không | 🔎 |

**Mô hình đe doạ:** app cá nhân, một chủ sở hữu. Đối tượng cần chặn:

1. Người có hoặc đoán được URL production/preview (URL `*.vercel.app` dễ bị lộ qua lịch sử, chia sẻ, log).
2. Trang web độc hại mà chủ sở hữu mở khi đang có phiên đăng nhập (CSRF).
3. Thiết bị khác trong cùng LAN/VPN khi chạy `next dev`. Dev server bind mọi interface (✅ log in ra địa chỉ "Network").
4. File Excel độc hại (SheetJS).

### 1.2 So sánh phương án

| | A. Vercel Authentication + All Deployments | B. Vercel Password Protection | C. Auth.js v5 (OAuth + allowlist, JWT, không DB) | D. Better Auth / Neon Auth | E. Owner session tự làm (khuyến nghị lớp app) |
| --- | --- | --- | --- | --- | --- |
| Cách hoạt động | Vercel chặn ở edge; chỉ thành viên team Vercel đăng nhập mới vào được | Một mật khẩu chung ở edge | Đăng nhập GitHub/Google, so email với allowlist trong env | Thư viện auth đầy đủ (user, session, MFA) | Một mật khẩu chủ sở hữu, hash scrypt trong env; cookie ký HMAC; kiểm tra ở `proxy.ts` và từng handler |
| Bảo vệ cả API và GET | Có (mọi URL) | Có | Có, nếu gọi `auth()` ở mỗi handler | Có | Có |
| Thay đổi code | Không | Không | Trung bình | Trung bình–lớn | Nhỏ (khoảng 4–6 file) |
| Đổi schema DB | Không | Không | Không | **Có** (bảng user/session/account; Neon Auth dùng schema `neon_auth` do Neon quản lý) | Không |
| Chi phí | **0đ ở mọi gói** ✅ docs | **$20/tháng/project, cần Pro** ✅ docs | 0đ | 0đ (Neon Auth theo gói Neon, ❔ chưa xác minh giá) | 0đ |
| Brute force | Do Vercel/IdP xử lý (có 2FA/passkey) | Không rõ giới hạn ❔ | Do IdP xử lý (2FA) | Có rate limit tích hợp | Tự xử lý: WAF rate limit (Hobby được 1 rule ✅ docs) + so sánh constant-time + mật khẩu entropy cao |
| CSRF | Phụ thuộc thuộc tính cookie `_vercel_jwt` ❔ chưa xác minh | ❔ | Cookie Lax + phải tự kiểm tra Origin cho Route Handler | Có hỗ trợ | `SameSite=Strict` + kiểm tra Origin + bắt buộc `application/json` |
| Bảo trì | Rất thấp; phụ thuộc cấu hình dashboard | Thấp | **Rủi ro**: `next-auth@5.0.0-beta.32` vẫn là beta, cập nhật lần cuối 2026-07-20 ✅ npm | Gói hoạt động tích cực (`better-auth@1.7.27`, hỗ trợ Next 16/Prisma 7 ✅ npm); cần theo dõi bản vá | Code tự sở hữu; ít dependency; cần review kỹ |
| Điểm yếu | Không có lớp bảo vệ trong code: lỡ tắt protection là lộ ngay; không bảo vệ `next dev` | Tốn phí; mật khẩu chung | Phụ thuộc beta; OAuth app cần cấu hình | Quá mức cho một người dùng; đổi schema trái ràng buộc | Tự chịu trách nhiệm phần crypto/session |

### 1.3 Khuyến nghị: phòng thủ hai lớp

**Lớp 1 (P0, không code, làm ngay): A.** Bật Vercel Authentication, phạm vi *All Deployments* cho project. Chỉ tài khoản Vercel của bạn (có 2FA) vào được, kể cả domain production. Song song: kiểm tra Preview/Development dùng Neon branch riêng.

**Lớp 2 (P0-PR, cần duyệt thiết kế): E — owner session.** Lý do chọn:

- không đổi schema;
- không phụ thuộc thư viện beta;
- đúng quy mô một người dùng;
- vẫn bảo vệ được khi lớp 1 bị tắt nhầm hoặc khi chạy local.

Phương án C là lựa chọn thay thế nếu bạn muốn MFA qua GitHub/Google và chấp nhận dùng bản beta.

Thiết kế E (chưa triển khai):

- **Biến môi trường (chỉ tên):**
  - `OWNER_PASSWORD_HASH`: dạng `scrypt$N$r$p$salt$hash`, sinh bằng script cục bộ.
  - `SESSION_SECRET`: ≥ 32 byte ngẫu nhiên.
  - `OWNER_TOTP_SECRET`: tuỳ chọn, xem quyết định D4.
  - Đặt riêng cho từng môi trường Development/Preview/Production.
- **Module `src/lib/auth/` (server-only):**
  - `verifyPassword`: dùng `crypto.scrypt` + `timingSafeEqual`.
  - `createSession` / `readSession`: payload `{ v, iat, exp, sudoUntil? }`, base64url, ký HMAC-SHA256.
  - `requireOwner(request)`: trả 401 JSON nếu không hợp lệ.
  - `requireSudo(request)`: trả 403 nếu xác thực lại đã quá 5 phút.
- **Cookie:** `__Host-aov_session`, `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/`, thời hạn 12 giờ (D5). Đổi `SESSION_SECRET` sẽ thu hồi mọi phiên.
- **Route mới:**
  - `POST /api/auth/login` — giới hạn tốc độ (xem phần chống brute force);
  - `POST /api/auth/logout`;
  - `GET /api/auth/session`;
  - `POST /api/auth/reauth` (sudo).
- **Thực thi:**
  - `proxy.ts` chỉ làm *optimistic check*: chuyển `/` sang `/login` khi không có cookie. Matcher loại trừ `/_next`, `/heroes`, `/assets`, `/login`, `/api/auth/login`. Next 16 Proxy mặc định chạy runtime Node.js ✅ docs.
  - **Mỗi Route Handler phải gọi `requireOwner`**, vì docs Next 16 khuyến nghị kiểm tra bảo mật gần dữ liệu thay vì chỉ dựa vào Proxy ✅ docs.
- **Chống CSRF** cho mọi method ghi:
  - cookie `SameSite=Strict`;
  - `Origin` (hoặc `Sec-Fetch-Site`) phải cùng origin, sai thì trả 403;
  - `Content-Type` phải là `application/json`, sai thì trả 415. Điều này chặn "simple request" `text/plain`, loại request hiện đang được chấp nhận (✅ curl #4, #8).
- **Chống brute force:**
  - Vercel WAF rate limit rule cho `/api/auth/login`, ví dụ 5 request/10 phút theo IP, cửa sổ cố định; Hobby được 1 rule, cửa sổ 10 giây–10 phút ✅ docs;
  - trễ cố định khoảng 400 ms cho mỗi lần sai;
  - mật khẩu ngẫu nhiên ≥ 16 ký tự.
  - Không có lockout theo tài khoản, vì cần lưu trạng thái tức là đổi schema.
- **Giữ chức năng xem/copy password.** Sau khi đăng nhập, contract `GET /api/accounts` giữ nguyên (P0). Việc tách password sang endpoint lấy khi cần là đề xuất P2, không bắt buộc (D6).
- **Import replace** phải thoả cả ba điều kiện: có session, có `requireSudo`, và body chứa `confirm: { phrase: 'XOA TOAN BO', expectedCount }`. Server đếm số bản ghi **trong cùng transaction** và trả 409 nếu `expectedCount` lệch. Client tải bản export dự phòng trước khi gửi (D7).
- **Export Excel** yêu cầu sudo và hiển thị cảnh báo file chứa password plaintext.
- **Lỗi và log:**
  - thêm lớp `ValidationError`;
  - một hàm `toErrorResponse` dùng chung: lỗi validate trả message tiếng Việt, mọi lỗi khác trả message chung (không lộ message của `JSON.parse`/Prisma);
  - log chỉ ghi `rowIndex`, mã lỗi, số lượng — không ghi username.
- **Header bảo mật:**
  - `poweredByHeader: false`;
  - `X-Frame-Options: DENY` (hoặc CSP `frame-ancestors 'none'`);
  - `X-Content-Type-Options: nosniff`;
  - `Referrer-Policy: no-referrer`;
  - CSP đầy đủ để sang P2 (cần nonce với Next).
- **Môi trường dev:** `next dev -H 127.0.0.1` (D14). Không trỏ `.env.local` vào database production.

---

## 2. Lỗi đã xác minh

### 2.1 Bảo mật (đối chiếu baseline `.claude/skills/account-security/references/baseline-2026-11.md`)

| ID | Mức | Vấn đề | Trạng thái | Vị trí / bằng chứng |
| --- | --- | --- | --- | --- |
| S1 | Critical | Không có xác thực ở mọi route và trang | ✅ curl #1–#11 đều xử lý mà không cần credential | `app/api/accounts/**` |
| S2 | Critical | `GET` trả password plaintext | 🔎 (không có DB thật để gọi) | [route.ts:9-19](../../app/api/accounts/route.ts#L9-L19) |
| S3 | Critical | Import `replace` không có xác nhận phía server | ✅ curl #8 tới bước transaction | [import/route.ts:94-95](../../app/api/accounts/import/route.ts#L94-L95) |
| S16 | High (khi có cookie auth) | CSRF: route ghi chấp nhận `text/plain`, không kiểm tra Origin | ✅ curl #4, #8. PUT/DELETE cross-origin bị chặn bởi preflight (#11) | [route.ts:23](../../app/api/accounts/route.ts#L23), [import/route.ts:52](../../app/api/accounts/import/route.ts#L52) |
| S4 | High | `DELETE` không có auth, ID tuần tự | ✅ curl #7 | [[id]/route.ts:47-72](../../app/api/accounts/[id]/route.ts#L47-L72) |
| S6 | Medium (CVSS gốc High) | `xlsx@0.18.5`: CVE-2023-30533 (prototype pollution, < 0.19.3) và CVE-2024-22363 (ReDoS, < 0.20.2); npm không có bản vá | ✅ advisory · ⚠️ khả năng khai thác: cần chủ sở hữu tự mở file độc hại; tác động nằm trong tab trình duyệt (treo tab, ô nhiễm prototype trên trang đang hiển thị credential) | `package.json`, [excel.ts:249](../../src/utils/excel.ts#L249) |
| S7 | Medium → **điều chỉnh** | Trả `error.message` của mọi `Error` | ✅ `JSON.parse` lộ message (curl #10) · ✅ lỗi kết nối Neon **không** lộ vì là `ErrorEvent` (#2, #5) · ⚠️ lỗi Prisma dạng `Error` (validation, P2000…) có thể lộ | [route.ts:36-38](../../app/api/accounts/route.ts#L36-L38), [[id]/route.ts:41-43](../../app/api/accounts/[id]/route.ts#L41-L43) |
| S8 | Medium | Log server ghi username (2 lần mỗi dòng lỗi) | ✅ log dev server | [import/route.ts:75-83](../../app/api/accounts/import/route.ts#L75-L83), [105-110](../../app/api/accounts/import/route.ts#L105-L110) |
| S9 | Medium | Không giới hạn số dòng import; transaction tới 120 giây | 🔎 | [import/route.ts:6-7, 56](../../app/api/accounts/import/route.ts#L56) |
| S10 | Medium | Export ghi password plaintext, không cảnh báo | 🔎 | [excel.ts:253-270](../../src/utils/excel.ts#L253-L270) |
| S11 | Medium → **High** | Dialog import giữ `replace` **và** `result` cũ sau khi đóng | ✅ checkbox (CDP T5) · ⚠️ mở lại sau khi import thành công, chỉ một cú bấm là replace lại bằng dữ liệu cũ | [ImportDialog.tsx:13-19](../../src/components/ImportDialog.tsx#L13-L19) |
| S12 | Medium | `migrate dev` dùng `DATABASE_URL` từ `.env.local` | 🔎 · ❔ không biết URL trỏ tới môi trường nào (không đọc giá trị) | [prisma.config.ts:4](../../prisma.config.ts#L4) |
| S17 | Low | `next dev` bind mọi network interface | ✅ log in ra địa chỉ "Network" | `package.json` script `dev` |
| S13 | Low | Không có header bảo mật; có `X-Powered-By: Next.js` | ✅ `curl -I` | [next.config.ts](../../next.config.ts) |
| S15 | Low | `.vercel/` không có trong `.gitignore` | 🔎 (phiên trước) | `.gitignore` |
| — | — | Brute force | Chưa áp dụng: hiện không có cơ chế đăng nhập nào để tấn công | — |

### 2.2 Ổn định / UX

| ID | Mức | Lỗi | Trạng thái | Nguyên nhân · vị trí |
| --- | --- | --- | --- | --- |
| B1 | P0 | **Migrate IndexedDB thất bại → kho luôn hiển thị rỗng** | ✅ CDP T7 + bổ sung: chỉ có `POST /import`, **không có `GET /api/accounts`**; server (mock) có 1 account nhưng UI hiển thị "0 tài khoản"; lặp lại sau reload; không ghi key migrate | `migrateLegacyIndexedDb` ném lỗi nên `refreshAccounts` bị bỏ qua — [App.tsx:50-59](../../src/App.tsx#L50-L59), [legacy-indexed-db.ts:38-52](../../src/lib/legacy-indexed-db.ts#L38-L52). Một dòng lỗi (vd. không có tướng) làm hỏng cả lô. ❔ Chưa biết trình duyệt nào còn dữ liệu cũ |
| B2 | P0 (rủi ro dữ liệu) | Sửa B1 có thể khiến dữ liệu cũ ghi đè dữ liệu mới | ⚠️ suy ra từ code | Migrate gọi import với `replace: false` → upsert, **cập nhật** account trùng username bằng bản IndexedDB cũ — [import/route.ts:98-102](../../app/api/accounts/import/route.ts#L98-L102) |
| B3 | P0 | Lỗi tải danh sách hiển thị như kho rỗng | ✅ CDP T2: GET 500 với body rỗng → "0 tài khoản…", "Không tìm thấy tài khoản" | `GET` không có try/catch → 500 không có JSON; `readJson` ném `SyntaxError`; `catch {}` nuốt lỗi — [route.ts:9-19](../../app/api/accounts/route.ts#L9-L19), [account-api.ts:3-9](../../src/lib/account-api.ts#L3-L9), [App.tsx:55-57](../../src/App.tsx#L55-L57) |
| B4 | P0 | Lỗi API ở form không hiển thị | ✅ CDP T3: 409 → form vẫn mở, không có thông báo, unhandled rejection `Error: Tên đăng nhập đã tồn tại.` | [AccountForm.tsx:75-85](../../src/components/AccountForm.tsx#L75-L85) |
| B5 | P0 | Lỗi khi xoá không hiển thị | ✅ CDP T4: 404 → không có thông báo, unhandled rejection | [AccountManagementPage.tsx:53-57](../../src/components/AccountManagementPage.tsx#L53-L57) |
| B6 | P0 | Checkbox replace giữ trạng thái | ✅ CDP T5 (`checkedAfterReopen: true`) | Xem S11 |
| B7 | P1 | Theme không được lưu sau reload | ✅ CDP T1: dark → reload → `light`; localStorage bị ghi đè thành `light` | Effect ghi chạy cùng commit, **trước** `requestAnimationFrame` đọc giá trị — [App.tsx:23-42](../../src/App.tsx#L23-L42) |
| B8 | P1 | Server không loại trùng hero theo normalize | ✅ unit test: `['Lữ Bố','lu bo','LỮ BỐ']` → `heroNamesNormalized` có 3 lần `lu bo`; index đếm một account 2 lần (dòng trùng, key React trùng ở bảng chủ sở hữu); `'!!!'` → normalized `''`; khoảng trắng giữa tên không được gộp | [accounts.ts:40-63](../../src/lib/accounts.ts#L40-L63), [App.tsx:69-79](../../src/App.tsx#L69-L79) |
| B9 | P1 | Form so khớp tên tướng chính xác | ✅ ở mức logic (unit test): `'dieu thuyen'` không khớp `'Điêu Thuyền'` · ⚠️ trên UI chưa chạy CDP | [AccountForm.tsx:66-73, 167](../../src/components/AccountForm.tsx#L167) |
| B10 | P1 | Loại trùng username theo `normalizeText` quá rộng | ✅ unit test: 5 dòng `fixture.a`, `fixture-a`, `Fixture_A`, `tài.khoản`, `tai-khoan` → chỉ giữ 2 (có cảnh báo) · ⚠️ server phân biệt hoa/thường, nên qua nhiều lần import có thể tạo trùng `User1`/`user1` | [excel.ts:222-243](../../src/utils/excel.ts#L222-L243) |
| B11 | P2 | Client bỏ qua warnings server; không có thông báo import thành công | ✅ CDP T6: dialog đóng, không hiển thị warning hay kết quả. Tác động thấp vì preview phía client đã hiển thị "1 cảnh báo dữ liệu" | [account-api.ts:48-59](../../src/lib/account-api.ts#L48-L59), [ImportDialog.tsx:39-53](../../src/components/ImportDialog.tsx#L39-L53) |
| — | ❔ | Exception `Cannot read properties of undefined (reading 'setProperty')` ở lần chạy T2 | Không tái hiện ở lần chạy lại; không có `setProperty` trong code app → nhiều khả năng do dev overlay. Loại khỏi danh sách | — |

### 2.3 Tooling

| ID | Vấn đề | Trạng thái | Chi tiết |
| --- | --- | --- | --- |
| T1 | Nguyên nhân EPERM | ✅ | Xem chi tiết bên dưới bảng. |
| T2 | **Git không ghi được index** | ✅ `git update-index --really-refresh` → `fatal: Unable to write new index file`; `.git/index` không đổi từ 2026-07-05 | Cùng nguyên nhân với T1 (không có quyền thay thế file `index` cũ). `git add`, `commit`, `stash`, `checkout` sẽ lỗi trong shell không elevate. `git status` vẫn chạy được |
| T3 | Yarn khai báo nhưng thực tế dùng npm | ✅ | `packageManager: yarn@1.22.22`, nhưng có `package-lock.json` và không có `yarn.lock`. Máy có npm 11.19.0, Corepack 0.36.0, yarn 1.22.22. Vercel chọn npm theo lockfile; **nếu bật Corepack**, Vercel sẽ dùng `packageManager` (yarn 1) mà không có lockfile → resolve dependency không cố định ✅ docs. Nếu ai đó chạy `yarn` cục bộ sẽ sinh thêm `yarn.lock` |
| T4 | SheetJS | ✅ advisory | Xem S6. Cách vá: cài tarball từ CDN SheetJS 0.20.x (phiên bản cụ thể ❔ cần xác minh lúc triển khai) |
| T5 | Vitest lỗi khi ổ đĩa viết thường | ✅ (phiên trước) | Chạy từ `D:\` |

Chi tiết T1 (nguyên nhân EPERM):

- Không phải file bị khoá và không phải thuộc tính read-only (kiểm tra bằng `attrib`).
- User hiện tại không có ACE riêng trên thư mục repo.
- Nhóm `Administrators` chỉ là "deny only" trong token chưa elevate.
- Vì vậy quyền thực tế đến từ `BUILTIN\Users:(RX,W)`: được đọc, ghi, tạo file, nhưng **không có Delete/DeleteChild**.
- File/thư mục cũ thuộc SID `…-700770151-1002` (bản Windows cũ), nên không xoá/đổi tên được → `prisma generate` (rmdir) và `next build` (unlink) lỗi.
- File do user hiện tại tạo nhận `CREATOR OWNER:(F)` nên xoá được (đã thử tạo/xoá trong `docs/audit/`).

Trạng thái Git khi kết thúc audit: xem [evidence §6](2026-11-21-phase2-evidence.md#6-git-status).

### 2.4 Những điểm audit trước sai hoặc thiếu

- **S7 nói quá.** Lỗi kết nối Prisma/Neon **không** lộ ra client; thứ lộ ra là message của `JSON.parse`.
- **Thiếu S16 (CSRF bằng `text/plain`).** Đây mới là đường tấn công thực tế của `replace` khi đã có phiên đăng nhập.
- **B1 (migrate IndexedDB) bị đánh giá thấp.** Hậu quả không chỉ là "thử lại mỗi lần tải" mà là **chặn hoàn toàn việc tải dữ liệu**.
- **Thiếu B2** (ghi đè dữ liệu khi sửa B1) và **T2** (git không commit được).
- **S6 nên hạ xuống Medium** trong ngữ cảnh app cá nhân. **S11 nên nâng lên High**, vì `result` cũ cũng được giữ lại.

---

## 3. Kế hoạch triển khai theo PR nhỏ

Điều kiện tiên quyết (người dùng tự làm):

- **P0-0a:** bật Vercel Authentication + *All Deployments*. Xác nhận Preview/Development dùng Neon branch riêng.
- **P0-0b:** sửa quyền repo theo D12 để `git commit` và `npm run build` chạy được.

Mỗi PR: chạy lint/test/typecheck/build, không đổi schema, có ghi chú cách rollback.

| PR | Ưu tiên | Tiêu đề (Conventional Commit) | Phạm vi file chính | Kiểm thử |
| --- | --- | --- | --- | --- |
| 1 | P0 | `fix: không chặn tải dữ liệu khi migrate IndexedDB lỗi` | `src/App.tsx`, `src/lib/legacy-indexed-db.ts` | `refreshAccounts` luôn chạy (`finally`). Bỏ qua dòng lỗi và báo số dòng. **Chế độ create-only** (D9) để không ghi đè. CDP T7 |
| 2 | P0 | `fix: chuẩn hoá lỗi API và log an toàn` | `app/api/accounts/**`, `src/lib/api-errors.ts` (mới) | `GET` có try/catch → 500 JSON message chung. `ValidationError`. Không lộ `JSON.parse`. Log không có username. Unit test mapper + curl matrix |
| 3 | P0 | `fix: hiển thị lỗi tải, lưu và xoá account` | `src/App.tsx`, `AccountForm.tsx`, `AccountManagementPage.tsx`, `account-api.ts` | Trạng thái lỗi + nút thử lại; lỗi hiển thị trong form; lỗi khi xoá; `readJson` chịu được body không phải JSON. CDP T2–T4 |
| 4 | P0 | `fix: reset trạng thái và xác nhận rõ khi import thay thế` | `ImportDialog.tsx`, `AccountManagementPage.tsx` | Reset `result/replace/fileName` khi đóng/mở. Hộp xác nhận thứ hai (gõ cụm xác nhận, hiển thị số account sẽ bị xoá). Hiển thị kết quả + warnings server. CDP T5–T6 |
| 5 | P0 | `feat: xác thực chủ sở hữu bằng owner session` *(sau khi duyệt D2–D5)* | `src/lib/auth/*`, `app/api/auth/*`, `proxy.ts`, `app/login/page.tsx`, mọi route account, `.env.example` (tên biến) | Ma trận auth §4. Hướng dẫn tạo hash + rule WAF trong PR |
| 6 | P0 | `feat: xác nhận replace phía server` | `app/api/accounts/import/route.ts`, `account-api.ts`, `ImportDialog.tsx` | `confirm.phrase`, `expectedCount` trong transaction, `requireSudo` |
| 7 | P1 | `fix: lưu theme sau khi tải lại` | `src/App.tsx`, `app/layout.tsx` (script inline chống nháy) | CDP T1, kiểm tra không có hydration warning |
| 8 | P1 | `fix: chuẩn hoá danh sách tướng ở server và form` | `src/lib/accounts.ts`, `AccountForm.tsx`, `App.tsx` (index dùng Set) | Unit test B8/B9. Dữ liệu cũ không cần migrate |
| 9 | P1 | `fix: quy tắc loại trùng username khi import` *(theo D8)* | `src/utils/excel.ts` | Unit test B10 |
| 10 | P1 | `chore: nâng SheetJS lên bản đã vá và giới hạn kích thước file` *(theo D10)* | `package.json`, `package-lock.json`, `ImportDialog.tsx` | Toàn bộ `excel.test.ts` + fixture |
| 11 | P1 | `chore: header bảo mật, tắt X-Powered-By, dev bind localhost` | `next.config.ts`, `package.json` | `curl -I` |
| 12 | P1 | `chore: thống nhất package manager npm` *(theo D11)* | `package.json` | `npm ci` sạch |
| 13 | P2 | `feat: tách password khỏi danh sách, lấy khi xem/copy` *(D6)* | API + `AccountCard`, `HeroOwnerAccount`, export | Copy/xem vẫn chạy |
| 14 | P2 | `test: kiểm thử Route Handler` | `app/api/**` (tách logic), test mới | Không thêm dependency nếu không được duyệt |
| 15 | P2 | `feat: CSP có nonce` | `proxy.ts`, `next.config.ts` | Không lỗi console CSP |
| — | Ngoài phạm vi | Mã hoá password at-rest | Cần duyệt riêng (đổi cách lưu) | — |

---

## 4. Regression test matrix

Loại kiểm thử:

- **U**: Vitest unit.
- **R**: gọi Route Handler hoặc curl trên dev sandbox với DB giả/branch dev.
- **E**: CDP headless (script trong evidence).
- **M**: thủ công.

| # | Khu vực | Tình huống | Kỳ vọng | Loại | PR |
| --- | --- | --- | --- | --- | --- |
| 1 | Auth | Gọi 5 endpoint account không có cookie | 401 JSON, không có dữ liệu | R | 5 |
| 2 | Auth | Cookie bị sửa chữ ký / hết hạn / sai version | 401 | U, R | 5 |
| 3 | Auth | Đăng nhập sai mật khẩu | 401 sau khoảng trễ cố định; không lộ lý do | R | 5 |
| 4 | Auth | Vượt rate limit `/api/auth/login` | 429 từ WAF | M (Vercel) | 5 |
| 5 | Auth | Truy cập `/` khi chưa đăng nhập | Chuyển sang `/login`; asset `/heroes/*` vẫn tải được | E | 5 |
| 6 | Auth | Sau đăng nhập: xem/copy username/password ở card và bảng chủ sở hữu tướng | Hoạt động như cũ | E | 5, 13 |
| 7 | CSRF | POST/import với `Content-Type: text/plain` | 415 | R | 5 |
| 8 | CSRF | POST với `Origin` khác domain | 403 | R | 5 |
| 9 | Replace | `replace: true` không có `confirm` | 400, không xoá | R | 6 |
| 10 | Replace | `expectedCount` lệch số bản ghi | 409, rollback | R | 6 |
| 11 | Replace | Sudo quá 5 phút | 403 | R | 6 |
| 12 | Replace | Một dòng lỗi giữa lô | Rollback toàn bộ; dữ liệu cũ còn nguyên | R (branch dev) | 6 |
| 13 | Import | Đóng dialog rồi mở lại | Checkbox bỏ chọn, không còn preview cũ | E | 4 |
| 14 | Import | Import thành công có warnings | Hiển thị số đã import + warnings | E | 4 |
| 15 | Import | Merge không xoá account ngoài file | Số account ≥ trước | R (branch dev) | 4, 6 |
| 16 | Lỗi | `GET` lỗi DB | UI hiển thị lỗi + nút thử lại, không hiển thị "0 tài khoản" | E, R | 2, 3 |
| 17 | Lỗi | Tạo trùng username (409), xoá account không tồn tại (404) | Thông báo trong UI, không có unhandled rejection | E | 3 |
| 18 | Lỗi | Body không phải JSON / lỗi Prisma bất kỳ | 400/500 với message chung | R, U | 2 |
| 19 | Log | Import lỗi dòng | Log không chứa username/password | R | 2 |
| 20 | Migrate | IndexedDB cũ có dòng lỗi | Danh sách vẫn tải từ server; báo dòng lỗi | E | 1 |
| 21 | Migrate | IndexedDB cũ trùng username với server | **Không** ghi đè bản server | E, R | 1 |
| 22 | Theme | Chọn dark → reload | Vẫn dark, không nháy | E | 7 |
| 23 | Normalize | Hero trùng theo normalize, ký tự đặc biệt, khoảng trắng kép | Loại trùng, không có normalized rỗng | U | 8 |
| 24 | Normalize | Account có `dieu thuyen` mở trong form | Checkbox Điêu Thuyền được chọn | U, E | 8 |
| 25 | Username | Biến thể dấu câu/hoa thường | Theo quy tắc D8, có cảnh báo | U | 9 |
| 26 | SheetJS | Các định dạng Excel cũ + file > giới hạn | Parse như trước; file lớn bị từ chối có thông báo | U, E | 10 |
| 27 | Header | `curl -I /` | Không có `X-Powered-By`; có XFO/nosniff/Referrer-Policy | R | 11 |
| 28 | Chung | `npm run lint`, `npm test` (chạy từ `D:\`), `npm run typecheck`, `npm run build` | Đạt | — | mọi PR |

---

## 5. Rủi ro ảnh hưởng dữ liệu và rollback

| Thay đổi | Rủi ro dữ liệu | Biện pháp | Rollback |
| --- | --- | --- | --- |
| Bật Vercel Authentication | Không có | Kiểm tra truy cập bằng cửa sổ ẩn danh | Tắt trong dashboard |
| PR 1 (migrate IndexedDB) | **Cao nếu làm sai**: upsert ghi đè dữ liệu server mới hơn | Create-only, bỏ qua username đã tồn tại; nếu trùng thì hiển thị danh sách để người dùng tự quyết | Vercel Instant Rollback; key `localStorage` mới để không chạy lại |
| PR 2–4, 7 | Không ghi DB | — | Revert / Instant Rollback |
| PR 5 (auth) | Không đổi dữ liệu. Rủi ro tự khoá mình khi mất mật khẩu hoặc secret | Tạo hash bằng script cục bộ, lưu mật khẩu trong trình quản lý mật khẩu; thử trên Preview trước | Đổi env + redeploy, hoặc Instant Rollback |
| PR 6 (replace server) | Giảm rủi ro | Tự động export dự phòng trước khi replace (D7) | Revert |
| PR 8 | Chỉ ảnh hưởng lần ghi sau; dữ liệu cũ có thể còn bản trùng cho tới khi được lưu lại | Index dùng Set để hiển thị đúng ngay | Revert |
| PR 9 | Đổi quy tắc trùng có thể tạo thêm account khi import | Preview hiển thị khác biệt trước khi xác nhận | Revert; xoá các account dư theo danh sách |
| PR 10 | Parser mới có thể đọc file khác trước | Chạy regression trên fixture giả + một file thật **chỉ ở máy người dùng** | Revert lockfile |
| PR 13 | Không ghi DB | — | Revert |

Sao lưu dữ liệu:

- Trước mọi thao tác replace hoặc migration: export Excel thủ công và tạo Neon branch snapshot.
- Khả năng restore theo thời gian của Neon phụ thuộc gói đang dùng (❔ chưa xác minh trong phiên này).
- Không thử nghiệm trên production; chỉ dùng Neon branch dev.

---

## 6. Quyết định cần bạn duyệt

| # | Quyết định | Đề xuất |
| --- | --- | --- |
| D1 | Bật Vercel Authentication + All Deployments ngay | **Có** |
| D2 | Phương án auth trong app: E (owner session) / C (Auth.js beta + OAuth) / D (Better Auth/Neon Auth, đổi schema) | **E** |
| D3 | Chỉ một chủ sở hữu, hay cần nhiều người dùng/phân quyền | Một chủ sở hữu (nếu cần nhiều người → xem lại D2) |
| D4 | Thêm TOTP cho chủ sở hữu | Tuỳ chọn; khuyến nghị nếu không bật D1 |
| D5 | Thời hạn phiên 12 giờ; sudo 5 phút cho replace/export | Đồng ý hoặc điều chỉnh |
| D6 | Giữ password trong `GET` danh sách (sau auth) hay tách ra endpoint lấy khi cần | Giữ ở P0; tách ở P2 |
| D7 | Replace: cụm xác nhận + `expectedCount` + tự động export dự phòng | Có cả ba |
| D8 | Quy tắc trùng username: `normalizeText` (hiện tại) / `trim + lowercase` / chính xác | `trim + lowercase` |
| D9 | Migrate IndexedDB: create-only / upsert / gỡ hẳn tính năng | Create-only; gỡ sau khi xác nhận không còn trình duyệt nào có dữ liệu cũ |
| D10 | SheetJS: nâng lên 0.20.x qua CDN / thay thư viện / giữ nguyên + giới hạn file | Nâng qua CDN + giới hạn kích thước |
| D11 | `packageManager`: chuyển sang npm hay giữ yarn | npm |
| D12 | Cách sửa quyền repo (bạn tự chạy) | Mở terminal **Run as administrator**, xoá các thư mục tái tạo được (`.next`, `src/generated`); với `.git`, `takeown`/`icacls` **chỉ** trên thư mục repo. Tránh áp dụng cho cả ổ đĩa |
| D13 | Mức header bảo mật / CSP | Header cơ bản ở P1, CSP nonce ở P2 |
| D14 | Script `dev` bind `127.0.0.1` | Có |
| D15 | Ai chạy `db:deploy`; xác nhận `.env.local` không trỏ production | Bạn xác nhận |

## Giới hạn của audit

- Không gọi Neon. S2 và các nhánh `P2002`/`P2025` chỉ được xác minh bằng code.
- Không xem dashboard Vercel: không biết protection hiện đang bật hay tắt, không biết env Preview/Production trỏ tới branch nào.
- Chưa kiểm tra thuộc tính `SameSite` của cookie Vercel Authentication.
- Không viết PoC khai thác SheetJS.
- Không có test tự động cho Route Handler.
- Giá Neon Auth và thời gian giữ dữ liệu để restore của Neon chưa được xác minh.
