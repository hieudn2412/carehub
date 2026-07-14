# Phase 07 — Exam Configuration & Paper Generation

| Trạng thái | ĐÃ HOÀN THÀNH |
|------------|---------------|
| Ngày hoàn thành | 2026-07-02 (core) → 2026-07-03 (shuffle, export, duplicate) |
| Nhóm màn hình | B (Exam Management) |
| Đáp ứng đề án | Dòng 162: "thay đổi được cấu trúc đề thi trắc nghiệm: số lượng câu hỏi, tỷ lệ câu hỏi theo các lĩnh vực chuyên môn, tỷ lệ câu hỏi theo mức độ khó dễ của câu hỏi; thời gian thi" |

---

## 1. Phạm vi

Implement 2 tầng tách biệt cho bài kiểm tra:

- **ExamConfig** (Cấu hình đề kiểm tra) — **blueprint**: mô tả quy tắc sinh đề (số câu, phân bổ category/difficulty, thời gian, điểm đạt, retake policy). Có thể chỉnh sửa, có nhiều phiên bản.
- **ExamPaper** (Bộ đề kiểm tra) — **đề đã sinh**: một đề cụ thể được generate từ Config + Question Set, có **snapshot bất biến** toàn bộ nội dung câu hỏi. Sau khi publish không thay đổi, kể cả khi ngân hàng câu hỏi được cập nhật.

Đây là **khác biệt thiết kế quan trọng nhất** so với plan gốc: plan gốc gộp Config + Paper thành một entity `CompetencyTest`. Code tách rời để đảm bảo **snapshot immutability** — yêu cầu cốt lõi cho tính toàn vẹn của kỳ thi.

---

## 2. Màn hình

| ID | Màn hình | Route | Users |
|----|---------|-------|-------|
| 45 | Cấu hình đề kiểm tra | `/admin/evaluation/configs` | Admin |
| — | Danh sách bộ đề | `/admin/evaluation/exam-papers` | Admin |
| — | Sinh đề mới | `/admin/evaluation/exam-papers/new` | Admin |
| 30 | Chi tiết bộ đề | `/admin/evaluation/exam-papers/:paperId` | Admin |

---

## 3. So sánh thiết kế: Plan gốc vs Code

| Khía cạnh | Plan gốc (CompetencyTest) | Code (ExamConfig + ExamPaper) |
|-----------|--------------------------|------------------------------|
| Cấu hình | Gộp chung với đề | Tách riêng — ExamConfig là blueprint |
| Snapshot | Không đề cập | ExamPaper có snapshot bất biến khi publish |
| Chỉnh sửa sau publish | Bị chặn | Config vẫn sửa được, Paper đã publish bị khóa |
| Sinh nhiều đề từ 1 config | Không rõ ràng | 1 Config → N Papers (variantCount) |
| Tái sử dụng | Không đề cập | Config có thể dùng lại nhiều lần cho các đợt thi khác nhau |

**Lý do tách:** Nếu gộp chung, khi admin muốn sửa cấu hình (vd: tăng thời gian) cho đợt thi sau, họ sẽ vô tình ảnh hưởng đến đề đã publish của đợt trước. Tách rời đảm bảo mỗi Paper là một snapshot độc lập.

---

## 4. Business Rules

### ExamConfig
- BR-001: Config Name bắt buộc
- BR-002: `totalQuestions` > 0, là tổng số câu trong đề
- BR-003: `timeLimitMinutes` > 0
- BR-004: `passingScore` trong khoảng 0–100 (phần trăm)
- BR-005: `maxRetakes` >= 1
- BR-006: Distribution (phân bổ category/difficulty) — tổng questionCount phải bằng totalQuestions
- BR-007: Config chỉ ACTIVE khi Question Set tham chiếu đang ACTIVE và có đủ câu theo distribution
- BR-008: Status: `DRAFT` → `ACTIVE` → `INACTIVE` → `ARCHIVED`
- BR-009: `shuffleQuestions`: xáo thứ tự câu hỏi khi generate
- BR-010: `shuffleOptions`: xáo thứ tự A-D trong mỗi câu (theo seed + position)

### ExamPaper
- BR-011: Chỉ generate từ Config ACTIVE + Set ACTIVE
- BR-012: Generate dùng random seed — cùng seed + config + set → cùng kết quả (reproducible)
- BR-013: Mỗi Paper có snapshot toàn bộ nội dung câu hỏi tại thời điểm generate
- BR-014: Nếu shuffleOptions = true → A-D được xáo, correctAnswer được remap, `optionOrderJson` được lưu
- BR-015: Lifecycle: `DRAFT` → `PUBLISHED` → `ARCHIVED`
- BR-016: Published Paper **không thể sửa** — snapshot là bất biến
- BR-017: Duplicate Paper tạo bản DRAFT từ snapshot hiện có

---

## 5. Entity

### ExamConfig
| Field | Type | Mô tả |
|-------|------|-------|
| id | UUID | PK |
| name | String(200) | Tên cấu hình |
| description | Text | Mô tả |
| questionSetId | UUID → QuestionSet | Set nguồn câu hỏi |
| totalQuestions | Integer | Tổng số câu hỏi trong đề |
| timeLimitMinutes | Integer | Thời gian làm bài (phút) |
| passingScore | Integer | Điểm đạt (0-100) |
| maxRetakes | Integer | Số lần làm lại tối đa |
| shuffleQuestions | Boolean | Xáo thứ tự câu hỏi |
| shuffleOptions | Boolean | Xáo thứ tự đáp án |
| status | Enum | DRAFT / ACTIVE / INACTIVE / ARCHIVED |
| createdBy, updatedBy | String | Audit |

### ExamConfigDistribution
| Field | Type | Mô tả |
|-------|------|-------|
| id | UUID | PK |
| examConfigId | UUID → ExamConfig | FK |
| categoryId | UUID → QuestionCategory | Danh mục (nullable = any) |
| difficulty | Enum | EASY / MEDIUM / HARD (nullable = any) |
| questionCount | Integer | Số câu cho phân bổ này |
| required | Boolean | Bắt buộc |

### ExamPaper
| Field | Type | Mô tả |
|-------|------|-------|
| id | UUID | PK |
| code | String(20) | Mã đề, unique |
| name | String(200) | Tên đề |
| examConfigId | UUID → ExamConfig | Config nguồn |
| questionSetId | UUID → QuestionSet | Set nguồn |
| version | Integer | Phiên bản đề |
| randomSeed | Long | Seed để reproduce |
| status | Enum | DRAFT / PUBLISHED / ARCHIVED |
| createdBy, publishedBy | String | Audit |
| publishedAt | Timestamp | Ngày publish |

### ExamPaperQuestion + Snapshot
| Entity | Mô tả |
|--------|-------|
| `ExamPaperQuestion` | Liên kết: paperId, questionId, position, points, optionOrderJson |
| `ExamPaperQuestionSnapshot` | Nội dung bất biến: stem, optionA-D (đã xáo nếu có), correctAnswer (đã remap), explanation, difficulty, topic, sourceDocument |

---

## 6. API

### ExamConfig
| Method | Endpoint | Mô tả | Permission |
|--------|----------|-------|------------|
| GET | `/api/v1/exam-configs` | List (q, status filter) | canAccess |
| GET | `/api/v1/exam-configs/{id}` | Detail | canAccess |
| POST | `/api/v1/exam-configs` | Create | canManageExamConfig |
| PUT | `/api/v1/exam-configs/{id}` | Update | canManageExamConfig |
| POST | `/api/v1/exam-configs/{id}/activate` | Activate | canManageExamConfig |
| POST | `/api/v1/exam-configs/{id}/deactivate` | Deactivate | canManageExamConfig |
| DELETE | `/api/v1/exam-configs/{id}` | Soft archive | canManageExamConfig |
| POST | `/api/v1/exam-configs/preview` | Preview new config | canManageExamConfig |
| POST | `/api/v1/exam-configs/{id}/preview` | Preview existing | canManageExamConfig |

### ExamPaper
| Method | Endpoint | Mô tả | Permission |
|--------|----------|-------|------------|
| GET | `/api/v1/exam-papers` | List (q, status filter) | canAccess |
| GET | `/api/v1/exam-papers/{id}` | Detail + questions + snapshot | canAccess |
| POST | `/api/v1/exam-papers/generate` | Generate (input: configId, variantCount, seed) | canPublishExam |
| POST | `/api/v1/exam-papers/{id}/publish` | Publish → lock snapshot | canPublishExam |
| DELETE | `/api/v1/exam-papers/{id}` | Soft archive | canPublishExam |
| POST | `/api/v1/exam-papers/{id}/duplicate` | Duplicate → DRAFT | canPublishExam |
| GET | `/api/v1/exam-papers/{id}/export` | Export (format: txt/pdf/docx/xlsx, includeAnswers) | canPublishExam |

---

## 7. Generate Strategy

```
Input: ExamConfig (ACTIVE) + QuestionSet (ACTIVE)
        ↓
1. Đọc distribution từ ExamConfigDistribution
2. Lấy câu từ QuestionSetVersionItem (active snapshot)
3. Lọc theo category + difficulty
4. Chọn ngẫu nhiên theo random seed (reproducible)
5. Nếu shuffleOptions → xáo A-D theo seed + position, remap correctAnswer
6. Tạo ExamPaperQuestionSnapshot cho từng câu
7. Tạo N variants nếu variantCount > 1
        ↓
Output: N ExamPaper (DRAFT)
```

---

## 8. Export Formats (ExamPaper)

| Format | Thư viện | Ghi chú |
|--------|---------|---------|
| TXT | Standard | UTF-8, bao gồm/không bao gồm đáp án + giải thích |
| PDF | Apache PDFBox | Unicode font cho tiếng Việt |
| DOCX | Apache POI XWPF | Định dạng văn bản |
| XLSX | Apache POI XSSFWorkbook | Metadata sheet + Questions sheet |

Export answer key được audit-log (`EXAM_PAPER_EXPORT`) và yêu cầu permission `canPublishExam`.

---

## 9. Permission

| Vai trò | Quyền |
|---------|-------|
| Admin (EXAM_CONFIG_MANAGER) | Quản lý ExamConfig |
| Admin (EXAM_PUBLISHER) | Generate, Publish, Export ExamPaper |
| Manager | Read Only |
| Employee | No Access |

---

## 10. UI Components

### TestConfigPage
- List/Form mode: danh sách config + form tạo/sửa
- Distribution builder: thêm dòng (category, difficulty, question count, required)
- Validation hiển thị: tổng phân bổ ≠ totalQuestions → cảnh báo đỏ
- Preview: xem trước số câu match theo distribution
- Activate button + confirm dialog

### ExamPaperListPage
- Table: code, name, source config, question count, status, created date
- Filter: status, config
- Actions: View, Publish (DRAFT), Duplicate, Export dropdown (TXT/PDF/DOCX/XLSX, có/không đáp án)

### ExamPaperGeneratePage
- Chọn Config ACTIVE từ dropdown
- Chọn số lượng variants (mã đề)
- Optional: custom seed
- Preview distribution → Generate button

### ExamPaperDetailPage
- Metadata: code, name, config, set, seed, status, publish date
- Question list với numbering
- Toggle: ẩn/hiện đáp án đúng + giải thích
- Nếu shuffleOptions → hiển thị optionOrder gốc
- Export dropdown

---

## 11. Kiểm thử

| Test | Loại | Trạng thái |
|------|------|------------|
| `ExamConfigServiceTest` (validation, distribution, preview, activate) | Unit | Pass |
| `ExamPaperServiceTest` (generate reproducibility, shuffle remap, export formats, duplicate snapshot) | Unit | Pass |
| Manual: tạo config + activate + generate paper | Manual | Pass |
| Manual: publish paper → sửa câu trong bank → paper không đổi | Manual | Pass |
| Manual: export TXT/PDF/DOCX/XLSX | Manual | Pass |

---

## 12. Implementation Status

**Đã implement hoàn chỉnh** (Phase 3 + 4 + 12 cũ, 2026-07-02 đến 2026-07-03):

- ExamConfig: CRUD + distribution + activate/deactivate + preview
- ExamPaper: generate + publish + archive + duplicate
- Snapshot bất biến cho toàn bộ nội dung câu hỏi
- Shuffle options với seed cố định (reproducible)
- Multi-format export (TXT/PDF/DOCX/XLSX) với Unicode tiếng Việt
- Audit log cho export answer key

### Khác biệt chính so với plan gốc
- Plan gốc (Phase 05 cũ) gộp Config + Paper → `CompetencyTest` với question strategy MANUAL/RANDOM/QUESTION_SET/MIXED
- Code tách thành 2 tầng: ExamConfig (blueprint) + ExamPaper (đề đã sinh)
- Random strategy trong code được thực hiện qua distribution (category/difficulty) + random seed, không cần enum strategy riêng
- MIXED mode (câu bắt buộc + câu random) chưa implement → Phase 10

---

## 13. Map với đề án bệnh viện

| Yêu cầu đề án | Được đáp ứng bởi |
|--------------|-----------------|
| "Số lượng câu hỏi" (dòng 162) | ExamConfig.totalQuestions |
| "Tỷ lệ câu hỏi theo các lĩnh vực chuyên môn" (dòng 162) | ExamConfigDistribution theo category |
| "Tỷ lệ câu hỏi theo mức độ khó dễ" (dòng 162) | ExamConfigDistribution theo difficulty |
| "Thời gian thi" (dòng 162) | ExamConfig.timeLimitMinutes |
| "Thi trắc nghiệm" (dòng 102) | ExamPaper sinh từ config với snapshot Multiple Choice |

---

## 14. Liên quan

| Phase | Mối quan hệ |
|-------|-------------|
| Phase 06 | Config tham chiếu Question Set làm nguồn câu hỏi |
| Phase 02 | Distribution dùng Category |
| Phase 08 | Paper được giao cho nhân viên qua Assignment |
| Phase 10 | MIXED mode (câu bắt buộc + random), target mở rộng |
