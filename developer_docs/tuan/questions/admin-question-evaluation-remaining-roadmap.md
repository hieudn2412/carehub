# Admin question/evaluation remaining roadmap

## Mục tiêu

Kế hoạch này gom toàn bộ phần còn lại của khu vực admin liên quan đến:

- Tạo câu hỏi từ tài liệu.
- Review câu hỏi AI/paraphrase.
- Ngân hàng câu hỏi.
- Danh mục câu hỏi và quy tắc phân loại.
- Bộ câu hỏi.
- Cấu hình đề kiểm tra.
- Bộ đề/đề kiểm tra thật.
- Assignment, attempt, chấm điểm và báo cáo.

File này không thay thế các plan đã có:

- `frontend-upload-review-ui-plan.md`
- `document-question-generation-optimization-plan.md`
- `e5-vietquill-in-app-implementation-plan.md`
- `question-set-implementation-plan.md`

Mục tiêu của file này là roadmap tổng thể phase-by-phase cho phần còn lại, để khi implement không bị nhầm giữa "bộ câu hỏi", "cấu hình đề kiểm tra" và "bộ đề".

## Baseline hiện tại

Các phần đã có hoặc đã làm ở mức MVP:

- Admin sidebar đã có các mục:
  - `Tạo câu hỏi từ tài liệu`
  - `Ngân hàng câu hỏi`
  - `Bộ câu hỏi`
  - `Danh mục câu hỏi`
  - `Quy tắc phân loại`
  - `Cấu hình đề kiểm tra`
- Upload/review tài liệu đã có luồng riêng:
  - upload PDF/DOCX/TXT/MD
  - trạng thái `READY`, `OCR_REQUIRED`, `FAILED`
  - section/chunk preview
  - tạo job sinh câu hỏi
  - review candidate, approve/reject/save vào ngân hàng
  - lịch sử job theo document
- Document question generation đã có hardening quan trọng:
  - async job + polling UI
  - single-call DeepSeek theo chunk
  - chunk quality gate
  - duplicate/save hardening
  - E5 semantic duplicate có fallback lexical
  - UI metrics cơ bản
  - circuit breaker/concurrency limit cho DeepSeek
- VietQuill paraphrase đã có hướng triển khai in-app:
  - paraphrase cả stem và 4 đáp án
  - review candidate
  - approve/reject/save
  - model runtime có thể dùng local ONNX hoặc mock provider
- Bộ câu hỏi đã có MVP:
  - backend `QuestionSet`, `QuestionSetItem`, `QuestionSetItemSnapshot`, `QuestionSetStatus`
  - API list/detail/create/update/activate/deactivate/archive/preview
  - frontend list/form dùng API thật
  - chọn câu từ ngân hàng
  - preview auto-build theo blueprint
  - snapshot khi activate
  - export JSON/CSV/print đơn giản
- `TestConfigPage` đã dùng backend `ExamConfig` thay vì lưu cấu hình chính bằng `localStorage`.

## Implementation progress

- 2026-07-02: Phase 1 đã implement phần lõi CRUD ngân hàng câu hỏi.
  - Backend `/api/v1/questions` đã có `POST`, `PUT`, `POST /{questionId}/approve`, `POST /{questionId}/deactivate`, `DELETE /{questionId}`.
  - Backend validate MCQ 4 đáp án, status, correct answer; block duplicate mạnh bằng `DuplicateCheckService`.
  - Update/create câu hỏi `APPROVED` sẽ refresh E5 stem embedding qua `QuestionEmbeddingService`.
  - `GET /api/v1/questions?status=ALL` hỗ trợ admin list toàn bộ trạng thái; mặc định không truyền status vẫn giữ `APPROVED` cho các picker đang dùng.
  - Frontend `QuestionFormPage` đã bỏ luồng save `localStorage` và dùng API create/update thật.
  - Frontend `QuestionBankListPage` đã load toàn bộ trạng thái, archive, approve/deactivate từ UI.
  - Đã thêm `QuestionBankServiceTest`.
  - Verification đã chạy:
    - `.\mvnw.cmd -q -DskipTests compile`
    - `.\mvnw.cmd -q "-Dtest=QuestionBankServiceTest" test`
    - `npm run build`
- 2026-07-02: Phase 2 đã implement phần lõi danh mục câu hỏi và quy tắc phân loại backend.
  - Backend có entity/API cho `QuestionCategory`:
    - `GET /api/v1/question-categories`
    - `GET /api/v1/question-categories/{categoryId}`
    - `POST /api/v1/question-categories`
    - `PUT /api/v1/question-categories/{categoryId}`
    - `DELETE /api/v1/question-categories/{categoryId}` soft archive.
  - Backend có entity/API cho `QuestionClassificationRule`:
    - `GET /api/v1/question-classification-rules`
    - `GET /api/v1/question-classification-rules/{ruleId}`
    - `POST /api/v1/question-classification-rules`
    - `PUT /api/v1/question-classification-rules/{ruleId}`
    - `DELETE /api/v1/question-classification-rules/{ruleId}` disable.
    - `POST /api/v1/question-classification-rules/test`.
  - Classification rule dùng `keywords`, `sourcePattern`, `priority`, `enabled` và category active.
  - Khi tạo/sửa câu hỏi thủ công hoặc lưu candidate từ tài liệu vào ngân hàng, nếu topic trống thì backend thử gán category từ rule đang hoạt động.
  - Frontend `QuestionCategoryListPage` đã dùng API thật thay vì local state.
  - Frontend `ClassificationRuleListPage` và `ClassificationRuleFormPage` đã bỏ `carehub_classification_rules` localStorage và dùng API thật.
  - `QuestionFormPage` đã lấy danh mục active từ backend cho dropdown category.
  - Đã thêm `QuestionCategoryServiceTest` và `QuestionClassificationRuleServiceTest`.
  - Verification đã chạy:
    - `.\mvnw.cmd -q -DskipTests compile`
    - `.\mvnw.cmd -q "-Dtest=QuestionBankServiceTest,CandidateReviewServiceTest,QuestionCategoryServiceTest,QuestionClassificationRuleServiceTest" test`
    - `npm run build`
- 2026-07-02: Phase 3 đã implement phần lõi cấu hình đề kiểm tra backend.
  - Backend có entity/API cho `ExamConfig` và `ExamConfigDistribution`:
    - `GET /api/v1/exam-configs`
    - `GET /api/v1/exam-configs/{configId}`
    - `POST /api/v1/exam-configs`
    - `PUT /api/v1/exam-configs/{configId}`
    - `POST /api/v1/exam-configs/preview`
    - `POST /api/v1/exam-configs/{configId}/preview`
    - `POST /api/v1/exam-configs/{configId}/activate`
    - `POST /api/v1/exam-configs/{configId}/deactivate`
    - `DELETE /api/v1/exam-configs/{configId}` soft archive.
  - Backend validate `totalQuestions`, `timeLimitMinutes`, `passingScore`, `maxRetakes`, active question set và tổng distribution.
  - Khi config `ACTIVE`, backend chặn nếu tổng phân bổ lệch hoặc question set không đủ câu theo category.
  - Frontend thêm `examConfigApi.js`.
  - `TestConfigPage` đã bỏ `carehub_test_config` localStorage, load/save/preview config qua API backend.
  - Phân bổ category trong `TestConfigPage` dùng `QuestionCategory` active từ backend.
  - Đã thêm `ExamConfigServiceTest`.
  - Verification đã chạy:
    - `.\mvnw.cmd -q -DskipTests compile`
    - `.\mvnw.cmd -q "-Dtest=ExamConfigServiceTest,QuestionSetServiceTest,QuestionCategoryServiceTest,QuestionClassificationRuleServiceTest,QuestionBankServiceTest,CandidateReviewServiceTest" test`
    - `npm run build`
- 2026-07-02: Phase 4 đã implement phần lõi bộ đề kiểm tra thật.
  - Backend có entity/API cho `ExamPaper`, `ExamPaperQuestion`, `ExamPaperQuestionSnapshot`:
    - `GET /api/v1/exam-papers`
    - `GET /api/v1/exam-papers/{paperId}`
    - `POST /api/v1/exam-papers/generate`
    - `POST /api/v1/exam-papers/{paperId}/publish`
    - `DELETE /api/v1/exam-papers/{paperId}` soft archive.
  - Sinh đề từ `ExamConfig ACTIVE` + `QuestionSet ACTIVE`, chọn câu theo distribution category, random seed và số mã đề.
  - Mỗi câu trong đề có snapshot riêng tại thời điểm generate gồm stem, A-D, correct answer, explanation, difficulty, topic, source document.
  - Publish khóa trạng thái đề ở mức `PUBLISHED`; archive không xóa snapshot.
  - Frontend thêm `examPaperApi.js`.
  - Sidebar ĐÁNH GIÁ có mục `Bộ đề kiểm tra`.
  - Frontend có route/page:
    - `/admin/evaluation/exam-papers`
    - `/admin/evaluation/exam-papers/new`
    - `/admin/evaluation/exam-papers/:paperId`
  - Trang detail có toggle ẩn/hiện đáp án đúng và giải thích.
  - Đã thêm `ExamPaperServiceTest`.
  - Verification đã chạy:
    - `.\mvnw.cmd -q -DskipTests compile`
    - `.\mvnw.cmd -q "-Dtest=ExamPaperServiceTest" test`
    - `npm run build`
  - Chưa làm trong Phase 4 core:
    - duplicate paper API.
    - export PDF/Word/Excel.
    - option shuffle thật trong snapshot.
- 2026-07-02: Phase 5 đã implement MVP assignment/attempt/scoring end-to-end.
  - Backend có entity/API cho `ExamAssignment`, `ExamAssignmentTarget`, `ExamAttempt`, `ExamAttemptAnswer`.
  - Admin API:
    - `GET /api/v1/exam-assignments`
    - `GET /api/v1/exam-assignments/{assignmentId}`
    - `POST /api/v1/exam-assignments`
    - `POST /api/v1/exam-assignments/{assignmentId}/open`
    - `POST /api/v1/exam-assignments/{assignmentId}/close`
    - `DELETE /api/v1/exam-assignments/{assignmentId}` soft archive.
    - `GET /api/v1/exam-attempts`
    - `GET /api/v1/exam-attempts/{attemptId}`.
  - User runtime API:
    - `GET /api/v1/me/exam-assignments`
    - `POST /api/v1/me/exam-assignments/{assignmentId}/start`
    - `GET /api/v1/me/exam-attempts`
    - `GET /api/v1/me/exam-attempts/{attemptId}`
    - `PUT /api/v1/me/exam-attempts/{attemptId}/answers`
    - `POST /api/v1/me/exam-attempts/{attemptId}/submit`.
  - Scoring dùng snapshot `ExamPaperQuestionSnapshot`; user không nhận `correctAnswer` khi attempt còn `IN_PROGRESS`.
  - Assignment MVP chỉ target theo danh sách user cụ thể; target theo department/group để phase sau.
  - Frontend admin thêm `examAssignmentApi.js`, sidebar và routes:
    - `/admin/evaluation/exam-assignments`
    - `/admin/evaluation/exam-assignments/new`
    - `/admin/evaluation/exam-attempts`.
  - Frontend staff thêm runtime thật:
    - `/staff/exam/take`
    - `/staff/exam/take/:attemptId`
    - `/staff/exam/history` đã bỏ mock và đọc `/me/exam-attempts`.
  - Đã thêm `ExamAttemptServiceTest`.
  - Verification đã chạy:
    - `.\mvnw.cmd -q -DskipTests compile`
    - `.\mvnw.cmd -q "-Dtest=ExamAttemptServiceTest,ExamPaperServiceTest,ExamConfigServiceTest" test`
    - `npm run build`
  - Full `.\mvnw.cmd -q test` hiện bị chặn bởi PostgreSQL local: `FATAL: password authentication failed for user "postgres"` ở `CarehubBackendApplicationTests`.
  - Chưa làm trong Phase 5 MVP:
    - target theo department/group.
    - timer UI countdown/autosave interval.
    - result export/report.
    - attempt pagination/filter server-side nâng cao.
    - migration/index production.
- 2026-07-02: Phase 6 đã implement MVP controls cho review job tạo câu hỏi từ tài liệu.
  - Backend thêm cancel job:
    - `POST /api/v1/document-question-jobs/{jobId}/cancel`.
    - Worker kiểm tra trạng thái `CANCELLED` trước mỗi chunk và `failJob` không ghi đè job đã hủy.
  - Backend thêm batch candidate actions:
    - `POST /api/v1/document-question-candidates/batch/approve`
    - `POST /api/v1/document-question-candidates/batch/reject`
    - `POST /api/v1/document-question-candidates/batch/save-as-questions`.
  - Batch response trả số lượng requested/succeeded/failed, danh sách candidate cập nhật và lỗi theo từng candidate.
  - Frontend `DocumentQuestionJobReviewPage` thêm:
    - nút `Hủy phiên` cho job `CREATED/GENERATING`.
    - checkbox chọn từng candidate.
    - chọn tất cả candidate trong bộ lọc hiện tại.
    - batch duyệt/từ chối/lưu vào ngân hàng.
  - Đã thêm test:
    - `DocumentQuestionJobServiceTest`
    - mở rộng `CandidateReviewServiceTest` cho batch approve/reject.
  - Verification đã chạy:
    - `.\mvnw.cmd -q -DskipTests compile`
    - `.\mvnw.cmd -q "-Dtest=DocumentQuestionJobServiceTest,CandidateReviewServiceTest" test`
    - `npm run build`
  - Chưa làm trong Phase 6 MVP:
    - retry validation riêng từng candidate.
    - batch action theo toàn bộ server-side filter/pagination.
    - export review report.
    - OCR production/confidence UI.
- 2026-07-02: Phase 7 đã implement MVP batch paraphrase/VietQuill vận hành trong ngân hàng câu hỏi.
  - Backend chặn tạo paraphrase từ câu hỏi chưa `APPROVED`; biến thể chỉ sinh từ câu canonical đã duyệt.
  - Backend thêm batch tạo paraphrase jobs:
    - `POST /api/v1/paraphrase-jobs/batch`
    - request gồm `questionIds`, `requestedCount`, `changeStrength`.
    - response trả số job thành công/lỗi và lỗi theo từng `questionId`.
  - Backend thêm batch action cho paraphrase candidate:
    - `POST /api/v1/paraphrase-candidates/batch/approve`
    - `POST /api/v1/paraphrase-candidates/batch/reject`
    - `POST /api/v1/paraphrase-candidates/batch/save-as-questions`.
  - Frontend `QuestionBankListPage` thêm:
    - checkbox chọn câu hỏi đã duyệt.
    - batch `Tạo biến thể` từ nhiều câu hỏi.
    - dùng modal cấu hình VietQuill hiện có: số biến thể và mức thay đổi.
  - Frontend `ParaphraseJobReviewPage` thêm:
    - checkbox chọn candidate.
    - chọn tất cả trong bộ lọc hiện tại.
    - batch duyệt/từ chối/lưu vào ngân hàng.
  - Đã mở rộng `ParaphraseServiceTest` cho:
    - batch create jobs giữ job thành công và report câu lỗi.
    - batch approve candidate report candidate lỗi.
  - Verification đã chạy:
    - `.\mvnw.cmd -q -DskipTests compile`
    - `.\mvnw.cmd -q "-Dtest=ParaphraseServiceTest" test`
    - `npm run build`
  - Chưa làm trong Phase 7 MVP:
    - batch paraphrase job cha để gom nhiều source question trong một màn quản trị riêng.
    - UI lịch sử paraphrase dạng drawer trong từng câu hỏi.
    - highlight diff trực quan stem/options.
    - server-side pagination/filter cho danh sách candidate paraphrase lớn.
- 2026-07-02: Phase 8 đã implement MVP import/export ngân hàng câu hỏi.
  - Backend thêm service `QuestionBankImportExportService`.
  - Export ngân hàng câu hỏi ra XLSX:
    - `GET /api/v1/questions/export`
    - hỗ trợ query `q` và `status`.
    - file gồm các cột: `stem`, `optionA`, `optionB`, `optionC`, `optionD`, `correctAnswer`, `explanation`, `topic`, `difficulty`, `language`, `sourceDocument`, `status`.
  - Import preview:
    - `POST /api/v1/questions/import/preview`
    - multipart field `file`.
    - hỗ trợ XLSX/XLS/CSV.
    - validate từng dòng, trả lỗi theo dòng, không commit dữ liệu.
  - Import commit:
    - `POST /api/v1/questions/import/commit`
    - nhận các dòng đã preview.
    - lưu từng dòng qua `QuestionBankService.create`, nên vẫn chạy duplicate check và refresh embedding nếu `APPROVED`.
    - lỗi từng dòng không làm hỏng toàn bộ batch.
  - Frontend `QuestionBankListPage` thêm:
    - nút `Export Excel`.
    - modal `Import` chọn file, preview 20 dòng đầu, hiển thị hợp lệ/lỗi, commit dòng hợp lệ.
  - Đã thêm `QuestionBankImportExportServiceTest`.
  - Verification đã chạy:
    - `.\mvnw.cmd -q -DskipTests compile`
    - `.\mvnw.cmd -q "-Dtest=QuestionBankImportExportServiceTest" test`
    - `npm run build`
  - Chưa làm trong Phase 8 MVP:
    - import job entity lưu lịch sử import.
    - mapping column động trên UI.
    - import DOCX format tự do.
    - export question set/exam paper/result report.
    - template download riêng ngoài export hiện tại.
- 2026-07-02: Phase 9 đã implement MVP dashboard analytics đánh giá.
  - Backend thêm `EvaluationDashboardService` và `EvaluationDashboardController`.
  - API:
    - `GET /api/v1/evaluation-dashboard`
    - `GET /api/v1/evaluation-dashboard/question-bank-summary`
    - `GET /api/v1/evaluation-dashboard/exam-results-summary`
    - `GET /api/v1/evaluation-dashboard/question-item-analysis`.
  - Metrics ngân hàng câu hỏi:
    - tổng câu hỏi.
    - số câu theo `APPROVED/DRAFT/REJECTED/ARCHIVED`.
    - số câu gốc/paraphrase.
    - distribution theo trạng thái, độ khó, topic, source document.
  - Metrics kết quả kiểm tra:
    - tổng lượt làm.
    - lượt đang làm/đã chấm/quá hạn.
    - số lượt đạt/không đạt.
    - điểm trung bình.
    - tỷ lệ đạt.
    - thời gian làm trung bình.
  - Item analysis:
    - aggregate theo câu hỏi gốc từ `ExamAttemptAnswer`.
    - attempt count, correct count, wrong count, correct rate.
    - hiển thị top 50 câu có dữ liệu.
  - Frontend thêm:
    - `evaluationDashboardApi.js`
    - route `/admin/evaluation/dashboard`
    - sidebar item `Dashboard đánh giá`
    - page `EvaluationDashboardPage` với metric cards, distribution bars, bảng câu hỏi tỷ lệ đúng thấp.
  - Đã thêm `EvaluationDashboardServiceTest`.
  - Verification đã chạy:
    - `.\mvnw.cmd -q -DskipTests compile`
    - `.\mvnw.cmd -q "-Dtest=EvaluationDashboardServiceTest" test`
    - `npm run build`
  - Chưa làm trong Phase 9 MVP:
    - filter theo date/config/paper/assignment/department.
    - discrimination index nâng cao.
    - export báo cáo analytics.
    - drilldown từ dashboard sang chi tiết attempt/question.
    - integration test repository với PostgreSQL/H2 cho JPQL aggregate.
- 2026-07-02: Phase 10 đã implement MVP audit log cho khu vực đánh giá.
  - Backend thêm entity/repository/service/controller:
    - `EvaluationAuditLog`
    - `EvaluationAuditLogRepository`
    - `EvaluationAuditLogService`
    - `EvaluationAuditLogController`
  - API:
    - `GET /api/v1/evaluation-audit-logs`
    - `GET /api/v1/evaluation-audit-logs/{auditLogId}`
  - Audit đã ghi metadata cho các thao tác chính:
    - upload tài liệu.
    - tạo/retry/cancel job sinh câu hỏi.
    - update/approve/reject/save candidate tài liệu và batch action.
    - tạo/update/approve/deactivate/archive/import/export ngân hàng câu hỏi.
    - tạo/update/archive danh mục câu hỏi.
    - tạo/update/disable quy tắc phân loại.
    - tạo/batch tạo paraphrase job.
    - update/approve/reject/save paraphrase candidate và batch action.
    - tạo/update/activate/deactivate/archive bộ câu hỏi.
    - tạo/update/activate/deactivate/archive cấu hình đề.
    - generate/publish/archive bộ đề.
    - create/open/close/archive phân công kiểm tra.
  - Frontend thêm:
    - `evaluationAuditLogApi.js`
    - route `/admin/evaluation/audit-logs`
    - sidebar item `Audit đánh giá`
    - page `EvaluationAuditLogPage` với filter, bảng và panel chi tiết metadata JSON.
  - Đã thêm `EvaluationAuditLogServiceTest`.
  - Verification đã chạy:
    - `.\mvnw.cmd -q -DskipTests compile`
    - `.\mvnw.cmd -q "-Dtest=EvaluationAuditLogServiceTest" test`
    - `npm run build`
  - Chưa làm trong Phase 10 MVP:
    - audit detail theo diff before/after.
    - pagination/filter server-side thật ngoài top 200.
    - audit xem/export đáp án chi tiết, vì export bộ đề/answer key ở Phase 12 chưa implement.
    - permission granular, vẫn để Phase 11.
- 2026-07-03: Phase 11 đã implement MVP permission granular cho admin/evaluation.
  - Backend thêm:
    - `EvaluationPermissions`
    - `EvaluationSecurity`
    - `EvaluationSecurityTest`
  - JWT access token thêm claim `permissions` lấy từ `role_permissions` theo user.
  - `CustomJwtAuthenticationConverter` chuyển claim `permissions` thành authorities raw permission code.
  - `DataSeeder` seed các permission code evaluation:
    - `QUESTION_AUTHOR`
    - `QUESTION_REVIEWER`
    - `QUESTION_SET_MANAGER`
    - `EXAM_CONFIG_MANAGER`
    - `EXAM_PUBLISHER`
    - `ASSIGNMENT_MANAGER`
    - `RESULT_VIEWER`
    - `AUDIT_VIEWER`
  - `ROLE_ADMIN` vẫn là fallback toàn quyền để không khóa admin hiện tại.
  - Các controller trong `questiongeneration/controller` đã bỏ `hasRole('ADMIN')` cứng và dùng `@evaluationSecurity`:
    - author: upload tài liệu, tạo job, CRUD/import/export ngân hàng câu hỏi, category/rule, paraphrase job.
    - reviewer: review/save candidate tài liệu và paraphrase.
    - question set manager: CRUD/activate/preview bộ câu hỏi.
    - exam config manager: CRUD/activate/preview cấu hình đề.
    - exam publisher: generate/publish/archive bộ đề.
    - assignment manager: create/open/close/archive/list phân công.
    - result viewer: xem attempt/result và dashboard liên quan.
    - audit viewer: xem audit log.
  - Frontend thêm:
    - đọc `permissions` từ access token.
    - `ProtectedRoute` hỗ trợ `allowedPermissions`.
    - route `/admin/evaluation/*` cho phép `ADMIN` hoặc user có permission evaluation.
    - `AdminSidebar` ẩn/hiện item evaluation theo permission.
  - Verification đã chạy:
    - `.\mvnw.cmd -q -DskipTests compile`
    - `.\mvnw.cmd -q "-Dtest=EvaluationSecurityTest,EvaluationAuditLogServiceTest" test`
    - `npm run build`
  - Chưa làm trong Phase 11 MVP:
    - UI quản lý gán permission vào role chưa hoàn thiện nếu backend hiện tại chưa có endpoint assign role-permission.
    - Hide/disable action button chi tiết trong từng page mới ở mức sidebar/route, chưa phủ toàn bộ button.
    - Security integration test MockMvc theo từng endpoint chưa có.
- 2026-07-03: Phase 12 đã implement một phần hardening cho bộ câu hỏi/bộ đề.
  - Backend `QuestionSetService` thêm duplicate:
    - `POST /api/v1/question-sets/{setId}/duplicate`
    - bản sao luôn là `DRAFT`.
    - giữ metadata chính, thứ tự câu hỏi, điểm và required flag.
    - sinh code mới tự động để tránh trùng unique code.
  - Backend `ExamPaperService` thêm:
    - `POST /api/v1/exam-papers/{paperId}/duplicate`
    - bản sao luôn là `DRAFT`.
    - copy câu hỏi và snapshot hiện tại của đề nguồn, không đọc lại live question.
    - `GET /api/v1/exam-papers/{paperId}/export?format=txt|pdf|docx|xlsx&includeAnswers=true|false`
    - export TXT UTF-8 có hoặc không có đáp án/giải thích/nguồn.
  - Audit log thêm action:
    - `QUESTION_SET_DUPLICATE`
    - `EXAM_PAPER_DUPLICATE`
    - `EXAM_PAPER_EXPORT`
  - Frontend thêm:
    - `questionSetApi.duplicateQuestionSet`
    - `examPaperApi.duplicateExamPaper`
    - `examPaperApi.exportExamPaper`
    - nút nhân bản bộ câu hỏi ở `QuestionSetListPage`.
    - nút nhân bản, tải đề, tải đáp án ở `ExamPaperListPage` và `ExamPaperDetailPage`.
  - Test mở rộng:
    - `QuestionSetServiceTest`: duplicate tạo bản nháp giữ thứ tự câu hỏi.
    - `ExamPaperServiceTest`: duplicate copy snapshot; export TXT có/không đáp án.
  - Verification đã chạy:
    - `.\mvnw.cmd -q -DskipTests compile`
    - `.\mvnw.cmd -q "-Dtest=QuestionSetServiceTest,ExamPaperServiceTest" test`
    - `npm run build`
- 2026-07-03: Phase 12 bổ sung shuffle đáp án trong snapshot bộ đề.
  - Backend `ExamPaperService.generate` dùng `ExamConfig.shuffleOptions`.
  - Khi bật shuffle options:
    - xáo A-D theo `seed + position` để ổn định theo mã đề.
    - lưu option đã xáo vào `ExamPaperQuestionSnapshot`.
    - remap `correctAnswer` sang nhãn mới sau shuffle.
    - lưu `optionOrderJson` theo thứ tự nhãn gốc, ví dụ `["C","A","D","B"]`.
  - Luồng detail/export/attempt/scoring tiếp tục đọc snapshot nên tự dùng đáp án đã remap.
  - Test mở rộng:
    - `ExamPaperServiceTest.generateShufflesOptionsAndRemapsCorrectAnswerInSnapshot`.
  - Verification đã chạy:
    - `.\mvnw.cmd -q -DskipTests compile`
    - `.\mvnw.cmd -q "-Dtest=ExamPaperServiceTest" test`
    - `npm run build`
- 2026-07-03: Phase 12 bổ sung impact warning cho câu hỏi trong ngân hàng.
  - Backend thêm `QuestionImpactWarningResponse` trong `QuestionBankQuestionResponse`.
  - `GET /api/v1/questions/{questionId}` và update/approve trả cảnh báo nếu câu hỏi đang nằm trong:
    - active question set.
    - published exam paper.
  - Backend chặn archive/deactivate khi câu hỏi còn nằm trong active set hoặc published paper.
  - Backend cũng chặn đường vòng `PUT /api/v1/questions/{questionId}` nếu request đổi câu đang duyệt về `DRAFT`, và không cho set thẳng `ARCHIVED` qua update.
  - Repository thêm count query:
    - `QuestionSetItemRepository.countDistinctQuestionSetsByQuestionAndStatus`.
    - `ExamPaperQuestionRepository.countDistinctExamPapersByQuestionAndStatus`.
  - Frontend:
    - modal chi tiết câu hỏi hiển thị `Cảnh báo sử dụng`.
    - form chỉnh sửa hiển thị cảnh báo và confirm trước khi cập nhật nội dung.
    - archive/deactivate gọi detail trước và dừng sớm nếu backend báo đang bị chặn.
  - Test mở rộng:
    - `QuestionBankServiceTest.getQuestionReturnsImpactWarning`.
    - `QuestionBankServiceTest.archiveQuestionRejectsWhenQuestionIsUsedByActiveSet`.
    - `QuestionBankServiceTest.updateQuestionRejectsDraftStatusWhenQuestionIsUsedByActiveSet`.
  - Verification đã chạy:
    - `.\mvnw.cmd -q -DskipTests compile`
    - `.\mvnw.cmd -q "-Dtest=QuestionBankServiceTest,QuestionBankImportExportServiceTest" test`
    - `npm run build`
- 2026-07-03: Phase 12 bổ sung export nhiều định dạng cho bộ đề.
  - Backend `ExamPaperService.export` hỗ trợ:
    - `txt`: text UTF-8 giữ tương thích endpoint cũ.
    - `docx`: dùng Apache POI `XWPFDocument`.
    - `xlsx`: dùng Apache POI `XSSFWorkbook`, có metadata và bảng câu hỏi.
    - `pdf`: dùng PDFBox và font Unicode hệ thống để giữ tiếng Việt.
  - Endpoint `GET /api/v1/exam-papers/{paperId}/export` nhận thêm query `format`.
  - Audit `EXAM_PAPER_EXPORT` ghi thêm `format`.
  - Frontend:
    - `examPaperApi.exportExamPaper(paperId, includeAnswers, format)`.
    - `ExamPaperListPage` có dropdown format `TXT/PDF/DOCX/XLSX`.
    - `ExamPaperDetailPage` có dropdown format và dùng cùng nút tải đề/tải đáp án.
  - Test mở rộng:
    - `ExamPaperServiceTest.exportSupportsDocxXlsxAndPdfFormats`.
  - Verification đã chạy:
    - `.\mvnw.cmd -q -DskipTests compile`
    - `.\mvnw.cmd -q "-Dtest=ExamPaperServiceTest" test`
    - `npm run build`
- 2026-07-03: Phase 12 bổ sung version/snapshot history cho active question set.
  - Backend thêm entity/repository:
    - `QuestionSetVersion`
    - `QuestionSetVersionItem`
    - `QuestionSetVersionRepository`
    - `QuestionSetVersionItemRepository`
  - `QuestionSet` lưu thêm:
    - `activeVersion`
    - `snapshotAt`
  - Khi create/update/activate với trạng thái `ACTIVE`, hệ thống tạo version mới:
    - version = latest + 1.
    - snapshot toàn bộ nội dung câu hỏi A-D, đáp án đúng, giải thích, topic, difficulty, source document.
    - snapshot không phụ thuộc `QuestionBankQuestion` live sau này.
  - `QuestionSetDetailResponse` trả thêm:
    - `activeVersion`
    - `snapshotAt`
    - `versions`
    - `activeSnapshotItems`
  - Frontend `QuestionSetFormPage` hiển thị:
    - phiên bản active hiện tại.
    - lịch sử version gần nhất.
    - preview snapshot items của version active.
  - Test mở rộng:
    - `QuestionSetServiceTest.activateCreatesImmutableVersionSnapshot`.
  - Verification đã chạy:
    - `.\mvnw.cmd -q -DskipTests compile`
    - `.\mvnw.cmd -q "-Dtest=QuestionSetServiceTest" test`
    - `npm run build`
- 2026-07-03: Phase 12 bổ sung backend export chính thức cho question set.
  - Backend `QuestionSetService.export` hỗ trợ:
    - `csv`
    - `xlsx`
    - `docx`
    - `pdf`
  - Endpoint mới:
    - `GET /api/v1/question-sets/{setId}/export?format=csv|xlsx|docx|pdf`
  - Export ưu tiên `activeSnapshotItems`/`QuestionSetVersionItem` nếu set đã có active version; nếu chưa có snapshot thì dùng live items.
  - Audit log thêm action:
    - `QUESTION_SET_EXPORT`
  - Frontend:
    - `questionSetApi.exportQuestionSet(setId, format)`.
    - `QuestionSetListPage` tải export từ backend thay vì dựng CSV/JSON ở client.
    - Các format có sẵn trên UI: CSV, XLSX, DOCX, PDF.
  - Test mở rộng:
    - `QuestionSetServiceTest.exportUsesActiveSnapshotWhenAvailable`.
  - Verification đã chạy:
    - `.\mvnw.cmd -q -DskipTests compile`
    - `.\mvnw.cmd -q "-Dtest=QuestionSetServiceTest" test`
    - `npm run build`
  - Chưa làm trong Phase 12:
    - polish cảnh báo distribution/category sâu hơn nếu cần.
- 2026-07-03: Phase 13 bắt đầu hardening assignment/result.
  - Backend thêm DTO:
    - `ExamAssignmentResultsResponse`
    - `ExamAssignmentResultRowResponse`
  - Backend `ExamAssignmentService` thêm:
    - `results(Long assignmentId)` trả summary theo target user.
    - `exportResultsXlsx(Long assignmentId)` export Excel kết quả.
  - Endpoint mới:
    - `GET /api/v1/exam-assignments/{assignmentId}/results`
    - `GET /api/v1/exam-assignments/{assignmentId}/export-results`
  - Kết quả gồm:
    - target count, chưa làm, đang làm, submitted, graded, expired.
    - điểm trung bình, điểm cao nhất.
    - từng user: mã NV, họ tên, khoa/phòng, số lượt, trạng thái mới nhất, điểm mới nhất, điểm tốt nhất, pass/fail, thời gian.
  - Audit log thêm action:
    - `EXAM_ASSIGNMENT_RESULT_EXPORT`
  - Frontend:
    - `examAssignmentApi.getAssignmentResults`
    - `examAssignmentApi.exportAssignmentResults`
    - `ExamAssignmentListPage` khi xem chi tiết phân công hiển thị bảng kết quả và nút export Excel.
    - `ExamAssignmentFormPage` cho chọn thêm khoa/phòng nhận bài và gửi `departmentIds`.
  - Backend assignment target:
    - `CreateExamAssignmentRequest` nhận thêm `departmentIds`.
    - `ExamAssignmentService.create` validate khoa/phòng, bung `departmentIds` thành user đang hoạt động trong khoa/phòng và loại trùng với user chọn tay.
    - `UserRepository.findByDepartment_IdInAndIsDeletedFalse` hỗ trợ lấy target theo khoa/phòng.
  - Backend result visibility:
    - `ExamAssignment` có `resultVisibility`.
    - mặc định `SCORE_ONLY` để nhân viên chỉ thấy điểm, không lộ answer key.
    - `SCORE_AND_ANSWERS` cho phép nhân viên xem đáp án đúng và giải thích sau khi đã chấm.
    - admin vẫn xem được chi tiết đáp án trong màn kết quả/lượt làm bài.
  - Backend attempt runtime:
    - `ExamAttemptService` tự chuyển attempt `IN_PROGRESS` sang `EXPIRED` khi list/get nếu `expiresAt` đã quá hạn.
    - Save/submit vẫn chặn attempt đã quá thời gian như trước.
  - Frontend staff runtime:
    - `ExamTakeScreen` hiển thị countdown thời gian còn lại.
    - autosave đáp án 30 giây/lần khi bài đang mở.
    - hiển thị trạng thái/lần lưu gần nhất.
    - khóa chọn đáp án, lưu và nộp khi lượt làm đã hết giờ hoặc không còn `IN_PROGRESS`.
  - Test thêm:
    - `ExamAssignmentServiceTest.resultsAndExportIncludeTargetsWithoutAttempts`.
    - `ExamAssignmentServiceTest.createExpandsDepartmentTargetsAndDeduplicatesUsers`.
    - `ExamAttemptServiceTest.submitHidesAnswerKeyWhenAssignmentUsesScoreOnlyPolicy`.
    - `ExamAttemptServiceTest.getForUserExpiresAttemptWhenDeadlinePassed`.
  - Verification đã chạy:
    - `.\mvnw.cmd -q -DskipTests compile`
    - `.\mvnw.cmd -q "-Dtest=ExamAssignmentServiceTest,ExamAttemptServiceTest" test`
    - `.\mvnw.cmd -q "-Dtest=ExamAttemptServiceTest" test`
    - `npm run build`
- 2026-07-03: Phase 14 bắt đầu import/export nâng cao cho dữ liệu bệnh viện.
  - Backend thêm template download cho import ngân hàng câu hỏi:
    - `GET /api/v1/questions/import/template`
    - trả file `question-bank-import-template.xlsx`.
    - sheet `questions` có đủ header importer đang hỗ trợ và một dòng ví dụ tiếng Việt.
    - sheet `huong-dan` mô tả cột bắt buộc, đáp án đúng, trạng thái và độ khó.
  - Audit log thêm action:
    - `QUESTION_IMPORT_TEMPLATE_DOWNLOAD`
  - Frontend:
    - `questionBankApi.downloadImportTemplate`.
    - modal `Import ngân hàng câu hỏi` có nút `Tải file mẫu`.
  - Test thêm:
    - `QuestionBankImportExportServiceTest.importTemplateContainsHeadersSampleAndGuide`.
  - Verification đã chạy:
    - `.\mvnw.cmd -q -DskipTests compile`
    - `.\mvnw.cmd -q "-Dtest=QuestionBankImportExportServiceTest" test`
    - `npm run build`
- 2026-07-03: Phase 14 bổ sung lịch sử import cho ngân hàng câu hỏi.
  - Backend thêm entity/repository:
    - `EvaluationImportJob`
    - `EvaluationImportJobRow`
    - `EvaluationImportStatus`
    - `EvaluationImportJobRepository`
    - `EvaluationImportJobRowRepository`
  - Backend thêm DTO/service/controller:
    - `EvaluationImportJobResponse`
    - `EvaluationImportJobRowResponse`
    - `EvaluationImportHistoryService`
    - `EvaluationImportController`
  - API mới:
    - `GET /api/v1/evaluation-imports`
    - `GET /api/v1/evaluation-imports/{importJobId}`
  - Tích hợp question bank import:
    - preview tạo job trạng thái `PREVIEWED`, lưu file metadata, counts và row errors.
    - commit nhận `importJobId`, cập nhật job sang `COMMITTED`, lưu created question ids và lỗi từng dòng.
    - `QuestionBankImportPreviewResponse` và `QuestionBankImportCommitResponse` trả thêm `importJobId`.
  - Frontend:
    - `evaluationImportApi.js`.
    - route `/admin/evaluation/imports`.
    - sidebar `Lịch sử import`.
    - page `EvaluationImportHistoryPage` list/filter imports và xem chi tiết từng dòng import.
    - modal import ngân hàng câu hỏi gửi `importJobId` khi commit.
  - Test thêm:
    - `EvaluationImportHistoryServiceTest`.
  - Verification đã chạy:
    - `.\mvnw.cmd -q -DskipTests compile`
    - `.\mvnw.cmd -q "-Dtest=QuestionBankImportExportServiceTest,EvaluationImportHistoryServiceTest" test`
    - `npm run build`
- 2026-07-03: Phase 14 bổ sung chế độ xử lý trùng khi import ngân hàng câu hỏi.
  - Backend `QuestionBankImportCommitRequest` nhận thêm `duplicateHandlingMode`:
    - `BLOCK`: mặc định, dòng trùng mạnh bị lỗi.
    - `SKIP_DUPLICATES`: bỏ qua dòng trùng mạnh, tính vào `skippedCount`.
    - `IMPORT_DUPLICATES_AS_DRAFT`: lưu dòng trùng mạnh thành `DRAFT` để review sau.
  - Backend response/history bổ sung:
    - `QuestionBankImportCommitResponse.skippedCount`.
    - `QuestionBankImportRowResultResponse.skipped`.
    - `EvaluationImportJob.skippedRows`.
    - `EvaluationImportJobRow.skipped`.
  - `QuestionBankService` thêm đường import draft cho duplicate mạnh, vẫn không refresh embedding vì lưu nháp.
  - Frontend:
    - modal `Import ngân hàng câu hỏi` có select `Khi gặp câu hỏi trùng mạnh`.
    - summary import hiển thị số dòng bỏ qua.
    - trang `Lịch sử import` hiển thị `Bỏ qua` theo job và từng dòng.
  - Test thêm:
    - `QuestionBankImportExportServiceTest.commitCanSkipDuplicateRows`.
  - Verification đã chạy:
    - `.\mvnw.cmd -q -DskipTests compile`
    - `.\mvnw.cmd -q "-Dtest=QuestionBankImportExportServiceTest,EvaluationImportHistoryServiceTest" test`
    - `npm run build`
- 2026-07-03: Phase 14 bổ sung tải file lỗi import.
  - Backend:
    - `EvaluationImportHistoryService.exportErrorFile(importJobId)` xuất XLSX các dòng lỗi/bị bỏ qua.
    - `GET /api/v1/evaluation-imports/{importJobId}/error-file`.
  - File lỗi gồm:
    - `importJobId`
    - `rowNumber`
    - `stem`
    - `status`
    - `result`
    - `errors`
  - Frontend:
    - `evaluationImportApi.exportErrorFile`.
    - trang `Lịch sử import` có nút `Tải file lỗi` trong panel chi tiết import.
  - Test thêm:
    - `EvaluationImportHistoryServiceTest.exportErrorFileContainsInvalidRows`.
  - Verification đã chạy:
    - `.\mvnw.cmd -q -DskipTests compile`
    - `.\mvnw.cmd -q "-Dtest=EvaluationImportHistoryServiceTest" test`
    - `npm run build`
- 2026-07-04: Phase 14 bổ sung mapping cột động cho import ngân hàng câu hỏi.
  - Backend preview import:
    - `POST /api/v1/questions/import/preview` nhận thêm multipart field optional `columnMapping` dạng JSON.
    - Nếu không gửi mapping, parser vẫn dùng alias header cũ.
    - Nếu gửi mapping, backend ưu tiên mapping canonical field -> source header.
    - `QuestionBankImportPreviewResponse` trả thêm `sourceHeaders` để UI dựng dropdown mapping.
  - Frontend modal import:
    - preview lần đầu để lấy header nguồn.
    - hiện vùng `Mapping cột từ file nguồn`.
    - admin chọn cột cho `Câu hỏi`, `Phương án A-D`, `Đáp án đúng`, `Giải thích`, `Chủ đề`, `Độ khó`, `Ngôn ngữ`, `Nguồn`, `Trạng thái`.
    - bấm `Preview` lại để validate theo mapping đã chọn trước khi commit.
  - Test thêm:
    - `QuestionBankImportExportServiceTest.previewCsvUsesCustomColumnMapping`.
  - Verification đã chạy:
    - `.\mvnw.cmd -q -DskipTests compile`
    - `.\mvnw.cmd -q "-Dtest=QuestionBankImportExportServiceTest,EvaluationImportHistoryServiceTest" test`
    - `npm run build`
- 2026-07-04: Phase 14 bổ sung import DOCX theo mẫu cố định cho ngân hàng câu hỏi.
  - Backend import nhận thêm file `.docx`.
  - Parser nhận nhãn tiếng Việt: `Câu hỏi`, `A`, `B`, `C`, `D`, `Đáp án`, `Giải thích`, `Chủ đề`, `Độ khó`, `Ngôn ngữ`, `Nguồn`, `Trạng thái`.
  - Parser normalize dấu tiếng Việt để đọc được nhãn như `Đáp án`, `Chủ đề`.
  - Frontend modal import cho phép chọn `.docx`.
  - Test thêm:
    - `QuestionBankImportExportServiceTest.previewDocxTemplateParsesQuestions`.
  - Verification đã chạy:
    - `.\mvnw.cmd -q "-Dtest=QuestionBankImportExportServiceTest" test`
- 2026-07-04: Phase R2 harden detail/edit ngân hàng câu hỏi.
  - Backend test xác nhận `QuestionBankService.get` trả đủ dữ liệu edit: stem, A-D, đáp án đúng, giải thích, nguồn, status text và impact warning.
  - Frontend `QuestionFormPage`:
    - khi edit fail/403/404 không còn hiện form rỗng như câu hỏi mới.
    - hiển thị banner lỗi rõ và khóa thao tác lưu.
    - thêm field `Nguồn câu hỏi`.
    - payload update giữ `sourceDocument` để câu import/tạo từ tài liệu không bị mất nguồn khi admin sửa.
  - Verification đã chạy:
    - `.\mvnw.cmd -q "-Dtest=QuestionBankServiceTest" test`
    - `npm run build`
- 2026-07-04: Phase R1 giảm câu hỏi sinh ra quá chung chung từ tài liệu.
  - DeepSeek prompt yêu cầu stem tự đứng độc lập, không phụ thuộc section path/chunk/tài liệu gốc.
  - Cấm trực tiếp các stem mở đầu kiểu `Theo tài liệu`, `Dựa vào tài liệu`, `Trong tài liệu`, `Theo nội dung trên` hoặc hỏi `nhận định nào phù hợp với mục...`.
  - Parser DeepSeek bỏ candidate nếu stem vẫn là dạng generic document-reference.
  - Mock generator đổi stem fallback từ `Theo tài liệu...` sang câu hỏi tự đứng độc lập theo topic cuối của section path.
  - Test thêm:
    - `DeepSeekDocumentQuestionGeneratorTest.dropsGenericDocumentReferenceQuestionStems`.
    - `MockDocumentQuestionGeneratorTest.generateUsesStandaloneQuestionStem`.
  - Verification đã chạy:
    - `.\mvnw.cmd -q "-Dtest=DeepSeekDocumentQuestionGeneratorTest,MockDocumentQuestionGeneratorTest" test`
    - `.\mvnw.cmd -q -DskipTests compile`
- 2026-07-04: Phase R1 bổ sung đường quay lại phiên tạo câu hỏi sau khi rời trang.
  - Backend `DocumentResponse` trả thêm:
    - `questionJobCount`.
    - `latestQuestionJob` summary gồm id, status, provider/model, candidate count, chunk progress và thời gian.
  - Backend document list/detail dùng `DocumentQuestionJobRepository.countByDocument` và `findFirstByDocumentOrderByCreatedAtDesc`.
  - Frontend danh sách tài liệu thêm cột `Phiên gần nhất`, hiển thị trạng thái/candidate count và cho mở thẳng màn review job.
  - Tab `Phiên tạo câu hỏi` trong chi tiết tài liệu vẫn là nơi xem toàn bộ lịch sử job theo document.
  - Test thêm:
    - `DocumentQuestionMapperTest.documentResponseIncludesLatestQuestionJobSummary`.
  - Verification đã chạy:
    - `.\mvnw.cmd -q "-Dtest=DocumentQuestionMapperTest" test`
    - `.\mvnw.cmd -q -DskipTests compile`
    - `npm run build`
- 2026-07-04: Phase R1 siết save candidate vào ngân hàng câu hỏi.
  - Backend `CandidateReviewService.saveAsQuestion` vẫn chỉ cho lưu candidate `APPROVED`, có source excerpt và không trùng mạnh.
  - Bổ sung guard không cho lưu stem generic kiểu `Theo tài liệu...`, `Dựa vào tài liệu...`, hoặc `phù hợp với nội dung trong mục...` vào DB question bank.
  - Frontend review candidate hiển thị box `Đã lưu vào ngân hàng` kèm mã câu hỏi sau khi save.
  - Admin có nút `Mở câu hỏi` để vào form câu hỏi đã lưu trong ngân hàng.
  - Test thêm/cập nhật:
    - `CandidateReviewServiceTest.saveAsQuestionRejectsGenericDocumentReferenceStem`.
  - Verification đã chạy:
    - `.\mvnw.cmd -q "-Dtest=CandidateReviewServiceTest" test`
    - `.\mvnw.cmd -q -DskipTests compile`
    - `npm run build`
- 2026-07-04: Phase R3 khóa chỉnh sửa trực tiếp bộ câu hỏi đang hoạt động.
  - Backend `QuestionSetService.update` từ chối `PUT` trực tiếp khi question set đang `ACTIVE`.
  - Thông báo lỗi yêu cầu tạo bản nháp chỉnh sửa rồi kích hoạt thành version mới.
  - Frontend `QuestionSetFormPage` chuyển active set sang chế độ read-only:
    - khóa metadata, status, preview nhanh, add/remove/reorder câu hỏi và nút save.
    - hiển thị banner `Bộ câu hỏi đang hoạt động đã khóa snapshot`.
    - có nút `Tạo bản nháp chỉnh sửa` dùng API duplicate hiện có và mở bản nháp mới.
  - Test thêm:
    - `QuestionSetServiceTest.updateRejectsActiveSetBecauseSnapshotIsLocked`.
  - Verification đã chạy:
    - `.\mvnw.cmd -q "-Dtest=QuestionSetServiceTest" test`
    - `.\mvnw.cmd -q -DskipTests compile`
    - `npm run build`
- 2026-07-04: Phase R3 duplicate active set theo snapshot/version.
  - Backend `QuestionSetService.duplicate` ưu tiên active version snapshot khi source set có version.
  - Bản nháp chỉnh sửa tạo từ active set lấy `sourceQuestionId`, position, points và required theo `QuestionSetVersionItem`.
  - Nếu dữ liệu cũ có version rỗng bất thường, duplicate fallback về live items để tránh tạo bản rỗng.
  - Test thêm:
    - `QuestionSetServiceTest.duplicateActiveSetUsesActiveVersionSnapshotInsteadOfLiveItems`.
  - Verification đã chạy:
    - `.\mvnw.cmd -q "-Dtest=QuestionSetServiceTest" test`
    - `.\mvnw.cmd -q -DskipTests compile`

## Khoảng trống chính

Các phần lõi Phase 1-12 đã có MVP. Các khoảng trống còn lại là phần vận hành, mở rộng import/export và hoàn thiện trải nghiệm admin:

- Audit log đã có MVP nhưng chưa có before/after diff và pagination/filter server-side đầy đủ.
- RBAC granular đã có MVP ở backend/sidebar, nhưng chưa có UI quản trị role-permission hoàn chỉnh và chưa hide/disable mọi action button trong từng page.
- Bộ câu hỏi đã có duplicate MVP nhưng còn thiếu versioning rõ ràng, import/export chính thức và cảnh báo tác động khi sửa/archive câu đang nằm trong active set.
- Bộ đề đã có duplicate/export TXT MVP nhưng còn thiếu export PDF/Word/Excel, shuffle option ổn định theo snapshot và policy xem đáp án sâu hơn.
- Assignment/attempt/scoring đã chạy end-to-end, đã có target theo user/khoa/phòng, export kết quả, policy xem kết quả, countdown/autosave và expire-on-read; còn thiếu target nhóm nếu cần và filter/pagination nâng cao.
- Dashboard đã có MVP nhưng còn thiếu filter theo thời gian/config/paper/assignment/department, drilldown, discrimination index và export báo cáo.
- Import/export ngân hàng câu hỏi đã có Excel MVP, template download, import job history, duplicate handling mode, tải file lỗi, mapping column động và import DOCX theo mẫu cố định; còn thiếu export bộ câu hỏi/bộ đề nâng cao và hoàn thiện print/export UI.
- OCR production cho PDF scan chưa có; hiện vẫn dừng ở `OCR_REQUIRED`.
- Prompt/model governance chưa có UI quản lý prompt version, active model, benchmark dataset và cost report theo job.
- Performance production chưa hoàn chỉnh: server-side pagination, index/migration rõ, seed/load test dữ liệu lớn và backup/restore.

## Thuật ngữ chốt

- Ngân hàng câu hỏi: nơi lưu từng câu hỏi chuẩn, đã duyệt, có đáp án, giải thích, metadata và embedding.
- Bộ câu hỏi: collection câu hỏi có thứ tự hoặc blueprint, dùng làm nguồn ổn định cho đề.
- Cấu hình đề kiểm tra: rule sinh đề, gồm thời gian, điểm đạt, số câu, phân bổ độ khó/chủ đề, retake policy.
- Bộ đề/đề kiểm tra: một đề cụ thể đã sinh từ bộ câu hỏi/cấu hình, có snapshot câu hỏi cố định.
- Assignment: việc giao một đề/đợt kiểm tra cho user, khoa/phòng hoặc nhóm đối tượng.
- Attempt: một lượt làm bài của người dùng, có câu trả lời, điểm, trạng thái và thời gian.

## Nguyên tắc UI

- Toàn bộ text hiển thị bằng tiếng Việt.
- Không show enum thô; dùng nhãn như `Sẵn sàng`, `Cần OCR`, `Đã duyệt`, `Đang hoạt động`, `Đã lưu`.
- Layout bám admin hiện tại: `AdminSidebar`, `AdminHeader`, table/filter/action button của evaluation pages.
- Không tạo landing page. Mỗi route phải là màn hình thao tác được.
- Các màn hình review phải luôn thấy nội dung câu hỏi, A-D, đáp án đúng, giải thích, độ khó, cảnh báo, duplicate info và nguồn.
- Candidate chỉ được lưu vào ngân hàng sau khi đã duyệt.
- Câu hỏi trong bộ đề/attempt phải dùng snapshot, không đọc trực tiếp live question nếu đề đã publish.

## Thứ tự ưu tiên khuyến nghị

1. Phase 12 tiếp: versioning question set, shuffle option, export PDF/DOCX/XLSX và impact warning.
2. Phase 13: hoàn thiện assignment/attempt/report để dùng được trong vận hành thật.
3. Phase 14: import/export nâng cao cho dữ liệu bệnh viện và báo cáo.
4. Phase 15: OCR/prompt/model governance cho luồng tạo câu hỏi từ tài liệu.
5. Phase 16: analytics nâng cao và quality review loop.
6. Phase 17: performance/migration/backup.
7. Phase 18: UAT, rollout và tài liệu vận hành.

## Phase 0 - Audit và đóng contract

### Mục tiêu

Chốt hiện trạng kỹ thuật trước khi sửa tiếp, tránh duplicate entity/API và tránh nối sai luồng.

### Backend

- Liệt kê các bảng/entity hiện có trong module question generation.
- Chốt các API đang có:
  - `/api/v1/documents`
  - `/api/v1/document-question-jobs`
  - `/api/v1/document-question-candidates`
  - `/api/v1/questions`
  - `/api/v1/question-sets`
  - paraphrase endpoints
  - model runtime endpoints
- Xác nhận `questions` là ngân hàng câu hỏi canonical.
- Xác nhận `question_sets` là collection câu hỏi, không phải đề kiểm tra.

### Frontend

- Rà toàn bộ route `/admin/evaluation/*`.
- Đánh dấu các page từng dùng `localStorage` để chuyển sang API thật:
  - `QuestionFormPage`: đã chuyển ở Phase 1.
  - `QuestionCategoryListPage`: đã chuyển ở Phase 2.
  - `ClassificationRuleListPage`: đã chuyển ở Phase 2.
  - `ClassificationRuleFormPage`: đã chuyển ở Phase 2.
  - `TestConfigPage`: đã chuyển ở Phase 3.
- Kiểm tra sidebar label và route có nhất quán.

### Deliverables

- Update file roadmap này sau audit nếu có khác biệt.
- Danh sách endpoint cần thêm.
- Danh sách migration cần thêm.

### Acceptance criteria

- Không còn câu hỏi "phần này là bộ câu hỏi hay bộ đề".
- Có thứ tự implement rõ cho backend trước, frontend sau.

## Phase 1 - Ngân hàng câu hỏi production CRUD

### Mục tiêu

Admin có thể tạo, sửa, archive, xem chi tiết câu hỏi thật trong database. Không còn lưu câu hỏi thủ công vào `localStorage`.

### Backend

- Thêm request DTO:
  - `CreateQuestionRequest`
  - `UpdateQuestionRequest`
  - `ArchiveQuestionRequest` nếu cần lý do archive
- Mở rộng `QuestionBankController`:
  - `POST /api/v1/questions`
  - `PUT /api/v1/questions/{questionId}`
  - `DELETE /api/v1/questions/{questionId}` hoặc `POST /archive`
  - `POST /api/v1/questions/{questionId}/approve`
  - `POST /api/v1/questions/{questionId}/deactivate`
- Validate:
  - stem không rỗng
  - đủ 4 đáp án A-D trong MVP
  - correctAnswer thuộc A-D
  - explanation nên có, ít nhất cảnh báo nếu thiếu
  - difficulty hợp lệ
  - topic/category hợp lệ nếu Phase 2 đã có category backend
- Khi create/update:
  - chạy duplicate check E5/lexical
  - nếu duplicate mạnh thì block hoặc trả warning tùy mode
  - tạo lại E5 embedding nếu stem thay đổi
  - ghi `updatedBy`, `reviewedBy`, `reviewedAt` nếu có
- Không hard delete câu hỏi đã nằm trong question set snapshot hoặc exam paper snapshot.

### Frontend

- Cập nhật `questionBankApi.js` với create/update/archive/approve/deactivate.
- Sửa `QuestionFormPage`:
  - bỏ localStorage làm nguồn chính
  - form create gọi `POST /questions`
  - form edit gọi `PUT /questions/{id}`
  - hiển thị duplicate warning trả từ backend
  - save xong quay lại ngân hàng và reload data
- Sửa `QuestionBankListPage`:
  - filter server-side hoặc ít nhất query API theo status/q
  - action archive/deactivate
  - detail drawer/modal hiển thị đủ stem, A-D, đáp án, explanation, topic, difficulty, source, createdAt/updatedAt
- Với câu hỏi sinh từ document/paraphrase:
  - hiển thị source document/job/candidate nếu có
  - cho phép sửa sau khi lưu, nhưng phải re-embed và audit.

### Tests

- Unit test `QuestionBankService` create/update/archive.
- Test duplicate block ở create/update.
- Test update tạo lại embedding khi stem đổi.
- Frontend manual:
  - tạo câu hỏi mới
  - sửa câu hỏi backend
  - archive câu hỏi
  - mở detail câu hỏi không bị rỗng.

### Acceptance criteria

- `QuestionFormPage` không còn báo "Chưa có API cập nhật câu hỏi backend".
- Câu hỏi tạo thủ công nằm trong DB và xuất hiện ở question bank/question set picker.
- Câu hỏi bị archive không được chọn vào question set mới.

## Phase 2 - Danh mục câu hỏi và quy tắc phân loại backend

### Mục tiêu

Danh mục/topic và rule phân loại trở thành dữ liệu backend, dùng chung cho tạo câu hỏi, ngân hàng và bộ câu hỏi.

### Backend

- Thêm entity:
  - `QuestionCategory`
  - `QuestionClassificationRule`
- `QuestionCategory` fields:
  - id
  - code
  - name
  - description
  - parentId nếu cần cây danh mục
  - status
  - sortOrder
- `QuestionClassificationRule` fields:
  - id
  - name
  - categoryId
  - keywords
  - sourcePattern
  - priority
  - enabled
  - createdBy/updatedBy
- API:
  - `GET/POST/PUT/DELETE /api/v1/question-categories`
  - `GET/POST/PUT/DELETE /api/v1/question-classification-rules`
  - `POST /api/v1/question-classification-rules/test`
- Service phân loại:
  - input: stem, explanation, sourceDocument, sectionTitle, sourceExcerpt
  - output: category/topic, matchedRule, confidence
  - rule keyword trước, fallback source/section, sau đó fallback `Chưa phân loại`.
- Tích hợp:
  - khi save candidate vào ngân hàng
  - khi tạo/sửa câu hỏi thủ công
  - khi auto-build question set theo category.

### Frontend

- Thêm API module:
  - `questionCategoryApi.js`
  - `classificationRuleApi.js`
- Chuyển:
  - `QuestionCategoryListPage` khỏi local state/localStorage.
  - `ClassificationRuleListPage` và `ClassificationRuleFormPage` khỏi localStorage.
- UI rule test:
  - nhập đoạn stem/source excerpt
  - bấm `Kiểm tra`
  - thấy category dự đoán, rule match, confidence.
- Form câu hỏi dùng category từ backend.
- Filter ngân hàng/bộ câu hỏi dùng category backend.

### Tests

- Test category CRUD.
- Test rule priority.
- Test disabled rule không match.
- Test candidate save tự gán category.
- Manual UI:
  - tạo category
  - tạo rule
  - test rule
  - tạo câu hỏi thấy category mới.

### Acceptance criteria

- Không còn `carehub_classification_rules` trong localStorage.
- Danh mục/rule refresh browser vẫn còn.
- Câu hỏi mới có category nhất quán.

## Phase 3 - Cấu hình đề kiểm tra backend

### Mục tiêu

`Cấu hình đề kiểm tra` trở thành dữ liệu backend thật và là đầu vào chính để sinh bộ đề.

### Backend

- Thêm entity:
  - `ExamConfig`
  - `ExamConfigDistribution`
- `ExamConfig` fields:
  - id
  - name
  - description
  - questionSetId nullable
  - totalQuestions
  - timeLimitMinutes
  - passingScore
  - maxRetakes
  - shuffleQuestions
  - shuffleOptions
  - status: `DRAFT`, `ACTIVE`, `INACTIVE`, `ARCHIVED`
  - validFrom/validTo nếu cần
  - createdBy/updatedBy/reviewedBy
- `ExamConfigDistribution` fields:
  - id
  - examConfigId
  - categoryId nullable
  - difficulty
  - questionCount
  - required
- API:
  - `GET /api/v1/exam-configs`
  - `GET /api/v1/exam-configs/{id}`
  - `POST /api/v1/exam-configs`
  - `PUT /api/v1/exam-configs/{id}`
  - `POST /api/v1/exam-configs/{id}/activate`
  - `POST /api/v1/exam-configs/{id}/deactivate`
  - `DELETE /api/v1/exam-configs/{id}`
  - `POST /api/v1/exam-configs/{id}/preview`
- Validate:
  - tổng distribution phải bằng totalQuestions nếu dùng distribution.
  - active config phải có question set active hoặc blueprint đủ câu.
  - passingScore trong 0..100.
  - timeLimitMinutes > 0.

### Frontend

- Thêm `examConfigApi.js`.
- Sửa `TestConfigPage`:
  - bỏ `carehub_test_config` localStorage làm nguồn chính
  - list configs hoặc form detail tùy UI hiện tại
  - select active question set từ backend
  - distribution chọn category backend và difficulty
  - preview số câu match trước khi save/activate
- UI nhãn:
  - `Nháp`
  - `Đang hoạt động`
  - `Tạm dừng`
  - `Đã lưu trữ`
- Khi chọn question set:
  - hiển thị số câu, độ khó, category coverage.
  - cảnh báo nếu config yêu cầu nhiều câu hơn set có.

### Tests

- Unit test validate distribution.
- Unit test activate config khi thiếu câu phải fail.
- Frontend manual:
  - tạo config mới
  - chọn question set active
  - preview đạt/không đạt
  - activate config
  - reload browser vẫn còn.

### Acceptance criteria

- `TestConfigPage` không còn phụ thuộc localStorage.
- Config active dùng được làm input sinh bộ đề.

## Phase 4 - Bộ đề/đề kiểm tra thật

### Mục tiêu

Admin có thể sinh một hoặc nhiều đề cụ thể từ `ExamConfig` và `QuestionSet`, có snapshot cố định để dùng cho làm bài/chấm điểm.

### Backend

- Thêm entity:
  - `ExamPaper`
  - `ExamPaperQuestion`
  - `ExamPaperQuestionSnapshot`
- `ExamPaper` fields:
  - id
  - code
  - name
  - examConfigId
  - questionSetId
  - version
  - randomSeed
  - status: `DRAFT`, `PUBLISHED`, `ARCHIVED`
  - totalQuestions
  - timeLimitMinutes
  - passingScore
  - createdBy/publishedBy/publishedAt
- `ExamPaperQuestion` fields:
  - id
  - examPaperId
  - questionId
  - position
  - points
  - optionOrderJson nếu shuffle options
- Snapshot lưu:
  - stem
  - optionA-D theo thứ tự đã dùng trong đề
  - correctAnswer
  - explanation
  - difficulty
  - topic/category
  - source metadata cần audit
- API:
  - `GET /api/v1/exam-papers`
  - `GET /api/v1/exam-papers/{id}`
  - `POST /api/v1/exam-papers/generate`
  - `POST /api/v1/exam-papers/{id}/publish`
  - `POST /api/v1/exam-papers/{id}/archive`
  - `POST /api/v1/exam-papers/{id}/duplicate`
  - `GET /api/v1/exam-papers/{id}/export`
- Generate strategy:
  - input: examConfigId, variantCount, seed, optional name prefix.
  - lấy câu từ active question set snapshot nếu có.
  - áp distribution category/difficulty.
  - tránh duplicate stem/source trong cùng đề nếu có thể.
  - tạo snapshot ngay khi generate.

### Frontend

- Thêm route:
  - `/admin/evaluation/exam-papers`
  - `/admin/evaluation/exam-papers/new`
  - `/admin/evaluation/exam-papers/:id`
- Thêm sidebar item:
  - `Bộ đề kiểm tra`
- Màn hình list:
  - filter status/config/question set
  - columns: mã đề, tên đề, config, số câu, trạng thái, ngày tạo, người tạo
  - actions: xem, publish, duplicate, archive, export/print
- Màn hình generate:
  - chọn config active
  - chọn số phiên bản đề
  - random seed optional
  - preview distribution
  - generate
- Màn hình detail:
  - metadata đề
  - danh sách câu hỏi theo thứ tự
  - toggle ẩn/hiện đáp án đúng
  - print/export
  - warning nếu đề draft có câu từ question set không còn active.

### Tests

- Test generate fixed seed trả cùng thứ tự.
- Test publish khóa snapshot.
- Test archive không xóa snapshot.
- Test không sinh đề khi question set không đủ câu.
- Manual:
  - tạo config active
  - generate 2 mã đề
  - publish 1 mã đề
  - sửa câu trong ngân hàng sau publish, đề publish vẫn giữ snapshot cũ.

### Acceptance criteria

- Admin tạo được đề cụ thể từ question set/config.
- Đề publish không thay đổi khi ngân hàng câu hỏi thay đổi.

## Phase 5 - Assignment, attempt và scoring

### Mục tiêu

Đề kiểm tra có thể giao cho người dùng/nhóm và lưu kết quả làm bài.

### Backend

- Thêm entity:
  - `ExamAssignment`
  - `ExamAssignmentTarget`
  - `ExamAttempt`
  - `ExamAttemptAnswer`
- Assignment target:
  - userId
  - departmentId
  - role/group nếu hệ thống có
- Attempt fields:
  - examPaperId
  - userId
  - attemptNumber
  - status: `NOT_STARTED`, `IN_PROGRESS`, `SUBMITTED`, `GRADED`, `EXPIRED`, `CANCELLED`
  - startedAt/submittedAt/expiresAt
  - score
  - passed
  - timeSpentSeconds
- API admin:
  - `POST /api/v1/exam-assignments`
  - `GET /api/v1/exam-assignments`
  - `GET /api/v1/exam-assignments/{id}`
  - `POST /api/v1/exam-assignments/{id}/close`
  - `GET /api/v1/exam-attempts`
  - `GET /api/v1/exam-attempts/{id}`
- API làm bài nếu scope bao gồm user runtime:
  - `GET /api/v1/me/exam-assignments`
  - `POST /api/v1/exam-attempts`
  - `GET /api/v1/exam-attempts/{id}/questions`
  - `PUT /api/v1/exam-attempts/{id}/answers`
  - `POST /api/v1/exam-attempts/{id}/submit`
- Scoring:
  - single choice trước.
  - lưu answer snapshot.
  - tính điểm server-side.
  - không trả correctAnswer cho user trước khi submit.

### Frontend admin

- Màn hình assignment:
  - chọn exam paper published
  - chọn target
  - deadline
  - max attempts override nếu cần
  - publish assignment
- Màn hình attempts:
  - filter theo đề/user/phòng ban/status/pass
  - xem chi tiết bài làm
  - export kết quả.

### Frontend user runtime

- Chỉ implement nếu phase này mở rộng ngoài admin.
- Màn hình danh sách bài được giao.
- Màn hình làm bài:
  - timer
  - navigation câu
  - autosave
  - submit confirm
  - result summary sau submit theo policy.

### Tests

- Test không tạo attempt quá maxRetakes.
- Test submit tính điểm đúng.
- Test expired attempt không cho sửa answer.
- Test user không xem được đáp án trước submit.

### Acceptance criteria

- Admin giao được đề.
- User làm bài và có kết quả.
- Admin xem được attempt/result.

## Phase 6 - Review/hardening cho tạo câu hỏi từ tài liệu

### Mục tiêu

Đưa document generation từ MVP lên mức vận hành ổn định hơn.

### Backend

- Job controls:
  - cancel job
  - retry failed chunks
  - retry candidate validation
  - batch approve/reject/save
- OCR:
  - giữ `OCR_REQUIRED` như hiện tại nếu chưa có engine.
  - tích hợp OCR production sau khi chọn engine.
  - lưu OCR confidence/page warnings.
- Prompt/version:
  - lưu prompt version chi tiết.
  - cho phép config prompt version active.
  - giữ audit mỗi candidate được tạo bởi prompt nào.
- Benchmark:
  - lưu latency per stage.
  - lưu token/cost nếu provider trả usage.
  - dashboard job health.

### Frontend

- Review job:
  - batch actions.
  - filter candidate theo warning/duplicate/status/chunk.
  - retry failed chunk từ UI.
  - cancel job đang chạy.
  - export review report.
- Document detail:
  - hiển thị OCR confidence nếu có.
  - hiển thị chunk bị skip và lý do.

### Tests

- Test retry chỉ chạy failed chunks.
- Test cancel job không sinh thêm candidate.
- Manual:
  - upload PDF text
  - upload PDF scan
  - tạo job
  - cancel/retry
  - batch approve/save.

### Acceptance criteria

- Reviewer không bị mất việc nếu thoát trang.
- Job lỗi một phần có thể xử lý tiếp từ UI.

## Phase 7 - Paraphrase/VietQuill vận hành trong ngân hàng câu hỏi

### Mục tiêu

Paraphrase trở thành công cụ tạo biến thể câu hỏi có kiểm soát, không tạo rác vào ngân hàng.

### Backend

- Job list theo source question:
  - đã có hướng trong plan VietQuill, cần đảm bảo API dùng được từ UI.
- Thêm batch paraphrase:
  - chọn nhiều câu hỏi trong bank
  - tạo job paraphrase theo từng câu hoặc batch job cha.
- Validation:
  - giữ protected terms.
  - giữ số liệu.
  - stem và option không đổi nghĩa quá mạnh.
  - E5 similarity với câu gốc trong ngưỡng.
  - duplicate với bank không vượt ngưỡng strong.
- Runtime:
  - model health endpoint rõ provider/model path.
  - cảnh báo khi mock provider đang bật.

### Frontend

- Ngân hàng câu hỏi:
  - action `Diễn đạt lại` cho từng câu.
  - batch action `Tạo biến thể`.
  - link tới lịch sử paraphrase.
- Review paraphrase:
  - so sánh câu gốc và candidate cạnh nhau.
  - highlight thay đổi stem/options.
  - hiển thị E5 source similarity và duplicate score.
  - chỉ save candidate đã approved.

### Tests

- Test paraphrase cả stem và A-D.
- Test reject nếu thiếu option.
- Test save-as-question tạo embedding.
- Manual:
  - tạo paraphrase job
  - edit candidate
  - approve
  - save vào bank
  - candidate mới xuất hiện ở question set picker.

### Acceptance criteria

- Không lưu paraphrase chưa duyệt.
- Không tạo duplicate mạnh vào bank.

## Phase 8 - Import/export dữ liệu câu hỏi, bộ câu hỏi, bộ đề

### Mục tiêu

Admin import được dữ liệu bệnh viện hiện có và export được tài liệu phục vụ kiểm tra/audit.

### Backend

- Import question bank:
  - Excel template trước.
  - Word/DOCX theo format cố định sau.
  - validate từng dòng/câu.
  - preview import trước khi commit.
- Import question set:
  - danh sách question IDs.
  - hoặc file có thứ tự câu hỏi.
- Export:
  - question bank Excel.
  - question set Excel/CSV/print.
  - exam paper PDF/Word/Excel.
  - result report Excel.
- Import job entity:
  - `ImportJob`
  - `ImportJobRow`
  - status/warnings/errors.

### Frontend

- Màn hình import:
  - upload file
  - mapping columns
  - preview errors
  - commit valid rows
- Màn hình export:
  - chọn format
  - chọn ẩn/hiện đáp án
  - chọn include explanation/source.

### Tests

- Test Excel import valid/invalid.
- Test duplicate detect trong import.
- Test export giữ tiếng Việt có dấu.
- Manual:
  - import file câu hỏi bệnh viện.
  - preview lỗi.
  - commit.
  - tạo question set từ câu import.

### Acceptance criteria

- Import không commit dữ liệu lỗi im lặng.
- File export mở được và đủ nội dung tiếng Việt.

## Phase 9 - Analytics và báo cáo chất lượng

### Mục tiêu

Admin đánh giá được chất lượng câu hỏi, chất lượng đề và kết quả kiểm tra.

### Backend

- Aggregate metrics:
  - số câu theo category/difficulty/status/source.
  - duplicate risk.
  - tỷ lệ đúng/sai từng câu.
  - discrimination index nếu đủ dữ liệu.
  - average score theo đề/assignment/department.
- API:
  - `/api/v1/evaluation-dashboard/question-bank-summary`
  - `/api/v1/evaluation-dashboard/exam-results-summary`
  - `/api/v1/evaluation-dashboard/question-item-analysis`

### Frontend

- Dashboard evaluation:
  - health ngân hàng câu hỏi.
  - question generation throughput.
  - câu hỏi có warning cao.
  - kết quả kiểm tra theo đề/phòng ban.
- Drilldown:
  - click vào câu hỏi để xem attempts sai nhiều.
  - click vào đề để xem distribution.

### Tests

- Test aggregate score.
- Test filters theo date/config/paper.
- Manual:
  - tạo attempts mẫu.
  - dashboard hiển thị đúng số liệu.

### Acceptance criteria

- Admin biết câu nào cần sửa/loại bỏ.
- Admin export được báo cáo kết quả.

## Phase 10 - Audit log cho khu vực đánh giá

### Mục tiêu

Ghi lại các thao tác nhạy cảm trong admin/evaluation trước khi siết quyền granular. Audit phải đủ để trả lời: ai làm gì, lúc nào, với entity nào, trước/sau tác động ra sao.

### Backend

- Thêm entity `EvaluationAuditLog` hoặc dùng audit chung nếu hệ thống đã có:
  - `id`
  - `action`
  - `entityType`
  - `entityId`
  - `actor`
  - `summary`
  - `detailJson`
  - `createdAt`
- API:
  - `GET /api/v1/evaluation-audit-logs?q=&action=&entityType=&actor=&from=&to=&page=&size=`
  - `GET /api/v1/evaluation-audit-logs/{id}`
- Ghi audit cho các thao tác:
  - question create/update/approve/deactivate/archive/import/export.
  - document candidate approve/reject/save-as-question/batch action.
  - paraphrase candidate approve/reject/save-as-question/batch action.
  - question set create/update/activate/deactivate/archive/preview apply.
  - exam config create/update/activate/deactivate/archive.
  - exam paper generate/publish/archive/export answer key.
  - assignment create/open/close/archive.
  - attempt result view/export nếu có policy nhạy cảm.
- Không ghi full API key, full prompt, full document chunk hoặc toàn bộ đáp án nếu không cần. `detailJson` chỉ chứa metadata: id, status cũ/mới, counts, reason, file name, model/prompt version.

### Frontend

- Thêm route:
  - `/admin/evaluation/audit-logs`
- Thêm sidebar item trong nhóm `ĐÁNH GIÁ`:
  - `Audit đánh giá`
- Màn hình list:
  - filter theo từ khóa, action, entity type, actor, khoảng thời gian.
  - columns: thời gian, người thao tác, hành động, đối tượng, mô tả, nút xem chi tiết.
- Detail drawer/modal:
  - hiển thị `summary`, metadata, `detailJson` format dễ đọc.
  - link nhanh sang câu hỏi/job/bộ đề nếu entity còn tồn tại.

### Tests

- Unit test service `record` và `list/filter`.
- Controller test quyền admin cho list/detail nếu test security đang có sẵn.
- Manual:
  - tạo/sửa/archive câu hỏi.
  - approve/save candidate.
  - publish đề.
  - mở trang audit và kiểm tra có log đúng.

### Acceptance criteria

- Mọi thao tác nhạy cảm của admin/evaluation có log.
- Audit page refresh không mất dữ liệu.
- Log không lộ secret hoặc nội dung tài liệu dài.

## Phase 11 - Permission granular và policy

### Mục tiêu

Không phải admin nào cũng có toàn quyền sửa câu hỏi, duyệt câu hỏi, publish đề hoặc xem đáp án/kết quả.

### Backend

- Chốt permission code:
  - `QUESTION_AUTHOR`: tạo/sửa câu hỏi draft.
  - `QUESTION_REVIEWER`: duyệt/từ chối/lưu candidate.
  - `QUESTION_SET_MANAGER`: tạo/sửa/activate bộ câu hỏi.
  - `EXAM_CONFIG_MANAGER`: tạo/sửa/activate cấu hình đề.
  - `EXAM_PUBLISHER`: generate/publish/archive bộ đề.
  - `ASSIGNMENT_MANAGER`: giao đề, mở/đóng assignment.
  - `RESULT_VIEWER`: xem/export kết quả.
  - `AUDIT_VIEWER`: xem audit log.
- Áp dụng `@PreAuthorize` theo endpoint thay vì chỉ `hasRole('ADMIN')`.
- Policy bắt buộc:
  - candidate chỉ save khi `APPROVED`.
  - published exam paper không sửa snapshot.
  - answer key chỉ trả về nếu có permission phù hợp.
  - export đáp án ghi audit.
  - archive câu hỏi đang dùng trong active set/published paper phải bị chặn hoặc cần force reason có audit.
- Nếu hệ thống role hiện tại chưa hỗ trợ permission granular:
  - map tạm `ROLE_ADMIN` có tất cả quyền.
  - chuẩn bị extension để gắn permission sau.

### Frontend

- Thêm helper permission trong frontend auth state.
- Hide/disable action theo permission:
  - duyệt câu hỏi.
  - lưu vào ngân hàng.
  - activate question set/config.
  - publish đề.
  - xem đáp án đúng/export answer key.
  - xem kết quả.
- Khi disabled phải có tooltip/lý do tiếng Việt.
- Không chỉ dựa vào frontend; backend vẫn là nguồn chặn chính.

### Tests

- Security tests cho từng nhóm endpoint.
- Manual với 3 tài khoản:
  - author.
  - reviewer.
  - exam publisher/result viewer.
- Test user thiếu quyền gọi API nhạy cảm trả 403.

### Acceptance criteria

- User thiếu quyền không gọi được API nhạy cảm.
- UI không hiển thị thao tác vượt quyền.
- Audit vẫn ghi các thao tác thành công sau khi permission được bật.

## Phase 12 - Hoàn thiện bộ câu hỏi và bộ đề

### Mục tiêu

Đưa `Bộ câu hỏi` và `Bộ đề kiểm tra` từ MVP lên mức admin dùng được để chuẩn bị kiểm tra thật, export/print được và tránh lỗi version/snapshot.

### Backend

- Question set:
  - `POST /api/v1/question-sets/{setId}/duplicate`
  - version hoặc snapshot history khi active set thay đổi. MVP đã có bằng `QuestionSetVersion` và `QuestionSetVersionItem`.
  - validate không active set rỗng, không có câu archived/deactivated.
  - cảnh báo category/difficulty distribution thiếu hoặc lệch.
- Question bank:
  - impact warning khi sửa/lưu trữ/tạm ngưng câu hỏi đang nằm trong active set hoặc published paper. MVP đã có ở detail/form và backend blocking.
- Exam paper:
  - `POST /api/v1/exam-papers/{paperId}/duplicate`
  - `GET /api/v1/exam-papers/{paperId}/export?format=txt|pdf|docx|xlsx&includeAnswers=true|false`. MVP đã có.
  - shuffle options theo seed và lưu `optionOrderJson` vào snapshot. MVP đã có cho TXT/detail/attempt; còn thiếu hiển thị/audit nâng cao nếu cần.
  - generated paper giữ snapshot ổn định, kể cả khi question bank đổi.
  - export answer key phải check permission và ghi audit.
- Exam config:
  - preview distribution chính xác theo active question set snapshot.
  - cảnh báo khi config active nhưng nguồn câu hỏi đã không còn đủ.

### Frontend

- Question set detail:
  - duplicate set.
  - xem snapshot/version active. MVP đã có trong form/detail page.
  - cảnh báo câu hỏi inactive/archived.
  - export set CSV/XLSX/DOCX/PDF. MVP backend đã có; print frontend vẫn còn.
- Exam paper detail:
  - duplicate paper sang draft.
  - export TXT/PDF/DOCX/XLSX. MVP đã có.
  - toggle đáp án theo permission.
  - hiển thị mã đề, seed, source config, source question set, snapshot timestamp.
- Generate paper page:
  - preview thiếu câu trước khi generate.
  - chọn shuffle options.
  - chọn số mã đề.

### Tests

- Test duplicate question set giữ thứ tự câu.
- Test activate set tạo snapshot/version. MVP đã có trong `QuestionSetServiceTest`.
- Test generate paper với seed cố định ra thứ tự ổn định.
- Test shuffle option lưu correct answer đúng sau shuffle. MVP đã có trong `ExamPaperServiceTest`.
- Test export giữ tiếng Việt có dấu.
- Manual:
  - tạo set active.
  - duplicate set.
  - sinh 2 mã đề.
  - export đề không đáp án và answer key.
  - sửa câu hỏi gốc, đề publish vẫn giữ snapshot.

### Acceptance criteria

- Admin tạo được bộ đề hoàn chỉnh từ question set/config.
- Đề publish ổn định, export được, không bị thay đổi bởi question bank live.
- Answer key không lộ cho user thiếu quyền.

## Phase 13 - Assignment, attempt và kết quả vận hành thật

### Mục tiêu

Hoàn thiện luồng giao đề và làm bài để dùng được cho khoa/phòng/nhóm, có autosave/timer và report đủ dùng.

### Backend

- Assignment target:
  - đã có target theo user cụ thể.
  - đã có target theo department/khoa/phòng, backend bung thành danh sách user target tại thời điểm tạo phân công.
  - còn target theo role/group nếu cần.
- Attempt:
  - enforce deadline, max attempts, retake policy.
  - autosave answer idempotent.
  - đã expire attempt khi read/save/submit nếu quá giờ.
  - đã có result visibility policy: chỉ điểm, hoặc điểm + đáp án + giải thích.
- API:
  - filter/pagination `GET /api/v1/exam-attempts`.
  - đã có `GET /api/v1/exam-assignments/{id}/results`.
  - đã có `GET /api/v1/exam-assignments/{id}/export-results`.
- Audit:
  - open/close assignment.
  - export result.
  - manual override nếu phase sau có chấm lại.

### Frontend admin

- Assignment form:
  - chọn published paper.
  - đã chọn được target user/department.
  - còn target group nếu hệ thống cần nhóm riêng ngoài khoa/phòng.
  - deadline, max attempts, result policy.
- Assignment detail:
  - danh sách target và trạng thái làm bài.
  - progress: chưa làm, đang làm, đã nộp, quá hạn.
- Attempt/result page:
  - filter theo assignment/paper/user/department/status/pass.
  - xem chi tiết bài làm.
  - export Excel.

### Frontend staff/runtime

- Màn hình làm bài:
  - đã có countdown timer.
  - đã có autosave định kỳ.
  - đã có trạng thái lưu gần nhất.
  - submit confirm.
  - đã khóa sửa sau submit/expire.
- Màn hình kết quả:
  - đã theo policy của assignment.
  - không show đáp án nếu policy không cho phép.

### Tests

- Test không start quá max attempts.
- Test autosave update câu trả lời cũ không tạo duplicate.
- Test expired attempt không cho submit/sửa.
- Test result policy không trả đáp án khi bị chặn.
- Manual end-to-end:
  - admin giao đề cho user.
  - user làm bài, refresh giữa chừng, autosave còn.
  - user submit.
  - admin xem/export kết quả.

### Acceptance criteria

- Assignment dùng được ngoài demo.
- User refresh trong lúc làm bài không mất đáp án đã lưu.
- Admin export được kết quả theo assignment.

## Phase 14 - Import/export nâng cao dữ liệu bệnh viện

### Mục tiêu

Đưa dữ liệu bệnh viện vào hệ thống có kiểm soát, có preview lỗi, có lịch sử import và export đủ phục vụ in ấn/audit.

### Backend

- Import job:
  - đã có `EvaluationImportJob`.
  - đã có `EvaluationImportJobRow`.
  - status: `PREVIEWED`, `COMMITTED`, `FAILED`, `CANCELLED`.
  - đã lưu source file metadata, actor, counts, warnings/errors cho import ngân hàng câu hỏi.
- Question bank import:
  - Excel hiện có giữ làm đường chính.
  - đã có mapping column động trong preview import.
  - đã có template download tại `GET /api/v1/questions/import/template`.
  - đã có duplicate handling mode: block, skip, hoặc import duplicate as draft.
- DOCX import theo mẫu:
  - đã hỗ trợ format cố định trước.
  - parser nhận stem, A-D, đáp án đúng, giải thích, category/topic, độ khó, ngôn ngữ, nguồn, trạng thái.
  - không dùng DOCX tự do làm production import nếu chưa có format chuẩn.
- Question set import:
  - import danh sách question IDs hoặc code theo thứ tự.
  - validate tất cả question đã `APPROVED`.
- Export:
  - question bank XLSX.
  - question set XLSX/CSV/print.
  - exam paper PDF/DOCX/XLSX.
  - assignment result XLSX.

### Frontend

- Import center:
  - đã có `/admin/evaluation/imports`
  - chọn loại import: ngân hàng câu hỏi, bộ câu hỏi.
  - upload, mapping columns, preview lỗi, commit dòng hợp lệ.
  - đã xem lịch sử import, chi tiết lỗi từng dòng và tải file lỗi.
- Export UI:
  - modal chọn format.
  - chọn include answer/explanation/source.
  - cảnh báo khi export đáp án cần quyền và audit.

### Tests

- Test preview không commit DB.
- Test commit chỉ lưu dòng hợp lệ hoặc theo mode được chọn.
- Test duplicate trong file import và duplicate với DB.
- Test DOCX template parser với tiếng Việt.
- Manual với file bệnh viện thật:
  - preview.
  - sửa lỗi.
  - commit.
  - tạo question set từ câu import.

### Acceptance criteria

- Import không âm thầm bỏ qua lỗi.
- Admin nhìn được dòng nào lỗi và lý do.
- Export mở được bằng Excel/Word/PDF, giữ tiếng Việt.

## Phase 15 - OCR, prompt/model governance và benchmark tạo câu hỏi

### Mục tiêu

Luồng tạo câu hỏi từ tài liệu có thể vận hành ổn định với tài liệu scan, có quản lý prompt/model và có số liệu benchmark chất lượng/cost.

### Backend

- OCR:
  - chọn engine chạy trong app hoặc service nội bộ.
  - giữ trạng thái `OCR_REQUIRED` cho file cần OCR trước khi engine sẵn sàng.
  - khi có OCR: lưu text theo page, confidence, warning page.
  - không gửi page OCR confidence thấp vào LLM nếu không đủ ngưỡng.
- Prompt governance:
  - entity `PromptTemplate` hoặc config tương đương.
  - version, provider, model, system prompt, user prompt template, active flag.
  - candidate lưu prompt version/model.
- Model governance:
  - DeepSeek API cho document generation.
  - E5 local cho duplicate.
  - VietQuill local/mock cho paraphrase.
  - health endpoint cho provider/model path/config.
- Benchmark:
  - dataset mẫu 50-100 chunk đã review.
  - lưu latency, token, candidate count, approval rate, duplicate rate.
  - endpoint job health/cost summary.

### Frontend

- Document detail:
  - OCR status/confidence/page warning.
  - retry OCR nếu file scan và engine sẵn sàng.
- Job review:
  - hiển thị prompt version/model.
  - filter warning theo OCR/chunk/duplicate.
  - export review report.
- Admin model/prompt settings:
  - xem provider đang bật.
  - xem prompt active.
  - cảnh báo khi mock provider đang bật.
  - không cho sửa prompt production nếu chưa có permission.

### Tests

- Test OCR_REQUIRED không tạo job.
- Test OCR confidence thấp tạo warning/skip chunk.
- Test candidate lưu prompt version.
- Test health endpoint không lộ API key.
- Benchmark manual:
  - chạy cùng dataset với 2 prompt version.
  - so sánh approval rate/latency/token.

### Acceptance criteria

- PDF scan có đường xử lý rõ: cần OCR hoặc OCR thành text/chunk có warning.
- Admin biết job dùng model/prompt nào.
- Có số liệu để quyết định prompt/model thay vì đo cảm tính.

## Phase 16 - Analytics nâng cao và quality review loop

### Mục tiêu

Biến dashboard từ màn hình tổng quan thành công cụ cải thiện chất lượng ngân hàng câu hỏi, bộ đề và kết quả kiểm tra.

### Backend

- Filter dashboard:
  - date range.
  - exam config.
  - exam paper.
  - assignment.
  - department/group.
- Item analysis:
  - correct rate.
  - wrong answer distribution A-D.
  - discrimination index nếu đủ dữ liệu.
  - flag câu quá dễ/quá khó/đáp án gây nhiễu kém.
- Question quality queue:
  - danh sách câu cần review lại.
  - reason: low correct rate, high duplicate risk, nhiều warning, nhiều lần bị sửa.
- Export:
  - dashboard summary XLSX.
  - item analysis XLSX.

### Frontend

- Dashboard filter bar.
- Drilldown:
  - click question item analysis sang detail câu hỏi.
  - click assignment sang result list.
  - click source document sang job/candidate.
- Quality review queue:
  - table câu cần xem lại.
  - action mở question detail/edit.
  - action deactivate/archive nếu đủ quyền.

### Tests

- Test aggregate theo filter.
- Test wrong answer distribution.
- Test quality queue rule.
- Manual:
  - tạo attempts mẫu.
  - dashboard filter đúng.
  - drilldown đúng route.

### Acceptance criteria

- Admin biết câu nào nên sửa hoặc loại khỏi đề.
- Export báo cáo chất lượng dùng được cho review chuyên môn.

## Phase 17 - Performance, reliability, migration và backup

### Mục tiêu

Hệ thống chạy ổn khi dữ liệu vượt demo và có đường nâng cấp schema rõ ràng.

### Backend

- Pagination server-side cho:
  - questions.
  - question sets.
  - exam configs.
  - exam papers.
  - assignments.
  - attempts.
  - document jobs.
  - audit logs.
- Index:
  - status.
  - topic/category.
  - difficulty.
  - createdAt.
  - sourceDocument.
  - assignment/user/status.
  - audit action/entity/actor/createdAt.
- Migration:
  - chọn Flyway/Liquibase nếu project chưa có.
  - không dựa vào `ddl-auto` cho production.
  - migration cho các bảng question/evaluation đã thêm.
- Async/file:
  - import/export lớn chạy job nền.
  - file export lưu tạm có TTL.
  - cleanup job cho file tạm.
- Backup/restore:
  - questions.
  - question embeddings có thể rebuild, nhưng bank/question set/exam snapshot/attempt result phải backup.
  - tài liệu upload nếu cần audit lâu dài.

### Frontend

- Table pagination server-side.
- Loading/error/empty state thống nhất.
- Debounce filter search.
- Không render 500+ rows cùng lúc.
- Retry action cho API lỗi tạm thời.

### Tests

- Integration test repository với PostgreSQL hoặc test container nếu setup cho phép.
- Seed/load test:
  - 5k questions.
  - 200 question sets.
  - 1k exam papers.
  - 10k attempts.
  - 50k audit logs.
- Frontend build/lint.

### Acceptance criteria

- Các list chính vẫn tải nhanh với dữ liệu lớn.
- Query chính có index.
- Schema production có migration rõ.

## Phase 18 - UAT, rollout và vận hành thật

### Mục tiêu

Chốt luồng thực tế với dữ liệu bệnh viện, đưa vào sử dụng theo từng phần có rollback.

### UAT scenarios

- Upload tài liệu bệnh viện và sinh câu hỏi.
- Review, sửa, approve, save vào bank.
- Import bộ câu hỏi mẫu từ file bệnh viện.
- Tạo category/rule đúng chuyên môn.
- Tạo bộ câu hỏi active.
- Tạo cấu hình đề.
- Sinh 2 mã đề từ cùng config.
- Publish đề.
- Export đề không đáp án và answer key.
- Giao đề cho user/khoa/phòng.
- User làm bài, refresh giữa chừng, submit.
- Admin xem điểm, item analysis và export báo cáo.
- Audit log hiển thị các thao tác nhạy cảm.

### Rollout

- Giai đoạn 1:
  - admin tạo/review câu hỏi, import/export question bank, tạo bộ câu hỏi.
- Giai đoạn 2:
  - tạo cấu hình đề, generate/publish/export bộ đề.
- Giai đoạn 3:
  - giao đề, làm bài online, scoring và báo cáo.
- Giai đoạn 4:
  - OCR production, prompt governance, analytics nâng cao.

### Rollback/data safety

- Import có preview và import job history.
- Publish exam paper dùng snapshot, không phụ thuộc live question.
- Archive là soft delete cho dữ liệu quan trọng.
- Có backup DB trước batch import hoặc rollout lớn.
- Có script/query kiểm tra counts trước/sau import/generate/publish.

### Admin operation docs

- Hướng dẫn tạo câu hỏi từ tài liệu.
- Hướng dẫn review candidate và duplicate warning.
- Hướng dẫn tạo bộ câu hỏi, cấu hình đề, bộ đề.
- Hướng dẫn giao đề và xem kết quả.
- Hướng dẫn xử lý lỗi thường gặp:
  - PDF cần OCR.
  - DeepSeek timeout/circuit breaker.
  - E5/VietQuill model chưa sẵn sàng.
  - import lỗi dòng.

### Acceptance criteria

- Có checklist UAT được ký lại.
- Có rollback plan dữ liệu.
- Có hướng dẫn vận hành cho admin.

## API modules frontend cần có sau khi hoàn tất

- `src/features/evaluation/api/documentQuestionApi.js`
- `src/features/evaluation/api/questionBankApi.js`
- `src/features/evaluation/api/questionSetApi.js`
- `src/features/evaluation/api/questionCategoryApi.js`
- `src/features/evaluation/api/classificationRuleApi.js`
- `src/features/evaluation/api/examConfigApi.js`
- `src/features/evaluation/api/examPaperApi.js`
- `src/features/evaluation/api/examAssignmentApi.js`
- `src/features/evaluation/api/examAttemptApi.js`
- `src/features/evaluation/api/evaluationReportApi.js`
- `src/features/evaluation/api/evaluationAuditLogApi.js`
- `src/features/evaluation/api/evaluationImportApi.js`
- `src/features/evaluation/api/promptTemplateApi.js`
- `src/features/evaluation/api/modelHealthApi.js`

## Backend endpoint map mục tiêu

### Question bank

- `GET /api/v1/questions`
- `GET /api/v1/questions/{questionId}`
- `POST /api/v1/questions`
- `PUT /api/v1/questions/{questionId}`
- `POST /api/v1/questions/{questionId}/approve`
- `POST /api/v1/questions/{questionId}/deactivate`
- `DELETE /api/v1/questions/{questionId}`

### Categories and rules

- `GET /api/v1/question-categories`
- `POST /api/v1/question-categories`
- `PUT /api/v1/question-categories/{categoryId}`
- `DELETE /api/v1/question-categories/{categoryId}`
- `GET /api/v1/question-classification-rules`
- `POST /api/v1/question-classification-rules`
- `PUT /api/v1/question-classification-rules/{ruleId}`
- `DELETE /api/v1/question-classification-rules/{ruleId}`
- `POST /api/v1/question-classification-rules/test`

### Question sets

- Đã có MVP:
  - `GET /api/v1/question-sets`
  - `GET /api/v1/question-sets/{setId}`
  - `POST /api/v1/question-sets`
  - `PUT /api/v1/question-sets/{setId}`
  - activate/deactivate/archive/preview
- Cần bổ sung sau:
  - `POST /api/v1/question-sets/{setId}/duplicate`
  - backend import/export nếu cần.

### Exam configs

- `GET /api/v1/exam-configs`
- `GET /api/v1/exam-configs/{configId}`
- `POST /api/v1/exam-configs`
- `PUT /api/v1/exam-configs/{configId}`
- `POST /api/v1/exam-configs/{configId}/preview`
- `POST /api/v1/exam-configs/{configId}/activate`
- `POST /api/v1/exam-configs/{configId}/deactivate`
- `DELETE /api/v1/exam-configs/{configId}`

### Exam papers

- `GET /api/v1/exam-papers`
- `GET /api/v1/exam-papers/{paperId}`
- `POST /api/v1/exam-papers/generate`
- `POST /api/v1/exam-papers/{paperId}/publish`
- `POST /api/v1/exam-papers/{paperId}/archive`
- `POST /api/v1/exam-papers/{paperId}/duplicate`
- `GET /api/v1/exam-papers/{paperId}/export`

### Assignments and attempts

- `GET /api/v1/exam-assignments`
- `POST /api/v1/exam-assignments`
- `GET /api/v1/exam-assignments/{assignmentId}`
- `POST /api/v1/exam-assignments/{assignmentId}/open`
- `POST /api/v1/exam-assignments/{assignmentId}/close`
- `DELETE /api/v1/exam-assignments/{assignmentId}`
- `GET /api/v1/exam-attempts`
- `GET /api/v1/exam-attempts/{attemptId}`
- `GET /api/v1/me/exam-assignments`
- `POST /api/v1/me/exam-assignments/{assignmentId}/start`
- `GET /api/v1/me/exam-attempts`
- `GET /api/v1/me/exam-attempts/{attemptId}`
- `PUT /api/v1/me/exam-attempts/{attemptId}/answers`
- `POST /api/v1/me/exam-attempts/{attemptId}/submit`

### Audit logs

- `GET /api/v1/evaluation-audit-logs`
- `GET /api/v1/evaluation-audit-logs/{auditLogId}`

### Imports and exports

- Đã có:
  - `GET /api/v1/evaluation-imports`
  - `GET /api/v1/evaluation-imports/{importJobId}`
- Đã có MVP dưới question bank:
  - `GET /api/v1/questions/import/template`
- `POST /api/v1/evaluation-imports/question-bank/preview`
- `POST /api/v1/evaluation-imports/question-bank/commit`
- `POST /api/v1/evaluation-imports/question-sets/preview`
- `POST /api/v1/evaluation-imports/question-sets/commit`
- `GET /api/v1/evaluation-imports/templates/question-bank`
- `GET /api/v1/evaluation-imports/{importJobId}/error-file`

### Prompt, OCR and model operations

- `GET /api/v1/evaluation-model-health`
- `GET /api/v1/prompt-templates`
- `POST /api/v1/prompt-templates`
- `PUT /api/v1/prompt-templates/{promptTemplateId}`
- `POST /api/v1/prompt-templates/{promptTemplateId}/activate`
- `POST /api/v1/documents/{documentId}/ocr`
- `GET /api/v1/document-question-jobs/{jobId}/review-report`

## Database entities mục tiêu

Đã có hoặc đang có:

- `QuestionDocument`
- `DocumentSection`
- `DocumentChunk`
- `DocumentQuestionJob`
- `DocumentKnowledgePoint`
- `DocumentQuestionCandidate`
- `QuestionBankQuestion`
- `QuestionEmbedding`
- `ParaphraseJob`
- `ParaphraseCandidate`
- `QuestionSet`
- `QuestionSetItem`
- `QuestionSetItemSnapshot`

Cần thêm:

- `EvaluationAuditLog` nếu hệ thống chưa có audit chung.
- `ImportJob`, `ImportJobRow` cho import history nâng cao.
- `PromptTemplate` nếu cần quản lý prompt/model active từ UI.
- `OcrPageResult` hoặc field tương đương nếu tích hợp OCR production.
- Permission/role mapping nếu hệ thống auth hiện tại chưa lưu permission granular.

## Definition of done chung

Mỗi phase backend phải đạt:

- Compile pass:
  - `.\mvnw.cmd -q -DskipTests compile`
- Test service/controller quan trọng pass.
- API trả lỗi tiếng Việt đủ rõ cho validation case.
- Không log API key, full prompt, full document chunk hoặc answer key nhạy cảm không cần thiết.

Mỗi phase frontend phải đạt:

- Build pass:
  - `npm run build`
- Nếu project có lint:
  - `npm run lint`
- Empty/loading/error state rõ.
- Không show enum thô.
- Refresh browser không mất dữ liệu đã lưu backend.

Mỗi phase dữ liệu phải đạt:

- Không hard delete dữ liệu đã được snapshot/publish.
- Snapshot giữ ổn định cho đề và attempt.
- Có migration hoặc hướng dẫn schema rõ.

## Open decisions

- Permission granular sẽ map vào role/permission hiện có như thế nào, hay tạm thời `ROLE_ADMIN` giữ toàn quyền?
- Khi duplicate mạnh ở ngân hàng câu hỏi, backend block tuyệt đối hay cho admin override có reason + audit?
- `QuestionSet ACTIVE` có được sửa trực tiếp không, hay mọi sửa đổi phải tạo version/draft mới?
- Archive câu hỏi đang nằm trong active set/published paper: chặn tuyệt đối hay cho force archive với warning/audit?
- Export answer key có cần thêm watermark/người export/thời gian export không?
- Result visibility sau submit: user chỉ xem điểm hay được xem đáp án/giải thích?
- Assignment target lấy department/group từ bảng nào trong hệ thống user hiện tại?
- OCR production dùng engine nào và chạy trong app hay service ngoài?
- Prompt template production có cho sửa trực tiếp từ UI không, hay chỉ active prompt đã được seed/migration?
- Dashboard quality thresholds: correct rate bao nhiêu là quá dễ/quá khó, duplicate score bao nhiêu là cần review?

## Kế hoạch phase-by-phase phần admin còn lại

Phần này là plan triển khai tiếp cho toàn bộ luồng admin liên quan đến tạo câu hỏi, ngân hàng câu hỏi, bộ câu hỏi, bộ đề, giao bài và báo cáo. Mục tiêu là mỗi phase đều có thể merge độc lập, có test, không làm vỡ luồng admin đang dùng được.

### Phase R0 - Chốt lại contract và trạng thái dữ liệu

#### Mục tiêu

Đóng băng contract hiện tại trước khi mở rộng tiếp, tránh trùng route/entity và tránh UI gọi nhầm dữ liệu demo.

#### Backend

- Rà lại các bảng chính:
  - document upload/chunk/job/candidate.
  - question bank/question embedding.
  - question set/question set item/snapshot.
  - exam config/exam paper/exam paper question snapshot.
  - assignment/attempt/answer/result.
  - import job/audit log.
- Chuẩn hóa trạng thái dùng chung:
  - document: `READY`, `OCR_REQUIRED`, `FAILED`.
  - candidate: `NEEDS_REVIEW`, `APPROVED`, `REJECTED`, `SAVED`.
  - question bank: `DRAFT`, `APPROVED`, `ARCHIVED`.
  - set/paper: `DRAFT`, `ACTIVE`, `ARCHIVED`, `PUBLISHED`.
- Chốt rule snapshot:
  - question bank là nguồn canonical.
  - question set giữ snapshot khi active/version.
  - exam paper giữ snapshot khi publish.
  - attempt chỉ đọc snapshot, không đọc live question.

#### Frontend

- Rà route `/admin/evaluation/*` và sidebar nhóm `ĐÁNH GIÁ`.
- Đảm bảo mọi page admin có loading/error/empty state.
- Không hiển thị enum thô; map sang nhãn tiếng Việt.

#### Tests

- Backend compile.
- Frontend build.
- Smoke API cho các route admin chính.

#### Acceptance criteria

- Docs có route map + entity map cập nhật.
- Không còn page quan trọng dùng dữ liệu demo/localStorage cho thao tác production.

### Phase R1 - Hoàn thiện tạo câu hỏi từ tài liệu

#### Mục tiêu

Luồng upload tài liệu -> tách chunk -> gọi DeepSeek -> sinh candidate -> review có thể dùng ổn định trong app.

#### Backend

- Document preprocessing:
  - chuẩn hóa text DOCX/PDF/TXT/MD.
  - tách section tree theo heading nếu có.
  - tách chunk theo token/độ dài, giữ `sectionPath`, `pageNumber`, `sourceExcerpt`.
  - bỏ chunk quá ngắn, trùng lặp hoặc không đủ nội dung y khoa.
- DeepSeek generation:
  - gọi API bằng service riêng, timeout/retry/backoff rõ.
  - prompt yêu cầu trả JSON có câu hỏi, A-D, đáp án đúng, giải thích, difficulty, warnings, source evidence.
  - đã bổ sung rule stem tự đứng độc lập và guard bỏ câu hỏi kiểu `Theo tài liệu...`.
  - log latency/token/model/prompt version nhưng không log API key/full document.
  - nếu call chậm, lưu job trạng thái `RUNNING/PARTIAL/FAILED` và cho UI polling.
- Candidate normalization:
  - validate đủ A-D, đúng 1 đáp án, explanation không rỗng.
  - reject/flag câu quá chung như "Theo tài liệu..." nếu stem không tự đứng độc lập.
  - save vào ngân hàng đã chặn stem generic để không đưa câu cũ/chưa sửa vào DB.
  - giữ source excerpt và chunk id để reviewer đối chiếu.
- Duplicate check:
  - dùng E5 local nếu embedding sẵn sàng.
  - fallback keyword chỉ là cảnh báo tạm thời, phải hiển thị rõ mode đang dùng.
  - duplicate mạnh thì candidate cần review, không tự lưu.
- Paraphrase:
  - VietQuill chạy trong app cho paraphrase cả câu hỏi và đáp án.
  - paraphrase phải giữ đáp án đúng và không đổi ý nghĩa y khoa.
  - lưu các biến thể như candidate version, không ghi đè bản gốc âm thầm.

#### Frontend

- Route `/admin/evaluation/question-documents`:
  - danh sách tài liệu, upload, filter trạng thái, cảnh báo `Cần OCR`.
  - danh sách tài liệu đã hiển thị phiên tạo gần nhất để mở lại review sau khi admin out khỏi màn hình.
  - chi tiết tài liệu có metadata, section tree, chunk preview.
  - chi tiết tài liệu đã có tab `Phiên tạo câu hỏi` để xem lịch sử job theo document.
  - tạo job với `questionsPerChunk` từ 1 đến 5.
- Route review job:
  - hiển thị model/prompt version/usage/latency.
  - nhóm candidate theo chunk.
  - card luôn có câu hỏi, A-D, đáp án đúng, giải thích, difficulty, quality score, warnings, duplicate info, source excerpt.
  - edit inline, paraphrase, approve, reject.
  - chỉ hiện `Lưu vào ngân hàng câu hỏi` khi candidate đã `Đã duyệt`.
- Khi job partial:
  - hiển thị chunk lỗi.
  - có nút retry failed chunks.

#### Tests

- Unit test chunking tiếng Việt.
- Test DeepSeek mock trả JSON hợp lệ/lỗi/timeout.
- Test candidate duplicate bằng E5 mock và keyword fallback.
- Manual:
  - upload PDF text.
  - tạo job.
  - sửa candidate.
  - approve rồi save vào question bank.
  - thoát trang rồi quay lại lịch sử job.

#### Acceptance criteria

- Câu hỏi sinh ra không còn dạng chung chung "Theo tài liệu..." nếu không có nội dung tự đứng độc lập.
- Admin có thể xem lại job đã tạo sau khi out khỏi màn hình.
  - đã có `GET /documents/{documentId}/question-jobs`, tab lịch sử job trong chi tiết tài liệu và link phiên gần nhất từ danh sách tài liệu.
- Candidate đã duyệt lưu được vào DB question bank.
  - UI review hiển thị `savedQuestionId` và nút mở câu hỏi đã lưu.

### Phase R2 - Hoàn thiện ngân hàng câu hỏi

#### Mục tiêu

Ngân hàng câu hỏi trở thành nơi quản trị câu hỏi production, có xem chi tiết, sửa, duyệt, archive, duplicate và import/export an toàn.

#### Backend

- Detail endpoint trả đủ:
  - đã có/test stem, A-D, correct answer, explanation, topic, difficulty, source, status và impact warning.
  - còn thiếu embedding status/audit summary trong detail response nếu muốn hiển thị tab sâu.
- Update endpoint:
  - validate đủ A-D và đáp án đúng.
  - nếu câu đã nằm trong active set/published paper, update tạo version hoặc yêu cầu reason.
- Archive endpoint:
  - cảnh báo nếu câu đang nằm trong set/paper active.
  - không hard delete câu đã được snapshot.
- Import:
  - XLSX/CSV có mapping column.
  - DOCX theo mẫu cố định.
  - duplicate handling: block, skip, import duplicate as draft.
  - import history và file lỗi.
- Export:
  - XLSX hiện có.
  - bổ sung CSV nếu cần vận hành nhanh.
  - tùy chọn include/exclude answer key theo permission.

#### Frontend

- Sửa lỗi click câu hỏi trong ngân hàng:
  - đã có modal xem detail đầy đủ trước.
  - edit form đã harden prefill/lỗi load và giữ nguồn câu hỏi.
  - có tab `Nội dung`, `Nguồn`, `Trùng lặp`, `Lịch sử`.
- Batch actions:
  - approve draft.
  - archive.
  - re-embed selected.
- Import modal:
  - preview rõ dòng lỗi.
  - mapping cột.
  - chọn xử lý trùng.
  - tải file lỗi.

#### Tests

- Test detail/update/archive.
  - đã có service test detail trả đủ dữ liệu edit và archive/update impact warning.
- Test import DOCX tiếng Việt.
- Test duplicate modes.
- Frontend manual với file bệnh viện thật.

#### Acceptance criteria

- Bấm vào một câu hỏi bất kỳ xem được chi tiết đầy đủ, không bị form rỗng.
- Không thể vô tình sửa mất nội dung câu đã dùng trong đề đã publish.

### Phase R3 - Bộ câu hỏi và versioning

#### Mục tiêu

Bộ câu hỏi là collection ổn định để làm nguồn sinh đề, có version và không bị thay đổi ngầm khi ngân hàng câu hỏi đổi.

#### Backend

- Question set version:
  - `DRAFT` chỉnh sửa tự do.
  - `ACTIVE` khóa snapshot.
  - đã khóa sửa trực tiếp active set; admin tạo bản nháp chỉnh sửa từ active set bằng duplicate rồi kích hoạt thành version mới.
- Question set item:
  - lưu order, score/default weight nếu cần.
  - lưu snapshot stem/A-D/answer/explanation/topic/difficulty/source.
- Validate:
  - chỉ add question `APPROVED`.
  - cảnh báo duplicate nội bộ trong set.
  - cảnh báo phân bổ difficulty/topic lệch.
- Import set:
  - import danh sách question id/code theo thứ tự.
  - validate câu thiếu/không approved.
- Export set:
  - XLSX/CSV/DOCX/PDF/print.
  - tùy chọn có/không đáp án và giải thích.

#### Frontend

- Page list bộ câu hỏi:
  - filter status/version/owner.
  - duplicate set.
  - archive.
- Detail builder:
  - add từ question bank bằng search/filter.
  - reorder câu hỏi.
  - xem coverage theo topic/difficulty.
  - publish/activate có confirmation.
- Version UI:
  - xem version history.
  - duplicate active set đã lấy từ snapshot version đang hoạt động.
  - compare số câu thay đổi.
  - active set form đã có read-only banner và CTA tạo bản nháp chỉnh sửa.

#### Tests

- Test active set snapshot không đổi khi question bank update.
- Test sửa active set tạo version mới.
- Test export mở được và giữ tiếng Việt.

#### Acceptance criteria

- Một bộ câu hỏi đã active luôn tái dựng đúng nội dung tại thời điểm active.
- Admin biết rõ đang sửa draft hay version đã active.
  - active set form đã khóa chỉnh sửa và giải thích workflow draft revision.

### Phase R4 - Cấu hình đề và sinh bộ đề

#### Mục tiêu

Admin tạo được đề kiểm tra từ bộ câu hỏi theo rule rõ ràng, đề publish có snapshot cố định và export/in được.

#### Backend

- Exam config:
  - thời gian làm bài.
  - điểm đạt.
  - số câu.
  - random/shuffle option.
  - phân bổ topic/difficulty.
  - retake policy.
  - result visibility policy.
- Paper generation:
  - sinh đề từ question set active.
  - lưu snapshot câu hỏi và option order.
  - seed shuffle để reproducible.
  - validate không vượt số câu nguồn.
- Paper lifecycle:
  - draft preview.
  - publish khóa snapshot.
  - duplicate paper.
  - archive nếu chưa có assignment active hoặc có warning.
- Export:
  - PDF/DOCX/XLSX.
  - bản đề làm bài.
  - bản đáp án riêng cần permission/audit.

#### Frontend

- Exam config page:
  - form rule sinh đề.
  - preview phân bổ.
  - cảnh báo thiếu câu theo topic/difficulty.
- Paper detail:
  - preview đề.
  - xem snapshot.
  - export format.
  - duplicate/publish/archive.
- Không dùng card marketing; UI dạng admin dense, dễ scan.

#### Tests

- Test sinh đề đúng số câu.
- Test shuffle option giữ correct answer theo option mới.
- Test publish khóa snapshot.
- Test export answer key cần permission.

#### Acceptance criteria

- Đề đã publish không đổi dù question bank hoặc set thay đổi sau đó.
- Export đề/đáp án mở được và không lỗi tiếng Việt.

### Phase R5 - Giao bài, làm bài và chấm điểm

#### Mục tiêu

Admin giao đề cho user/khoa/phòng, theo dõi attempt, export kết quả và kiểm soát quyền xem đáp án.

#### Backend

- Assignment:
  - target user.
  - target department.
  - target room/group nếu hệ thống user có dữ liệu.
  - start/end time.
  - max attempts.
  - result visibility.
- Attempt:
  - start/resume.
  - autosave answer.
  - submit.
  - expire-on-read.
  - chấm điểm theo snapshot.
- Result:
  - summary theo assignment.
  - detail từng attempt.
  - export XLSX.
  - không trả answer key nếu policy chặn.

#### Frontend

- Assignment admin:
  - tạo assignment.
  - chọn paper.
  - chọn target.
  - xem danh sách người được giao.
- Monitoring:
  - trạng thái chưa làm/đang làm/đã nộp/quá hạn.
  - filter theo khoa/phòng.
  - export kết quả.
- Attempt review:
  - xem câu trả lời, đúng/sai, điểm.
  - ẩn/hiện đáp án theo policy.

#### Tests

- Test không start quá max attempts.
- Test autosave không tạo duplicate answer.
- Test hết giờ tự expire.
- Test result policy không leak answer.

#### Acceptance criteria

- Admin giao đề và xuất kết quả được cho vận hành thật.
- User refresh trong lúc làm bài không mất câu trả lời.

### Phase R6 - Dashboard chất lượng và vòng review lại

#### Mục tiêu

Admin nhìn được chất lượng câu hỏi, đề và kết quả để sửa câu yếu, câu quá dễ/khó hoặc câu gây nhầm.

#### Backend

- Metrics:
  - correct rate theo câu.
  - discrimination index.
  - average time per question.
  - duplicate rate.
  - approval rate của candidate từ tài liệu.
- Drilldown:
  - từ dashboard vào câu hỏi.
  - từ câu hỏi vào attempt/result liên quan.
- Review loop:
  - flag câu cần xem lại.
  - tạo task review hoặc chuyển status về draft.

#### Frontend

- Dashboard filter:
  - thời gian.
  - assignment.
  - paper.
  - question set.
  - department.
- Biểu đồ/tables:
  - câu dễ/quá khó.
  - câu bị trả lời sai nhiều.
  - câu có warning duplicate/source.
- Action:
  - mở detail question.
  - archive hoặc tạo version sửa.

#### Tests

- Test metric query không double count attempt.
- Test filter theo assignment/department.
- Manual với dữ liệu seed đủ lớn.

#### Acceptance criteria

- Admin có danh sách câu hỏi cần review dựa trên dữ liệu thật, không chỉ cảm tính.

### Phase R7 - Prompt/model governance, OCR và vận hành AI

#### Mục tiêu

Tách cấu hình AI khỏi code cứng, có health check, benchmark và kiểm soát chi phí/chất lượng.

#### Backend

- Prompt template:
  - version.
  - provider/model.
  - active flag.
  - createdBy/approvedBy.
- Model health:
  - DeepSeek key/config.
  - E5 local model path/status.
  - VietQuill local model path/status.
  - endpoint không trả secret.
- Benchmark:
  - dataset chunk mẫu.
  - chạy generation/paraphrase/duplicate.
  - lưu latency, token/cost, approval rate.
- OCR:
  - giữ `OCR_REQUIRED` nếu engine chưa production.
  - khi tích hợp: lưu text theo page, confidence, warning.

#### Frontend

- Settings page cho admin kỹ thuật:
  - xem provider health.
  - xem active prompt/model.
  - chạy benchmark nhỏ.
  - xem cost/latency theo job.
- Không hiển thị API key.

#### Tests

- Test health không leak secret.
- Test prompt version được ghi vào candidate/job.
- Test fallback khi E5/VietQuill unavailable.

#### Acceptance criteria

- Biết rõ job nào dùng model/prompt version nào.
- Khi AI provider lỗi, UI báo lỗi rõ và có retry, không treo vô hạn.

### Phase R8 - Permission, audit và an toàn dữ liệu

#### Mục tiêu

Mọi thao tác nhạy cảm trong admin có phân quyền và audit đủ để truy vết.

#### Backend

- Permission codes:
  - question create/update/approve/archive.
  - candidate approve/reject/save.
  - set publish.
  - paper publish/export answer key.
  - assignment create/result export.
  - prompt/model settings.
- Audit:
  - actor, action, entity type/id.
  - before/after summary cho update quan trọng.
  - reason khi force action.
- API guard:
  - 403 rõ tiếng Việt.
  - không chỉ hide UI, backend vẫn phải chặn.

#### Frontend

- Hide/disable action theo permission.
- Khi disabled, tooltip/lý do ngắn.
- Audit log page có filter entity/action/actor/time.

#### Tests

- Controller/security test 403.
- Test action nhạy cảm ghi audit.
- Manual với tài khoản admin thường và admin kỹ thuật.

#### Acceptance criteria

- Export đáp án, publish đề, sửa prompt/model đều có quyền riêng và audit.

### Phase R9 - Performance, migration và UAT

#### Mục tiêu

Đưa module vào trạng thái có thể demo/vận hành với dữ liệu bệnh viện lớn hơn file mẫu.

#### Backend

- Pagination server-side cho list lớn:
  - question bank.
  - candidates.
  - jobs.
  - attempts/results.
  - audit logs.
- Index/migration:
  - status.
  - createdAt.
  - documentId/jobId.
  - questionSetId/paperId/assignmentId.
  - embedding vector nếu DB hỗ trợ.
- Seed/load test:
  - 1k, 10k câu hỏi.
  - nhiều assignment/attempt.
- Backup/restore checklist cho dữ liệu evaluation.

#### Frontend

- Table pagination dùng dữ liệu backend.
- Debounced search/filter.
- Empty/loading/error state thống nhất.
- Kiểm tra responsive các page admin chính.

#### Tests

- Build frontend.
- Targeted backend tests.
- Manual UAT script:
  - import câu hỏi bệnh viện.
  - tạo set.
  - sinh đề.
  - giao bài.
  - làm bài.
  - xuất kết quả.
  - xem dashboard.

#### Acceptance criteria

- Demo end-to-end không cần sửa DB tay.
- Các trang list lớn không bị đơ hoặc tải toàn bộ dữ liệu không cần thiết.

## Immediate next implementation plan

Nếu tiếp tục implement từ trạng thái hiện tại, thứ tự thực tế nên là:

1. Phase R1 hoàn thiện tạo câu hỏi từ tài liệu:
   - sửa prompt để câu hỏi tự đứng độc lập, không còn mở đầu chung chung "Theo tài liệu...".
   - kiểm tra lại timeout/retry DeepSeek.
   - thêm job history/retry failed chunks nếu còn thiếu ở UI.
   - nối VietQuill paraphrase cho cả câu hỏi và đáp án.
2. Phase R2 hoàn thiện ngân hàng câu hỏi:
   - sửa detail/edit đang rỗng khi bấm vào từng câu.
   - xác nhận candidate đã lưu vào DB question bank.
   - hoàn thiện duplicate/E5 status và import DOCX/XLSX flow.
3. Phase R3 bộ câu hỏi versioning:
   - active set phải có snapshot.
   - sửa active set tạo draft version mới.
   - import/export set chính thức.
4. Phase R4 cấu hình đề và sinh bộ đề:
   - sinh đề từ active set.
   - snapshot option order.
   - export PDF/DOCX/XLSX và answer key có permission.
5. Phase R5 giao bài và kết quả:
   - polish assignment target.
   - kiểm tra autosave/timer/result policy.
   - export result và monitoring.
6. Phase R6-R9:
   - dashboard chất lượng.
   - prompt/model/OCR governance.
   - permission/audit tightening.
   - performance, migration và UAT.

Lý do: ưu tiên trước mắt là khép kín vòng `tài liệu -> candidate -> ngân hàng câu hỏi -> bộ câu hỏi -> bộ đề`. Khi vòng này ổn, các phần assignment, dashboard và governance sẽ bám trên dữ liệu thật thay vì phải vá theo từng màn hình.

## Execution roadmap v2 - phần admin còn lại

> Cập nhật 2026-07-04. Phần này là kế hoạch triển khai thực tế từ trạng thái hiện tại của project. Mục tiêu là đi theo các phase nhỏ, mỗi phase có thể build/test độc lập, không trộn lẫn "tạo câu hỏi", "bộ câu hỏi", "cấu hình đề" và "bộ đề".

### Phase A0 - Stabilize build và baseline hiện trạng

#### Mục tiêu

Đưa project về trạng thái build xanh trước khi thêm feature mới. Đây là phase bắt buộc vì hiện đang có nhiều thay đổi backend/frontend liên quan admin evaluation.

#### Backend

- Fix compile warning/error còn lại:
  - Lombok `@SuperBuilder` field default dùng `@Builder.Default` nếu field cần default khi build.
  - PDF extractor phải có dependency PDFBox đúng version trong `pom.xml`.
  - Các service mới phải có đủ constructor dependency, repository mock trong test.
- Chạy lại migration/schema startup nếu có entity mới:
  - question set version.
  - exam config.
  - exam paper.
  - assignment/attempt.
  - audit/import/dashboard.
- Chốt các config AI trong `application.yaml`:
  - DeepSeek API key lấy từ env, không hardcode.
  - E5/VietQuill model path hoặc mock mode rõ ràng.
  - timeout/concurrency/circuit breaker có default an toàn.

#### Frontend

- Chạy build để bắt lỗi route/import/component mới.
- Rà sidebar admin evaluation không trỏ tới route chưa có page.
- Rà các page list/detail có loading/error/empty state tối thiểu.

#### Tests

- `.\mvnw.cmd -q -DskipTests compile`
- Targeted backend tests cho các service vừa sửa.
- `npm run build`

#### Acceptance criteria

- Backend compile xanh.
- Frontend build xanh.
- Không còn lỗi import/package/dependency ở luồng admin evaluation.

### Phase A1 - Hoàn thiện luồng tạo câu hỏi từ tài liệu

#### Mục tiêu

Luồng upload tài liệu, tách chunk, gọi DeepSeek, sinh candidate, review và quay lại xem lịch sử job phải dùng được ổn định trong app.

#### Backend

- Chuẩn hóa preprocessing:
  - PDF/DOCX/TXT/MD extractor trả text sạch.
  - section tree giữ heading/path.
  - chunk lưu `sectionPath`, `sourceExcerpt`, page nếu có.
  - chunk quality gate bỏ heading-only, trùng lặp, chunk quá ngắn.
- Chuẩn hóa generation:
  - DeepSeek trả JSON có stem, A-D, correct answer, explanation, difficulty, warnings, source evidence.
  - Guard bỏ câu hỏi chung chung kiểu "Theo tài liệu..." nếu stem không tự đứng độc lập.
  - Timeout/retry/backoff rõ, job có trạng thái `CREATED`, `GENERATING`, `PARTIAL`, `COMPLETED`, `FAILED`.
  - Lưu model, prompt version, latency, token/cost nếu provider trả.
- Hoàn thiện job history:
  - `GET /api/v1/documents/{documentId}/question-jobs`.
  - job summary có status, createdAt, totalChunks, generatedCount, approvedCount, savedCount, failedCount.
- Retry:
  - retry failed chunks không tạo duplicate candidate cho chunk đã thành công.

#### Frontend

- `/admin/evaluation/question-documents`:
  - upload file.
  - filter trạng thái.
  - hiển thị job gần nhất.
  - `OCR_REQUIRED` chỉ có hướng xử lý, không có nút tạo câu hỏi.
- Detail document:
  - metadata.
  - section tree.
  - chunk preview.
  - tab `Phiên tạo câu hỏi`.
  - tạo job với `questionsPerChunk` từ 1 đến 5.
- Review job:
  - polling khi job còn chạy.
  - card candidate hiển thị đủ stem, A-D, đáp án đúng, giải thích, difficulty, quality score, warnings, duplicate info, source excerpt.
  - edit, approve, reject, retry failed chunks.
  - chỉ cho save khi candidate đã approved.

#### Tests

- Unit test chunking tiếng Việt.
- Unit test DeepSeek parser cho JSON hợp lệ/lỗi/timeout.
- Test generic-stem guard.
- Manual với file bệnh viện thật:
  - upload.
  - tạo job.
  - out khỏi màn hình.
  - quay lại mở job từ lịch sử.

#### Acceptance criteria

- Admin không bị mất phiên tạo câu hỏi sau khi rời màn hình.
- Candidate tạo ra có nội dung tự đứng độc lập, không còn stem chung chung.
- Job lỗi một phần có thể retry phần lỗi.

### Phase A2 - Review workflow và lưu candidate vào ngân hàng

#### Mục tiêu

Candidate AI/paraphrase sau review phải lưu được vào DB question bank một cách có kiểm soát, có duplicate check và có link truy vết nguồn.

#### Backend

- Save-as-question:
  - bắt buộc candidate `APPROVED`.
  - bắt buộc đủ A-D, correct answer, explanation, source excerpt.
  - duplicate mạnh thì block hoặc yêu cầu reviewer xử lý rõ.
  - sau khi save, candidate lưu `savedQuestionId`.
- Candidate edit:
  - edit stem/options/explanation/difficulty/topic/source note.
  - sau edit chạy lại validation và duplicate check.
- Batch action:
  - approve/reject nhiều candidate.
  - batch save chỉ lưu candidate đủ điều kiện.
- Audit:
  - log approve/reject/edit/save candidate.

#### Frontend

- Review card:
  - trạng thái tiếng Việt: `Cần xem xét`, `Đã duyệt`, `Từ chối`, `Đã lưu`.
  - nút `Lưu vào ngân hàng câu hỏi` disabled nếu chưa duyệt hoặc duplicate mạnh.
  - sau save có link `Mở câu hỏi đã lưu`.
- Batch toolbar:
  - chọn nhiều candidate.
  - approve/reject/save selected.
  - hiển thị số lỗi nếu batch save fail một phần.

#### Tests

- `CandidateReviewServiceTest` cho approve/edit/save/duplicate.
- Manual:
  - edit candidate.
  - approve.
  - save.
  - mở detail câu hỏi trong ngân hàng.

#### Acceptance criteria

- Câu hỏi lưu vào DB question bank thật, không chỉ hiện trong UI.
- Reviewer nhìn được lý do candidate chưa thể lưu.

### Phase A3 - Ngân hàng câu hỏi production

#### Mục tiêu

Ngân hàng câu hỏi là nguồn canonical cho admin: xem chi tiết, sửa, duyệt, archive, import/export, re-embed và kiểm tra tác động.

#### Backend

- Detail endpoint trả đủ dữ liệu:
  - stem, A-D, correct answer, explanation.
  - difficulty, topic/category, sourceDocument, sourceExcerpt.
  - duplicate warnings.
  - embedding status.
  - impact warning: đang nằm trong active set/published paper/assignment nào.
- Update:
  - validate MCQ.
  - update câu approved refresh embedding.
  - nếu câu đang được dùng trong active set hoặc published paper, không làm thay đổi snapshot cũ.
- Archive:
  - soft archive.
  - chặn hard delete câu đã từng được snapshot.
- Import:
  - XLSX/CSV trước.
  - DOCX theo mẫu sau.
  - preview, commit, error file.
- Export:
  - XLSX/CSV.
  - include answers theo permission.

#### Frontend

- List:
  - filter status/topic/difficulty/source/duplicate.
  - search debounce.
  - pagination server-side nếu dữ liệu lớn.
- Detail modal/page:
  - tab `Nội dung`.
  - tab `Nguồn`.
  - tab `Trùng lặp`.
  - tab `Lịch sử/Tác động`.
- Form edit:
  - không bị rỗng khi mở từ list.
  - hiển thị lỗi load rõ.
  - giữ `sourceDocument/sourceExcerpt`.
- Import modal:
  - upload.
  - preview mapping.
  - chọn duplicate mode: block, skip, import as draft.

#### Tests

- Service tests detail/update/archive/import/export.
- Frontend manual với bộ câu hỏi bệnh viện.

#### Acceptance criteria

- Click câu hỏi trong ngân hàng luôn xem được detail đầy đủ.
- Edit không làm mất nguồn câu hỏi.
- Import file bệnh viện cho ra preview rõ lỗi từng dòng.

### Phase A4 - E5 duplicate và VietQuill paraphrase trong app

#### Mục tiêu

Duplicate check và paraphrase không phụ thuộc ngoài UI/mock mơ hồ; admin biết đang chạy E5 thật hay fallback, VietQuill paraphrase cả câu hỏi và đáp án.

#### Backend

- E5:
  - load model trong app hoặc qua runtime service nội bộ đã cấu hình.
  - endpoint health không leak path nhạy cảm nếu không cần.
  - embed stem và có thể embed stem + options nếu muốn tăng độ chính xác.
  - fallback keyword phải được đánh dấu rõ `fallbackMode=true`.
- VietQuill:
  - paraphrase stem, option A-D, explanation nếu bật.
  - giữ correct answer bằng option identity, không đảo nghĩa.
  - sinh paraphrase candidate để review, không ghi đè câu gốc.
- Re-embedding:
  - batch re-embed selected/all approved.
  - retry lỗi model.

#### Frontend

- Question bank:
  - badge `E5` hoặc `Từ khóa` trong duplicate info.
  - action `Tạo biến thể` cho câu hỏi.
- Paraphrase review:
  - so sánh bản gốc và bản paraphrase.
  - hiển thị thay đổi ở stem/options.
  - approve/save như candidate thường.
- AI health:
  - trạng thái DeepSeek/E5/VietQuill.
  - latency gần nhất.
  - không hiển thị API key.

#### Tests

- Mock E5 duplicate score threshold.
- Test fallback keyword khi E5 unavailable.
- Test VietQuill/paraphrase giữ correct answer.

#### Acceptance criteria

- Admin biết duplicate đang được check bằng E5 hay chỉ keyword.
- Paraphrase lưu thành câu hỏi/biến thể mới sau review.

### Phase A5 - Bộ câu hỏi, draft revision và versioning

#### Mục tiêu

Bộ câu hỏi là collection ổn định để sinh đề. Active set có snapshot/version, không bị đổi ngầm khi question bank thay đổi.

#### Backend

- Question set lifecycle:
  - `DRAFT`: chỉnh sửa tự do.
  - `ACTIVE`: khóa nội dung.
  - `ARCHIVED`: không dùng để sinh đề mới.
- Activate:
  - tạo `QuestionSetVersion`.
  - tạo `QuestionSetVersionItem` snapshot đầy đủ.
  - lưu `activeVersion`.
- Draft revision:
  - duplicate từ active version snapshot.
  - chỉnh draft.
  - activate thành version mới.
- Validate:
  - chỉ add question `APPROVED`.
  - cảnh báo câu archived/inactive.
  - cảnh báo duplicate nội bộ.
  - kiểm tra coverage topic/difficulty.
- Export set:
  - XLSX/CSV/DOCX/PDF.
  - include answers theo permission.

#### Frontend

- List bộ câu hỏi:
  - filter status/version.
  - duplicate.
  - archive.
- Builder:
  - search câu hỏi từ bank.
  - add/remove/reorder.
  - coverage panel.
  - preview set.
- Active set:
  - read-only banner.
  - CTA `Tạo bản nháp chỉnh sửa`.
  - version history.

#### Tests

- Test active snapshot không đổi sau khi câu hỏi gốc bị sửa.
- Test duplicate active set lấy từ active version snapshot.
- Test không update trực tiếp active set.

#### Acceptance criteria

- Bộ câu hỏi active luôn tái dựng đúng nội dung tại thời điểm activate.
- Admin không thể sửa nhầm active set.

### Phase A6 - Cấu hình đề kiểm tra

#### Mục tiêu

Cấu hình đề kiểm tra mô tả rule sinh đề, tách khỏi bộ câu hỏi và bộ đề đã sinh.

#### Backend

- Exam config fields:
  - questionSetId.
  - totalQuestions.
  - timeLimitMinutes.
  - passingScore.
  - maxRetakes.
  - shuffleQuestions.
  - shuffleOptions.
  - resultVisibility.
  - distributions theo category/topic/difficulty.
- Validate:
  - tổng distribution bằng totalQuestions.
  - active question set đủ câu theo rule.
  - không activate config nếu source set archived/inactive.
- Preview:
  - trả coverage và thiếu hụt theo từng distribution.

#### Frontend

- Form config:
  - chọn active question set.
  - cấu hình thời gian/điểm đạt/retake.
  - bảng distribution.
  - preview rule.
- List config:
  - active/deactivate/archive.
  - duplicate config.

#### Tests

- Test validate total/distribution.
- Test preview thiếu câu.
- Manual tạo config từ bộ câu hỏi thật.

#### Acceptance criteria

- Admin biết trước config có đủ câu để sinh đề hay không.
- Config active không trỏ vào source không hợp lệ.

### Phase A7 - Sinh bộ đề, publish và export

#### Mục tiêu

Admin sinh được bộ đề từ config và active question set version, publish đề có snapshot cố định, export được đề/đáp án.

#### Backend

- Generate paper:
  - lấy câu từ active `QuestionSetVersionItem`, không lấy live item nếu có version.
  - random theo seed để reproducible.
  - shuffle question/order nếu bật.
  - shuffle option và remap correct answer đúng.
  - lưu snapshot câu hỏi, option order, explanation, source.
- Lifecycle:
  - `DRAFT`: preview được.
  - `PUBLISHED`: khóa snapshot.
  - duplicate paper tạo draft mới từ snapshot cũ.
  - archive có warning nếu đã assigned.
- Export:
  - PDF/DOCX/XLSX/TXT nếu cần.
  - `includeAnswers=true` cần permission và audit.
  - tiếng Việt không lỗi font.

#### Frontend

- Generate page:
  - chọn config.
  - nhập tên đề/số lượng đề/seed.
  - preview kết quả generate.
- Paper detail:
  - xem snapshot câu hỏi.
  - publish.
  - duplicate.
  - archive.
  - export format.
- Paper list:
  - status, config, createdBy, publishedAt.

#### Tests

- Test sinh đúng số câu.
- Test lấy snapshot từ active question set version.
- Test shuffle option giữ correct answer.
- Test export answer key cần permission/audit.

#### Acceptance criteria

- Đề đã publish không đổi dù question bank/question set thay đổi sau đó.
- Export đề và đáp án mở được với tiếng Việt đúng.

### Phase A8 - Giao bài, làm bài và chấm điểm

#### Mục tiêu

Admin giao đề cho nhân viên/khoa/phòng, user làm bài, hệ thống autosave và chấm điểm theo snapshot.

#### Backend

- Assignment:
  - chọn paper published.
  - target user/department/group nếu dữ liệu user hỗ trợ.
  - start/end time.
  - max attempts.
  - visibility policy.
- Attempt:
  - start/resume.
  - autosave answer.
  - submit.
  - hết giờ tự expire/submit theo rule.
  - chấm điểm theo paper snapshot.
- Result:
  - list attempts.
  - detail answer.
  - export XLSX.
  - không leak answer key nếu policy chặn.

#### Frontend

- Admin assignment:
  - list/create/detail.
  - target picker.
  - open/close assignment.
  - monitoring trạng thái làm bài.
- Staff:
  - danh sách bài được giao.
  - màn hình làm bài.
  - autosave indicator.
  - history/result theo policy.
- Admin results:
  - filter assignment/department/user/status.
  - export result.

#### Tests

- Test max attempts.
- Test autosave idempotent.
- Test submit/score.
- Test visibility không trả đáp án khi bị chặn.

#### Acceptance criteria

- User refresh khi đang làm bài không mất đáp án.
- Admin xuất được kết quả bài đã giao.

### Phase A9 - Dashboard chất lượng và vòng review lại

#### Mục tiêu

Admin thấy chất lượng câu hỏi/đề dựa trên dữ liệu làm bài thật để sửa câu yếu, câu quá dễ/quá khó hoặc câu gây nhầm.

#### Backend

- Metrics:
  - correct rate theo câu.
  - average time per question.
  - discrimination index nếu đủ dữ liệu.
  - candidate approval/save rate.
  - duplicate warning rate.
- Drilldown:
  - từ metric mở question detail.
  - từ question mở danh sách paper/attempt liên quan.
- Review loop:
  - flag question cần xem lại.
  - tạo draft revision hoặc archive sau review.

#### Frontend

- Dashboard:
  - filter theo thời gian, assignment, paper, question set, department.
  - bảng câu quá dễ/quá khó.
  - bảng câu sai nhiều.
  - bảng candidate/job quality.
- Actions:
  - mở question detail.
  - mở paper/assignment liên quan.
  - đánh dấu cần review.

#### Tests

- Test metric không double count attempt.
- Test filter assignment/department.
- Manual với seed data nhiều attempt.

#### Acceptance criteria

- Có danh sách câu hỏi cần review dựa trên dữ liệu thật.

### Phase A10 - Prompt/model/OCR governance

#### Mục tiêu

Quản trị AI đủ an toàn: biết job dùng model/prompt nào, health thế nào, benchmark ra sao, OCR production đi đường nào.

#### Backend

- Prompt template:
  - version.
  - provider/model.
  - active flag.
  - createdBy/approvedBy.
  - rollback active version.
- Model health:
  - DeepSeek configured/available.
  - E5 available/fallback.
  - VietQuill available/mock.
  - không trả secret.
- Benchmark:
  - chạy trên chunk mẫu.
  - lưu latency, token/cost, valid JSON rate, approval rate.
- OCR:
  - nếu chưa có OCR production: giữ `OCR_REQUIRED`.
  - nếu tích hợp OCR: lưu page text, confidence, warning.

#### Frontend

- Admin AI settings:
  - xem active prompt/model.
  - xem health.
  - chạy benchmark nhỏ.
  - xem lịch sử benchmark.
- OCR:
  - document `Cần OCR` hiển thị hướng xử lý.
  - sau khi có OCR, cho chạy OCR job và review text.

#### Tests

- Test health không leak API key.
- Test job/candidate ghi prompt version.
- Test fallback khi provider unavailable.

#### Acceptance criteria

- Không cần đọc log mới biết job dùng model/prompt nào.
- AI lỗi thì UI báo rõ, retry được, không treo request.

### Phase A11 - Permission, audit, performance và UAT

#### Mục tiêu

Đưa module admin evaluation tới mức có thể demo/vận hành bằng dữ liệu thật.

#### Backend

- Permission:
  - candidate approve/reject/save.
  - question create/update/approve/archive/import/export.
  - question set activate/export.
  - exam config activate.
  - exam paper publish/export answer key.
  - assignment create/export results.
  - AI settings/prompt/model.
- Audit:
  - actor, action, entity type/id.
  - before/after summary.
  - reason cho force action.
- Performance:
  - server-side pagination.
  - index cho status/createdAt/documentId/jobId/questionSetId/paperId/assignmentId.
  - tránh N+1 ở list lớn.
- Migration/UAT:
  - seed dữ liệu bệnh viện mẫu.
  - script demo end-to-end.
  - backup/restore checklist.

#### Frontend

- Hide/disable action theo permission.
- Tooltip/lý do khi disabled.
- Audit log page filter actor/action/entity/time.
- Tables lớn dùng pagination/filter backend.
- UAT script trong docs cho admin:
  - import câu hỏi.
  - tạo bộ câu hỏi.
  - tạo config.
  - sinh/publish/export đề.
  - giao bài.
  - làm bài.
  - xem/export kết quả.
  - xem dashboard.

#### Tests

- Security/controller tests cho 403.
- Test audit action nhạy cảm.
- Load test nhẹ:
  - 1k câu hỏi.
  - 10k câu hỏi nếu kịp.
  - nhiều assignment/attempt.
- Full manual UAT.

#### Acceptance criteria

- Không có action nhạy cảm nào chỉ được chặn ở frontend.
- Demo end-to-end không cần sửa DB tay.
- List lớn không tải toàn bộ dữ liệu không cần thiết.

## Thứ tự implement đề xuất từ bây giờ

1. A0 stabilize build/test.
2. A7 hoàn thiện phần đang dang dở của sinh bộ đề từ active question set snapshot.
3. A1-A2 khóa chắc luồng tạo câu hỏi từ tài liệu và lưu candidate vào ngân hàng.
4. A3-A4 polish ngân hàng câu hỏi, E5 và VietQuill.
5. A5-A6 chốt bộ câu hỏi và cấu hình đề.
6. A8 giao bài/làm bài/kết quả.
7. A9 dashboard chất lượng.
8. A10 AI governance/OCR.
9. A11 permission/audit/performance/UAT.

Ưu tiên này giữ vòng lõi chạy trước: `tài liệu -> candidate -> ngân hàng câu hỏi -> bộ câu hỏi -> cấu hình đề -> bộ đề`. Khi vòng lõi đã chắc, assignment, dashboard và governance sẽ bám vào dữ liệu thật nên ít phải sửa ngược.
