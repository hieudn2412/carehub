# Kế hoạch thiết kế frontend UI upload/review câu hỏi từ tài liệu

> Tài liệu triển khai cho frontend CareHub  
> Ngày tạo: 30/06/2026  
> Phạm vi: thiết kế UI và contract frontend cho MVP tạo câu hỏi từ tài liệu  
> Trạng thái: đặc tả để implement, chưa phải source code

---

## 1. Mục tiêu

Tạo một hub riêng trong khu vực quản trị để admin tải tài liệu, xem trạng thái xử lý, tạo phiên sinh câu hỏi, review câu hỏi AI đề xuất và lưu câu hỏi đã duyệt vào ngân hàng câu hỏi.

Tên khu vực UI:

```text
Tạo câu hỏi từ tài liệu
```

Route chính:

```text
/admin/evaluation/question-documents
```

Nguyên tắc chính:

- Không nhồi luồng upload/review vào trang `Ngân hàng câu hỏi` hiện tại.
- Không hiển thị enum thô như `OCR_REQUIRED`, `NEED_REVIEW`, `VALIDATED` cho người dùng.
- Toàn bộ text giao diện dùng tiếng Việt.
- UI phải cho reviewer thấy nguồn/evidence trước khi duyệt.
- Candidate AI không được lưu vào ngân hàng câu hỏi nếu chưa được duyệt.

---

## 2. Vị trí trong navigation

Frontend cần thêm một nhóm hoặc mục navigation trong khu vực đánh giá.

Nếu sidebar hiện tại chưa có nhóm `ĐÁNH GIÁ`, thêm nhóm mới sau `CHẤT LƯỢNG` và trước `DASHBOARD & BÁO CÁO`:

```text
ĐÁNH GIÁ
├─ Tạo câu hỏi từ tài liệu
├─ Ngân hàng câu hỏi
├─ Bộ câu hỏi
├─ Danh mục câu hỏi
├─ Quy tắc phân loại
└─ Cấu hình đề kiểm tra
```

Nếu không muốn gom lại toàn bộ evaluation route ngay, tối thiểu thêm mục:

```text
Tạo câu hỏi từ tài liệu → /admin/evaluation/question-documents
```

Icon gợi ý:

- `FileAddOutlined`, `FileSearchOutlined`, hoặc `AuditOutlined` từ `@ant-design/icons`.

Route cần thêm:

```text
/admin/evaluation/question-documents
/admin/evaluation/question-documents/:documentId
/admin/evaluation/document-question-jobs/:jobId
```

Breadcrumb:

```text
Đánh giá > Tạo câu hỏi từ tài liệu
Đánh giá > Tạo câu hỏi từ tài liệu > Chi tiết tài liệu
Đánh giá > Tạo câu hỏi từ tài liệu > Review phiên tạo
```

---

## 3. API frontend cần bọc

Tạo module:

```text
src/features/evaluation/api/documentQuestionApi.js
```

Module này dùng `httpClient` hiện có.

### 3.1. API functions

```js
export const documentQuestionApi = {
  listDocuments(params),
  getDocument(documentId),
  uploadDocument(file),
  createQuestionJob(documentId, payload),
  getQuestionJob(jobId),
  retryFailedChunks(jobId),
  getCandidate(candidateId),
  updateCandidate(candidateId, payload),
  approveCandidate(candidateId, reviewerNotes),
  rejectCandidate(candidateId, reviewerNotes),
  saveCandidateAsQuestion(candidateId),
}
```

### 3.2. Endpoint mapping

| Function | Method | Endpoint |
|---|---:|---|
| `listDocuments` | GET | `/documents` |
| `getDocument` | GET | `/documents/{documentId}` |
| `uploadDocument` | POST multipart | `/documents` |
| `createQuestionJob` | POST | `/documents/{documentId}/question-jobs` |
| `getQuestionJob` | GET | `/document-question-jobs/{jobId}` |
| `retryFailedChunks` | POST | `/document-question-jobs/{jobId}/retry-failed-chunks` |
| `getCandidate` | GET | `/document-question-candidates/{candidateId}` |
| `updateCandidate` | PUT | `/document-question-candidates/{candidateId}` |
| `approveCandidate` | POST | `/document-question-candidates/{candidateId}/approve` |
| `rejectCandidate` | POST | `/document-question-candidates/{candidateId}/reject` |
| `saveCandidateAsQuestion` | POST | `/document-question-candidates/{candidateId}/save-as-question` |

Upload bắt buộc dùng multipart field:

```text
file
```

Create job payload:

```json
{
  "questionsPerChunk": 3
}
```

Update candidate payload:

```json
{
  "stem": "Câu hỏi",
  "optionA": "Phương án A",
  "optionB": "Phương án B",
  "optionC": "Phương án C",
  "optionD": "Phương án D",
  "correctAnswer": "A",
  "explanation": "Giải thích",
  "difficulty": "easy",
  "topic": "Chủ đề",
  "sourceExcerpt": "Trích dẫn nguồn",
  "reviewerNotes": "Ghi chú reviewer"
}
```

Approve/reject payload:

```json
{
  "reviewerNotes": "Ghi chú nếu có"
}
```

### 3.3. Backend cần bổ sung sau nếu muốn lịch sử job theo tài liệu

Backend hiện có API xem job theo `jobId`, nhưng UI chi tiết tài liệu sẽ tiện hơn nếu có endpoint:

```text
GET /api/v1/documents/{documentId}/question-jobs
```

Response đề xuất:

```json
{
  "success": true,
  "message": "Lấy danh sách phiên tạo câu hỏi thành công",
  "data": [
    {
      "id": 1,
      "documentId": 10,
      "status": "GENERATED",
      "statusText": "Đã tạo xong",
      "provider": "mock",
      "model": "deepseek-v4-flash",
      "promptVersion": "docgen-mvp-flash-v1",
      "questionsPerChunk": 3,
      "chunkCount": 12,
      "completedChunkCount": 12,
      "failedChunkCount": 0,
      "candidateCount": 18,
      "createdAt": "2026-06-30T16:00:00"
    }
  ]
}
```

Nếu endpoint này chưa có, UI v1 có thể điều hướng thẳng sang review job ngay sau khi tạo job và không hiển thị lịch sử job cũ.

---

## 4. Màn hình 1: Danh sách tài liệu

Route:

```text
/admin/evaluation/question-documents
```

Mục tiêu:

- Admin tải tài liệu.
- Admin nhìn nhanh tài liệu nào sẵn sàng, tài liệu nào cần OCR, tài liệu nào lỗi.
- Admin mở chi tiết tài liệu để xem sections/chunks hoặc tạo câu hỏi.

Layout theo pattern hiện tại:

```text
AdminSidebar
AdminHeader
Page title band
Upload panel
Filter bar
Documents table
Pagination
```

### 4.1. Page title

Title:

```text
Tạo câu hỏi từ tài liệu
```

Subtitle:

```text
Tải tài liệu chuyên môn, tạo câu hỏi AI có evidence và duyệt trước khi lưu vào ngân hàng câu hỏi.
```

### 4.2. Upload panel

Panel gồm:

- Dropzone hoặc button chọn file.
- Text hỗ trợ:

```text
Hỗ trợ PDF có text, DOCX, TXT, MD. PDF scan sẽ được đánh dấu cần OCR.
```

Controls:

- Button `Chọn tệp`.
- Button `Tải lên`.
- Loading state `Đang tải và phân tích tài liệu...`.
- Success toast `Tải tài liệu thành công`.
- Error toast lấy message từ API nếu có.

Validation frontend:

- Chỉ cho chọn `.pdf`, `.docx`, `.txt`, `.md`.
- Không gọi API nếu chưa chọn file.
- Nếu backend trả `OCR_REQUIRED`, hiển thị warning thay vì lỗi đỏ.

### 4.3. Filter bar

Fields:

- Search input placeholder:

```text
Tìm theo tên tài liệu...
```

- Status select:

```text
Tất cả trạng thái
Sẵn sàng
Cần OCR
Thất bại
```

Các status label lấy ưu tiên từ `statusText` backend. Nếu thiếu thì frontend fallback:

| Enum | Label |
|---|---|
| `READY` | Sẵn sàng |
| `OCR_REQUIRED` | Cần OCR |
| `FAILED` | Thất bại |

### 4.4. Documents table

Cột:

| Cột | Nội dung |
|---|---|
| `#` | STT theo trang |
| `Tên tài liệu` | filename |
| `Trạng thái` | badge |
| `Số trang` | pageCount |
| `Số chunk` | chunkCount |
| `Ngày tải` | createdAt |
| `Hành động` | xem chi tiết, tạo câu hỏi |

Action:

- `Xem chi tiết` → `/admin/evaluation/question-documents/{documentId}`
- `Tạo câu hỏi`:
  - Chỉ enabled khi `status === READY` và `chunkCount > 0`.
  - Có thể mở modal chọn `questionsPerChunk`.
  - Sau khi tạo job thành công, navigate tới `/admin/evaluation/document-question-jobs/{jobId}`.

Empty state:

```text
Chưa có tài liệu nào. Tải tài liệu đầu tiên để bắt đầu tạo câu hỏi.
```

OCR warning row/card:

```text
Tài liệu cần OCR trước khi tạo câu hỏi. Hệ thống chưa sinh câu hỏi từ PDF scan trong MVP.
```

---

## 5. Màn hình 2: Chi tiết tài liệu

Route:

```text
/admin/evaluation/question-documents/:documentId
```

Mục tiêu:

- Reviewer/admin kiểm tra tài liệu đã được parse như thế nào.
- Xem section tree và preview chunks trước khi tạo câu hỏi.
- Tạo job từ tài liệu.

### 5.1. Header summary

Hiển thị:

- Tên file.
- Status badge.
- Content type.
- Page count.
- Chunk count.
- Content hash rút gọn 8-12 ký tự.
- Error message nếu có.

Primary action:

```text
Tạo câu hỏi
```

Button disabled khi:

- `status !== READY`
- `chunkCount === 0`

### 5.2. Create job modal

Fields:

- `Số câu mỗi chunk`: number input, min 1, max 5, default 3.

Text cảnh báo:

```text
Phiên tạo câu hỏi sẽ xử lý từng chunk riêng để giữ evidence và có thể retry phần lỗi.
```

Actions:

- `Hủy`
- `Tạo phiên`

Loading:

```text
Đang tạo câu hỏi từ tài liệu...
```

Sau success:

- Navigate tới review job.

### 5.3. Tabs

Tabs:

```text
Tổng quan
Cấu trúc tài liệu
Chunks
Phiên tạo câu hỏi
```

Tab `Phiên tạo câu hỏi` chỉ hiển thị danh sách lịch sử nếu backend bổ sung endpoint `GET /documents/{documentId}/question-jobs`. Nếu chưa có endpoint, hiển thị:

```text
Lịch sử phiên tạo sẽ hiển thị sau khi backend bổ sung API danh sách job theo tài liệu.
```

### 5.4. Section tree

Hiển thị dạng tree hoặc nested list:

- Title.
- Level.
- Page range.
- Confidence.
- Path.

Nếu `confidence < 0.5`, hiển thị badge:

```text
Độ tin cậy thấp
```

### 5.5. Chunk preview

Danh sách chunk dạng table hoặc split layout.

Cột:

| Cột | Nội dung |
|---|---|
| `Chunk` | chunkIndex |
| `Section` | sectionPath |
| `Trang` | pageStart-pageEnd |
| `Tokens` | tokenCount |
| `Cảnh báo` | qualityFlags |
| `Preview` | textPreview |

Quality flag label:

| Flag | Label |
|---|---|
| `LOW_INFORMATION_DENSITY` | Ít thông tin |
| `LOW_SECTION_CONFIDENCE` | Section chưa chắc chắn |
| `ABOVE_TARGET_TOKEN_RANGE` | Vượt target token |

---

## 6. Màn hình 3: Review phiên tạo câu hỏi

Route:

```text
/admin/evaluation/document-question-jobs/:jobId
```

Mục tiêu:

- Review toàn bộ output từ một generation job.
- Thấy model/prompt/usage để audit.
- Sửa, duyệt, từ chối, lưu candidate vào question bank.
- Retry chunk lỗi nếu job partial.

### 6.1. Job summary

Hiển thị:

- Status badge.
- Provider.
- Model.
- Prompt version.
- Questions per chunk.
- Chunk count.
- Completed chunks.
- Failed chunks.
- Candidate count.
- Created/updated time.

Usage cards:

- LLM call count.
- Prompt tokens.
- Completion tokens.
- Total tokens.
- Latency.
- Estimated cost nếu có.

Status label fallback:

| Enum | Label |
|---|---|
| `CREATED` | Đã tạo |
| `GENERATING` | Đang tạo |
| `GENERATED` | Đã tạo xong |
| `PARTIALLY_COMPLETED` | Hoàn thành một phần |
| `FAILED` | Thất bại |
| `CANCELLED` | Đã hủy |

### 6.2. Chunk errors

Nếu `failedChunkCount > 0`, hiển thị warning panel:

```text
Một số chunk xử lý lỗi. Bạn có thể retry riêng các chunk lỗi mà không chạy lại toàn bộ tài liệu.
```

Button:

```text
Retry chunk lỗi
```

Khi click:

- Gọi `retryFailedChunks(jobId)`.
- Reload job detail.

### 6.3. Knowledge points

Hiển thị compact table:

| Cột | Nội dung |
|---|---|
| `Key` | sourceKey |
| `Loại` | knowledgeType |
| `Mức quan trọng` | importance |
| `Statement` | statement |
| `Nguồn` | sourceExcerpt |

Nếu không có knowledge point:

```text
Không có knowledge point đủ điều kiện từ các chunk đã xử lý.
```

### 6.4. Candidate filters

Filters:

- Search by stem.
- Status:

```text
Tất cả
Đạt
Cần xem xét
Đã từ chối
Đã duyệt
Đã lưu
```

- Difficulty:

```text
Tất cả
Dễ
Trung bình
Khó
```

### 6.5. Candidate card

Mỗi card phải hiển thị:

- Status badge.
- Label badge.
- Quality score.
- Topic.
- Difficulty.
- Duplicate warning nếu có.
- Stem.
- A/B/C/D.
- Correct answer.
- Explanation.
- Source excerpt.
- Warnings.
- LLM validation raw hoặc summary.
- Reviewer notes.

Card action buttons:

| Button | Điều kiện |
|---|---|
| `Sửa` | mọi candidate chưa `SAVED` |
| `Duyệt` | candidate không `REJECTED`, chưa `APPROVED`, chưa `SAVED` |
| `Từ chối` | candidate chưa `REJECTED`, chưa `SAVED` |
| `Lưu vào ngân hàng câu hỏi` | chỉ khi `status === APPROVED` |

Button `Lưu vào ngân hàng câu hỏi` phải disabled nếu:

- `status !== APPROVED`
- Đang submit action.

Status label fallback:

| Enum | Label |
|---|---|
| `GENERATED` | Đã sinh |
| `VALIDATED` | Đã kiểm tra |
| `NEED_REVIEW` | Cần xem xét |
| `APPROVED` | Đã duyệt |
| `REJECTED` | Đã từ chối |
| `SAVED` | Đã lưu |

Label fallback:

| Enum | Label |
|---|---|
| `GOOD` | Đạt |
| `NEED_REVIEW` | Cần xem xét |
| `REJECTED` | Đã từ chối |

### 6.6. Edit candidate modal

Fields:

- Stem textarea.
- Option A/B/C/D input hoặc textarea.
- Correct answer segmented control A/B/C/D.
- Explanation textarea.
- Difficulty select.
- Topic input.
- Source excerpt textarea.
- Reviewer notes textarea.

Validation frontend:

- Stem required.
- A-D required.
- Correct answer required and must be A/B/C/D.
- Source excerpt required.

On save:

- Gọi `updateCandidate`.
- Replace candidate state bằng response mới.
- Toast:

```text
Cập nhật và kiểm tra lại câu hỏi thành công
```

### 6.7. Source/evidence viewer

MVP hiển thị source excerpt ngay trong card.

Nếu cần viewer bên cạnh:

- Split layout 60/40 trên desktop.
- Trái: candidate list.
- Phải: panel nguồn đang chọn.
- Panel nguồn hiển thị section path, chunk id, source excerpt, warnings.

Không cần PDF page viewer trong MVP.

---

## 7. State management và loading

MVP dùng React local state trong từng page, chưa cần global store.

State tối thiểu:

- `documents`
- `documentDetail`
- `jobDetail`
- `selectedFile`
- `isUploading`
- `isCreatingJob`
- `isRetrying`
- `candidateActionId`
- `filters`
- `errorMessage`

API response unwrap:

```js
const data = response.data?.data
```

Lỗi:

- Ưu tiên `error.response?.data?.message`.
- Fallback:

```text
Có lỗi xảy ra, vui lòng thử lại.
```

Loading skeleton:

- Table loading row.
- Button disabled khi request đang chạy.
- Không gửi duplicate request khi button đang loading.

---

## 8. Component/file gợi ý

Thêm các file:

```text
src/features/evaluation/api/documentQuestionApi.js
src/features/evaluation/pages/QuestionDocumentListPage.jsx
src/features/evaluation/pages/QuestionDocumentDetailPage.jsx
src/features/evaluation/pages/DocumentQuestionJobReviewPage.jsx
src/features/evaluation/styles/QuestionDocumentPages.css
```

Component có thể tách nếu page quá dài:

```text
src/features/evaluation/components/DocumentUploadPanel.jsx
src/features/evaluation/components/CandidateReviewCard.jsx
src/features/evaluation/components/CandidateEditModal.jsx
src/features/evaluation/components/JobUsageSummary.jsx
```

Nếu implement nhanh cho MVP, có thể để component trong page trước, nhưng không nên để quá một file khổng lồ khó review.

---

## 9. Visual style

Theo style admin/evaluation hiện tại:

- Background trang: sáng, trung tính.
- Card/table border nhẹ.
- Border radius tối đa 8px cho control/card mới nếu có thể.
- Button primary màu xanh hiện tại.
- Badge màu theo trạng thái:
  - Sẵn sàng/Đạt/Đã duyệt: xanh lá.
  - Cần OCR/Cần xem xét/Partial: vàng.
  - Thất bại/Đã từ chối: đỏ.
  - Đã lưu: xanh dương.

Không dùng hero/landing page. Màn hình đầu tiên phải là công cụ upload/list thật.

Không dùng text hướng dẫn dài trong UI. Các câu mô tả chỉ ngắn gọn để hỗ trợ workflow.

Responsive:

- Desktop: bảng full width, review có thể split panel.
- Tablet/mobile: filter stack dọc, candidate cards full width, action buttons wrap.

---

## 10. Test checklist

### 10.1. Manual scenarios

1. Upload PDF text thành công:
   - Tài liệu xuất hiện trong list.
   - Status là `Sẵn sàng`.
   - Chi tiết có sections/chunks.

2. Upload PDF scan:
   - Status là `Cần OCR`.
   - Không có nút tạo câu hỏi active.
   - Warning nói rõ MVP chưa sinh câu hỏi từ PDF scan.

3. Tạo job bằng provider mock:
   - Gửi payload `{ "questionsPerChunk": 3 }`.
   - Navigate sang review job.
   - Có usage/model/prompt version.
   - Có candidate cards.

4. Review candidate:
   - Edit candidate thành công.
   - Warnings/status cập nhật theo API response.
   - Approve candidate thành công.
   - Save-as-question chỉ enabled sau approve.

5. Partial job:
   - Nếu `failedChunkCount > 0`, warning panel xuất hiện.
   - Click retry gọi đúng endpoint.
   - Sau retry reload job detail.

### 10.2. Frontend checks

```text
npm run lint
npm run build
```

### 10.3. API integration checks

- Multipart upload dùng field `file`.
- Create job gửi `questionsPerChunk` trong khoảng 1-5.
- Candidate edit gửi đủ stem/options/correctAnswer/sourceExcerpt.
- Approve/reject gửi `{ reviewerNotes }` nếu có.
- Save-as-question không gửi body.

---

## 11. Out of scope cho UI MVP

Chưa làm trong phase này:

- OCR upload/config UI.
- E5 threshold tuning UI.
- VietQuill paraphrase UI.
- PDF page image viewer.
- Realtime progress bằng WebSocket/SSE.
- Batch approve tự động.
- Tự động publish câu hỏi AI chưa review.

Các phần này có thể bổ sung sau khi upload/review MVP chạy ổn.
