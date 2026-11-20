---
name: hero-catalog
description: Quy trình làm việc với danh mục tướng Liên Quân — cập nhật dữ liệu bằng npm run heroes:update/heroes:check (crawl Garena bằng scripts/update-hero-data.mjs), file generated src/data/heroes.generated.ts, ảnh public/heroes/<hero-id>/, liên kết account–hero qua normalizedName, và UI catalog (HeroCard, HeroAvatar, HeroDetails, lưới tướng, tìm kiếm fuzzy). Dùng khi thêm/cập nhật tướng, sửa kỹ năng/ảnh/vai trò, xử lý Garena đổi HTML, sửa khớp tên tướng, hoặc tối ưu/hiển thị danh sách tướng.
---

# Hero Catalog

Catalog là **dữ liệu tĩnh** trong repo; runtime không bao giờ fetch Garena. Quy tắc
nền ở `AGENTS.md` mục 9.

## Luồng dữ liệu

```
scripts/update-hero-data.mjs  (cheerio, fetch Garena, CONCURRENCY = 6)
  ├─ src/data/heroes.generated.ts     // AUTO-GENERATED, `satisfies Hero[]`
  ├─ src/data/hero-data-report.json   // missingImages/Roles/Skills/SkillIcons
  └─ public/heroes/<hero-id>/avatar.<ext>, skill-<n>.<ext>
src/data/heroes.ts → export heroes = generatedHeroes, heroByNormalizedName (Map)
```

- `src/data/heroes.manual.ts` là seed cũ, **không được import ở runtime**. Thêm dữ
  liệu vào đó không có tác dụng. Nếu cần override thủ công, phải thiết kế bước
  merge trong `heroes.ts` (đây là thay đổi code nghiệp vụ — chỉ làm khi được yêu cầu).
- `src/data/heroes.ts` còn một khối comment lớn là seed cũ; không dựa vào nó.
- `id = slugify(name)` và `normalizedName = normalizeText(name)`. Script **có bản
  sao riêng** của `normalizeText` (file `.mjs` không import được TS). Khi sửa
  `src/utils/normalize.ts`, phải sửa bản sao trong script giống hệt và generate lại;
  nếu không, `normalizedName` của catalog sẽ lệch với `heroNamesNormalized` của account.

## Quy trình cập nhật dữ liệu tướng

1. `git status` — dữ liệu tướng/ảnh có thể đang có thay đổi chưa commit của người
   dùng; không ghi đè khi chưa nói rõ.
2. `npm run heroes:update` (cần mạng). Chỉ dùng `-- --force` khi cần tải lại toàn bộ
   ảnh; mặc định script giữ ảnh đã có.
3. `npm run heroes:check` — exit code 1 nếu thiếu avatar hoặc thiếu toàn bộ kỹ năng.
   Đọc `src/data/hero-data-report.json`.
4. Soát diff: `git diff --stat src/data`, thư mục mới trong `public/heroes/`. Kiểm tra
   `id` cũ không bị đổi (đổi id làm gãy đường dẫn ảnh và key React), tên canonical
   không trùng nhau sau normalize, `roles` chỉ thuộc union `HeroRole`.
5. `npm run typecheck` và `npm run build`.
6. Báo cáo: số tướng, tướng mới, danh sách thiếu trong report.

Không sửa tay `heroes.generated.ts`. Không tự suy đoán URL nguồn hay mô tả kỹ năng
khi chưa xác minh trên trang Garena — URL chi tiết có thể là slug hoặc ID số.
`skills` giữ thứ tự nội tại rồi các kỹ năng như trên trang; mô tả là text đã làm
sạch, không lưu HTML crawl.

## Khi Garena đổi HTML

Selector hiện dùng trong script:

- Danh sách `https://lienquan.garena.vn/hoc-vien/tuong-skin/`: `.st-heroes__item`
  (`href`, `data-type` chứa role ID), `.st-heroes__item--name`, `.st-heroes__item--img img`.
- Trang chi tiết: `.hero__skills--detail` (`id`, `h3`, `article`) và
  `.hero__skills--list a` (`href="#id"` → `img` icon).
- Role ID → tên trong `roleById` (28 Đấu sĩ, 29 Pháp sư, 30 Trợ thủ, 31 Đỡ đòn,
  32 Sát thủ, 33 Xạ thủ).

Cách làm: xem HTML một trang danh sách và một trang chi tiết → cập nhật selector →
chạy update → so report với lần trước trước khi chấp nhận dữ liệu mới. Không chuyển
sang fetch lúc runtime (CORS, độ ổn định).

## Liên kết account–hero

- Khớp bằng `account.heroNamesNormalized[i] === hero.normalizedName`.
- `App.tsx` dựng `accountByHero: Map<string, Account[]>` bằng `useMemo`; chi tiết
  tướng đọc trực tiếp index này. Không lưu index vào database.
- `AccountCard` tra `heroByNormalizedName.get(normalizeText(name))`; hero lạ hiển thị
  chip disabled với chữ viết tắt.
- Chưa có alias map. Nếu một biến thể tên hợp lệ không tự khớp, thêm alias map rõ
  ràng (một nơi duy nhất, áp dụng cho cả index lẫn tra cứu) kèm test.

## UI catalog

- `App.tsx` render toàn bộ ~129 tướng trong `.hero-catalog-grid` (10 cột desktop,
  breakpoint trong `src/style.css`), lọc bằng `fuzzyMatch` trong `useMemo`, chưa
  debounce/phân trang (`src/hooks/useDebounce.ts` có sẵn nhưng chưa dùng).
- `HeroAvatar`: `loading="lazy"`, fallback 2 chữ cái khi không có `imageUrl`; ảnh
  lỗi tải chưa có fallback `onError`.
- `HeroDetails`: modal desktop/bottom sheet mobile, bảng account sở hữu có hiện/copy
  password (xem skill `account-security`).
- Khi tối ưu hiệu năng render/bundle, tham khảo skill `vercel-react-best-practices`
  (nhóm `rerender-*`, `rendering-content-visibility`, `js-*`); khi review UI/a11y
  dùng `web-design-guidelines`. Mọi thay đổi style phải chạy đúng ở light/dark
  (`:root` và `:root[data-theme='dark']`) và mobile/desktop.
