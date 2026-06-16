# PHASE 2 — Training Activity Type: màn 23, 24, 25

**Module:** Training Records Management  
**Phạm vi tổng:** Màn hình 15–25  
**Dependency:** Phụ thuộc Phase 1.  
**Tài liệu nền bắt buộc:** [00_README_AND_SHARED_RULES.md](00_README_AND_SHARED_RULES.md)

> Coding agent chỉ triển khai nội dung của phase này. Những quyết định nghiệp vụ chưa được chốt phải được ghi thành open issue/ADR, không được tự giả định.

---

Làm nhóm này trước vì màn tạo record phụ thuộc Activity Type.

---

### SCREEN 23 — Training Activity Type List Screen

#### Route

```text
/admin/training/activity-types
```

#### Quyền

Admin only.

#### Cột hiển thị

- Code.
- Tên loại hoạt động.
- Mô tả rút gọn.
- Đơn vị thời lượng mặc định.
- Có bắt buộc minh chứng không.
- Giới hạn giờ tối đa/record.
- Số record đang sử dụng.
- Trạng thái active/inactive.
- Ngày cập nhật gần nhất.
- Actions.

#### Filter và sort

- Keyword theo code/name.
- Active/inactive.
- Requires evidence.
- Default duration unit.
- Sort theo code, name, sort order, updated date.
- Pagination.

#### Actions

- Create.
- View detail.
- Edit.
- Activate/deactivate.
- Không hiển thị hard delete.

#### API

```text
GET /api/v1/training/activity-types
```

Query params:

```text
keyword
isActive
requiresEvidence
durationUnit
page
size
sort
```

#### Validation/backend

- Code unique, trim, uppercase.
- Name required.
- Usage count phải tính bằng query aggregate.
- Nếu type được tham chiếu, chỉ deactivate.

#### UI states

- Loading skeleton.
- Empty state.
- No search result.
- Server error + retry.
- Confirm dialog khi deactivate.
- Badge active/inactive.

#### Acceptance criteria

- Admin lọc được danh sách theo trạng thái.
- Type inactive không xuất hiện trong dropdown tạo record mới.
- Type đã được dùng vẫn xem được trong record cũ.
- Không xảy ra N+1 query khi lấy usage count.

#### Tests

- List pagination.
- Filter keyword không phân biệt hoa thường.
- Deactivate referenced type thành công.
- Hard-delete endpoint không tồn tại.

---

### SCREEN 24 — Create/Edit Training Activity Type Screen

#### Route

```text
/admin/training/activity-types/new
/admin/training/activity-types/{id}/edit
```

#### Fields

| Field | Required | Rule |
|---|:---:|---|
| Code | Có | Unique, uppercase, 2–50 ký tự |
| Name | Có | 1–255 ký tự |
| Description | Không | Giới hạn hợp lý |
| Default duration unit | Có | Enum |
| Requires evidence | Có | Boolean |
| Max credited hours/record | Không | > 0 |
| Sort order | Có | >= 0 |
| Is active | Có | Boolean |

#### Business behavior

- Khi edit type đã được tham chiếu:
  - Không cho đổi `code`, hoặc chỉ Admin đặc biệt được đổi với audit.
  - Cho đổi name/description/config.
- Hiển thị conflict nếu version cũ.
- Trim input trước validate.
- Có nút Save và Cancel.

#### API

```text
POST /api/v1/training/activity-types
PUT  /api/v1/training/activity-types/{id}
```

#### Acceptance criteria

- Duplicate code trả 409.
- Validation field trả 422.
- Save thành công điều hướng sang detail.
- Record được audit trước/sau.

#### Tests

- Create valid.
- Duplicate code.
- Invalid max hours.
- Concurrent edit.
- Edit referenced type không đổi được code.

---

### SCREEN 25 — Training Activity Type Detail Screen

#### Route

```text
/admin/training/activity-types/{id}
```

#### Sections

1. Thông tin chung.
2. Quy tắc thời lượng và evidence.
3. Trạng thái.
4. Usage statistics.
5. Danh sách record gần đây dùng type này.
6. Audit timeline.
7. Actions: Edit, Activate/Deactivate, Back.

#### API

```text
GET /api/v1/training/activity-types/{id}
```

#### Acceptance criteria

- Hiển thị type inactive bình thường.
- Hiển thị usage count chính xác.
- Không làm lộ thông tin record ngoài quyền của Admin.
- 404 nếu ID không tồn tại.

---
