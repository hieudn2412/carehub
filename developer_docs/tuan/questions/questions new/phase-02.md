# Phase 02 — Question Category & Classification Rules

| Trạng thái | ĐÃ HOÀN THÀNH |
|------------|---------------|
| Ngày hoàn thành | 2026-07-02 |
| Nhóm màn hình | A (Question Management) |
| Đáp ứng đề án | Dòng 162: "Cập nhật, chỉnh sửa, bổ sung ngân hàng câu hỏi"; Dòng 127-128: "Xem được theo từng lĩnh vực kiến thức chuyên môn" |

---

## 1. Phạm vi

Implement module quản lý danh mục câu hỏi (Question Category) và quy tắc phân loại tự động (Classification Rules). Đây là module nền tảng — **mọi Question đều phải thuộc một Category**. Classification Rules tự động gán category cho câu hỏi mới dựa trên nội dung.

---

## 2. Màn hình

| ID | Màn hình | Route | Users |
|----|---------|-------|-------|
| 31 | Danh sách danh mục | `/admin/evaluation/categories` | Admin |
| 32 | Tạo/Chỉnh sửa danh mục | (embedded trong list page) | Admin |
| — | Danh sách quy tắc phân loại | `/admin/evaluation/classification-rules` | Admin |
| — | Tạo/Chỉnh sửa quy tắc | `/admin/evaluation/classification-rules/new`, `/:id/edit` | Admin |

---

## 3. Business Rules

### Category
- BR-001: Category Name bắt buộc, unique
- BR-002: Category Code bắt buộc, unique, uppercase, max 20 ký tự
- BR-003: Category bị disable không được gán cho Question mới
- BR-004: Category không thể xóa cứng nếu đang có Question tham chiếu — chỉ Soft Delete
- BR-005: Status: `ACTIVE` / `INACTIVE`
- BR-006: Display Order phải là số dương

### Classification Rule
- BR-007: Rule match theo priority — rule có priority cao hơn được ưu tiên
- BR-008: Rule có thể match theo `keywords` (từ khóa trong stem) hoặc `sourcePattern` (pattern trong tên/chủ đề tài liệu nguồn)
- BR-009: Rule bị disable (`enabled = false`) bị bỏ qua khi phân loại
- BR-010: Nếu không rule nào match → fallback "Chưa phân loại"
- BR-011: Rule có test endpoint cho phép dry-run không cần lưu

---

## 4. Entity

### QuestionCategory
| Field | Type | Mô tả |
|-------|------|-------|
| id | UUID | PK |
| categoryCode | String(20) | Mã danh mục, unique, uppercase |
| categoryName | String(200) | Tên danh mục, unique |
| description | String(1000) | Mô tả |
| displayOrder | Integer | Thứ tự hiển thị (>=1) |
| status | Enum | ACTIVE / INACTIVE |
| createdAt, updatedAt, deletedAt | Timestamp | Audit columns |
| createdBy, updatedBy | String | Người tạo/sửa |

### QuestionClassificationRule
| Field | Type | Mô tả |
|-------|------|-------|
| id | UUID | PK |
| name | String(200) | Tên rule |
| categoryId | UUID → QuestionCategory | Category sẽ gán nếu match |
| keywords | String[] | Từ khóa match trong stem |
| sourcePattern | String | Pattern match với tên/chủ đề tài liệu |
| priority | Integer | Độ ưu tiên (số càng thấp càng ưu tiên) |
| enabled | Boolean | Rule có đang hoạt động |
| createdAt, updatedAt | Timestamp | Audit columns |
| createdBy, updatedBy | String | Người tạo/sửa |

---

## 5. API

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/v1/question-categories` | List (q, status filter, pageable) |
| GET | `/api/v1/question-categories/{id}` | Detail |
| POST | `/api/v1/question-categories` | Create |
| PUT | `/api/v1/question-categories/{id}` | Update |
| DELETE | `/api/v1/question-categories/{id}` | Soft delete |
| GET | `/api/v1/question-classification-rules` | List (q, enabled filter, pageable) |
| GET | `/api/v1/question-classification-rules/{id}` | Detail |
| POST | `/api/v1/question-classification-rules` | Create |
| PUT | `/api/v1/question-classification-rules/{id}` | Update |
| DELETE | `/api/v1/question-classification-rules/{id}` | Disable (không xóa cứng) |
| POST | `/api/v1/question-classification-rules/test` | Dry-run: nhập stem/source → trả về category dự đoán |

---

## 6. Permission

| Vai trò | Quyền |
|---------|-------|
| Admin (QUESTION_AUTHOR) | Full CRUD Category + Rule |
| Manager | Read Only Category |
| Employee | No Access |

---

## 7. UI Components

- Category Table + Search Box + Status Filter + Pagination
- Create/Edit Dialog (inline trong list page)
- Rule Table + Search + Category Filter + Enabled Filter
- Rule Test Panel: nhập stem → xem category dự đoán
- Confirmation Dialog cho disable/delete

---

## 8. Integration Points

- **Auto-classification**: Khi tạo câu hỏi thủ công (Phase 03) hoặc save candidate từ AI (Phase 04) / paraphrase (Phase 05) — nếu topic trống, backend chạy rule engine để gán category
- **Question Set distribution** (Phase 06): Dùng category để phân bổ câu hỏi
- **Exam Config distribution** (Phase 07): Dùng category để cấu hình phân bổ đề thi
- **Result Category Analysis** (Phase 09): Dashboard phân tích điểm theo category

---

## 9. Kiểm thử

| Test | Loại | Trạng thái |
|------|------|------------|
| `QuestionCategoryServiceTest` | Unit | Pass |
| `QuestionClassificationRuleServiceTest` | Unit | Pass |
| Category CRUD manual | Manual | Pass |
| Rule test endpoint | Manual | Pass |
| Auto-classification on question create | Integration | Pass |

---

## 10. Implementation Status

**Đã implement hoàn chỉnh** (Phase 2 cũ, 2026-07-02):

- Backend: `QuestionCategory` + `QuestionClassificationRule` entities, đầy đủ CRUD API
- Rule engine hoạt động với keyword/sourcePattern matching
- Auto-classification tích hợp vào flow tạo câu hỏi thủ công và save candidate
- Frontend: tất cả các trang đã dùng API thật, không còn localStorage (`carehub_classification_rules` key đã bị xóa)
- `QuestionFormPage` dùng category active từ backend cho dropdown

---

## 11. Map với đề án bệnh viện

| Yêu cầu đề án | Được đáp ứng bởi |
|--------------|-----------------|
| "Cập nhật, chỉnh sửa, bổ sung ngân hàng câu hỏi" (dòng 162) | Category dùng để phân loại câu hỏi trong ngân hàng |
| "Xem được theo từng lĩnh vực kiến thức chuyên môn" (dòng 127-128) | Category chính là "lĩnh vực kiến thức chuyên môn" |
| "Tỷ lệ câu hỏi theo các lĩnh vực chuyên môn" (dòng 162) | Dùng category để phân bổ trong ExamConfig |

---

## 12. Liên quan

| Phase | Mối quan hệ |
|-------|-------------|
| Phase 01 | Tuân theo coding convention và permission matrix |
| Phase 03 | Category là required field cho mọi Question |
| Phase 04 | AI candidate được auto-classify khi save vào bank |
| Phase 06 | Set dùng category cho distribution |
| Phase 07 | Config dùng category cho phân bổ đề |
| Phase 09 | Dashboard phân tích kết quả theo category |
