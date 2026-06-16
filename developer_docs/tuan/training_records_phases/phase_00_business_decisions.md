# PHASE 0 — Chốt nghiệp vụ trước khi coding

**Module:** Training Records Management  
**Phạm vi tổng:** Màn hình 15–25  
**Dependency:** Không có. Đây là phase chốt nghiệp vụ.  
**Tài liệu nền bắt buộc:** [00_README_AND_SHARED_RULES.md](00_README_AND_SHARED_RULES.md)

> Coding agent chỉ triển khai nội dung của phase này. Những quyết định nghiệp vụ chưa được chốt phải được ghi thành open issue/ADR, không được tự giả định.

---

### Mục tiêu

Loại bỏ các điểm mơ hồ có thể làm phải sửa database hoặc API về sau.

### Các quyết định bắt buộc phải được xác nhận

- [ ] Một “tiết” tương đương bao nhiêu giờ?
- [ ] “Tín chỉ” có được quy đổi sang giờ hay chỉ lưu minh chứng?
- [ ] Khóa dài ngày, tháng, năm được nhập một record hay tách record?
- [ ] Manager có được sửa số giờ phê duyệt khác số giờ khai báo không?
- [ ] Evidence có bắt buộc cho mọi activity type không?
- [ ] Hai lần edit được tính như thế nào?
- [ ] Record đã approved có được mở lại không?
- [ ] `AT_RISK` được tính theo thiếu bao nhiêu giờ hay theo thời gian còn lại?
- [ ] Requirement áp dụng theo chức danh, vị trí việc làm hay role hệ thống?
- [ ] Khi nhân viên chuyển khoa, lịch sử đào tạo được tính cho khoa cũ hay khoa mới?
- [ ] PDF được moderation theo cách nào?
- [ ] Có cần tải toàn bộ file Google Drive cũ về Object Storage không?

### Deliverables

- `ADR-Training-Domain.md`
- Danh sách enum chính thức.
- Quy tắc quy đổi thời lượng.
- Ma trận quyền User/Manager/Admin.
- State machine được BA xác nhận.
- Quy tắc chọn requirement khi nhiều rule cùng khớp.

### Điều kiện hoàn thành

Không bắt đầu migration production trước khi các quyết định về đơn vị thời lượng, requirement scope và review workflow được chốt.

---
