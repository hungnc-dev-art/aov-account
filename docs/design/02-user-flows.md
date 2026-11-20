# B. User flow & Information Architecture

## IA hiện tại vs đề xuất

| | Hiện tại | Đề xuất |
| --- | --- | --- |
| Cấu trúc | 2 "view" đổi bằng hash `#accounts`, chỉ 1 link chuyển qua lại | 2 trang chính + 2 lớp chi tiết, deep-link được: `#/heroes`, `#/heroes/:heroId`, `#/accounts`, `#/accounts/:id` |
| Điều hướng | Link đổi nhãn ở topbar (bị cắt trên mobile) | Desktop ≥1024: sidebar · Tablet 768–1023: nav ngang trên topbar · Mobile: bottom nav (Tướng · Tìm kiếm · Tài khoản) |
| Tìm kiếm | Catalog: chỉ tên tướng · Accounts: username/nickname | Thêm command palette Ctrl/⌘K tìm **cả tướng lẫn tài khoản** (username, tên, tướng sở hữu); mỗi trang vẫn có ô lọc riêng |
| Chi tiết | Modal tướng; **không có** chi tiết tài khoản | Drawer tướng (tab Tài khoản sở hữu / Kỹ năng) và drawer tài khoản; liên kết qua lại hai chiều |
| Thao tác dữ liệu | Nút trong trang account | Sidebar "Dữ liệu" (Nhập/Xuất) + nút trên header trang tài khoản |

Tương thích ngược: khi triển khai, `#accounts` cũ nên chuyển tiếp sang `#/accounts`.

## Flow 1 — Khám phá tướng → tài khoản sở hữu

```mermaid
flowchart LR
  subgraph Current[Hiện tại]
    c1[Mở trang] --> c2[Gõ tên tướng] --> c3[Bấm card] --> c4[Modal: cuộn qua kỹ năng] --> c5[Bảng chủ sở hữu chữ 9–10px] --> c6[Bấm hiện / copy 26px]
    c6 -. muốn quản lý tài khoản đó .-> c7[Đóng modal] --> c8[Bấm "Quản lý account"] --> c9[Gõ lại username]
  end
  subgraph Proposed[Đề xuất]
    p1[Ctrl+K hoặc ô tìm] --> p2[Gõ 3 ký tự, Enter] --> p3[Drawer mở ở tab Tài khoản sở hữu] --> p4[Hiện / copy 40px + toast]
    p3 --> p5[Mở ↗] --> p6[Drawer tài khoản: đủ tướng, sửa, xoá]
    p6 --> p7[Bấm chip tướng] --> p3
  end
```

| Tác vụ | Hiện tại | Đề xuất |
| --- | --- | --- |
| Copy mật khẩu của một tài khoản có Nakroth | 4 thao tác + cuộn qua phần kỹ năng | 3 thao tác (tìm, Enter, copy), không cuộn |
| Từ tướng sang quản lý tài khoản đó | 3 thao tác và phải gõ lại username | 1 thao tác (↗) |
| Biết tướng nào **chưa** có tài khoản | Không làm được | 1 thao tác (KPI "Chưa có tài khoản" hoặc segmented "Chưa có") |

Điểm gây nhầm lẫn đã loại bỏ:
- Kỹ năng đứng trước danh sách tài khoản, trong khi mục đích chính của app là tìm tài khoản. Đề xuất mặc định mở tab tài khoản nếu có.
- Nút đóng modal và thao tác copy quá nhỏ trên mobile.

## Flow 2 — Quản lý tài khoản

```mermaid
flowchart LR
  subgraph Current[Hiện tại]
    a1[Bấm "Quản lý account"] --> a2[Lưới card 3 cột] --> a3[Tìm: username / nickname]
    a2 --> a4[Sửa: modal form] --> a5{Lỗi 409?} -- có --> a6[Không hiện gì]
    a2 --> a7[Xoá: window.confirm] --> a8[Lỗi 404 không hiện]
    a2 -. xem đủ tướng .-> a4
  end
  subgraph Proposed[Đề xuất]
    b1[Tab Tài khoản] --> b2[Bảng desktop / card gọn mobile] --> b3[Tìm username, tên, tướng + lọc Thiếu mật khẩu / Tướng ngoài danh mục + sắp xếp]
    b2 --> b4[Bấm tên → drawer chi tiết] --> b5[Sửa → form] --> b6{Lỗi?} -- 409 --> b7[Lỗi tại ô username, focus] 
    b6 -- thành công --> b8[Toast + cập nhật danh sách]
    b4 --> b9[Xoá → alert dialog, focus Huỷ] --> b10[Toast / lỗi inline]
  end
```

| Tác vụ | Hiện tại | Đề xuất |
| --- | --- | --- |
| Xem toàn bộ tướng của một tài khoản | Phải mở form sửa | Bấm tên → drawer có ô lọc |
| Tìm tài khoản theo tướng | Không có | Gõ tên tướng vào ô tìm |
| Tìm tài khoản thiếu mật khẩu | Cuộn và đọc từng card | 1 chip lọc (có số đếm) |
| Thêm tài khoản cho tướng chưa ai có | Mở form, tự tìm tướng | Drawer tướng → "Thêm tài khoản" (tướng chọn sẵn) |
| Xoá an toàn | `window.confirm` | Alert dialog: nêu tên + username, focus "Huỷ", spinner, lỗi inline |
| Đóng form khi đang nhập dở | Mất dữ liệu ngay | Hỏi "Bỏ thay đổi chưa lưu?" |

## Flow 3 — Excel

```mermaid
flowchart LR
  subgraph Current[Hiện tại]
    e1[Bấm Import] --> e2[Chọn file] --> e3[3 ô tóm tắt + 12 cảnh báo đầu] --> e4[Checkbox 'Xoá dữ liệu hiện tại'] --> e5[Import] --> e6[Dialog tự đóng, không báo kết quả]
    e7[Bấm Export] --> e8[Tải ngay file có mật khẩu]
  end
  subgraph Proposed[Đề xuất: wizard 4 bước]
    i1[1. Chọn file: kéo thả / bấm] --> i2[2. Kiểm tra: số liệu, cảnh báo theo nhóm, xem trước dòng] --> i3[3. Xác nhận: Gộp (mặc định) / Thay thế]
    i3 -- Thay thế --> i4[Hiện số tài khoản sẽ bị xoá + sao lưu trước + gõ THAY THẾ]
    i3 --> i5[4. Kết quả: mới / cập nhật / cảnh báo máy chủ → Xem danh sách]
    x1[Xuất] --> x2[Dialog: bản đầy đủ có cảnh báo / bản chia sẻ không mật khẩu] --> x3[Tải xuống + toast]
  end
```

| Điểm | Hiện tại | Đề xuất |
| --- | --- | --- |
| Biết dữ liệu nào sẽ được ghi | 3 con số | Số liệu + cảnh báo theo nhóm (vẫn nhập / bỏ qua) + xem trước dòng |
| Phân biệt gộp và thay thế | 1 checkbox | 2 radio card mô tả hậu quả bằng số cụ thể |
| Chống xoá nhầm | Không có | Mặc định Gộp, reset mỗi lần mở, Thay thế cần gõ "THAY THẾ", tuỳ chọn sao lưu trước |
| Kết quả | Dialog đóng im lặng | Màn hình kết quả + cảnh báo máy chủ (hiện đang bị bỏ qua) |
| Xuất | Tải ngay | Cảnh báo plaintext; tuỳ chọn bản không kèm mật khẩu (**cần duyệt**) |

Nghiệp vụ giữ nguyên: parse ở browser, 3 định dạng, upsert theo username, replace trong
một transaction. Cảnh báo server lấy từ `warnings` mà API đã trả về.
