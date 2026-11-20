# C. Ba hướng thiết kế

Ràng buộc chung: avatar tướng chỉ 120×120px; nội dung chính là danh sách và dữ liệu nhạy cảm
(credential); người dùng chủ yếu tra cứu nhanh và thao tác lặp lại, cả trên điện thoại.

## A. Premium Gaming Dashboard

- **Triết lý**: cảm giác "phòng chỉ huy" của game thủ: tối, giàu tương phản, nhấn bằng ánh kim loại.
- **Màu**: nền than chì `#0b0e14`, bề mặt `#12161f`/`#181d28`, nhấn vàng kim `#f2b84b`, màu vai trò tướng làm điểm nhấn phụ.
- **Chữ**: Be Vietnam Pro 600–700 cho tiêu đề, số dạng tabular.
- **Điều hướng**: sidebar tối, chỉ báo trang hiện tại bằng vạch vàng.
- **Component**: card có viền mảnh, phủ một lớp gradient rất nhẹ ở trên; badge vàng cho số tài khoản sở hữu.
- **Card/table/form**: hero card ảnh vuông, có badge; bảng mật độ trung bình; input nền chìm.
- **Responsive**: lưới auto-fill, bottom nav trên mobile.
- **Ưu**: hợp ngữ cảnh Liên Quân, nổi bật ảnh tướng, cao cấp.
- **Nhược**: dễ sa vào glow/neon; light theme thường bị bỏ quên.

## B. Modern SaaS Management

- **Triết lý**: công cụ quản trị rõ ràng, tập trung vào tác vụ (kiểu Linear/Vercel).
- **Màu**: trung tính lạnh, một màu nhấn; light và dark ngang hàng nhau.
- **Chữ**: một họ sans, thang chữ chặt, nhiều trọng số 500–600.
- **Điều hướng**: sidebar với tìm kiếm Ctrl/⌘K, breadcrumb, deep-link mọi trạng thái.
- **Component**: bảng dữ liệu, chip lọc, segmented control, toast, alert dialog chuẩn.
- **Card/table/form**: bảng là trung tâm; form có validation inline; drawer chi tiết.
- **Responsive**: bảng chuyển thành card dọc trên mobile.
- **Ưu**: hiệu quả, dễ bảo trì, nhất quán, a11y tốt.
- **Nhược**: dễ trông giống template admin, thiếu chất game.

## C. Cinematic Hero Collection

- **Triết lý**: bộ sưu tập tướng như poster điện ảnh: ảnh lớn, chữ display, chuyển động.
- **Màu**: đen sâu, ảnh tướng là nguồn màu, gradient lớn.
- **Chữ**: display serif/condensed cho tên tướng.
- **Điều hướng**: hero carousel, tab lớn, ít chrome.
- **Component**: card dọc tỉ lệ 3:4, hover parallax, drawer toàn màn hình.
- **Responsive**: carousel vuốt ngang trên mobile.
- **Ưu**: ấn tượng thị giác mạnh nhất.
- **Nhược**: **không khả thi với ảnh 120px** (sẽ vỡ hạt); mật độ thông tin thấp, chậm khi tra cứu; động nhiều thì tốn pin và khó cho a11y; quản lý credential không hợp phong cách poster.

## So sánh

| Tiêu chí | A. Gaming | B. SaaS | C. Cinematic |
| --- | --- | --- | --- |
| Hợp nghiệp vụ tra cứu + quản lý | ●●○ | ●●● | ●○○ |
| Cảm giác cao cấp, đặc trưng game | ●●● | ●○○ | ●●● |
| Khả thi với asset 120px | ●●○ | ●●● | ●○○ |
| Light theme đẹp | ●○○ | ●●● | ●○○ |
| A11y, mật độ thông tin | ●●○ | ●●● | ●○○ |
| Chi phí bảo trì | ●●○ | ●●● | ●○○ |

## Khuyến nghị: "Graphite Command" (A + B, mượn một nét của C)

Đây là hướng đã dựng trong preview:

- **Khung B** (cấu trúc): sidebar/topbar/bottom nav, command palette, bảng + drawer, chip lọc,
  alert dialog, toast, deep-link.
- **Chất A** (bề mặt): dark-first than chì, nhấn vàng kim có kiểm soát (nút chính, badge sở hữu,
  chỉ báo điều hướng, focus ring), màu vai trò dạng chấm nhỏ đi kèm chữ.
- **Một nét của C**: đầu drawer tướng dùng chính avatar làm nền mờ (blur 36px, opacity 0.4) và một
  avatar 88px nét. Có không khí điện ảnh mà không phóng to ảnh nguồn.
- **Không dùng**: glassmorphism dày, neon, glow. Chỉ có blur 12px cho thanh dính và scrim modal;
  bóng đổ hai lớp mảnh.
- **Light theme** là bản phối riêng (không phải đảo màu): vàng kim đậm `#94600b` cho chữ nhấn, nút
  vàng `#e8ad3a` chữ tối, đều đạt AA.

Chi tiết token và component: [04-design-system.md](04-design-system.md).
