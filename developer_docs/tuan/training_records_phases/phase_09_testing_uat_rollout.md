# PHASE 9 — Testing, UAT và rollout

**Module:** Training Records Management  
**Phạm vi tổng:** Màn hình 15–25  
**Dependency:** Phụ thuộc tất cả phase chức năng trước đó.  
**Tài liệu nền bắt buộc:** [00_README_AND_SHARED_RULES.md](00_README_AND_SHARED_RULES.md)

> Coding agent chỉ triển khai nội dung của phase này. Những quyết định nghiệp vụ chưa được chốt phải được ghi thành open issue/ADR, không được tự giả định.

---

### 9.1 Unit tests

- Domain validation.
- State machine (DRAFT → SUBMITTED → CANCELLED).
- Access policy.
- Compliance calculator (SUBMITTED hours only).
- Requirement resolver.
- Duration parser.
- Duplicate detector.
- **New**: Submit record → status = SUBMITTED.
- **New**: SUBMITTED hours counted in compliance.
- **New**: Evidence upload không block submit.
- **New**: Approve/reject endpoints không tồn tại (trả 404).
- Edit limit.
- File validation.
- Review logic.

### 9.2 Integration tests

- PostgreSQL repository.
- Object storage adapter.
- Moderation mock/adapter.
- Transaction rollback khi moderation fail.
- API RBAC.
- Upload multipart.
- Requirement overlap.
- Aggregate employee status.

### 9.3 End-to-end tests

1. User tạo draft.
2. User upload evidence.
3. User submit.
4. Manager review.
5. Record approved.
6. Training status tăng giờ.
7. User xem detail.
8. Manager xem employee list/detail.
9. Admin tạo requirement.
10. Admin tạo/deactivate activity type.
11. User bị reject, chỉnh sửa, resubmit.
12. User vượt edit limit.
13. Legacy record hiển thị source warning.

### 9.4 Security tests

- IDOR trên record/evidence/employee detail.
- Upload malicious file.
- Path traversal filename.
- MIME spoofing.
- Oversized request.
- Expired pre-signed URL.
- Unauthorized department scope.
- Mass assignment `employeeId`, `approvedHours`, `workflowStatus`.

### 9.5 UAT checklist theo màn

| Screen | UAT tối thiểu |
|---:|---|
| 15 | Filter, pagination, scope, actions theo status |
| 16 | Full detail, evidence, review history, source metadata |
| 17 | Draft, edit, submit, validation, duplicate warning |
| 18 | Mobile upload, preview, moderation, delete/replace |
| 19 | 5-year total, warning, exact boundary |
| 20 | Department list, aggregate, filters |
| 21 | Employee ledger, totals consistency |
| 22 | Requirement scope, overlap, effective period |
| 23 | Activity type list/filter/deactivate |
| 24 | Create/edit/duplicate validation |
| 25 | Detail/usage/audit |

### 9.6 Rollout order

1. Deploy database migration.
2. Seed activity types.
3. Deploy Activity Type screens.
4. Deploy Training Record draft/list/detail.
5. Deploy evidence upload.
6. Deploy submit/review integration.
7. Deploy requirement configuration.
8. Deploy status calculation.
9. Deploy employee list/detail.
10. Chạy legacy import dry-run.
11. UAT với khoa Gây mê II.
12. Fix data mapping.
13. Chạy production import.
14. Theo dõi log và số liệu 1–2 tuần.

---
