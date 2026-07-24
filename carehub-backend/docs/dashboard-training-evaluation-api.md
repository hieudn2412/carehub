# Dashboard đào tạo và lý thuyết

Tất cả response dùng envelope `ApiResponse<T>` hiện có của hệ thống.

## Dashboard đào tạo

### `GET /api/v1/dashboard/training/summary`

Quyền truy cập: `ADMIN`, `MANAGER`.

Tham số:

| Tên | Kiểu | Bắt buộc | Ý nghĩa |
| --- | --- | --- | --- |
| `departmentId` | `long` | Không | Khoa/phòng; Manager luôn bị giới hạn về khoa của mình |
| `professionalFieldId` | `long` | Không | Lĩnh vực chuyên môn |
| `complianceStatus` | enum | Không | `COMPLIANT`, `AT_RISK`, `NON_COMPLIANT`, `NOT_CONFIGURED` |
| `asOf` | `date` | Không | Ngày chốt số liệu, mặc định ngày hiện tại |

Response trả tổng số nhân viên, số đã/chưa cấu hình chuẩn, số đạt/có nguy cơ/chưa đạt,
tổng giờ yêu cầu, đã hoàn thành, còn thiếu, tiến độ trung bình, tỷ lệ đạt và breakdown theo khoa.
Chuẩn giờ được xác định theo `TrainingRequirement` áp dụng cho từng nhân viên, không dùng mục tiêu cố định.

## Dashboard lý thuyết

### `GET /api/v1/evaluation-dashboard/exam-overview`

Quyền truy cập: `ADMIN`, `MANAGER` có quyền `RESULT_VIEWER` hoặc `EXAM_PUBLISHER`.

Tham số:

| Tên | Kiểu | Bắt buộc | Ý nghĩa |
| --- | --- | --- | --- |
| `fromDate`, `toDate` | ISO date-time | Không | Khoảng thời gian bắt đầu làm bài |
| `paperId` | `long` | Không | Đề thi |
| `assignmentId` | `long` | Không | Đợt kiểm tra |
| `departmentId` | `long` | Không | Khoa/phòng; Manager luôn bị giới hạn về khoa của mình |
| `professionalFieldId` | `long` | Không | Lĩnh vực chuyên môn |
| `employeeId` | `long` | Không | Nhân viên |
| `resultStatus` | enum | Không | `PASSED`, `FAILED` |

Response gồm số đợt, số lượt được phân công, số lượt chưa từng bắt đầu, tổng hợp attempt,
breakdown theo lĩnh vực, breakdown theo đề và danh sách nhân viên dùng cho bộ lọc.
Đợt kiểm tra `ARCHIVED` không được tính vào phạm vi dashboard hoạt động.

## Dashboard tổng quan Manager

### `GET /api/v1/dashboard/manager/overview`

Quyền truy cập: `MANAGER`, `ADMIN`. Với Manager, backend luôn dùng khoa/phòng của tài khoản
và không nhận `departmentId` từ client.

Tham số:

| Tên | Kiểu | Bắt buộc | Ý nghĩa |
| --- | --- | --- | --- |
| `fromDate`, `toDate` | `date` | Không | Khoảng thời gian của kết quả lý thuyết và checklist; mặc định 30 ngày |
| `allTime` | `boolean` | Không | Khi `true`, lấy toàn bộ lịch sử lý thuyết và checklist |
| `professionalFieldId` | `long` | Không | Áp dụng cho đào tạo và lý thuyết |

Response trả cùng lúc ba miền dữ liệu:

- `training`: snapshot chuẩn đào tạo tại ngày hiện tại, gồm cả số nhân viên cần chú ý và tỷ lệ đạt trên toàn khoa.
- `theory`: lượt được phân công, chưa bắt đầu, đã chấm, đạt và chưa đạt. Trường `available` là `false`
  nếu tài khoản không có `RESULT_VIEWER` hoặc `EXAM_PUBLISHER`.
- `quality`: số checklist đã nộp, đạt, chưa đạt, lỗi điểm, lỗi câu trọng yếu và điểm trung bình.

Checklist hiện chưa có quan hệ với lĩnh vực chuyên môn nên
`quality.professionalFieldFilterApplied` luôn là `false`.
