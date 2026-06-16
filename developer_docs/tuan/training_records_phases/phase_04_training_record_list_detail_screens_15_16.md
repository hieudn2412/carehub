# PHASE 4 — Danh sách và chi tiết record: màn 15, 16

**Module:** Training Records Management  
**Phạm vi tổng:** Màn hình 15–25  
**Dependency:** Phụ thuộc Phase 1, Phase 2 và Phase 3.  
**Tài liệu nền bắt buộc:** [00_README_AND_SHARED_RULES.md](00_README_AND_SHARED_RULES.md)

> Coding agent chỉ triển khai nội dung của phase này. Những quyết định nghiệp vụ chưa được chốt phải được ghi thành open issue/ADR, không được tự giả định.

---

---

### SCREEN 15 — Training Hours List Screen

#### Route

```text
/training/records
```

#### Scope theo actor

- User: mặc định `mine=true`.
- Manager: mặc định khoa của mình; có thể lọc employee.
- Admin: toàn viện.

#### Cột hiển thị

- Employee code/name/department với Manager/Admin.
- Program title.
- Activity type.
- Start date/end date.
- Declared hours.
- Approved hours.
- Evidence count.
- Workflow status.
- Submitted/updated date.
- Actions.

#### Filters

- Keyword title/provider/employee.
- Date from/to.
- Activity type.
- Professional field.
- Workflow status.
- Có/không có evidence.
- Moderation status.
- Employee.
- Department với Admin.
- Source type.
- Sort newest first mặc định.

#### Actions theo status

| Status | User | Manager/Admin |
|---|---|---|
| DRAFT | View, Edit, Evidence, Submit | Theo scope |
| PENDING_REVIEW | View | View |
| REJECTED | View, Edit, Evidence, Resubmit | View |
| APPROVED | View | View |
| CANCELLED | View | View |

#### API

```text
GET /api/v1/training/records
```

#### Performance requirements

- Server-side pagination.
- DTO list không chứa evidence binary.
- Không N+1 employee/activity/evidence count.
- Query mục tiêu <= 2 giây.
- Index đúng filter phổ biến.

#### UI states

- Loading.
- Empty.
- No results.
- Error.
- Permission denied.
- Status chip.
- Responsive table/card on mobile.

#### Acceptance criteria

- Filter date dùng completion/start date theo quy ước được chốt.
- Sort mặc định newest first.
- User không thể thay query để xem người khác.
- Manager không xem ngoài khoa.
- Pagination giữ filter trên URL.

#### Tests

- RBAC data leak.
- Combination filters.
- Date boundary.
- Pagination/sort.
- Large data query.
- Empty state.

---

### SCREEN 16 — Training Hours Detail Screen

#### Route

```text
/training/records/{id}
```

#### Sections

1. Employee information.
2. Program information.
3. Dates and duration.
4. Declared vs approved hours.
5. Activity type and professional field.
6. Evidence gallery/list.
7. Moderation status.
8. Review status and rejection reason.
9. Review timeline.
10. Edit/change history.
11. Source/import metadata.
12. Action buttons according to state.

#### API

```text
GET /api/v1/training/records/{id}
```

#### Actions

- Edit.
- Update evidence.
- Submit/resubmit.
- Cancel draft.
- Download evidence.
- Admin-only open/review override nếu được phê duyệt trong Phase 0.

#### Acceptance criteria

- Không trả storage internal path cho client.
- Dùng download URL có thời hạn.
- Detail hiển thị đủ approved/pending/rejected history.
- Dữ liệu legacy hiển thị raw source và cảnh báo chưa chuẩn hóa nếu có.
- 403 khi actor không có scope.
- 404 khi không tồn tại.

---
