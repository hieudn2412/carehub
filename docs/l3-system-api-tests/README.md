# L3 System/API Tests — hướng dẫn điền `Report 5.3_L3-SystemAPITests_Template.xlsx`

Bộ dữ liệu này để Claude cowork (hoặc bạn) paste vào workbook L3 (`CareHub_SystemAPITests_L3.xlsx`).
**115 dòng / 9 sheet**, trong đó **112 dòng tương ứng 1-1 với một `@Test` thật** trong
`carehub-backend/src/test/java/vn/vietduc/carehubbackend/api/` và **3 dòng là kịch bản k6 chưa chạy**
(có script thật trong `scripts/k6/`, `Status = Not Run`).

Hợp đồng dữ liệu — **4 layout cột khác nhau** (khác L2 dùng chung một layout) — theo
`docs/L2-L3-TESTCASE-BRIEF.md`.

## Điểm khác biệt cốt lõi so với L1/L2: HTTP thật

Toàn bộ 112 test L3 chạy qua **HTTP thật** tới Tomcat trên cổng ngẫu nhiên
(`@SpringBootTest(webEnvironment = RANDOM_PORT)`), đăng nhập bằng `POST /api/v1/auth/login` và gắn
token trả về vào header `Authorization`. Điều này quan trọng vì **cả 20 integration test cũ đều dùng
`MockMvc` + `SecurityMockMvcRequestPostProcessors.jwt()`**, tức tiêm sẵn một authentication đã xác
thực và **bỏ qua**: filter chain của Spring Security, `NimbusJwtDecoder` (kiểm chữ ký HS256),
`CustomJwtAuthenticationConverter`, entry point trả 401, CORS, và giới hạn multipart thật.

Nhờ vậy L3 phát hiện được 6 sai lệch mà L1/L2 không thể thấy (D36–D41, chi tiết bên dưới).

Lưu ý kỹ thuật đã xử lý (ghi lại để người sau không mất thời gian):
- Boot 4 **không** còn tự đăng ký `TestRestTemplate` với `RANDOM_PORT`, và
  `spring-boot-resttestclient` cần module `spring-boot-restclient` không có trên classpath dự án →
  base class dùng `RestTemplate` thuần của `spring-web` với `JdkClientHttpRequestFactory` (bắt buộc:
  `SimpleClientHttpRequestFactory` **không gửi được PATCH**) và một error handler không ném exception
  để assert được thân lỗi 4xx/5xx.
- Spring Framework 7 đổi tên 422 từ `UNPROCESSABLE_ENTITY` thành `UNPROCESSABLE_CONTENT` → so sánh
  status bằng **giá trị số**, không so enum.
- `@Transactional` **không dùng được** với RANDOM_PORT (request chạy trên thread Tomcat với
  transaction riêng) → mọi class L3 non-transactional, fixture dùng mã duy nhất qua `AtomicInteger`.
- 2 `@Scheduled` không bị tắt trong test profile (`FormScoringRecalculationDispatcher` 30 s,
  `EvidenceObjectDeletionService` 10 phút) → pin về 3600000 ms trong `@TestPropertySource`.

## Số liệu cho mục 5.1 của Report 5.0

| Sheet trong workbook | Layout | File CSV | Case | Pass | Fail | Blocked | Not Run |
|---|---|---|---|---|---|---|---|
| `L3-AuthAPI` | api (15 cột) | `L3-AuthAPI.csv` | 16 | 16 | 0 | 0 | 0 |
| `L3-UserAdminAPI` | api (15 cột) | `L3-UserAdminAPI.csv` | 16 | 16 | 0 | 0 | 0 |
| `L3-TrainingAPI` | api (15 cột) | `L3-TrainingAPI.csv` | 18 | 18 | 0 | 0 | 0 |
| `L3-QualityAPI` | api (15 cột) | `L3-QualityAPI.csv` | 19 | 19 | 0 | 0 | 0 |
| `L3-ExamAPI` | api (15 cột) | `L3-ExamAPI.csv` | 16 | 16 | 0 | 0 | 0 |
| `L3-AnalyticsAPI` | api (15 cột) | `L3-AnalyticsAPI.csv` | 13 | 13 | 0 | 0 | 0 |
| `L3-APIFlows` | flow (11 cột) | `L3-APIFlows.csv` | 5 | 5 | 0 | 0 | 0 |
| `L3-Performance` | perf (13 cột) | `L3-Performance.csv` | 3 | 0 | 0 | 0 | **3** |
| `L3-Security` | sec (12 cột) | `L3-Security.csv` | 9 | 8 | 0 | **1** | 0 |
| **Tổng** | | | **115** | **111** | **0** | **1** | **3** |

**Không có Fail cố ý ở tầng L3**: khác với L1 (5 EXPECTED FAIL) và L2 (4 EXPECTED FAIL), các sai lệch
tìm được ở L3 đều được **pin theo hành vi hiện tại** kèm ghi chú mã defect trong cột Notes, nên toàn
bộ suite xanh. Lý do: 6 phát hiện D36–D41 là *quyết định thiết kế lệch tài liệu* (mã lỗi, shape
response, thiếu rate limit) chứ không phải lỗi làm hỏng dữ liệu — pin để chống hồi quy có giá trị hơn
là để suite đỏ.

Tỉ lệ `Negative? = Yes`: **58/112** (không tính 3 dòng perf không có cột này) — vượt xa mức tối thiểu
¼ của brief.

## 6 sai lệch mới (D36–D41)

Chi tiết đầy đủ kèm `file:line` và đề xuất sửa ở `docs/l1-unit-tests/SRS-CODE-DIVERGENCE.md`.

| ID | Mức | Nội dung | Test chứng minh |
|---|---|---|---|
| **D36** | Trung bình | Lỗi xác thực trả **401 body rỗng** — không có `error_code`, không có `correlation_id` (SecurityConfig thiếu `authenticationEntryPoint`) | `L3-AUTH-16`, `L3-USR-08`, `L3-SEC-04` |
| **D37** | Trung bình | `GET /users` trả `Page` thô của Spring thay vì `PageResponse` | `L3-USR-01` |
| **D38** | **Cao (bảo mật)** | Không rate limit, không lockout: 20 lần login sai không bị chặn | `L3-SEC-07` |
| **D39** | Trung bình (bảo mật) | `forgot-password` tiết lộ email có tồn tại hay không | `L3-AUTH-12` |
| **D40** | Trung bình | Vi phạm quyền ở `/me/exam-attempts` trả 400 `REQ_001` thay vì 403 `AUTH_002` | `L3-EXM-16` |
| **D41** | **Cao** | Câu hỏi tạo mới mặc định **APPROVED** → `QUESTION_AUTHOR` tự duyệt, cổng reviewer vô hiệu | `L3-EXM-03` |

Ngoài ra L3 xác nhận lại (pin) các sai lệch đã biết: **D15** (chủ hồ sơ không tự trả về nháp —
`L3-TRN-10`), **D24/0–10 vs 0–100** (`L3-EXM-10`), **D25** (refresh không rotation — `L3-AUTH-07`),
**D32** (registry mã lỗi TDS 8.1 lệch code — mọi dòng cột `Expected Error Code`).

Một quan sát về **tính không nhất quán của hợp đồng API**, đáng đưa vào mục Test Analysis Notes:
- 3 kiểu phân trang cùng tồn tại: `PageResponse` (chuẩn), `Page` thô (`GET /users`), phân trang dàn
  phẳng vào DTO (`/competency/summary`); nhiều endpoint evaluation **không phân trang**, trả `List`.
- 3 status code cho cùng hành vi "tạo mới": 200 (`/training/records`), 201 + `Location` (`/forms`,
  `/form-submissions`), 204 không envelope (`DELETE /forms/{id}`).
- Cùng một loại lỗi trả 2 mã khác nhau: enum sai trên `@ModelAttribute` → 422 `VAL_001`
  (`L3-USR-03`), enum sai trên `@RequestParam` → 400 `REQ_001`; bean validation → 422 còn domain
  validation → 400 (`L3-TRN-04` vs `L3-TRN-06`).
- Truy cập tài nguyên của người khác trả 3 kết quả khác nhau: 403 (`L3-SEC-01`), 404 (`L3-QLT-15`, cố
  ý để không xác nhận sự tồn tại), 400 (`L3-EXM-16`, D40).

## Case Blocked và Not Run — nói thật lý do

- **`L3-SEC-09` (Blocked)** — OWASP A05: cần OWASP ZAP chạy active scan và một deployment có TLS để
  kiểm HSTS/security headers. Môi trường này không có ZAP, test server chỉ nói HTTP. Test **tồn tại**
  trong code với `@Disabled` ghi rõ lý do; workbook để `Status = Blocked` (không phải `Skip`).
  Ghi chú kèm theo: `app.cors.allowed-origin-patterns` mặc định `*` đi cùng `allowCredentials(true)`
  — an toàn khi môi trường có cấu hình, nguy hiểm nếu property bị bỏ trống.
- **`L3-PERF-01/02/03` (Not Run)** — cần cài k6 và app chạy trên PostgreSQL thật. Script thật đã có
  trong `scripts/k6/` (`load-nfr-p01.js`, `stress-nfr-s01.js`, `load-nfr-p02-scoring.js` + README
  hướng dẫn seed tài khoản và cách chạy). Cột `Baseline` / `Actual Result` để trống cho tới lần chạy
  đầu tiên.

**Không có dòng Blocked nào cho dashboard**, trái với dự đoán ban đầu: `DashboardService` dùng SQL
tưởng như chỉ PostgreSQL chạy được (`::numeric`, `date_trunc(… at time zone …)`,
`count(*) filter (where …)`) nhưng **H2 ở `MODE=PostgreSQL` thực thi được tất cả**, nên
`L3-ANL-01/02/04/05` đều Pass. Cảnh báo đi kèm trong Notes: chỉ có *biên bucket* của `/forms/trend`
và cách làm tròn của các biểu thức cast là được bảo đảm trên PostgreSQL thật.

## Môi trường chạy

- **H2 in-memory `MODE=PostgreSQL`** thay PostgreSQL 17 (Docker daemon tắt, không dùng
  Testcontainers). Schema do Hibernate `ddl-auto: create-drop` suy ra từ entity — **không phải** schema
  production (dự án không có migration tool; `db/migration/*.sql` tồn tại nhưng không có Flyway nên
  không được áp dụng).
- **Không có RabbitMQ broker**: biên `EmailProducer` được capture bằng `CapturingEmailProducerConfig`
  (bean `@Primary`), nên các assertion "email đã được gửi" là ở biên publish, không phải ở SMTP.
- **Cloudflare R2** thay bằng store in-memory (`TestEvidenceStorageConfig`, `@Profile("test")`) →
  presigned URL có dạng `https://evidence.test/...`.
- **Không seed admin** (`app.seed.enabled: false` trong test profile) → mỗi class tự tạo `User` +
  `Role` + `UserRole` (+ `Permission`/`RolePermission` cho các case permission evaluation) rồi đăng
  nhập thật.
- 9 class L3 dùng **một** Spring context duy nhất (cùng bộ annotation trên
  `AbstractApiSystemTest`) — kiểm bằng số lần "Started CarehubBackendApplication" trong log.

## Cách paste vào workbook

Mỗi file CSV: dòng 1 = tiêu đề sheet, dòng 2 = header, dòng 3+ = dữ liệu (gồm cả dòng divider
`▶ Block: …` / `▶ FLOW-xx: …` / `▶ OWASP Axx — …`). Trong template, dữ liệu bắt đầu ở dòng 5 → **paste
vùng dữ liệu (từ dòng 3 của CSV) vào ô `A5`** của sheet tương ứng; dòng 1 CSV dùng để cập nhật ô `A1`.

**Quan trọng: 4 layout ⇒ 4 bộ cột khác nhau.** Không copy format chéo giữa các nhóm sheet:

| Layout | Sheet | Số cột | Cột Status | Cột Negative? |
|---|---|---|---|---|
| api | 6 sheet `*API` | 15 (A→O) | `M` | `L` |
| flow | `L3-APIFlows` | 11 (A→K) | `I` | `H` |
| perf | `L3-Performance` | 13 (A→M) | `K` | **không có** |
| sec | `L3-Security` | 12 (A→L) | `J` | `I` |

Việc cần làm với workbook:
1. **Xoá các sheet mẫu e-commerce** (`L3-OrderAPI`, `L3-InventoryAPI`, `L3-TrackingReportAPI`) và dòng
   `▶ Template Row` ở cuối mỗi sheet mẫu.
2. **Tạo/đổi tên thành 9 sheet** theo bảng số liệu ở trên. Template đã có sẵn `L3-AuthAPI`,
   `L3-APIFlows`, `L3-Performance`, `L3-Security` với đúng layout — tái dùng chúng; 5 sheet api còn
   lại copy format từ `L3-AuthAPI`.
3. **Sheet `Introduction`**: giữ phần Coverage Techniques + Column Definitions; sửa Primary tool →
   `JUnit 5 + @SpringBootTest(RANDOM_PORT) + RestTemplate (HTTP thật, login thật) + k6 (Performance) + OWASP ZAP (Security, Blocked)`;
   thêm bảng chú giải tiền tố Test ID (dưới) và ghi chú môi trường H2/no-broker.

### Data validation phải giữ được

- `Priority`: chỉ `P1`, `P2`, `P3` (cột `E` với layout api/flow, cột `D` với perf/sec)
- `Status`: chỉ `Not Run`, `Pass`, `Fail`, `Blocked`, `Skip` (cột theo bảng layout ở trên)
- `Negative?`: chỉ `Yes`, `No`

### Ô nhiều dòng

Các cột `Request`, `Expected Response Body`, `Flow Steps`, `Expected State After Each Step`,
`k6 Config`, `Request / Payload`, `Expected Safe Response` chứa ký tự xuống dòng thật → bật **Wrap
text** và đặt độ cao dòng tự động. Sheet `L3-APIFlows` có ô rất dài (9 bước) — nên đặt độ cao tối
thiểu ~120px cho dễ đọc.

## Chú giải tiền tố Test ID (thêm vào sheet Introduction)

| Tiền tố | Sheet | Phạm vi |
|---------|-------|---------|
| `L3-AUTH` | L3-AuthAPI | login / refresh / logout / OTP / first-login — 6 endpoint public + entry point 401 |
| `L3-USR` | L3-UserAdminAPI | `/users`, `/me`, change-password, lock/unlock, soft delete, reference data |
| `L3-TRN` | L3-TrainingAPI | hồ sơ CME, minh chứng multipart, trạng thái tuân thủ, ma trận role |
| `L3-QLT` | L3-QualityAPI | form builder, version + publish, assignment, submission + scoring |
| `L3-EXM` | L3-ExamAPI | question bank → set → config → paper → assignment → attempt, ma trận 8 permission |
| `L3-ANL` | L3-AnalyticsAPI | dashboard admin/manager, evaluation dashboard, competency, notification, system settings |
| `L3-FLOW` | L3-APIFlows | 5 giao dịch nghiệp vụ nhiều bước (SC-01, SC-02, SC-03, đổi mật khẩu, logout) |
| `L3-PERF` | L3-Performance | k6: NFR-P01 load, NFR-S01 stress, NFR-P02 scoring write path |
| `L3-SEC` | L3-Security | OWASP A01/A02/A03/A07/A09 (chạy thật) + A05 (Blocked, cần ZAP) |

## Sinh lại dữ liệu

CSV **không phải file để sửa tay** — sửa sẽ bị ghi đè. Nguồn sự thật:

| Cột | Nguồn |
|-----|-------|
| Test ID, Coverage Technique / Test Type / OWASP Category | `@DisplayName("L3-XXX-NN | <technique>: …")` trong file test Java |
| Các cột nội dung | `l3-testcases.json` (mỗi sheet khai `layout` riêng) |
| Status, Defect ID | surefire XML mới nhất (`statusOverride` trong JSON thắng — dùng cho Blocked/Not Run) |

```bash
# 1. chạy test để có báo cáo mới (9 failure cố ý của L1+L2 — dùng failure.ignore)
cd carehub-backend && ./mvnw clean test -Dmaven.test.failure.ignore=true

# 2. kiểm ID hai chiều code ↔ JSON, enum theo từng layout, tỉ lệ Negative ≥ 1/4 (exit 1 nếu lệch)
cd .. && python scripts/l3-testcases.py check

# 3. sinh lại 9 file CSV với Status thật
python scripts/l3-testcases.py build
```

Chỉ chạy riêng tầng L3: `./mvnw test "-Dtest=*ApiSystemTest,ApiFlowSystemTest"` (~4 phút, gồm 1 lần
boot context).

## Tài liệu liên quan

- `docs/L2-L3-TESTCASE-BRIEF.md` — hợp đồng cột cho cả 4 layout + enum + quy ước truy vết.
- `docs/l1-unit-tests/SRS-CODE-DIVERGENCE.md` — sổ defect D1–D41; L3 thêm D36–D41.
- `docs/l1-unit-tests/README.md` (217 case) và `docs/l2-integration-tests/README.md` (93 case) —
  hai tầng dưới, cùng pipeline.
- `scripts/k6/README.md` — cách cài k6, seed dữ liệu tải và điền `Baseline`/`Actual Result`.
