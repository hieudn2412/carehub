# SRS Amendment — v1.3 → v1.4 (paste-ready)

**Không tự sửa `Report 3.0_SRS_VietDuc-Care_v1.3.docx`.** File 2.5 MB có hình vẽ nhúng; sửa bằng cách
chỉnh XML thô có nguy cơ làm hỏng mà không kiểm chứng được. Nội dung dưới đây đã soạn đúng dạng để
paste vào docx (bằng Claude cowork hoặc thủ công).

Ba nhóm thay đổi:
1. **Mới** — mục `4.5 Boundary Value Register` (BV-01 … BV-18): điều kiện để cột `SRS Reference` của
   sheet `BoundaryValues` trong workbook L1 truy vết được. Template L1 yêu cầu mã `BV-xx` nhưng SRS
   v1.3 chưa có.
2. **Sửa** — D6, D9, D10 (SRS viết trước, code là thực tế đang chạy).
3. **Version History** — thêm dòng v1.4.

Mọi giá trị dưới đây đã đối chiếu trực tiếp với code, kèm `file:line`.

---

## 1. Thêm mục mới: 4.5 Boundary Value Register

> Chèn ngay sau mục `4.4 TestAttempt State Transition Table`, trước `Part 5 — Business Rules`.

**Đoạn mở đầu:**

> Bảng dưới đây liệt kê mọi ràng buộc số (numeric constraint) mà hệ thống enforce, dùng làm cơ sở cho
> Boundary Value Analysis ở Level 1. Mỗi mã BV-xx được tham chiếu trực tiếp từ sheet `BoundaryValues`
> của `VietDuc-Care_UnitTests_L1.xlsx`. Cột "Enforced at" ghi vị trí trong mã nguồn để bảo đảm truy
> vết hai chiều.

**Bảng 4.5 — Boundary Value Register**

| ID | Constraint | Min | Max | Default | Enforced at | Violation Behaviour |
|----|-----------|-----|-----|---------|-------------|---------------------|
| BV-01 | Declared training hours, manual record | 0.5 h | 999 h | — | `TrainingDomainValidator:13-14, 32-39` | HTTP 400 `REQ_001`. ⚠️ Message hiện ghi "24" — xem defect D3 |
| BV-02 | Evidence file size, server-side | 1 byte | 5 MB (5 242 880 B) | — | `TrainingDomainValidator:20, 48-51` | HTTP 400 `REQ_001` |
| BV-03 | Evidence file size, client-side pre-check | 1 byte | 20 MB | — | `evidenceFile.js:1` | Chặn tại form. ⚠️ Lệch BV-02 — xem defect D4 |
| BV-04 | Evidence optimisation limits | — | input 20 MB · stored 5 MB · 2048 px · 40 000 000 px ảnh · 150 000 000 px ảnh trong PDF · 100 trang PDF | — | `EvidenceOptimizationService:38-43` | Bỏ qua tối ưu hoặc từ chối xử lý |
| BV-05 | Minute part of the legacy `NhMM` duration format | 0 | 59 | — | `TrainingLegacyDurationParser:33-35` | `parsed = false`, cảnh báo "Minute part must be between 0 and 59" |
| BV-06 | Bare-number legacy duration confidence threshold | — | 24 | — | `TrainingLegacyDurationParser:68-73` | ≤ 24 → confidence 0.85; > 24 → 0.60 + yêu cầu manager xác nhận |
| BV-07 | Semantic duplicate — strong threshold | — | — | 0.93 | `ValidationRulesProperties:18` (`validation.duplicate.strong-min`) | ≥ ngưỡng → `strongDuplicate = true`, chặn lưu |
| BV-08 | Semantic duplicate — review threshold | — | — | 0.80 | `ValidationRulesProperties:18` (`validation.duplicate.review-min`) | ≥ ngưỡng → `needsReview = true` |
| BV-09 | Question quality — reject threshold | — | — | 0.55 | `ValidationRulesProperties:25` (`validation.quality.reject-min`) | < ngưỡng → loại câu hỏi ứng viên |
| BV-10 | Exam assignment attempts per user | 1 | 10 | 1 | `ExamAssignmentService:68, 424` | Giá trị ngoài dải bị clamp về biên (không báo lỗi) |
| BV-11 | Competency tier bands, thang 0–10 | 0 | 10 | ranh giới 4.0 / 6.0 / 7.5 / 9.0 | `CompetencyClassificationService:24-27` | Điểm > 10 bị clamp về 10. ⚠️ Band mặc định có khe — xem defect D5 |
| BV-12 | Quality form critical-group weight | 0 % | 100 % | 60 % | `FormScoringPolicy:12` | Giá trị không parse được → sentinel −1 |
| BV-13 | Paraphrase validation thresholds | — | — | source semantic low 0.72 · review 0.85 · option semantic low 0.72 · lexical difference low 0.08 | `ParaphraseValidationService:26-29` | Dưới ngưỡng → cảnh báo hoặc loại bản viết lại |
| BV-14 | First-login OTP validity | — | 5 phút (300 s) | 5 phút | `FirstLoginServiceImpl:28` | OTP hết hạn → yêu cầu gửi lại |
| BV-15 | Generated password length | 6 | 6 | 6 | `UserServiceImpl:38` | — |
| BV-16 | Email dispatch retries | — | 5 lần | 5 | `EmailConsumer:19`; delay 15 phút `RabbitMQConfig:27` | Vượt số lần → chuyển dead-letter |
| BV-17 | API page size | 1 | 100 | theo endpoint | `MAX_PAGE_SIZE` ở 10 service (`DashboardService:25`, `FormAssignmentService:27`, …) | Yêu cầu lớn hơn bị clamp về 100 |
| BV-18 | Minimum extractable text in a PDF | 40 ký tự | — | — | `DocumentTextExtractor:26` | Dưới ngưỡng → chuyển sang OCR |

**Ghi chú cần đưa vào SRS ngay dưới bảng:**

> BV-01, BV-03 và BV-11 hiện có sai lệch giữa tài liệu và mã nguồn, được theo dõi ở
> `docs/l1-unit-tests/SRS-CODE-DIVERGENCE.md` (defect D3, D4, D5). BV-10 clamp im lặng thay vì trả
> lỗi validation — cần xác nhận đây là hành vi mong muốn với FR-050.

---

## 2. Sửa nội dung hiện có

### 2.1 — D6: thang điểm và tên tier năng lực

**BR-01 — thay bằng:**

> BR-01: Competency classification logic assigns one of five tiers — Not Competent / Beginner / Basic
> / Proficient / Advanced — from configurable, contiguous score bands over a 0–10 scale. Default band
> boundaries are 4.0, 6.0, 7.5 and 9.0 (see BV-11). Threshold sets may be configured globally or per
> question category; a set stored on a 0–100 scale is rescaled to 0–10 at evaluation time.

**BR-11 — thay bằng:**

> BR-11: An employee's competency tier is determined by the average score of all assessments within
> the period, expressed on the same 0–10 scale as BR-01.

**FR-052 — thay bằng:**

> FR-052 | The system shall assign one of five competency tiers from contiguous, non-overlapping
> bands over a 0–10 scale. | FT-14 | High

**DC-05 — thay bằng:**

> DC-05 | Classification bands must be contiguous and non-overlapping across the full 0–10 scale (no
> score may fall outside every band). | ClassificationRule | Activation blocked with HTTP 422.

*(Mọi chỗ khác trong Part 3 / Part 8.3 còn ghi "Good / Average / Weak" hoặc "0–100" cho competency
cũng cần sửa theo — dùng Find & Replace.)*

### 2.2 — D9: định danh đăng nhập

**DC-06 — thay bằng:**

> DC-06 | Employee code must be unique across all accounts (active or inactive); work email, when
> present, must also be unique. | User | Account creation blocked with HTTP 409.

**AC-01-01 — thay bằng:**

> AC-01-01: When a user submits a correct employee code and password, the system issues a valid
> session token within 1000 ms and redirects to the role-appropriate landing screen.

**AC-01-03 / NAC-01-02 / FR-001 / FR-003**: đổi "work email" → "employee code" ở vị trí định danh
đăng nhập. Email vẫn giữ vai trò kênh nhận thông báo và đặt lại mật khẩu (AC-01-02, BR-30).

### 2.3 — D10: bảng state transition 4.4

Trong cả hai bảng của mục 4.4, đổi tên trạng thái cho khớp `ExamAttemptStatus`:

| SRS v1.3 | SRS v1.4 |
|----------|----------|
| Initial | *(giữ nguyên — đây là trạng thái trước khi attempt tồn tại, không phải giá trị enum)* |
| In_Progress | `IN_PROGRESS` |
| Submitted | `SUBMITTED` |
| Graded | `GRADED` |
| Voided | `CANCELLED` |

**Thêm một dòng vào bảng "Valid State Transitions":**

| From State | Trigger Event | Guard Condition | To State | System Action |
|-----------|---------------|-----------------|----------|---------------|
| `IN_PROGRESS` | Countdown reaches zero | Attempt not yet submitted | `EXPIRED` | Auto-submits and grades the answers recorded so far (FR-048). |

**Thêm một dòng vào bảng "Invalid Transitions":**

| From State | Attempted Transition | Why Invalid | System Response |
|-----------|---------------------|-------------|-----------------|
| `EXPIRED` | Resume or edit answers | The countdown has elapsed; the attempt is terminal | HTTP 409 Conflict; require a new attempt if any remain. |

---

## 3. Version History

Thêm dòng vào bảng Version History ở đầu tài liệu:

| Version | Date | Author | Description |
|---------|------|--------|-------------|
| v1.4 | 26/07/2026 | ManhTuan | Added 4.5 Boundary Value Register (BV-01…BV-18). Aligned BR-01/BR-11/FR-052/DC-05 with the implemented five-tier 0–10 competency scale, DC-06/AC-01-01 with employee-code login, and the 4.4 state table with `ExamAttemptStatus` (`Voided`→`CANCELLED`, added `EXPIRED`). |

Đồng thời đổi tiêu đề/footer `v1.3` → `v1.4` và `SRS Reference` trong `Report 5.0_TestPlan` thành
`VietDuc-Care_SRS_v1.4`.
