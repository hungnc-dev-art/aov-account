# Bằng chứng — Phase 2 Security & Stability (2026-11-21)

Toàn bộ dữ liệu trong file này là dữ liệu giả: `fixture-*`, `legacy-fixture-*`.
Không có giá trị bí mật, credential thật hay connection string.

## 1. Môi trường kiểm chứng

- Sandbox: bản sao repo trong thư mục tạm của phiên. Không có `.env.local`, `node_modules` được copy thật.
- `DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder`. Không có request nào tới được Neon.
- `npx prisma generate` → `next dev -p 3201` (Next.js 16.2.9, Turbopack).
- Trình duyệt: Microsoft Edge headless, profile riêng trong sandbox, điều khiển qua CDP (port 9401).
- Đã dừng toàn bộ tiến trình sandbox sau khi kiểm chứng (16 tiến trình node/msedge, port 3201 đã đóng).

## 2. API — curl

| # | Request | Kết quả |
| --- | --- | --- |
| 1 | `GET /api/accounts` | `HTTP 500`, body rỗng, không có content-type. Log: `⨯ ErrorEvent { type: 'error' …` |
| 2 | `POST /api/accounts` JSON hợp lệ | `400 {"error":"Không thể tạo tài khoản."}` — không lộ message vì lỗi là `ErrorEvent`, không phải `Error` |
| 3 | `POST` thiếu username | `400 {"error":"Tên đăng nhập là bắt buộc."}` |
| 4 | `POST` `Content-Type: text/plain`, `Origin: https://evil.example` | `400 {"error":"Tên đăng nhập là bắt buộc."}` → **body `text/plain` vẫn được parse**, Origin không bị kiểm tra |
| 5 | `PUT /api/accounts/1` hợp lệ | `400 {"error":"Không thể cập nhật tài khoản."}` |
| 6 | `PUT /api/accounts/abc` | `400 {"error":"ID không hợp lệ."}` |
| 7 | `DELETE /api/accounts/1` | `400 {"error":"Không thể xoá tài khoản."}` (đã tới bước DB) |
| 8 | `POST /api/accounts/import` `text/plain` + Origin lạ + `{"replace":true, accounts:[1 dòng hợp lệ]}` | `400 {"error":"Không thể import account."}`. Log: `[accounts/import] Import thất bại { error: { message: '[object ErrorEvent]' } }` → **qua hết kiểm tra, tới bước transaction/`deleteMany`**; chỉ dừng vì DB giả |
| 9 | Import dòng không có tướng | `400 {"error":"Dòng 1 (fixture-user-02): Chọn ít nhất một tướng."}`. Log ghi `username: 'fixture-user-02'` và lặp lại trong message `ImportRowError` |
| 10 | `POST` body `not-json` | `400 {"error":"Unexpected token 'o', \"not-json\" is not valid JSON"}` → **lộ message nội bộ** |
| 11 | `OPTIONS /api/accounts/1` với Origin lạ, method DELETE | `204`, `allow: DELETE, OPTIONS, PUT`, **không có** `Access-Control-Allow-Origin` → trình duyệt chặn PUT/DELETE cross-origin |
| — | `curl -I /` | Chỉ có `X-Powered-By: Next.js`; không có CSP, XFO, nosniff, Referrer-Policy |
| — | Log `next dev` | In ra cả `Local` và `Network: http://<ip-mạng>:3201` → bind mọi interface |

## 3. UI — CDP (script: [evidence/cdp-verify.mjs.txt](evidence/cdp-verify.mjs.txt), [evidence/cdp-followup.mjs.txt](evidence/cdp-followup.mjs.txt))

Account mock dùng trong các test:

```json
{ "id": 1, "username": "fixture-user-01", "password": "fixture-pass", "heroes": ["Nakroth"] }
```

| Test | Thiết lập | Kết quả quan sát |
| --- | --- | --- |
| T1 Theme | Bấm toggle → reload | before `light/light` → sau toggle `dark/dark` → sau reload `{"theme":"light","stored":"light"}` |
| T2 Lỗi tải | Server thật trả 500 | Requests: `GET /api/accounts`. UI: "0 tài khoản đang lưu trên Neon Postgres." + "Không tìm thấy tài khoản" |
| T3 Tạo trùng | Mock `POST` → `409 Tên đăng nhập đã tồn tại.` | `formStillOpen: true`, `errorVisible: false`, nút trở lại "Lưu tài khoản", exception `Error: Tên đăng nhập đã tồn tại.` (unhandled) |
| T4 Xoá lỗi | `confirm` → true, mock `DELETE` → `404` | `errorVisible: false`, card vẫn còn, exception `Error: Không tìm thấy tài khoản.` (unhandled) |
| T5 Replace | Tick → đóng → mở lại | `tickedFirst: true`, `checkedAfterReopen: true` |
| T6 Warnings | Upload `fake-import.xlsx` (2 dòng, 1 dòng không có password); mock import → `{imported:2, warnings:[…]}` | Preview: "2 account", "1 cảnh báo dữ liệu". Sau khi import: dialog đóng, `serverWarningVisible: false`, `successMessageVisible: false` |
| T7 Migrate | Seed IndexedDB `AovAccountManager/accounts`: `legacy-fixture-ok` (có tướng) + `legacy-fixture-empty` (không có tướng). Mock `GET` trả 1 account | Lần 1: requests chỉ có `POST /api/accounts/import`, key `aov-neon-migration-v1 = null`. Reload: lại chỉ có `POST /import`. Lượt bổ sung: `countText: "0 tài khoản đang lưu trên Neon Postgres."`, `cards: 0` dù `GET` (mock) có dữ liệu → **`GET` không bao giờ được gọi** |

Ngoài ra, lượt T2 đầu tiên ghi nhận exception `TypeError: Cannot read properties of undefined (reading 'setProperty')`. Lượt chạy lại không tái hiện, và code app không có `setProperty` → không đưa vào danh sách lỗi.

## 4. Normalize — Vitest trong sandbox ([evidence/normalize-audit.test.ts.txt](evidence/normalize-audit.test.ts.txt))

`Test Files 1 passed · Tests 7 passed`. Mỗi assertion mô tả **hành vi hiện tại** (lỗi):

- `normalizeAccountInput(['Lữ Bố','lu bo','LỮ BỐ'])` → `heroNamesNormalized = ['lu bo','lu bo','lu bo']`
- Index account–hero (logic sao chép từ `App.tsx:69-79`) → `owners('lu bo').length === 2` với một account
- `heroes: ['!!!']` → `heroNamesNormalized: ['']` (trong khi `splitHeroes('!!!')` → `[]`)
- `heroes: ['Ngộ  Không']` → giữ khoảng trắng kép
- `['dieu thuyen'].includes('Điêu Thuyền') === false` dù normalize bằng nhau
- `parseWorkbook` với `fixture.a`, `fixture-a`, `Fixture_A`, `tài.khoản`, `tai-khoan` → chỉ giữ `['fixture.a','tài.khoản']`
- Server: `FixtureUser` ≠ `fixtureuser`

## 5. Tooling

**EPERM / ACL** (`icacls`, `whoami /groups`):

- Repo, `src/generated/prisma/models`, `.next/*`: owner là SID của một bản Windows cũ (đã ẩn, không phải user hiện tại).
- ACE áp dụng cho user hiện tại: `BUILTIN\Users:(I)(OI)(CI)(RX,W)` → không có `D`/`DC`.
- `BUILTIN\Administrators` = "Group used for deny only" (token chưa elevate).
- `attrib`: không có `R`. Không có tiến trình nào giữ khoá (không có `next dev` của repo đang chạy).
- Tạo rồi xoá `docs/audit/.permtest`: **OK** (file mới thuộc user hiện tại, có ACE `CREATOR OWNER (F)`).

**Git:**

- `git update-index --really-refresh` → `fatal: Unable to write new index file`.
- `.git/index` có mtime `2026-07-05 22:07:54` và owner là SID cũ.
- Không còn file `index.lock` sót lại.

**Package manager:**

- `packageManager: yarn@1.22.22+sha512…`; có `package-lock.json`; **không có** `yarn.lock`.
- Máy cục bộ: npm `11.19.0`, Corepack `0.36.0`, yarn `1.22.22` (cài toàn cục qua nvm).
- `.vercel/project.json` không có `settings`, nên không biết installCommand override.
- Docs Vercel (`/docs/package-managers`): chọn package manager theo lockfile; "If you are using Corepack, Vercel will use the package manager specified in the `packageManager` field".

**SheetJS** (`gh api /advisories?ecosystem=npm&affects=xlsx`):

| GHSA | CVE | Mức | Phiên bản bị ảnh hưởng |
| --- | --- | --- | --- |
| GHSA-5pgg-2g8v-p4x9 | CVE-2024-22363 | high | < 0.20.2 (ReDoS) |
| GHSA-4r6h-8v6p-xvw6 | CVE-2023-30533 | high | < 0.19.3 (Prototype Pollution) |

`npm view xlsx version` → `0.18.5` (bản mới nhất trên npm, bị ảnh hưởng bởi cả hai CVE).

**Auth packages** (`npm view`, 2026-11-21):

- `next-auth` latest `4.24.15`, beta `5.0.0-beta.32`. Beta hỗ trợ peer `next ^14 || ^15 || ^16`, `react ^18.2 || ^19`; cập nhật lần cuối `2026-07-20`.
- `better-auth` latest `1.7.27` (cập nhật `2026-11-20`), peer gồm `next … ^16`, `prisma/@prisma/client … ^7`.
- `jose` `6.2.18`.

**Docs Vercel** (markdown, tải ngày 2026-11-21):

- Vercel Authentication: *available on all plans*.
- All Deployments: *Protecting all deployments is available on all plans*.
- Password Protection: Pro, *$20 per month for each project*; không có ở Hobby.
- WAF Rate Limiting: *available on all plans*; Hobby 1 rule/project, Fixed window, cửa sổ 10 giây–10 phút.

**Docs Next 16** (`node_modules/next/dist/docs`):

- `proxy.md`: "Proxy defaults to using the Node.js runtime".
- `authentication.md`: Proxy chỉ dùng cho optimistic check, không truy vấn DB.
- `data-security.md`: Server Actions có kiểm tra Origin; Route Handler thì không.

## 6. Git status

Lấy lúc kết thúc audit. Không có file nào trong `src/`, `app/`, `prisma/`, `package.json` bị sửa:

```
 M .agents/context/data-model.md        (phiên trước)
 M .agents/skills/*.md (5 file)         (phiên trước)
 M AGENTS.md                            (phiên trước)
 M src/data/hero-data-report.json       (thay đổi của người dùng)
 M src/data/heroes.generated.ts         (thay đổi của người dùng)
?? .claude/  CLAUDE.md                  (phiên trước)
?? docs/                                (phiên này: docs/audit/)
?? public/heroes/evita/  public/heroes/tamyn/   (của người dùng)
```

## 7. Tái hiện lại

1. Copy repo sang thư mục tạm (bỏ `.git`, `.next`, `src/generated`, `.env.local`), copy thật `node_modules`.
2. Đặt `DATABASE_URL` placeholder, chạy `npx prisma generate`, rồi `npx next dev -p 3201`.
3. Đổi tên các file `evidence/*.txt` (bỏ đuôi `.txt`), đặt test vào `src/__audit__/` của **bản sao**.
4. Chạy Edge: `msedge --headless=new --remote-debugging-port=9401 --user-data-dir=<thư mục tạm>`.
5. Chạy `node cdp-verify.mjs 9401 http://localhost:3201 <đường dẫn fake-import.xlsx>`.
