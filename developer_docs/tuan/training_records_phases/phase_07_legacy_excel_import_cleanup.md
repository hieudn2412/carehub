# PHASE 7 — Import và làm sạch dữ liệu Excel cũ

**Module:** Training Records Management  
**Phạm vi tổng:** Màn hình 15–25  
**Dependency:** Chỉ bắt đầu sau khi domain model và migration chính đã ổn định.  
**Tài liệu nền bắt buộc:** [00_README_AND_SHARED_RULES.md](00_README_AND_SHARED_RULES.md)

> Coding agent chỉ triển khai nội dung của phase này. Những quyết định nghiệp vụ chưa được chốt phải được ghi thành open issue/ADR, không được tự giả định.

---

Phase này không phải một màn 15–25 nhưng cần để dữ liệu thật sử dụng được.

### 7.1 Import architecture

1. Upload file.
2. Tạo `training_import_batches`.
3. Đọc từng dòng vào `training_import_rows.raw_data`.
4. Chuẩn hóa.
5. Validate.
6. Hiển thị preview/report lỗi.
7. Chỉ commit dòng hợp lệ hoặc đã được người quản lý xác nhận.
8. Lưu mapping từ row nguồn sang record đích.

### 7.2 Mapping

| Nguồn | Đích |
|---|---|
| Dấu thời gian | `source_submitted_at` |
| Mã VD | Normalize → lookup `employees.employee_code` |
| Họ tên | Snapshot trong staging để đối chiếu |
| Ngày sinh | Snapshot trong staging để đối chiếu |
| Chương trình | `title` |
| Thời gian đào tạo | `start_date`; `end_date = start_date` nếu hợp lệ |
| Số tiết đào tạo | `duration_raw_text`; parse sang unit/value nếu chắc chắn |
| Giấy chứng nhận | `legacy_external_url` |
| Chức danh | Snapshot để kiểm tra job position |

### 7.3 Chuẩn hóa mã nhân viên

- Trim.
- Uppercase.
- Xóa khoảng trắng.
- Nếu chỉ có số: thêm prefix `VD` theo quy tắc chính thức.
- Phân biệt chữ `O` và số `0`.
- Không tự sửa trường chứa tên người.
- Mã không match employee → row failed/manual review.

### 7.4 Chuẩn hóa thời lượng

Các parser được phép nhận:

- `2`, `2.0`.
- `2h`, `2 giờ`.
- `1h30`.
- `1,5h`.
- `2 tiết`.
- `3 tín chỉ`.

Không tự động convert các giá trị:

- `1 tháng`.
- `2 năm`.
- `toàn thời gian`.
- `O3`.
- Text không phải thời lượng.

Kết quả parser phải có:

```text
rawText
parsedValue
parsedUnit
normalizedHours
confidence
warningMessages
```

Chỉ auto-commit khi confidence đạt ngưỡng và rule chuyển đổi đã được xác nhận.

### 7.5 Kiểm tra trùng

Candidate duplicate khi:

```text
same normalized employee code
same normalized title
same start date
same normalized duration
```

Không tự xóa. Đánh dấu warning để người quản lý chọn:

- Giữ cả hai.
- Bỏ dòng mới.
- Gộp evidence.
- Sửa dữ liệu.

### 7.6 Legacy evidence

- Không dùng Google Drive URL làm `object_key`.
- Lưu vào `legacy_external_url`.
- Nếu được quyền truy cập, tạo batch tải về Object Storage.
- Sau migration:
  - Tính checksum.
  - Ghi mime/size.
  - Giữ source URL để audit.
- Nếu link hỏng, đánh dấu evidence unavailable.

### 7.7 Import test cases lấy từ dữ liệu thật

- Mã có/không có `VD`.
- Mã có khoảng trắng.
- Mã sai `VDO1506`.
- Mã bị nhập thành tên người.
- Missing full name.
- Date year bị nhập `0071`, `0990`.
- Training date nằm năm 1971 hoặc 3024.
- `2 tiết`, `2h30`, `1,5 giờ`, `18 tín chỉ`.
- `1 tháng`, `2 năm`, `toàn thời gian`.
- Numeric 143, 330.
- Record không evidence.
- Google Drive URL.
- Candidate duplicate.

---
