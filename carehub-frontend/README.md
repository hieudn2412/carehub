# CareHub Frontend

Ứng dụng web CareHub dành cho ba nhóm người dùng: `ADMIN`, `MANAGER` và `USER`.
Frontend được xây dựng bằng React + Vite, dùng JavaScript/JSX (không dùng
TypeScript) và kết nối với CareHub Spring Boot API.

Tài liệu này là điểm bắt đầu cho thành viên mới và AI agent trước khi sửa code.

## 1. Công nghệ chính

- React 19
- Vite 8
- React Router
- Axios
- Recharts
- Ant Design Icons
- CSS thuần, tổ chức theo feature
- Vitest + Testing Library
- Playwright cho end-to-end test

## 2. Yêu cầu môi trường

- Node.js 20 trở lên
- npm
- Backend CareHub chạy tại `http://localhost:8080` khi phát triển local

Kiểm tra phiên bản:

```powershell
node --version
npm --version
```

## 3. Chạy dự án local

```powershell
cd carehub-frontend
npm install
Copy-Item .env.example .env
npm run dev
```

Mở `http://localhost:5173`.

Vite lắng nghe kết nối trong mạng LAN. Điện thoại cùng mạng có thể truy cập:

```text
http://<IP-máy-tính>:5173
```

Trong môi trường local, request `/api` được Vite proxy tới backend ở cổng
`8080`. Nếu thiết bị khác mở được frontend nhưng không gọi được API, kiểm tra:

1. Backend đang chạy ở cổng `8080`.
2. Máy tính và thiết bị ở cùng mạng.
3. Windows Firewall cho phép cổng `5173`.

## 4. Biến môi trường

Tạo `.env` từ `.env.example`:

```env
VITE_API_BASE_URL=/api/v1
```

Quy ước:

- Local: dùng `/api/v1` để request đi qua Vite proxy.
- Production: đặt URL backend đã deploy, ví dụ
  `https://api.example.com/api/v1`.
- Không hard-code host hoặc port API trong component.
- Không đưa secret, mật khẩu, private key vào biến `VITE_*`. Biến Vite được
  đóng gói và người dùng trình duyệt có thể đọc được.
- Không commit file `.env`.

## 5. Scripts

| Lệnh | Mục đích |
| --- | --- |
| `npm run dev` | Chạy development server |
| `npm run build` | Build production vào `dist/` |
| `npm run preview` | Xem thử bản production build |
| `npm run lint` | Kiểm tra ESLint |
| `npm test` | Chạy unit test một lần |
| `npm run test:watch` | Chạy unit test ở watch mode |
| `npm run test:coverage` | Chạy unit test và tạo coverage |
| `npm run test:e2e` | Chạy Playwright end-to-end test |
| `npm run test:e2e:list` | Liệt kê Playwright test |

Trước khi commit tối thiểu phải chạy:

```powershell
npm run lint
npm test
npm run build
```

## 6. Cấu trúc thư mục

```text
carehub-frontend/
├─ public/                 # File tĩnh được copy nguyên trạng khi build
├─ e2e/                    # Playwright end-to-end tests
├─ src/
│  ├─ app/                 # Khởi tạo app, providers và toàn bộ route
│  ├─ assets/              # Ảnh/font local thực sự được source code sử dụng
│  ├─ features/            # Code theo từng miền nghiệp vụ
│  │  ├─ admin/            # Quản trị tài khoản, dữ liệu nền, hệ thống
│  │  ├─ auth/             # Đăng nhập, OTP, quên/đặt lại/đổi mật khẩu
│  │  ├─ dashboard/        # Dashboard theo role và nghiệp vụ
│  │  ├─ evaluation/       # Bài kiểm tra, câu hỏi, bảng kiểm, năng lực
│  │  ├─ staff/            # Màn hình dành cho nhân viên/manager
│  │  └─ training/         # Giờ đào tạo và loại hoạt động đào tạo
│  ├─ shared/              # Thành phần dùng chung, không chứa nghiệp vụ riêng
│  │  ├─ api/              # Axios client và xử lý lỗi HTTP chung
│  │  ├─ components/       # UI component tái sử dụng
│  │  ├─ context/          # Context dùng toàn ứng dụng
│  │  └─ styles/           # Style nền và design pattern dùng chung
│  ├─ styles/              # Style cấp ứng dụng còn lại
│  ├─ test/                # Vitest setup và test helpers
│  └─ main.jsx             # Entry point
├─ .env.example
├─ eslint.config.js
├─ playwright.config.js
├─ vite.config.js
└─ vitest.config.js
```

### Cấu trúc một feature

Không phải feature nào cũng cần đủ mọi thư mục. Chỉ tạo khi có nhu cầu:

```text
features/<feature>/
├─ api/                    # Hàm gọi API và ánh xạ request/response
├─ components/             # Component chỉ dùng trong feature
├─ constants/              # Hằng số, enum phía frontend
├─ hooks/                  # Custom hooks của feature
├─ pages/                  # Route-level screens
├─ services/               # Logic nghiệp vụ không thuộc UI/API
├─ styles/                 # CSS của feature
└─ utils/                  # Hàm thuần hỗ trợ feature
```

## 7. Quy tắc phụ thuộc

Luồng phụ thuộc mong muốn:

```text
app -> features -> shared
```

- `app` được phép import `features` và `shared`.
- `features` được phép import `shared`.
- `shared` không được import ngược từ bất kỳ `feature` nào.
- Hạn chế import chéo giữa hai feature. Nếu logic thực sự dùng chung, chuyển
  phần không mang nghiệp vụ riêng xuống `shared`; nếu là nghiệp vụ, tạo API hoặc
  service thuộc feature sở hữu.
- Page không gọi Axios trực tiếp. Luồng chuẩn:
  `Page -> feature/api -> shared/api/httpClient`.
- Không đặt dữ liệu giả trong production code để che API chưa có. Hãy dùng
  loading, empty và error state rõ ràng.

## 8. Routing và phân quyền

Route được khai báo tập trung tại `src/app/router.jsx`.

Khi thêm màn hình:

1. Tạo page trong feature sở hữu.
2. Import page vào `router.jsx`.
3. Đặt route dưới guard đúng role/quyền.
4. Thêm điều hướng sidebar nếu người dùng cần truy cập trực tiếp.
5. Kiểm tra truy cập bằng URL với cả role hợp lệ và không hợp lệ.

Không chỉ ẩn menu để phân quyền. Route vẫn phải được bảo vệ vì người dùng có thể
nhập URL trực tiếp. Backend luôn là nơi quyết định quyền cuối cùng.

## 9. API và xác thực

- Axios client chung: `src/shared/api/httpClient.js`.
- Token/session helpers nằm trong feature `auth`.
- Feature API chỉ nhận dữ liệu cần thiết từ page và trả dữ liệu đã chuẩn hóa khi
  hợp lý.
- Không log token, mật khẩu, OTP hoặc dữ liệu nhạy cảm.
- Không lưu mật khẩu trong localStorage/sessionStorage.
- Khi backend thay đổi contract, cập nhật API module trước rồi mới cập nhật UI.
- Nội dung lỗi hiển thị cho người dùng bằng tiếng Việt; không hiển thị stack
  trace hoặc raw exception.

## 10. UI và CSS

- CSS nghiệp vụ nằm cạnh feature, không dồn vào một file toàn cục.
- Style bảng admin dùng nền chung tại
  `src/shared/styles/admin-tables.css`; ưu tiên tái sử dụng class hiện có.
- Component dùng chung như modal, loading, empty state, select và pagination
  nằm trong `src/shared/components`.
- Prefix class theo màn hình/feature để tránh style đè lẫn nhau.
- Không dùng selector toàn cục quá rộng như `button`, `table`, `.card` trong CSS
  của một page.
- Mọi icon-only button phải có `title` hoặc `aria-label`.
- Màn hình phải có loading, empty, error và disabled/submitting state.
- Kiểm tra ít nhất ở desktop và viewport mobile trước khi hoàn thành.

## 11. Cách thêm một API flow

Ví dụ thêm trang danh sách:

1. Tạo `features/<feature>/api/<resource>Api.js`.
2. Dùng `httpClient`, không tạo Axios instance mới.
3. Tạo page và state cho `loading`, `error`, `data`, filter, pagination.
4. Hủy/bỏ qua response cũ khi filter thay đổi nhanh nếu có nguy cơ race
   condition.
5. Không tải toàn bộ dữ liệu lớn để lọc trên trình duyệt; gửi search/pagination
   tới backend.
6. Khai báo route và guard.
7. Thêm test cho mapping hoặc logic quan trọng.

## 12. Kiểm thử

- Unit test đặt cạnh module với hậu tố `.test.js` hoặc `.test.jsx`.
- Test hành vi người dùng và kết quả hiển thị, không phụ thuộc chi tiết
  implementation.
- E2E test nằm trong `e2e/`, dùng cho flow quan trọng như auth, phân quyền và
  bảng kiểm.
- Bug có khả năng tái diễn nên có regression test.

## 13. Hiệu năng

- Không import asset lớn nếu có thể phục vụ qua CDN/object storage.
- Không tải toàn bộ danh sách lớn; dùng server-side search và pagination.
- Tránh tính toán/filter nặng trực tiếp trong render.
- Dùng lazy loading cho route hoặc module lớn khi mở rộng router.
- Kiểm tra kích thước bundle sau khi thêm thư viện; không cài thư viện chỉ để
  giải quyết một thao tác nhỏ có thể làm bằng API sẵn có.

## 14. Checklist cho người hoặc AI agent

Trước khi sửa:

1. Đọc README này.
2. Chạy `git status` và không ghi đè thay đổi chưa commit của người khác.
3. Đọc `router.jsx`, API module, page và CSS liên quan.
4. Tìm tất cả import/route trước khi đổi tên hoặc xóa file.
5. Không sửa backend nếu yêu cầu chỉ thuộc frontend.

Trong khi sửa:

1. Giữ thay đổi trong đúng feature.
2. Tái sử dụng component/style hiện có trước khi tạo mới.
3. Không thêm mock production, URL cứng hoặc secret.
4. Không xóa code chỉ vì chưa thấy trên UI; phải xác minh route, dynamic import,
   test và chuỗi import.

Trước khi bàn giao:

1. Chạy lint, unit test và production build.
2. Kiểm tra diff để tránh format/churn ngoài phạm vi.
3. Nêu rõ phần chưa test được hoặc API backend còn thiếu.

## 15. Build và deploy frontend

```powershell
npm ci
npm run build
```

Deploy nội dung thư mục `dist/` lên static hosting. Hosting phải:

- fallback mọi route frontend về `index.html`;
- đặt `VITE_API_BASE_URL` đúng backend production trước khi build;
- cho phép HTTPS và backend cấu hình CORS đúng domain frontend.

## 16. Xử lý lỗi thường gặp

### Frontend báo không kết nối được máy chủ

- Mở Network trong DevTools và kiểm tra Request URL.
- Kiểm tra backend `http://localhost:8080`.
- Kiểm tra `.env`, sau đó khởi động lại Vite.
- Local nên dùng `VITE_API_BASE_URL=/api/v1`, không dùng cùng cổng với frontend.

### Route refresh trả về 404 sau deploy

Static hosting chưa cấu hình SPA fallback về `index.html`.

### Thay `.env` nhưng ứng dụng không đổi

Vite chỉ đọc biến môi trường khi khởi động/build. Dừng và chạy lại
`npm run dev`, hoặc build lại khi deploy.
