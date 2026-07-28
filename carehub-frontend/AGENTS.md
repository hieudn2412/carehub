# CareHub Frontend Agent Guide

Đọc `README.md` trước khi sửa code.

## Bắt buộc

- Chỉ sửa `carehub-frontend` khi task thuộc frontend.
- Chạy `git status` trước khi làm; không revert thay đổi của người khác.
- Giữ kiến trúc `app -> features -> shared`.
- Page gọi API qua module của feature; không gọi Axios hoặc hard-code URL trực tiếp.
- Bảo vệ route bằng role/quyền, không chỉ ẩn menu.
- Không thêm dữ liệu giả vào production code khi backend chưa có API.
- Không xóa file trước khi kiểm tra route, import, dynamic import và test.
- CSS của feature phải có phạm vi rõ ràng; tái sử dụng shared table/UI styles.
- Không log token, mật khẩu, OTP hoặc thông tin nhạy cảm.

## Trước khi hoàn thành

```powershell
npm run lint
npm test
npm run build
```

Ghi rõ mọi API còn thiếu, kiểm thử chưa chạy được hoặc rủi ro còn lại.
