# Phase 10 — Remaining Work & Future Enhancements

| Trạng thái | BACKEND DONE (2026-07-13) — FRONTEND PENDING |
|------------|----------------------------------------------|
| Ngày hoàn thành backend | 2026-07-13 |
| File chi tiết | [phase-10-implementation-summary.md](phase-10-implementation-summary.md) |
| Nhóm màn hình | A, B, C, D (tất cả) |

---

## 1. Phạm vi

Phase này liệt kê tất cả công việc **chưa implement**, tổ chức theo priority. Mỗi mục bao gồm:
- Đáp ứng yêu cầu nào từ đề án bệnh viện
- Mô tả công việc cần làm
- Entity/API/Screen cần thêm hoặc sửa
- Liên quan đến phase nào

---

## A. Competency Classification Engine

| Priority | **High** |
|----------|----------|
| Đáp ứng đề án | Dòng 105-107: "Xem được điểm và mức phân loại đánh giá năng lực chuyên môn... cảnh báo màu đỏ nếu mức phân loại không đạt"; Dòng 131: "Cột 5 là mức phân loại đánh giá năng lực chuyên môn"; Dòng 161: "Thay đổi được mức điểm để phân loại mức đánh giá kiến thức, đánh giá năng lực chuyên môn" |
| Nguồn ý tưởng | Phase 08 plan gốc của bạn |

### Mô tả
Hiện tại sau khi chấm điểm, hệ thống chỉ trả về Pass/Fail (boolean). Cần nâng cấp lên **5 mức phân loại năng lực**:
- `NOT_COMPETENT` — Chưa đạt năng lực (< 40%)
- `BEGINNER` — Sơ cấp (40-59%)
- `BASIC` — Cơ bản (60-74%)
- `PROFICIENT` — Thành thạo (75-89%)
- `ADVANCED` — Chuyên sâu (90-100%)

### Cần làm
- **Entity mới**: `CompetencyClassification` hoặc mở rộng `ExamAttempt` (thêm `classification` field)
- **Configurable thresholds**: Admin có thể thay đổi ngưỡng điểm cho từng mức (theo đề án: "Thay đổi được mức điểm để phân loại")
- **Category-level classification**: Phân loại theo từng lĩnh vực (không chỉ tổng điểm)
- **Tích hợp knowledge + skills**: Liên thông điểm trắc nghiệm (Phase 08) + điểm bảng kiểm (Form module) → tổng điểm năng lực (theo đề án: "Cột 4 là tổng điểm cột 2 và cột 3")
- **API mới**:
  - `GET /api/v1/competency/employees/{id}` — Xem phân loại của 1 nhân viên
  - `GET /api/v1/competency/departments/{id}` — Xem phân loại theo khoa
  - `PUT /api/v1/competency/thresholds` — Cấu hình ngưỡng
- **UI**: Màn hình "Phân loại năng lực" trong admin + hiển thị classification trong Result Screen (staff)
- **Cảnh báo đỏ**: Theo đúng đề án — "hiển thị cảnh báo màu đỏ nếu mức phân loại không đạt"

---

## B. Assignment Target Mở Rộng

| Priority | **Medium** |
|----------|------------|
| Đáp ứng đề án | Dòng 109-110: "Giao bài cho khoa"; plan gốc thêm POSITION + GROUP + ALL |
| Nguồn ý tưởng | Phase 06 plan gốc của bạn |

### Mô tả
Hiện tại Assignment hỗ trợ target: **Employee** (cá nhân) + **Department** (khoa). Cần mở rộng:
- `POSITION` — Giao theo chức danh (ĐDTK, ĐDV, KTV...)
- `GROUP` — Giao theo nhóm đào tạo (vd: "Điều dưỡng mới tuyển", "Nhóm đào tạo ICU")
- `ALL_EMPLOYEES` — Giao toàn bệnh viện (tất cả nhân viên đang hoạt động)

### Cần làm
- Mở rộng `ExamAssignmentTarget` entity thêm `positionId`, `groupId`
- Backend: resolve position/group → danh sách user (tương tự department expansion)
- UI: thêm option trong Assignment form

---

## C. Training Compliance Integration

| Priority | **Medium** |
|----------|------------|
| Đáp ứng đề án | Liên thông module (1) CME và (3) Đánh giá năng lực |

### Mô tả
Khi ĐDV pass bài kiểm tra năng lực, hệ thống tự động cập nhật Training Compliance record — đánh dấu nhân viên đã hoàn thành yêu cầu đào tạo tương ứng.

### Cần làm
- Event-driven: `EVENT_ATTEMPT_PASSED` → Training Module listener
- Map ExamConfig/Paper → Training Requirement
- Update compliance % cho nhân viên
- Notification: "Bạn đã hoàn thành bài kiểm tra X. Compliance: Y%"

---

## D. Advanced Analytics & Dashboard Filters

| Priority | **Medium** |
|----------|------------|
| Đáp ứng đề án | Dòng 127-131 (Manager analytics chi tiết); Dòng 133, 165 (Dashboard) |

### Mô tả
Dashboard hiện tại có metrics cơ bản (tổng câu hỏi, điểm TB, item analysis top 50). Cần nâng cấp:

- **Time range filter**: fromDate → toDate
- **Dimension filters**: theo Config, Paper, Assignment, Department
- **Drilldown**: click vào 1 metric → xem danh sách chi tiết
- **Discrimination index**: độ phân biệt của câu hỏi (câu tốt phân biệt được NV giỏi và NV yếu)
- **Wrong answer distribution**: với mỗi câu, đáp án sai nào được chọn nhiều nhất
- **Export analytics report**: XLSX/PDF

### Cần làm
- Mở rộng `EvaluationDashboardService` + thêm query params
- UI: filter bar trên dashboard + drilldown navigation
- Discrimination index calculation từ `ExamAttemptAnswer`

---

## E. OCR Production for Scanned PDFs

| Priority | **Medium** |
|----------|------------|
| Liên quan | Phase 04 (AI Generation) |

### Mô tả
Hiện tại PDF scan (không có text layer) dừng ở trạng thái `OCR_REQUIRED` — chưa có OCR engine. Cần tích hợp để xử lý tài liệu scan từ bệnh viện.

### Cần làm
- Chọn OCR engine (Tesseract / Google Cloud Vision / Azure OCR)
- Lưu text per page + confidence scores
- Low-confidence pages → flag cho human review
- Retry OCR từ UI
- UI: hiển thị confidence trên DocumentDetailPage

---

## F. Prompt & Model Governance

| Priority | **Medium** |
|----------|------------|
| Liên quan | Phase 04 (AI Generation), Phase 05 (Paraphrase) |

### Mô tả
Prompt templates và model config hiện đang nằm trong code/application.yaml. Cần UI quản trị:

- `PromptTemplate` entity: version, provider, model, active flag, template content
- UI: xem active prompt/model, rollback version, chạy benchmark nhỏ
- Model health dashboard: DeepSeek/E5/VietQuill status, latency, token cost per job
- Cảnh báo khi mock provider đang bật

### Cần làm
- Entity + API + UI mới cho PromptTemplate
- Mở rộng `/api/v1/ai-model-runtime/status` với metrics
- Benchmark dataset (20-30 tài liệu mẫu) + UI so sánh prompt versions

---

## G. Performance & Scaling

| Priority | **Medium** |
|----------|------------|

### Mô tả
- **Server-side pagination**: Đảm bảo tất cả list endpoint dùng Spring Pageable (hiện tại một số endpoint trả về toàn bộ)
- **DB indexes**: status, createdAt, documentId, questionSetId, paperId, assignmentId, audit action/entity/actor/createdAt
- **Migration scripts**: Flyway/Liquibase thay cho `ddl-auto: update` (production-ready)
- **Seed data**: 5k questions, 200 sets, 1k papers, 10k attempts để test performance
- **Load testing**: JMeter/k6 script cho concurrent attempts

---

## H. Mobile Responsive Polish

| Priority | **Low** |
|----------|---------|

### Mô tả
Đề án yêu cầu: "Phần mềm chạy được trên máy tính để bàn và trên điện thoại thông minh" (dòng 90). Admin screens hiện tại desktop-oriented. Cần:

- Responsive testing 27 evaluation screens
- Table horizontal scroll trên mobile
- Form layout điều chỉnh cho màn hình nhỏ
- Staff screens (`/staff/exam/*`) ưu tiên mobile-first

---

## I. UAT, Documentation & Seed Data

| Priority | **Medium** |
|----------|------------|

### Mô tả
- **UAT checklist**: End-to-end scenario — Import 100 câu → Tạo set → Tạo config → Generate paper → Assign → Làm bài → Dashboard
- **Seed data bệnh viện**: 200-500 câu hỏi thật về điều dưỡng (nhiễm khuẩn, an toàn người bệnh, ICU, cấp cứu, thuốc...)
- **Demo script**: Kịch bản demo cho stakeholder bệnh viện
- **Admin operation guide**: Tài liệu hướng dẫn sử dụng (tiếng Việt)
- **Swagger/OpenAPI**: Đảm bảo toàn bộ API có documentation

---

## J. Error State Consistency

| Priority | **Medium** |
|----------|------------|

### Mô tả
Audit 27 screens cho consistent error handling:
- **Empty state**: "Chưa có dữ liệu" + illustration/CTA
- **Loading skeleton**: Ant Design Skeleton hoặc custom
- **Error banner**: message rõ ràng + nút "Thử lại"
- **403 handling**: "Bạn không có quyền truy cập" + link về trang được phép
- **404 handling**: "Không tìm thấy" + nút quay lại

---

## K. Security Integration Tests

| Priority | **Medium** |
|----------|------------|

### Mô tả
- MockMvc integration tests: verify 403 cho từng endpoint với user thiếu permission
- Test với 3 user profiles: author (QUESTION_AUTHOR), reviewer (QUESTION_REVIEWER), publisher (EXAM_PUBLISHER + RESULT_VIEWER)
- Verify `SCORE_ONLY` policy: user không nhận được correctAnswer trong API response

---

## L. Các ý tưởng từ plan gốc chưa implement

| Ý tưởng từ plan gốc | Trạng thái |
|---------------------|------------|
| Question types mở rộng: Essay, True/False, Matching, Ordering, Fill Blank, Case Study | Để dành cho tương lai |
| Question version/approval workflow | Đã có status lifecycle, có thể mở rộng thêm |
| Image/Audio/Video question | Để dành cho tương lai |
| Power BI Connector | Để dành cho tương lai |
| Notification Reminder Scheduler (email) | Để dành cho tương lai |
| MIXED question strategy (câu bắt buộc + random) | Có thể thêm vào ExamConfig |
| Paraphrase history drawer per question | Có thể thêm vào QuestionBankListPage |
| Visual diff (gốc vs biến thể) | Có thể thêm vào ParaphraseJobReviewPage |

---

## Tổng kết: Độ hoàn thiện

| Khu vực | Mức độ hoàn thiện |
|---------|-------------------|
| Question Bank + Category + Rules | 95% — cần server-side pagination |
| AI Generation (DeepSeek) | 85% — thiếu OCR production, prompt governance |
| Paraphrase (VietQuill) | 85% — thiếu visual diff, history drawer |
| Question Set + Versioning | 95% |
| Exam Config + Paper Generation | 90% — thiếu MIXED strategy |
| Assignment + Attempt + Scoring | 85% — thiếu target mở rộng, competency classification |
| Dashboard + Analytics | 60% — thiếu filters, drilldown, discrimination index, export |
| Audit Log | 80% — thiếu before/after diff, server-side pagination |
| Permissions | 85% — thiếu UI quản trị, button-level hide |
| Import/Export | 90% |
| **Tổng thể** | **~85%** |

Các mục A, B, C (Competency Classification, Target Mở Rộng, Training Integration) là **quan trọng nhất** vì trực tiếp đáp ứng yêu cầu từ đề án bệnh viện.
