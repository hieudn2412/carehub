# Phase 03 — Question Bank

| Trạng thái | ĐÃ HOÀN THÀNH |
|------------|---------------|
| Ngày hoàn thành | 2026-07-02 (core) → 2026-07-04 (hardening) |
| Nhóm màn hình | A (Question Management) |
| Đáp ứng đề án | Dòng 162: "Cập nhật, chỉnh sửa, bổ sung ngân hàng câu hỏi thi trắc nghiệm đánh giá kiến thức chuyên môn" |

---

## 1. Phạm vi

Implement Ngân hàng câu hỏi (Question Bank) — nơi lưu trữ tập trung toàn bộ câu hỏi trắc nghiệm đánh giá năng lực điều dưỡng. Đây là **single source of truth** — mọi đề thi đều lấy câu hỏi từ đây. Hỗ trợ:

- CRUD câu hỏi Multiple Choice (4 đáp án A-D)
- Duplicate detection (E5 semantic + lexical)
- Impact warning (cảnh báo khi sửa/xóa câu đang dùng)
- Import/Export Excel (nền tảng cho dữ liệu bệnh viện)
- Status lifecycle đầy đủ

---

## 2. Màn hình

| ID | Màn hình | Route | Users |
|----|---------|-------|-------|
| 41 | Ngân hàng câu hỏi | `/admin/evaluation/question-bank` | Admin |
| 42 | Tạo câu hỏi mới | `/admin/evaluation/question-bank/new` | Admin |
| 42 | Chỉnh sửa câu hỏi | `/admin/evaluation/question-bank/:id/edit` | Admin |

---

## 3. Question Types

**Current Release:** Multiple Choice (Single Choice — 1 đáp án đúng trong 4 đáp án)

**Future Release (Phase 10):** Multiple Choice (Multiple Correct), True/False, Essay, Matching, Ordering, Fill Blank, Case Study

---

## 4. Business Rules

### Core
- BR-001: Question phải thuộc một Category (Phase 02)
- BR-002: Question Content (stem) bắt buộc, max 5000 ký tự
- BR-003: Có đúng 4 đáp án A, B, C, D
- BR-004: Có đúng 1 đáp án đúng (correctAnswer ∈ {A, B, C, D})
- BR-005: Các đáp án không được trùng nội dung
- BR-006: Difficulty bắt buộc: `EASY` / `MEDIUM` / `HARD`
- BR-007: Explanation (giải thích) optional

### Status Lifecycle
```
DRAFT → APPROVED → ARCHIVED
  ↓         ↓
  └── có thể quay lại DRAFT để sửa
```
- BR-008: `DRAFT` — đang soạn, không dùng được cho Set
- BR-009: `APPROVED` — đã duyệt, dùng được cho Set và sinh đề
- BR-010: `ARCHIVED` — đã lưu trữ, không xuất hiện trong Set mới nhưng vẫn tồn tại trong snapshot cũ

### Duplicate Detection
- BR-011: Khi Create/Update, chạy E5 semantic duplicate check
- BR-012: Nếu phát hiện strong duplicate → block (trừ khi import với chế độ khác)
- BR-013: E5 embedding được refresh mỗi khi stem thay đổi

### Impact Warning
- BR-014: Nếu Question đang nằm trong Active Question Set → hiển thị cảnh báo, không cho archive
- BR-015: Nếu Question đang nằm trong Published Exam Paper → hiển thị cảnh báo, không cho archive/deactivate
- BR-016: Không hard delete câu hỏi đã có trong snapshot

---

## 5. Entity

### Question
| Field | Type | Mô tả |
|-------|------|-------|
| id | UUID | PK |
| questionCode | String(20) | Mã câu hỏi, unique |
| categoryId | UUID → QuestionCategory | Danh mục |
| stem | Text(5000) | Nội dung câu hỏi |
| explanation | Text | Giải thích đáp án |
| difficulty | Enum | EASY / MEDIUM / HARD |
| status | Enum | DRAFT / APPROVED / ARCHIVED |
| language | Enum | VI / EN |
| sourceDocument | String | Tài liệu nguồn (nếu từ AI generation) |
| imageUrl | String | Ảnh đính kèm (optional) |
| embedding | float[] | E5 embedding vector (384 dimensions) |
| createdBy, updatedBy, reviewedBy | String | Audit |
| createdAt, updatedAt, reviewedAt, deletedAt | Timestamp | Audit |

### QuestionAnswer
| Field | Type | Mô tả |
|-------|------|-------|
| id | UUID | PK |
| questionId | UUID → Question | FK |
| label | String(1) | A / B / C / D |
| content | Text | Nội dung đáp án |
| displayOrder | Integer | Thứ tự hiển thị (1-4) |

---

## 6. API

| Method | Endpoint | Mô tả | Permission |
|--------|----------|-------|------------|
| GET | `/api/v1/questions` | List (q, status, category, difficulty filter) | canAccess |
| GET | `/api/v1/questions/{id}` | Detail + impact warning | canAccess |
| POST | `/api/v1/questions` | Create | canAuthor |
| PUT | `/api/v1/questions/{id}` | Update + re-embed | canAuthor |
| POST | `/api/v1/questions/{id}/approve` | Approve (DRAFT → APPROVED) | canReview |
| POST | `/api/v1/questions/{id}/deactivate` | Deactivate | canAuthor |
| DELETE | `/api/v1/questions/{id}` | Soft archive | canAuthor |
| GET | `/api/v1/questions/export` | Export XLSX | canAccess |
| GET | `/api/v1/questions/import/template` | Download template XLSX | canAuthor |
| POST | `/api/v1/questions/import/preview` | Preview import file | canAuthor |
| POST | `/api/v1/questions/import/commit` | Commit import | canAuthor |

---

## 7. Embedding & Duplicate Detection

- **E5 Embedding Model**: `intfloat/multilingual-e5-small` qua ONNX Runtime
- **Dimension**: 384
- **Trigger**: mỗi khi Create/Update/Approve câu hỏi → refresh embedding
- **Backfill**: `POST /api/v1/question-embeddings/backfill` cho câu hỏi cũ chưa có embedding
- **Duplicate Check**: E5 cosine similarity (primary) + lexical fallback (secondary)
- **Config**: `ai.embedding.*` trong application.yaml

---

## 8. Import/Export

### Export
- Format: XLSX
- Columns: stem, optionA-D, correctAnswer, explanation, topic, difficulty, language, sourceDocument, status
- Filter: hỗ trợ `q` và `status`

### Import
- Format: XLSX / XLS / CSV / DOCX
- Flow: Upload → Preview (validate) → Commit (persist)
- Column mapping động: UI chọn cột nguồn → canonical field
- Template download: file XLSX với header + dòng mẫu tiếng Việt + sheet hướng dẫn
- Duplicate handling modes:
  - `BLOCK`: chặn dòng trùng (mặc định)
  - `SKIP_DUPLICATES`: bỏ qua, tính vào skippedCount
  - `IMPORT_DUPLICATES_AS_DRAFT`: lưu thành DRAFT để review sau

---

## 9. Permission

| Vai trò | Quyền |
|---------|-------|
| Admin (QUESTION_AUTHOR) | Create, Update, Deactivate, Archive, Import |
| Admin (QUESTION_REVIEWER) | Approve, View all |
| Admin (QUESTION_SET_MANAGER) | View (để chọn câu vào set) |
| Manager | Read Only |
| Employee | No Access |

---

## 10. UI Components

- Question Table + Search + Filter (Category, Difficulty, Status) + Pagination
- Create/Edit Form: stem, A-D options, correct answer selector, explanation, difficulty, category dropdown, source doc
- Impact Warning banner khi câu hỏi đang được sử dụng
- Import Modal: upload file → preview 20 dòng → mapping cột → commit
- Export button (XLSX)
- Batch actions: chọn nhiều câu → Tạo biến thể (Phase 05)
- Detail drawer/modal: xem đầy đủ nội dung + source + audit info

---

## 11. Kiểm thử

| Test | Loại | Trạng thái |
|------|------|------------|
| `QuestionBankServiceTest` (CRUD, impact warning, archive guard) | Unit | Pass |
| `QuestionBankImportExportServiceTest` (import preview, commit, template, column mapping, DOCX, duplicate modes) | Unit | Pass |
| `CandidateReviewServiceTest` (save guard) | Unit | Pass |
| Manual: create/edit/archive/approve question | Manual | Pass |
| Manual: import Excel với cột mapping động | Manual | Pass |

---

## 12. Implementation Status

**Đã implement hoàn chỉnh** (Phase 1 + Phase 8 + Phase 14 + R2 cũ, 2026-07-02 đến 2026-07-04):

- Backend: `Question` + `QuestionAnswer` entities, đầy đủ CRUD + approve/deactivate/archive
- `DuplicateCheckService` với E5 semantic + lexical fallback
- `QuestionEmbeddingService` qua ONNX Runtime
- Impact warning system: block archive/deactivate khi question đang dùng
- Import/Export pipeline hoàn chỉnh (preview, commit, template, column mapping, DOCX, duplicate modes)
- Frontend: tất cả form/list đã dùng API thật, không còn localStorage

---

## 13. Map với đề án bệnh viện

| Yêu cầu đề án | Được đáp ứng bởi |
|--------------|-----------------|
| "Cập nhật, chỉnh sửa, bổ sung ngân hàng câu hỏi" (dòng 162) | CRUD + Import/Export |
| "Thay đổi được cấu trúc đề thi: số lượng câu hỏi, tỷ lệ theo lĩnh vực, tỷ lệ theo độ khó" (dòng 162) | Difficulty + Category làm input cho ExamConfig (Phase 07) |
| "Thi trắc nghiệm" (dòng 102) | Multiple Choice 4 đáp án |

---

## 14. Liên quan

| Phase | Mối quan hệ |
|-------|-------------|
| Phase 02 | Mọi Question phải có Category từ Phase 02 |
| Phase 04 | AI candidate được save vào Question Bank |
| Phase 05 | Paraphrase tạo biến thể từ Question Bank |
| Phase 06 | Set chọn câu từ Question Bank |
| Phase 07 | Paper snapshot từ Question Bank |
| Phase 09 | Import history + Dashboard thống kê ngân hàng |
