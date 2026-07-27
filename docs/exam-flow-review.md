# Review luồng bài kiểm tra (ngân hàng câu hỏi → bộ đề → giao bài → làm bài → kết quả)

Ngày review: 2026-07-27. Phạm vi: `carehub-backend/.../questiongeneration/**` + `carehub-frontend/src/features/evaluation/**`, `features/staff/pages/{ExamTake*,ExamHistory*}`, `pages/manager/ManagerExamResult*`.

Phương pháp: 4 agent map luồng thực tế theo code → mỗi phát hiện được một agent độc lập kiểm chứng đối kháng (cố bác bỏ trước khi xác nhận). 50 phát hiện thô → 35 xác nhận có file:line, 0 bị bác bỏ, 4 mức thấp bỏ qua.

---

## 0. Luồng thực tế (theo code)

**Ngân hàng câu hỏi**: câu vào bank bằng 3 đường — tạo tay, import Excel, pipeline AI (upload tài liệu → chunk → DeepSeek sinh candidate → validate + dedup ngữ nghĩa E5 → reviewer duyệt → lưu thành câu bank). Trạng thái: `DRAFT/APPROVED/REJECTED/ARCHIVED`.

**Bộ câu hỏi** (`QuestionSet`): `DRAFT → ACTIVE` (tạo `QuestionSetVersion` snapshot toàn bộ nội dung câu, khóa không cho sửa) `→ INACTIVE/ARCHIVED`. Chỉ nhận câu `APPROVED`.

**Sinh đề** (`ExamPaper`): từ `ExamConfig` ACTIVE, lấy câu từ version snapshot, chọn ngẫu nhiên theo seed + phân bổ theo danh mục, trộn câu/đáp án, rồi **snapshot lần hai** vào `ExamPaperQuestionSnapshot`. `DRAFT → PUBLISHED → ARCHIVED`.

**Giao bài** (`ExamAssignment`): chỉ nhận đề PUBLISHED; target mở rộng từ user/phòng ban/vị trí/nhóm/toàn viện thành từng dòng `ExamAssignmentTarget`. `DRAFT → OPEN` (bắn thông báo) `→ CLOSED`, `ARCHIVED`. Có `maxAttempts` (1–10, mặc định 1) và `resultVisibility` (`SCORE_ONLY` | `SCORE_AND_ANSWERS`).

**Làm bài** (`ExamAttempt`): start kiểm tra assignment OPEN + chưa quá hạn + đề PUBLISHED + user trong target, khóa `PESSIMISTIC_WRITE` chống start song song, resume attempt đang dở. `expiresAt = now + timeLimit`, cắt xuống `dueAt` nếu hạn sớm hơn. Autosave → submit → chấm ngay (`score = đúng × 10 / tổng`), so với `passingScore`, gán xếp loại, và nếu đạt thì tự sinh 1 bản ghi CME.

**Nhận xét kiến trúc**: hướng thiết kế đúng và có chỗ làm rất chỉn chu — **hai lớp snapshot** (bộ câu hỏi + đề) khiến sửa ngân hàng câu hỏi không bao giờ làm sai lệch đề đã phát hành hay bài đã chấm; khóa bi quan + unique key chống tạo trùng lượt; phân quyền tách 8 permission rõ ràng. Vấn đề nằm ở **enforcement phía server khi làm bài**, **thang điểm không nhất quán giữa các tầng**, và **một số bước UI bị cụt**.

---

## 1. Lỗ hổng thi cử (ưu tiên cao nhất)

### 1.1 Hết giờ không được chặn ở server — nộp sau khi hết giờ vẫn được chấm
`ExamAttemptService.java:147-165`. Cả `saveAnswers` lẫn `submit` khi attempt đã quá `expiresAt` vẫn gọi `gradeAttempt(attempt, request, ...)`, mà hàm này ghi đáp án trong request **trước** khi chấm. Không có `@Scheduled` nào chốt attempt hết hạn — hết giờ chỉ được xử lý "lười" khi có ai đó đọc lại attempt. Timer và auto-submit hiện chỉ là enforcement phía trình duyệt (`ExamTakeScreen.jsx`).

Hệ quả: sửa giờ máy/chặn request rồi gửi tay là làm bài không giới hạn thời gian.

**Sửa**: trong `saveAnswers`/`submit`, nếu `now > effectiveExpiry` thì chốt attempt bằng đáp án **đã lưu trước đó**, bỏ qua payload mới (hoặc trả 409). Cân nhắc thêm job quét attempt quá hạn.

### 1.2 Thi lại trên cùng một đề + cho xem đáp án = xem key rồi làm lại 10/10
`ExamAttemptService.java:133` — mọi lượt của một assignment dùng đúng một `examPaper`. Khi assignment đặt `maxAttempts > 1` và `resultVisibility = SCORE_AND_ANSWERS`, user nộp lượt 1, xem toàn bộ đáp án đúng + giải thích, rồi làm lượt 2 với chính bộ câu đó.

**Sửa**: hoặc chỉ tiết lộ đáp án khi đã hết lượt / assignment đã đóng; hoặc mỗi lượt sinh một đề khác (đã có sẵn cơ chế sinh nhiều variant theo seed).

### 1.3 Đáp án đúng của đề đã phát hành lộ cho bất kỳ ai có 1 evaluation permission
`ExamPaperController.java:30` gate cả class bằng `canAccess` = ADMIN **hoặc bất kỳ 1 trong 8 permission** (kể cả `RESULT_VIEWER`, `AUDIT_VIEWER`). `GET /exam-papers/{id}` trả snapshot kèm `correctAnswer` + `explanation`, và **không ghi audit log** (trong khi export cùng dữ liệu thì có ghi).

**Sửa**: tách quyền cho endpoint detail (chỉ `EXAM_PUBLISHER`/ADMIN mới thấy đáp án, người khác thấy đề đã ẩn key), và ghi audit như export.

---

## 2. Lỗi chặn đường dùng thật

### 2.1 Điểm hiển thị cho user bị chia 10 hai lần
`ExamAssignmentService.java:641` trả `bestScore = score / 10` trong khi `score` đã ở thang 0–10 (`ExamAttemptService.java:197-201`), còn `ExamTakeListScreen.jsx:113` render thẳng `{bestScore}/10`. User đạt 8,5 điểm nhìn thấy **0,85/10** — tưởng trượt.

### 2.2 Nút "Thi lại" không bấm được dù backend cho tới 10 lượt
`ExamTakeListScreen.jsx:50-54`: `openAssignment` thoát sớm khi có `detailAttemptId`, không bao giờ gọi `startAssignment` (call site duy nhất là dòng 58). Sau lượt đầu, nút lặng lẽ đổi thành "xem chi tiết". Tính năng `maxAttempts` coi như không dùng được từ UI.

### 2.3 Bộ lọc ngày mặc định ẩn chính những bài cần làm
`ExamTakeListScreen.jsx:19-20,36-37`: `toDate` mặc định = hôm nay, điều kiện lọc `dueAt <= toDate`. Mọi bài có **hạn nộp trong tương lai** (tức là mọi bài còn làm được) đều bị ẩn cho tới khi user tự sửa bộ lọc.

### 2.4 Thang điểm đạt lệch nhau giữa FE và BE
Backend yêu cầu `passingScore` trong khoảng 0–10 (`ExamConfigService.java:413-418`), UI ghi nhãn "Điểm đạt (%)" và mặc định gửi giá trị kiểu phần trăm → luồng "Tạo & giao bài" fail ngay với giá trị mặc định. Hiển thị `%` sai đơn vị còn ở `ExamPaperListPage.jsx:254`, `ExamPaperDetailPage.jsx:115`, `EvaluationDashboardPage.jsx:358`.

### 2.5 Cùng một điểm hiển thị 3 đơn vị khác nhau
`/10` ở màn làm bài, `%` ở thẻ "Điểm TB" (`ExamHistoryScreen.jsx:111`), "điểm" ở chỗ khác — trong khi dữ liệu gốc luôn là thang 0–10.

### 2.6 "Phát hành" ở kho đề là bước cụt
`examAssignmentApi.createAssignment` chỉ được gọi ở đúng một chỗ: luồng gộp trong `ExamConfigPage.jsx:236`, mà luồng đó luôn tự sinh đề mới. Đề bạn phát hành thủ công từ kho không có đường nào để giao.

### 2.7 Chuỗi 4 API tạo–sinh–phát hành–giao chạy ở client, không rollback
`ExamConfigPage.jsx:190-259`. Fail giữa chừng để lại `ExamConfig` ACTIVE mồ côi hoặc đề đã PUBLISHED không ai nhận; bấm lại tạo thêm bản trùng.

### 2.8 Lưu trữ đề đang có assignment OPEN không bị chặn
`ExamPaperService.java:153-158` archive vô điều kiện → nhân viên bấm "Bắt đầu" thì lỗi, phải vòng qua màn phân công để đóng assignment.

### 2.9 Import ngân hàng câu hỏi sập toàn bộ khi có 1 dòng trùng
`QuestionBankImportExportService.java:177-206` gọi `questionBankService.create` (`@Transactional` REQUIRED) rồi nuốt exception → transaction đã bị đánh dấu rollback, cả lô kết thúc bằng `UnexpectedRollbackException`. Cần `REQUIRES_NEW` cho từng dòng.

---

## 3. Sai lệch nghiệp vụ

| Vấn đề | Vị trí | Hệ quả |
|---|---|---|
| Phân bổ **độ khó** trong cấu hình đề bị bỏ qua hoàn toàn khi sinh đề | `ExamPaperService.java:379-418` | Cấu hình có trường nhưng không tác dụng (FE hiện cũng chưa gửi) |
| Manager xem điểm **lượt mới nhất**, user xem **điểm tốt nhất** | `ExamAssignmentService.java:657-686` vs `:641` | Hai bên nhìn hai con số khác nhau cho cùng một người |
| Mỗi lượt **đạt** tự tạo 1 bản ghi CME 1 giờ | `ExamPassedTrainingListener.java:55-80` | Thi lại nhiều lần = cộng giờ CME nhiều lần |
| 3/5 trạng thái attempt không bao giờ được gán (`SUBMITTED`/`EXPIRED`/`CANCELLED`) | `ExamAttemptService.java:136,202` | Thống kê "Quá hạn" luôn = 0; bỏ thi giữa chừng kẹt `IN_PROGRESS` vĩnh viễn |
| `ExamConfig.maxRetakes` là cấu hình chết | chỉ lưu, không nơi nào đọc | Số lượt thật do `ExamAssignment.maxAttempts` quyết định — hai chỗ cấu hình cùng một thứ |
| Trọng số `points` từng câu bị bỏ qua khi chấm | `ExamAttemptService.java:196-201` | Hiện vô hại (mọi câu đều points=1) nhưng là bẫy khi mở tính năng |
| Bắt đầu sát hạn nộp bị cắt giờ làm, không cảnh báo | `ExamAttemptService.java:127-129` | Vào lúc còn 5 phút thì chỉ có 5 phút dù đề cho 60 |

---

## 4. Quyền & dữ liệu

- **QUESTION_AUTHOR tự duyệt câu của mình**: `QuestionBankService` mặc định `status = APPROVED` và tự gán `reviewedBy` = người tạo; `QuestionFormPage.jsx:236` hard-code `APPROVED`. Vai trò `QUESTION_REVIEWER` bị vô hiệu trên thực tế, và câu `DRAFT` từ import không có màn nào để duyệt.
- **Manager xem chi tiết assignment thấy target của mọi khoa**: `ExamAssignmentService.java:124-129` kiểm tra quyền theo khoa rồi vứt bỏ danh sách đã lọc, trả về toàn bộ target (trong khi hàm xem *kết quả* thì lọc đúng).
- **Mở rộng target lọc user không nhất quán**: 5 nhánh (toàn viện / phòng ban / vị trí / nhóm / chỉ định) lọc `isDeleted`, `status` mỗi nhánh một kiểu — giao bài được cho cả tài khoản đã nghỉ việc.
- **Picker "nhân viên cụ thể" chỉ tải 100 người đầu**: `ExamConfigPage.jsx:70`, tìm kiếm chạy client-side trên 100 bản ghi đó.
- **Không có API sửa assignment**: `dueAt`/`maxAttempts`/target bất biến sau khi tạo; sửa nhầm hạn nộp phải tạo cái mới, làm phân mảnh kết quả.
- **Danh mục liên kết với câu hỏi bằng chuỗi tên** (`topic`, không FK): đổi tên danh mục làm gãy đếm câu, phân bổ khi sinh đề và phân loại.
- **Bank quá 500 câu**: màn quản lý và auto-chọn bộ câu hỏi nhìn hai "cửa sổ 500 câu" khác nhau, câu mới không được auto-chọn.
- **Bộ câu hỏi**: `activate()` không guard trạng thái (hồi sinh set ARCHIVED, re-snapshot set ACTIVE); `deactivate/archive` không kiểm tra `ExamConfig` đang dùng.
- **Filter "Đã lưu trữ"** ở kho đề và phân công luôn rỗng (FE không truyền `status`, BE mặc định loại ARCHIVED) — lưu trữ thực chất là xóa một chiều.
- **User không bao giờ biết còn mấy lượt**: backend đã tính sẵn `remainingAttempts` + chuỗi "Làm lại"/"Đã hết lượt" nhưng UI không hiển thị.
- **`QuestionBankListPage` rơi về 2 câu hỏi demo hard-code khi API lỗi** (có banner cảnh báo, nhưng Sửa/Xóa trên dòng demo vẫn bấm được).

---

## 4b. Phát hiện bổ sung khi sửa (không có trong 35 mục trên)

**Chuỗi sau khi thi đạt chưa từng chạy được.** Test `L2-EXM-10` đã ghi chú sẵn bug D33: `ExamPassedTrainingListener` chạy ở pha `AFTER_COMMIT` mà không mở transaction riêng, nên bản ghi CME không bao giờ được ghi. Khi sửa mới lộ ra tầng thứ hai: `NotificationDispatcher` mắc đúng lỗi đó — `@Transactional` mặc định (REQUIRED) *join* transaction cha đã commit (synchronization còn gắn thread) và mọi thao tác ghi ném `No active transaction`, bị `catch` của listener nuốt. Hệ quả rộng hơn exam: **mọi thông báo in-app phát từ listener AFTER_COMMIT đều không được lưu**. Sau khi sửa, một test khác vốn fail (`FormLifecycleFlowIntegrationTest.failedAssignedSubmissionNotifiesOnce`) cũng xanh trở lại.

Ghi chú: `@Transactional` đặt trực tiếp trên phương thức `@TransactionalEventListener` **không có tác dụng** — Spring gọi listener không qua proxy. Phải dùng `TransactionTemplate` hoặc tách sang bean khác.

## 5. Thứ tự đề xuất sửa

### ĐÃ SỬA (commit `2053a9dc`)

- [x] **1.1** Chặn nộp/lưu sau khi hết giờ ở server (`ExamAttemptService`) + 2 test cập nhật, thêm `L2-EXM-08b`.
- [x] **2.1 / 2.4 / 2.5** Bỏ phép chia 10 thừa ở `bestScore`; thống nhất đơn vị "/10" trên toàn frontend (ExamHistory, ExamPaperList/Detail, EvaluationDashboard kèm trục biểu đồ, Manager*, dashboard admin/staff); `ExamConfigPage`/`TestConfigPage` đổi nhãn + mặc định 7 + validate 0–10.
- [x] **2.2 / 2.3** Nối lại nút thi lại; bỏ mặc định lọc ngày; hiển thị số lượt đã dùng và lý do khi nút bị khoá.
- [x] **Mục 3 (CME)** Chỉ cộng CME một lần cho mỗi bài được giao mỗi người — và sửa D33 để chuỗi này thực sự chạy (xem 4b).

### ĐÃ SỬA (commit `7b9dccb3`)

- [x] **1.2** Chỉ tiết lộ đáp án khi người dùng không còn tác động được tới kết quả (hết lượt / phân công đóng / quá hạn, và không còn lượt làm dở). Kèm sửa thông báo ở màn Lịch sử thi cho đúng ngữ cảnh.
- [x] **1.3** `GET /exam-papers/{id}` chỉ trả `correctAnswer`/`explanation` cho `EXAM_PUBLISHER`/ADMIN; ghi audit `EXAM_PAPER_VIEW_ANSWER_KEY`; frontend guard nhãn rỗng.
- [x] **2.8** Chặn lưu trữ đề đang có bài kiểm tra được giao ở trạng thái mở.
- [x] **2.9** Import ngân hàng câu hỏi: mỗi dòng một transaction riêng.
- [x] **Mục 3 (latest vs best)** Quản lý và nhân viên cùng nhìn điểm cao nhất, nhãn cột nói rõ.
- [x] **Ngưỡng năng lực** `CompetencyThresholdPage` chuyển 0–100 → 0–10 khớp `CompetencyClassificationService`.

### CÒN LẠI

1. **Nối "Phát hành" với luồng giao bài** (2.6) — cần thêm UI giao một đề đã phát hành sẵn; hiện chỉ giao được qua luồng gộp tự sinh đề mới.
2. **Dọn rollback cho chuỗi 4 API "Tạo & giao bài"** (2.7) — nên gộp thành một endpoint giao dịch ở backend thay vì 4 lời gọi tuần tự ở client.
3. **Phân bổ độ khó bị bỏ qua khi sinh đề** và **`ExamConfig.maxRetakes` là cấu hình chết** (mục 3) — chọn một trong hai: nối vào logic hoặc bỏ khỏi giao diện để khỏi gây hiểu nhầm.
4. Mục 4 (quyền & dữ liệu) xử lý dần theo mức ảnh hưởng — ưu tiên: `QUESTION_AUTHOR` tự duyệt câu hỏi, manager thấy target mọi khoa, lọc user không nhất quán khi mở rộng target.
5. **Điểm form thực hành chưa quy về thang 0–10.** `CompetencyService` phân loại thẳng `FormSubmission.totalScore` (điểm thô của phiếu) bằng ngưỡng thang 0–10, trong khi `MyCompetencyService` và hàm `practicalScore()` (đã có sẵn trong chính file đó, dòng ~644) quy đổi `totalScore * 10 / maxScore`. Đã thử sửa nhưng revert: `practicalScore()` trả 0 khi bản ghi thiếu `maxScore`/`convertedScore`, làm điểm 85 thành 0 (`CompetencyServiceTest` đỏ). Cần khảo sát dữ liệu thật xem bao nhiêu phiếu thiếu `maxScore` rồi mới quyết cách quy đổi + fallback.
