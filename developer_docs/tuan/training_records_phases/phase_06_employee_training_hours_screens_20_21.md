# PHASE 6 — Employee Training Hours: màn 20, 21

**Module:** Training Records Management  
**Phạm vi tổng:** Màn hình 15–25  
**Dependency:** Phụ thuộc Phase 5 và compliance service.  
**Tài liệu nền bắt buộc:** [00_README_AND_SHARED_RULES.md](00_README_AND_SHARED_RULES.md)

> Coding agent chỉ triển khai nội dung của phase này. Những quyết định nghiệp vụ chưa được chốt phải được ghi thành open issue/ADR, không được tự giả định.

---

---

### SCREEN 20 — Employee Training Hours List Screen

#### Route

```text
/training/employees
```

#### Quyền

Manager, Admin.

#### Cột hiển thị

- Employee code.
- Full name.
- Department.
- Job position.
- Requirement name.
- Required hours.
- Submitted hours.
- Remaining hours.
- Compliance status.
- Last training date.
- Action: View detail.

#### Filters

- Keyword.
- Department.
- Job position.
- Professional field.
- Compliance status.
- Has pending review.
- Approved hours range.
- Requirement configured/not configured.
- Date window nếu nghiệp vụ cho phép.

#### API

```text
GET /api/v1/training/employees/status
```

#### Query strategy

- Aggregate trong database.
- Không loop từng employee rồi query từng record.
- Có thể dùng:
  - CTE.
  - Database view.
  - Materialized view nếu dữ liệu lớn.
- MVP ưu tiên query/service rõ ràng trước; chỉ cache khi đo thấy cần.

#### Acceptance criteria

- Manager chỉ nhận employee thuộc khoa.
- Admin lọc được theo khoa.
- List phân biệt `NOT_CONFIGURED`.
- Tổng số giờ khớp với màn detail.
- Export không thuộc screen này trừ khi scope được mở rộng.

#### Tests

- Aggregate accuracy.
- Department scope.
- Pagination.
- Requirement priority.
- Performance với dữ liệu lớn.

---

### SCREEN 21 — Employee Training Hours Detail Screen

#### Route

```text
/training/employees/{employeeId}
```

#### Sections

1. Employee profile header.
2. Current requirement.
3. Compliance KPI cards (submitted hours, remaining, progress).
4. Ledger danh sách record (SUBMITTED).
5. Evidence summary.
6. Breakdown theo năm.
7. Breakdown theo activity type.
8. Change history.
9. Source/import warnings.
10. Link từng record sang màn 16.

#### API

```text
GET /api/v1/training/employees/{employeeId}/status
GET /api/v1/training/employees/{employeeId}/records
```

#### Acceptance criteria

- Ledger gồm các record SUBMITTED.
- Running total cộng dồn `declared_hours`.
- Manager ngoài khoa nhận 403.
- Totals đồng nhất màn 19 và 20.
- Có thông báo rõ khi requirement chưa cấu hình.

#### Tests

- Totals consistency.
- Date window.
- Pagination ledger.
- Evidence count.
- Scope security.

---
