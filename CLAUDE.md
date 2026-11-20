@AGENTS.md

## Ghi chú riêng cho Claude Code

Hướng dẫn nghiệp vụ chuẩn nằm trong project skills tại `.claude/skills/`. Các file
`.agents/skills/*.md` chỉ còn là con trỏ cho agent khác; khi cập nhật kiến thức,
sửa trong `.claude/skills/<skill>/SKILL.md`.

| Tác vụ | Skill |
| --- | --- |
| API/form/type account, validate, index account–hero | `account-crud` |
| Parser Excel, ImportDialog, import merge/replace, export | `import-excel` |
| Dữ liệu/ảnh/kỹ năng tướng, script Garena, UI catalog | `hero-catalog` |
| Prisma schema/migration, Neon, biến môi trường, deploy Vercel | `neon-prisma` |
| Review bảo mật, credential, thao tác phá huỷ | `account-security` |
| Chạy/viết test, xác minh trước bàn giao, lỗi môi trường Windows | `aov-testing` |

Skill dùng chung ở phạm vi user (không sao chép vào repo): `vercel-react-best-practices`
cho hiệu năng React/Next, `web-design-guidelines` cho review UI/a11y.

- Tài liệu Next.js đúng phiên bản đang cài nằm ở `node_modules/next/dist/docs/`;
  đọc ở đó thay vì dựa vào trí nhớ (Next 16: `middleware` đã đổi thành `proxy`).
- Khi nâng Next.js lên 16.3+, `next dev` có thể tự sinh `AGENTS.md`/`CLAUDE.md`;
  kiểm tra diff và không để nó ghi đè hai file này.
