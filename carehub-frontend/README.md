# CareHub Frontend

Frontend của CareHub được xây dựng bằng React và Vite.

## Scripts

- `npm run dev`: chạy môi trường phát triển.
- `npm run build`: build production.
- `npm run lint`: kiểm tra lint.
- `npm run preview`: preview bản build.

## Cấu trúc thư mục

```text
src/
  app/
    App.jsx
  assets/
  features/
    auth/
      components/
      constants/
      pages/
  shared/
    components/
    styles/
  main.jsx
```

- `app`: entry component và cấu hình cấp ứng dụng.
- `features`: code theo từng nghiệp vụ, ví dụ `auth`.
- `features/*/pages`: các màn hình chính của một feature.
- `features/*/components`: component chỉ dùng trong feature đó.
- `shared/components`: component dùng lại giữa nhiều feature.
- `shared/styles`: CSS global và style dùng chung.
- `assets`: hình ảnh, icon hoặc tài nguyên tĩnh được import từ source.

## Quy ước

- Tạo feature mới trong `src/features/<feature-name>`.
- Component dùng riêng cho feature đặt trong `features/<feature-name>/components`.
- Component dùng lại toàn app đặt trong `shared/components`.
- Style nền tảng đặt trong `shared/styles/global.css`.
