# Phase 06 — Question Set & Versioning

| Trạng thái | ĐÃ HOÀN THÀNH |
|------------|---------------|
| Ngày hoàn thành | 2026-07-02 (core) → 2026-07-03 (versioning hardening) |
| Nhóm màn hình | B (Exam Management) |
| Đáp ứng đề án | Dòng 162: "thay đổi được cấu trúc đề thi trắc nghiệm" — Set là nguồn câu hỏi cho đề |

---

## 1. Phạm vi

Implement Bộ câu hỏi (Question Set) — tập hợp câu hỏi có thứ tự, đóng vai trò **template** cho việc sinh đề kiểm tra. Question Set **không phải bài kiểm tra** — nó là nguồn câu hỏi ổn định để ExamConfig (Phase 07) tham chiếu.

Hỗ trợ versioning: mỗi lần activate tạo immutable snapshot để đảm bảo đề thi đã publish không bị thay đổi.

---

## 2. Màn hình

| ID | Màn hình | Route | Users |
|----|---------|-------|-------|
| 39 | Danh sách bộ câu hỏi | `/admin/evaluation/question-sets` | Admin |
| 40 | Tạo bộ câu hỏi | `/admin/evaluation/question-sets/new` | Admin |
| 40 | Chỉnh sửa bộ câu hỏi | `/admin/evaluation/question-sets/:id/edit` | Admin |

---

## 3. Business Rules

### Core
- BR-001: Set Name bắt buộc, unique
- BR-002: Set phải có ít nhất 1 Question trước khi Activate
- BR-003: Chỉ Question `APPROVED` mới được thêm vào Set
- BR-004: Không được thêm Question trùng trong cùng Set
- BR-005: Một Question có thể thuộc nhiều Set
- BR-006: Status lifecycle: `DRAFT` → `ACTIVE` → `ARCHIVED`

### Versioning & Snapshot
- BR-007: Khi Activate, hệ thống tự động tạo `QuestionSetVersion` — snapshot bất biến toàn bộ nội dung câu hỏi (stem, A-D, correct answer, explanation, difficulty, topic, source)
- BR-008: Active Set bị **khóa cứng** — không thể PUT trực tiếp
- BR-009: Muốn sửa Active Set → phải Duplicate → tạo bản nháp → sửa → Activate thành version mới
- BR-010: Duplicate Active Set sử dụng active version snapshot (không đọc live question)
- BR-011: Export ưu tiên dùng active snapshot items nếu có

### Archive Rules
- BR-012: Set đã được ExamConfig ACTIVE tham chiếu → không được archive
- BR-013: Set đã có Paper PUBLISHED → cảnh báo nhưng không chặn archive (paper đã có snapshot riêng)

---

## 4. Entity

| Entity | Mô tả |
|--------|-------|
| `QuestionSet` | Bộ câu hỏi: code, name, description, status (DRAFT/ACTIVE/ARCHIVED), activeVersion, snapshotAt |
| `QuestionSetItem` | Câu hỏi trong set: questionId, displayOrder, points, required |
| `QuestionSetItemSnapshot` | Snapshot của 1 item khi activate (không dùng nữa, thay bởi Version) |
| `QuestionSetVersion` | Phiên bản set: version number, snapshotAt, status |
| `QuestionSetVersionItem` | Câu hỏi trong phiên bản: sourceQuestionId, position, points, required, snapshot stem/A-D/correctAnswer/explanation/difficulty/topic/source |

---

## 5. API

| Method | Endpoint | Mô tả | Permission |
|--------|----------|-------|------------|
| GET | `/api/v1/question-sets` | List (q, category, difficulty, status filter) | canAccess |
| GET | `/api/v1/question-sets/{id}` | Detail + versions + active snapshot | canAccess |
| POST | `/api/v1/question-sets` | Create | canManageQuestionSet |
| PUT | `/api/v1/question-sets/{id}` | Update (DRAFT only) | canManageQuestionSet |
| POST | `/api/v1/question-sets/{id}/activate` | Activate → tạo version snapshot | canManageQuestionSet |
| POST | `/api/v1/question-sets/{id}/deactivate` | Deactivate | canManageQuestionSet |
| DELETE | `/api/v1/question-sets/{id}` | Soft archive | canManageQuestionSet |
| POST | `/api/v1/question-sets/{id}/duplicate` | Duplicate → DRAFT (từ active: dùng snapshot) | canManageQuestionSet |
| GET | `/api/v1/question-sets/{id}/export` | Export CSV/XLSX/DOCX/PDF | canManageQuestionSet |
| POST | `/api/v1/question-sets/preview` | Preview theo blueprint | canManageQuestionSet |

---

## 6. Permission

| Vai trò | Quyền |
|---------|-------|
| Admin (QUESTION_SET_MANAGER) | Full CRUD, Activate, Deactivate, Duplicate, Export |
| Admin (QUESTION_AUTHOR) | View (để tham khảo) |
| Manager | Read Only |
| Employee | No Access |

---

## 7. UI Components

### List Page
- Table: code, name, status, question count, active version, created date
- Filter: status, category
- Actions: Edit (DRAFT) / View (ACTIVE read-only) / Duplicate / Export / Archive

### Form Page (DRAFT mode)
- Metadata: code, name, description
- Question Picker: search/filter từ Question Bank, chọn nhiều câu, reorder (lên/xuống)
- Mỗi câu hiển thị: stem rút gọn, category, difficulty, nút remove
- Preview panel: xem trước phân bổ category/difficulty
- Nút Save + Activate

### Form Page (ACTIVE mode — read-only)
- Banner: "Bộ câu hỏi đang hoạt động đã khóa snapshot"
- Toàn bộ metadata + danh sách câu hỏi ở chế độ read-only
- Nút "Tạo bản nháp chỉnh sửa" → gọi API duplicate → mở bản nháp mới
- Version history panel: danh sách version + active version hiện tại
- Preview snapshot items của active version

---

## 8. Export Formats

| Format | Thư viện | Ghi chú |
|--------|---------|---------|
| CSV | Standard | UTF-8, có/không đáp án |
| XLSX | Apache POI | Metadata sheet + Questions sheet |
| DOCX | Apache POI XWPF | Định dạng văn bản |
| PDF | Apache PDFBox | Unicode font tiếng Việt |

---

## 9. Kiểm thử

| Test | Loại | Trạng thái |
|------|------|------------|
| `QuestionSetServiceTest` (CRUD, activate snapshot, update rejected for active, duplicate uses version, export uses snapshot) | Unit | Pass |
| Manual: create set + add questions + activate | Manual | Pass |
| Manual: active set form read-only + duplicate → draft | Manual | Pass |
| Manual: export CSV/XLSX/DOCX/PDF | Manual | Pass |

---

## 10. Implementation Status

**Đã implement hoàn chỉnh** (Phase 12 + R3 cũ, 2026-07-02 đến 2026-07-03):

- Backend: `QuestionSet`, `QuestionSetItem`, `QuestionSetVersion`, `QuestionSetVersionItem`
- Versioning: activate tạo immutable snapshot, active set bị lock
- Duplicate từ active set dùng version snapshot
- Export 4 định dạng (CSV/XLSX/DOCX/PDF)
- Frontend: active set form read-only + version history + "Tạo bản nháp chỉnh sửa" CTA

### Khác biệt so với plan gốc
- Plan gốc (Phase 04 cũ) không có versioning/snapshot → đây là bổ sung quan trọng để đảm bảo tính toàn vẹn dữ liệu khi đề đã publish

---

## 11. Liên quan

| Phase | Mối quan hệ |
|-------|-------------|
| Phase 03 | Set chọn câu từ Question Bank |
| Phase 02 | Set dùng Category cho distribution |
| Phase 07 | Config tham chiếu Set làm nguồn câu hỏi để sinh đề |
