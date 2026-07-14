# Phase 05 — Paraphrase & Variant Generation

| Trạng thái | ĐÃ HOÀN THÀNH |
|------------|---------------|
| Ngày hoàn thành | 2026-07-02 (core) → 2026-07-04 (batch hardening) |
| Nhóm màn hình | A (Question Management) |
| Đáp ứng đề án | Công cụ admin để đa dạng hóa ngân hàng câu hỏi, tạo nhiều biến thể cho cùng một kiến thức |

---

## 1. Phạm vi

Implement công cụ tạo biến thể câu hỏi (paraphrase) sử dụng mô hình VietQuill T5. Cho phép admin tạo nhiều phiên bản khác nhau của cùng một câu hỏi — giữ nguyên ý nghĩa chuyên môn nhưng thay đổi cách diễn đạt. Tất cả biến thể phải qua **review workflow** trước khi vào Ngân hàng câu hỏi.

---

## 2. Màn hình

| Màn hình | Route | Users |
|---------|-------|-------|
| Review paraphrase | `/admin/evaluation/paraphrase-jobs/:jobId` | Admin |
| Ngân hàng câu hỏi (batch actions) | `/admin/evaluation/question-bank` | Admin |

---

## 3. Paraphrase Flow

```
Question Bank (APPROVED questions)
        ↓
Select question(s) → Configure (count, change strength)
        ↓
Create Paraphrase Job(s) (async)
        ↓
VietQuill T5 Model: paraphrase stem + all 4 options
        ↓
Validate: protected terms preserved, option structure intact
        ↓
E5 Similarity Check (với câu gốc + duplicate với bank)
        ↓
ParaphraseCandidate (NEEDS_REVIEW)
        ↓
Admin Review: Approve / Reject / Edit / Save to Bank
        ↓
Question Bank (new variant, saved as independent question)
```

---

## 4. Business Rules

### Source Rules
- BR-001: Chỉ paraphrase từ câu hỏi đã `APPROVED` (canonical)
- BR-002: Không paraphrase từ câu `DRAFT` hoặc `ARCHIVED`
- BR-003: Một câu hỏi có thể có nhiều paraphrase jobs (lịch sử)

### Paraphrase Rules
- BR-004: Paraphrase **cả stem và 4 đáp án** (optionA-D)
- BR-005: Giữ nguyên `correctAnswer` label (A/B/C/D)
- BR-006: Bảo vệ thuật ngữ chuyên môn (protected terms)
- BR-007: Giữ nguyên số liệu, đơn vị đo, tên thuốc
- BR-008: E5 similarity với câu gốc phải trong ngưỡng cho phép (không quá giống, không quá khác)
- BR-009: E5 duplicate check với toàn bộ bank — block nếu strong duplicate

### Save Rules
- BR-010: Chỉ candidate `APPROVED` mới được lưu
- BR-011: Biến thể được lưu thành câu hỏi độc lập trong bank (không ghi đè câu gốc)
- BR-012: Biến thể được đánh dấu là paraphrase của câu gốc (có reference)

---

## 5. Entity

| Entity | Mô tả |
|--------|-------|
| `ParaphraseJob` | Phiên paraphrase: sourceQuestionId, provider (VIETQUILL / MOCK), model, requestedCount, changeStrength, status |
| `ParaphraseCandidate` | Biến thể: stem, optionA-D, correctAnswer, explanation (giữ nguyên từ gốc), difficulty (giữ nguyên), status (NEEDS_REVIEW / APPROVED / REJECTED / SAVED), savedQuestionId, e5SourceSimilarity, e5MaxDuplicateScore |

---

## 6. API

| Method | Endpoint | Mô tả | Permission |
|--------|----------|-------|------------|
| POST | `/api/v1/questions/{id}/paraphrase-jobs` | Create job cho 1 câu | canAuthor |
| POST | `/api/v1/paraphrase-jobs/batch` | Batch create jobs (nhiều câu) | canAuthor |
| GET | `/api/v1/questions/{id}/paraphrase-jobs` | List jobs của 1 câu | canAccess |
| GET | `/api/v1/paraphrase-jobs/{id}` | Job detail + candidates | canAccess |
| GET | `/api/v1/paraphrase-candidates/{id}` | Candidate detail | canReview |
| PATCH | `/api/v1/paraphrase-candidates/{id}` | Update candidate | canReview |
| POST | `/api/v1/paraphrase-candidates/{id}/approve` | Approve | canReview |
| POST | `/api/v1/paraphrase-candidates/{id}/reject` | Reject | canReview |
| POST | `/api/v1/paraphrase-candidates/{id}/save-as-question` | Save to bank | canReview |
| POST | `/api/v1/paraphrase-candidates/batch/approve` | Batch approve | canReview |
| POST | `/api/v1/paraphrase-candidates/batch/reject` | Batch reject | canReview |
| POST | `/api/v1/paraphrase-candidates/batch/save-as-questions` | Batch save | canReview |

### Batch Request Example
```json
POST /api/v1/paraphrase-jobs/batch
{
  "questionIds": ["uuid-1", "uuid-2", "uuid-3"],
  "requestedCount": 2,
  "changeStrength": "MEDIUM"
}
```

---

## 7. Permission

| Vai trò | Quyền |
|---------|-------|
| Admin (QUESTION_AUTHOR) | Create paraphrase jobs |
| Admin (QUESTION_REVIEWER) | Review, approve/reject, save |
| Manager | Read Only |
| Employee | No Access |

---

## 8. UI Components

### Question Bank (Batch Action)
- Checkbox select trên `QuestionBankListPage`
- Nút "Tạo biến thể" → Modal: chọn số lượng biến thể + mức thay đổi
- Chỉ active khi tất cả câu được chọn đều APPROVED

### Review Page
- Layout tương tự Document Review (Phase 04): filter bar + candidate cards + batch toolbar
- Mỗi candidate card hiển thị:
  - **Câu gốc** (read-only, để so sánh)
  - **Biến thể** (có thể edit trước khi approve)
  - E5 similarity score với câu gốc
  - E5 max duplicate score với bank
  - Nút Approve / Reject / Save
- Batch: chọn nhiều → Approve / Reject / Save to Bank

---

## 9. VietQuill Integration

- **Model**: `ngwgsang/vietquill-vit5-base-tsubaki` (T5-based Vietnamese paraphraser)
- **Runtime**: Local ONNX hoặc mock provider
- **Input**: stem + optionA-D từ câu gốc
- **Output**: stem mới + optionA-D mới (giữ nguyên correct answer label)
- **Health endpoint**: `/api/v1/ai-model-runtime/status`
- **Config**: `ai.paraphrase.*` trong application.yaml

---

## 10. Kiểm thử

| Test | Loại | Trạng thái |
|------|------|------------|
| `ParaphraseServiceTest` (batch create, batch approve, error reporting, save guard) | Unit | Pass |
| Manual: tạo paraphrase job từ 1 câu | Manual | Pass |
| Manual: batch tạo biến thể từ nhiều câu | Manual | Pass |
| Manual: review + approve + save | Manual | Pass |
| Manual: E5 duplicate block khi save | Manual | Pass |

---

## 11. Implementation Status

**Đã implement hoàn chỉnh** (Phase 7 cũ, 2026-07-02 đến 2026-07-04):

- VietQuill integration: paraphrase stem + 4 options
- Batch create jobs từ nhiều câu hỏi
- Batch approve/reject/save candidates
- Guard: chỉ từ APPROVED canonical questions
- E5 duplicate check trước khi save
- Mock provider fallback
- AI model runtime health endpoint

### Còn thiếu (→ Phase 10)
- UI lịch sử paraphrase dạng drawer trong từng câu hỏi
- Visual diff highlighting stem/options giữa gốc và biến thể
- Server-side pagination cho danh sách candidate lớn
- Batch job cha (gom nhiều source question trong 1 màn quản trị)

---

## 12. Liên quan

| Phase | Mối quan hệ |
|-------|-------------|
| Phase 03 | Paraphrase đọc từ và lưu vào Question Bank |
| Phase 04 | Pattern review UI tương tự (candidate → review → save) |
| Phase 10 | Paraphrase history drawer, visual diff |
