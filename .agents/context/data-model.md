# Data Model

Schema chuẩn nằm trong `src/types.ts`.

## Account

- `id?: number`: khoá tự tăng trong PostgreSQL.
- `username`: bắt buộc, unique trong bảng `Account`.
- `password`: có thể rỗng; UI phải cảnh báo nhưng vẫn cho import.
- `nickname`, `gold`, `level`, `rank`, `status`, `note`: metadata tùy chọn.
- `heroes`: tên hiển thị lấy từ Excel/form.
- `heroNamesNormalized`: mảng song song với `heroes`, cùng thứ tự.
- `createdAt`, `updatedAt`: ISO timestamp.

Prisma schema nằm tại `prisma/schema.prisma`. `heroes` và
`heroNamesNormalized` dùng PostgreSQL `text[]`; `updatedAt` có index.

## Hero và HeroSkill

`Hero` gồm `id`, `name`, `normalizedName`, `roles`, `imageUrl?`, `sourceUrl`,
`skills`. `roles` chỉ dùng giá trị `HeroRole`. `HeroSkill` gồm `name` và mô tả
ngắn `description`.

## Quan hệ Account–Hero

Quan hệ nhiều-nhiều được giản lược thành mảng tên hero trong account. Ghép bằng:

```ts
normalizeText(account.heroes[i]) === hero.normalizedName
```

Trang chủ dựng `Map<normalizedHeroName, Account[]>` bằng `useMemo`. Hero lạ từ
Excel vẫn phải được giữ trong account dù chưa tồn tại trong catalog.

## Normalize

Luôn dùng `normalizeText`: lowercase, bỏ dấu tiếng Việt, đổi `đ` thành `d`, bỏ
apostrophe thẳng/cong, chuẩn hóa ký tự và khoảng trắng. Không tự tạo normalized key.
`heroes` và `heroNamesNormalized` phải luôn được cập nhật cùng nhau.
