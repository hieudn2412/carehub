# Phase 01 — Foundation & Architecture

| Trạng thái | ĐÃ HOÀN THÀNH |
|------------|---------------|
| Ngày hoàn thành | 2026-07-02 |
| Nhóm màn hình | A (Question Management) |
| Đáp ứng đề án | Toàn bộ module (3) — Đánh giá năng lực chuyên môn |

---

## 1. Phạm vi

Phase này thiết lập nền tảng kiến trúc cho toàn bộ module Competency Test Assessment. **Không viết code** — chỉ thiết kế:

- Business Flow
- Database Model & Entity Relationship
- API Roadmap
- Permission Matrix
- Validation Rules
- Module Dependencies
- Coding Convention

Đây là phase bắt buộc trước mọi phase khác. Toàn bộ Phase 02–09 phải tuân theo các quy ước thiết lập tại đây.

---

## 2. Module Scope

Module bao gồm luồng dữ liệu chính:

```
Question Category → Question Bank → Question Set → Exam Config → Exam Paper
                                                                    ↓
                                          Notification ← Assignment ←
                                                                    ↓
                                          Dashboard ← Result ← Attempt
```

**2 luồng tạo nội dung (content creation):**

```
Document (PDF/DOCX) → AI Generation (DeepSeek) → Candidate Review → Question Bank
Question Bank → Paraphrase (VietQuill) → Candidate Review → Question Bank
```

**Không thuộc module:**
- Authentication
- Department Management
- Employee Management
- Training Hours (CME)
- Quality Inspection (Form/Checklist)

---

## 3. Core Business Objects (Entity Inventory)

Đây là danh sách entity **thực tế đã implement** trong package `questiongeneration/`:

### Question Domain
| Entity | Mô tả |
|--------|-------|
| `QuestionCategory` | Danh mục/lĩnh vực câu hỏi |
| `QuestionClassificationRule` | Quy tắc phân loại tự động (keyword, sourcePattern) |
| `Question` | Câu hỏi trong ngân hàng |
| `QuestionAnswer` | Đáp án của câu hỏi (A-D) |

### AI Generation Domain
| Entity | Mô tả |
|--------|-------|
| `Document` | Tài liệu nguồn (PDF/DOCX/TXT/MD) được upload |
| `DocumentChunk` | Đoạn văn bản đã tách từ tài liệu |
| `DocumentQuestionJob` | Phiên sinh câu hỏi từ tài liệu (async) |
| `DocumentQuestionCandidate` | Câu hỏi ứng viên do AI sinh, chờ review |

### Paraphrase Domain
| Entity | Mô tả |
|--------|-------|
| `ParaphraseJob` | Phiên tạo biến thể câu hỏi |
| `ParaphraseCandidate` | Biến thể do VietQuill sinh, chờ review |

### Question Set Domain
| Entity | Mô tả |
|--------|-------|
| `QuestionSet` | Bộ câu hỏi (template) |
| `QuestionSetItem` | Câu hỏi trong bộ |
| `QuestionSetItemSnapshot` | Snapshot câu hỏi tại thời điểm activate |
| `QuestionSetVersion` | Phiên bản bộ câu hỏi (immutable) |
| `QuestionSetVersionItem` | Câu hỏi trong phiên bản |

### Exam Domain
| Entity | Mô tả |
|--------|-------|
| `ExamConfig` | Cấu hình đề kiểm tra (blueprint) |
| `ExamConfigDistribution` | Phân bổ câu hỏi theo category/difficulty |
| `ExamPaper` | Đề kiểm tra đã sinh (có snapshot bất biến) |
| `ExamPaperQuestion` | Liên kết câu hỏi → đề |
| `ExamPaperQuestionSnapshot` | Snapshot nội dung câu hỏi trong đề |

### Assignment & Attempt Domain
| Entity | Mô tả |
|--------|-------|
| `ExamAssignment` | Phân công bài kiểm tra |
| `ExamAssignmentTarget` | Đối tượng được giao (user/department) |
| `ExamAttempt` | Lượt làm bài của nhân viên |
| `ExamAttemptAnswer` | Câu trả lời trong lượt làm |

### Cross-cutting Domain
| Entity | Mô tả |
|--------|-------|
| `EvaluationAuditLog` | Nhật ký thao tác nhạy cảm |
| `EvaluationImportJob` | Lịch sử import câu hỏi |
| `EvaluationImportJobRow` | Từng dòng import |

---

## 4. API Convention

Tất cả API tuân theo chuẩn:

```
GET    /api/v1/questions          — List (có pagination, filter, sort)
GET    /api/v1/questions/{id}     — Detail
POST   /api/v1/questions          — Create
PUT    /api/v1/questions/{id}     — Update
DELETE /api/v1/questions/{id}     — Soft delete
PATCH  /api/v1/questions/{id}/status — State transition
POST   /api/v1/questions/{id}/approve — Domain action
```

- Response wrapper: `ApiResponse<T>`
- Pagination: Spring Pageable
- Search: Spring Specification
- Validation: Jakarta Validation
- Mapper: MapStruct
- Exception: Global Exception Handler

---

## 5. Permission Matrix

8 permission codes cho module evaluation:

| Permission | Mô tả | Cấp cho |
|-----------|-------|---------|
| `QUESTION_AUTHOR` | Tạo/sửa câu hỏi, upload tài liệu, tạo job | Người xây dựng ngân hàng |
| `QUESTION_REVIEWER` | Duyệt/từ chối candidate, save vào bank | Người duyệt nội dung |
| `QUESTION_SET_MANAGER` | Quản lý bộ câu hỏi, activate/deactivate | Người tổ chức đề |
| `EXAM_CONFIG_MANAGER` | Quản lý cấu hình đề kiểm tra | Người thiết kế kỳ thi |
| `EXAM_PUBLISHER` | Sinh đề, publish, export | Người xuất bản đề |
| `ASSIGNMENT_MANAGER` | Giao bài, mở/đóng kỳ thi | Người điều phối |
| `RESULT_VIEWER` | Xem kết quả, dashboard | ĐDTK, QLBV |
| `AUDIT_VIEWER` | Xem audit log | QLBV |

Vai trò theo đề án:

| Vai trò đề án | Permission tương ứng |
|--------------|---------------------|
| Điều dưỡng viên (mobile) | Authenticated user, xem assignment + làm bài + xem kết quả cá nhân |
| Điều dưỡng trưởng khoa (mobile+PC) | RESULT_VIEWER (trong phạm vi khoa) |
| Quản lý bệnh viện (mobile+PC) | ADMIN (toàn quyền) hoặc tổ hợp các permission trên |

---

## 6. Screen Inventory

### A. Question Management (8 màn hình)
| ID | Màn hình | Route | Users |
|----|---------|-------|-------|
| — | Upload & quản lý tài liệu | `/admin/evaluation/question-documents` | Admin |
| — | Chi tiết tài liệu | `/admin/evaluation/question-documents/:id` | Admin |
| — | Review câu hỏi AI | `/admin/evaluation/document-question-jobs/:jobId` | Admin |
| — | Review paraphrase | `/admin/evaluation/paraphrase-jobs/:jobId` | Admin |
| 41 | Ngân hàng câu hỏi | `/admin/evaluation/question-bank` | Admin |
| 42 | Tạo/Chỉnh sửa câu hỏi | `/admin/evaluation/question-bank/new`, `/:id/edit` | Admin |
| 31 | Danh mục câu hỏi | `/admin/evaluation/categories` | Admin |
| — | Quy tắc phân loại | `/admin/evaluation/classification-rules` | Admin |

### B. Exam Management (6 màn hình)
| ID | Màn hình | Route | Users |
|----|---------|-------|-------|
| 39 | Bộ câu hỏi | `/admin/evaluation/question-sets` | Admin |
| 40 | Tạo/Chỉnh sửa bộ câu hỏi | `/admin/evaluation/question-sets/new`, `/:id/edit` | Admin |
| 45 | Cấu hình đề kiểm tra | `/admin/evaluation/configs` | Admin |
| — | Bộ đề kiểm tra | `/admin/evaluation/exam-papers` | Admin |
| — | Sinh đề mới | `/admin/evaluation/exam-papers/new` | Admin |
| 30 | Chi tiết bộ đề | `/admin/evaluation/exam-papers/:paperId` | Admin |

### C. Assignment & Attempt (9 màn hình)
| ID | Màn hình | Route | Users |
|----|---------|-------|-------|
| — | Danh sách phân công | `/admin/evaluation/exam-assignments` | Admin |
| — | Tạo phân công | `/admin/evaluation/exam-assignments/new` | Admin |
| — | Kết quả bài làm | `/admin/evaluation/exam-attempts` | Admin |
| 29 | Danh sách bài được giao | `/staff/exam/take` | User |
| 33 | Làm bài trắc nghiệm | `/staff/exam/take/:attemptId` | User |
| 34 | Kết quả ngay sau thi | (embedded trong take screen) | User |
| 35 | Lịch sử kết quả cá nhân | `/staff/exam/history` | User |
| 36 | Xem lại bài đã làm | (embedded trong history) | User |
| 37 | Kết quả nhân viên (manager) | `/manager/exam-results` | Manager |
| 38 | Chi tiết kết quả NV (manager) | `/manager/exam-results/detail/:id` | Manager |

### D. Monitoring & Reports (4 màn hình)
| ID | Màn hình | Route | Users |
|----|---------|-------|-------|
| — | Dashboard đánh giá | `/admin/evaluation/dashboard` | Admin, Manager |
| — | Lịch sử import | `/admin/evaluation/imports` | Admin |
| — | Audit log | `/admin/evaluation/audit-logs` | Admin |
| — | AI model health | (chưa có UI riêng) | Admin |

**Tổng: 27 màn hình đã implement**

---

## 7. Coding Convention

### Package Structure
```
vn.vietduc.carehubbackend.questiongeneration/
├── controller/      — REST endpoints, no business logic
├── service/         — Business logic only
├── repository/      — Database access only (Spring Data JPA)
├── entity/          — JPA entities
├── dto/             — Request/Response DTOs
├── mapper/          — MapStruct interfaces
├── config/          — AI model config, circuit breaker
├── security/        — EvaluationSecurity, EvaluationPermissions
└── common/          — Shared constants, enums
```

### Database Naming
- Table: `snake_case`
- PK: `id` (UUID)
- FK: `xxx_id`
- Boolean: `is_xxx`
- Timestamp: `created_at`, `updated_at`, `deleted_at`
- Soft delete: `deleted_at IS NULL`

---

## 8. Module Dependencies

```
Authentication (JWT + RBAC)
    ↓
Employee Module ──→ Department Module
    ↓
Competency Test Module (nội dung file này)
    ↓
Notification Module ──→ Dashboard Module ──→ Training Compliance
```

---

## 9. Implementation Status

Toàn bộ entity, API, và màn hình liệt kê trong Phase 01 **đã được implement** trong giai đoạn 2026-07-02 đến 2026-07-04, trải qua 14 phase phát triển (tham khảo `admin-question-evaluation-remaining-roadmap.md`).

Backend: 18 controller, 129 API endpoints trong package `questiongeneration/`.
Frontend: 29 route paths, 21 page components, 12 API modules trong `features/evaluation/` và `features/staff/`.

---

## 10. Liên quan

| Phase | Mối quan hệ |
|-------|-------------|
| Phase 02 | Category + Classification Rules — dữ liệu nền cho mọi câu hỏi |
| Phase 03 | Question Bank — nơi lưu trữ canonical |
| Phase 04 | AI Generation — tạo câu hỏi từ tài liệu |
| Phase 05 | Paraphrase — tạo biến thể câu hỏi |
| Phase 06 | Question Set — tổ chức câu hỏi thành bộ |
| Phase 07 | Exam Config & Paper — cấu hình và sinh đề |
| Phase 08 | Assignment & Attempt — giao bài và làm bài |
| Phase 09 | Dashboard, Audit & Permissions — giám sát và bảo mật |
| Phase 10 | Remaining Work — những gì còn phải làm |
