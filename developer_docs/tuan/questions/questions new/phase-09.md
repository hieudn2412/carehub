# Phase 09 — Dashboard, Audit, Permissions & Import/Export

| Trạng thái | ĐÃ HOÀN THÀNH |
|------------|---------------|
| Ngày hoàn thành | 2026-07-02 đến 2026-07-04 |
| Nhóm màn hình | D (Monitoring & Reports) |
| Đáp ứng đề án | Dòng 103-107 (ĐDV xem điểm + phân loại); Dòng 127-131 (Manager analytics); Dòng 133, 165 (Dashboard); Dòng 161 (phân loại năng lực) |

---

## 1. Phạm vi

Phase này gom 4 cross-cutting concerns phục vụ **giám sát, bảo mật, và vận hành**:

- **Dashboard & Analytics** — thống kê ngân hàng câu hỏi, kết quả kiểm tra, item analysis
- **Audit Log** — ghi nhận mọi thao tác nhạy cảm
- **Granular Permissions** — 8 permission codes, JWT claims, frontend hide/show
- **Import/Export History** — lịch sử import, error file, template management

---

## 2. Màn hình

| Màn hình | Route | Users |
|---------|-------|-------|
| Dashboard đánh giá | `/admin/evaluation/dashboard` | Admin, Manager |
| Audit log | `/admin/evaluation/audit-logs` | Admin |
| Lịch sử import | `/admin/evaluation/imports` | Admin |

---

## 3. Dashboard & Analytics

### 3.1 API

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/v1/evaluation-dashboard` | Tổng quan |
| GET | `/api/v1/evaluation-dashboard/question-bank-summary` | Thống kê ngân hàng câu hỏi |
| GET | `/api/v1/evaluation-dashboard/exam-results-summary` | Thống kê kết quả kiểm tra |
| GET | `/api/v1/evaluation-dashboard/question-item-analysis` | Phân tích từng câu hỏi |

### 3.2 Metrics

**Ngân hàng câu hỏi:**
- Tổng số câu hỏi, phân bổ theo status (APPROVED / DRAFT / REJECTED / ARCHIVED)
- Số câu gốc vs paraphrase
- Distribution theo difficulty (EASY / MEDIUM / HARD)
- Distribution theo topic/category
- Distribution theo source document

**Kết quả kiểm tra:**
- Tổng số lượt làm, đang làm, đã chấm, quá hạn
- Số lượt đạt / không đạt
- Điểm trung bình, tỷ lệ đạt
- Thời gian làm bài trung bình

**Item Analysis:**
- Top 50 câu hỏi có dữ liệu attempt
- Mỗi câu: số lượt làm, số đúng, số sai, tỷ lệ đúng
- Dùng để phát hiện câu hỏi quá khó / quá dễ / có vấn đề

### 3.3 UI
- Metric cards (4-6 cards: tổng câu hỏi, tỷ lệ đạt, điểm TB, số lượt làm)
- Bar chart: distribution theo difficulty, theo category
- Table: câu hỏi có tỷ lệ đúng thấp nhất (cần review)

### 3.4 Map với đề án

| Yêu cầu đề án | Dashboard component |
|--------------|-------------------|
| "Xem được điểm đánh giá kiến thức và mức phân loại theo các lĩnh vực" (dòng 103) | Item analysis + category distribution |
| "Xem được điểm trung bình đánh giá kiến thức chuyên môn từ đầu năm" (dòng 104) | Exam results summary (có thể filter thời gian) |
| Manager: "Bảng danh sách... trung bình điểm kiểm tra kiến thức" (dòng 131) | Results table per department |
| "Dashboard hiển thị các chỉ số chung toàn khoa" (dòng 133) | Manager dashboard view |
| "Dashboard hiển thị các chỉ số chung toàn khoa và toàn bệnh viện" (dòng 165) | Admin dashboard view |

---

## 4. Audit Log

### 4.1 Entity
| Field | Type | Mô tả |
|-------|------|-------|
| id | UUID | PK |
| action | String(50) | Loại thao tác |
| entityType | String(50) | Loại entity bị tác động |
| entityId | String | ID của entity |
| actor | String | Người thực hiện |
| summary | String(500) | Mô tả ngắn |
| detailJson | Text | Metadata JSON (không chứa secret/full content) |
| createdAt | Timestamp | Thời điểm |

### 4.2 Các action được audit (18+ loại)
```
DOCUMENT_UPLOAD, JOB_CREATE, JOB_RETRY, JOB_CANCEL,
CANDIDATE_UPDATE, CANDIDATE_APPROVE, CANDIDATE_REJECT, CANDIDATE_SAVE,
CANDIDATE_BATCH_APPROVE, CANDIDATE_BATCH_REJECT, CANDIDATE_BATCH_SAVE,
QUESTION_CREATE, QUESTION_UPDATE, QUESTION_APPROVE, QUESTION_DEACTIVATE, QUESTION_ARCHIVE,
QUESTION_IMPORT, QUESTION_EXPORT,
CATEGORY_CREATE, CATEGORY_UPDATE, CATEGORY_ARCHIVE,
RULE_CREATE, RULE_UPDATE, RULE_DISABLE,
PARAPHRASE_JOB_CREATE, PARAPHRASE_JOB_BATCH,
PARAPHRASE_CANDIDATE_APPROVE, PARAPHRASE_CANDIDATE_REJECT, PARAPHRASE_CANDIDATE_SAVE,
PARAPHRASE_CANDIDATE_BATCH_APPROVE, PARAPHRASE_CANDIDATE_BATCH_REJECT, PARAPHRASE_CANDIDATE_BATCH_SAVE,
QUESTION_SET_CREATE, QUESTION_SET_UPDATE, QUESTION_SET_ACTIVATE, QUESTION_SET_ARCHIVE,
QUESTION_SET_DUPLICATE, QUESTION_SET_EXPORT,
EXAM_CONFIG_CREATE, EXAM_CONFIG_UPDATE, EXAM_CONFIG_ACTIVATE, EXAM_CONFIG_ARCHIVE,
EXAM_PAPER_GENERATE, EXAM_PAPER_PUBLISH, EXAM_PAPER_ARCHIVE, EXAM_PAPER_DUPLICATE, EXAM_PAPER_EXPORT,
ASSIGNMENT_CREATE, ASSIGNMENT_OPEN, ASSIGNMENT_CLOSE, ASSIGNMENT_ARCHIVE,
ASSIGNMENT_RESULT_EXPORT
```

### 4.3 API
| Method | Endpoint | Mô tả | Permission |
|--------|----------|-------|------------|
| GET | `/api/v1/evaluation-audit-logs` | List (q, action, entityType, actor filter) | canViewAudit |
| GET | `/api/v1/evaluation-audit-logs/{id}` | Detail (kèm detailJson) | canViewAudit |

### 4.4 UI
- Filter bar: từ khóa, action, entity type, actor, khoảng thời gian
- Table: thời gian, người thao tác, hành động, đối tượng, mô tả
- Detail drawer: summary + detailJson format dễ đọc + link đến entity gốc (nếu còn tồn tại)

### 4.5 Nguyên tắc
- **Không lưu**: API key, full prompt, full document chunk, toàn bộ đáp án
- **Có lưu**: entity ID, status cũ/mới, counts, reason, file name, model/prompt version

---

## 5. Granular Permissions

### 5.1 Permission Codes
| Permission | Mô tả | Bảo vệ |
|-----------|-------|--------|
| `QUESTION_AUTHOR` | Tạo/sửa câu hỏi, upload tài liệu, tạo job | QuestionBank create/update, Document upload, Job create |
| `QUESTION_REVIEWER` | Duyệt/từ chối candidate, save | Candidate approve/reject/save, Question approve |
| `QUESTION_SET_MANAGER` | Quản lý bộ câu hỏi | QuestionSet CRUD, activate/deactivate |
| `EXAM_CONFIG_MANAGER` | Quản lý cấu hình đề | ExamConfig CRUD, activate/deactivate |
| `EXAM_PUBLISHER` | Sinh đề, publish, export | ExamPaper generate, publish, export |
| `ASSIGNMENT_MANAGER` | Giao bài, mở/đóng | ExamAssignment CRUD, open/close |
| `RESULT_VIEWER` | Xem kết quả, dashboard | ExamAttempt list, Dashboard |
| `AUDIT_VIEWER` | Xem audit log | AuditLog list/detail |

### 5.2 Implementation
- JWT access token chứa claim `permissions` (từ `role_permissions` table)
- `CustomJwtAuthenticationConverter` map claim → Spring Security GrantedAuthorities
- `ROLE_ADMIN` có toàn quyền (fallback)
- Controllers dùng `@evaluationSecurity` thay vì `hasRole('ADMIN')` cứng
- Frontend: `ProtectedRoute` hỗ trợ `allowedPermissions`, `AdminSidebar` ẩn/hiện menu item theo permission
- Permission enforcement là **backend-first** — frontend chỉ hide UX, backend mới là authority

---

## 6. Import/Export History

### 6.1 Entity
| Entity | Mô tả |
|--------|-------|
| `EvaluationImportJob` | Lịch sử import: fileName, importType, status (PREVIEWED / COMMITTED / FAILED), totalRows, successRows, errorRows, skippedRows, duplicateHandlingMode |
| `EvaluationImportJobRow` | Từng dòng import: rowNumber, stem, status, result, errors |

### 6.2 API
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/v1/evaluation-imports` | List (q, status, importType filter) |
| GET | `/api/v1/evaluation-imports/{id}` | Detail + rows |
| GET | `/api/v1/evaluation-imports/{id}/error-file` | Tải file lỗi XLSX |

### 6.3 UI
- Table: file name, type, status, rows (total/success/error/skipped), date
- Detail panel: danh sách từng dòng với trạng thái + lỗi
- Nút "Tải file lỗi" cho các dòng bị fail/skip

---

## 7. Permission

| Vai trò | Quyền |
|---------|-------|
| Admin (RESULT_VIEWER, QUESTION_REVIEWER, QUESTION_SET_MANAGER, EXAM_PUBLISHER) | Dashboard |
| Admin (AUDIT_VIEWER) | Audit log |
| Admin (QUESTION_AUTHOR, QUESTION_REVIEWER) | Import history |
| Manager | Dashboard (phạm vi khoa), Audit log (nếu được cấp) |

---

## 8. Kiểm thử

| Test | Loại | Trạng thái |
|------|------|------------|
| `EvaluationDashboardServiceTest` | Unit | Pass |
| `EvaluationAuditLogServiceTest` | Unit | Pass |
| `EvaluationSecurityTest` | Unit | Pass |
| `QuestionBankImportExportServiceTest` (template, preview, commit, duplicate modes) | Unit | Pass |
| `EvaluationImportHistoryServiceTest` (history, error file) | Unit | Pass |
| Manual: dashboard hiển thị đúng số liệu sau khi có attempts | Manual | Pass |
| Manual: audit log ghi nhận thao tác | Manual | Pass |
| Manual: sidebar ẩn/hiện theo permission | Manual | Pass |

---

## 9. Implementation Status

**Đã implement hoàn chỉnh** (Phase 8 + 9 + 10 + 11 + 14 cũ):

### Dashboard
- 4 API endpoints (summary, bank, results, item analysis)
- Frontend: metric cards + distribution bars + item analysis table

### Audit Log
- 18+ action types được audit
- Entity + API + frontend page với filter + detail panel
- Metadata-only (không lộ secret)

### Permissions
- 8 permission codes trong JWT
- Backend: `@evaluationSecurity` trên controller
- Frontend: route protection + sidebar hide/show

### Import/Export History
- `EvaluationImportJob` + `EvaluationImportJobRow`
- History page + detail + error file download
- Tích hợp với question bank import (Phase 03)

---

## 10. Còn thiếu (→ Phase 10)

- **Dashboard**: filter theo thời gian/config/paper/assignment/department; drilldown từ dashboard → detail; discrimination index; export báo cáo analytics
- **Audit**: before/after diff; server-side pagination; audit export answer key detail
- **Permissions**: UI quản trị role-permission; button-level hide/disable trong từng page; MockMvc security tests
- **Competency Classification Engine**: 5 mức (NOT_COMPETENT → EXPERT), configurable thresholds, tích hợp điểm kiến thức + kỹ năng

---

## 11. Map với đề án bệnh viện

| Yêu cầu đề án | Được đáp ứng bởi |
|--------------|-----------------|
| "Xem được điểm đánh giá kiến thức và mức phân loại theo các lĩnh vực" (dòng 103) | Dashboard item analysis + category distribution |
| "Xem được điểm trung bình đánh giá kiến thức từ đầu năm" (dòng 104) | Exam results summary |
| Manager: xem theo lĩnh vực, cá nhân, kỹ thuật (dòng 127-131) | Dashboard per department + Manager Results |
| "Dashboard hiển thị các chỉ số chung toàn khoa" (dòng 133) | Manager dashboard |
| "Dashboard hiển thị các chỉ số chung toàn khoa và toàn bệnh viện" (dòng 165) | Admin dashboard |
| "Thay đổi được mức điểm để phân loại" (dòng 161) | → Phase 10 (Competency Classification) |

---

## 12. Liên quan

| Phase | Mối quan hệ |
|-------|-------------|
| Phase 03 | Import/Export history liên kết với Question Bank import |
| Phase 08 | Dashboard aggregate từ Attempt data |
| Phase 10 | Competency Classification Engine, advanced analytics |
