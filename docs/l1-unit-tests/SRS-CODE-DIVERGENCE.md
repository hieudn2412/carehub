# SRS ↔ Code Divergence Report — L1 Unit Tests

Nguồn: `docs/Report 3.0_SRS_VietDuc-Care_v1.3.docx` đối chiếu với code tại nhánh `ManhTuan`.
Tài liệu này là đầu vào cho:
- cột **Defect ID** của các CSV trong `docs/l1-unit-tests/`
- mục **5.2 Test Analysis Notes → Root Cause Analysis / Coverage Gaps** của `Report 5.0_TestPlan`

Mỗi mục dưới đây có ít nhất một test L1 chứng minh. Các test được đánh dấu **EXPECTED FAIL** là
cố ý: chúng assert theo SRS, nên fail chính là bằng chứng của sai lệch. Không sửa code trong phạm vi
công việc làm test — quyết định sửa hay đổi SRS thuộc về chủ dự án.

## Tổng quan

| ID | Mức | Loại | Trạng thái test | Đề xuất |
|----|-----|------|-----------------|---------|
| D1  | Cao | Thiếu tính năng | Không có test (blocked) | Sửa SRS **hoặc** làm tính năng |
| D2  | Thấp | Tài liệu sai | — | ✅ Đã sửa `CLAUDE.md` |
| D3  | Trung bình | Message sai | `L1-BV-04` EXPECTED FAIL | Sửa code (1 dòng) |
| D4  | Cao | Lệch ngưỡng 3 nơi | `L1-FE-22` EXPECTED FAIL | Sửa frontend về 5 MB |
| D5  | **Nghiêm trọng** | Bug logic | `L1-CCS-13`, `L1-CCS-14` EXPECTED FAIL | Sửa code |
| D6  | Trung bình | SRS lạc hậu | `L1-CCS-01` (pass, theo code) | ✅ Đã sửa SRS → v1.4 |
| D7  | Trung bình | Thiếu validation | Không có test (blocked) | Làm validation hoặc bỏ FR-045 |
| D8  | Trung bình | Khác thiết kế | `L1-FSP-20/21/22` (pass, theo code) | Sửa SRS hoặc thêm ràng buộc |
| D9  | Thấp | SRS lạc hậu | — | ✅ Đã sửa SRS → v1.4 |
| D10 | Thấp | SRS lạc hậu | — | ✅ Đã sửa SRS → v1.4 |
| D11 | Trung bình | Test lạc hậu | ✅ Đã sửa test | — |
| D12 | **Cao** | Bug (NPE → HTTP 500) | `L1-BV-10` EXPECTED FAIL | Sửa code |
| D13 | **Cao** | Bug (dead code) | `L1-BV-19` EXPECTED FAIL | Sửa code |

---

## D1 — Luồng "Approved" trong SRS chưa tồn tại trong code

**SRS**: BR-05 ("Training hours are credited only after the record status changes to 'Approved' by a
Clinical Manager"), NAC-05-01, AC-05-02, FR-021, FR-023, AC-04-01 ("creates a 'Pending Review'
record").

**Code**:
- `training/enums/TrainingRecordStatus.java` chỉ có `DRAFT, SUBMITTED, CANCELLED` — không có
  `APPROVED` / `REJECTED` / `PENDING_REVIEW` / `ARCHIVED`.
- `training/repository/TrainingRecordRepository.java:296` — query tên là
  `sumApprovedHoursForEmployee` nhưng lọc `r.workflowStatus = SUBMITTED`.
- `TrainingComplianceCalculator.sumSubmittedHours` cũng lọc `SUBMITTED`.

**Hệ quả**: giờ đào tạo được tính ngay khi nhân viên nộp, không cần manager phê duyệt. NAC-05-01
("pending hours still report Non-Compliant") không thể xảy ra. Tên method gây hiểu nhầm.

**Trạng thái test**: không viết được test L1 cho tính năng chưa tồn tại. Các dòng CSV liên quan để
`Status = Blocked`. `TrainingComplianceCalculatorTest` có javadoc ghi rõ nó assert theo code.

**Đề xuất**: chọn một trong hai — (a) bỏ/điều chỉnh BR-05 + FR-021/023 + NAC-05-01 trong SRS cho
khớp mô hình "nộp là tính"; (b) làm đúng SRS: thêm `APPROVED`/`REJECTED`, đổi state machine, đổi
query. Nếu chọn (b), tối thiểu nên đổi tên `sumApprovedHoursForEmployee` ngay để hết gây nhầm.

---

## D2 — `CLAUDE.md` mô tả sai state machine

**Đã sửa.** Dòng cũ ghi `DRAFT → SUBMITTED → APPROVED/REJECTED, with RETURN_TO_DRAFT`, không khớp
enum 3 giá trị. Đã đổi thành mô tả đúng: `DRAFT → SUBMITTED`, `SUBMITTED → DRAFT` (return-to-draft),
`→ CANCELLED` (SUBMITTED chỉ admin), `CANCELLED` là terminal.

---

## D3 — Message lỗi nói giới hạn 24 giờ nhưng code chặn ở 999

**Code**: `training/validation/TrainingDomainValidator.java`
- dòng 14: `MAX_DIRECT_RECORD_HOURS = BigDecimal.valueOf(999)`
- dòng 37: `throw new BadRequestException("Declared hours must not exceed 24 for manual records")`

**Hệ quả**: người dùng khai 500 giờ được chấp nhận; khai 1000 giờ thì nhận thông báo sai lệch hoàn
toàn với giá trị thực tế được enforce.

**Test**: `L1-BV-04` (`TrainingDomainValidatorTest.tooManyHoursMessageMustStateTheEnforcedLimit`)
— **EXPECTED FAIL**, assert message phải chứa `999`.

**Đề xuất**: sửa message thành 999, hoặc hạ hằng số xuống 24 nếu 24 mới là ý định gốc. Cần chốt con
số nào đúng nghiệp vụ trước khi sửa — chúng khác nhau 40 lần.

---

## D4 — Giới hạn file minh chứng lệch nhau ở 3 nơi

| Nơi | Giới hạn | File |
|-----|----------|------|
| SRS | 5 MB | BR-04, FR-017, AC-04-01 |
| Backend validation | 5 MB | `TrainingDomainValidator.java:20` |
| Backend optimization | 20 MB input | `EvidenceOptimizationService.java:38` |
| **Frontend** | **20 MB** | `evidenceFile.js:1` |

**Hệ quả**: người dùng chọn file 10 MB, frontend báo hợp lệ, upload xong backend trả 400. Trải
nghiệm xấu và tốn băng thông.

**Test**: `L1-FE-22` (`evidenceFile.test.js`) — **EXPECTED FAIL**, assert file 5 MB + 1 phải bị
chặn ở client. `L1-BV-07` xác nhận backend chặn đúng ở 5 MB (pass).

**Đề xuất**: hạ `MAX_EVIDENCE_FILE_SIZE_BYTES` ở frontend về 5 MB và sửa message "20 MB" tương ứng.
Nếu 20 MB mới là ý định thì phải nâng cả `TrainingDomainValidator` và SRS BR-04/FR-017.

---

## D5 — Bug nghiêm trọng: khe giữa các band năng lực → điểm thấp bị xếp tier cao nhất

**SRS**: DC-05 — "Classification bands must be contiguous and non-overlapping across 0–100".

**Code**: `questiongeneration/service/CompetencyClassificationService.java`
- dòng 125, 133, 141, 149: `defaultThresholds()` tạo mỗi band với `maxScore = nextMin − 0.01`
  → band NOT_COMPETENT là `[0, 3.99]`, band BEGINNER là `[4.0, 5.99]`, …
- dòng 55: `classify()` khớp bằng `score >= min && score <= max` (đóng hai đầu)
- dòng 60–63: khi không band nào khớp, fallback trả về band có `maxScore` **lớn nhất**

**Hệ quả**: điểm nằm trong khe — ví dụ `3.995` — không khớp band nào, rơi vào fallback và được xếp
`ADVANCED` (tier **cao nhất**) dù thực chất là điểm gần thấp nhất. Với thang 2 chữ số thập phân
(`FormScoreCalculator` dùng scale 2, `NotificationVariableFormatter.SCORE_SCALE = 2`) khe này có
thật, không phải trường hợp lý thuyết.

**Test**:
- `L1-CCS-13` — **EXPECTED FAIL**: `band NOT_COMPETENT max (3.99) must meet band BEGINNER min (4.0)`
- `L1-CCS-14` — **EXPECTED FAIL**: `classifyOverall(3.995)` trả `ADVANCED`, assert phải là
  `NOT_COMPETENT`

**Đề xuất**: bỏ `−0.01`, dùng band nửa mở `[min, nextMin)` — tức đổi điều kiện khớp thành
`score >= min && score < max` và đặt `maxScore = nextMin`. Đồng thời đổi fallback: điểm ngoài mọi
band nên trả `NOT_COMPETENT` (an toàn) chứ không phải band cao nhất.

---

## D6 — Thang điểm và tên tier khác SRS

**SRS**: BR-01, BR-11, FR-052 — tier `Good / Average / Weak`, dải `0–100`.
**Code**: `CompetencyLevel` = `NOT_COMPETENT, BEGINNER, BASIC, PROFICIENT, ADVANCED` (5 tier), thang
`0–10` (`CompetencyClassificationService.java:24-27`, javadoc dòng 30).

Code còn có cơ chế "self-healing": nếu config lưu theo thang 100 thì chia 10 (dòng 46–54).

**Quyết định**: sửa SRS theo code (code là thực tế đang chạy, và 5 tier chi tiết hơn 3 tier).
**Đã cập nhật** SRS → v1.4.

---

## D7 — FR-045 / BR-09 "minimum test duration 15 minutes" chưa được enforce

**SRS**: BR-09, FR-045 — "Assessments must enforce a minimum duration of 15 minutes".
**Code**: không tìm thấy validation nào trên `timeLimitMinutes` trong `ExamConfigService`. Đề với
`timeLimitMinutes = 1` vẫn tạo được.

**Trạng thái test**: không viết được test cho validation chưa tồn tại → dòng CSV `Status = Blocked`.

**Đề xuất**: thêm ràng buộc `timeLimitMinutes >= 15` trong `ExamConfigService`, hoặc bỏ BR-09/FR-045
khỏi SRS nếu nghiệp vụ không còn cần.

---

## D8 — DC-04 "weights sum to exactly 100%" không phải cách code tính điểm

**SRS**: DC-04 — "Quality form criterion weights must sum to exactly 100%", publication blocked with
HTTP 422. FR-031 nhắc lại.

**Code**: `form/scoring/FormScoringPolicy.java:117-135` — không ràng buộc tổng. Thay vào đó
**chuẩn hoá**: mỗi câu có `coefficient` (mặc định 1), trọng số = `coefficient / tổng coefficient`
trong nhóm, rồi nhân theo tỉ lệ critical/normal (`criticalWeightPercent`, mặc định 60/40). Tổng
trọng số luôn tự động bằng 1 nên không thể cấu hình sai.

**Đánh giá**: thiết kế của code **tốt hơn** yêu cầu SRS — người cấu hình không cần tự cộng cho tròn
100. Nhưng SRS nói sẽ trả 422, mà code không bao giờ trả.

**Test**: `L1-FSP-20`, `L1-FSP-21`, `L1-FSP-22` (pass) tài liệu hoá cơ chế chuẩn hoá thực tế.

**Đề xuất**: viết lại DC-04 theo cơ chế chuẩn hoá coefficient.

---

## D9 — DC-06 "work email must be unique" — hệ thống đăng nhập bằng employeeCode

**SRS**: DC-06, AC-01-01, AC-01-03, NAC-01-02, FR-001, FR-003 đều mô tả đăng nhập/định danh bằng
work email.
**Code**: định danh chính là `employeeCode` (`User.employeeCode`, `ADMIN_EMPLOYEE_CODE` khi seed,
`UserPrincipal`).

**Quyết định**: sửa SRS theo code. **Đã cập nhật** SRS → v1.4.

---

## D10 — Bảng state transition 4.4 lệch tên trạng thái

| SRS 4.4 | `ExamAttemptStatus` |
|---------|---------------------|
| Initial | *(chưa có attempt — không phải giá trị enum)* |
| In_Progress | `IN_PROGRESS` |
| Submitted | `SUBMITTED` |
| Graded | `GRADED` |
| Voided | `CANCELLED` |
| — | `EXPIRED` *(không có trong SRS)* |

**Quyết định**: sửa SRS theo code — đổi `Voided` → `CANCELLED`, thêm `EXPIRED` (hết giờ tự nộp,
FR-048). **Đã cập nhật** SRS → v1.4.

---

## D11 — Test lạc hậu sau khi thêm feature return-to-draft *(đã sửa)*

Commit `5a9bc66c` ("feat: download evidence, return-to-draft, …") cho phép `SUBMITTED → DRAFT`, nhưng
`TrainingRecordStateMachineTest` viết trước đó (`a45de56a`) vẫn assert transition này bị chặn → 2
test fail trong suite trước khi bắt đầu công việc này:
- `submittedCannotBeChangedToDraft:59`
- `invalidTransitionThrowsBadRequest:84`

Code đúng: `TrainingRecordServiceImpl.returnToDraft` (dòng 247–265) là endpoint có thật, quyền sở hữu
được kiểm ở dòng 252. **Đã sửa test**, giờ là `L1-TRSM-04` / `L1-TRSM-05`.

---

## D12 — Bug: thiếu Content-Type khi upload minh chứng → NPE → HTTP 500

**Code**: `training/validation/TrainingDomainValidator.java`
- dòng 15–19: `ALLOWED_MIME_TYPES = Set.of("image/jpeg", "image/png", "application/pdf")`
- dòng 52: `if (!ALLOWED_MIME_TYPES.contains(mimeType))`

`Set.of(...)` trả về immutable set, và `contains(null)` của nó **ném `NullPointerException`** (không
trả `false` như `HashSet`). Request upload không có Content-Type sẽ đi qua
`GlobalExceptionHandler` thành `SYS_001` / HTTP 500 thay vì `REQ_001` / HTTP 400 với message tiếng
Việt "Loại file minh chứng phải là JPG, PNG hoặc PDF".

**Test**: `L1-BV-10` (`TrainingDomainValidatorTest.missingMimeTypeMustBeRejectedAsBadRequest`)
— **EXPECTED FAIL**.

**Đề xuất**: đổi điều kiện thành `mimeType == null || !ALLOWED_MIME_TYPES.contains(mimeType)`.
Sửa 1 dòng.

---

## D13 — Bug: `đ` không được normalize → nhánh parse "tiết đào tạo" là dead code

**Code**: `training/service/TrainingLegacyDurationParser.java`
- dòng 151–157: `normalize()` dùng `Normalizer.Form.NFD` rồi xoá `\p{M}` (combining marks)
- dòng 132–141: `isLesson()` so với `"tiet dao tao"`; `isCredit()` so với `"gio tin chi"` và
  `"tin chi dao tao"`

`Đ` (U+0110) và `đ` (U+0111) là **chữ cái độc lập**, NFD không tách chúng thành `D`/`d` + dấu, nên
`\p{M}` không xoá được gì. Kết quả normalize thực tế (đã kiểm chứng):

```
"2 Tiết Đào Tạo"  ->  "2 tiet đao tao"     (không phải "2 tiet dao tao")
"2 tiết đào tạo"  ->  "2 tiet đao tao"
```

**Hệ quả**: mọi hằng số chứa `d` mà nguồn gốc là `đ` đều không bao giờ khớp:
`"tiet dao tao"`, `"tin chi dao tao"`. Row import legacy ghi "2 tiết đào tạo" bị trả
`parsed = false` ("Duration text cannot be parsed safely") thay vì `LESSON`. Các đơn vị không chứa
`đ` (`tiet`, `tin chi`, `gio`, `thang`, `nam`) vẫn hoạt động bình thường.

**Test**: `L1-BV-19` (`TrainingLegacyDurationParserTest.unitsContainingDStrokeMustNormalise`)
— **EXPECTED FAIL**. `L1-BV-15` xác nhận các đơn vị không chứa `đ` vẫn đúng (pass).

**Đề xuất**: thêm `.replace('đ', 'd').replace('Đ', 'D')` vào `normalize()` trước khi lowercase (hoặc
`.replace("đ", "d")` sau lowercase). Cùng lỗi này có thể ảnh hưởng
`DuplicateCheckService.tokenSet()` và `ParaphraseValidationService.normalizeForCompare()` — nên rà
lại toàn bộ chỗ dùng NFD trong repo.

---

## Ghi chú về các failure có sẵn, ngoài phạm vi L1

Suite backend còn failure/error **không thuộc 9 sheet L1** và không do công việc này gây ra. Ghi lại
để `Report 5.0` mục 5.1 không tính nhầm:

- **~24 error ở integration test** (`FormSubmissionControllerIntegrationTest`,
  `UserImportControllerIntegrationTest`, `NotificationControllerIntegrationTest`,
  `TrainingActivityTypeControllerIntegrationTest`, `EvaluationDashboardControllerIntegrationTest`,
  `TrainingEmployeeHoursControllerIntegrationTest`, `TrainingLegacyImportControllerIntegrationTest`):
  tất cả fail ở `setUp` với `Table "roles"/"users"/"departments" not found (this database is empty)`
  → schema H2 không được tạo trong `application-test.yaml`. Đây là việc của **L2**, không phải L1.
- `ExamAttemptServiceTest` — 3 failure.
- `ExamConfigServiceTest` — 2 error (`BadRequest Điểm đạt phải trong khoảng 0-10`).
- `TrainingRecordEvidenceControllerIntegrationTest` — 3 failure.

Các mục này nên được mở thành issue riêng; chúng không nằm trong 9 sheet của workbook L1.
