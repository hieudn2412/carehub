# Document question generation optimization plan

## Mục tiêu

Tối ưu luồng tạo câu hỏi từ tài liệu để:

- Không còn câu hỏi demo tiếng Anh trong UI admin/evaluation.
- Không xóa nhầm thuật ngữ chuyên môn tiếng Anh hợp lệ trong bộ câu hỏi bệnh viện.
- Giảm thời gian gọi DeepSeek khi tạo câu hỏi.
- Giữ được evidence/source excerpt, review workflow và duplicate check bằng E5.
- Tách rõ phase triển khai để mỗi phase có thể test và rollback độc lập.

## Hiện trạng đã xác nhận

### Câu hỏi tiếng Anh

- Câu hỏi tiếng Anh rõ ràng đang nằm trong dữ liệu demo/fallback frontend:
  - `QuestionBankListPage.jsx`
  - `QuestionSetFormPage.jsx`
- Các nhãn song ngữ trong form câu hỏi cũng còn tiếng Anh:
  - `Question text`
  - `Single choice`
  - `Multiple choice`
  - `Answer options`
- Bộ seed bệnh viện trong `hospital-review-questions.json` chủ yếu tiếng Việt, nhưng có nhiều thuật ngữ chuyên môn tiếng Anh trong ngoặc như `Primary Survey`, `Evidence-Based Practice`, `External Fixation`.
- Không nên xóa tự động mọi text có tiếng Anh, vì sẽ làm mất thuật ngữ y khoa.

Ghi chú implementation hiện tại:

- Đã đổi dữ liệu demo tiếng Anh ở frontend sang tiếng Việt.
- Đã bỏ nhãn song ngữ trong `QuestionFormPage`.
- Frontend `npm run build` đã pass sau thay đổi này.

### Implementation progress

- Phase 0 frontend cleanup: done.
- Phase 1 observability: done ở mức server log cho upload pipeline, per-chunk job processing và từng DeepSeek call.
- Phase 2 fast path: done với `ai.generation.pipeline-mode=single_call`, default `GENERATION_LLM_VALIDATION_ENABLED=false`, default `DOCUMENT_QUESTIONS_PER_CHUNK=1`, và frontend default 1 câu/chunk.
- Phase 2 parser test: done với `DeepSeekDocumentQuestionGeneratorTest`.
- Phase 3 async job/polling: done. `createJob` trả về job `CREATED` ngay, publish event sau commit, worker nền chuyển job sang `GENERATING` và xử lý chunk; trang review tự polling khi job còn `CREATED/GENERATING`.
- Phase 4 chunk quality gate: done ở mức không cần migration. Chunking bổ sung flags `HEADING_ONLY`, `DUPLICATE_TEXT`, `TABLE_LIKE_LOW_CONFIDENCE`; job service skip chunk có blocking flags trước khi gọi model; trang detail hiển thị `Có thể tạo câu hỏi`/`Bỏ qua` và modal hiển thị tổng chunk đủ điều kiện.
- Phase 5 duplicate/save hardening: done ở mức service guard. Save-as-question bắt buộc candidate `APPROVED`, có source excerpt, check duplicate mạnh tại thời điểm save và loại chính candidate khỏi duplicate check; frontend disable save khi duplicate score ở ngưỡng mạnh.
- Phase 6 parser/OCR hardening: done ở mức MVP. PDF scan vẫn giữ `OCR_REQUIRED`; DOCX extractor đọc paragraph/table trực tiếp, chuyển heading style thành marker section, giữ list marker và table row bằng `|`; section detector hiểu marker heading nhưng hiển thị title sạch.
- Phase 7 benchmark instrumentation: done ở mức UI metrics. Trang review job hiển thị `Độ trễ/chunk`, `Tỷ lệ duyệt`, `Tỷ lệ lưu`, `Cảnh báo trùng` để reviewer ghi nhận benchmark theo từng config; việc chọn prompt/version và ngưỡng E5 cuối cùng vẫn cần chạy dataset thật.
- Phase 8 production polish: done một phần quan trọng. DeepSeek generator có giới hạn concurrent calls qua `GENERATION_MAX_CONCURRENT_CALLS` và circuit breaker nhẹ qua `GENERATION_CIRCUIT_BREAKER_FAILURE_THRESHOLD`/`GENERATION_CIRCUIT_BREAKER_COOLDOWN_SECONDS`; log vẫn chỉ ghi metadata, không ghi API key/chunk đầy đủ; tab lịch sử job có filter trạng thái.

### Pipeline upload tài liệu hiện tại

Luồng upload đang chạy đồng bộ trong request upload:

```text
QuestionDocumentController.upload
→ QuestionDocumentService.upload
→ DocumentTextExtractor.extract
→ DocumentTextPreprocessor.preprocessPages
→ DocumentSectionDetectionService.detectSections
→ DocumentChunkingService.createGenerationChunks
→ persist question_documents, document_sections, document_chunks
```

Chi tiết:

- PDF: đọc text từng trang bằng PDFBox reflection.
- DOCX: dùng Apache POI `XWPFWordExtractor`.
- TXT/MD: đọc UTF-8.
- Preprocess:
  - normalize Unicode và whitespace.
  - bỏ số trang.
  - bỏ dòng ngắn lặp lại nhiều lần như header/footer.
  - nối dòng thành paragraph.
  - tách heading/list marker thành paragraph riêng.
- Section detection:
  - nhận diện `Chương`, số thứ tự `1.2.3`, La Mã, chữ cái, heading viết hoa.
  - nếu không có heading thì đưa vào section `Nội dung tài liệu`.
- Chunking:
  - chunk theo section.
  - config hiện tại:
    - `DOCUMENT_CHUNK_TARGET_TOKENS=750`
    - `DOCUMENT_CHUNK_MAX_TOKENS=1200`
    - `DOCUMENT_CHUNK_OVERLAP_TOKENS=80`
    - `DOCUMENT_CHUNK_MIN_USEFUL_TEXT_LENGTH=80`
  - token hiện đang ước lượng bằng số từ, chưa phải tokenizer thật.

### Pipeline tạo câu hỏi hiện tại

Luồng tạo job sau Phase 3:

```text
DocumentQuestionJobService.createJob
→ lưu document_question_jobs với status CREATED
→ publish DocumentQuestionJobCreatedEvent sau commit
→ DocumentQuestionJobWorker chạy async bằng documentQuestionJobExecutor
→ DocumentQuestionJobService.processJob
→ status GENERATING
→ processChunks
→ persist knowledge points/candidates
→ status GENERATED/PARTIALLY_COMPLETED/FAILED
→ frontend review page polling 3 giây/lần khi status còn CREATED/GENERATING
```

Luồng tạo câu hỏi đang chạy đồng bộ trong request tạo job:

```text
DocumentQuestionJobController.create
→ DocumentQuestionJobService.createJob
→ load all chunks
→ for each chunk sequentially
  → DeepSeekDocumentQuestionGenerator.generate
  → persist knowledge points
  → validate local
  → duplicate check E5/lexical
  → persist candidates
```

Trong `DeepSeekDocumentQuestionGenerator.generate`, mỗi chunk hiện có thể gọi:

```text
1 call: extract knowledge points
1 call: generate questions
N calls: LLM validation, 1 call per generated question
```

Với default `questionsPerChunk=3` và `llmValidationEnabled=true`, mỗi chunk có thể thành:

```text
1 knowledge call + 1 question call + 3 validation calls = 5 DeepSeek calls/chunk
```

Nếu tài liệu có 20 chunks:

```text
20 chunks * 5 calls/chunk = khoảng 100 calls tuần tự
```

Đây là nguyên nhân chính khiến call API rất lâu.

## Phase 0 — Cleanup và audit dữ liệu tiếng Anh

### Mục tiêu

Loại bỏ câu hỏi demo tiếng Anh khỏi UI, đồng thời chuẩn bị cách kiểm tra DB thật mà không xóa nhầm thuật ngữ chuyên môn.

### Scope

Frontend:

- Thay `INITIAL_QUESTIONS` tiếng Anh trong `QuestionBankListPage`.
- Thay `DEFAULT_QUESTIONS` tiếng Anh trong `QuestionSetFormPage`.
- Bỏ nhãn song ngữ trong `QuestionFormPage`.

DB audit:

- Không chạy delete trực tiếp khi chưa dry-run.
- Thêm checklist SQL để tìm câu có khả năng tiếng Anh:

```sql
select id, language, source_document, stem
from questions
where lower(coalesce(language, '')) not in ('vi', 'vietnamese')
   or stem ~* '\\m(the|what|which|when|where|how|patient|purpose|steps|correct)\\M'
order by id;
```

- Reviewer phải phân loại:
  - Xóa được: câu demo/mock hoàn toàn tiếng Anh.
  - Giữ lại: câu tiếng Việt có thuật ngữ tiếng Anh trong ngoặc.

### Deliverables

- Frontend không còn câu demo tiếng Anh rõ ràng.
- Có câu SQL dry-run để kiểm tra DB.
- Nếu DB có dữ liệu demo tiếng Anh thật, tạo script delete riêng theo `id` đã review, không delete bằng regex rộng.

### Test

- `npm run build`
- Manual: mở `Ngân hàng câu hỏi`, không thấy demo tiếng Anh nếu backend fail.
- DB dry-run trả danh sách review được, không tự xóa.

### Trạng thái

- Frontend cleanup: đã làm.
- DB cleanup: chờ kết nối DB đúng credential để dry-run.

## Phase 1 — Observability và baseline thời gian

### Mục tiêu

Trước khi tối ưu sâu, phải biết chậm ở stage nào:

- Extract file.
- Preprocess.
- Section detection.
- Chunking.
- DeepSeek knowledge call.
- DeepSeek question call.
- DeepSeek validation call.
- Duplicate check E5/lexical.
- Persist DB.

### Backend changes

Thêm timing log có cấu trúc:

- Trong `QuestionDocumentService.upload`:
  - `extractMs`
  - `preprocessMs`
  - `sectionDetectMs`
  - `chunkingMs`
  - `persistMs`
  - `paragraphCount`
  - `sectionCount`
  - `chunkCount`
- Trong `DocumentQuestionJobService.processChunks`:
  - `jobId`
  - `chunkId`
  - `chunkIndex`
  - `tokenCount`
  - `generatorMs`
  - `persistCandidateMs`
  - `duplicateCheckMs`
  - `candidateCount`
- Trong `DeepSeekDocumentQuestionGenerator.callDeepSeek`:
  - `stage`
  - `attempt`
  - `latencyMs`
  - `promptTokens`
  - `completionTokens`
  - `totalTokens`

Không log toàn bộ chunk trong production.

### Optional DB changes

Nếu cần debug UI:

- Thêm `document_question_job_events` hoặc `document_question_call_logs`.
- MVP có thể chỉ log server-side trước, chưa cần table mới.

### Frontend changes

- Trang review job đã có usage tổng; phase này chưa cần UI mới.
- Có thể thêm dòng nhỏ trong job detail:
  - `Tổng lượt gọi LLM`
  - `Tổng latency LLM`
  - `Token đã dùng`

### Acceptance criteria

- Tạo job trên 1 tài liệu bất kỳ xong, log thể hiện rõ:
  - có bao nhiêu chunk.
  - mỗi chunk mất bao lâu.
  - mỗi chunk gọi DeepSeek bao nhiêu lần.
- Không lộ API key hoặc toàn bộ chunk trong log.

### Test

- Backend compile/test.
- Manual upload 1 DOCX/PDF text.
- Manual create job với `questionsPerChunk=1`.

## Phase 2 — Fast path: giảm DeepSeek calls xuống 1 call/chunk

### Mục tiêu

Giảm thời gian tạo câu hỏi ngay lập tức bằng cách bỏ pipeline nhiều call/chunk.

### Quyết định chính

- Gộp knowledge extraction và question generation vào một prompt.
- Tắt LLM validation mặc định.
- Giữ local validation và E5 duplicate check.
- Default `questionsPerChunk` nên là `1` hoặc `2`, không để `3` cho tài liệu dài.

### Backend changes

Trong `DeepSeekDocumentQuestionGenerator`:

- Thêm mode mới, ví dụ:

```yaml
ai:
  generation:
    pipeline-mode: ${GENERATION_PIPELINE_MODE:single_call}
    llm-validation-enabled: ${GENERATION_LLM_VALIDATION_ENABLED:false}
```

- Với `single_call`, mỗi chunk gọi DeepSeek một lần và yêu cầu JSON:

```json
{
  "knowledgePoints": [
    {
      "id": "KP1",
      "statement": "...",
      "type": "definition|fact|procedure|warning|principle",
      "importance": "low|medium|high",
      "sourceExcerpt": "...",
      "generationEligible": true
    }
  ],
  "questions": [
    {
      "stem": "...",
      "optionA": "...",
      "optionB": "...",
      "optionC": "...",
      "optionD": "...",
      "correctAnswer": "A",
      "explanation": "...",
      "difficulty": "easy|medium|hard",
      "topic": "...",
      "sourceExcerpt": "...",
      "knowledgePointId": "KP1"
    }
  ]
}
```

- Nếu không có knowledge point đủ tốt, model được phép trả `questions: []`.
- Parser dùng lại `parseKnowledgePoints` và `parseQuestions`.
- Giữ `multi_stage` cũ sau feature flag để rollback.

Trong `application.yaml`:

- Đổi default:

```yaml
document:
  questions-per-chunk: ${DOCUMENT_QUESTIONS_PER_CHUNK:1}

ai:
  generation:
    llm-validation-enabled: ${GENERATION_LLM_VALIDATION_ENABLED:false}
```

### Frontend changes

- Modal tạo job default `questionsPerChunk=1`.
- Hiển thị hint ngắn:
  - `Nên bắt đầu 1 câu/chunk để kiểm soát chất lượng và tốc độ.`

### Acceptance criteria

- Một chunk chỉ gọi DeepSeek một lần khi `pipeline-mode=single_call`.
- Candidate vẫn có:
  - câu hỏi.
  - A-D.
  - đáp án đúng.
  - explanation.
  - source excerpt.
  - knowledge point id.
- Duplicate check vẫn chạy.
- Review/save-as-question không đổi.

### Test

- Unit test parser response mới.
- Mock generator test:
  - single call trả knowledge + questions.
  - single call trả `questions: []`.
- Manual job với tài liệu nhỏ:
  - call count giảm rõ trong usage/log.
  - câu hỏi vẫn tiếng Việt.

## Phase 3 — Async job và polling UI

### Mục tiêu

Không để request HTTP tạo job bị giữ lâu; user có thể rời trang và quay lại review.

### Backend changes

Hiện `createJob` xử lý đồng bộ. Cần đổi thành:

```text
POST /api/v1/documents/{documentId}/question-jobs
→ tạo job status CREATED/GENERATING
→ return ngay job summary
→ background worker xử lý chunks
```

Các thay đổi:

- Thêm async executor riêng cho document question jobs.
- `DocumentQuestionJobService.createJob` chỉ tạo job và enqueue.
- Tách method:
  - `startJob(jobId)`
  - `processJob(jobId)`
  - `processChunk(job, chunk)`
- Cập nhật progress sau từng chunk:
  - `completedChunkCount`
  - `failedChunkCount`
  - `candidateCount`
  - `chunkErrors`
  - `status`
- Thêm endpoint nếu cần:

```http
GET /api/v1/document-question-jobs/{jobId}
POST /api/v1/document-question-jobs/{jobId}/cancel
POST /api/v1/document-question-jobs/{jobId}/retry-failed-chunks
```

`GET /api/v1/documents/{documentId}/question-jobs` đã có để xem lại lịch sử.

### Frontend changes

- Sau khi tạo job, navigate ngay tới review page.
- Review page polling mỗi 2-5 giây khi status:
  - `CREATED`
  - `GENERATING`
- Dừng polling khi:
  - `GENERATED`
  - `PARTIALLY_COMPLETED`
  - `FAILED`
  - `CANCELLED`
- Hiển thị progress:
  - chunks hoàn thành / tổng chunks.
  - candidates đã tạo.
  - chunks lỗi.
- Cho phép user quay lại danh sách; lịch sử job vẫn vào được từ tab `Phiên tạo câu hỏi`.

### Acceptance criteria

- API create job phản hồi nhanh.
- Refresh trang không mất job.
- Job đang chạy có progress.
- Partial failure vẫn review được candidate đã sinh.

### Test

- Integration test create job trả nhanh với mock executor.
- Manual:
  - tạo job rồi refresh review page.
  - out khỏi page rồi vào lại từ lịch sử job.
  - retry failed chunks.

## Phase 4 — Chunk selection và chunk quality gate

### Mục tiêu

Không gửi mọi chunk sang DeepSeek. Chỉ gửi chunk có mật độ kiến thức đủ tốt.

### Backend changes

Nâng `DocumentChunkingService` và/or thêm `ChunkQualityService`:

- Thêm quality score nhẹ:
  - độ dài text.
  - có động từ/quy trình/danh sách/số liệu hay không.
  - section confidence.
  - có quá nhiều heading rỗng không.
  - trùng lặp với chunk trước không.
- Thêm flags:
  - `LOW_INFORMATION_DENSITY`
  - `HEADING_ONLY`
  - `DUPLICATE_TEXT`
  - `TABLE_LIKE_LOW_CONFIDENCE`
  - `ABOVE_TARGET_TOKEN_RANGE`
- Không generate từ chunk:
  - text quá ngắn.
  - chỉ là heading.
  - duplicate text.
  - OCR/layout lỗi.

Tùy chọn:

- Thêm field vào `DocumentChunk`:
  - `generationEligible`
  - `qualityScore`
- Nếu chưa migrate DB, có thể encode trong `qualityFlags` trước.

### Frontend changes

- Tab chunks hiển thị:
  - `Có thể tạo câu hỏi`
  - `Bỏ qua`
  - lý do bỏ qua.
- Trên create job modal hiển thị:
  - tổng chunk.
  - chunk đủ điều kiện.

### Acceptance criteria

- Chunk heading-only không gọi DeepSeek.
- Số DeepSeek calls giảm khi tài liệu có nhiều đoạn mục lục/header/footer.
- Reviewer vẫn thấy vì sao chunk bị bỏ qua.

### Test

- Unit test chunk quality với:
  - heading-only.
  - đoạn ngắn.
  - đoạn quy trình tốt.
  - duplicate.
- Manual upload tài liệu có nhiều heading.

## Phase 5 — Duplicate và save-to-bank hardening

### Mục tiêu

Giữ chất lượng ngân hàng câu hỏi khi tốc độ generation đã tốt hơn.

### Backend changes

- Khi save candidate vào question bank:
  - đảm bảo tạo E5 embedding ngay sau save.
  - nếu E5 lỗi, không fail save nhưng log warning và mark cần backfill.
- Duplicate check nên kiểm:
  - question bank.
  - candidates cùng job.
  - candidates cùng document.
- Thêm rule không save nếu:
  - candidate chưa `APPROVED`.
  - duplicate strong với câu đã có.
  - thiếu source excerpt.

### Frontend changes

- Review card hiển thị rõ:
  - duplicate score.
  - matched question.
  - warnings.
- Disable `Lưu vào ngân hàng câu hỏi` nếu chưa approved.
- Nếu duplicate strong, yêu cầu reviewer chỉnh hoặc reject.

### Acceptance criteria

- Save-as-question tạo row `questions`.
- Row mới có `sourceDocument`, `questionType`, `parentQuestionId` nếu paraphrase.
- E5 embedding được tạo hoặc được backfill sau startup.

### Test

- Backend test save candidate.
- Backend test duplicate strong không auto good.
- Manual approve → save → mở ngân hàng câu hỏi thấy câu mới.

## Phase 6 — Document parser và OCR hardening

### Mục tiêu

Tăng độ ổn định cho PDF scan/layout phức tạp, nhưng không chặn MVP.

### Backend changes

- OCR:
  - giữ status `OCR_REQUIRED` cho PDF scan.
  - phase production mới tích hợp OCR engine.
- PDF layout:
  - đọc table/header tốt hơn.
  - đánh dấu bảng nếu parser không đủ tin cậy.
- DOCX:
  - lấy heading style nếu có, thay vì chỉ text extractor.
  - giữ cấu trúc bảng/danh sách tốt hơn.

### Frontend changes

- Với `OCR_REQUIRED`, UI chỉ hiển thị hướng xử lý, không có nút tạo câu hỏi.
- Với table/layout warning, reviewer thấy cảnh báo.

### Acceptance criteria

- PDF scan không cố gọi DeepSeek.
- DOCX có heading style tạo section tree tốt hơn.
- Bảng không rõ không sinh câu hỏi tự động.

### Test

- PDF text.
- PDF scan.
- DOCX có heading.
- DOCX có bảng.

## Phase 7 — Benchmark chất lượng và cost

### Mục tiêu

Chốt cấu hình production dựa trên dữ liệu thực tế, không đoán.

### Dataset benchmark

- Chọn 5-10 tài liệu bệnh viện thực tế.
- Chạy mỗi config:
  - `questionsPerChunk=1`
  - `questionsPerChunk=2`
  - single-call prompt version A/B.
- Reviewer chấm:
  - đúng nguồn.
  - đáp án đúng.
  - distractor hợp lý.
  - explanation tốt.
  - trùng/không trùng.

### Metrics

- Average latency per chunk.
- DeepSeek calls per document.
- Token per document.
- Candidate approve rate.
- Candidate edit rate.
- Save-to-bank rate.
- Duplicate warning rate.

### Acceptance criteria

- Có prompt/version được chọn.
- Có default config đề xuất.
- Có ngưỡng E5 duplicate được điều chỉnh từ dữ liệu thật.

## Phase 8 — Production polish

### Backend

- Rate limit/concurrency limit DeepSeek calls.
- Circuit breaker nếu DeepSeek lỗi liên tục.
- Retry theo chunk/stage, không retry cả job.
- Không log API key/chunk đầy đủ.
- Cleanup old files trong storage nếu cần.

### Frontend

- Job queue/progress rõ hơn.
- Filter job theo status.
- Download/report review nếu cần.
- UX cho retry/cancel.

### Ops

- Document env vars:
  - `GENERATION_PROVIDER`
  - `DEEPSEEK_API_KEY`
  - `GENERATION_MODEL`
  - `GENERATION_PIPELINE_MODE`
  - `GENERATION_LLM_VALIDATION_ENABLED`
  - `GENERATION_MAX_CONCURRENT_CALLS`
  - `GENERATION_CIRCUIT_BREAKER_FAILURE_THRESHOLD`
  - `GENERATION_CIRCUIT_BREAKER_COOLDOWN_SECONDS`
  - `DOCUMENT_QUESTIONS_PER_CHUNK`
  - `DOCUMENT_CHUNK_TARGET_TOKENS`
  - `DOCUMENT_CHUNK_MAX_TOKENS`
- Dashboard log/cost cơ bản.

## Thứ tự khuyến nghị triển khai ngay

1. Phase 1: thêm timing log để có baseline.
2. Phase 2: single-call DeepSeek + tắt LLM validation mặc định + default `questionsPerChunk=1`.
3. Phase 3: async job/polling để user không bị chờ request dài.
4. Phase 4: chunk quality gate để giảm số chunk gửi DeepSeek.
5. Phase 5: hardening duplicate/save-to-bank.

Lý do: Phase 2 sẽ giảm thời gian rõ nhất, nhưng Phase 1 nên đi trước rất nhẹ để đo được hiệu quả thật.

## Checklist test tổng

Backend:

- `.\mvnw.cmd -q test`
- Test parser single-call response.
- Test chunk quality gate.
- Test save-as-question.
- Test retry failed chunks.

Frontend:

- `npm run build`
- Manual upload PDF text.
- Manual upload DOCX.
- Manual create job với 1 câu/chunk.
- Manual refresh review page khi job đang chạy sau Phase 3.
- Manual approve/save-as-question.

DB/manual:

- Dry-run câu hỏi tiếng Anh trước khi delete.
- Không delete câu tiếng Việt có thuật ngữ tiếng Anh trong ngoặc.
- Kiểm tra count `questions` trước/sau save-as-question.
