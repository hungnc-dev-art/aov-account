# Import Excel

Logic chính ở `src/utils/excel.ts`, dùng SheetJS và đọc sheet thành mảng hai chiều.

## Format hỗ trợ

- Ma trận cột: account nằm theo cột; tìm dòng `Tên đăng nhập`; metadata gồm `Tên
  nick`, `MK/Mật khẩu`, `Vàng`, `Level`, `Rank/Hạng`, `Tình trạng`; tướng nằm theo
  hàng dưới `Tên Tướng`. Các marker `x`, `1`, `có`, `yes`, `true` nghĩa là sở hữu.
- Ma trận hàng: mỗi dòng là account, mỗi cột hero được đánh marker.
- Bảng phẳng: `username`, `password`, `heroes`; hero list tách bằng dấu phẩy,
  chấm phẩy hoặc xuống dòng.

Header phải được so khớp sau `normalizeText`. Nếu workbook có nhiều sheet, chấm
điểm theo số account, mật khẩu và hero rồi chọn nguồn đầy đủ nhất.

Parsing vẫn chạy trong browser. Sau preview/xác nhận, gửi `ImportResult.accounts`
tới `POST /api/accounts/import`; server upsert theo unique `username`. Chế độ
replace phải chạy trong Prisma transaction.

## Mapping và validate

- `username` bắt buộc; password được phép rỗng nhưng thêm cảnh báo.
- Loại username trùng trong cùng lần import bằng normalized username.
- Dùng `splitHeroes` để trim, chuẩn hóa khoảng trắng và loại hero trùng.
- Tạo đồng thời `heroes` và `heroNamesNormalized`.
- Không bỏ account/hero lạ một cách im lặng; trả lỗi trong `ImportResult.errors`.

Khi thêm format mới, giữ parser cũ và thêm regression test bằng workbook tạo trong
memory. Không dùng đường dẫn Excel cá nhân trong test.
