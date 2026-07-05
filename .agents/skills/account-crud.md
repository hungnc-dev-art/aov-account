# Account CRUD

Account lưu trong Neon Postgres qua Prisma. Route Handlers nằm ở
`app/api/accounts/`; UI form nằm ở `src/components/AccountForm.tsx`.

## Thêm và sửa

- `username` và ít nhất một hero là bắt buộc trong form hiện tại.
- Trim username; password có thể rỗng.
- Parse `heroesText` bằng `splitHeroes`.
- Luôn ghi `heroNamesNormalized = heroes.map(normalizeText)`.
- Khi thêm: tạo `createdAt` và `updatedAt`.
- Khi sửa: giữ `id`, `createdAt`; cập nhật `updatedAt`.
- Client gọi API create/update; server normalize lại input trước khi gọi Prisma.
- Xử lý Prisma `P2002` thành lỗi username trùng.

## Xoá

Phải có xác nhận chứa username trước khi gọi `DELETE /api/accounts/:id`. Không xoá
hero catalog khi xoá account.

## Search và index

- Search account theo normalized username, nickname hoặc hero.
- Sau CRUD/import, gọi lại `GET /api/accounts` để đồng bộ client state.
- Index hero-account là derived state bằng `useMemo`; không lưu bản sao vào database.
- Sau mọi mutation, index phải được dựng lại từ `heroNamesNormalized`.

## Kiểm tra

Khi thay đổi CRUD hoặc index, kiểm tra account có hero lạ, password rỗng, username
trùng và tên tướng có dấu/apostrophe. Không log hoặc commit credential thật.
