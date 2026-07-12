# TRAINING RECORDS MODULE — PHASE INDEX

**Phạm vi:** Màn hình 15–25 của module quản lý giờ đào tạo liên tục.

## Cách sử dụng

1. Đọc tài liệu này để hiểu domain model, dữ liệu thực tế, business rules, API và thứ tự triển khai.
2. Thực hiện lần lượt các file `phase_00` đến `phase_09`.
3. Không bỏ qua dependency và exit criteria của từng phase.
4. Sau mỗi phase phải cập nhật migration, OpenAPI, test và tài liệu quyết định.

## Danh sách phase

- [0. Chốt nghiệp vụ trước khi coding](phase_00_business_decisions.md)
- [1. Database, domain foundation và security scope](phase_01_database_domain_security.md)
- [2. Training Activity Type: màn 23, 24, 25](phase_02_training_activity_types_screens_23_25.md)
- [3. Tạo/sửa record và cập nhật evidence: màn 17, 18](phase_03_training_record_form_evidence_screens_17_18.md)
- [4. Danh sách và chi tiết record: màn 15, 16](phase_04_training_record_list_detail_screens_15_16.md)
- [5. Requirement và trạng thái cá nhân: màn 22, 19](phase_05_requirements_personal_status_screens_22_19.md)
- [6. Employee Training Hours: màn 20, 21](phase_06_employee_training_hours_screens_20_21.md)
- [7. Import và làm sạch dữ liệu Excel cũ](phase_07_legacy_excel_import_cleanup.md)
- [8. Cross-cutting: notification, audit, observability và performance](phase_08_notifications_audit_observability_performance.md)
- [9. Testing, UAT và rollout](phase_09_testing_uat_rollout.md)

---

# KẾ HOẠCH TRIỂN KHAI MODULE QUẢN LÝ GIỜ ĐÀO TẠO LIÊN TỤC

**Phạm vi màn hình:** 15–25  
**Hệ thống:** VietDuc-Care / CareHub  
**Stack giả định:** ReactJS + Java Spring Boot REST API + PostgreSQL + Object Storage  
**Mục đích:** Tài liệu bàn giao cho coding agent triển khai theo từng phase, chưa viết code.

---

## 1. Mục tiêu và phạm vi

Module này phải hỗ trợ đầy đủ các luồng:

1. Nhân viên tạo và cập nhật bản ghi đào tạo.
2. Nhân viên tải minh chứng đào tạo.
3. User xem dữ liệu của chính mình.
4. Manager xem dữ liệu nhân viên thuộc khoa được phân quyền.
5. Admin xem toàn viện và cấu hình dữ liệu nền.
6. Hệ thống chỉ cộng giờ từ record đã SUBMITTED.
7. Hệ thống tính trạng thái tuân thủ theo yêu cầu đào tạo đang có hiệu lực.
8. Hệ thống lưu được lịch sử chỉnh sửa và dữ liệu nhập từ nguồn cũ.
9. Giao diện phải hoạt động tốt trên desktop và mobile web.

### Các màn hình thuộc phạm vi

| ID | Màn hình |
|---:|---|
| 15 | Training Hours List Screen |
| 16 | Training Hours Detail Screen |
| 17 | Create/Edit Training Hours Screen |
| 18 | Update Training Evidence Screen |
| 19 | Training Status Screen |
| 20 | Employee Training Hours List Screen |
| 21 | Employee Training Hours Detail Screen |
| 22 | Training Requirement Configuration Screen |
| 23 | Training Activity Type List Screen |
| 24 | Create/Edit Training Activity Type Screen |
| 25 | Training Activity Type Detail Screen |

### Nguồn dùng để phân tích

- File dữ liệu thực tế: `CẬP NHẬP GIỜ ĐÀO TẠO LIÊN TỤC GÂY MÊ II NĂM 2024 (Câu trả lời).xlsx`
- SRS VietDuc-Care: FT-04, FT-05, FT-06.
- Danh sách mô tả màn hình 15–25.
- Database diagram hiện tại do nhóm cung cấp.

---

## 2. Kết quả phân tích file giờ đào tạo thực tế

File Excel có **948 dòng dữ liệu** và 9 cột:

| Cột nguồn | Ý nghĩa | Mapping đề xuất |
|---|---|---|
| Dấu thời gian | Thời điểm gửi Google Form | `source_submitted_at` hoặc metadata import |
| Mã VD | Mã nhân viên | Dùng để tìm `employee_id`; không lưu làm khóa ngoại trực tiếp |
| Họ và Tên | Tên người khai | Chỉ dùng kiểm tra đối chiếu khi import |
| Ngày tháng năm sinh | Thông tin nhận diện bổ sung | Chỉ dùng đối chiếu; không sao chép vào `training_records` |
| Chương trình đào tạo | Tên chương trình/khóa học | `training_records.title` |
| Thời gian đào tạo | Ngày diễn ra | `start_date`, mặc định `end_date = start_date` |
| Số tiết đào tạo | Thời lượng người dùng khai | Phải lưu raw và chuẩn hóa; không được ép trực tiếp thành số giờ |
| Giấy chứng nhận | Link Google Drive | `legacy_external_url` hoặc tải về Object Storage |
| Chức danh | Điều dưỡng/Bác sĩ | Dùng đối chiếu employee/job position khi import |

### 2.1 Các vấn đề dữ liệu đã phát hiện

1. **277/948 dòng thiếu họ tên**, nhưng vẫn có mã nhân viên.
2. **769/948 dòng không có giấy chứng nhận**.
3. Trường “Số tiết đào tạo” không thống nhất:
   - Số thuần: `2`, `4`, `16`, `143`, `330`.
   - Giờ: `2h`, `1h30`, `1,5 giờ`.
   - Tiết: `2 tiết`, `04 tiết`, `3,25 tiết`.
   - Tín chỉ: `3 giờ tín chỉ`, `18 tín chỉ`.
   - Khoảng thời gian khác: `1 tháng`, `2 năm`, `toàn thời gian`.
   - Dữ liệu sai: `O3`, `Sinh hoạt khoa học`.
4. Có ít nhất **10 giá trị ngày sinh bất thường** và **13 ngày đào tạo bất thường**.
5. Có các mã nhân viên:
   - Thiếu tiền tố `VD`.
   - Có khoảng trắng.
   - Nhập nhầm tên người vào cột mã.
   - Sai ký tự như `VDO1506`.
6. Có ít nhất **7 cặp dòng nghi ngờ trùng hoàn toàn** theo mã nhân viên, chương trình, ngày và thời lượng.
7. Tên nhân viên cùng một mã có khác biệt viết hoa, dấu, khoảng trắng.
8. Có link chứng nhận Google Drive cũ; đây không phải đường dẫn Object Storage an toàn.
9. Cột “Chương trình đào tạo” là **tên chương trình**, không phải “Loại hoạt động đào tạo”.
10. Dữ liệu cũ có chương trình dài ngày với số giờ lớn, trong khi SRS quy định bản ghi tạo trực tiếp có giới hạn 0,5–24 giờ.

### 2.2 Hệ quả đối với thiết kế

- Không import thẳng Excel vào bảng nghiệp vụ chính.
- Cần staging/import layer để giữ dữ liệu raw và lỗi từng dòng.
- Không sử dụng họ tên, ngày sinh, chức danh trong file làm dữ liệu nhân sự chính.
- Chỉ map nhân viên bằng mã nhân viên sau khi chuẩn hóa và đối chiếu bảng `employees`.
- Cần tách:
  - Giá trị thời lượng khai báo.
  - Đơn vị thời lượng.
  - Số giờ chuẩn hóa.
  - Số giờ đã khai báo (tính vào compliance).
- Dữ liệu dài ngày hoặc tín chỉ phải qua quy tắc chuyển đổi được bệnh viện xác nhận.
- Link Google Drive cũ phải được đánh dấu là minh chứng legacy; không giả định đó là file nội bộ.
- Cần cơ chế phát hiện trùng trước khi tạo record.

---

## 3. Đánh giá database diagram hiện tại

Database hiện tại là một khung ban đầu hợp lý, nhưng **chưa đủ để triển khai đúng nghiệp vụ**.

### 3.1 Các điểm đang đúng

- Đã tách `training_activity_types`.
- Đã tách `training_requirements`.
- Đã tách `training_records`.
- Đã tách file minh chứng khỏi record chính.
- Đã có quan hệ tới employee, user, professional field và department.
- Đã có `effective_from`, `effective_to` cho yêu cầu đào tạo.

### 3.2 Các thay đổi bắt buộc

| Vấn đề | Hiện tại | Thay đổi cần làm |
|---|---|---|
| Trạng thái record | `COUNTED` | Thay bằng workflow: `DRAFT`, `SUBMITTED`, `CANCELLED` |
| Giờ được cộng | `hours` duy nhất | Dùng `declared_hours` để tính compliance |
| Đơn vị thời lượng | Không có | Thêm `duration_value`, `duration_unit`, `duration_raw_text` |
| Khoảng ngày | Chỉ có `training_date` | Dùng `start_date`, `end_date`; thời gian bắt đầu/kết thúc là optional |
| Review | Đặt `review_status` ở file | **Đã bỏ review workflow** — User tự quản lý, không cần duyệt |
| AI moderation | Chưa tách | File có `moderation_status`, validate định dạng nhưng không block submit |
| Yêu cầu theo vai trò | Chỉ có department | Thêm `job_position_id` hoặc FK tương đương |
| Lịch sử sửa | Chưa có | Thêm `edit_count`, `version`, change log/audit |
| Dữ liệu legacy | Chưa có | Thêm source/import metadata hoặc staging tables |
| Link minh chứng cũ | Chỉ có `storage_path` | Tách `object_key` và `legacy_external_url` |
| Soft delete | Chưa có | Dùng `is_active`, `deleted_at`; không hard delete dữ liệu đã tham chiếu |
| Audit | Thiếu created/updated user ở nhiều bảng | Bổ sung trường audit đầy đủ |

### 3.3 Workflow đơn giản hóa — không còn review

Theo quyết định nghiệp vụ mới, **Admin và Manager không còn duyệt hồ sơ đào tạo**. User tự quản lý và chịu trách nhiệm với số giờ + minh chứng của mình.

- `training_records.workflow_status`: `DRAFT` → `SUBMITTED` → (optional) `CANCELLED`.
- `training_evidence_files.moderation_status`: kiểm tra định dạng file (JPG/PNG/PDF, size, magic bytes) — cảnh báo nhưng không block submit.
- Không còn bảng `training_record_reviews` và `ReviewDecision` enum.

---

## 4. Domain model đề xuất

> Tên FK `job_position_id`, `professional_title_id` hoặc `role_id` phải đổi theo schema nhân sự thực tế của dự án.

### 4.1 Enums

```text
TrainingRecordStatus:
- DRAFT
- SUBMITTED
- CANCELLED

DurationUnit:
- HOUR
- LESSON
- CREDIT
- DAY
- MONTH
- YEAR
- OTHER

EvidenceModerationStatus:
- NOT_REQUESTED
- PENDING
- PASSED
- FAILED
- ERROR

TrainingSourceType:
- MANUAL
- LEGACY_IMPORT
- ADMIN_IMPORT

ComplianceStatus:
- NOT_CONFIGURED
- COMPLIANT
- AT_RISK
- NON_COMPLIANT
```

> **Ghi chú**: `ReviewDecision` enum và các trạng thái `PENDING_REVIEW`, `APPROVED`, `REJECTED` đã bị loại bỏ theo quyết định bỏ review workflow. User tự quản lý và chịu trách nhiệm với giờ đào tạo + minh chứng của mình. Admin/Manager không còn duyệt hồ sơ.

### 4.2 DBML đề xuất

```dbml
Table training_activity_types {
  id bigint [primary key, increment]
  code varchar(50) [not null, unique]
  name varchar(255) [not null]
  description text
  default_duration_unit varchar(20) [not null, default: 'HOUR']
  requires_evidence boolean [not null, default: true]
  max_credited_hours_per_record numeric(8,2)
  sort_order int [not null, default: 0]
  is_active boolean [not null, default: true]

  created_by_user_id bigint
  created_at timestamptz [not null, default: `CURRENT_TIMESTAMP`]
  updated_by_user_id bigint
  updated_at timestamptz
  version bigint [not null, default: 0]
}

Table training_requirements {
  id bigint [primary key, increment]
  code varchar(50) [not null, unique]
  name varchar(255) [not null]

  required_hours numeric(8,2) [not null, default: 120]
  cycle_years int [not null, default: 5]

  job_position_id bigint
  department_id bigint
  professional_field_id bigint

  warning_threshold_hours numeric(8,2)
  effective_from date [not null]
  effective_to date
  is_active boolean [not null, default: true]

  created_by_user_id bigint
  created_at timestamptz [not null, default: `CURRENT_TIMESTAMP`]
  updated_by_user_id bigint
  updated_at timestamptz
  version bigint [not null, default: 0]
}

Table training_records {
  id bigint [primary key, increment]

  employee_id bigint [not null]
  employee_department_id_snapshot bigint

  activity_type_id bigint [not null]
  professional_field_id bigint

  title varchar(500) [not null]
  provider varchar(255)
  description text

  start_date date [not null]
  end_date date
  start_time time
  end_time time

  duration_value numeric(10,2)
  duration_unit varchar(20) [not null, default: 'HOUR']
  duration_raw_text varchar(100)

  declared_hours numeric(8,2)

  workflow_status varchar(30) [not null, default: 'DRAFT']
  edit_count int [not null, default: 0]
  submitted_at timestamptz

  source_type varchar(30) [not null, default: 'MANUAL']
  source_reference varchar(255)
  source_submitted_at timestamptz
  import_batch_id bigint

  created_by_user_id bigint [not null]
  created_at timestamptz [not null, default: `CURRENT_TIMESTAMP`]
  updated_by_user_id bigint
  updated_at timestamptz
  version bigint [not null, default: 0]
}

Table training_evidence_files {
  id bigint [primary key, increment]
  training_record_id bigint [not null]

  original_filename varchar(500) [not null]
  object_key text
  legacy_external_url text

  mime_type varchar(100)
  file_size_bytes bigint
  checksum_sha256 varchar(64)

  moderation_status varchar(30) [not null, default: 'NOT_REQUESTED']
  moderation_provider varchar(100)
  moderation_result jsonb
  moderation_checked_at timestamptz

  uploaded_by_user_id bigint [not null]
  uploaded_at timestamptz [not null, default: `CURRENT_TIMESTAMP`]

  is_active boolean [not null, default: true]
  deleted_at timestamptz
}

Table training_record_change_logs {
  id bigint [primary key, increment]
  training_record_id bigint [not null]
  version_no bigint [not null]
  change_type varchar(30) [not null]
  before_data jsonb
  after_data jsonb
  changed_by_user_id bigint [not null]
  changed_at timestamptz [not null, default: `CURRENT_TIMESTAMP`]
}

Table training_import_batches {
  id bigint [primary key, increment]
  original_filename varchar(500) [not null]
  status varchar(30) [not null]
  total_rows int [not null, default: 0]
  success_rows int [not null, default: 0]
  failed_rows int [not null, default: 0]
  warning_rows int [not null, default: 0]
  imported_by_user_id bigint [not null]
  imported_at timestamptz [not null, default: `CURRENT_TIMESTAMP`]
}

Table training_import_rows {
  id bigint [primary key, increment]
  import_batch_id bigint [not null]
  source_row_number int [not null]
  raw_data jsonb [not null]
  normalized_data jsonb
  validation_status varchar(30) [not null]
  validation_messages jsonb
  training_record_id bigint
}

Ref: training_requirements.department_id > departments.id
Ref: training_requirements.job_position_id > job_positions.id
Ref: training_requirements.professional_field_id > professional_fields.id

Ref: training_records.employee_id > employees.id
Ref: training_records.employee_department_id_snapshot > departments.id
Ref: training_records.activity_type_id > training_activity_types.id
Ref: training_records.professional_field_id > professional_fields.id
Ref: training_records.created_by_user_id > users.id
Ref: training_records.updated_by_user_id > users.id

Ref: training_evidence_files.training_record_id > training_records.id
Ref: training_evidence_files.uploaded_by_user_id > users.id

Ref: training_record_change_logs.training_record_id > training_records.id
Ref: training_record_change_logs.changed_by_user_id > users.id

Ref: training_import_rows.import_batch_id > training_import_batches.id
Ref: training_import_rows.training_record_id > training_records.id
```

### 4.3 Các constraint quan trọng

1. `required_hours >= 0 AND required_hours <= 500`.
2. `cycle_years > 0`.
3. `effective_to IS NULL OR effective_to >= effective_from`.
4. `end_date IS NULL OR end_date >= start_date`.
5. Nếu có đủ start/end time trong cùng ngày, `end_time >= start_time`.
6. `declared_hours IS NULL OR declared_hours > 0`.
7. Chỉ record `SUBMITTED` mới được cộng vào compliance.
8. Không hard delete `training_activity_types` đã được tham chiếu.
9. Không cho tồn tại hai yêu cầu active bị chồng lấn cùng scope và cùng giai đoạn hiệu lực.
10. File upload:
    - Kích thước lớn hơn 0 và không quá 5 MB.
    - Chỉ JPG, PNG, PDF.
    - Kiểm tra cả extension, MIME type và magic bytes.
11. Mỗi lần cập nhật sau khi submit phải tăng `edit_count`.
12. Dùng optimistic locking bằng `version` để tránh ghi đè dữ liệu đồng thời.
13. Evidence là optional — user tự quản lý và chịu trách nhiệm với minh chứng. Moderation vẫn chạy để kiểm tra định dạng file nhưng không block submit.

### 4.4 Index đề xuất

```text
training_records(employee_id, start_date desc)
training_records(workflow_status, submitted_at)
training_records(activity_type_id, start_date)
training_records(professional_field_id, start_date)
training_records(employee_department_id_snapshot, start_date)
training_evidence_files(training_record_id, is_active)
training_evidence_files(moderation_status)
training_requirements(job_position_id, department_id, effective_from, effective_to)
training_activity_types(is_active, sort_order, name)
```

---

## 5. Business rules và state machine

### 5.1 State machine

```text
DRAFT
  ├─ submit ──> SUBMITTED
  └─ cancel ──> CANCELLED

SUBMITTED
  ├─ chỉnh sửa (trong giới hạn edit_count) → giữ SUBMITTED, tăng edit_count
  └─ cancel (Admin only) → CANCELLED

CANCELLED (terminal)
```

> **Thay đổi quan trọng**: Bỏ review workflow. User tự submit record → `SUBMITTED`. Không còn `PENDING_REVIEW`, `APPROVED`, `REJECTED`. Admin/Manager không duyệt hồ sơ. User tự chịu trách nhiệm với giờ đào tạo và minh chứng.

### 5.2 Business rules bắt buộc

1. User chỉ xem/sửa record của chính mình.
2. Manager chỉ xem nhân viên trong khoa được phân quyền.
3. Admin xem toàn bộ.
4. Khi Manager/Admin tạo record thay người khác, server phải xác minh phạm vi quyền.
5. Chỉ giờ `SUBMITTED` được cộng vào tổng compliance.
6. **Bỏ review workflow**: Admin và Manager không duyệt hồ sơ đào tạo. User tự quản lý và chịu trách nhiệm với số giờ + minh chứng của mình.
7. Evidence là optional — moderation vẫn validate định dạng file nhưng không block submit.
8. SRS giới hạn tối đa 2 lần edit; tính từ sau lần submit đầu tiên (configurable qua `app.training.records.max-edit-count`).
9. Màn tạo trực tiếp áp dụng giới hạn 0,5–24 giờ/record theo SRS.
10. Dữ liệu legacy lớn hơn 24 giờ không tự động bị xóa:
    - Đưa vào trạng thái cần rà soát.
    - Hoặc tách thành nhiều record.
    - Hoặc áp dụng rule riêng do bệnh viện xác nhận.
11. Chu kỳ 5 năm:
    - `window_end = ngày hiện tại`.
    - `window_start = window_end - cycle_years`.
    - Cần thống nhất có tính cả hai ngày biên hay không; đề xuất inclusive.
12. Nếu không có requirement phù hợp: `NOT_CONFIGURED`, không được coi là đạt.
13. Nếu nhiều requirement cùng khớp, đề xuất ưu tiên:
    1. Department + Job Position + Professional Field.
    2. Department + Job Position.
    3. Job Position + Professional Field.
    4. Job Position toàn viện.
    5. Requirement global.
14. Trạng thái `AT_RISK` chỉ bật khi có định nghĩa threshold. Nếu chưa thống nhất, MVP dùng:
    - `COMPLIANT`
    - `NON_COMPLIANT`
    - `NOT_CONFIGURED`
15. Pre-signed URL chỉ tạo khi đọc file; không lưu pre-signed URL vào database.
16. Mọi thao tác tạo, sửa, submit, upload, xóa file phải có audit log.
17. Workflow có thể cấu hình qua `app.training.records.review-enabled` (default: `false` — self-managed). Khi `true`, dùng legacy review workflow.

---

## 6. API và phân quyền nền tảng

### 6.1 Quy ước API

- Prefix: `/api/v1/training`
- Response list dùng pagination.
- Error response thống nhất:
  - `code`
  - `message`
  - `fieldErrors`
  - `traceId`
- Không trả raw entity trực tiếp.
- Dùng DTO riêng cho list, detail, create/update và compliance.
- Mọi API phải kiểm tra scope phía server; không tin `employeeId` do client gửi.
- Dùng `version` trong update request để xử lý optimistic locking.

### 6.2 Endpoint dự kiến

```text
Activity Types
GET    /api/v1/training/activity-types
POST   /api/v1/training/activity-types
GET    /api/v1/training/activity-types/{id}
PUT    /api/v1/training/activity-types/{id}
PATCH  /api/v1/training/activity-types/{id}/status

Training Records
GET    /api/v1/training/records
POST   /api/v1/training/records
GET    /api/v1/training/records/{id}
PUT    /api/v1/training/records/{id}
POST   /api/v1/training/records/{id}/submit

Evidence
GET    /api/v1/training/records/{id}/evidences
POST   /api/v1/training/records/{id}/evidences
DELETE /api/v1/training/records/{id}/evidences/{evidenceId}
POST   /api/v1/training/records/{id}/evidences/{evidenceId}/download-url

Requirements
GET    /api/v1/training/requirements
POST   /api/v1/training/requirements
GET    /api/v1/training/requirements/{id}
PUT    /api/v1/training/requirements/{id}
PATCH  /api/v1/training/requirements/{id}/status

Compliance
GET    /api/v1/training/status/me
GET    /api/v1/training/employees/status
GET    /api/v1/training/employees/{employeeId}/status
GET    /api/v1/training/employees/{employeeId}/records
```

---

# 7. Kế hoạch triển khai phase by phase

---

---

# 8. Thứ tự implementation đề xuất cho coding agent

| Thứ tự | Phần | Screens | Phụ thuộc |
|---:|---|---|---|
| 1 | Domain decisions | — | BA/Stakeholder |
| 2 | Database + security scope | — | Phase 0 |
| 3 | Activity type | 23, 24, 25 | Phase 1 |
| 4 | Create/edit record | 17 | Activity type |
| 5 | Evidence | 18 | Record draft + storage |
| 6 | Record list/detail | 15, 16 | Record + evidence |
| 7 | Requirement | 22 | Employee/job reference |
| 8 | Personal status | 19 | Requirement + approved record |
| 9 | Employee list/detail | 20, 21 | Compliance service |
| 10 | Legacy import | — | Stable domain model |
| 11 | Cross-cutting + UAT | All | Các phase trên |

---

# 9. Definition of Done cho mỗi màn hình

Một màn chỉ được coi là hoàn thành khi:

- [ ] Route và navigation đã có.
- [ ] UI responsive desktop/mobile.
- [ ] Loading, empty, error, forbidden, not-found states.
- [ ] API request/response được document.
- [ ] Validation client và server thống nhất.
- [ ] Server-side RBAC/scope hoàn chỉnh.
- [ ] Audit event được ghi.
- [ ] Unit tests pass.
- [ ] Integration tests quan trọng pass.
- [ ] Không có N+1 query.
- [ ] Không lộ internal storage path.
- [ ] Acceptance criteria của màn pass.
- [ ] Có test cho boundary và negative path.
- [ ] OpenAPI/Swagger được cập nhật.
- [ ] Code review hoàn thành.
- [ ] Migration có rollback hoặc kế hoạch rollback.
- [ ] Không có hardcoded role, department hoặc requirement.
- [ ] Không làm thay đổi dữ liệu lịch sử ngoài ý muốn.

---

# 10. Các điểm coding agent không được tự giả định

1. Không tự quy đổi “tiết”, “tín chỉ”, “tháng”, “năm” nếu chưa có rule chính thức.
2. Không tự coi record không evidence là hợp lệ cho mọi loại hoạt động.
3. Không tự dùng role hệ thống User/Manager/Admin thay cho chức danh nghề nghiệp.
4. Không tự coi pending hours là approved.
5. Không hard delete activity type, requirement, record hoặc evidence đã sử dụng.
6. Không lưu pre-signed URL trong database.
7. Không lưu họ tên/ngày sinh từ Excel vào record như dữ liệu nhân sự chính.
8. Không cho client tự set `workflow_status`; server kiểm soát state transition.
9. Không cho User truyền `employeeId` để tạo record cho người khác.
10. Không import thẳng dòng lỗi vào bảng nghiệp vụ.
11. Không sửa dữ liệu lịch sử khi requirement mới có hiệu lực.
12. Không triển khai `AT_RISK` nếu chưa chốt công thức.

---

# 11. Kết luận thiết kế

Database diagram ban đầu có thể tiếp tục sử dụng làm nền, nhưng cần sửa trước khi coding các màn:

- Đổi trạng thái `COUNTED` sang workflow status.
- Tách declared hours và approved hours.
- Thêm duration unit/raw duration.
- Tách moderation file khỏi review nghiệp vụ.
- Thêm review history và change log.
- Thêm job position vào requirement.
- Thêm import metadata/staging cho dữ liệu Excel cũ.
- Thêm date range, audit, version và index.
- Xây compliance dưới dạng derived service/view, không cập nhật thủ công bằng UI.

Triển khai đúng thứ tự dependency sẽ giảm việc sửa lại API và database khi đi đến màn 19–22.
