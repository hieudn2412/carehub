# PHASE 3 — Tạo/sửa record và cập nhật evidence: màn 17, 18

**Module:** Training Records Management  
**Phạm vi tổng:** Màn hình 15–25  
**Dependency:** Phụ thuộc Phase 1 và Phase 2.  
**Tài liệu nền bắt buộc:** [00_README_AND_SHARED_RULES.md](00_README_AND_SHARED_RULES.md)

> Coding agent chỉ triển khai nội dung của phase này. Những quyết định nghiệp vụ chưa được chốt phải được ghi thành open issue/ADR, không được tự giả định.

---

---

### SCREEN 17 — Create/Edit Training Hours Screen

#### Routes

```text
/training/records/new
/training/records/{id}/edit
```

#### Quyền

- User: tạo cho chính mình.
- Manager: tạo cho nhân viên thuộc khoa nếu nghiệp vụ cho phép.
- Admin: tạo cho bất kỳ nhân viên nào.
- Server không được lấy `employeeId` của User từ client; phải lấy từ token/session.

#### Form sections

##### A. Người tham gia

- Employee selector chỉ hiện với Manager/Admin.
- Employee code.
- Full name.
- Department.
- Job position.
- Các field profile chỉ đọc.

##### B. Thông tin chương trình

- Activity type.
- Title/program name.
- Provider.
- Professional field.
- Description.

##### C. Thời gian

- Start date.
- End date.
- Start time optional.
- End time optional.
- Duration value.
- Duration unit.
- Declared hours chuẩn hóa.

##### D. Evidence summary

- Số file đã có.
- Trạng thái moderation.
- Link sang màn 18.

##### E. Workflow actions

- Save Draft.
- Save Changes.
- Submit.
- Cancel.

#### Validation

- Activity type active.
- Title required.
- Start date required.
- End date >= start date.
- Nếu cùng ngày và có time: end time >= start time.
- Manual entry declared hours:
  - Min 0,5.
  - Max 24 theo SRS.
- Evidence là optional — user tự quản lý và chịu trách nhiệm. Moderation vẫn validate định dạng file nhưng không block submit.
- Không cho User sửa record `SUBMITTED` (chỉ Admin mở lại nếu cần).
- Không cho vượt edit limit.
- Kiểm tra duplicate candidate:
  - Cùng employee.
  - Cùng normalized title.
  - Cùng start date.
  - Cùng declared hours.
- Duplicate không nhất thiết block tuyệt đối; hiển thị warning và yêu cầu xác nhận hoặc quyền Admin.

#### API

```text
POST /api/v1/training/records
PUT  /api/v1/training/records/{id}
POST /api/v1/training/records/{id}/submit
```

#### Create request cần hỗ trợ

```text
employeeId              // Manager/Admin only
activityTypeId
professionalFieldId
title
provider
description
startDate
endDate
startTime
endTime
durationValue
durationUnit
declaredHours
version
```

#### Backend workflow

1. Resolve actor và target employee.
2. Check scope.
3. Validate activity type.
4. Validate date/duration.
5. Check duplicate candidate.
6. Persist draft.
7. Write audit.
8. Khi submit:
   - Set `SUBMITTED`.
   - Set `submitted_at`.
   - Write audit event `SUBMITTED`.

#### Acceptance criteria

- User tạo được draft của chính mình.
- Manager không tạo cho khoa khác.
- Submit hợp lệ tạo `SUBMITTED`.
- Missing mandatory field không gọi moderation.
- Lần edit vượt giới hạn trả 409.
- SUBMITTED record không bị User chỉnh sửa (chỉ Admin).

#### Tests

- Create draft.
- Create and submit.
- Missing evidence.
- Invalid date range.
- Invalid hours boundary: 0; 0,5; 24; >24.
- Permission matrix.
- Duplicate warning.
- Edit count.
- Optimistic locking.

---

### SCREEN 18 — Update Training Evidence Screen

#### Route

```text
/training/records/{id}/evidence
```

#### UI components

- Record summary.
- Drag/drop upload.
- Camera capture trên mobile web.
- File picker.
- File preview.
- Upload progress.
- Danh sách file hiện có.
- Moderation badge.
- Remove/replace action.
- Legacy external evidence section.
- Retry moderation khi lỗi kỹ thuật.

#### File rules

- JPG, PNG, PDF.
- > 0 KB và <= 5 MB.
- Validate extension, MIME, magic bytes.
- Tên file được sanitize.
- Generate checksum để phát hiện upload trùng.
- Object key do server sinh; không dùng filename làm object key.
- Pre-signed upload/download URL có TTL ngắn.
- Không public bucket.

#### Moderation flow

1. Validate client-side.
2. Validate lại server-side.
3. Upload file.
4. Gọi `EvidenceModerationService` để kiểm tra định dạng, MIME, magic bytes, size.
5. Kết quả moderation hiển thị cho user nhưng **không block submit**.
6. Nếu ERROR: có retry policy, không tự coi là passed.

> **Thay đổi**: Moderation chỉ để cảnh báo, không block submit hay upload. User tự chịu trách nhiệm với chất lượng minh chứng.
>
> Với PDF, cần ADR riêng: bỏ qua moderation, scan malware, hoặc render trang đầu để kiểm tra.

#### API

```text
GET    /api/v1/training/records/{id}/evidences
POST   /api/v1/training/records/{id}/evidences
DELETE /api/v1/training/records/{id}/evidences/{evidenceId}
POST   /api/v1/training/records/{id}/evidences/{evidenceId}/download-url
```

#### Permission

- User chỉ thao tác evidence của record mình và record còn editable (DRAFT).
- Manager/Admin theo scope.
- SUBMITTED record không được thay file (chỉ Admin mở lại nếu cần).

#### Acceptance criteria

- File 5120 KB pass; 5121 KB reject.
- Unsupported type reject trước moderation.
- Moderation failed không để orphan file.
- Delete là soft delete.
- Download URL không được lưu database.
- Mobile có thể chụp/upload ảnh.

#### Tests

- File boundary.
- Fake extension/MIME mismatch.
- Duplicate checksum.
- Storage error.
- Moderation pass/fail/error.
- Unauthorized access.
- Orphan cleanup.

---
