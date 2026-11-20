# D. Design system "Graphite Command"

Mã nguồn tham chiếu: `preview/styles/tokens.css` (token), `preview/styles/components.css`
(component), `preview/styles/layout.css` (layout/màn hình), `preview/components/ui.tsx`,
`overlay.tsx`, `toast.tsx`. Không dùng UI framework ngoài; icon dùng `lucide-react` có sẵn.

## 1. Token màu (semantic)

| Token | Dark | Light | Dùng cho |
| --- | --- | --- | --- |
| `--bg` | `#0b0e14` | `#f5f6f8` | Nền trang |
| `--bg-sunken` | `#080a0f` | `#eceef2` | Sidebar |
| `--surface-1` | `#12161f` | `#ffffff` | Card, bảng |
| `--surface-2` | `#181d28` | `#eef0f4` | Input, ô credential, hover |
| `--surface-3` | `#1f2532` | `#e5e8ee` | Nền avatar, progress track |
| `--border` / `--border-strong` | `#2a3140` / `#3a4354` | `#dfe3ea` / `#c9cfd9` | Viền, viền hover |
| `--text` | `#eceff4` | `#11151d` | Chữ chính |
| `--text-secondary` | `#a9b1c1` | `#4a5263` | Mô tả, nhãn |
| `--text-tertiary` | `#828b9d` | `#646d7f` | Gợi ý, meta |
| `--accent` | `#f2b84b` | `#e8ad3a` | Nền nút chính, badge sở hữu, chỉ báo |
| `--on-accent` | `#1b1305` | `#1b1305` | Chữ trên nền accent |
| `--accent-text` | `#f5c66a` | `#94600b` | Chữ/icon nhấn trên nền thường |
| `--success` / `--warning` / `--danger` / `--info` | `#43c08a` / `#f0a845` / `#f26b76` / `#6cb4f5` | `#177a4f` / `#9a5b06` / `#c8323f` / `#1f69b0` | Trạng thái (kèm `*-soft` cho nền) |
| `--role-*` | 6 màu vai trò | 6 màu đậm hơn | Chỉ dạng chấm 8px **đi kèm chữ** |

Tương phản đã kiểm chứng (WCAG 2.x, chữ thường cần ≥ 4.5:1):

| Cặp | Dark (bg / s1 / s2) | Light (bg / s1 / s2) |
| --- | --- | --- |
| `--text` | 16.8 / 15.7 / 14.6 | 16.9 / 18.3 / 16.0 |
| `--text-secondary` | 9.0 / 8.4 / 7.8 | 7.3 / 7.8 / 6.9 |
| `--text-tertiary` | 5.6 / 5.3 / 4.9 | 4.8 / 5.2 / 4.6 |
| `--accent-text` | 12.1 / 11.4 / 10.6 | 4.9 / 5.3 / 4.7 |
| `--danger` | 6.6 / 6.2 / 5.7 | 4.9 / 5.3 / 4.6 |
| `--on-accent` trên `--accent` | 10.3 | 9.2 |

Quy tắc: không dùng màu làm tín hiệu duy nhất (badge "Thiếu" có icon + chữ; vai trò có chữ).

## 2. Typography

Một họ chữ: **Be Vietnam Pro** (thiết kế cho dấu tiếng Việt) qua `next/font/google`, tự host, `display: swap`.
Monospace hệ thống cho username/mật khẩu (`translate="no"`).

| Token | px | Dùng cho |
| --- | --- | --- |
| `--text-xs` | 12 | Caption, badge, nhãn (tối thiểu cho chữ thường) |
| `--text-sm` | 13 | Meta, chip, nút nhỏ |
| `--text-md` | 14 | Body mặc định, nút |
| `--text-lg` | 16 | Tiêu đề nhóm; input trên mobile (tránh iOS zoom) |
| `--text-xl` | 18 | Tiêu đề panel |
| `--text-2xl` | 22 | KPI, tiêu đề phụ |
| `--text-3xl` / `--text-4xl` | 28 / 34 | Tiêu đề trang (mobile / desktop) |

11px chỉ dùng cho micro-label in hoa có tracking (eyebrow sidebar, bottom nav, `kbd`).
Tiêu đề `text-wrap: balance`; số liệu `tabular-nums`; trọng số 400/500/600/700.

## 3. Spacing, radius, elevation

- Spacing lưới 4px: `--space-1…16` = 4, 8, 12, 16, 20, 24, 32, 40, 48, 64.
- Radius: `xs 6` (badge) · `sm 8` (input, nút) · `md 12` (card) · `lg 16` · `xl 20` (dialog, sheet) · `full`.
- Elevation: `--shadow-1` (segmented active) · `--shadow-2` (hover card) · `--shadow-3` (dialog, drawer, toast).
  Dark dùng thêm viền sáng 2–3% thay cho bóng đậm. `--highlight` là gradient trên cùng 4% cho bề mặt card.
- Kích thước control: `sm 32` (chỉ dùng với chuột) · `md 40` · `lg 44`. Trên `pointer: coarse` mọi control ≥ 38–40px.

## 4. Grid & breakpoint

| Khoảng | Shell | Lưới tướng | Danh sách tài khoản |
| --- | --- | --- | --- |
| < 560 | Topbar + bottom nav | 3 cột | Card gọn |
| 560–767 | Topbar + bottom nav | 4 cột | Card gọn |
| 768–1023 | Topbar có nav ngang, toolbar sticky | `auto-fill minmax(136px, 1fr)` | Card gọn |
| ≥ 1024 | Sidebar 248px | auto-fill | Bảng 6 cột |
| ≥ 1280 | Nội dung tối đa 1280px | | |

Mobile-first (`min-width`), chỉ số ít quy tắc dùng `max-width` để thu gọn.

## 5. Component

| Component | Biến thể / trạng thái | Quy tắc |
| --- | --- | --- |
| **Button** | `primary` (1 cái/khu vực) · `secondary` · `ghost` · `danger` · `danger-soft`; `sm/md/lg`; `loading` (spinner + `aria-busy`, chữ "Đang lưu…") | Nhãn động từ cụ thể ("Thêm tài khoản", "Thay thế bằng 12 tài khoản") |
| **IconButton** | `ghost` · `outline` · `danger`; `sm/md` | Bắt buộc prop `label` → `aria-label` + `title` |
| **Input / Field** | thường · focus (viền accent + vòng mềm) · `data-invalid` | Label luôn hiển thị; hint hoặc lỗi bên dưới (`aria-describedby`); lỗi có icon + `role="alert"` |
| **SearchField** | `md/lg`, phím tắt hiển thị | `type="search"`, nút xoá có nhãn, `spellCheck={false}` |
| **Select** | `md` · `sm` (trong dòng kết quả) | Native `<select>` có màu nền rõ cho dark mode Windows |
| **Segmented** | radiogroup, phím mũi tên/Home/End | Lọc một chiều có 2–4 lựa chọn |
| **Chip** | radio (lọc vai trò, lọc tài khoản), có số đếm | Hàng cuộn ngang trên mobile |
| **Tabs** | tablist + tabpanel, phím mũi tên, badge số | Trong drawer |
| **Card / KPI** | tĩnh · bấm được (lọc nhanh) · link | KPI bấm được phải mô tả hành động trong `aria-label` |
| **Hero card** | badge số tài khoản (vàng), chấm vai trò | `content-visibility: auto` + `contain-intrinsic-height` (không đặt chiều rộng) |
| **Account row** | bảng (≥1024) / card gọn (<1024), cùng một DOM | Tên là button mở drawer; credential dùng `Secret` |
| **Secret** | username · password (che `••••••`, hiện/ẩn `aria-pressed`, copy) · rỗng ("Chưa có mật khẩu" + icon cảnh báo) | Copy → toast; lỗi clipboard → toast lỗi có hướng dẫn |
| **Avatar / AvatarStack / Monogram** | xs 24 · sm 32 · md 40 · lg 56 · xl 88; tướng ngoài danh mục viền nét đứt | `width`/`height` luôn có; `onError` → chữ viết tắt |
| **Panel** (dialog/drawer/sheet) | `dialog` giữa màn hình ≥640px · `drawer` bên phải ≥768px · bottom sheet trên mobile; `role="alertdialog"` cho xác nhận | Esc, focus trap, trả focus, khoá cuộn, `overscroll-behavior: contain`, footer dính, cao tối đa `100dvh - 24px` |
| **Toast** | success · error · info, tự ẩn 3,5s (lỗi 6s), có nút đóng | Vùng `role="status" aria-live="polite"`, tối đa 3 |
| **Skeleton** | khối theo đúng hình dạng nội dung | `aria-busy` trên vùng chứa |
| **StateView** | `empty` · `error` (`role="alert"`) | Tiêu đề + nguyên nhân + bước tiếp theo + hành động |
| **Banner** | lỗi không chặn (catalog vẫn dùng được) | Có nút "Thử lại" |
| **Callout** | info · warning · danger | Cảnh báo hậu quả trước thao tác |
| **Badge** | neutral · accent · success · warning · danger · info · outline | Không dùng màu làm tín hiệu duy nhất |
| **Stepper / RadioCard / Dropzone** | wizard import | Radio card dùng `:has(input:checked)`; dropzone là button + input file ẩn |

## 6. Motion

| Tình huống | Thời lượng | Easing | Thuộc tính |
| --- | --- | --- | --- |
| Hover/press control | 120ms | `--ease-out` | màu, viền, `translateY(1px)` khi nhấn |
| Hover card | 200ms | `--ease-out` | `translateY(-2px)`, bóng, zoom ảnh 1.04 |
| Mở dialog / drawer / sheet | 280ms | `--ease-out` | `transform` + `opacity` |
| Toast | 280ms | `--ease-out` | `translateY` + `opacity` |
| Skeleton | 1.4s lặp | ease-in-out | background-position |

Không bao giờ dùng `transition: all`. `prefers-reduced-motion` tắt mọi animation và transition.
Chỉ animate `transform`/`opacity`.

## 7. Nội dung & giọng văn

Tiếng Việt thống nhất ("tài khoản", không dùng "account" trên UI). Câu chủ động, nói bước tiếp theo
khi lỗi ("Kiểm tra kết nối rồi thử lại. Dữ liệu trong kho không bị thay đổi."). Dấu `…` cho trạng thái
đang chạy và placeholder. Thời gian dùng `Intl.RelativeTimeFormat('vi')`, ngày giờ đầy đủ đặt trong `title`.
