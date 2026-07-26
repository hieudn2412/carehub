# k6 performance scripts — L3-Performance (NFR-P01, NFR-S01, NFR-P02)

Ba script này là phần thực thi của sheet `L3-Performance` trong
`docs/Report 5.3_L3-SystemAPITests_Template.xlsx`. **Chưa từng được chạy** — cột `Baseline` và
`Actual Result` trong workbook để trống, `Status = Not Run` — vì cần một môi trường có app đang chạy
trên PostgreSQL thật và có k6 cài sẵn; cả hai đều không có trong môi trường phát triển hiện tại.

| Script | Test ID | NFR (TDS 7.4) | Cấu hình | Ngưỡng |
|---|---|---|---|---|
| `load-nfr-p01.js` | `L3-PERF-01` | NFR-P01 | 300 VU, ramp 60 s, steady 5 min | `p(95) < 3000 ms`, `http_req_failed < 1%` |
| `stress-nfr-s01.js` | `L3-PERF-02` | NFR-S01 | 500 VU, ramp 120 s, steady 10 min | không có 5xx, `http_req_failed < 1%`, `p(99) < 10 s` |
| `load-nfr-p02-scoring.js` | `L3-PERF-03` | NFR-P02 | 100 VU, ramp 30 s, steady 5 min | `scoring_duration p(95) < 1000 ms` |

## Chuẩn bị

1. **Cài k6** (không có trong repo, không có trong `pom.xml`):
   `winget install k6` · `choco install k6` · hoặc tải từ https://k6.io/docs/get-started/installation/
2. **Chạy backend** trên PostgreSQL thật (không dùng H2 — số đo trên H2 vô nghĩa):
   `cd carehub-backend && ./mvnw spring-boot:run`
3. **Seed tài khoản tải**: cần N tài khoản `ACTIVE` cùng mật khẩu. Không hardcode trong script —
   truyền qua biến môi trường. Với `load-nfr-p02-scoring.js`, mỗi tài khoản còn cần **ít nhất một
   `FormAssignment` đang ACTIVE** trỏ tới một version có đúng một câu hỏi `SINGLE_CHOICE` bắt buộc
   (tạo qua `POST /forms` → `/versions` → `/publication` → `POST /form-assignments`).

## Chạy

```bash
# NFR-P01 — load
k6 run -e BASE_URL=http://localhost:8081 \
       -e K6_EMPLOYEE_CODES=LOAD001,LOAD002,LOAD003 \
       -e K6_PASSWORD='<mật khẩu>' \
       scripts/k6/load-nfr-p01.js

# NFR-S01 — stress
k6 run -e BASE_URL=... -e K6_EMPLOYEE_CODES=... -e K6_PASSWORD=... scripts/k6/stress-nfr-s01.js

# NFR-P02 — scoring write path
k6 run -e BASE_URL=... -e K6_EMPLOYEE_CODES=... -e K6_PASSWORD=... scripts/k6/load-nfr-p02-scoring.js

# Lưu kết quả để điền cột Actual Result / Baseline của workbook
k6 run --summary-export=perf-p01.json scripts/k6/load-nfr-p01.js
```

Mỗi VU tự `POST /auth/login` một lần rồi tái dùng access token (hàm `authHeaders()` trong
`lib/auth.js`) — đúng cách hệ thống thật được dùng, và tránh biến `/auth/login` thành điểm nghẽn giả.
Token sống 15 phút nên đủ cho cả kịch bản dài nhất.

## Điền kết quả vào workbook

Sau lần chạy đầu: copy `http_req_duration p(95)` và `http_req_failed` vào cột `Actual Result`, đặt
`Status = Pass/Fail` theo ngưỡng, và ghi cùng con số đó vào cột `Baseline` của lần chạy sau.
