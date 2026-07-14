# Phase 04 — AI Question Generation from Documents

| Trạng thái | ĐÃ HOÀN THÀNH |
|------------|---------------|
| Ngày hoàn thành | 2026-07-02 (core) → 2026-07-04 (hardening) |
| Nhóm màn hình | A (Question Management) |
| Đáp ứng đề án | Công cụ admin để xây dựng ngân hàng câu hỏi nhanh từ tài liệu chuyên môn |

---

## 1. Phạm vi

Implement pipeline sinh câu hỏi trắc nghiệm tự động từ tài liệu chuyên môn (PDF, DOCX, TXT, MD) sử dụng DeepSeek API. Toàn bộ câu hỏi do AI sinh đều phải qua **review workflow** trước khi vào Ngân hàng câu hỏi.

Đây là **content creation tool** cho admin — không phải luồng vận hành hàng ngày.

---

## 2. Màn hình

| Màn hình | Route | Users |
|---------|-------|-------|
| Danh sách tài liệu | `/admin/evaluation/question-documents` | Admin |
| Chi tiết tài liệu | `/admin/evaluation/question-documents/:documentId` | Admin |
| Review câu hỏi AI | `/admin/evaluation/document-question-jobs/:jobId` | Admin |

---

## 3. Pipeline Flow

```
Upload Document (PDF/DOCX/TXT/MD)
        ↓
Text Extraction + Section Tree Detection
        ↓
Chunking (chia thành các đoạn nhỏ)
        ↓
Chunk Quality Gate (lọc đoạn không đạt)
        ↓
Create Generation Job (async)
        ↓
DeepSeek API: single-call per chunk → JSON (stem, A-D, correct answer, explanation, difficulty)
        ↓
Parse + Validate + Generic Stem Guard
        ↓
DocumentQuestionCandidate (NEEDS_REVIEW)
        ↓
Admin Review: Approve / Reject / Edit / Save to Bank
        ↓
Question Bank (Phase 03)
```

---

## 4. Business Rules

### Document Upload
- BR-001: Hỗ trợ PDF, DOCX, TXT, MD
- BR-002: Text extraction tự động — PDF có text layer được extract trực tiếp
- BR-003: PDF scan (không có text layer) → trạng thái `OCR_REQUIRED` (chưa có OCR engine)
- BR-004: Phát hiện section tree từ heading/formatting

### Chunking
- BR-005: Tài liệu được chia thành các chunk dựa trên section boundary + kích thước
- BR-006: Chunk quality gate loại bỏ:
  - Chunk chỉ có heading, không có nội dung
  - Chunk quá ngắn (<100 ký tự)
  - Chunk gần như trùng lặp với chunk trước đó

### Generation Job
- BR-007: Job là async — status: `CREATED` → `GENERATING` → `COMPLETED` / `PARTIAL` / `FAILED`
- BR-008: Mỗi chunk → 1 lần gọi DeepSeek, trả về JSON có cấu trúc
- BR-009: Circuit breaker + concurrency limit để tránh quá tải API
- BR-010: Worker kiểm tra trạng thái `CANCELLED` trước mỗi chunk
- BR-011: Có thể retry failed chunks

### Candidate Validation
- BR-012: Candidate phải có stem, 4 đáp án, 1 đáp án đúng
- BR-013: **Generic Stem Guard** — tự động loại bỏ câu hỏi có stem bắt đầu bằng:
  - "Theo tài liệu...", "Dựa vào tài liệu...", "Trong tài liệu..."
  - "Theo nội dung trên...", "Nhận định nào phù hợp với mục..."
- BR-014: Candidate status: `NEEDS_REVIEW` → `APPROVED` / `REJECTED` → `SAVED` (đã lưu vào bank)

### Save to Bank
- BR-015: Chỉ candidate `APPROVED` mới được lưu vào Question Bank
- BR-016: Khi save, chạy duplicate check (E5 + lexical) — block nếu trùng mạnh
- BR-017: Generic stem guard cũng chạy lại ở bước save (double safety)
- BR-018: Sau khi save, hiển thị `savedQuestionId` + link mở câu hỏi trong bank

---

## 5. Entity

| Entity | Mô tả |
|--------|-------|
| `Document` | Tài liệu nguồn: fileName, fileType, status (READY / OCR_REQUIRED / FAILED), sectionTree, chunkCount |
| `DocumentChunk` | Đoạn văn bản: content, sectionPath, chunkIndex, status, qualityFlags |
| `DocumentQuestionJob` | Phiên sinh: status (CREATED / GENERATING / COMPLETED / PARTIAL / FAILED / CANCELLED), provider, model, chunkProgress, candidateCount |
| `DocumentQuestionCandidate` | Câu hỏi ứng viên: stem, optionA-D, correctAnswer, explanation, difficulty, sourceExcerpt, chunkReference, status (NEEDS_REVIEW / APPROVED / REJECTED / SAVED), savedQuestionId, validationWarnings |

---

## 6. API

| Method | Endpoint | Mô tả | Permission |
|--------|----------|-------|------------|
| GET | `/api/v1/documents` | List documents (paginated) | canAccess |
| GET | `/api/v1/documents/{id}` | Document detail + chunks + latest job | canAccess |
| POST | `/api/v1/documents` | Upload document + start chunking | canAuthor |
| POST | `/api/v1/documents/{id}/question-jobs` | Create generation job | canAuthor |
| GET | `/api/v1/documents/{id}/question-jobs` | List jobs for document | canAccess |
| GET | `/api/v1/document-question-jobs/{id}` | Job detail + progress | canAccess |
| POST | `/api/v1/document-question-jobs/{id}/cancel` | Cancel job | canReview |
| POST | `/api/v1/document-question-jobs/{id}/retry-failed-chunks` | Retry failed chunks | canReview |
| GET | `/api/v1/document-question-candidates/{id}` | Candidate detail | canReview |
| PUT | `/api/v1/document-question-candidates/{id}` | Update + re-validate | canReview |
| POST | `/api/v1/document-question-candidates/{id}/approve` | Approve | canReview |
| POST | `/api/v1/document-question-candidates/{id}/reject` | Reject | canReview |
| POST | `/api/v1/document-question-candidates/{id}/save-as-question` | Save to bank | canReview |
| POST | `/api/v1/document-question-candidates/batch/approve` | Batch approve | canReview |
| POST | `/api/v1/document-question-candidates/batch/reject` | Batch reject | canReview |
| POST | `/api/v1/document-question-candidates/batch/save-as-questions` | Batch save | canReview |

---

## 7. Permission

| Vai trò | Quyền |
|---------|-------|
| Admin (QUESTION_AUTHOR) | Upload document, create job |
| Admin (QUESTION_REVIEWER) | Review, approve/reject, save to bank, cancel job |
| Manager | Read Only (nếu được cấp quyền) |
| Employee | No Access |

---

## 8. UI Components

### Document List Page
- Table: file name, type, status, upload date, latest job status + candidate count
- Upload button (PDF/DOCX/TXT/MD)
- Click row → Document Detail

### Document Detail Page
- Document metadata (name, type, status, upload date)
- Section tree preview
- Tab 1: Chunks — danh sách chunk với nội dung, trạng thái, quality flags
- Tab 2: Job History — danh sách các phiên sinh + trạng thái + progress
- Tab 3: Latest Job Review → navigate đến Review Page

### Review Page
- Job metadata (status, provider, model, progress)
- Filter bar: theo status (NEEDS_REVIEW / APPROVED / REJECTED / SAVED), chunk, warning
- Candidate cards: stem, A-D (đáp án đúng được highlight), explanation, difficulty, source excerpt
- Checkbox select + batch toolbar (Approve / Reject / Save to Bank)
- Nút "Hủy phiên" khi job đang GENERATING
- Polling UI tự động cập nhật khi job đang chạy
- Saved candidates hiển thị link "Mở câu hỏi" → Question Bank

---

## 9. AI Integration

### DeepSeek Configuration
- API call: single chunk → single API call
- Output format: JSON với các field stem, optionA-D, correctAnswer, explanation, difficulty
- Circuit breaker: ngắt khi có quá nhiều lỗi liên tiếp
- Concurrency limit: giới hạn số lượng call đồng thời
- Config: `ai.generation.*` trong application.yaml

### Prompt Engineering
- Prompt yêu cầu stem tự đứng độc lập (standalone)
- Cấm các mở đầu kiểu "Theo tài liệu...", "Dựa vào..."
- Yêu cầu đáp án đúng dựa trên nội dung đoạn văn (source excerpt)
- Yêu cầu giải thích ngắn gọn tại sao đáp án đúng

### Mock Fallback
- `MockDocumentQuestionGenerator` dùng khi DeepSeek API không khả dụng
- Sinh câu hỏi mẫu tiếng Việt với stem độc lập

---

## 10. Kiểm thử

| Test | Loại | Trạng thái |
|------|------|------------|
| `DocumentQuestionJobServiceTest` (job lifecycle, cancel) | Unit | Pass |
| `CandidateReviewServiceTest` (approve, reject, save, batch, save guard) | Unit | Pass |
| `DeepSeekDocumentQuestionGeneratorTest` (generic stem drop) | Unit | Pass |
| `MockDocumentQuestionGeneratorTest` (standalone stem) | Unit | Pass |
| `DocumentQuestionMapperTest` (latest job summary in response) | Unit | Pass |
| Manual: upload PDF text, tạo job, review, save | Manual | Pass |
| Manual: cancel job đang chạy | Manual | Pass |
| Manual: batch approve/save | Manual | Pass |

---

## 11. Implementation Status

**Đã implement hoàn chỉnh** (Phase 6 + R1 cũ, 2026-07-02 đến 2026-07-04):

- Toàn bộ pipeline: upload → chunking → DeepSeek → candidate → review → save
- Async job model với polling UI
- Chunk quality gate (heading-only, too-short, near-duplicate)
- Generic stem guard (parse time + save time)
- Cancel job + batch actions
- Circuit breaker / concurrency limit
- Document list hiển thị latest job summary
- `savedQuestionId` + link đến question trong bank

### Còn thiếu (→ Phase 10)
- OCR engine cho PDF scan (hiện dừng ở OCR_REQUIRED)
- Confidence UI cho OCR
- Prompt template versioning UI
- Benchmark dataset
- Export review report

---

## 12. Liên quan

| Phase | Mối quan hệ |
|-------|-------------|
| Phase 03 | Candidate được save vào Question Bank |
| Phase 05 | Paraphrase có pattern review UI tương tự |
| Phase 10 | OCR production, prompt governance |
