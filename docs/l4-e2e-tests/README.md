# L4 E2E Tests — hướng dẫn điền `Report 5.4_L4-E2ETests_Template.xlsx`

Bộ dữ liệu này để Claude cowork (hoặc bạn) paste vào workbook L4 (`CareHub_E2ETests_L4.xlsx`).
**42 dòng / 5 sheet**, mỗi dòng tương ứng 1-1 với một `test()` thật trong
`carehub-frontend/e2e/**/*.spec.js` (Playwright, JavaScript).

Khác ba tầng trước: **toàn bộ 42 dòng đang ở `Status = Not Run`** — spec là code thật, chạy được, nhưng
chưa được chạy vì lý do môi trường nêu ngay bên dưới. Đây là lựa chọn trung thực, không phải bỏ dở.

## Vì sao chưa chạy

| Rào cản | Chi tiết |
|---|---|
| DB dùng chung | `carehub-backend/.env.properties` trỏ `DB_URL=jdbc:postgresql://116.118.6.153:5432/carehub` — cơ sở dữ liệu **cả nhóm đang dùng**. E2E ghi thật: tạo tài khoản, hồ sơ, đề thi, bài nộp. Không hoàn tác được. |
| Email thật | Cùng file có `MAIL_*` trỏ SMTP thật. Luồng tạo tài khoản (`L4-F05-01`) và quên mật khẩu **gửi email thật** cho địa chỉ trong dữ liệu test. |
| Không có hạ tầng cục bộ | Docker daemon tắt → không `docker compose up` được PostgreSQL/RabbitMQ/Redis. Máy có PostgreSQL cục bộ ở `127.0.0.1:5432` nhưng đó là instance riêng, chưa có schema/dữ liệu của dự án. |
| Chưa có browser | `@playwright/test` đã thêm vào `devDependencies` nhưng **browser chromium chưa tải** (`npx playwright install chromium`, ~130 MB). |

Cùng khuôn với `L3-Performance` (3 script k6 cũng `Not Run`): **có artifact chạy được + hướng dẫn chạy**
quan trọng hơn một cột `Pass` không có bằng chứng.

## Số liệu cho mục 5.1 của Report 5.0

| Sheet trong workbook | File CSV | Case | Pass | Fail | Blocked | Not Run |
|---|---|---|---|---|---|---|
| `L4-CriticalPaths` | `L4-CriticalPaths.csv` | 5 | 0 | 0 | 0 | **5** |
| `L4-UserJourneys` | `L4-UserJourneys.csv` | 18 | 0 | 0 | 0 | **18** |
| `L4-Permissions` | `L4-Permissions.csv` | 9 | 0 | 0 | 0 | **9** |
| `L4-SessionManagement` | `L4-SessionManagement.csv` | 6 | 0 | 0 | 0 | **6** |
| `L4-Responsive (Optional)` | `L4-Responsive.csv` | 4 | 0 | 0 | 0 | **4** |
| **Tổng** | | **42** | **0** | **0** | **0** | **42** |

Tỉ lệ `Negative? = Yes`: **15/42** — trên mức tối thiểu ¼.

Khi chạy thật, cột `Status` **tự điền**: Playwright ghi `carehub-frontend/playwright-report.json`, rồi
`python scripts/l4-testcases.py build` đọc file đó. Không sửa tay.

## 3 bug UI tìm được trước khi chạy một test nào

Khảo sát UI để chọn selector thì phát hiện code **đã commit trên nhánh** (vào qua merge `d08e504c`) có
lỗi `no-undef` — dùng identifier chưa khai báo/import. React ném `ReferenceError` khi render ⇒ **trang
trắng**. Đã xác minh bằng `npx eslint`.

| Mã | Trang | Hậu quả |
|---|---|---|
| **D42** | `/staff/training` (`TrainingHoursListScreen.jsx`) | Màn hình "Giờ đào tạo liên tục" của nhân viên **trắng hoàn toàn** — chặn cả luồng SC-01 từ giao diện. 6 identifier thiếu |
| **D43** | `/staff/training/{id}/evidence` (`TrainingHoursEvidenceScreen.jsx`) | Crash ở khối nút "Quay lại chi tiết hồ sơ" (`navigate`, `ArrowLeftOutlined` chưa import) |
| **D44** | `/admin/training/activity-types` (`ActivityTypeListPage.jsx`) | Tạo loại hình đào tạo mà để trống mã → handler ném lỗi, không lưu, không báo gì (`generateCodeFromName` không tồn tại) |

Chi tiết + cách sửa: `docs/l1-unit-tests/SRS-CODE-DIVERGENCE.md`, mục D42–D44.

**Ba tầng dưới không thể thấy nhóm lỗi này**: L1 không render các trang đó, L2/L3 không chạm UI. Vì vậy
sheet CriticalPaths có `L4-CP-05` — **route sweep**: mở 19 route chính của 3 role và bắt sự kiện
`pageerror` của browser. Đây là lưới rẻ nhất chặn cả họ lỗi `no-undef`, và là case đầu tiên sẽ đỏ khi
chạy.

Ba dòng mang `Defect ID` sẵn: `L4-CP-05` và `L4-F01-01` → **D42**, `L4-F01-04` → **D43**. Chúng sẽ FAIL
khi chạy cho tới khi bug được sửa — đó là chủ ý.

Cũng nên biết: `npm run lint` hiện **fail 32 error / 7 warning** và repo **không có `.github/`** nên
không có gate nào chặn. Chỉ cần thêm một lint gate là ngăn được D42/D43/D44 tái diễn.

## Cách chạy khi đã có môi trường

```bash
# 0. Một lần: tải browser
cd carehub-frontend && npx playwright install chromium

# 1. Backend trỏ vào DB RIÊNG (đừng dùng DB nhóm) + SMTP giả
#    ví dụ: tạo database carehub_e2e trên PostgreSQL cục bộ rồi chạy
cd ../carehub-backend
DB_URL=jdbc:postgresql://localhost:5432/carehub_e2e \
MAIL_HOST=localhost MAIL_PORT=1025 \
APP_SEED_ENABLED=true ./mvnw spring-boot:run

# 2. Tài khoản test (không hardcode trong spec)
export E2E_ADMIN_CODE=... E2E_ADMIN_PASSWORD=...
export E2E_MANAGER_CODE=... E2E_MANAGER_PASSWORD=...
export E2E_STAFF_CODE=... E2E_STAFF_PASSWORD=...
export E2E_EVALUATOR_CODE=... E2E_EVALUATOR_PASSWORD=...   # tuỳ chọn (L4-PERM-06 tự Skip nếu thiếu)

# 3. Chạy (Playwright tự dựng Vite dev server ở :5173)
cd ../carehub-frontend && npm run test:e2e

# 4. Đồng bộ Status vào CSV
cd .. && python scripts/l4-testcases.py build
```

Yêu cầu về dữ liệu: **tài khoản MANAGER phải có ít nhất 1 nhân viên trong khoa của mình**
(`L4-F04-01`), tài khoản nhân viên phải đã hoàn tất first-login (`requiresFirstLoginSetup = false`), và
DB cần sẵn ≥1 phòng ban + ≥1 vai trò (`L4-F05-01`). Mọi tiền đề nghiệp vụ khác (loại hình đào tạo, form
đã publish, đề thi + phân công) **spec tự seed qua API** — xem `e2e/fixtures/api.js`, dùng đúng chuỗi
endpoint mà L3 đã kiểm.

`E2E_API_BASE` (mặc định `http://localhost:8081/api/v1`) là nơi phần seed gọi trực tiếp, không qua proxy
Vite. `E2E_BASE_URL` (mặc định `http://localhost:5173`) là nơi browser mở.

## Cạm bẫy đã xử lý trong spec — đọc trước khi sửa

- **Token nằm ở `sessionStorage`** (`carehub.accessToken`, `carehub.refreshToken`,
  `carehub.requiresFirstLoginSetup`). Playwright `storageState` **không** giữ sessionStorage ⇒
  `e2e/fixtures/auth.js` login qua UI một lần/worker rồi bơm lại bằng `page.addInitScript`.
- **0 `data-testid` trong toàn bộ `src/`.** Mọi selector dựa vào role/label/placeholder/text tiếng Việt,
  gom trong `e2e/fixtures/strings.js`. Trang login có `<label htmlFor>` nên `getByLabel` chạy tốt; nhiều
  trang form (`TrainingHoursFormScreen`, `ActivityTypeFormPage`, modal tài khoản) **không** có `htmlFor`
  và input không `id`/`name` ⇒ chỉ `getByPlaceholder` đáng tin. `id` do `useId()` sinh (`«r0»`) là không
  ổn định — **cấm** selector `#id`.
- **Widget tự viết thay `<select>`**: `SearchableDropdown` (form giờ đào tạo), `SearchableSelect` (thi),
  `MultiSearchSelect` (giao checklist), `DepartmentCombobox` (tài khoản) ⇒ `selectOption()` vô dụng, phải
  click mở panel rồi click option.
- **Upload luôn là `<input type="file">` bị ẩn** sau dropzone `role="button"` ⇒ dùng
  `locator('input[type=file]').setInputFiles(...)`.
- **`window.confirm` native ở 5 chỗ** (nộp bài thi, nộp checklist, trả hồ sơ về nháp, đổi trạng thái loại
  hình, xoá nhóm đào tạo) ⇒ phải `page.once('dialog', …)` trước khi click. Các chỗ khác dùng
  `ConfirmModal` in-DOM (`Xác nhận` / `Hủy`).
- **Toast tự tắt sau 4000 ms** (`.toast-message`, không có `role="alert"`) và là tín hiệu thành công
  chính của nhiều thao tác ghi ⇒ assert ngay sau hành động.
- **Trang làm bài thi** có countdown 1 s, autosave debounce 1.2 s + interval 15 s, `beforeunload`, và
  **tự nộp khi hết giờ rồi tự điều hướng** ⇒ seed `dueAt` +7 ngày, `timeLimitMinutes` 60.
- **Bộ lọc ngày mặc định** của danh sách bài kiểm tra là 1/1 năm hiện tại → hôm nay; assignment có
  `dueAt` ngoài khoảng đó sẽ **không hiện**.
- **Chuỗi tiếng Việt lặp giữa sidebar/breadcrumb/heading** (`Tuân thủ quy trình, quy định`,
  `Năng lực chuyên môn`, `Thực hiện đánh giá`) và nhiều câu bị ngắt dòng giữa JSX ⇒ dùng fragment ngắn,
  chú ý `Huỷ bỏ` vs `Hủy bỏ`, `Xoá` vs `Xóa`.
- Sidebar staff **không có link** tới `/staff/checklists` và `/staff/notifications` ⇒ spec `page.goto`.
- `httpClient` khi refresh thất bại gọi `window.location.replace('/auth/login')` — **hard navigation**.
- Spec đặt ngoài `src/` vì `vite.config.js` cấu hình vitest `include: ['src/**/*.test.{js,jsx}']`; chạy
  `npm run test` (49 case vitest) không đụng gì tới `e2e/`.
- `workers: 1` và `fullyParallel: false` là chủ ý: các journey ghi rồi đọc lại trên **một** database.

## Cách paste vào workbook

Cả 5 sheet **dùng chung một layout 14 cột** (A→N) — dễ hơn L3 vốn có 4 layout:

```
A Test ID | B Coverage Technique | C SRS Reference | D Feature | E Priority | F Actor (Role) |
G Entry Point (URL / Page) | H Precondition (DB + Auth + Sandbox) | I Test Steps (Browser Actions) |
J Expected UI Result | K Negative? | L Status | M Defect ID | N Notes
```

Mỗi file CSV: dòng 1 = tiêu đề sheet, dòng 2 = header, dòng 3+ = dữ liệu (gồm dòng divider `▶ Block: …`).
Template để dữ liệu từ dòng 5 ⇒ **paste vùng từ dòng 3 của CSV vào ô `A5`**; dòng 1 CSV cập nhật ô `A1`.

Việc cần làm với workbook:
1. Xoá dữ liệu mẫu e-commerce trong 5 sheet có sẵn và dòng `▶ Template Row` ở cuối mỗi sheet.
2. Giữ nguyên tên 5 sheet của template (`L4-CriticalPaths`, `L4-UserJourneys`, `L4-Permissions`,
   `L4-SessionManagement`, `L4-Responsive (Optional)`) — CSV đã khớp thứ tự đó.
3. Data validation: `Priority` (cột `E`) chỉ `P1/P2/P3`; `Negative?` (cột `K`) chỉ `Yes/No`; `Status`
   (cột `L`) chỉ `Not Run/Pass/Fail/Blocked/Skip`. Mở rộng vùng validation xuống hết dòng mới.
4. Bật **Wrap text** cho cột `G`→`J` (Entry Point, Precondition, Test Steps, Expected UI Result đều
   nhiều dòng) và đặt độ cao dòng tự động; `L4-CP-05` có ô Test Steps rất dài (19 route).
5. Sheet `Introduction`: giữ Coverage Techniques + Column Definitions; sửa Primary tool thành
   `Playwright (JavaScript) · Full browser stack — no mocks · môi trường riêng (chưa chạy)`; thêm bảng
   chú giải tiền tố Test ID (dưới) và mục "Vì sao chưa chạy" ở trên.

## Chú giải tiền tố Test ID (thêm vào sheet Introduction)

| Tiền tố | Sheet | Phạm vi |
|---|---|---|
| `L4-CP` | L4-CriticalPaths | Smoke sau deploy: login 3 role, tạo hồ sơ CME, route sweep bắt lỗi render |
| `L4-F01` | L4-UserJourneys | Giờ đào tạo CME: tạo → minh chứng → nộp → giờ tăng (+ nhánh lỗi) |
| `L4-F02` | L4-UserJourneys | Phiếu kiểm tra chất lượng: được giao → đánh giá → nộp (+ nháp, xung đột) |
| `L4-F03` | L4-UserJourneys | Bài kiểm tra năng lực: bắt đầu → làm bài → nộp → kết quả (+ hết lượt) |
| `L4-F04` | L4-UserJourneys | Giám sát của manager: nhân sự, minh chứng, trả hồ sơ về nháp |
| `L4-F05` | L4-UserJourneys | Quản trị: tạo tài khoản, công bố checklist, chặn giao khi chưa công bố |
| `L4-PERM` | L4-Permissions | RBAC trên UI: điều hướng bị chặn, menu theo role, deep link sau login |
| `L4-SESS` | L4-SessionManagement | Trang đích theo role, đăng xuất + Back, refresh im lặng, token bị thu hồi, 2 tab, first-login |
| `L4-RESP` | L4-Responsive | NFR-U01: 375 px và 768 px, không cuộn ngang (P3, optional) |

## Sinh lại dữ liệu

CSV **không phải file sửa tay**. Nguồn sự thật:

| Cột | Nguồn |
|---|---|
| Test ID, Coverage Technique | tiêu đề test: `test('L4-XXX-NN | Technique: …')` trong `carehub-frontend/e2e/**/*.spec.js` |
| Các cột nội dung | `l4-testcases.json` |
| Status, Defect ID | `carehub-frontend/playwright-report.json` (`statusOverride` trong JSON thắng) |

```bash
# kiểm ID hai chiều spec ↔ JSON, enum kỹ thuật, tỉ lệ Negative ≥ 1/4 (exit 1 nếu lệch)
python scripts/l4-testcases.py check

# sinh lại 5 CSV
python scripts/l4-testcases.py build

# liệt kê spec mà không cần browser/server — hữu ích để đối chiếu số case
cd carehub-frontend && npx playwright test --list
```

## Tài liệu liên quan

- `docs/l1-unit-tests/SRS-CODE-DIVERGENCE.md` — sổ defect D1–D44; L4 thêm D42–D44.
- `docs/l1-unit-tests/README.md` (217 case), `docs/l2-integration-tests/README.md` (93),
  `docs/l3-system-api-tests/README.md` (115) — ba tầng dưới, cùng pipeline.
- `scripts/k6/README.md` — tiền lệ "code thật, `Status = Not Run`" ở tầng L3.
