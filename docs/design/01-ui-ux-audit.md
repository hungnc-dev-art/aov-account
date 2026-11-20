# A. Audit UI/UX giao diện hiện tại

Ngày audit: 2026-11-21 · Commit `0807b1c` · Next.js 16.2.9, React 19.2.7.

## Phương pháp

- Đọc toàn bộ `src/App.tsx`, `src/style.css` (352 dòng), `src/components/*`, `src/lib/account-api.ts`, `src/types.ts`.
- Chạy app thật trên bản sao repo (DB giả, API được mock bằng 18 tài khoản giả qua Chrome DevTools Protocol)
  và chụp ở 1440 / 768 / 390px, light + dark. Ảnh: [screenshots/before/](screenshots/before/).
- Đo tự động trên DOM: cỡ chữ, kích thước vùng chạm, ảnh thiếu kích thước, tràn ngang.
- Tính tương phản WCAG 2.x cho các cặp màu trong token.
- Đối chiếu bộ quy tắc Vercel Web Interface Guidelines (bản mới nhất) và `vercel-react-best-practices`.

Mức ưu tiên: **P0** chặn sử dụng hoặc vi phạm a11y nghiêm trọng · **P1** ảnh hưởng rõ tới trải nghiệm ·
**P2** chất lượng, nhất quán, hiệu năng.

## Số đo nền (trước redesign)

| Chỉ số | Catalog | Accounts | Form | Ghi chú |
| --- | --- | --- | --- | --- |
| Cỡ chữ nhỏ nhất | **7px** | 8–9px | 8–9px | role badge 7px, header bảng 8px |
| Đoạn chữ < 12px | 133–135 | 200–203 | 337–340 | trên mỗi màn hình |
| Phần tử tương tác < 40px | 3/133 | **195/199** | 326/464 | icon button 24–32px |
| Ảnh thiếu `width`/`height` | 130/130 | 109/109 | 238/238 | gây CLS |
| Tràn ngang | không | không | không | ✓ |
| Theme sau reload | **luôn về light** | | | đã tái hiện bằng trình duyệt |

Tương phản (WCAG AA cần ≥ 4.5:1 cho chữ thường):

| Cặp màu | Light | Dark |
| --- | --- | --- |
| Chữ trắng trên nút chính | **2.79** ✗ | **2.11** ✗ |
| `--muted` trên nền | 4.34 ✗ | 7.19 ✓ |
| Role badge | 3.70 ✗ | 8.96 ✓ |
| Eyebrow cam trên nền | 3.73 ✗ | — |

## Phát hiện

### 1. Visual hierarchy & layout

| ID | Mức | Vấn đề | Vị trí | Đề xuất |
| --- | --- | --- | --- | --- |
| U1 | P1 | Giá trị cốt lõi (tướng nào có tài khoản nào) không hiện ở catalog: card chỉ có ảnh + tên + vai trò. CSS `.owner-count` đã viết nhưng không dùng | `src/components/HeroCard.tsx:9-31`, `src/style.css:127` | Badge số tài khoản trên card; KPI độ phủ (đã có / chưa có tài khoản) bấm được để lọc |
| U2 | P1 | Điều hướng chỉ là **một link đổi nhãn** ở topbar; trên mobile bị cắt thành "Quản lý ac…"; không có trạng thái đang ở trang nào | `src/App.tsx:106-108`, `src/style.css:267` | Sidebar (desktop), nav ngang (tablet), bottom nav 3 mục (mobile) với `aria-current` |
| U3 | P1 | Card account nặng: ~300px/tài khoản trên mobile, 3 cột trên desktop khó so sánh; username lặp 2 lần khi chưa có nickname | `src/components/AccountCard.tsx:44-114` | Desktop: bảng 6 cột; mobile: card gọn ~170px; tiêu đề = nickname, dòng phụ = số tướng · rank |
| U4 | P2 | Hero intro 58px chiếm nửa màn hình đầu; eyebrow trộn hoa/thường ("Thông tin tướng" vs "DANH MỤC TƯỚNG") | `src/App.tsx:125-129`, `src/components/HeroDetails.tsx:30` | Tiêu đề 28–34px, eyebrow thống nhất uppercase 12px |
| U5 | P1 | Không xem được toàn bộ tướng của một tài khoản: card chỉ hiện 6 chip + "+14" không bấm được; muốn xem phải mở form sửa | `src/components/AccountCard.tsx:40-41,111` | Drawer chi tiết tài khoản với lưới tướng có tìm kiếm |

### 2. Typography, spacing, contrast, màu

| ID | Mức | Vấn đề | Vị trí | Đề xuất |
| --- | --- | --- | --- | --- |
| U6 | P0 | Chữ 7–10px khắp nơi (role badge 7px, header bảng 8–9px, giá trị credential 9–10px, nhãn tướng trong picker 10px) | `src/style.css:131,144,192,224,230,303,308` | Thang chữ 12/13/14/16/18/22/28/34; tối thiểu 12px, 11px chỉ cho micro-label in hoa |
| U7 | P0 | Nút chính trượt AA ở **cả hai theme** (2.79 / 2.11); muted, badge, eyebrow trượt ở light | `src/style.css:15-17,31-32,109` | Vàng kim với chữ tối `#1b1305` (9.2–10.3:1); toàn bộ token mới đã kiểm tra ≥ 4.5:1 |
| U8 | P2 | `@import` Google Fonts trong CSS chặn render, tải 2 họ font | `src/style.css:1` | `next/font/google` tự host, một họ Be Vietnam Pro (tối ưu tiếng Việt) |
| U9 | P2 | Spacing/radius rời rạc (9, 11, 13, 17, 19px…) | `src/style.css` | Lưới 4px, radius 6/8/12/16/20 |

### 3. Card, table, form, modal, navigation

| ID | Mức | Vấn đề | Vị trí | Đề xuất |
| --- | --- | --- | --- | --- |
| U10 | P1 | Modal không đóng bằng Esc, không bẫy focus, không trả focus; `AccountForm` thiếu `role="dialog"`/`aria-labelledby`; `ImportDialog` thiếu `aria-labelledby` | `src/components/AccountForm.tsx:88-93`, `ImportDialog.tsx:56-62`, `HeroDetails.tsx:16-22` | Component `Panel` dùng chung: Esc, focus trap, trả focus, khoá cuộn, dialog/drawer/bottom sheet |
| U11 | P1 | Xoá dùng `window.confirm` — không theo theme, không hiện được lỗi | `src/components/AccountManagementPage.tsx:54` | Alert dialog, focus mặc định vào "Huỷ", hiện lỗi inline |
| U12 | P1 | Form: lỗi "Chọn ít nhất một tướng" hiện ngay khi vừa mở; nút Lưu bị khoá thay vì giải thích; lỗi API (409) không hiện; ô lọc tướng không có label; ≤420px picker thành danh sách 1 cột 129 dòng | `src/components/AccountForm.tsx:75-85,158-162,184-186`, `src/style.css:319` | Validate khi submit, focus lỗi đầu tiên, lỗi 409 hiện tại ô username; picker dạng lưới avatar + chip đã chọn + lọc theo vai trò |
| U13 | P1 | Form so khớp tướng theo chuỗi chính xác: tên import khác hoa/thường/dấu không hiện là đã chọn, có thể chọn trùng; tướng ngoài danh mục không bỏ chọn được | `src/components/AccountForm.tsx:66-73,167` | So khớp bằng `normalizeText`; tướng lạ hiện thành tag cảnh báo, gỡ được |
| U14 | P1 | Import: replace chỉ là 1 checkbox và **giữ trạng thái** khi mở lại; chỉ hiện 12 cảnh báo đầu; không xem trước dòng dữ liệu; đóng im lặng sau khi xong; cảnh báo server bị bỏ qua; chữ "file Lq ex" là thuật ngữ nội bộ | `src/components/ImportDialog.tsx:15,19,83,110,117-124`, `src/lib/account-api.ts:57` | Wizard 4 bước, reset mỗi lần mở, replace cần gõ "THAY THẾ" + sao lưu |
| U15 | P2 | Export tải ngay file chứa password plaintext, không cảnh báo | `src/components/AccountManagementPage.tsx:64-67` | Dialog xuất có cảnh báo; tuỳ chọn bản không kèm mật khẩu (cần duyệt) |

### 4. Responsive & touch

| ID | Mức | Vấn đề | Vị trí | Đề xuất |
| --- | --- | --- | --- | --- |
| U16 | P1 | 195/199 phần tử tương tác ở trang account < 40px (icon 24–32px); bảng chủ sở hữu trong modal tướng dùng chữ 9px trên mobile | `src/style.css:140,146,234,303-309` | Icon button 40px (32px chỉ với chuột), `pointer: coarse` nâng lên 40px |
| U17 | P2 | Không có `touch-action: manipulation`, `overscroll-behavior: contain` cho modal | `src/style.css:164-165` | Đã có trong base + panel |

### 5. Loading, empty, error, success

| ID | Mức | Vấn đề | Vị trí | Đề xuất |
| --- | --- | --- | --- | --- |
| U18 | P0 | Lỗi API hiển thị như kho rỗng: "0 tài khoản đang lưu… / Không tìm thấy tài khoản / Thử tìm bằng… khác" dù người dùng chưa tìm gì (đã tái hiện) | `src/App.tsx:55-57`, `AccountManagementPage.tsx:112-117` | Ba trạng thái tách biệt: lỗi (có "Thử lại", nói rõ dữ liệu không đổi), kho rỗng (CTA Nhập Excel/Thêm), không có kết quả (Xoá bộ lọc) |
| U19 | P1 | Loading chỉ là một dòng chữ; catalog không cho biết số tài khoản đang tải | `AccountManagementPage.tsx:110-111` | Skeleton đúng hình dạng; KPI/badge sở hữu dạng skeleton |
| U20 | P1 | Không có phản hồi thành công sau lưu/xoá/nhập/sao chép (CSS `.toast` có nhưng không dùng) | `src/style.css:239`, `AccountCard.tsx:16-30` | Toast `aria-live="polite"` |

### 6. Accessibility & bàn phím

| ID | Mức | Vấn đề | Vị trí | Đề xuất |
| --- | --- | --- | --- | --- |
| U21 | P0 | Theme không giữ sau reload (effect ghi `light` trước khi đọc) — đã tái hiện: dark → reload → light | `src/App.tsx:23-42` | Script khởi tạo chỉ đọc trước render + `useSyncExternalStore` |
| U22 | P2 | Không có skip link; không định nghĩa `:focus-visible`; ô lọc tướng trong form có `outline: 0` mà không có focus ring | `src/style.css:185` | Focus ring token dùng chung, skip link |
| U23 | P2 | Nhãn trộn Anh–Việt ("Copy username", "account"), sao chép không thông báo cho screen reader | `AccountCard.tsx:26`, `HeroOwnerAccount.tsx:15` | Copy tiếng Việt thống nhất, toast `aria-live` |

### 7–8. Animation, hiệu năng, ảnh

| ID | Mức | Vấn đề | Vị trí | Đề xuất |
| --- | --- | --- | --- | --- |
| U24 | P2 | Toàn bộ `<img>` thiếu `width`/`height` → layout shift | `src/components/HeroAvatar.tsx:13`, `HeroDetails.tsx:49` | Khai báo kích thước; `loading="eager"` cho ~12 ảnh đầu |
| U25 | P2 | 129 card render đầy đủ, không `content-visibility`; tìm kiếm chạy đồng bộ mỗi phím | `src/App.tsx:82-87,151-160` | `content-visibility: auto` + `contain-intrinsic-height`, `useDeferredValue` |
| U26 | P2 | Avatar nguồn chỉ 120×120px (riêng `evita` 200px) → mờ khi phóng to; giới hạn "hero artwork nổi bật" | `public/heroes/*/avatar.jpg` | Không hiển thị lớn hơn ~140px; drawer dùng ảnh mờ làm nền + avatar 88px nét. Ảnh lớn hơn = quyết định riêng |
| U27 | P2 | Modal chỉ có slide-up trên mobile; hover `translateY` trên mọi nút | `src/style.css:108,294` | Motion có mục đích: enter 200–280ms, giảm chuyển động tôn trọng `prefers-reduced-motion` |

### 9–10. Nhất quán & cảm giác "cũ"

| ID | Mức | Vấn đề | Vị trí | Đề xuất |
| --- | --- | --- | --- | --- |
| U28 | P2 | Hai bản sao component copy/credential (`CopyButton`, `CopyValue`); ~25 class CSS chết (`.hero-banner`, `.stats-panel`, `.search-sticky`, `.floating-add`, `.toast`, `.owner-count`, `.button--load`, `.account-manager`…) | `AccountCard.tsx:16`, `HeroOwnerAccount.tsx:5`, `src/style.css:84-105,127,134,160,238-239` | Thư viện component dùng chung + xoá CSS chết |
| U29 | P1 | Ý đồ sản phẩm "tìm username → ra tài khoản và các tướng" (`.agents/context/product.md`) chưa có | `src/App.tsx:81-87` | Command palette Ctrl/⌘K tìm cả tướng lẫn tài khoản |
| U30 | P2 | Cảm giác template: gradient cam + nền xám, card giống nhau ở mọi nơi, chữ nhỏ dày đặc | toàn bộ | Hướng "Graphite Command" (xem [03-design-concepts.md](03-design-concepts.md)) |

## Phụ lục: Web Interface Guidelines (định dạng ngắn)

```text
## src/style.css
src/style.css:1 - @import font chặn render → next/font
src/style.css:131 - font-size 7px
src/style.css:185 - outline: 0 không có focus thay thế (.hero-picker__search input)
src/style.css:164 - modal thiếu overscroll-behavior: contain
src/style.css - thiếu touch-action: manipulation; thiếu theme-color

## src/App.tsx
src/App.tsx:23-42 - theme ghi đè trước khi đọc (mất lựa chọn)
src/App.tsx:55 - lỗi tải bị nuốt, hiển thị như rỗng
src/App.tsx:106 - điều hướng 1 link đổi nhãn, không aria-current
src/App.tsx:151 - danh sách 129 phần tử không content-visibility

## src/components/AccountForm.tsx
AccountForm.tsx:88 - dialog thiếu role/aria-labelledby, không Esc, không focus trap
AccountForm.tsx:158 - input lọc thiếu label
AccountForm.tsx:184 - lỗi hiện trước khi người dùng thao tác
AccountForm.tsx:192 - submit bị disable thay vì báo lỗi khi bấm
AccountForm.tsx:75 - không có nhánh catch → lỗi API không hiển thị

## src/components/ImportDialog.tsx
ImportDialog.tsx:19 - state giữ nguyên sau khi đóng (replace vẫn tick)
ImportDialog.tsx:86 - "Đang phân tích workbook…" thiếu aria-live
ImportDialog.tsx:117 - thao tác phá huỷ chỉ bằng 1 checkbox

## src/components/AccountManagementPage.tsx
AccountManagementPage.tsx:54 - window.confirm cho thao tác phá huỷ
AccountManagementPage.tsx:112 - empty state dùng chung cho rỗng / lỗi / không kết quả

## src/components/HeroAvatar.tsx
HeroAvatar.tsx:13 - img thiếu width/height; không fallback khi ảnh lỗi

## src/components/AccountCard.tsx, HeroOwnerAccount.tsx
AccountCard.tsx:26 - aria-label tiếng Anh "Copy …"; sao chép không aria-live
HeroOwnerAccount.tsx:5 - trùng lặp component với AccountCard.tsx:16

## src/components/FlySearch.tsx, HeroCard.tsx
✓ pass (label, aria-label, button semantics)
```
