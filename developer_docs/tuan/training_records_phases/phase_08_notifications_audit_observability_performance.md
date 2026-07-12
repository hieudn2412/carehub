# PHASE 8 — Cross-cutting: notification, audit, observability và performance

**Module:** Training Records Management  
**Phạm vi tổng:** Màn hình 15–25  
**Dependency:** Áp dụng xuyên suốt sau khi các workflow cốt lõi đã tồn tại.  
**Tài liệu nền bắt buộc:** [00_README_AND_SHARED_RULES.md](00_README_AND_SHARED_RULES.md)

> Coding agent chỉ triển khai nội dung của phase này. Những quyết định nghiệp vụ chưa được chốt phải được ghi thành open issue/ADR, không được tự giả định.

---

### Notification hooks

- Khi compliance thiếu giờ → module notification xử lý.
- Suppress duplicate alert theo business rule.

> **Đã bỏ**: Notification submit-to-review-queue, approve, reject — không còn review workflow.

### Audit events

```text
TRAINING_RECORD_CREATED
TRAINING_RECORD_UPDATED
TRAINING_RECORD_SUBMITTED
TRAINING_RECORD_CANCELLED
TRAINING_EVIDENCE_UPLOADED
TRAINING_EVIDENCE_REMOVED
TRAINING_REQUIREMENT_CREATED
TRAINING_REQUIREMENT_UPDATED
TRAINING_ACTIVITY_TYPE_CREATED
TRAINING_ACTIVITY_TYPE_UPDATED
TRAINING_ACTIVITY_TYPE_DEACTIVATED
```

> **Đã bỏ**: `TRAINING_RECORD_APPROVED`, `TRAINING_RECORD_REJECTED`, `TRAINING_EVIDENCE_MODERATION_FAILED` — không còn review workflow.

### Logging

- Không log file binary.
- Không log pre-signed URL.
- Không log PII đầy đủ.
- Gắn `traceId`, actorId, recordId.
- Log lỗi storage/moderation nhưng không lộ secret.

### Performance

- List API <= 2 giây trong tải bình thường.
- Dùng pagination bắt buộc.
- Dùng aggregate query cho màn 20.
- Không tải evidence binary trong list/detail.
- Cache dropdown activity type/reference data ngắn hạn.
- Pre-signed URL tạo on demand.

---
