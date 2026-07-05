# Update Hero Data

## Nguồn dữ liệu

Nguồn chính là `https://lienquan.garena.vn/hoc-vien/tuong-skin/`. Script đọc
`.st-heroes__item` để lấy tên, vai trò, trang chi tiết và avatar; sau đó đọc
`.hero__skills--detail` cùng `.hero__skills--list` để lấy kỹ năng và icon.

Runtime không fetch Garena. Dữ liệu được generate vào
`src/data/heroes.generated.ts`; ảnh được tải về `public/heroes/<hero-id>/`.

## Cập nhật

```bash
npm run heroes:update
```

Dùng `npm run heroes:update -- --force` khi cần tải lại toàn bộ ảnh. Không sửa trực
tiếp file generated.

## Kiểm tra dữ liệu thiếu

```bash
npm run heroes:check
```

Chi tiết nằm trong `src/data/hero-data-report.json`, gồm hero thiếu ảnh, vai trò,
kỹ năng hoặc icon. Lệnh trả exit code lỗi nếu thiếu avatar hoặc toàn bộ kỹ năng.

## Khi Garena đổi HTML

1. Mở source trang danh sách và một trang chi tiết.
2. Cập nhật selector trong `scripts/update-hero-data.mjs`.
3. Giữ mapping role ID tại `roleById`.
4. Chạy update và kiểm tra report trước khi thay dữ liệu cũ.
5. Không chuyển sang runtime fetch vì CORS/độ ổn định.

Sau mỗi lần update bắt buộc chạy:

```bash
npm run heroes:check
npm run typecheck
npm run build
```
