# CareHub Frontend

Frontend của CareHub được xây dựng bằng React và Vite.

## Scripts

- `npm run dev`: chạy môi trường phát triển.
- `npm run build`: build production.
- `npm run lint`: kiểm tra lint.
- `npm run preview`: preview bản build.

## Environment

Tạo file `.env` từ `.env.example` khi chạy local:

```env
VITE_API_BASE_URL=http://localhost:8080/api/v1
```

Không commit file `.env` chứa thông tin thật.

## Cấu trúc thư mục

```text
src/
  app/
    App.jsx
    providers.jsx
    router.jsx
  assets/
  features/
    auth/
      api/
      components/
      constants/
      hooks/
      pages/
      services/
      styles/
  shared/
    api/
    components/
    styles/
  main.jsx
```

## Vai trò chính

- `app`: cấu hình cấp ứng dụng như router và provider.
- `features`: code theo từng nghiệp vụ. Hiện có `auth`.
- `features/auth/pages`: các màn hình login, quên mật khẩu, OTP, đặt lại mật khẩu.
- `features/auth/components`: component chỉ dùng trong auth.
- `features/auth/api`: hàm gọi API auth qua `httpClient`.
- `features/auth/services`: logic không phụ thuộc React, ví dụ lưu token.
- `features/auth/hooks`: custom hook cho auth.
- `features/auth/styles`: CSS riêng cho auth.
- `shared/api`: cấu hình HTTP dùng chung.
- `shared/components`: component có thể tái sử dụng nhiều nơi.
- `shared/styles`: style global thật sự dùng toàn app.
- `assets`: chỉ giữ asset nhỏ. Ảnh lớn nên đưa lên CDN/Cloudinary.

## Quy ước

- Không gọi Axios trực tiếp trong page.
- Không hard-code API URL trong component.
- Không để feature-specific CSS trong `shared/styles`.
- `shared` không import ngược từ `features`.
- Ảnh lớn không commit vào repo; dùng CDN với `f_auto,q_auto` nếu có thể.
- Chạy `npm run lint` và `npm run build` trước khi commit.
