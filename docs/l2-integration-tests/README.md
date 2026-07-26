# L2 Integration Tests — hướng dẫn điền `Report 5.2_L2-IntegrationTests_Template.xlsx`

Bộ dữ liệu này để Claude cowork (hoặc bạn) paste vào workbook L2 (`CareHub_IntegrationTests_L2.xlsx`).
**93 test case / 9 sheet**, mỗi dòng CSV tương ứng 1-1 với một `@Test` thật trong
`carehub-backend/src/test/java` — 58 case adopt từ 14 class integration test có sẵn (chỉ gắn
`@DisplayName` mang Test ID), 35 case viết mới trong 6 class `*FlowIntegrationTest` /
`ConcurrencyIntegrationTest` / `NotificationPipelineIntegrationTest`.

Hợp đồng dữ liệu (15 cột, enum Coverage Technique, quy ước Given/Then) theo
`docs/L2-L3-TESTCASE-BRIEF.md`.

## Số liệu cho mục 5.1 của Report 5.0

| Sheet trong workbook | File CSV | Case | Pass | Fail | Blocked |
|---|---|---|---|---|---|
| `L2-AuthService` | `L2-AuthService.csv` | 10 | 10 | 0 | 0 |
| `L2-UserReference` | `L2-UserReference.csv` | 14 | 14 | 0 | 0 |
| `L2-TrainingRecords` | `L2-TrainingRecords.csv` | 18 | 17 | **1** | 0 |
| `L2-TrainingCompliance` | `L2-TrainingCompliance.csv` | 10 | 10 | 0 | 0 |
| `L2-FormBuilderScoring` | `L2-FormBuilderScoring.csv` | 10 | 10 | 0 | 0 |
| `L2-FormSubmission` | `L2-FormSubmission.csv` | 5 | 3 | **2** | 0 |
| `L2-ExamEvaluation` | `L2-ExamEvaluation.csv` | 11 | 10 | **1** | 0 |
| `L2-NotificationService` | `L2-NotificationService.csv` | 12 | 11 | 0 | **1** |
| `L2-Workflows` | `L2-Workflows.csv` | 3 | 3 | 0 | 0 |
| **Tổng** | | **93** | **88** | **4** | **1** |

**4 case Fail là cố ý (EXPECTED FAIL)** — chúng assert theo hành vi đúng nghiệp vụ nên fail chính
là bằng chứng của defect trong production code:

| Test ID | Defect | Nội dung một dòng |
|---|---|---|
| `L2-SCR-04` | **D28** | Direct-evaluation submission FAILED → NPE → 500 + rollback mất cả bài nộp |
| `L2-EXM-10` | **D33** | Thi **đậu** nhưng listener AFTER_COMMIT chết vì ClassCastException → không cộng giờ CME, không notification |
| `L2-TRN-17` | **D34** | Xoá minh chứng: stamp `storage_deleted_at` ném "No active transaction" → row treo chờ sweep 10 phút |
| `L2-SCR-05` | **D35** | Notification phát từ flow transactional bị nuốt im lặng (join transaction đã commit) |

D33/D34/D35 chung một gốc — listener `AFTER_COMMIT` làm việc transactional thiếu `REQUIRES_NEW`.
Chi tiết + fix 1 dòng cho từng chỗ ở `docs/l1-unit-tests/SRS-CODE-DIVERGENCE.md` (mục D25–D35).
Không sửa production code trong phạm vi công việc làm test.

**1 case Blocked**: `L2-NTF-11` (TTL dead-letter của retry queue 15 phút) — cần RabbitMQ broker
thật; test tồn tại trong code với `@Disabled` ghi rõ lý do, workbook để `Status = Blocked`.

Toàn bộ suite backend sau đợt L2: **627 test / 9 failure / 0 error / 8 skipped** — 9 failure đúng
bằng 5 case L1 (D3, D5×2, D12, D13) + 4 case L2 ở bảng trên; không có failure ngoài phạm vi.

## Môi trường chạy — đọc trước khi diễn giải kết quả

- **H2 in-memory `MODE=PostgreSQL` thay cho PostgreSQL 17** (Docker daemon tắt, không dùng
  Testcontainers). Schema do Hibernate `ddl-auto: create-drop` suy ra từ entity — **không phải**
  schema Postgres production (dự án không có migration tool). Unique constraint, `@Version`,
  FK đều được thử thật; nhưng semantics khoá pessimistic, SQL gốc Postgres
  (`count(*) FILTER`, cast `::`, `date_trunc AT TIME ZONE`) thì H2 không tái hiện được — các case
  đó hoặc Blocked hoặc có Notes cảnh báo (vd `L2-FLOW-03`).
- **RabbitMQ không có broker**: biên `EmailProducer` được capture bằng
  `CapturingEmailProducerConfig` (bean `@Primary` trong test); `EmailConsumer` được gọi thẳng với
  `Channel`/`RabbitTemplate` mock (`L2-NTF-09/10`). Cột Infrastructure ghi hạ tầng mà case *đại
  diện*, cột Notes ghi cách tái hiện thật.
- **Cloudflare R2** thay bằng store in-memory (`TestEvidenceStorageConfig`), moderation stub điều
  khiển bằng tên file (`ModerationTestConfig`) — cả hai là test double có sẵn của dự án.
- Các class L2 mới **không** `@Transactional` (cố ý): case AFTER_COMMIT/concurrency cần transaction
  commit thật. Dọn dẹp bằng fixture code duy nhất (`AtomicInteger SEQ`) + assert theo id.

## Cách paste vào workbook

Mỗi file CSV: dòng 1 = tiêu đề sheet, dòng 2 = header 15 cột, dòng 3+ = dữ liệu (gồm cả dòng
divider `▶ Block: …`). Trong template, dữ liệu bắt đầu ở dòng 5 (dòng 1 tiêu đề, dòng 2 how-to,
dòng 4 header) → **paste vùng dữ liệu (từ dòng 3 của CSV) vào ô `A5`** của sheet tương ứng; dòng 1
CSV dùng để cập nhật ô `A1`.

Việc cần làm với workbook:
1. **Xoá các sheet mẫu e-commerce** còn nguyên trong template.
2. **Tạo 9 sheet mới** theo tên ở bảng trên (copy format từ một sheet mẫu trước khi xoá, để giữ
   header 15 cột, merge, conditional formatting và data validation).
3. **Sheet `Introduction`**: giữ phần Coverage Techniques + Column Definitions; sửa Primary tool →
   `JUnit 5 + @SpringBootTest + MockMvc + H2 (MODE=PostgreSQL, thay Testcontainers) + surefire`;
   thêm bảng chú giải tiền tố Test ID (mục dưới) và ghi chú môi trường H2/no-broker ở trên.

### Data validation phải giữ được

- cột `E` (Priority): chỉ `P1`, `P2`, `P3`
- cột `M` (Status): chỉ `Not Run`, `Pass`, `Fail`, `Blocked`, `Skip`

Dữ liệu đã sinh đúng tập giá trị nên không vỡ; sau khi paste, mở rộng vùng validation xuống hết số
dòng mới.

### Ô nhiều dòng

Given / When / Then / Infrastructure chứa ký tự xuống dòng thật. Bật **Wrap text** cho cột G–K và
đặt độ cao dòng tự động.

## Chú giải tiền tố Test ID (thêm vào sheet Introduction)

| Tiền tố | Sheet | Phạm vi |
|---------|-------|---------|
| `L2-AUTH` | L2-AuthService | login/refresh/logout/OTP — `AuthControllerIntegrationTest` (01–04) + `AuthFlowIntegrationTest` (05–10) |
| `L2-REF` | L2-UserReference | user CRUD + import Excel + catalog loại hình đào tạo (3 class IT) |
| `L2-TRN` | L2-TrainingRecords | CRUD hồ sơ + chuỗi minh chứng + legacy import (01–14 adopt, 15–18 mới) |
| `L2-CMP` | L2-TrainingCompliance | trạng thái giờ CME, ledger, scope filter, query proof |
| `L2-QLT` | L2-FormBuilderScoring | builder lifecycle + publish re-point + recalculation job (08–10 mới) |
| `L2-SCR` | L2-FormSubmission | vòng đời bài nộp + side effect kết quả FAILED (04–05 mới) |
| `L2-EXM` | L2-ExamEvaluation | dashboard scope (01–03) + vòng đời attempt SRS 4.4 (04–11 mới) |
| `L2-NTF` | L2-NotificationService | API in-app + chuỗi dispatch + retry ladder + scan CME (04–12 mới) |
| `L2-FLOW` | L2-Workflows | concurrency 2-transaction thật: optimistic loser, check-then-insert race, double start |

## Sinh lại dữ liệu

CSV **không phải file để sửa tay** — sửa sẽ bị ghi đè. Nguồn sự thật:

| Cột | Nguồn |
|-----|-------|
| Test ID, Coverage Technique | `@DisplayName("L2-XXX-NN | Technique: …")` trong file test Java |
| SRS Reference … Notes (12 cột giữa) | `l2-testcases.json` |
| Status, Defect ID | surefire XML mới nhất (`statusOverride` trong JSON thắng — dùng cho Blocked) |

```bash
# 1. chạy test để có báo cáo mới (9 failure cố ý — dùng failure.ignore)
cd carehub-backend && ./mvnw clean test -Dmaven.test.failure.ignore=true

# 2. kiểm tra ID khớp hai chiều code ↔ JSON, enum kỹ thuật, tỉ lệ Negative ≥ 1/4 (exit 1 nếu lệch)
cd .. && python scripts/l2-testcases.py check

# 3. sinh lại 9 file CSV với Status thật
python scripts/l2-testcases.py build
```

## Tài liệu liên quan

- `docs/L2-L3-TESTCASE-BRIEF.md` — hợp đồng 15 cột + enum kỹ thuật + quy ước Given/Then (L3 dùng sau).
- `docs/l1-unit-tests/SRS-CODE-DIVERGENCE.md` — toàn bộ sổ defect D1–D35; đợt L2 thêm D25–D35,
  trong đó 4 EXPECTED FAIL ở trên và họ bug AFTER_COMMIT (D33/34/35).
- `docs/l1-unit-tests/README.md` — pipeline L1 tương tự (217 case / 9 sheet).
