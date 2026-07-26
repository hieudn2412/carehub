# L1 Unit Tests — hướng dẫn điền `Report 5.2_L1-UnitTests_Template.xlsx`

Bộ dữ liệu này để Claude cowork (hoặc bạn) paste vào workbook L1. **204 test case / 9 sheet**, mỗi
dòng CSV tương ứng 1-1 với một `@Test` / `it()` thật trong repo.

## Số liệu cho mục 5.1 của Report 5.0

| Sheet trong workbook | File CSV | Case | Pass | Fail |
|---|---|---|---|---|
| `TrainingRecordStateMachine` | `TrainingRecordStateMachine.csv` | 16 | 16 | 0 |
| `TrainingComplianceCalculator` | `TrainingComplianceCalculator.csv` | 22 | 22 | 0 |
| `FormScoringPolicy` | `FormScoringPolicy.csv` | 22 | 22 | 0 |
| `FormScoreCalculator` | `FormScoreCalculator.csv` | 14 | 14 | 0 |
| `CompetencyClassificationService` | `CompetencyClassificationService.csv` | 14 | 12 | **2** |
| `DuplicateCheckService` | `DuplicateCheckService.csv` | 22 | 22 | 0 |
| `AccessPolicy-EvaluationSecurity` | `AccessPolicy-EvaluationSecurity.csv` | 26 | 26 | 0 |
| `BoundaryValues` | `BoundaryValues.csv` | 24 | 21 | **3** |
| `Frontend` | `Frontend.csv` | 44 | 43 | **1** |
| **Tổng** | | **204** | **198** | **6** |

**6 case Fail là cố ý** — chúng assert theo SRS nên fail chính là bằng chứng của defect:
`L1-CCS-13`, `L1-CCS-14` (D5) · `L1-BV-04` (D3) · `L1-BV-10` (D12) · `L1-BV-19` (D13) ·
`L1-FE-22` (D4). Chi tiết ở `SRS-CODE-DIVERGENCE.md`. Không sửa code trong phạm vi công việc làm
test — 6 dòng này là đầu vào cho mục 5.2 "Root Cause Analysis" của Report 5.0.

Branch coverage (JaCoCo, 11 class trong phạm vi L1): **80.9 % – 100 %**, đạt mốc M1 ≥ 80 %.
Báo cáo: `carehub-backend/target/site/jacoco/index.html`.

## Cách paste vào workbook

Trong mỗi sheet của template, layout là:
- dòng 1: tiêu đề sheet (merge A:L)
- dòng 2: dòng "HOW TO USE" (merge A:L)
- dòng 4: header 12 cột
- **dòng 5 trở đi: dữ liệu** (gồm cả các dòng divider `▶ Block: …`)

Mỗi file CSV có cấu trúc: dòng 1 = tiêu đề sheet, dòng 2 = header 12 cột, dòng 3+ = dữ liệu.
→ **Paste vùng dữ liệu (từ dòng 3 của CSV) vào ô `A5` của sheet tương ứng.** Tiêu đề ở dòng 1 CSV
dùng để cập nhật ô `A1`; không cần paste dòng header.

Việc cần làm với workbook:
1. **Xoá 4 sheet mẫu e-commerce**: `OrderStateMachine`, `OrderService`, `InventoryService`,
   `NotificationDispatcher`.
2. **Giữ và sửa** sheet `BoundaryValues` và `Frontend` (đã có sẵn trong template, chỉ thay dữ liệu).
3. **Tạo 7 sheet mới** theo tên ở bảng trên, copy format từ một sheet cũ để giữ header, merge,
   conditional formatting và data validation.
4. **Sheet `Introduction`**: giữ nguyên toàn bộ phần Coverage Techniques và Column Definitions. Chỉ
   sửa 2 chỗ:
   - `B2` và `B17` (Primary tool) → `JUnit 5 + Mockito + AssertJ + JaCoCo (backend Java) · Vitest + React Testing Library + MSW (frontend JavaScript)`
   - thêm một bảng chú giải tiền tố Test ID (xem mục dưới)

### Data validation phải giữ được

Template có dropdown ở 2 cột; dữ liệu đã được sinh đúng tập giá trị nên không vỡ:
- cột `E` (Priority): chỉ `P1`, `P2`, `P3`
- cột `J` (Status): chỉ `Not Run`, `Pass`, `Fail`, `Blocked`, `Skip`

Sau khi paste, mở rộng vùng validation xuống hết số dòng mới của từng sheet.

### Ô nhiều dòng

Các cột Given / When / Then chứa ký tự xuống dòng thật (không phải `\n` literal). Khi paste giữ
nguyên; bật **Wrap text** cho cột F, G, H và đặt độ cao dòng tự động.

## Chú giải tiền tố Test ID (thêm vào sheet Introduction)

| Tiền tố | Sheet | Class / module under test |
|---------|-------|---------------------------|
| `L1-TRSM` | TrainingRecordStateMachine | `training.service.TrainingRecordStateMachine` |
| `L1-TCC` | TrainingComplianceCalculator | `training.service.TrainingComplianceCalculator` |
| `L1-FSP` | FormScoringPolicy | `form.scoring.FormScoringPolicy` |
| `L1-FSC` | FormScoreCalculator | `form.submission.service.FormScoreCalculator` |
| `L1-CCS` | CompetencyClassificationService | `questiongeneration.service.CompetencyClassificationService` |
| `L1-DUP` | DuplicateCheckService | `questiongeneration.service.DuplicateCheckService` |
| `L1-SEC` | AccessPolicy-EvaluationSecurity | `training.service.TrainingAccessPolicy` (01–14) + `questiongeneration.security.EvaluationSecurity` (15–26) |
| `L1-BV` | BoundaryValues | `TrainingDomainValidator` · `TrainingLegacyDurationParser` · `CosineUtil` · `ExamAssignmentService` |
| `L1-FE` | Frontend | `httpClient` · `evidenceFile` · `authNavigation` · `tokenStorage` · `useOtpExpiry` |

## Sinh lại dữ liệu

CSV **không phải file để sửa tay** — sửa sẽ bị ghi đè. Nguồn sự thật:

| Cột | Nguồn |
|-----|-------|
| Test ID, Coverage Technique, Covers | `@DisplayName(...)` trong file test Java / `it('...')` trong file test JS |
| SRS Reference, Priority, Given/When/Then, Negative?, Notes | `l1-testcases.json` |
| Status, Defect ID | báo cáo test mới nhất (surefire XML + `vitest-report.json`) |

```bash
# 1. chạy test để có báo cáo mới
cd carehub-backend && ./mvnw test -Dmaven.test.failure.ignore=true
cd ../carehub-frontend && npm test

# 2. kiểm tra ID khớp hai chiều giữa code và JSON (exit 1 nếu lệch)
cd .. && python scripts/l1-testcases.py check

# 3. sinh lại 9 file CSV với Status thật
python scripts/l1-testcases.py build
```

`check` sẽ báo lỗi nếu: có Test ID trong code mà thiếu trong JSON (hoặc ngược lại), trùng ID, cột
SRS Reference trống, Priority không thuộc P1/P2/P3, hoặc Negative? không thuộc Yes/No. `build` từ
chối ghi CSV khi `check` thất bại, nên CSV không bao giờ lệch khỏi code.

## 11 class trong phạm vi coverage L1

Rule JaCoCo trong `carehub-backend/pom.xml` (`jacoco-check-branch-coverage`) chốt ở mức CLASS, không
phải PACKAGE — vì `training.service` và `form.submission.service` còn chứa các service orchestration
lớn không thuộc phạm vi L1. Danh sách 11 class phải khớp giữa `pom.xml` và bảng chú giải ở trên.

Chạy `./mvnw verify` để enforce mốc ≥ 80 % branch.

## Tài liệu liên quan

- `SRS-CODE-DIVERGENCE.md` — 13 sai lệch SRS ↔ code (D1…D13), kèm test chứng minh và đề xuất xử lý.
- `SRS-v1.4-AMENDMENT.md` — nội dung paste-ready để cập nhật SRS: mục mới `4.5 Boundary Value
  Register` (BV-01…BV-18) và các chỗ sửa D6/D9/D10. **Chưa ghi vào file .docx.**
