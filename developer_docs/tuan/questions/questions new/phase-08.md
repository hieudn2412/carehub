# Phase 08 — Assignment, Attempt & Scoring

| Trạng thái | ĐÃ HOÀN THÀNH |
|------------|---------------|
| Ngày hoàn thành | 2026-07-02 (MVP) → 2026-07-03 (hardening: countdown, autosave, visibility, department target) |
| Nhóm màn hình | C (Assignment & Attempt) + một phần D (Monitoring) |
| Đáp ứng đề án | Dòng 101-107 (ĐDV làm bài + xem kết quả); Dòng 127-131 (ĐDTK xem kết quả nhân viên); Dòng 163 (thông báo yêu cầu kiểm tra) |

---

## 1. Phạm vi

Implement toàn bộ pipeline vận hành: **Giao bài → Làm bài → Chấm điểm**. Đây là luồng người dùng cuối (Điều dưỡng viên) tương tác trực tiếp.

3 sub-domain được gộp chung vì có quan hệ 1:N chặt chẽ:
```
ExamAssignment (1) → (N) ExamAttempt → Scoring → Result
```

---

## 2. Màn hình

### Admin / Manager (PC)
| ID | Màn hình | Route | Users |
|----|---------|-------|-------|
| — | Danh sách phân công | `/admin/evaluation/exam-assignments` | Admin |
| — | Tạo phân công | `/admin/evaluation/exam-assignments/new` | Admin |
| — | Kết quả bài làm (admin) | `/admin/evaluation/exam-attempts` | Admin |
| 37 | Kết quả nhân viên (manager) | `/manager/exam-results` | Manager |
| 38 | Chi tiết kết quả NV | `/manager/exam-results/detail/:id` | Manager |

### Staff (Mobile)
| ID | Màn hình | Route | Users |
|----|---------|-------|-------|
| 28 | Danh sách bài được giao | `/staff/exam/take` | User |
| 33 | Làm bài trắc nghiệm | `/staff/exam/take/:attemptId` | User |
| 34 | Kết quả sau khi nộp | (embedded trong take screen) | User |
| 35 | Lịch sử kết quả cá nhân | `/staff/exam/history` | User |
| 36 | Xem lại bài đã làm | (embedded trong history) | User |

---

## 3. Pipeline Flow

```
Admin: Create Assignment (chọn Paper PUBLISHED + target users/departments)
        ↓
Admin: Open Assignment (trạng thái ACTIVE, gửi notification)
        ↓
Employee: Xem danh sách bài được giao (Required Test List)
        ↓
Employee: Start Attempt (kiểm tra attempt limit, thời gian hiệu lực)
        ↓
Employee: Làm bài (countdown timer, autosave 30s, chuyển câu, nộp bài)
        ↓
System: Auto-submit khi hết giờ
        ↓
System: Scoring (so đáp án với ExamPaperQuestionSnapshot)
        ↓
Employee: Xem kết quả (theo resultVisibility policy)
        ↓
Manager: Xem kết quả nhân viên trong khoa
```

---

## 4. Business Rules

### Assignment
- BR-001: Chỉ giao Paper đã `PUBLISHED`
- BR-002: Không giao Paper `DRAFT`
- BR-003: Target: từng Employee cụ thể +/hoặc theo Department (backend bung department → danh sách user, dedup)
- BR-004: Assignment phải có `effectiveAt` (ngày mở) và `expiredAt` (ngày đóng), effectiveAt < expiredAt
- BR-005: Status: `DRAFT` → `PUBLISHED` → `ACTIVE` → `EXPIRED` / `CANCELLED`
- BR-006: Assignment `CANCELLED` không hiển thị cho Employee
- BR-007: Employee chỉ thấy Assignment đang `ACTIVE` và trong thời gian hiệu lực
- BR-008: Assignment không được sửa sau khi Published — chỉ Cancel + tạo mới
- BR-009: `resultVisibility`: `SCORE_ONLY` (chỉ xem điểm) hoặc `SCORE_AND_ANSWERS` (xem cả đáp án đúng + giải thích)
- BR-010: Assignment phải tạo Notification cho người nhận

### Attempt
- BR-011: Một Employee không được vượt quá `maxRetakes` (từ ExamConfig)
- BR-012: Attempt chỉ được Start khi Assignment ACTIVE và trong thời gian hiệu lực
- BR-013: Không Start ngoài thời gian hiệu lực
- BR-014: Attempt lifecycle: `NOT_STARTED` → `IN_PROGRESS` → `SUBMITTED` → `GRADED`
- BR-015: `EXPIRED`: tự động chuyển khi đọc nếu `expiresAt` đã qua
- BR-016: Một Attempt chỉ Submit một lần — sau Submit không sửa được đáp án
- BR-017: Hết giờ → Auto-submit (cờ `autoSubmitted = true`)
- BR-018: Question order được snapshot khi Start (không đổi giữa chừng)
- BR-019: Answer order được shuffle nếu Paper có shuffleOptions

### Scoring
- BR-020: Chấm điểm server-side, so sánh với `ExamPaperQuestionSnapshot.correctAnswer`
- BR-021: Điểm = số câu đúng / tổng số câu × 100 (%)
- BR-022: Pass/Fail dựa trên `ExamConfig.passingScore`
- BR-023: Khi `resultVisibility = SCORE_ONLY`, API trả điểm nhưng ẩn correctAnswer + explanation
- BR-024: Admin luôn xem được toàn bộ đáp án

---

## 5. Entity

### ExamAssignment
| Field | Type | Mô tả |
|-------|------|-------|
| id | UUID | PK |
| assignmentCode | String(20) | Mã phân công |
| paperId | UUID → ExamPaper | Đề được giao |
| status | Enum | DRAFT / PUBLISHED / ACTIVE / EXPIRED / CANCELLED |
| resultVisibility | Enum | SCORE_ONLY / SCORE_AND_ANSWERS |
| effectiveAt | Timestamp | Thời gian mở |
| expiredAt | Timestamp | Thời gian đóng |
| mandatory | Boolean | Bắt buộc |
| createdBy | String | Người tạo |

### ExamAssignmentTarget
| Field | Type | Mô tả |
|-------|------|-------|
| id | UUID | PK |
| assignmentId | UUID → ExamAssignment | FK |
| employeeId | UUID → User | Cá nhân được giao (nullable nếu theo department) |
| departmentId | UUID → Department | Khoa được giao (nullable nếu theo cá nhân) |

### ExamAttempt
| Field | Type | Mô tả |
|-------|------|-------|
| id | UUID | PK |
| assignmentId | UUID → ExamAssignment | FK |
| employeeId | UUID → User | Người làm |
| attemptNumber | Integer | Lần thứ mấy |
| status | Enum | NOT_STARTED / IN_PROGRESS / SUBMITTED / GRADED / EXPIRED |
| startedAt | Timestamp | Thời gian bắt đầu |
| submittedAt | Timestamp | Thời gian nộp |
| expiresAt | Timestamp | Hạn nộp (= startedAt + timeLimitMinutes) |
| score | Double | Điểm % |
| passed | Boolean | Đạt / Không đạt |
| timeSpentSeconds | Long | Thời gian làm thực tế |
| autoSubmitted | Boolean | Bị auto-submit do hết giờ |

### ExamAttemptAnswer
| Field | Type | Mô tả |
|-------|------|-------|
| id | UUID | PK |
| attemptId | UUID → ExamAttempt | FK |
| questionId | UUID → Question | FK |
| selectedAnswer | String(1) | Đáp án đã chọn (A/B/C/D) |
| isCorrect | Boolean | Đúng/sai (tính khi submit) |
| answeredAt | Timestamp | Thời điểm trả lời |

---

## 6. API

### Admin API
| Method | Endpoint | Mô tả | Permission |
|--------|----------|-------|------------|
| GET | `/api/v1/exam-assignments` | List (q, status filter) | canManageAssignment |
| GET | `/api/v1/exam-assignments/{id}` | Detail + targets | canManageAssignment |
| POST | `/api/v1/exam-assignments` | Create (paperId, targets, dates) | canManageAssignment |
| POST | `/api/v1/exam-assignments/{id}/open` | Open → ACTIVE | canManageAssignment |
| POST | `/api/v1/exam-assignments/{id}/close` | Close → EXPIRED | canManageAssignment |
| DELETE | `/api/v1/exam-assignments/{id}` | Cancel | canManageAssignment |
| GET | `/api/v1/exam-assignments/{id}/results` | Results summary | canViewResults |
| GET | `/api/v1/exam-assignments/{id}/export-results` | Export XLSX | canViewResults |
| GET | `/api/v1/exam-attempts` | List (assignmentId, status filter) | canViewResults |
| GET | `/api/v1/exam-attempts/{id}` | Detail + answers | canViewResults |

### User Runtime API (`/api/v1/me/...`)
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/v1/me/exam-assignments` | Danh sách bài được giao |
| POST | `/api/v1/me/exam-assignments/{id}/start` | Bắt đầu attempt |
| GET | `/api/v1/me/exam-attempts` | Lịch sử attempt cá nhân |
| GET | `/api/v1/me/exam-attempts/{id}` | Chi tiết attempt (ẩn đáp án nếu SCORE_ONLY) |
| PUT | `/api/v1/me/exam-attempts/{id}/answers` | Lưu đáp án (autosave) |
| POST | `/api/v1/me/exam-attempts/{id}/submit` | Nộp bài |

---

## 7. Permission

| Vai trò | Quyền |
|---------|-------|
| Admin (ASSIGNMENT_MANAGER) | CRUD Assignment, Open/Close |
| Admin / Manager (RESULT_VIEWER) | Xem kết quả (manager trong phạm vi khoa) |
| Employee (authenticated) | Xem bài được giao, làm bài, xem kết quả cá nhân |

---

## 8. UI Components

### Admin — Assignment List
- Table: code, paper name, status, target count, effective/expired dates
- Actions: Open, Close, Cancel, View Results
- Detail panel: bảng kết quả từng user (mã NV, họ tên, khoa, số lượt, điểm mới nhất, pass/fail)
- Export XLSX button

### Admin — Assignment Form
- Paper selector (chỉ hiện paper PUBLISHED)
- Target selector: chọn Employee +/hoặc Department
- Date range picker (effectiveAt → expiredAt)
- Result visibility toggle (SCORE_ONLY / SCORE_AND_ANSWERS)

### Staff — Required Test List (`/staff/exam/take`)
- Card list: tên bài, thời gian, số câu, hạn nộp, trạng thái (chưa làm / đã làm / hết hạn)
- Badge đỏ nếu mandatory và chưa làm
- Click → Start Attempt

### Staff — Test Taking (`/staff/exam/take/:attemptId`)
- **Countdown timer** (đếm ngược, cảnh báo đỏ khi < 5 phút)
- **Question navigator** (sidebar: số câu, đã làm/chưa làm, câu hiện tại)
- **Question card**: stem, 4 radio options (A-D)
- **Autosave** mỗi 30 giây + indicator "Đã lưu lúc HH:mm"
- **Progress bar**: X / Y câu đã trả lời
- **Submit button** + confirm dialog ("Bạn còn N câu chưa trả lời")
- **Auto-submit dialog** khi hết giờ
- Khóa toàn bộ thao tác khi attempt không còn IN_PROGRESS

### Staff — Result (sau khi nộp)
- Điểm tổng + Pass/Fail badge
- Nếu `SCORE_AND_ANSWERS`: hiển thị danh sách câu hỏi + đáp án đã chọn + đáp án đúng + giải thích
- Nếu `SCORE_ONLY`: chỉ hiển thị điểm, ẩn chi tiết

### Staff — History (`/staff/exam/history`)
- Table: tên bài, ngày làm, điểm, pass/fail, thời gian làm
- Click → xem lại (nếu policy cho phép)

### Manager — Results (`/manager/exam-results`)
- Filter: theo bài test, khoa, thời gian, đạt/không đạt
- Table: mã NV, họ tên, khoa, điểm, pass/fail, số lượt, thời gian
- Click → detail: lịch sử từng lần làm, điểm, phân loại

---

## 9. Kiểm thử

| Test | Loại | Trạng thái |
|------|------|------------|
| `ExamAssignmentServiceTest` (create, department expansion, results, export) | Unit | Pass |
| `ExamAttemptServiceTest` (submit scoring, visibility policy, expire-on-read, auto-submit) | Unit | Pass |
| Manual: create assignment → open → employee start → làm bài → submit | Manual | Pass |
| Manual: autosave + countdown + auto-submit | Manual | Pass |
| Manual: result visibility SCORE_ONLY vs SCORE_AND_ANSWERS | Manual | Pass |
| Manual: manager xem kết quả trong khoa | Manual | Pass |

---

## 10. Implementation Status

**Đã implement hoàn chỉnh** (Phase 5 + 13 + R5 cũ, 2026-07-02 đến 2026-07-03):

- Admin: Assignment CRUD + Open/Close + Results + Export XLSX
- User runtime: `/me/exam-assignments`, `/me/exam-attempts` đầy đủ
- Target: Employee + Department (backend bung + dedup)
- Countdown timer + autosave 30s + lock khi hết giờ
- Result visibility policy (SCORE_ONLY / SCORE_AND_ANSWERS)
- Expire-on-read: attempt tự động chuyển EXPIRED khi quá hạn
- Scoring server-side dựa trên ExamPaperQuestionSnapshot

### Còn thiếu (→ Phase 10)
- Target theo Position/Group/All Employees
- Target theo Role (vd: chỉ ĐDTK)
- Advanced pagination/filter server-side cho attempts

---

## 11. Map với đề án bệnh viện

| Yêu cầu đề án | Được đáp ứng bởi |
|--------------|-----------------|
| "Nhận biết được yêu cầu kiểm tra từ người quản lý (biểu tượng màu đỏ)" (dòng 101) | Required Test List + badge đỏ |
| "Thực hiện được bài kiểm tra trắc nghiệm" (dòng 102) | Test Taking Screen |
| "Kết thúc có hiển thị điểm đánh giá và mức phân loại, không đạt thì cảnh báo màu đỏ" (dòng 102) | Result Screen + Pass/Fail badge |
| "Xem được điểm đánh giá kiến thức và mức phân loại theo các lĩnh vực" (dòng 103) | History + Category Analysis |
| "Xem được điểm trung bình từ đầu năm" (dòng 104) | History với filter thời gian |
| "Gửi thông báo để ĐDV nhận biết có yêu cầu đánh giá" (dòng 163) | Notification khi Assignment ACTIVE |
| Manager: "Xem được theo từng lĩnh vực... danh sách ĐDV + điểm TB + tỷ lệ đạt" (dòng 127) | Manager Results Page |
| Manager: "Xem được theo từng cá nhân... các lĩnh vực + điểm TB" (dòng 128) | Manager Result Detail |

---

## 12. Liên quan

| Phase | Mối quan hệ |
|-------|-------------|
| Phase 07 | Assignment giao ExamPaper đã PUBLISHED |
| Phase 09 | Dashboard aggregate attempt data + Audit log |
| Phase 10 | Target mở rộng (Position/Group/All), competency classification |
