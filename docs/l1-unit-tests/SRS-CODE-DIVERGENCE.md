# SRS ↔ Code Divergence Report — L1 Unit Tests

Nguồn: `docs/Report 3.0_SRS_VietDuc-Care_v1.3.docx` đối chiếu với code tại nhánh `ManhTuan`.
Tài liệu này là đầu vào cho:
- cột **Defect ID** của các CSV trong `docs/l1-unit-tests/`, `docs/l2-integration-tests/` và
  `docs/l3-system-api-tests/`
- mục **5.2 Test Analysis Notes → Root Cause Analysis / Coverage Gaps** của `Report 5.0_TestPlan`

Sổ defect được mở rộng theo từng tầng test: **D1–D24** từ L1 (unit), **D25–D35** từ L2 (integration),
**D36–D41** từ L3 (system/API).

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

## D24 — FR-037 nói thang điểm 0–100, code chuyển đổi về 0–10

**SRS**: FR-037 — converted score trên thang 0–100. **Code**: `FormScoreCalculator` trả
`convertedScore` thang 0–10 (scale 2). Cùng họ với D6 (đã chốt sửa SRS theo code ở D6). Được ghi
trong Defect ID của `L1-FSC-10` và các dòng liên quan sheet `FormScoreCalculator`.

**Đề xuất**: sửa FR-037 theo code như đã làm với D6 ở SRS v1.4.

---

## D25–D35 — Phát hiện trong đợt L2 Integration Tests

Nhóm này lộ ra khi viết test tích hợp L2 (`docs/l2-integration-tests/`) — đa số chỉ quan sát được
khi transaction **thật sự commit**, nên toàn bộ suite unit L1 và các integration test
`@Transactional` cũ không thể bắt được. Mỗi mục có ít nhất một Test ID L2 chứng minh; 4 mục là
**EXPECTED FAIL** (D28, D33, D34, D35).

| ID | Mức | Nội dung | Bằng chứng |
|----|-----|----------|------------|
| **D25** | Trung bình | Refresh token **không rotation** — trái CLAUDE.md/TDS 2.2 | `L2-AUTH-05` (pass, pin) |
| **D26** | **Cao (bảo mật)** | User soft-deleted vẫn refresh được access token | `L2-AUTH-09` (pass, pin) |
| **D27** | **Cao** | Dual-write: email publish **trước** commit ở `createUser`/`forgotPassword` | `L2-AUTH-10` (pass, pin) |
| **D28** | **Nghiêm trọng** | Direct-evaluation submission FAILED → NPE → 500 + rollback cả bài nộp | `L2-SCR-04` **EXPECTED FAIL** |
| **D29** | Trung bình | `EmailConsumer` không idempotent — redelivery gửi email lần 2 | ghi nhận khi khảo sát (retry ladder: `L2-NTF-09/10`) |
| **D30** | **Cao** | Không có handler `DataIntegrityViolationException` → vi phạm unique = **500 `SYS_001`** thay vì 409 | `L2-FLOW-02`, `L2-REF-01` (pass, pin) |
| **D31** | Thấp | `spring.rabbitmq.listener.*.auto-startup: false` trong test yaml vô hiệu (app tự khai `SimpleRabbitListenerContainerFactory`) | `RabbitMQConfig.java:48-58` |
| **D32** | Thấp | Registry mã lỗi TDS 8.1 (`TRN_001`…) lệch hoàn toàn code (`REQ_001`/`VAL_001`/`SYS_409`…) | mọi CSV L2, cột Then |
| **D33** | **Nghiêm trọng** | Thi **đậu** nhưng không bao giờ được cộng giờ CME + không có notification | `L2-EXM-10` **EXPECTED FAIL** |
| **D34** | **Cao** | Xoá minh chứng: `storage_deleted_at` không bao giờ được stamp ở lượt đầu | `L2-TRN-17` **EXPECTED FAIL** |
| **D35** | **Nghiêm trọng** | Mọi notification phát từ flow transactional bị **nuốt im lặng** | `L2-SCR-05` **EXPECTED FAIL** |

### D25 — Refresh token không rotation

**Code**: `auth/service/impl/AuthServiceImpl.java:65-91` — `refreshToken()` chỉ mint access token
mới rồi trả lại **đúng token cũ** (`refreshToken.getToken()`, dòng 87). Không revoke, không tạo
token mới, không có khái niệm supersession. CLAUDE.md và TDS 2.2 mô tả "refresh token rotation".

**Test**: `L2-AUTH-05` — refresh 2 lần, cả hai trả nguyên chuỗi cũ, DB vẫn đúng 1 row
`revoked=false`. Pass vì pin theo code.

**Đề xuất**: hoặc làm rotation thật (revoke row cũ + phát row mới mỗi lần refresh), hoặc sửa
CLAUDE.md/TDS bỏ chữ "rotation".

### D26 — Soft delete không kết thúc phiên đăng nhập

**Code**: `AuthServiceImpl.refreshToken` dòng 75-80 chỉ check `status` (LOCKED / chưa ACTIVE) —
**không check `user.isDeleted()`**, và cũng không có chỗ nào revoke refresh token khi admin xoá
user (`UserServiceImpl` soft delete chỉ set flag).

**Hệ quả**: nhân viên đã bị xoá khỏi hệ thống vẫn tự gia hạn access token đến 7 ngày sau.

**Test**: `L2-AUTH-09` — xoá mềm user sau khi login, refresh vẫn 200. Pass vì pin theo code.

**Đề xuất**: thêm check `isDeleted` vào `refreshToken()` **và** revoke mọi refresh token của user
trong flow xoá.

### D27 — Dual-write: email đi trước khi transaction commit

**Code**: `PasswordResetServiceImpl.forgotPassword` và `UserServiceImpl.createUser` gọi
`EmailProducer.send(...)` **bên trong** method `@Transactional`. Publish RabbitMQ không tham gia
transaction DB.

**Hệ quả**: nếu transaction rollback sau khi publish (lỗi DB, constraint…), email vẫn được gửi —
người dùng nhận OTP không tồn tại trong DB (nhập vào là "Mã OTP không hợp lệ"), hoặc nhận welcome
email cho account chưa được tạo.

**Test**: `L2-AUTH-10` — gọi `forgotPassword` trong `TransactionTemplate` rồi ép rollback: DB
không còn row OTP nhưng CapturingEmailProducer đã giữ 1 email OTP. Pass vì pin đúng hành vi lỗi.

**Đề xuất**: chuyển các publish này sang `@TransactionalEventListener(AFTER_COMMIT)` (kèm fix D35)
hoặc transactional outbox.

### D28 — Bug nghiêm trọng: direct-evaluation FAILED → NPE → mất luôn bài nộp

**Code**: `form/submission/service/FormSubmissionService.java:153` —
`submission.getAssignmentItem().getForm().getTitle()` trong `publishPersonalComplianceIssue`.
Submission tạo theo đường direct-evaluation (UC-13, `L2-SCR-03`) có `assignmentItem = null` →
NPE ngay trong transaction submit → 500 `SYS_001` **và rollback toàn bộ bài nộp** (điểm đã chấm,
kết quả FAILED — mất hết).

**Test**: `L2-SCR-04` — **EXPECTED FAIL**: assert 200 + FAILED_SCORE persisted, thực tế 500 +
DB không đổi.

**Đề xuất**: guard null trước dòng 153 (skip publish khi không có assignment item, hoặc lấy tên
form qua `formVersion.getForm()`), rồi mới tính đến D35 để notification thật sự đi.

### D29 — EmailConsumer không idempotent

**Code**: `notification/messaging/EmailConsumer` — MANUAL ack, retry bằng counter `attempts` trong
payload (`MAX_EMAIL_ATTEMPTS = 5` → DLQ) nhưng **không có dedup theo message id**: broker
redelivery (mất kết nối sau khi gửi SMTP thành công nhưng trước khi `basicAck`) sẽ gửi email lần 2.

**Test**: retry ladder được chứng minh ở `L2-NTF-09` (fail → retry exchange, attempts+1) và
`L2-NTF-10` (attempts=4 fail → DLQ). Case redelivery-idempotency không viết được thiếu broker thật.

**Đề xuất**: thêm bảng/redis key `email_message_id đã xử lý` trước khi gửi.

### D30 — Vi phạm unique constraint trả 500 thay vì 409

**Code**: `exception/GlobalExceptionHandler` không có handler cho
`DataIntegrityViolationException`. Mọi race check-then-insert (ví dụ
`SystemSettingsService.get()` tạo row GLOBAL lần đầu) khi thua cuộc đua sẽ rơi vào handler
`Exception` chung → **500 `SYS_001`** với message chung chung, thay vì 409 `SYS_409`.

**Test**: `L2-FLOW-02` — 2 transaction thật đua check-then-insert `scope_key`: loser nhận
`DataIntegrityViolationException`. Pass vì pin hiện trạng; Notes ghi rõ thiếu handler.

**Đề xuất**: thêm `@ExceptionHandler(DataIntegrityViolationException.class)` → 409 `SYS_409`
message tiếng Việt.

### D31 / D32 — Ghi nhận cấu hình & tài liệu

- **D31**: `application-test.yaml` đặt `spring.rabbitmq.listener.simple.auto-startup: false` nhưng
  `RabbitMQConfig.java:48-58` tự khai `SimpleRabbitListenerContainerFactory` không đọc property đó
  → container vẫn retry connect nền trong test (vô hại nhưng ồn log, và property gây hiểu nhầm).
- **D32**: registry mã lỗi trong TDS 8.1 (`TRN_001`, `EXM_002`…) không tồn tại trong code — code
  dùng `REQ_001`/`VAL_001`/`AUTH_001`/`AUTH_002`/`SYS_404`/`SYS_409`/`SYS_503`/`SYS_001`. Mọi cột
  Then trong CSV L2 trích mã thật của code. Đề xuất: viết lại TDS 8.1 theo code.

### D33–D35 — Họ bug chung một gốc: listener `AFTER_COMMIT` làm việc transactional

**Gốc rễ chung**: cả ba chỗ dưới đây chạy trong `@TransactionalEventListener(phase = AFTER_COMMIT)`.
Ở phase đó Spring **vẫn còn** transaction synchronization của transaction vừa commit, nên mọi
`@Transactional(propagation = REQUIRED)` bên trong listener **join vào transaction đã commit**
thay vì mở transaction mới:

- write qua `save()` không bao giờ được flush → **bị vứt bỏ im lặng** (D35);
- entity IDENTITY cần insert ngay để lấy id, Hibernate hoãn bằng `DelayedPostInsertIdentifier` →
  **`ClassCastException` khi cast id sang `Long`** (D33);
- query `@Modifying` đòi transaction đang hoạt động → **`InvalidDataAccessApiUsageException:
  No active transaction`** (D34).

Cả ba exception đều bị `try/catch` + log nuốt, nên production **không có dấu hiệu gì ngoài log
warn** — tính năng chỉ đơn giản là không chạy.

**D33** — `training/service/ExamPassedTrainingListener.java:40` (`onExamPassed`, save tại dòng 80):
người thi **đậu** không bao giờ nhận được training record 1.0h `EXAM_ATTEMPT:<id>` lẫn notification
EXAM_PASSED. Test: `L2-EXM-10` **EXPECTED FAIL** (transaction commit thật, đếm 0 record).

**D34** — `training/service/impl/EvidenceObjectDeletionService.java:27-30` → `deleteAndMark:44`
gọi `markStorageDeleted` (`@Modifying`): object storage bị xoá nhưng stamp `storage_deleted_at`
ném "No active transaction" (bị catch dòng 45-47) → row treo mãi trong danh sách retry; sweep
`retryPendingDeletes` (10 phút/lần, có transaction riêng) là thứ duy nhất cứu lại. Test:
`L2-TRN-17` **EXPECTED FAIL**; `L2-TRN-18` chứng minh sweep hội tụ.

**D35** — `notification/messaging/NotificationEventListener.java:16` → `NotificationDispatcher
.dispatch`: insert notification join transaction đã commit → **vứt bỏ im lặng, không log, không
row**. Blast radius = **mọi** notification phát từ flow transactional: EXAM_ASSIGNED, EXAM_PASSED,
PERSONAL_COMPLIANCE_ISSUE. Các flow không transactional (scheduler `scanCme`) vẫn hoạt động — vì
vậy bug sống sót đến giờ. Test: `L2-SCR-05` **EXPECTED FAIL** (đã cô lập bằng 2 probe: dispatch
tay không transaction → có row; dispatch trong transaction đã commit → không gì).

**Fix chung cho cả họ** (1 dòng mỗi chỗ): đặt
`@Transactional(propagation = Propagation.REQUIRES_NEW)` lên method listener (hoặc chuyển sang
`@Async` như 3 worker recalculation đã làm đúng). Sau khi fix, 3 test EXPECTED FAIL ở trên sẽ tự
chuyển xanh — chúng assert theo hành vi đúng.

---

## D36–D41 — Phát hiện trong đợt L3 System/API Tests

Nhóm này lộ ra khi gọi API qua **HTTP thật** (`@SpringBootTest(RANDOM_PORT)` + `RestTemplate` +
token do `POST /auth/login` phát ra, xem `docs/l3-system-api-tests/`). Cả 20 integration test cũ đều
dùng `MockMvc` + `SecurityMockMvcRequestPostProcessors.jwt()`, tức **bỏ qua filter chain và
`NimbusJwtDecoder`** — nên không có tầng nào trước L3 quan sát được D36 và D38. Không mục nào là
EXPECTED FAIL: L3 pin hành vi hiện tại, mọi test đều xanh.

| ID | Mức | Nội dung | Bằng chứng |
|----|-----|----------|------------|
| **D36** | Trung bình | Lỗi xác thực trả **401 body rỗng**, không theo envelope `{error_code, message, correlation_id}` | `L3-AUTH-16`, `L3-USR-08`, `L3-SEC-04` (pass, pin) |
| **D37** | Trung bình | `GET /users` trả `Page` thô của Spring thay vì `PageResponse` — endpoint phân trang duy nhất lệch shape | `L3-USR-01` (pass, pin) |
| **D38** | **Cao (bảo mật)** | Không có rate limit / lockout: 20 lần login sai không bị chặn | `L3-SEC-07` (pass, pin) |
| **D39** | Trung bình (bảo mật) | `forgot-password` tiết lộ email có tồn tại hay không | `L3-AUTH-12` (pass, pin) |
| **D40** | Trung bình | Vi phạm quyền ở `/me/exam-attempts` trả **400 `REQ_001`** thay vì 403 `AUTH_002` | `L3-EXM-16` (pass, pin) |
| **D41** | **Cao** | Câu hỏi tạo mới mặc định **APPROVED** — `QUESTION_AUTHOR` tự duyệt, cổng `QUESTION_REVIEWER` vô hiệu | `L3-EXM-03` (pass, pin) |

### D36 — Lỗi xác thực không theo envelope lỗi chung

**Code**: `config/SecurityConfig.java:71-93` khai `oauth2ResourceServer` nhưng **không** đăng ký
`authenticationEntryPoint` hay `accessDeniedHandler`. Vì vậy request thiếu token / token sai chữ ký bị
`BearerTokenAuthenticationEntryPoint` chặn ngay trong filter chain, **trước** `DispatcherServlet` —
`GlobalExceptionHandler` không bao giờ chạy. Client nhận `401` với body **rỗng**, chỉ có header
`WWW-Authenticate: Bearer`, **không** có `error_code`, không có `X-Correlation-ID`.

Trái với CLAUDE.md và TDS 8.1: mọi lỗi phải là `ErrorResponse` với `error_code` (`AUTH_001` cho lỗi
xác thực) và `correlation_id`. So sánh: 403 do `@PreAuthorize` **có** envelope đầy đủ (`AUTH_002`),
vì `AccessDeniedException` phát sinh trong lúc dispatch → tới được handler.

**Ảnh hưởng**: frontend `httpClient.js` chỉ nhìn status 401 để refresh nên vẫn chạy; nhưng bất cứ
consumer nào (mobile, tích hợp ngoài, log tập trung) parse `error_code`/`correlation_id` sẽ thất bại
đúng ở nhánh lỗi quan trọng nhất, và không có correlation id để lần vết 401 trong log.

**Test**: `L3-AUTH-16` (thiếu token), `L3-USR-08` (thiếu token), `L3-SEC-04` (token bị sửa payload)
— cả ba khẳng định body rỗng + thiếu `X-Correlation-ID`.

**Đề xuất** (~10 dòng): đăng ký entry point và access-denied handler ghi `ErrorResponse` bằng cùng
`ObjectMapper`, phát `AUTH_001`/`AUTH_002` kèm correlation id.

### D37 — `GET /users` lệch shape phân trang

**Code**: `user/controller/UserController.java:102-113` trả
`ApiResponse<Page<UserSummaryResponse>>`, tức Jackson serialize thẳng `PageImpl`. Body có
`pageable`, `numberOfElements`, `first`, `last`, `empty`, `number` — trong khi mọi endpoint phân trang
khác trả `PageResponse` (`common/response/PageResponse.java`) với đúng
`{content, page, size, totalElements, totalPages, sort}`.

Thực tế API có **ba** kiểu phân trang: `PageResponse` (chuẩn), `Page` thô (chỉ endpoint này), và
phân trang **dàn phẳng** vào DTO nghiệp vụ (`CompetencySummaryResponse` — `L3-ANL-10`).

**Test**: `L3-USR-01` khẳng định có `pageable`/`numberOfElements` và **không** có `page`.

**Đề xuất**: bọc `PageResponse.from(page)` như các controller khác (1 dòng), rồi sửa chỗ đọc ở
frontend; hoặc ghi rõ ngoại lệ này vào TDS nếu không muốn đổi.

### D38 — Không có rate limit và không có lockout khi đăng nhập sai

**Code**: không tồn tại bất kỳ bộ đếm số lần sai, `lockedUntil`, backoff hay filter throttle nào
trong `src/main` (grep `RateLimit|Bucket4j|failedLoginAttempts|lockout` → 0 kết quả).
`AuthServiceImpl.login` chỉ so mật khẩu rồi trả lỗi. Khoá tài khoản là **thao tác tay** của admin
qua `PATCH /users/{id}/lock`.

**Ảnh hưởng**: `/auth/login` (brute-force / credential stuffing), `/auth/forgot-password` và
`/user/first-login/send-email-otp` (spam email + dò OTP 6 chữ số, TTL 5 phút — không giới hạn số lần
thử nghĩa là không gian 10⁶ hoàn toàn khả thi để quét). Ba endpoint này đều **public**.

**Test**: `L3-SEC-07` — 20 lần login sai liên tiếp đều trả cùng `400 REQ_001`, không 429/423, không
delay, và mật khẩu đúng dùng được ngay sau đó.

**Đề xuất**: rate limit theo IP + theo `employeeCode` (Bucket4j hoặc filter tự viết) cho 3 endpoint
public; thêm khoá tạm sau N lần sai. Nếu chấp nhận rủi ro thì ghi rõ vào TDS 7.5 kèm lý do.

### D39 — `forgot-password` tiết lộ email tồn tại

**Code**: `auth/service/impl/PasswordResetServiceImpl.java:35-38` — email không có trong hệ thống →
`BadRequestException("Không tìm thấy email")` → 400 `REQ_001`. Ngược lại email hợp lệ → 200.

Đáng chú ý là `login` **không** mắc lỗi này: mã nhân viên lạ và mật khẩu sai dùng **cùng một** message
(`L3-AUTH-04`). Hai endpoint cùng module, hai triết lý khác nhau.

**Test**: `L3-AUTH-12` (tiết lộ) đặt cạnh `L3-AUTH-04` (không tiết lộ).

**Đề xuất**: luôn trả 200 với message trung tính ("Nếu email tồn tại, mã OTP đã được gửi"), chỉ ghi
log phía server. Kết hợp với D38 vì cùng chạm `/auth/forgot-password`.

### D40 — Vi phạm quyền báo 400 thay vì 403

**Code**: `questiongeneration/service/ExamAttemptService.java:374` — `requireOwner` ném
`BadRequestException("Bạn không có quyền truy cập lượt làm bài này")`. Mọi module khác dùng
`ForbiddenException` → 403 `AUTH_002`.

**Ảnh hưởng**: client không phân biệt được "dữ liệu gửi sai" với "không có quyền" trên nhóm
`/me/exam-attempts/*`; SIEM/log analytics đếm sai loại sự kiện (một lỗi truy cập trái phép bị ghi
thành lỗi cú pháp).

**Test**: `L3-EXM-16`.

**Đề xuất**: đổi sang `ForbiddenException` (1 dòng). Lưu ý cùng họ với lựa chọn 404 ở
`/assigned-forms/{id}` (`L3-QLT-15`) — chỗ đó 404 là **cố ý** để không xác nhận sự tồn tại, nên hai
chỗ này cần một quyết định thống nhất và ghi vào TDS.

### D41 — Câu hỏi mới mặc định APPROVED, bỏ qua cổng reviewer

**Code**: `questiongeneration/service/QuestionBankService.java:85` —
`parseMutationStatus(request.status(), QuestionBankStatus.APPROVED)`: khi request **không** gửi
`status`, câu hỏi được tạo thẳng ở `APPROVED`, và dòng 106 gán luôn `reviewedBy = actor` (chính tác
giả). `POST /questions` chỉ cần permission `QUESTION_AUTHOR`.

**Ảnh hưởng**: quy trình 2 người (author viết → reviewer duyệt) mà `EvaluationPermissions` dựng ra bị
vô hiệu hoá bằng cách **không gửi trường `status`**. Câu hỏi vào ngay tập APPROVED nên đủ điều kiện
nạp vào bộ câu hỏi và ra đề thi thật. Cổng `@evaluationSecurity.canReview` trên
`POST /questions/{id}/approve` chỉ còn tác dụng với câu hỏi được tạo với `status: "DRAFT"` tường minh.

**Test**: `L3-EXM-03` (tạo không `status` → APPROVED, pin), đặt cạnh `L3-EXM-05` (author không được
gọi `/approve` → 403) và `L3-EXM-06` (reviewer duyệt DRAFT → APPROVED). Ba dòng cạnh nhau cho thấy
cổng tồn tại nhưng đi đường tắt được.

**Đề xuất**: đổi mặc định thành `DRAFT` (1 dòng), và chỉ cho phép đặt `status: APPROVED` khi actor có
`QUESTION_REVIEWER`. Cần rà lại dữ liệu đã seed/tạo trước đó vì `reviewedBy` hiện không đáng tin.

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
