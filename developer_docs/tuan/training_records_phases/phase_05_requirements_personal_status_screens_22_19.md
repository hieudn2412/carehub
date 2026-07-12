# PHASE 5 — Requirement và trạng thái cá nhân: màn 22, 19

**Module:** Training Records Management  
**Phạm vi tổng:** Màn hình 15–25  
**Dependency:** Phụ thuộc Phase 1, dữ liệu nhân sự/chức danh và record đã ổn định.  
**Tài liệu nền bắt buộc:** [00_README_AND_SHARED_RULES.md](00_README_AND_SHARED_RULES.md)

> Coding agent chỉ triển khai nội dung của phase này. Những quyết định nghiệp vụ chưa được chốt phải được ghi thành open issue/ADR, không được tự giả định.

---

---

### SCREEN 22 — Training Requirement Configuration Screen

#### Route

```text
/admin/training/requirements
```

#### Dạng màn hình

- Danh sách requirement.
- Filter.
- Create/Edit drawer hoặc page.
- Detail/preview scope.
- Activate/deactivate.

#### Cột list

- Code.
- Name.
- Required hours.
- Cycle years.
- Job position.
- Department.
- Professional field.
- Effective period.
- Warning threshold.
- Active status.
- Số employee đang áp dụng.
- Updated at.

#### Form fields

- Code.
- Name.
- Required hours.
- Cycle years.
- Job position.
- Department optional.
- Professional field optional.
- Warning threshold optional.
- Effective from.
- Effective to.
- Is active.

#### Backend rules

- Required hours 0–500.
- Cycle years > 0.
- Không chồng lấn active period cùng scope.
- Không cho sửa lịch sử đã có hiệu lực theo cách làm thay đổi kết quả cũ mà không audit.
- Khuyến nghị version requirement:
  - Đóng effective_to của rule cũ.
  - Tạo rule mới từ ngày hiệu lực mới.
- Khi đổi benchmark, không retroactively đổi snapshot kết quả cũ nếu hệ thống lưu báo cáo lịch sử.

#### API

```text
GET   /api/v1/training/requirements
POST  /api/v1/training/requirements
GET   /api/v1/training/requirements/{id}
PUT   /api/v1/training/requirements/{id}
PATCH /api/v1/training/requirements/{id}/status
```

#### Acceptance criteria

- Duplicate overlapping rule trả 409.
- Requirement được chọn đúng theo priority.
- Requirement mới áp dụng từ effective date.
- Không requirement trả `NOT_CONFIGURED`.

#### Tests

- Boundary 0, 500, >500.
- Date overlap.
- Scope priority.
- Future effective rule.
- Deactivate.
- Concurrent update.

---

### SCREEN 19 — Training Status Screen

#### Routes

```text
/training/status
/training/status/{employeeId}   // Manager/Admin nếu cần
```

#### User view

KPI cards:

- Requirement đang áp dụng.
- Chu kỳ.
- Window start/end.
- Declared hours (từ record SUBMITTED).
- Remaining hours.
- Progress percentage.
- Compliance status.
- Warning banner.

Charts/list:

- Giờ theo năm.
- Giờ theo activity type.
- Record gần đây.

#### Manager/Admin view

- Có employee selector trong scope.
- Có summary khoa/toàn viện nếu cần.
- Link sang màn 20.

#### Compliance calculation

```text
submitted_hours =
  SUM(training_records.declared_hours)
  WHERE employee_id = target
    AND workflow_status = 'SUBMITTED'
    AND start_date BETWEEN window_start AND window_end
```

```text
remaining_hours = MAX(required_hours - submitted_hours, 0)
```

```text
COMPLIANT      khi submitted_hours >= required_hours
NON_COMPLIANT  khi submitted_hours < required_hours
NOT_CONFIGURED khi không tìm thấy requirement
AT_RISK        chỉ khi đã có rule threshold được chốt
```

#### API

```text
GET /api/v1/training/status/me
GET /api/v1/training/employees/{employeeId}/status
```

#### Acceptance criteria

- SUBMITTED hours đủ requirement là compliant.
- Đúng bằng requirement là compliant.
- Không có requirement hiển thị `NOT_CONFIGURED`.
- Warning nêu chính xác số giờ còn thiếu.
- Hiển thị rolling 5-year window rõ ràng.
- Status cập nhật ngay sau submit.

#### Tests

- Boundary exactly equal.
- Pending excluded.
- Rejected excluded.
- Old record outside window excluded.
- Requirement change.
- Employee transferred department.
- No configuration.

---
