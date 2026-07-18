# E5 Small và VietQuill in-app implementation plan

## Mục tiêu

Tích hợp nốt 2 model local vào backend Spring Boot hiện tại:

- `intfloat/multilingual-e5-small` để kiểm tra trùng ngữ nghĩa câu hỏi.
- `ngwgsang/vietquill-vit5-base-tsubaki` để paraphrase câu hỏi trắc nghiệm tiếng Việt.

Ràng buộc đã chốt:

- Model phải chạy trong backend app, không dùng sidecar/service Python riêng.
- E5 không dùng để sinh câu hỏi, chỉ dùng embedding/semantic duplicate.
- VietQuill không dùng để tạo câu hỏi từ tài liệu, chỉ dùng paraphrase.
- VietQuill phải paraphrase cả `stem` và 4 đáp án `optionA` đến `optionD`.
- `correctAnswer` phải được giữ nguyên label `A/B/C/D`, sau đó chạy validation để phát hiện đổi nghĩa.
- Model files không commit vào git; backend load từ đường dẫn local/env.

## Trạng thái triển khai hiện tại

Backend hiện đã có config runtime trong `carehub-backend/src/main/resources/application.yaml`:

```yaml
ai:
  embedding:
    provider: ${EMBEDDING_PROVIDER:e5}
    model: ${EMBEDDING_MODEL:intfloat/multilingual-e5-small}
    dimension: ${EMBEDDING_DIMENSION:384}
    model-path: ${E5_MODEL_PATH:models/intfloat/multilingual-e5-small}
  paraphrase:
    provider: ${PARAPHRASE_PROVIDER:vietquill}
    model: ${PARAPHRASE_MODEL:ngwgsang/vietquill-vit5-base-tsubaki}
    model-path: ${VIETQUILL_MODEL_PATH:models/ngwgsang/vietquill-vit5-base-tsubaki}
```

Đã implement trong code:

- E5 local embedding bằng ONNX Runtime Java + HuggingFace tokenizer Java.
- `QuestionEmbedding` entity/repository/service và endpoint backfill embedding.
- `DuplicateCheckService` dùng E5 semantic duplicate khi model sẵn sàng, fallback lexical nếu lỗi hoặc thiếu model.
- VietQuill paraphrase job/candidate entity, repository, service, controller và review API.
- VietQuill runtime bằng ONNX Runtime Java seq2seq encoder/decoder, provider `mock` để smoke UI/API khi chưa có model thật.
- Frontend ngân hàng câu hỏi có action `Diễn đạt lại`, modal trạng thái model, và trang review paraphrase candidate.

Còn phụ thuộc ngoài repo:

- E5 cần `E5_MODEL_PATH` trỏ tới thư mục có `model.onnx` và `tokenizer.json`.
- VietQuill cần `VIETQUILL_MODEL_PATH` trỏ tới thư mục đã export ONNX seq2seq. Layout khuyến nghị là `question/` cho stem và `sentence/` cho 4 đáp án; mỗi subfolder có `encoder_model.onnx`, `decoder_model.onnx`, `tokenizer.json`, `config.json`.
- Repo Hugging Face VietQuill hiện là raw model weights, nên không copy trực tiếp vào app để chạy ONNX được; cần export/convert sang ONNX trước khi smoke model thật.

## Model files local

Model files không commit vào git. `.gitignore` đã ignore:

```text
models/
carehub-backend/models/
```

### E5

Đường dẫn mặc định:

```text
carehub-backend/models/intfloat/multilingual-e5-small
```

Runtime cần một trong hai layout:

```text
model.onnx
tokenizer.json
```

hoặc:

```text
onnx/model.onnx
onnx/tokenizer.json
```

Smoke test thật:

```powershell
$env:RUN_MODEL_SMOKE='true'
.\mvnw.cmd -q "-Dtest=E5EmbeddingModelSmokeTest" test
Remove-Item Env:RUN_MODEL_SMOKE
```

### VietQuill

Đường dẫn mặc định:

```text
carehub-backend/models/ngwgsang/vietquill-vit5-base-tsubaki
```

Runtime Java hiện tại dùng ONNX Runtime Java thường cho seq2seq encoder/decoder. Layout khuyến nghị:

```text
question/
  encoder_model.onnx
  decoder_model.onnx
  tokenizer.json
  config.json
sentence/
  encoder_model.onnx
  decoder_model.onnx
  tokenizer.json
  config.json
```

Nếu chỉ có một model ONNX ở root thì service dùng model đó cho cả stem và options. Tuy nhiên để paraphrase đáp án tự nhiên hơn, nên dùng `vietquill-vit5-base-question-tsubaki` cho `question/` và `vietquill-vit5-base-sentence-tsubaki` cho `sentence/`.

Raw Hugging Face files như `model.safetensors`, `config.json`, `spiece.model` chưa đủ để `VietQuillParaphraseModelService` chạy. Cần export ra ONNX trước, ví dụ theo hướng Optimum:

```powershell
python -m pip install "optimum[onnxruntime]" transformers sentencepiece onnx
optimum-cli export onnx --model ngwgsang/vietquill-vit5-base-question-tsubaki --task text2text-generation models/ngwgsang/vietquill-vit5-base-tsubaki/question
optimum-cli export onnx --model ngwgsang/vietquill-vit5-base-sentence-tsubaki --task text2text-generation models/ngwgsang/vietquill-vit5-base-tsubaki/sentence
```

Nếu export không sinh `tokenizer.json`, tạo tokenizer fast rồi save lại vào cùng thư mục:

```powershell
@'
from transformers import AutoTokenizer
tok = AutoTokenizer.from_pretrained("ngwgsang/vietquill-vit5-base-question-tsubaki", use_fast=True)
tok.save_pretrained("models/ngwgsang/vietquill-vit5-base-tsubaki/question")
tok = AutoTokenizer.from_pretrained("ngwgsang/vietquill-vit5-base-sentence-tsubaki", use_fast=True)
tok.save_pretrained("models/ngwgsang/vietquill-vit5-base-tsubaki/sentence")
'@ | python -
```

Khi có artifact export, smoke test thật:

```powershell
$env:RUN_VIETQUILL_SMOKE='true'
$env:VIETQUILL_MODEL_PATH='models/ngwgsang/vietquill-vit5-base-tsubaki'
.\mvnw.cmd -q "-Dtest=VietQuillParaphraseModelSmokeTest" test
Remove-Item Env:RUN_VIETQUILL_SMOKE
Remove-Item Env:VIETQUILL_MODEL_PATH
```

Nếu chỉ cần smoke UI/API paraphrase trước khi có export:

```properties
PARAPHRASE_PROVIDER=mock
```

## Kiến trúc đề xuất

### Package backend

```text
questiongeneration
├─ modelruntime
│  ├─ EmbeddingModelService
│  ├─ ParaphraseModelService
│  ├─ e5
│  │  ├─ E5EmbeddingModelService
│  │  └─ E5TextPreprocessor
│  └─ vietquill
│     ├─ VietQuillParaphraseModelService
│     ├─ VietQuillPromptBuilder
│     └─ ProtectedTermService
├─ embedding
│  ├─ QuestionEmbedding
│  ├─ QuestionEmbeddingRepository
│  ├─ QuestionEmbeddingService
│  └─ QuestionEmbeddingBackfillService
├─ paraphrase
│  ├─ ParaphraseJob
│  ├─ ParaphraseCandidate
│  ├─ ParaphraseJobRepository
│  ├─ ParaphraseCandidateRepository
│  ├─ ParaphraseService
│  ├─ ParaphraseValidationService
│  └─ ParaphraseMapper
```

### Runtime trong JVM

Ưu tiên spike theo thứ tự:

1. DJL/Hugging Face runtime trong Spring Boot để load model local.
2. Nếu VietQuill generation không ổn định qua DJL, export ONNX và chạy bằng ONNX Runtime Java trong cùng app.

Không dùng Python sidecar vì requirement là model phải chạy trong app.

Implementation hiện tại dùng:

- E5: ONNX Runtime Java + HuggingFace tokenizer Java.
- VietQuill: ONNX Runtime Java seq2seq encoder/decoder.

Vì vậy model local cần được đặt ở format runtime tương ứng:

- `E5_MODEL_PATH` trỏ tới thư mục có `tokenizer.json` và `model.onnx`.
- `VIETQUILL_MODEL_PATH` trỏ tới thư mục model đã export ONNX seq2seq.

Nếu chưa có model files, backend vẫn compile/start được. E5 sẽ fallback về lexical duplicate khi không load được model; VietQuill job sẽ trả trạng thái `FAILED` nếu gọi provider thật mà thiếu model. Có thể đặt `PARAPHRASE_PROVIDER=mock` để smoke test UI/API paraphrase mà không cần model thật.

## Config dự kiến

```yaml
ai:
  embedding:
    provider: ${EMBEDDING_PROVIDER:e5}
    model: ${EMBEDDING_MODEL:intfloat/multilingual-e5-small}
    dimension: ${EMBEDDING_DIMENSION:384}
    model-path: ${E5_MODEL_PATH:models/intfloat/multilingual-e5-small}
    preload: ${E5_PRELOAD:true}
    max-length: ${E5_MAX_LENGTH:512}
    timeout-seconds: ${E5_TIMEOUT_SECONDS:30}
    fallback-provider: ${E5_FALLBACK_PROVIDER:lexical}
  paraphrase:
    provider: ${PARAPHRASE_PROVIDER:vietquill}
    model: ${PARAPHRASE_MODEL:ngwgsang/vietquill-vit5-base-tsubaki}
    model-path: ${VIETQUILL_MODEL_PATH:models/ngwgsang/vietquill-vit5-base-tsubaki}
    preload: ${VIETQUILL_PRELOAD:false}
    max-input-length: ${VIETQUILL_MAX_INPUT_LENGTH:512}
    max-output-length: ${VIETQUILL_MAX_OUTPUT_LENGTH:512}
    timeout-seconds: ${VIETQUILL_TIMEOUT_SECONDS:60}
    num-beams: ${VIETQUILL_NUM_BEAMS:4}
    requested-count-default: ${VIETQUILL_REQUESTED_COUNT_DEFAULT:3}
```

Mặc định nên để `VIETQUILL_PRELOAD=false` trong dev để app không khởi động quá lâu. Khi gọi paraphrase lần đầu mới load model.

## E5 semantic duplicate

### Input format

Theo convention của E5:

- Candidate/question cần kiểm tra: `query: <stem>`
- Câu hỏi trong ngân hàng: `passage: <stem>`

Không dùng E5 cho option hoặc explanation trong phase đầu.

### Data model

Thêm entity `QuestionEmbedding`:

- `id: Long`
- `question: QuestionBankQuestion`
- `textType: stem`
- `embeddingModel`
- `embeddingDimension`
- `inputTextHash`
- `normalizedText`
- `vector`
- `createdAt`

Với PostgreSQL hiện tại có thể lưu vector dạng `double precision[]` hoặc `text/json` trước. Nếu sau này cần scale lớn, cân nhắc `pgvector`.

### Service flow

Khi validate candidate:

1. Normalize stem.
2. Embed candidate bằng E5 prefix `query:`.
3. Lấy embedding câu hỏi APPROVED trong ngân hàng.
4. Tính cosine similarity.
5. So với threshold:
   - `>= validation.duplicate.strong-min`: reject duplicate mạnh.
   - `>= validation.duplicate.review-min`: cần review.
   - thấp hơn: pass duplicate.
6. Vẫn giữ lexical similarity như fallback hoặc tín hiệu phụ.

Khi lưu candidate vào ngân hàng:

1. Save `QuestionBankQuestion`.
2. Generate E5 embedding prefix `passage:`.
3. Save `QuestionEmbedding`.
4. Set candidate `status = SAVED`.

### Backfill

Thêm endpoint hoặc command/service nội bộ:

- Tạo embedding cho toàn bộ question APPROVED chưa có embedding.
- Idempotent theo `questionId + textType + embeddingModel + inputTextHash`.
- Có log tổng số created/skipped/failed.

### Fallback

Nếu E5 load hoặc inference lỗi:

- Không làm sập review flow.
- Fallback về lexical duplicate hiện tại.
- Gắn warning: `Không chạy được kiểm tra trùng ngữ nghĩa, đã dùng kiểm tra từ khóa`.
- Trong production có thể đổi policy sang fail-closed sau khi model ổn định.

## VietQuill paraphrase full MCQ

### Phạm vi MVP

Input là một câu hỏi đã có trong ngân hàng:

- `stem`
- `optionA`
- `optionB`
- `optionC`
- `optionD`
- `correctAnswer`
- `explanation`
- `topic`
- `difficulty`

Output là nhiều candidate paraphrase:

- `stem`
- `optionA`
- `optionB`
- `optionC`
- `optionD`
- `correctAnswer` giữ nguyên
- `explanation` mặc định giữ nguyên trong phase đầu
- `warnings`
- `status`

Ghi chú: phase đầu nên giữ nguyên `explanation`. Paraphrase explanation có thể làm sau vì rủi ro đổi nghĩa cao và không cần thiết để tạo biến thể câu hỏi.

### Protected terms

Trước khi gọi model, cần phát hiện và bảo vệ:

- Số, tỉ lệ, phần trăm.
- Đơn vị: `mg`, `ml`, `mmHg`, `bpm`, `l/phút`, `giờ`, `phút`.
- Thuật ngữ viết hoa: `SpO2`, `ECG`, `CPR`, `ABCDE`.
- Tên thuốc, tên quy trình, thuật ngữ y khoa khó thay thế.
- Ký hiệu hoặc khoảng tham chiếu.

Sau paraphrase phải kiểm tra các protected terms vẫn còn hoặc có mapping hợp lệ.

### Prompt/input format nội bộ

Do VietQuill là paraphrase model, không prompt như chat model. Cần chuẩn hóa input thành một text có cấu trúc ổn định, ví dụ:

```text
paraphrase mcq:
Câu hỏi: ...
A. ...
B. ...
C. ...
D. ...
Đáp án đúng: B
Yêu cầu: diễn đạt lại câu hỏi và các phương án, giữ nguyên nghĩa và giữ nguyên đáp án đúng.
```

Sau output, parser phải tách lại `stem`, `optionA-D`. Nếu output không parse được đầy đủ thì candidate bị `REJECTED` hoặc job chunk bị failed.

### Validation sau paraphrase

Mỗi `ParaphraseCandidate` phải chạy:

1. Có đủ stem và A-D.
2. `correctAnswer` thuộc `A/B/C/D` và giữ nguyên từ source.
3. Không có option rỗng.
4. Không có option trùng nhau sau normalize.
5. Protected terms không bị mất.
6. Lexical difference đủ để không chỉ copy nguyên văn.
7. E5 similarity với câu gốc đủ cao để giữ nghĩa.
8. E5 duplicate với ngân hàng không vượt ngưỡng strong duplicate.
9. Không dùng lựa chọn kiểu `Tất cả đều đúng`, `Cả A và B`, `Không có đáp án nào`.

Status:

- `VALIDATED`: qua rule tự động.
- `NEED_REVIEW`: có warning nhưng chưa chắc sai.
- `REJECTED`: thiếu field, parse lỗi, mất đáp án đúng, mất protected term quan trọng, hoặc duplicate mạnh.
- `APPROVED`: reviewer duyệt.
- `SAVED`: đã lưu vào ngân hàng câu hỏi.

## Entity/API dự kiến

### Entity `ParaphraseJob`

- `id: Long`
- `sourceQuestion: QuestionBankQuestion`
- `mode: FULL_MCQ`
- `targetLanguage: vi`
- `requestedCount`
- `provider: vietquill`
- `model`
- `status`
- `errorMessage`
- `createdBy`
- timestamps

### Entity `ParaphraseCandidate`

- `id: Long`
- `job: ParaphraseJob`
- `sourceQuestion: QuestionBankQuestion`
- `stem`
- `optionA`
- `optionB`
- `optionC`
- `optionD`
- `correctAnswer`
- `explanation`
- `semanticSimilarityToSource`
- `lexicalDifferenceFromSource`
- `duplicateMaxSimilarity`
- `duplicateQuestionId`
- `duplicateQuestionStemSnapshot`
- `warnings`
- `status`
- `reviewerNotes`
- `savedQuestionId`
- timestamps

### Backend endpoints

```text
POST /api/v1/questions/{questionId}/paraphrase-jobs
GET  /api/v1/questions/{questionId}/paraphrase-jobs
GET  /api/v1/paraphrase-jobs/{jobId}
GET  /api/v1/paraphrase-candidates/{candidateId}
PATCH /api/v1/paraphrase-candidates/{candidateId}
POST /api/v1/paraphrase-candidates/{candidateId}/approve
POST /api/v1/paraphrase-candidates/{candidateId}/reject
POST /api/v1/paraphrase-candidates/{candidateId}/save-as-question
```

Request tạo job:

```json
{
  "requestedCount": 3,
  "changeStrength": "medium"
}
```

Khi save-as-question:

- Tạo `QuestionBankQuestion` mới.
- `questionType = PARAPHRASE`.
- `parentQuestion` hoặc `parentQuestionId` trỏ về câu gốc.
- Tạo E5 embedding cho câu mới.

## Frontend dự kiến

Thêm vào khu vực admin/evaluation hoặc ngân hàng câu hỏi:

- Nút `Diễn đạt lại` ở chi tiết câu hỏi hoặc row action trong bảng.
- Drawer/page tạo job:
  - số lượng biến thể,
  - mức thay đổi,
  - trạng thái model.
- Trang review paraphrase:
  - original bên trái,
  - candidate bên phải,
  - hiển thị stem + A-D + correct answer,
  - warnings,
  - duplicate info,
  - similarity score,
  - actions: sửa, duyệt, từ chối, lưu vào ngân hàng.

Toàn bộ text UI bằng tiếng Việt, không show enum thô.

## Test plan

### Unit tests

- E5 text prefix/normalization.
- Cosine similarity.
- Duplicate threshold mapping.
- Question embedding hash/idempotency.
- Protected term extraction.
- Paraphrase output parser.
- Paraphrase validation rules.
- Save-as-question chỉ cho `APPROVED`.

### Integration tests

- Mock E5 model service trả vector cố định.
- Mock VietQuill model service trả full MCQ hợp lệ.
- Paraphrase candidate mất option thì rejected.
- Paraphrase candidate mất protected term thì rejected hoặc need review.
- Save paraphrase tạo question type `PARAPHRASE` và embedding mới.

### Manual smoke test

1. Start app với `EMBEDDING_PROVIDER=e5`.
2. Backfill embedding cho câu hỏi có sẵn.
3. Tạo câu hỏi gần trùng và thấy `NEED_REVIEW` hoặc `REJECTED`.
4. Start app với VietQuill local model path.
5. Chọn 1 câu hỏi tiếng Việt có dấu.
6. Tạo 3 paraphrase full MCQ.
7. Verify stem/A-D đổi cách diễn đạt nhưng đáp án đúng vẫn giữ nghĩa.
8. Approve và save-as-question.

Ghi chú sau implementation: E5 đã có thể smoke test bằng model local trong `carehub-backend/models` nếu bật `RUN_MODEL_SMOKE=true`; thư mục này được ignore và không commit. Trên workspace hiện tại, VietQuill cũng đã được export ONNX seq2seq vào `carehub-backend/models/ngwgsang/vietquill-vit5-base-tsubaki` với layout `question/` + `sentence/`, và smoke test thật đã pass. Khi clone máy khác cần export lại model theo hướng dẫn ở trên, hoặc dùng `PARAPHRASE_PROVIDER=mock` để smoke UI/API trước.

Automated verification hiện có:

- `ParaphraseServiceTest`: tạo paraphrase job bằng mock model, sinh full MCQ candidate, approve và save-as-question tạo câu hỏi `PARAPHRASE` có parent question.
- `QuestionEmbeddingServiceTest`: kiểm lưu embedding idempotent theo hash, tạo embedding mới khi stem đổi, và backfill đếm đúng created/skipped.
- `DuplicateCheckServiceTest`: kiểm E5 semantic duplicate theo cosine/threshold, bỏ qua source question khi cần, và fallback lexical khi E5 lỗi.
- `ParaphraseValidationServiceTest`: kiểm mất protected terms/số liệu, option pattern bị cấm, E5 source similarity thấp, và duplicate mạnh đều bị reject.
- `E5EmbeddingModelSmokeTest`: opt-in bằng `RUN_MODEL_SMOKE=true`, chạy E5 ONNX thật trong JVM với model local ignored.
- `VietQuillParaphraseModelSmokeTest`: opt-in bằng `RUN_VIETQUILL_SMOKE=true`, chạy VietQuill ONNX seq2seq thật trong JVM khi `VIETQUILL_MODEL_PATH` có layout `question/` + `sentence/` hoặc một model seq2seq ở root.
- `E5TextPreprocessorTest`: kiểm prefix `query:` và `passage:`.
- `ProtectedTermServiceTest`: kiểm trích xuất và phát hiện mất thuật ngữ/số liệu cần bảo vệ.
- `VietQuillMcqParserTest`: kiểm parse output full MCQ và reject output thiếu option.
- `QuestionCandidateValidationServiceTest`: kiểm rule validation câu hỏi hiện hữu.

## Thứ tự implement đề xuất

1. Spike load VietQuill trong Spring Boot và paraphrase thử 1 full MCQ.
2. Spike load E5 trong Spring Boot và embed thử 2 câu tiếng Việt.
3. Thêm config/properties cho model runtime.
4. Thêm `QuestionEmbedding` entity/repository/service.
5. Tích hợp E5 vào `DuplicateCheckService`, giữ lexical fallback.
6. Tạo embedding khi save candidate vào question bank.
7. Thêm backfill embedding.
8. Thêm `ParaphraseJob` và `ParaphraseCandidate`.
9. Thêm VietQuill paraphrase service full MCQ.
10. Thêm validation/parsing/protected terms.
11. Thêm paraphrase review API.
12. Thêm frontend review flow.
13. Chạy compile/test/build.

## DeepSeek API key

DeepSeek vẫn dùng cho document question generation, độc lập với E5/VietQuill.

Backend đọc key tại:

```yaml
ai:
  generation:
    api-key: ${GENERATION_API_KEY:${DEEPSEEK_API_KEY:}}
```

Nghĩa là có thể cấu hình bằng một trong hai biến:

```properties
GENERATION_API_KEY=...
```

hoặc:

```properties
DEEPSEEK_API_KEY=...
```

Muốn gọi DeepSeek thật thì đặt thêm:

```properties
GENERATION_PROVIDER=api
GENERATION_API_BASE_URL=https://api.deepseek.com
```

Repo đang import env từ:

```yaml
spring:
  config:
    import:
      - optional:file:.env.properties
      - optional:file:env.properties
```

Vì vậy khi chạy backend từ folder `carehub-backend`, có thể đặt key trong:

```text
carehub-backend/.env.properties
```

Không commit file này. `.gitignore` đã ignore `.env`, `.env.properties`, `env.properties` và các file secret tương tự.

## Tham chiếu runtime/model

- ONNX Runtime Java API: https://onnxruntime.ai/docs/api/java/
- Optimum ONNX export guide: https://huggingface.co/docs/optimum/exporters/onnx/usage_guides/export_a_model
- VietQuill collection trên Hugging Face: https://huggingface.co/collections/ngwgsang/vietquill
- VietQuill question model: https://huggingface.co/ngwgsang/vietquill-vit5-base-question-tsubaki
- Multilingual E5 Small: https://huggingface.co/intfloat/multilingual-e5-small
