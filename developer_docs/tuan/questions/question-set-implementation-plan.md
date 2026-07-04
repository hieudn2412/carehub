# Question set implementation plan

## Mục tiêu

Implement phần **Bộ câu hỏi** thành tính năng thật trong admin/evaluation, thay vì chỉ lưu demo bằng `localStorage`.

Mục tiêu cuối:

- Admin tạo, sửa, xem, xóa mềm bộ câu hỏi.
- Bộ câu hỏi lấy câu từ `questions` đã duyệt trong ngân hàng câu hỏi.
- Có thể chọn câu thủ công hoặc tạo nhanh theo blueprint: danh mục/chủ đề, độ khó, số lượng, tránh trùng.
- Có snapshot thứ tự câu hỏi để dùng ổn định cho đề kiểm tra sau này.
- UI tiếng Việt, cùng layout admin hiện tại.
- Không phá luồng hiện có: Ngân hàng câu hỏi, tạo câu hỏi từ tài liệu, paraphrase, E5 duplicate.

## Implementation progress

- Phase 0: done. Đã xác nhận `Bộ câu hỏi` là collection câu hỏi có thứ tự, tách với `Cấu hình đề kiểm tra`.
- Phase 1: done. Backend có `QuestionSet`, `QuestionSetItem`, `QuestionSetItemSnapshot`, `QuestionSetStatus`, repository tương ứng.
- Phase 2: done. Backend có `QuestionSetService` và `QuestionSetController` với list/detail/create/update/activate/deactivate/archive/preview.
- Phase 3: done. Frontend có `questionSetApi.js`; `QuestionSetListPage` và `QuestionSetFormPage` dùng API thật thay vì `localStorage` làm nguồn chính.
- Phase 4: done ở mức MVP. Form chọn câu từ question bank, filter theo nội dung/topic/difficulty/source/type, giữ selected state, reorder bằng nút lên/xuống.
- Phase 5: done ở mức MVP. Backend preview theo difficulty distribution, category/topic, exclude IDs, avoid same source và random seed; frontend có panel xem trước và áp dụng.
- Phase 6: done. Khi activate tạo snapshot `question_set_item_snapshots` cho item hiện tại.
- Phase 7: done ở mức UI config. `TestConfigPage` load active question sets từ API và lưu `questionSetId` trong cấu hình local hiện tại.
- Phase 8: done một phần. Có export JSON/CSV/bản in đơn giản từ danh sách bộ câu hỏi và backend log metadata create/update/archive/activate/preview; import Excel và Word/PDF theo mẫu để phase sau.

## Hiện trạng

Frontend hiện có:

- Route:
  - `/admin/evaluation/question-sets`
  - `/admin/evaluation/question-sets/new`
  - `/admin/evaluation/question-sets/:id/edit`
- Files:
  - `carehub-frontend/src/features/evaluation/pages/QuestionSetListPage.jsx`
  - `carehub-frontend/src/features/evaluation/pages/QuestionSetFormPage.jsx`
  - `carehub-frontend/src/features/evaluation/styles/QuestionSetListPage.css`
  - `carehub-frontend/src/features/evaluation/styles/QuestionSetFormPage.css`
- Đang dùng:
  - `localStorage: carehub_question_sets`
  - `localStorage: carehub_questions`
  - demo `INITIAL_SETS`, `DEFAULT_QUESTIONS`

Backend hiện có:

- `questions` entity/API cho ngân hàng câu hỏi:
  - `QuestionBankQuestion`
  - `QuestionBankController`
  - `QuestionBankService`
  - `GET /api/v1/questions`
  - `GET /api/v1/questions/{questionId}`
- Chưa có entity/API cho bộ câu hỏi.

## Data model đề xuất

### `question_sets`

```sql
id bigint primary key
code varchar(64) unique null
name varchar(255) not null
description text null
category varchar(255) null
difficulty varchar(32) null
status varchar(32) not null -- DRAFT, ACTIVE, INACTIVE, ARCHIVED
question_count int not null default 0
created_by varchar(100) null
reviewed_by varchar(100) null
created_at timestamp not null
updated_at timestamp null
updated_by varchar(100) null
```

### `question_set_items`

```sql
id bigint primary key
question_set_id bigint not null references question_sets(id)
question_id bigint not null references questions(id)
position int not null
points numeric(5,2) null default 1
required boolean not null default true
created_at timestamp not null
updated_at timestamp null

unique(question_set_id, question_id)
unique(question_set_id, position)
```

### Enum

```java
QuestionSetStatus {
  DRAFT,
  ACTIVE,
  INACTIVE,
  ARCHIVED
}
```

## API contract

Base path:

```text
/api/v1/question-sets
```

### List

```http
GET /api/v1/question-sets?q=&category=&difficulty=&status=&page=&size=
```

Response item:

```json
{
  "id": 1,
  "code": "IC_BASIC_2026",
  "name": "Kiểm soát nhiễm khuẩn cơ bản",
  "description": "Bộ câu hỏi cho nhân viên mới",
  "category": "Kiểm soát nhiễm khuẩn",
  "difficulty": "Dễ",
  "status": "ACTIVE",
  "statusText": "Hoạt động",
  "questionCount": 24,
  "createdAt": "2026-07-01T10:00:00",
  "updatedAt": "2026-07-01T10:00:00"
}
```

### Detail

```http
GET /api/v1/question-sets/{setId}
```

Trả metadata + items đã sort theo `position`.

### Create

```http
POST /api/v1/question-sets
```

Payload:

```json
{
  "name": "Kiểm soát nhiễm khuẩn cơ bản",
  "description": "Bộ câu hỏi cho nhân viên mới",
  "category": "Kiểm soát nhiễm khuẩn",
  "difficulty": "Dễ",
  "status": "DRAFT",
  "questionIds": [1, 2, 3]
}
```

### Update metadata + selected questions

```http
PUT /api/v1/question-sets/{setId}
```

Payload giống create. Backend sẽ replace item list theo thứ tự `questionIds`.

### Add/remove/reorder items

MVP có thể chưa cần tách endpoint nếu `PUT` đã replace full list. Phase sau thêm:

```http
POST /api/v1/question-sets/{setId}/items
DELETE /api/v1/question-sets/{setId}/items/{itemId}
PUT /api/v1/question-sets/{setId}/items/reorder
```

### Publish/unpublish/archive

```http
POST /api/v1/question-sets/{setId}/activate
POST /api/v1/question-sets/{setId}/deactivate
DELETE /api/v1/question-sets/{setId}
```

`DELETE` là soft delete sang `ARCHIVED`.

### Auto-build preview

```http
POST /api/v1/question-sets/preview
```

Payload:

```json
{
  "category": "Kiểm soát nhiễm khuẩn",
  "difficultyDistribution": {
    "Dễ": 10,
    "Trung bình": 10,
    "Khó": 5
  },
  "excludeQuestionIds": [1, 2],
  "avoidSameSourceDocument": true,
  "randomSeed": 20260701
}
```

Response:

```json
{
  "questionIds": [10, 11, 12],
  "shortage": [
    { "difficulty": "Khó", "requested": 5, "available": 3 }
  ],
  "warnings": []
}
```

## Phase 0 — Chốt phạm vi và audit UI hiện tại

### Mục tiêu

Không làm lẫn “Bộ câu hỏi” với “Cấu hình đề kiểm tra”.

### Việc làm

- Xác nhận `Bộ câu hỏi` là collection câu hỏi có thứ tự.
- `Cấu hình đề kiểm tra` sau này sẽ dùng bộ câu hỏi hoặc blueprint từ bộ câu hỏi.
- Audit localStorage keys:
  - `carehub_question_sets`
  - `carehub_questions`
- Không xóa localStorage fallback ngay trong phase đầu để còn rollback UI.

### Acceptance

- Có docs thống nhất route, API, entity.
- Không đổi behavior runtime.

## Phase 1 — Backend schema/entity/repository

### Mục tiêu

Có persistence thật cho bộ câu hỏi.

### Backend changes

- Thêm entity:
  - `QuestionSet`
  - `QuestionSetItem`
- Thêm enum:
  - `QuestionSetStatus`
- Thêm repository:
  - `QuestionSetRepository`
  - `QuestionSetItemRepository`
- Nếu project đang dùng Hibernate auto-DDL, entity đủ để dev chạy.
- Nếu có migration riêng, thêm SQL migration tương ứng.

### Rules

- `name` bắt buộc, trim, không rỗng.
- `questionIds` không trùng.
- Chỉ cho thêm question có `QuestionBankStatus.APPROVED`.
- `position` bắt đầu từ 1 và liên tục.
- `questionCount` sync theo số item.

### Test

- Unit/service test tạo set với 3 câu.
- Test reject duplicate `questionIds`.
- Test reject question chưa approved.

## Phase 2 — Backend service/controller API

### Mục tiêu

Frontend có thể CRUD bộ câu hỏi qua API.

### Backend changes

- DTO request:
  - `CreateQuestionSetRequest`
  - `UpdateQuestionSetRequest`
  - `PreviewQuestionSetRequest`
- DTO response:
  - `QuestionSetSummaryResponse`
  - `QuestionSetDetailResponse`
  - `QuestionSetItemResponse`
  - `QuestionSetPreviewResponse`
- Service:
  - `QuestionSetService`
- Controller:
  - `QuestionSetController`

### Endpoint MVP

- `GET /question-sets`
- `GET /question-sets/{setId}`
- `POST /question-sets`
- `PUT /question-sets/{setId}`
- `POST /question-sets/{setId}/activate`
- `POST /question-sets/{setId}/deactivate`
- `DELETE /question-sets/{setId}`

### Status labels

Không trả enum thô cho UI dùng trực tiếp. Response nên có:

```json
{
  "status": "ACTIVE",
  "statusText": "Hoạt động"
}
```

Mapping:

- `DRAFT` → `Bản nháp`
- `ACTIVE` → `Hoạt động`
- `INACTIVE` → `Tạm ngưng`
- `ARCHIVED` → `Đã lưu trữ`

### Test

- Controller/service test list/detail/create/update.
- Test soft delete không mất row.
- Test activate set rỗng bị reject.

## Phase 3 — Frontend API client và migration khỏi localStorage

### Mục tiêu

UI bộ câu hỏi dùng backend thật, không dùng demo làm nguồn chính.

### Frontend changes

Thêm:

```text
carehub-frontend/src/features/evaluation/api/questionSetApi.js
```

Methods:

```js
listQuestionSets(params)
getQuestionSet(setId)
createQuestionSet(payload)
updateQuestionSet(setId, payload)
activateQuestionSet(setId)
deactivateQuestionSet(setId)
archiveQuestionSet(setId)
previewQuestionSet(payload)
```

Update:

- `QuestionSetListPage.jsx`
  - load từ API.
  - filter gửi params lên backend.
  - pagination theo backend hoặc client nếu backend trả list.
  - delete gọi archive.
  - loading/error/empty states.
- `QuestionSetFormPage.jsx`
  - edit load detail từ API.
  - save gọi create/update.
  - danh sách câu hỏi lấy từ `questionBankApi.listQuestions({ status: 'APPROVED' })`.
  - bỏ dependency vào `carehub_questions`.

### Rollback

- Có thể giữ fallback localStorage chỉ khi API lỗi trong dev, nhưng UI phải báo rõ “đang dùng dữ liệu tạm”.
- Production không dùng fallback.

### Test

- `npm run build`.
- Manual:
  - mở list.
  - tạo set.
  - edit set.
  - archive set.

## Phase 4 — Form chọn câu hỏi tốt hơn

### Mục tiêu

Admin chọn câu nhanh và ít sai.

### UI requirements

Form gồm 2 vùng:

- Cột trái: metadata bộ câu hỏi.
- Cột phải: câu hỏi đã chọn, có thứ tự.
- Bảng/ngăn chọn câu hỏi:
  - search stem.
  - filter topic/category.
  - filter difficulty.
  - filter source document.
  - filter question type: `ORIGINAL/PARAPHRASE`.
  - badge duplicate/parent nếu là paraphrase.

### Interactions

- Chọn từng câu.
- Chọn tất cả trang hiện tại.
- Bỏ chọn.
- Kéo thả hoặc nút lên/xuống để reorder.
- Cảnh báo nếu:
  - set chưa có câu nào.
  - có quá nhiều câu cùng source document.
  - phân bổ độ khó lệch so với difficulty của bộ.

### UI text

Toàn bộ tiếng Việt:

- `Bản nháp`
- `Hoạt động`
- `Tạm ngưng`
- `Đã lưu trữ`
- `Câu đã chọn`
- `Thêm vào bộ`
- `Bỏ khỏi bộ`
- `Đổi thứ tự`

### Test

- Chọn câu ở page 1, chuyển page, câu vẫn giữ.
- Reorder rồi save, reload vẫn đúng thứ tự.
- Search/filter không làm mất selected state.

## Phase 5 — Auto-build theo blueprint

### Mục tiêu

Tạo bộ câu hỏi nhanh từ ngân hàng câu hỏi bệnh viện.

### Backend changes

Implement:

```http
POST /api/v1/question-sets/preview
```

Selection rules:

- Chỉ chọn `APPROVED`.
- Ưu tiên `ORIGINAL`, cho phép `PARAPHRASE` nếu thiếu.
- Không chọn câu có duplicate strong nếu metadata còn lưu được.
- Tránh quá nhiều câu cùng `sourceDocument` nếu `avoidSameSourceDocument=true`.
- Random ổn định theo `randomSeed`.
- Trả shortage nếu không đủ.

Sau preview, frontend có thể:

- “Áp dụng vào bộ hiện tại”.
- “Tạo bộ mới từ preview”.

### Frontend changes

Trong `QuestionSetFormPage` thêm panel:

- Tổng số câu muốn tạo.
- Phân bổ độ khó.
- Danh mục/chủ đề.
- Toggle tránh cùng nguồn.
- Nút `Xem trước`.
- Bảng preview + warnings.
- Nút `Áp dụng`.

### Test

- Preview đủ câu.
- Preview thiếu câu khó.
- Cùng seed trả cùng thứ tự.
- Khác seed đổi thứ tự.

## Phase 6 — Publish/version/snapshot

### Mục tiêu

Bộ câu hỏi dùng cho kiểm tra không bị thay đổi ngầm khi ngân hàng câu hỏi sửa.

### Option MVP

Giữ `question_set_items.question_id` trực tiếp. Khi question bank thay đổi, bộ câu hỏi dùng bản mới.

### Option production

Thêm snapshot:

```sql
question_set_item_snapshots
  id
  question_set_item_id
  stem
  option_a
  option_b
  option_c
  option_d
  correct_answer
  explanation
  source_document
  snapshot_at
```

Khi `activate`, tạo snapshot hiện tại.

### Rules

- `ACTIVE` set không cho sửa trực tiếp item nếu đã dùng trong bài kiểm tra.
- Muốn sửa thì tạo bản nháp mới hoặc duplicate set.
- `deactivate` không xóa snapshot.

### Test

- Activate tạo snapshot.
- Sửa question bank sau activate không làm thay đổi snapshot.
- Duplicate set tạo draft mới.

## Phase 7 — Tích hợp với cấu hình đề kiểm tra

### Mục tiêu

`TestConfigPage` dùng bộ câu hỏi thật thay vì cấu hình rời rạc.

### Backend hướng sau

- `exam_configs` hoặc entity hiện có tham chiếu:
  - `questionSetId`
  - hoặc blueprint.
- Khi tạo đề kiểm tra:
  - lấy câu từ active question set.
  - random theo seed nếu cần.
  - giữ snapshot attempt.

### Frontend changes

- `TestConfigPage` có select `Bộ câu hỏi`.
- Hiển thị:
  - số câu.
  - difficulty distribution.
  - trạng thái active/inactive.
- Không cho dùng set `DRAFT/ARCHIVED`.

### Test

- Config chọn active set.
- Config reject inactive set.
- Tạo attempt giữ đúng số câu.

## Phase 8 — Import/export và vận hành

### Export

Thêm action:

- Export JSON.
- Export CSV/XLSX.
- Export bản in đơn giản.

### Import

Phase sau có thể import danh sách question ids hoặc file Excel:

- `stem`
- `optionA-D`
- `correctAnswer`
- `topic`
- `difficulty`

Import vào question bank trước, rồi tạo set.

### Audit/log

- Log khi:
  - create/update/archive.
  - activate/deactivate.
  - auto-build preview/apply.
- Không log full đáp án nếu log production có nguy cơ lộ đề.

### Ops

- Theo dõi:
  - số active sets.
  - set không có câu.
  - set dùng câu archived/rejected.

## Thứ tự implement khuyến nghị

1. Phase 1 + 2: backend entity/API.
2. Phase 3: frontend bỏ localStorage.
3. Phase 4: UX chọn câu tốt hơn.
4. Phase 5: auto-build preview.
5. Phase 6: snapshot khi active.
6. Phase 7: nối sang cấu hình đề kiểm tra.
7. Phase 8: export/import/audit.

## Checklist nghiệm thu MVP

- Tạo bộ câu hỏi mới với câu từ ngân hàng câu hỏi.
- Reload trang vẫn thấy bộ câu hỏi.
- Edit metadata và danh sách câu hỏi.
- Reorder câu hỏi và reload vẫn đúng thứ tự.
- Không thêm được câu chưa approved.
- Không activate được bộ rỗng.
- Archive không hard delete.
- UI không còn dùng enum thô.
- `npm run build` pass.
- Backend targeted tests pass.

## Open questions

- Có cần mỗi bộ câu hỏi thuộc một khoa/phòng ban không?
- Có cần phân quyền người tạo chỉ thấy bộ của mình không?
- Bộ câu hỏi active có được sửa trực tiếp không, hay phải tạo version mới?
- Khi tạo đề kiểm tra, có dùng toàn bộ bộ câu hỏi hay random N câu từ bộ?
- Có cần export Word/PDF theo mẫu bệnh viện không?
