# Design Checkup — Giờ đào tạo, Đánh giá, Bài test, Ngân hàng câu hỏi

**Target**: carehub-frontend — các chức năng đào tạo + đánh giá  
**Date**: 2026-07-17  
**Score**: 38 / 60

---

## Vital Signs

| Vital | Status | Score | Notes |
|---|---|---|---|
| Intentionality | Watch | 5 | Layout có chủ đích nhưng một số khu vực quá dày, chưa được sắp xếp tối ưu |
| Readability | Watch | 5 | Tiếng Việt tốt nhưng lẫn từ tiếng Anh, danh mục không đồng nhất |
| Usability | Healthy | 10 | Luồng thao tác chính hoạt động, có filter/search, CRUD đầy đủ |
| Responsiveness | Watch | 5 | Admin pages desktop-focused, chưa kiểm tra trên mobile |
| Speed | Healthy | 10 | Load nhanh, không thấy layout shift |
| Accessibility | Critical | 3 | Thiếu focus ring rõ ràng, chưa kiểm tra screen reader, form elements nhỏ |
| **Total** | | **38/60** | |

---

## Phát hiện chi tiết

### 1. Giờ đào tạo — Training Status (`/training/status`)

**Tốt:**
- Layout rõ ràng: compliance badge + progress bar + biểu đồ + bảng records
- Dữ liệu hiển thị trực quan (số giờ, % hoàn thành)
- Có filter "Load mine" để xem của chính mình

**Cần sửa:**
- **CRITICAL**: Badge "NON_COMPLIANT" dùng tiếng Anh trong UI toàn tiếng Việt → phải là "KHÔNG ĐẠT" hoặc "CHƯA ĐẠT"
- Chart "Giờ theo năm" và "Giờ theo activity type" đang trống — cần mock data hoặc hiển thị "Chưa có dữ liệu" rõ ràng hơn
- "test 1128" trong bảng Record gần đây — tên record test, không phải dữ liệu thật
- Thiếu trạng thái loading khi chưa có dữ liệu

### 2. Giờ đào tạo — Cấu hình yêu cầu (`/admin/training/requirements`)

**Tốt:**
- Form cấu hình đầy đủ: chọn phòng ban, chu kỳ, ghi đè chức danh
- Có search trong danh sách 70 phòng ban

**Cần sửa:**
- **WATCH**: 70 phòng ban trong một scrollable list quá dài — nên chia thành 2-3 cột hoặc dùng tree view gọn hơn
- Chưa có trạng thái "đã lưu thành công" sau khi submit
- Nút "Thiết lập mặc định" không rõ chức năng khác gì "Lưu cấu hình"

### 3. Ngân hàng câu hỏi (`/admin/evaluation/question-bank`)

**Tốt:**
- Table rõ ràng, filter đa chiều (danh mục, độ khó, trạng thái)
- Export/Import/Tạo biến thể/Thêm câu hỏi — đầy đủ actions

**Cần sửa:**
- **WATCH**: Danh mục dropdown lẫn lộn giữa "Bài 4", "Bệnh cấp tính", "Học phần chăm sóc bệnh cấp tính - Bài 1" — không đồng nhất về naming convention. Cần thống nhất về 1 chuẩn (VD: "Bài 1 — Chăm sóc bệnh cấp tính")
- "Export Excel" và "Import" là tiếng Anh → nên là "Xuất Excel" và "Nhập"
- Cột "Loại" hiển thị "Gốc" nhưng không có tooltip giải thích

### 4. Làm bài test (`/staff/exam/take`)

**Tốt:**
- Empty state rõ ràng: "Chưa có bài kiểm tra đang mở"
- Table columns có ý nghĩa: Phân công, Bộ đề, Hạn nộp, Số lượt, Trạng thái

**Cần sửa:**
- **WATCH**: Empty state chỉ hiển thị text, không có illustration hoặc hướng dẫn "Liên hệ trưởng phòng để được giao bài"
- Thiếu filter "Tất cả / Đang mở / Đã hoàn thành / Quá hạn"

### 5. Tạo câu hỏi từ tài liệu (`/admin/evaluation/question-documents`)

**Đã được đơn giản hóa** trong lần sửa trước. Hiện tại ổn.

---

## Prescriptions — Việc cần làm tiếp

### Critical (chặn ship)
| # | Vấn đề | Fix |
|---|---|---|
| C1 | "NON_COMPLIANT" — tiếng Anh trong UI tiếng Việt | Đổi thành "KHÔNG ĐẠT" |
| C2 | Accessibility — thiếu focus ring, keyboard nav chưa kiểm tra | Audit toàn bộ bằng tab, thêm `:focus-visible` styles |

### Watch (nên sửa sớm)
| # | Vấn đề | Fix |
|---|---|---|
| W1 | Danh mục câu hỏi không đồng nhất ("Bài 4" vs "Học phần...Bài 1") | Chuẩn hóa về 1 format: "Bài N — Tên chủ đề" |
| W2 | 70 phòng ban scroll dài trong `TrainingRequirementPage` | Chia 2-3 cột hoặc dùng transfer component |
| W3 | Empty state bài test thiếu hướng dẫn | Thêm text: "Liên hệ trưởng phòng để được phân công bài kiểm tra" |
| W4 | "Export Excel" / "Import" — tiếng Anh | Đổi thành "Xuất Excel" / "Nhập" |
| W5 | Responsive chưa kiểm tra trên mobile | Test ít nhất 375px và 768px |

### Nice to have
- Thêm confirmation dialog khi lưu cấu hình yêu cầu đào tạo
- Chart "Giờ theo năm" cần hiển thị dữ liệu thật hoặc empty state rõ ràng
- Tooltip cho cột "Loại" trong ngân hàng câu hỏi
