# PHASE 1 — Database, domain foundation và security scope

**Module:** Training Records Management  
**Phạm vi tổng:** Màn hình 15–25  
**Dependency:** Phụ thuộc Phase 0.  
**Tài liệu nền bắt buộc:** [00_README_AND_SHARED_RULES.md](00_README_AND_SHARED_RULES.md)

> Coding agent chỉ triển khai nội dung của phase này. Những quyết định nghiệp vụ chưa được chốt phải được ghi thành open issue/ADR, không được tự giả định.

---

### Mục tiêu

Tạo nền tảng dùng chung cho tất cả màn 15–25.

### Backend tasks

- [ ] Tạo migration cho các bảng đề xuất.
- [ ] Tạo enum và converter.
- [ ] Tạo entity/model.
- [ ] Tạo repository.
- [ ] Tạo DTO:
  - Activity type list/detail/form.
  - Training record list/detail/form.
  - Evidence metadata.
  - Requirement list/detail/form.
  - Personal status.
  - Employee compliance summary.
- [ ] Tạo mapper entity ↔ DTO.
- [ ] Tạo `TrainingAccessPolicy` dùng chung.
- [ ] Tạo `TrainingRecordStateMachine`.
- [ ] Tạo `TrainingComplianceCalculator`.
- [ ] Tạo `EvidenceStorageService` interface.
- [ ] Tạo `EvidenceModerationService` interface và mock adapter cho local.
- [ ] Tạo audit service.
- [ ] Tạo global validation/error handling.
- [ ] Tạo pagination/sorting chuẩn.

### Security scope

| Actor | Phạm vi |
|---|---|
| User | Chỉ record và status của chính mình |
| Manager | Nhân viên trong khoa được phân quyền |
| Admin | Toàn bộ dữ liệu |
| System job | Chỉ các service account được chỉ định |

### Unit tests nền tảng

- [ ] User không đọc được record người khác.
- [ ] Manager không đọc được nhân viên ngoài khoa.
- [ ] Admin đọc được toàn viện.
- [ ] State transition không hợp lệ bị chặn.
- [ ] Chỉ `APPROVED` được tính giờ.
- [ ] Requirement không tồn tại trả `NOT_CONFIGURED`.
- [ ] Optimistic locking trả conflict.

### Điều kiện hoàn thành

- Migration chạy được trên database sạch.
- Rollback migration được kiểm tra.
- Repository integration tests pass.
- Access policy tests pass.

---
