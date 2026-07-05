# Hero Catalog

Catalog runtime nằm ở `src/data/heroes.ts`; schema nằm trong `src/types.ts`.

## Dữ liệu

- `id`: slug ổn định và duy nhất.
- `name`: tên chính thức có dấu/casing chuẩn.
- `normalizedName`: sinh bằng `normalizeText(name)`.
- `roles`: các giá trị hợp lệ từ `HeroRole`.
- `imageUrl`: ảnh local/remote; luôn có SVG fallback.
- `sourceUrl`: URL chi tiết chính xác từ Garena.
- `skills`: thứ tự nội tại rồi các kỹ năng, mỗi mục có tên và mô tả ngắn.

Giữ danh sách `[name, roleText]` tách khỏi enrichment như `featuredSkills` và
`sourceUrlOverrides` để cập nhật đơn giản.

## Ảnh và kỹ năng

Nguồn tham khảo chính:
`https://lienquan.garena.vn/hoc-vien/tuong-skin/`.
URL chi tiết có thể là slug hoặc ID số, không tự suy đoán khi chưa xác minh.
Ưu tiên ảnh WebP/AVIF đã commit tại `public/heroes/<id>.webp`; nếu chưa có thì dùng
fallback. Ảnh phải lazy-load. Lưu mô tả kỹ năng ngắn gọn, không lưu HTML crawl.

## Liên kết account

`heroByNormalizedName` ghép tên hero import với catalog. Trang chủ tạo
`Map<normalizedHeroName, Account[]>`; click hero đọc trực tiếp index này để mở danh
sách account và copy credentials. Search username cũng phải trả về các hero account
đó sở hữu.

Tên canonical phải unique sau normalize. Nếu có biến thể hợp lệ không tự khớp, thêm
alias map rõ ràng và test tương ứng.
