# Design review (Before/After) · Implementation plan · Quyết định cần duyệt

## 1. Design review — Before/After

Số đo lấy từ cùng một bộ script chạy trên trình duyệt thật (Chrome headless, CDP), dữ liệu giả.
Ảnh: [screenshots/before/](screenshots/before/) và [screenshots/after/](screenshots/after/).

| Tiêu chí | Before (production hiện tại) | After (preview) |
| --- | --- | --- |
| Cỡ chữ nhỏ nhất | 7px | 11px (chỉ micro-label in hoa); chữ thường ≥ 12px |
| Đoạn chữ < 12px mỗi màn hình | 133–340 | 3–4 |
| Phần tử tương tác < 24px (WCAG 2.2 AA) | — (icon 24–27px sát ngưỡng) | 0 ở mọi màn hình |
| Phần tử < 40px trên cảm ứng (trang tài khoản) | 196/199 | 3/154 (input bên trong khung 40px, nút Preview) |
| Tương phản nút chính | 2.79 (light) / 2.11 (dark) ✗ | 9.17 / 10.27 ✓ |
| Ảnh thiếu `width`/`height` | 100% | 0% |
| Tràn ngang 320–1440px | không | không (đã kiểm 320px) |
| Theme giữ sau reload | ✗ (luôn về light) | ✓ (kiểm tự động) |
| Lỗi console / hydration | — | 0 (8 tổ hợp route × theme) |
| Esc / focus trap / trả focus | ✗ | ✓ (kiểm tự động) |
| Trạng thái lỗi vs rỗng vs không kết quả | gộp làm một | 3 trạng thái riêng + banner lỗi không chặn ở catalog |
| Chiều cao 1 tài khoản trên mobile | ~300px | ~195px |
| Mật độ desktop (tài khoản thấy trong 900px) | ~5 card | ~9 dòng bảng |

Kiểm thử tương tác tự động (10/10 đạt):
- Enter mở drawer và focus vào nút Đóng.
- Tab 25 lần vẫn nằm trong drawer.
- Esc đóng drawer và trả focus về đúng card.
- Tìm "nakrot" (sai chính tả) vẫn ra Nakroth.
- Chọn Sáng rồi reload vẫn giữ light.
- Username trùng hiện lỗi tại đúng ô và focus vào ô đó.
- Đóng form đang có thay đổi thì hỏi xác nhận.
- Mở lại dialog import thì quay về bước 1.
- Nút Thay thế bị khoá cho tới khi gõ "THAY THẾ".
- Không cuộn ngang ở 320px.

Tự review và đã sửa trong quá trình dựng:
- Lỗi hydration do xáo trộn dữ liệu mock bằng `sort(random)`, khiến theme bị reset.
- Lưới tướng tràn ngang do `contain-intrinsic-size` áp lên cả chiều rộng.
- Cột username/mật khẩu trống ở desktop do selector CSS quá rộng.
- Phần đầu drawer bị cắt.
- Nút Preview che dialog.
- Trên mobile, lưới tướng bắt đầu ở khoảng 730px. Đã đổi KPI thành dải cuộn ngang và bỏ sticky toolbar ở mobile, giờ còn khoảng 510px.

| Khía cạnh | Đánh giá |
| --- | --- |
| Visual quality | Hệ màu than chì + vàng kim nhất quán; ảnh tướng là điểm nhấn; light theme là bản phối riêng |
| UX | Luồng chính ngắn hơn 1–3 thao tác; có deep-link; command palette; thao tác phá huỷ an toàn hơn |
| Accessibility | Đạt AA về tương phản; thao tác được bằng bàn phím; ARIA cho dialog, tabs, radiogroup, live region |
| Information density | Desktop thấy gần gấp đôi số tài khoản; card mobile thấp hơn khoảng 35% |
| Responsive | 3 kiểu shell, không tràn ngang; bottom sheet trên mobile |
| Performance | `content-visibility`, `useDeferredValue`, ảnh có kích thước, font tự host, eager cho 12 ảnh đầu |
| Maintainability | Token + khoảng 20 component dùng chung thay cho CSS rời rạc; xoá được khoảng 25 class chết |

Giới hạn còn lại:
- Avatar nguồn 120px vẫn hơi mờ ở card tablet ~168px.
- Bảng desktop là grid CSS dạng danh sách, chưa phải `<table>` (đã ẩn header khỏi screen reader); cần cân nhắc khi port.
- Preview chưa có test tự động trong repo (mới chỉ có script ngoài).

## 2. Implementation plan (PR nhỏ, giữ nguyên API/Prisma/nghiệp vụ)

Nguyên tắc chung:
- Mỗi PR chạy đủ `lint`/`test`/`typecheck`/`build` và chụp ảnh mobile + desktop, light + dark.
- Không đổi contract API.
- Code port từ `preview/` vào `src/` theo cấu trúc dưới đây; `preview/` giữ tới khi PR 9 xong rồi mới xoá.
- Các PR bảo mật (auth, ẩn password khỏi GET, xác nhận replace phía server) thuộc kế hoạch bảo mật riêng ở `docs/audit/`. PR UI chỉ chuẩn bị sẵn chỗ cho chúng; ví dụ `Secret` có thể chuyển sang lấy mật khẩu khi bấm "hiện".

| # | PR | Phạm vi | File chính | Kiểm tra / tiêu chí nhận |
| --- | --- | --- | --- | --- |
| 1 | Design tokens + shared components | `src/styles/{tokens,base,components}.css`, `src/components/ui/*` (Button, IconButton, Field, SearchField, Segmented, Tabs, Badge, Avatar, Secret, Skeleton, StateView, Panel, Toast). Font qua `next/font`. Fix theme (script đọc trước khi render) | `app/layout.tsx`, `src/style.css` → tách | Không đổi giao diện màn hình nào ngoài font/màu; test theme reload; unit test `Panel` (Esc, trả focus) nếu thêm jsdom — **cần duyệt dependency** |
| 2 | Navigation & layout | AppShell (sidebar/topbar/bottom nav), hash route `#/heroes[/id]`, `#/accounts[/id]`, chuyển tiếp `#accounts` cũ | `src/App.tsx`, `src/components/shell/*` | Deep-link, back/forward, 320–1440px |
| 3 | Hero catalog | KPI độ phủ, toolbar (tìm, sở hữu, vai trò, sắp xếp), HeroCard có badge, 3 trạng thái tải | `src/components/catalog/*` | Lọc/sắp xếp đúng với dữ liệu thật; `useMemo` index giữ nguyên |
| 4 | Hero detail | Drawer/bottom sheet, tab Tài khoản/Kỹ năng, "Thêm tài khoản" chọn sẵn tướng | `HeroDetails.tsx` → `hero-drawer.tsx` | Esc/focus/scroll lock; tướng chưa ai có |
| 5 | Account management | Bảng/card responsive, tìm theo tướng, chip lọc, drawer chi tiết, alert dialog xoá thay cho `window.confirm`, toast | `AccountManagementPage.tsx`, `AccountCard.tsx` | Lỗi 404 khi xoá hiện inline; refetch sau mutation |
| 6 | Account form | Picker lưới + tag, so khớp `normalizeText`, validate khi submit, lỗi 409 inline, hỏi khi đóng dở | `AccountForm.tsx` | Test ma trận skill `account-crud` (hero lạ, hero trùng normalize, password rỗng) |
| 7 | Excel import/export UI | Wizard 4 bước, reset mỗi lần mở, hiển thị `warnings` server, dialog xuất có cảnh báo | `ImportDialog.tsx`, `account-api.ts` (đọc `warnings`) | Merge/replace/nhiều sheet; không đổi parser |
| 8 | Responsive & a11y polish | Kiểm tra bàn phím toàn app, `pointer: coarse`, reduced motion, chữ ≥ 12px, xoá CSS chết | toàn bộ | Chạy lại số đo ở mục 1 trên app thật |
| 9 | Visual regression & QA | Đưa script CDP vào `scripts/ui-snapshots.mjs` (hoặc Playwright nếu duyệt), ảnh baseline, checklist QA; xoá `preview/` | `scripts/`, `docs/design/` | So khớp baseline 3 kích thước × 2 theme |

Ước lượng: PR 1–2 là nền (lớn nhất); PR 3–7 độc lập nhau sau khi có nền; PR 8–9 dọn dẹp.

## 3. Có nên tạo skill `aov-design-system`?

**Nên, nhưng chỉ sau khi bạn duyệt hướng thiết kế này** (theo yêu cầu, chưa tạo).

- Lý do: khi phát triển tiếp, Claude cần biết token nào dùng cho việc gì, các component có sẵn, quy tắc a11y/motion, ngưỡng đo (chữ ≥ 12px, vùng chạm ≥ 40px trên cảm ứng, tương phản AA) và cách chạy script chụp ảnh. Những thứ này không suy ra được từ một file CSS.
- Nội dung đề xuất:
  - `SKILL.md` khoảng 120 dòng: khi nào dùng, bản đồ file, quy trình thêm component, checklist review.
  - `references/tokens.md`.
  - `references/components.md` (rút gọn từ tài liệu này).
  - Trigger: "sửa UI, thêm component, style, theme, responsive, a11y".
- Không trùng với `web-design-guidelines` (quy tắc chung, tải từ xa) và `vercel-react-best-practices` (hiệu năng); skill mới chỉ chứa quyết định riêng của dự án.

## 4. Quyết định cần bạn duyệt

| # | Quyết định | Đề xuất của tôi |
| --- | --- | --- |
| H1 | Duyệt hướng "Graphite Command" (A + B + một nét của C) | Duyệt |
| H2 | Theme mặc định khi chưa chọn: **Tối** (dark-first) hay **Theo hệ thống** | Tối, có lựa chọn "Tự động" |
| H3 | IA mới: sidebar / topbar / bottom nav + command palette; URL `#/heroes/:id`, `#/accounts/:id` (chuyển tiếp `#accounts`) | Duyệt |
| H4 | Desktop hiển thị tài khoản dạng **bảng** thay cho lưới card | Duyệt |
| H5 | Drawer tướng mở mặc định tab **Tài khoản sở hữu** (nếu có) | Duyệt |
| H6 | Danh sách vẫn hiện cột mật khẩu (che sẵn, bấm để hiện) hay chỉ hiện trong drawer — gắn với quyết định bảo mật "tách password khỏi GET" ở `docs/audit/` | Giữ cột, chuyển sang lấy khi bấm nếu API đổi |
| H7 | Replace: gõ "THAY THẾ" + tuỳ chọn sao lưu trước (client) — vẫn cần xác nhận phía server theo kế hoạch bảo mật | Duyệt |
| H8 | Thêm tuỳ chọn **xuất không kèm mật khẩu** (tính năng mới) | Duyệt, PR 7 |
| H9 | Hiển thị Rank/Level/Vàng/Tình trạng (đã có trong DB từ Excel, UI hiện ẩn) trong drawer tài khoản | Duyệt |
| H10 | Một họ chữ Be Vietnam Pro (bỏ Space Grotesk), tự host bằng `next/font` | Duyệt |
| H11 | Ảnh tướng độ phân giải cao hơn (sửa script crawl, tăng dung lượng `public/heroes/`) | Để sau, đánh giá riêng |
| H12 | KPI độ phủ trên catalog (đã có / chưa có tài khoản) | Duyệt |
| H13 | Thêm devDependency test UI (jsdom + Testing Library, hoặc Playwright) cho PR 1/9 | Cân nhắc Playwright cho PR 9 |
| H14 | Giữ `preview/` trong repo tới hết PR 9; giữ dòng `preview/.next` trong `eslint.config.js` | Duyệt |
| H15 | Ảnh `docs/design/screenshots/` (8,3 MB PNG): commit vào repo hay chỉ đính kèm PR | Chỉ đính kèm PR, không commit |
| H16 | Tạo skill `aov-design-system` sau khi H1–H5 được duyệt | Duyệt |
