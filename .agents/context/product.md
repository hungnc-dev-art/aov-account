# Product Context

## Mục tiêu

Ứng dụng Next.js fullstack để quản lý kho account Liên Quân, tra cứu tướng và tìm
account sở hữu tướng. Dữ liệu account lưu trong Neon Postgres qua Prisma và API
Route Handlers; hero catalog/ảnh/kỹ năng là static data local.

## Flow chính

1. Import account từ Excel ở client rồi gửi kết quả tới API Neon, hoặc dùng CRUD.
2. Trang chủ hiển thị hero catalog và ô tìm kiếm chung.
3. Search theo tên tướng trả về hero; search username trả về account và các hero
   account đó sở hữu.
4. Click hero mở modal/drawer gồm vai trò, kỹ năng và danh sách account sở hữu.
5. Người dùng có thể xem/copy username, password; sửa, xoá hoặc export dữ liệu.

## Màn hình và trải nghiệm

- Trang chủ: thống kê, sticky search, hero grid, khu vực quản lý account.
- Import Excel: chọn file, preview kết quả/cảnh báo, gộp hoặc thay dữ liệu.
- Account form: thêm/sửa thông tin và danh sách tướng.
- Hero detail: modal desktop, bottom sheet mobile.

## Yêu cầu kỹ thuật

- Mobile-first: card hai cột cho hero, nút chạm lớn, bottom sheet dễ cuộn/copy.
- Hỗ trợ đầy đủ light/dark theme.
- Debounce search; dùng `useMemo` cho filter và index hero-account.
- Lazy-load ảnh và phân trang render khi danh sách lớn.
- Lazy-load SheetJS để không tăng bundle khởi động.
- Deploy trên Vercel; mọi database access phải nằm ở server.
