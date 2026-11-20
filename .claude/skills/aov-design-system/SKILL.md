---
name: aov-design-system
description: Quy ước giao diện Graphite Command của app kho tài khoản Liên Quân — token màu/chữ/khoảng cách trong src/styles, component dùng chung (Button, IconButton, Field, SearchField, Segmented, Tabs, Badge, HeroAvatar, Secret/PasswordSecret, Panel dialog/drawer/sheet, Toast, StateView, Skeleton), app shell (sidebar/topbar/bottom nav), responsive, accessibility, motion và anti-pattern. Dùng khi thêm hoặc sửa bất kỳ UI, style, theme, layout, component, trạng thái loading/empty/error, dialog hoặc khi review giao diện.
---

# Graphite Command — design system

Dark-first than chì + nhấn vàng kim có kiểm soát; khung SaaS (shell, bảng, drawer,
command palette) + chất gaming (ảnh tướng, badge vàng). Light theme là bản phối riêng,
không phải đảo màu. Chi tiết token và lý do: `docs/design/04-design-system.md`.

## Bản đồ file

| Thành phần | File |
| --- | --- |
| Token (màu dark/light, chữ, spacing, radius, motion, z-index) | `src/styles/tokens.css` |
| Reset, focus ring, typography helper, reduced motion | `src/styles/base.css` |
| Component CSS | `src/styles/components.css` |
| Shell + màn hình (catalog, accounts, drawer, picker, import) | `src/styles/layout.css`, `login.css` |
| Component React dùng chung | `src/components/ui.tsx`, `overlay.tsx` (Panel), `toast.tsx`, `reauth.tsx` |
| Màn hình | `shell.tsx`, `catalog.tsx`, `hero-drawer.tsx`, `accounts.tsx`, `account-form.tsx`, `excel-dialogs.tsx`, `command-palette.tsx`, `LoginForm.tsx` |
| Theme | `src/lib/theme.ts` (boot script), `src/lib/use-theme.ts` (hook) |
| Route hash | `src/lib/navigation.ts` (`#/heroes[/id]`, `#/accounts[/id]`, tương thích `#accounts`) |

## Quy tắc bắt buộc

1. **Chỉ dùng token.** Màu: `--bg`, `--surface-1/2/3`, `--border(-strong)`, `--text(-secondary/-tertiary)`,
   `--accent`, `--accent-text`, `--on-accent`, `--success/--warning/--danger/--info` (+ `-soft`).
   Không viết hex mới trong component. Mọi cặp chữ/nền mới phải ≥ 4.5:1 ở CẢ hai theme.
2. **Chữ.** Thang `--text-xs` 12 … `--text-4xl` 34. Chữ thường ≥ 12px; 11px chỉ cho micro-label in hoa.
   Số liệu dùng `.tabular`; username/mật khẩu dùng mono + `translate="no"`.
3. **Khoảng cách** theo lưới 4px (`--space-*`), radius `--radius-xs…xl`.
4. **Vùng chạm** ≥ 40px trên cảm ứng (`pointer: coarse`), ≥ 24px trên desktop. Nút chỉ có icon
   dùng `IconButton` (bắt buộc `label` → `aria-label`).
5. **Ảnh** luôn có `width`/`height`; `loading="lazy"` trừ ~12 ảnh đầu màn hình. Avatar nguồn
   chỉ 120px: không hiển thị lớn hơn ~140px; cần "artwork" thì dùng ảnh mờ làm nền.
6. **Danh sách dài** dùng `content-visibility: auto` + `contain-intrinsic-height`
   (KHÔNG khai báo chiều rộng nội tại — gây tràn ngang lưới).
7. **Mật khẩu** không bao giờ có trong danh sách/command palette/localStorage. Hiển thị bằng
   `<PasswordSecret accountId hasPassword />` (tải khi bấm, tự che sau 30 giây).
8. **Thao tác nguy hiểm** bọc bằng `useReauth()`; xác nhận bằng `Panel role="alertdialog"`
   (focus mặc định vào nút Huỷ), không dùng `window.confirm`.
9. **Ba trạng thái riêng biệt**: đang tải (Skeleton đúng hình dạng), lỗi (`StateView kind="error"` +
   Thử lại, nói rõ dữ liệu không đổi), rỗng / không kết quả (CTA hoặc Xoá bộ lọc).
10. **Tiếng Việt thống nhất** ("tài khoản", không "account" trên UI); `…` cho trạng thái đang chạy.

## Layout & responsive

| Khoảng | Shell | Tài khoản | Lưới tướng |
| --- | --- | --- | --- |
| < 768px | topbar + bottom nav (Tướng · Tìm kiếm · Tài khoản) | card gọn | 3–4 cột |
| 768–1023px | topbar có nav ngang, toolbar sticky | card gọn | auto-fill 136px |
| ≥ 1024px | sidebar 248px | bảng 6 cột (cùng DOM, đổi bằng CSS grid) | auto-fill |

Mobile-first (`min-width`). Dialog: giữa màn hình ≥ 640px; drawer: bên phải ≥ 768px; dưới đó là
bottom sheet. Không được có cuộn ngang ở 320px.

## Component chính

```tsx
import { Button, IconButton, Field, SearchField, Segmented, StateView, PasswordSecret, Secret } from './ui'
import { Panel } from './overlay'
import { useToast } from './toast'
import { useReauth, ReauthCancelledError } from './reauth'

<Button variant="primary" icon={<Plus size={16} aria-hidden="true" />} loading={saving}>Thêm tài khoản</Button>
<IconButton label="Sửa Acc Rank Cao Thủ" icon={<Pencil size={16} aria-hidden="true" />} onClick={edit} />

<Panel open onClose={close} variant="drawer" width={560} title="Chi tiết" description="demo.kho01"
  footer={<><Button onClick={close}>Huỷ</Button><Button variant="primary">Lưu</Button></>}>
  …
</Panel>
```

`Panel` đã có: Esc, focus trap, trả focus, khoá cuộn, `aria-modal`, scrim click, footer dính,
`initialFocus` / `[data-autofocus]`. Không tự viết modal mới.

## Quy trình thêm/sửa component

1. Tìm component có sẵn trong `ui.tsx`/`overlay.tsx` trước; mở rộng bằng biến thể thay vì sao chép.
2. CSS mới đặt đúng file (`components.css` cho phần dùng chung, `layout.css` cho màn hình), tên
   class theo khối (`.acc-row__name`), selector không quá rộng (`> span` từng làm ẩn nhầm giá trị).
3. Có hover, `:focus-visible` (dùng `--focus-ring`), disabled, loading; tôn trọng `prefers-reduced-motion`.
4. Chuyển động chỉ dùng `transform`/`opacity`, thời lượng `--duration-fast|base|slow`; không `transition: all`.
5. Dữ liệu thay đổi theo thời gian (`Date.now()`, locale) trong SSR → `suppressHydrationWarning`
   hoặc chỉ render sau khi tải dữ liệu.
6. Kiểm tra: `npm run lint`, `npm run typecheck`, `npm run build`, rồi QA trình duyệt (dưới).

## Kiểm chứng giao diện

```bash
# terminal 1 (env QA riêng: AUTH_* sinh bằng scripts/auth-setup.mjs, DATABASE_URL giả)
npm run build && npx next start -H 127.0.0.1 -p 3400
# terminal 2 — API dữ liệu được mock bằng tài khoản giả, không chạm DB
node scripts/qa/ui-qa.mjs http://127.0.0.1:3400 <thư-mục-ngoài-repo> <file-mật-khẩu-QA>
```

Script chụp 1440/768/390px × dark/light, đo chữ < 12px, vùng chạm, ảnh thiếu kích thước, tràn
ngang, lỗi console/hydration/CSP và chạy 31 kiểm thử tương tác. Thay đổi UI lớn phải giữ 31/31.

## Anti-pattern

- Glassmorphism dày, neon/glow, gradient lớn; chỉ có blur 12px cho thanh dính và scrim.
- Màu làm tín hiệu duy nhất (luôn kèm chữ/icon: "Thiếu", "Chưa có mật khẩu").
- Chữ < 12px, icon button < 32px, `outline: none` không có focus thay thế.
- Lưu mật khẩu hoặc dữ liệu tài khoản vào localStorage; đưa mật khẩu vào `title`, URL, log.
- Prop `data-theme` cố định trên `<html>` (React sẽ ghi đè lựa chọn người dùng).
- Xáo trộn dữ liệu bằng `sort(() => Math.random() - 0.5)` (lệch SSR/client).
- Import tĩnh `src/utils/excel.ts` từ component (luôn `await import()` để SheetJS không vào bundle đầu).
