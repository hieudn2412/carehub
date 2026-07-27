# CareHub Frontend

Frontend của CareHub được xây dựng bằng React và Vite. Dự án hiện dùng JavaScript/JSX, chưa dùng TypeScript.

## Công nghệ

- React
- Vite
- React Router
- Axios
- Recharts
- CSS thuần theo từng feature

## Chạy local

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

Ứng dụng mặc định chạy tại:

```text
http://localhost:5173
```

Để mở ứng dụng trên điện thoại, kết nối điện thoại và máy tính vào cùng một mạng Wi-Fi,
sau đó truy cập bằng địa chỉ IP LAN của máy tính:

```text
http://<IP-máy-tính>:5173
```

Vite đã được cấu hình lắng nghe kết nối LAN và chuyển tiếp các request `/api` tới backend
đang chạy tại `http://localhost:8081`. Vì vậy máy tính vẫn dùng `localhost`, còn điện thoại
dùng IP LAN nhưng cả hai đều sử dụng cùng backend. Nếu điện thoại không kết nối được, hãy
cho phép TCP port `5173` qua Windows Firewall.

## Biến môi trường

Tạo file `.env` từ `.env.example`:

```env
VITE_API_BASE_URL=/api/v1
```

Không commit `.env` vì file này có thể chứa cấu hình local hoặc secret.

## Scripts

```powershell
npm run dev      # Chạy môi trường phát triển
npm run build    # Build production
npm run lint     # Kiểm tra lint
npm run preview  # Preview bản build
```

## Cấu trúc thư mục

```text
src/
  app/
    App.jsx
    providers.jsx
    router.jsx
  assets/
  features/
    admin/
      api/
      components/
      data/
      pages/
      styles/
      utils/
    auth/
      api/
      components/
      constants/
      hooks/
      pages/
      services/
      styles/
      utils/
    evaluation/
    staff/
    training/
  shared/
    api/
    components/
    styles/
  main.jsx
```

## Quy ước code

- Không gọi Axios trực tiếp trong page; dùng API module của feature.
- Không hard-code API URL trong component; dùng `VITE_API_BASE_URL`.
- Không để CSS của một feature trong `shared/styles`.
- `shared` không import ngược từ `features`.
- Asset lớn nên đưa lên CDN/cloud và chỉ lưu URL trong code/config.
- Mỗi màn lớn nên có file CSS riêng để tránh một file phình quá to và đá style lẫn nhau.
- Trước khi commit nên chạy `npm run lint` và `npm run build`.


