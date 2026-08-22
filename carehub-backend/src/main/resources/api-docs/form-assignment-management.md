# Form assignment management

Màn `Giao bảng kiểm` dùng nhóm API quản lý quyền theo cặp `formIds` x `assigneeIds`.

## Read APIs

- `GET /form-assignments/overview`: tổng số bảng kiểm đang giao, người nhận active, cặp quyền active và quyền hết hạn trong 7 ngày.
- `GET /form-assignments/forms`: danh sách bảng kiểm có ít nhất một quyền active. Hỗ trợ `keyword`, `ownerDepartmentId`, `expiringSoon`, `page`, `size`.
- `GET /form-assignments/assignees`: danh sách người active có ít nhất một quyền active. Hỗ trợ `keyword`, `departmentId`, `roleCode`, `expiringSoon`, `page`, `size`.
- `GET /form-assignments/items?formId=...` hoặc `GET /form-assignments/items?assigneeId=...`: danh sách quyền active để hiển thị drawer.
- `GET /form-assignments/form-candidates`: bảng kiểm đang công bố có thể chọn khi giao mới.
- `GET /form-assignments/assignee-candidates`: tài khoản active có vai trò nhân viên (`USER`/`STAFF`) hoặc `MANAGER`, loại trừ `ADMIN`.

## Mutation APIs

- `POST /form-assignments/preview`: nhận `formIds`, `assigneeIds`, `validUntil`, trả số cặp tạo mới, cập nhật, khôi phục, không đổi.
- `POST /form-assignments/bulk`: thực hiện giao nhiều-nhiều trong một transaction. Backend tự lấy phiên bản công bố hiện tại.
- `PATCH /form-assignment-items/bulk-validity`: cập nhật hạn theo `assignmentItemIds`, `validUntil`.
- `POST /form-assignment-items/bulk-revoke`: thu hồi nhiều quyền theo `assignmentItemIds`.

Payload không nhận `validFrom` hoặc version id. Quyền luôn có hiệu lực từ thời điểm lưu và tự bám phiên bản công bố mới nhất của bảng kiểm.
