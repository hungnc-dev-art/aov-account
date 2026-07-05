# Hướng dẫn làm việc trong repository

## 1. Mục tiêu và phạm vi dự án

Đây là ứng dụng Next.js App Router chạy fullstack trên Vercel để quản lý kho
account Liên Quân, tra cứu tướng và tìm các account sở hữu từng tướng.

- Dữ liệu account được lưu trong Neon Postgres và truy cập bằng Prisma.
- Danh mục tướng, kỹ năng và ảnh là dữ liệu tĩnh nằm trong repository.
- Trình duyệt chỉ giao tiếp với database thông qua API Route Handler.
- Ứng dụng hiện chưa có xác thực hoặc phân quyền. Không triển khai công khai dữ
  liệu account thật trước khi bổ sung lớp bảo vệ phù hợp.

Mọi thay đổi phải ưu tiên tính đúng đắn của dữ liệu account, không làm lộ thông
tin đăng nhập và giữ trải nghiệm tốt trên cả desktop lẫn mobile.

## 2. Thứ tự ưu tiên tài liệu

Khi làm việc trong repository, đọc và áp dụng theo thứ tự sau:

1. Yêu cầu hiện tại của người dùng.
2. File `AGENTS.md` này.
3. Tài liệu ngữ cảnh trong `.agents/context/`.
4. Hướng dẫn nghiệp vụ phù hợp trong `.agents/skills/`.
5. Code và test hiện có trong repository.

Các tài liệu nội bộ quan trọng:

- `.agents/context/product.md`: mục tiêu sản phẩm và luồng sử dụng chính.
- `.agents/context/data-model.md`: mô hình Account, Hero và quy tắc normalize.
- `.agents/skills/account-crud.md`: quy tắc CRUD account.
- `.agents/skills/import-excel.md`: các định dạng Excel và quy tắc import.
- `.agents/skills/hero-catalog.md`: cấu trúc catalog và liên kết account–hero.
- `.agents/skills/update-hero-data.md`: quy trình cập nhật dữ liệu tướng.
- `.agents/skills/deploy-vercel-neon.md`: Prisma, Neon và triển khai Vercel.

Chỉ đọc file `.env.local` khi thực sự cần kiểm tra cấu hình. Tuyệt đối không in,
log, sao chép hoặc đưa giá trị bí mật vào câu trả lời, commit hay tài liệu.

## 3. Kiến trúc và cấu trúc thư mục

Ứng dụng dùng Next.js App Router với TypeScript:

- `app/`: page, layout và API Route Handler phía server.
- `app/api/accounts/`: API đọc, tạo, sửa, xoá và import account.
- `src/App.tsx`: client shell chính, điều hướng bằng hash, theme và index
  account–hero.
- `src/components/`: các component UI dùng lại cho catalog, chi tiết tướng,
  quản lý account và import.
- `src/lib/account-api.ts`: lớp gọi API từ Client Component.
- `src/lib/accounts.ts`: validate, chuẩn hoá input và serialize Account.
- `src/lib/prisma.ts`: Prisma Client dùng `PrismaNeon`, chỉ dành cho server.
- `src/lib/legacy-indexed-db.ts`: migrate một lần dữ liệu IndexedDB cũ lên API.
- `src/utils/normalize.ts`: nguồn duy nhất cho normalize và tách tên tướng.
- `src/utils/excel.ts`: parse/export Excel ở browser.
- `src/types.ts`: nguồn sự thật cho các type nghiệp vụ dùng chung.
- `src/data/`: dữ liệu tướng generated/manual và báo cáo kiểm tra.
- `prisma/schema.prisma`: schema database chuẩn.
- `prisma/migrations/`: migration phải được commit cùng thay đổi schema.
- `public/heroes/`: avatar và icon kỹ năng tướng được phục vụ dạng static.
- `scripts/`: script cập nhật và kiểm tra dữ liệu tướng.

Không sửa thủ công `src/generated/prisma/`; thư mục này do `prisma generate` tạo
và đã được ignore khỏi Git. Không khôi phục persistence cũ trong
`src/db/database.ts`; account hiện phải lưu qua Neon.

## 4. Lệnh phát triển và kiểm tra

Sử dụng các script đã định nghĩa trong `package.json`:

```bash
npm install
npm run dev
npm run lint
npm test
npm run typecheck
npm run build
```

Các lệnh database:

```bash
npm run db:generate
npm run db:migrate -- --name <ten-migration>
npm run db:deploy
```

Các lệnh dữ liệu tướng:

```bash
npm run heroes:update
npm run heroes:update -- --force
npm run heroes:check
```

Không chạy `prisma migrate dev` trong Vercel build. `npm run db:deploy` chỉ dùng
để áp dụng migration đã được commit lên đúng database mục tiêu.

## 5. Database, Prisma và biến môi trường

- Runtime server phải lấy chuỗi kết nối từ `process.env.DATABASE_URL`.
- Local dùng `.env.local`; Vercel dùng Environment Variables cho Development,
  Preview và Production.
- `.env.example` chỉ được chứa placeholder, không chứa host, username, password
  hoặc database thật.
- Không đặt connection string dưới tên có tiền tố `NEXT_PUBLIC_`.
- Không import Prisma Client hoặc Neon driver vào Client Component.
- Mọi truy cập database từ browser phải đi qua Route Handler trong `app/api/`.
- Giữ `export const runtime = 'nodejs'` cho Route Handler dùng Prisma.
- Không tạo Prisma Client mới cho từng request; tái sử dụng singleton trong
  `src/lib/prisma.ts` để tránh tăng số connection khi hot reload.
- Với kiểm tra kết nối, ưu tiên truy vấn chỉ đọc tối thiểu như `SELECT 1`; không
  in connection string hoặc dữ liệu account thật.

Khi thay đổi schema:

1. Sửa `prisma/schema.prisma`.
2. Tạo migration có tên mô tả rõ bằng `npm run db:migrate -- --name ...`.
3. Kiểm tra cả schema và migration SQL sinh ra.
4. Commit schema và toàn bộ migration tương ứng.
5. Chạy generate, test, type-check và build trước khi bàn giao/commit.

Không dùng `db push` để thay thế migration cho thay đổi cần triển khai lâu dài.
Không xoá, truncate hoặc replace dữ liệu thật nếu người dùng chưa yêu cầu rõ.

## 6. Mô hình dữ liệu và quy tắc nghiệp vụ

### Account

Schema chuẩn nằm trong `prisma/schema.prisma`; type chia sẻ nằm trong
`src/types.ts`.

- `username` bắt buộc và unique trong PostgreSQL; luôn trim trước khi lưu.
- `password` được phép rỗng; UI/import phải cảnh báo nhưng không tự loại account.
- Khi tạo/sửa qua form hiện tại, account phải có ít nhất một tướng.
- `heroes` giữ tên hiển thị gốc theo đúng thứ tự.
- `heroNamesNormalized` phải được tạo đồng thời từ `heroes` và có cùng thứ tự.
- `createdAt` và `updatedAt` từ Prisma phải được serialize thành ISO string khi
  trả về client.
- Lỗi Prisma `P2002` phải trả thành lỗi username trùng dễ hiểu.
- Lỗi Prisma `P2025` phải trả thành lỗi không tìm thấy tài nguyên.

### Chuẩn hoá dữ liệu

Luôn dùng `normalizeText` trong `src/utils/normalize.ts`. Không tự viết thêm một
phiên bản normalize cục bộ. Hàm hiện xử lý lowercase, bỏ dấu tiếng Việt, đổi
`đ` thành `d`, bỏ apostrophe, chuẩn hoá ký tự và khoảng trắng.

Khi nhận chuỗi danh sách tướng, dùng `splitHeroes` để trim, chuẩn hoá khoảng trắng
và loại trùng theo tên đã normalize. Không xoá hero lạ chỉ vì hero đó chưa tồn tại
trong catalog tĩnh.

### Liên kết Account–Hero

Quan hệ nhiều-nhiều được biểu diễn bằng mảng tên, không có bảng nối. Liên kết
bằng `account.heroNamesNormalized` và `hero.normalizedName`. Index account theo
tướng là derived state được dựng bằng `useMemo`; không lưu thêm một bản sao trong
database.

## 7. API Route Handler

Các endpoint hiện có:

- `GET /api/accounts`: trả danh sách theo `updatedAt` giảm dần; hỗ trợ query
  `?hero=` đã normalize.
- `POST /api/accounts`: tạo account mới.
- `PUT /api/accounts/:id`: cập nhật account theo ID nguyên dương.
- `DELETE /api/accounts/:id`: xoá account theo ID nguyên dương.
- `POST /api/accounts/import`: upsert theo `username`; chế độ replace chạy trong
  cùng Prisma transaction.

Khi thêm hoặc sửa endpoint:

- Validate payload tại server dù client đã validate.
- Trả status code phù hợp và JSON lỗi có thông điệp tiếng Việt rõ ràng.
- Không trả stack trace, connection string hoặc chi tiết nội bộ của Prisma.
- Giữ transaction cho thao tác nhiều bước cần tính nguyên tử.
- Không nuốt lỗi làm UI hiểu nhầm thao tác đã thành công.
- Cập nhật lớp gọi API và state phía client nếu contract response thay đổi.

## 8. Import và export Excel

Excel được parse trong browser bằng SheetJS. App đang hỗ trợ:

- Ma trận cột: mỗi account nằm theo cột, tướng nằm theo hàng.
- Ma trận hàng: mỗi account nằm theo hàng, tướng nằm theo cột đánh dấu.
- Bảng phẳng có các cột username, password và danh sách heroes.

Quy tắc bắt buộc:

- So khớp header sau khi chạy `normalizeText`.
- Hỗ trợ marker sở hữu `x`, `1`, `có`, `yes`, `true`.
- Nếu workbook có nhiều sheet, chọn ứng viên có dữ liệu đầy đủ nhất.
- Username là bắt buộc; password rỗng chỉ tạo cảnh báo.
- Loại username trùng trong cùng lần import theo giá trị đã normalize.
- Không bỏ qua account hoặc hero không nhận diện mà không có cảnh báo.
- Chế độ merge/upsert không được xoá dữ liệu cũ.
- Chế độ replace xoá và nhập lại trong cùng một transaction; phải được người
  dùng chọn/xác nhận rõ ràng.
- Không đưa file Excel cá nhân hoặc credential thật vào fixture/test/commit.

Khi thêm format parser mới, giữ tương thích với format cũ và thêm regression test
tạo workbook trong memory tại `src/utils/excel.test.ts`.

## 9. Danh mục và tài nguyên tướng

- Runtime catalog được export từ `src/data/heroes.ts`.
- Dữ liệu crawl/generated nằm trong `src/data/heroes.generated.ts`.
- Điều chỉnh thủ công tách riêng trong `src/data/heroes.manual.ts` nếu luồng hiện
  tại hỗ trợ.
- Không sửa trực tiếp file generated; dùng `npm run heroes:update`.
- Ảnh và icon phải nằm dưới `public/heroes/<hero-id>/` và được lazy-load ở UI.
- `id` phải ổn định; `normalizedName` phải sinh bằng `normalizeText(name)`.
- Role chỉ dùng các giá trị trong union `HeroRole`.
- Không tự suy đoán URL nguồn hoặc dữ liệu kỹ năng khi chưa xác minh.

Sau khi cập nhật dữ liệu tướng, bắt buộc chạy `npm run heroes:check`, kiểm tra
`src/data/hero-data-report.json`, sau đó chạy type-check và build.

## 10. Quy ước TypeScript và React

- Dùng TypeScript strict, hai khoảng trắng, dấu nháy đơn và không dùng dấu chấm
  phẩy cuối câu.
- Component, interface và type nghiệp vụ dùng PascalCase.
- Hook tùy chỉnh bắt đầu bằng `use`.
- Hàm/biến dùng camelCase; constant toàn cục có thể dùng UPPER_SNAKE_CASE.
- Dùng `import type` khi chỉ import type.
- Không dùng `any` nếu có thể mô hình hoá bằng type cụ thể hoặc `unknown`.
- Không tắt rule ESLint/TypeScript nếu chưa nêu rõ lý do sát dòng code.
- Client Component phải có `'use client'` và không được chứa code truy cập DB.
- Tránh lưu derived state; dùng `useMemo` cho filter/index có chi phí đáng kể.
- Xử lý loading, empty state và error state rõ ràng cho thao tác bất đồng bộ.
- Sau mutation account, tải lại dữ liệu qua API để đồng bộ state với server.

## 11. UI, accessibility và theme

- Thiết kế mobile-first, sau đó kiểm tra desktop.
- Mọi thay đổi style phải hoạt động đúng ở cả light theme và dark theme.
- Theme hiện được điều khiển bằng `document.documentElement.dataset.theme` và
  lưu tại `localStorage` với key `aov-theme`.
- Ưu tiên class CSS có ý nghĩa trong `src/style.css`; tránh style inline lặp lại.
- Giữ nút chạm đủ lớn, nội dung modal/bottom sheet cuộn được trên màn hình nhỏ.
- Nút chỉ có icon phải có `aria-label`; form control phải có label accessible.
- Không dùng màu làm tín hiệu duy nhất cho trạng thái hoặc lỗi.
- Ảnh phải có fallback phù hợp và không làm vỡ layout khi tải lỗi.

Với thay đổi UI đáng kể, kiểm tra ít nhất:

- Mobile và desktop.
- Light và dark theme.
- Loading, dữ liệu rỗng, dữ liệu dài và lỗi API.
- Điều hướng catalog ↔ `#accounts`, modal/drawer và thao tác bàn phím cơ bản.

## 12. Test và tiêu chí xác minh

Chọn mức kiểm tra theo phạm vi thay đổi, nhưng trước khi commit phải chạy đầy đủ:

```bash
npm run lint
npm test
npm run typecheck
npm run build
```

Ngoài bộ lệnh chung:

- Sửa normalize/parser: thêm hoặc cập nhật Vitest regression test.
- Sửa CRUD/API: kiểm tra create, update, delete, username trùng, ID không tồn tại,
  password rỗng và hero lạ.
- Sửa import: kiểm tra merge, replace, nhiều sheet và dữ liệu cảnh báo.
- Sửa schema: kiểm tra migration trên môi trường an toàn trước khi deploy.
- Sửa dữ liệu tướng: chạy thêm `npm run heroes:check`.
- Sửa UI/style: kiểm tra mobile/desktop và cả hai theme.

Luôn lint tất cả file đã sửa. Không bỏ qua lỗi có sẵn nếu lỗi đó nằm trong file
đang chỉnh hoặc do thay đổi hiện tại gây ra. Nếu một lệnh không chạy được, ghi rõ
lệnh, nguyên nhân và phần nào chưa được xác minh khi bàn giao.

## 13. Bảo mật và dữ liệu nhạy cảm

Không commit hoặc đưa vào log/câu trả lời:

- `.env.local` hay giá trị `DATABASE_URL`.
- Username/password account thật.
- Export Excel hoặc đường dẫn file cá nhân.
- Token, cookie, API key, log request chứa credential.

Không gửi credential xuống browser ngoài đúng dữ liệu mà UI nghiệp vụ hiện yêu
cầu. Khi debug, ưu tiên metadata không nhạy cảm, mã lỗi và số lượng bản ghi thay
vì nội dung bản ghi. Không thực hiện thao tác phá huỷ database nếu chưa có yêu cầu
rõ ràng và xác nhận đúng môi trường.

## 14. Git, commit và pull request

- Trước khi sửa, kiểm tra worktree và không ghi đè thay đổi không liên quan của
  người dùng.
- Chỉ đưa vào commit những file thuộc đúng phạm vi yêu cầu, trừ khi người dùng yêu
  cầu commit toàn bộ worktree.
- Dùng Conventional Commits quốc tế, nhưng nội dung phải rõ ràng bằng tiếng Việt.
- Ví dụ: `feat: chuyển dữ liệu account sang Neon Postgres`.
- Nếu có thay đổi version, phải ghi version mới ngay trong tiêu đề commit.
- Tiêu đề nên ngắn gọn; phần body liệt kê đầy đủ thay đổi nghiệp vụ/kỹ thuật quan
  trọng khi phạm vi lớn.
- Bắt buộc chạy lint, test, type-check và build thành công trước khi commit.

Pull request phải nêu:

- Mục tiêu và các thay đổi chính.
- Migration/database command cần chạy.
- Biến môi trường được thêm hoặc đổi tên, tuyệt đối không ghi giá trị thật.
- Các lệnh xác minh đã chạy và kết quả.
- Ảnh chụp desktop/mobile cho thay đổi UI; có cả light/dark nếu liên quan style.
- Rủi ro, giới hạn hoặc bước triển khai thủ công còn lại.

## 15. Checklist hoàn tất công việc

Trước khi bàn giao, xác nhận:

- Thay đổi đúng yêu cầu và không mở rộng phạm vi ngoài ý muốn.
- Không có secret, credential, export hoặc dữ liệu cá nhân trong diff/log.
- Quy tắc normalize và cặp `heroes`/`heroNamesNormalized` vẫn nhất quán.
- Client không truy cập Neon/Prisma trực tiếp.
- Migration được tạo và commit nếu schema thay đổi.
- UI đã kiểm tra mobile, desktop, light và dark nếu có thay đổi giao diện.
- Test phù hợp đã được thêm/cập nhật.
- Tất cả file đã sửa đã được lint; test và type-check đạt.
- Build production đạt trước khi commit.
- Báo cáo bàn giao nêu ngắn gọn file đã đổi, hành vi mới và các lệnh đã chạy.
