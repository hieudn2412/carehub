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
| D14 | **Cao** | Bug (link minh chứng không mở được ở dev) | `L1-FE-46`, `L1-FE-51` EXPECTED FAIL | Sửa code |

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

## D11 — Test lạc hậu về return-to-draft *(đã đóng, semantics đã đảo 2 lần)*

Lịch sử đầy đủ, vì mục này đã đảo chiều:

1. Commit `5a9bc66c` ("feat: … return-to-draft …") cho phép `SUBMITTED → DRAFT` với **mọi** actor,
   nhưng `TrainingRecordStateMachineTest` viết trước đó (`a45de56a`) vẫn assert bị chặn → 2 test
   fail sẵn trong suite trước khi công việc này bắt đầu.
2. Tôi sửa test theo code lúc đó (owner được phép).
3. **Merge `origin/main` đảo lại**: `case SUBMITTED -> adminActor && (to == DRAFT || to == CANCELLED)`
   — chỉ admin. Test đã cập nhật lần hai: `L1-TRSM-04` giờ là `Guard-FALSE` (owner **không** được),
   `L1-TRSM-05` là `Guard-TRUE` (admin được), thêm `L1-TRSM-17` (bảng chân lý đầy đủ
   `adminActor × target`) và `L1-TRSM-18` (đường exception).

Trạng thái hiện tại: **test khớp code**. Nhưng chính thay đổi ở bước 3 tạo ra defect **D15** —
`TrainingRecordServiceImpl.returnToDraft` vẫn còn nhánh dành cho owner mà giờ không bao giờ chạy
được. Đây là lý do "suite xanh" không đồng nghĩa "hệ thống đúng".

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

## D14 — Bug: URL minh chứng tương đối resolve thành chuỗi rỗng ở cấu hình dev

**Đến cùng lúc merge `origin/main`** (file `evidenceUrl.js` là code mới của main).

**Code**: `carehub-frontend/src/features/training/utils/evidenceUrl.js`
```js
const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL || 'http://localhost:8081/api/v1'
...
return new URL(value, new URL(API_BASE_URL).origin).toString()   // dòng 9
```
`new URL(API_BASE_URL)` **ném lỗi** khi `API_BASE_URL` là đường dẫn tương đối. `.env` thực tế bị
git-ignore, nhưng **`carehub-frontend/.env.example` (được commit) và `carehub-frontend/README.md:45`
đều hướng dẫn đúng giá trị tương đối đó**: `VITE_API_BASE_URL=/api/v1` (để dùng proxy của Vite dev
server), và `CLAUDE.md` nói rõ `.env` được copy từ `.env.example`. Nên mọi dev làm theo hướng dẫn
đều gặp lỗi. Catch ngoài cùng trả `''`.

**Đã kiểm chứng**:
```
API_BASE_URL = '/api/v1'                      → resolveEvidenceUrl('/api/v1/files/1') = ""
API_BASE_URL = 'http://localhost:8081/api/v1' → resolveEvidenceUrl('/api/v1/files/1') = "http://localhost:8081/api/v1/files/1"
```

**Hệ quả**: ở môi trường dev (và mọi môi trường cấu hình `VITE_API_BASE_URL` tương đối), mọi URL minh
chứng tương đối resolve thành `''` → `openEvidenceUrl` trả `false` → **click xem minh chứng không có
phản hồi gì**, không lỗi, không log. Ảnh minh chứng cũng không hiển thị.

**Vì sao chưa ai phát hiện**: test gốc `evidenceUrl.test.js` chạy bằng `node --test`. Node không có
`import.meta.env`, nên module rơi vào fallback tuyệt đối `http://localhost:8081/api/v1` và test pass
— pass vì lý do sai, không hề chạm cấu hình thật. Chuyển sang vitest (đọc `.env`) là lúc lỗi lộ ra.

**Test**: `L1-FE-46` (resolve trả rỗng) và `L1-FE-51` (click không mở tab) — **EXPECTED FAIL**.
`L1-FE-45`, `L1-FE-49` dùng URL tuyệt đối và `L1-FE-52` dùng base tuyệt đối nên đều pass — khoanh
vùng lỗi chính xác vào nhánh base tương đối.

Hai case D14 **stub env rồi re-import module** (`vi.stubEnv` + `vi.resetModules`) thay vì dựa vào
`.env` local, nên fail giống nhau trên mọi máy và trên CI. Đã kiểm chứng: kết quả không đổi khi tạm
ẩn `.env`.

**Đề xuất**: lấy origin từ `window.location` khi base là tương đối —
```js
return new URL(value, new URL(API_BASE_URL, window.location.origin).origin).toString()
```
Rà thêm mọi chỗ khác dùng `new URL(API_BASE_URL)` với giả định base tuyệt đối.

---

## D15–D23 — Defect do `origin/main` mang vào, phát hiện khi review test sau merge

Nhóm này tìm được bằng một lượt review 7 vùng × verify đối kháng trên code **sau merge** (14 agent,
54/60 finding được xác nhận độc lập). Tất cả đều là code của `origin/main`, **không nằm trong phạm
vi công việc làm test** — ghi lại để bạn xử lý, chưa sửa dòng nào.

| ID | Mức | Nội dung | Bằng chứng |
|----|-----|----------|------------|
| **D15** | **Chặn release** | `returnToDraft` chết hẳn với mọi non-admin. State machine giờ yêu cầu `adminActor` cho `SUBMITTED→DRAFT`, nhưng service vẫn có nhánh cho owner: owner qua được check quyền ở dòng 252 rồi **luôn** bị `requireTransition` chặn → trả **400** thay vì 403, và nhánh owner thành dead code | `TrainingRecordStateMachine.java:23-24` vs `TrainingRecordServiceImpl.java:252,257` |
| **D16** | **Cao** | `startDate` mất `@NotNull`: `create()` tự điền hôm nay, nhưng `update()` ghi thẳng `null` qua mapper vào cột `NOT NULL` → **HTTP 500** (`SYS_001`) thay cho 400 (`VAL_001`) như trước merge | `TrainingRecordFormRequest.java:21`, `TrainingRecordServiceImpl.java:175-177` vs `TrainingRecordMapper.java:35`, `TrainingRecord.java:69` |
| **D17** | **Cao** | `bestScore` chia điểm 0–10 cho 10 **lần nữa** → mọi điểm cao nhất báo về nhỏ đi 10 lần | `MyExamAssignmentResponse` + `ExamAssignmentService` (3 field mới `bestScore`/`assessmentStatus`/`detailAttemptId`, không có test nào) |
| **D18** | **Cao (phân quyền)** | Route `/staff/checklists` mất guard MANAGER, và `/staff/checklists/:id/evaluate` mới thêm **không có guard** → USER thường mở được cả hai | `carehub-frontend/src/app/router.jsx` |
| **D19** | **Cao (phân quyền)** | `FormAssignmentService.create` bị xoá gate role MANAGER → user ACTIVE nào cũng gán được form đánh giá. Field `UserRoleRepository` còn lại nhưng không dùng là dấu vết | `form/assignment/service/FormAssignmentService.java` |
| **D20** | **Trung bình (phân quyền)** | Policy mật khẩu nới xuống "≥4 ký tự, không toàn khoảng trắng" ở cả 2 màn reset và DTO backend | `ResetPasswordRequest.java`, `ResetPasswordScreen.jsx`, `EmailConfirmResetScreen.jsx` |
| **D21** | **Trung bình** | `ownedDraft()` thay call helper bằng check inline 5 nhánh, **bỏ mất** điều kiện `FormStatus.PUBLISHED` và `FormVersionStatus.PUBLISHED` → draft trên form đã RETIRED vẫn sửa được | `form/submission/service/FormSubmissionService.java` |
| **D22** | **Trung bình** | Trung bình năng lực đổi sang "best attempt mỗi paper": gom nhóm deref `getExamPaper()` **không guard null**, và chọn best theo điểm **thô** nên paper có cả attempt thang 0–10 và 0–100 sẽ chọn sai | `questiongeneration/service/MyCompetencyService.java` |
| **D23** | **Thấp** | `validUntil()` dùng `startDate.plusYears(w)` còn `isExpired()` dùng `asOf.minusYears(w)` — hai đầu ngược nhau, lệch nhau ở ngày nhuận. Đã chạy kiểm chứng: `startDate=2015-02-28, w=5` → `validUntil=2020-02-28`, `asOf=2020-02-29` → `expired=false`, tức hồ sơ vẫn được tính 1 ngày sau khi chính nó hết hạn | `TrainingRecordValidity.java:12` vs `:19`, cùng phát ra trên một dòng response tại `TrainingStatusServiceImpl.java:157-158` |

**Ngoài ra**: `AT_RISK` và `NOT_CONFIGURED` giờ **không được sinh ra bởi bất kỳ class nào** trong
backend, nên `atRiskCount` / `notConfiguredCount` trên dashboard cấu trúc luôn bằng 0 và
`warningMessage` có 2 nhánh không tới được. Đây là hệ quả trực tiếp của việc main bỏ model
per-requirement (xem D6 và phần dựng lại sheet `TrainingComplianceCalculator`).

---

## Ghi chú về các failure có sẵn, ngoài phạm vi L1

**Đã được `origin/main` sửa hết.** Trước khi merge, suite backend có 11 failure + 24 error ngoài phạm
vi L1: ~24 error integration test fail ở `setUp` với `Table "roles"/"users"/"departments" not found
(this database is empty)` (schema H2 thiếu trong `application-test.yaml`), cộng
`ExamAttemptServiceTest` 3 failure, `ExamConfigServiceTest` 2 error,
`TrainingRecordEvidenceControllerIntegrationTest` 3 failure.

Sau khi merge `origin/main` (commit merge `d08e504c`), main đã sửa `application-test.yaml` và các
test trên. Hiện trạng suite backend:

```
Tests run: 577, Failures: 5, Errors: 0, Skipped: 7
```

5 failure còn lại **đúng bằng** 5 case L1 phơi bày defect D3, D5 (×2), D12, D13. Không còn failure
nào ngoài phạm vi L1. Frontend: 68 test, 3 failure — đều là case defect (D4, D14 ×2).
