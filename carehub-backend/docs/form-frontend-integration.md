# CareHub Form – tài liệu tích hợp frontend

Tài liệu này là contract triển khai giao diện quản trị form, xem trước form, import Google Form và tra cứu đối tượng nhân viên. Nguồn chuẩn chi tiết của API nằm tại [`docs/openapi/form-builder-v1.yaml`](./openapi/form-builder-v1.yaml).

## 1. Phạm vi và quy ước chung

- Base URL local: `http://localhost:8081/api/v1`.
- Mọi request gửi header `Authorization: Bearer <accessToken>`.
- API quản trị form, version, preview và import yêu cầu role `ADMIN`.
- API tra cứu nhân viên cho phép `ADMIN` và `MANAGER`.
- Thời gian là chuỗi ISO-8601.
- Các danh sách dùng `page` bắt đầu từ `0`, `size` từ `1` đến `100`.
- Form và form version là hai tài nguyên khác nhau: form giữ metadata; version giữ toàn bộ cấu trúc câu hỏi.
- Một form chỉ có tối đa một version `DRAFT`. Version `PUBLISHED` không được sửa.
- Backend đã có API submission/response; dashboard chỉ đọc số liệu tổng hợp, không tải `answers` nếu không cần.

Response thành công:

```json
{
  "success": true,
  "message": "Get forms successfully",
  "data": {}
}
```

Response lỗi:

```json
{
  "error_code": "VAL_001",
  "message": "Validation failed",
  "correlation_id": "7d51fb1f-5517-4c75-b0d0-b61c829df88b",
  "details": [
    { "field": "sections[0].items[0].question.code", "message": "Question code must be unique within the version" }
  ]
}
```

Frontend nên hiển thị `message`, map `details[].field` vào input tương ứng và ghi lại `correlation_id` khi cần đối soát log backend.

## 2. Endpoint sau khi chuẩn hóa tên

| Chức năng | Method | Endpoint |
|---|---:|---|
| Danh sách form | GET | `/forms` |
| Tạo form | POST | `/forms` |
| Chi tiết metadata | GET | `/forms/{formId}` |
| Sửa metadata | PUT | `/forms/{formId}` |
| Xóa mềm form | DELETE | `/forms/{formId}` |
| Danh sách version | GET | `/forms/{formId}/versions` |
| Tạo draft version | POST | `/forms/{formId}/versions` |
| Chi tiết version | GET | `/forms/{formId}/versions/{versionId}` |
| Lưu draft version | PUT | `/forms/{formId}/versions/{versionId}` |
| Xóa draft version | DELETE | `/forms/{formId}/versions/{versionId}` |
| Publish draft | POST | `/forms/{formId}/versions/{versionId}/publication` |
| Danh sách để preview | GET | `/form-previews` |
| Chi tiết để preview | GET | `/form-previews/{formId}` |
| Tạo preview import | POST | `/form-import-batches` |
| Lịch sử import | GET | `/form-import-batches` |
| Chi tiết import | GET | `/form-import-batches/{batchId}` |
| Apply import | POST | `/form-import-batches/{batchId}/application` |
| Tìm nhân viên | GET | `/form-subjects/users?employeeCode={code}` |
| Dashboard tổng quan | GET | `/dashboard/overview` |
| Thống kê user dashboard | GET | `/dashboard/users/summary` |
| Phân bổ user theo khoa/phòng | GET | `/dashboard/users/by-department` |
| Thống kê form dashboard | GET | `/dashboard/forms/summary` |
| Hiệu suất từng form | GET | `/dashboard/forms/performance` |
| Xu hướng response form | GET | `/dashboard/forms/trend` |
| Hoạt động gần đây | GET | `/dashboard/recent-activity` |

Các URL cũ có tiền tố khác không còn là contract của module mới. Frontend cần dùng đúng các endpoint trong bảng trên.

## 3. Mô hình dữ liệu để frontend quản lý state

### 3.1 Form metadata

```ts
type FormStatus = 'DRAFT' | 'PUBLISHED' | 'RETIRED';
type FormSubjectType = 'USER' | 'PATIENT' | 'PROCESS' | 'ROOM' | 'DEPARTMENT';

interface FormSummary {
  id: number;
  code: string;
  title: string;
  description: string | null;
  subjectType: FormSubjectType;
  status: FormStatus;
  ownerDepartment: { id: number; code: string; name: string } | null;
  currentPublishedVersion: { id: number; versionNumber: number } | null;
  createdAt: string;
  updatedAt: string;
}
```

`code` là định danh nghiệp vụ, được backend chuyển thành chữ hoa và không thay đổi trong API cập nhật.

### 3.2 Cấu trúc version

```ts
type FormVersionStatus = 'DRAFT' | 'PUBLISHED' | 'RETIRED';
type FormItemType = 'QUESTION' | 'TITLE_DESCRIPTION' | 'IMAGE' | 'INSTRUCTION';

type FormFieldType =
  | 'SHORT_TEXT' | 'LONG_TEXT' | 'NUMBER'
  | 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'DROPDOWN'
  | 'BOOLEAN' | 'LINEAR_SCALE'
  | 'DATE' | 'TIME' | 'DATETIME' | 'FILE_UPLOAD'
  | 'USER_REF' | 'DEPARTMENT_REF' | 'POSITION_REF'
  | 'EDUCATION_LEVEL_REF' | 'PATIENT_REF' | 'CALCULATED';

interface FormVersion {
  id: number;
  formId: number;
  versionNumber: number;
  status: FormVersionStatus;
  title: string;
  description: string | null;
  settings: Record<string, unknown> | null;
  schemaHash: string;
  publishedAt: string | null;
  publishedBy: { id: number; employeeCode: string; name: string } | null;
  lockVersion: number;
  sections: FormSection[];
  createdAt: string;
  updatedAt: string;
}

interface FormSection {
  id: number;
  sectionKey: string;
  title: string;
  description: string | null;
  displayOrder: number;
  items: FormItem[];
}

interface FormItem {
  id: number;
  itemKey: string;
  itemType: FormItemType;
  displayOrder: number;
  title: string | null;
  description: string | null;
  mediaUrl: string | null;
  question: FormQuestion | null;
}

interface FormQuestion {
  id: number;
  questionKey: string;
  code: string;
  metricCode: string | null;
  title: string;
  helpText: string | null;
  fieldType: FormFieldType;
  required: boolean;
  readOnly: boolean;
  critical: boolean;
  excludeFromScore: boolean;
  weight: number | null;
  validationConfig: Record<string, unknown> | null;
  displayConfig: Record<string, unknown> | null;
  options: FormOption[];
}

interface FormOption {
  id: number;
  optionKey: string;
  value: string;
  label: string;
  scoreValue: number | null;
  compliant: boolean | null;
  excludeFromDenominator: boolean;
  displayOrder: number;
}
```

Khi tạo mới phần tử ở frontend có thể bỏ `sectionKey`, `itemKey`, `questionKey`, `optionKey`; backend tự sinh UUID. Sau lần lưu đầu tiên phải giữ và gửi lại các key backend trả về để định danh ổn định khi kéo thả hoặc sửa.

## 4. Màn danh sách và metadata form

### 4.1 Danh sách

```http
GET /api/v1/forms?page=0&size=20&keyword=thuoc&status=DRAFT&subjectType=USER&sort=updatedAt,desc
```

Các sort hợp lệ: `id`, `code`, `title`, `status`, `createdAt`, `updatedAt`.

```ts
interface PageData<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  sort: string[];
}
```

### 4.2 Tạo metadata

```http
POST /api/v1/forms
Content-Type: application/json
```

```json
{
  "code": "MEDICATION_SIX_RIGHTS",
  "title": "6 đúng trong an toàn sử dụng thuốc",
  "description": "Form đánh giá nội bộ",
  "subjectType": "USER",
  "ownerDepartmentId": null
}
```

Form mới luôn ở trạng thái `DRAFT`. `ownerDepartmentId` là khóa ngoại khoa/phòng; không nhập tên khoa/phòng tự do.

### 4.3 Cập nhật metadata

```http
PUT /api/v1/forms/{formId}
```

```json
{
  "title": "6 đúng trong an toàn sử dụng thuốc",
  "description": "Mô tả mới",
  "subjectType": "USER",
  "ownerDepartmentId": 12
}
```

### 4.4 Xóa form

`DELETE /forms/{formId}` trả `204 No Content`. Đây là xóa mềm và chuyển trạng thái form sang `RETIRED`; frontend quay về danh sách sau khi nhận `204`.

## 5. Form builder và quản lý version

Luồng đề xuất:

1. Tạo metadata bằng `POST /forms`.
2. Tạo draft bằng `POST /forms/{formId}/versions`.
3. Dùng response của version làm state gốc cho builder.
4. Kéo thả chỉ thay `displayOrder`; mọi phần tử cùng cấp phải có order duy nhất.
5. Lưu toàn bộ schema bằng `PUT`, luôn gửi `lockVersion` mới nhất.
6. Preview bằng `/form-previews/{formId}?versionId={versionId}`.
7. Publish khi validation thành công.

### 5.1 Tạo draft

- Body `{}`: clone version đang publish nếu có; nếu chưa có thì tạo draft rỗng.
- Có `sourceVersionId`: clone version chỉ định.
- Có `sections`: cấu trúc gửi lên thay thế toàn bộ cấu trúc clone.
- Nếu đã có draft, backend trả `409`.

```http
POST /api/v1/forms/10/versions
```

```json
{}
```

### 5.2 Lưu toàn bộ draft

```http
PUT /api/v1/forms/10/versions/21
```

```json
{
  "title": "Đánh giá an toàn thuốc",
  "description": null,
  "settings": {
    "subjectSelector": {
      "lookupBy": "employeeCode",
      "required": true,
      "displayFields": ["employeeCode", "fullName", "position", "department"],
      "readOnly": true
    },
    "evaluatorSource": "CURRENT_USER"
  },
  "sections": [
    {
      "sectionKey": "c55e401e-7c96-4e5f-9fdc-8b1562ca9e17",
      "title": "Nội dung đánh giá",
      "description": null,
      "displayOrder": 0,
      "items": [
        {
          "itemKey": "a0cc2e72-7aee-4891-945d-e28a64015b55",
          "itemType": "QUESTION",
          "displayOrder": 0,
          "title": null,
          "description": null,
          "mediaUrl": null,
          "question": {
            "questionKey": "97dbcd70-a97a-45f0-ab7c-e9c2dab859bc",
            "code": "MED_RIGHT_PATIENT",
            "metricCode": null,
            "title": "Xác định đúng người bệnh trước khi dùng thuốc?",
            "helpText": null,
            "fieldType": "SINGLE_CHOICE",
            "required": true,
            "readOnly": false,
            "critical": true,
            "excludeFromScore": false,
            "weight": 1,
            "validationConfig": null,
            "displayConfig": null,
            "options": [
              {
                "optionKey": "c53b0058-f50c-4d75-8453-ddc6008be914",
                "value": "YES",
                "label": "Có",
                "scoreValue": 1,
                "compliant": true,
                "excludeFromDenominator": false,
                "displayOrder": 0
              },
              {
                "optionKey": "0d78f794-ea10-44b8-a730-efef8abf7211",
                "value": "NO",
                "label": "Không",
                "scoreValue": 0,
                "compliant": false,
                "excludeFromDenominator": false,
                "displayOrder": 1
              }
            ]
          }
        }
      ]
    }
  ],
  "lockVersion": 0
}
```

Lưu ý quan trọng:

- `PUT` là replace toàn bộ schema, không phải patch từng câu hỏi.
- Chỉ field type `SINGLE_CHOICE`, `MULTIPLE_CHOICE`, `DROPDOWN` nhận `options`.
- Khi publish, mỗi câu choice cần ít nhất hai option.
- `code` câu hỏi phải duy nhất trong một version và chỉ gồm chữ, số, `_`, `.`, `-`.
- `displayOrder` phải duy nhất giữa các section cùng cấp, item cùng section và option cùng câu hỏi.
- `weight`, nếu có, phải lớn hơn `0`.
- Sau mỗi lần lưu, thay state bằng response mới để nhận `lockVersion` mới.
- Nếu nhận `409`, dữ liệu đã bị thay đổi ở nơi khác; tải lại version và yêu cầu người dùng hợp nhất thay đổi.

### 5.3 Publish và xóa draft

```http
POST /api/v1/forms/{formId}/versions/{versionId}/publication
```

Publish sẽ đổi version hiện tại thành `PUBLISHED`, version publish cũ thành `RETIRED`, và cập nhật `currentPublishedVersion` của form. Không gọi publish tự động sau import hoặc sau save.

```http
DELETE /api/v1/forms/{formId}/versions/{versionId}
```

Chỉ version `DRAFT` được xóa hoặc sửa.

## 6. Quy tắc render form động

Trước khi render, sort `sections`, `items`, `options` tăng dần theo `displayOrder`.

### 6.1 Render theo item type

| `itemType` | Component gợi ý |
|---|---|
| `QUESTION` | Render `item.question` theo `fieldType` |
| `TITLE_DESCRIPTION` | Heading + rich/plain description |
| `IMAGE` | Image với `mediaUrl`, title và description |
| `INSTRUCTION` | Khối hướng dẫn, không tạo answer |

### 6.2 Render theo field type

| `fieldType` | Component gợi ý | Giá trị UI |
|---|---|---|
| `SHORT_TEXT` | Input text | `string` |
| `LONG_TEXT` | Textarea | `string` |
| `NUMBER` | Input number | `number` |
| `SINGLE_CHOICE` | Radio group | `option.value` |
| `MULTIPLE_CHOICE` | Checkbox group | `option.value[]` |
| `DROPDOWN` | Select | `option.value` |
| `BOOLEAN` | Switch/Yes-No | `boolean` |
| `LINEAR_SCALE` | Radio/slider | `number`; đọc `validationConfig.min/max` |
| `DATE` | Date picker | `YYYY-MM-DD` |
| `TIME` | Time picker | `HH:mm` |
| `DATETIME` | Date-time picker | ISO-8601 |
| `FILE_UPLOAD` | Upload control | Chưa có API upload trong module này |
| `USER_REF` | User selector | `userId` |
| `DEPARTMENT_REF` | Department selector | `departmentId` |
| `POSITION_REF` | Position selector | `positionId` |
| `EDUCATION_LEVEL_REF` | Education selector | `educationLevelId` |
| `PATIENT_REF` | Patient selector | `patientId` |
| `CALCULATED` | Readonly calculated value | phụ thuộc `displayConfig` |

`required`, `readOnly`, `helpText`, `validationConfig` và `displayConfig` phải được áp dụng ở component. Các config là JSON mở; frontend nên bỏ qua key chưa hiểu thay vì làm hỏng toàn form.

## 7. Preview

```http
GET /api/v1/form-previews?page=0&size=20&keyword=thuoc
GET /api/v1/form-previews/{formId}
GET /api/v1/form-previews/{formId}?versionId={versionId}
```

Nếu không truyền `versionId`, backend chọn theo thứ tự ưu tiên: draft mới nhất, published mới nhất, rồi version còn lại mới nhất. Response chi tiết:

```json
{
  "success": true,
  "message": "Get form preview successfully",
  "data": {
    "form": {},
    "version": {}
  }
}
```

Màn preview dùng cùng renderer với màn điền form, nhưng không gửi câu trả lời và có thể hiện badge trạng thái version.

## 8. Tra cứu nhân viên bằng mã

Google Form import đã loại bỏ các câu nhập tay về mã, họ tên, tuổi, giới tính, chức danh, trình độ, khoa/phòng và người đánh giá. Frontend đọc `version.settings.subjectSelector` để quyết định hiển thị ô tra cứu.

```http
GET /api/v1/form-subjects/users?assignmentItemId=125&employeeCode=NV001
```

```json
{
  "success": true,
  "message": "Get form subject successfully",
  "data": {
    "employeeCode": "NV001",
    "fullName": "Nguyễn Văn A",
    "position": "Điều dưỡng",
    "department": "Khoa Hồi sức"
  }
}
```

Luồng UI:

1. Chỉ cho nhập `employeeCode`, gọi API khi người dùng nhấn Tìm.
2. Gửi kèm `assignmentItemId` của form đang làm; manager có thể tìm nhân viên ở mọi khoa/phòng.
3. Backend cho phép chọn nhân viên chưa active, miễn là nhân viên chưa bị xóa khỏi hệ thống.
4. Khi thành công, hiển thị đúng bốn field trong `displayFields` ở chế độ readonly.
5. Khi người dùng sửa mã, xóa subject cũ trước khi tra cứu lại.
6. `404` được hiển thị chung là “Không tìm thấy nhân viên” vì backend cố ý không phân biệt không tồn tại và không có quyền.

Hồ sơ không phải question, không được đưa vào `answers` và không tính điểm. Khi tạo submission, frontend chỉ gửi lại `employeeCode`; backend tự resolve và lưu snapshot.

## 9. Assignment và danh sách form của manager

Admin chỉ được gán version `PUBLISHED`:

```http
POST /api/v1/form-assignments
```

```json
{
  "managerId": 15,
  "validFrom": "2026-06-21T00:00:00Z",
  "validUntil": null,
  "formVersionIds": [10, 12]
}
```

Popup phân quyền ở từng form dùng API này để lấy danh sách manager đã được gán cho form:

```http
GET /api/v1/forms/{formId}/assignments?status=ACTIVE&page=0&size=20
```

Response `data.content[]` gồm `assignmentId`, `assignmentItemId`, thông tin `manager`, người gán, thời gian hiệu lực, trạng thái và version form đã gán. Frontend dùng:

- `manager.employeeCode` / `manager.fullName` để hiển thị trong popup.
- `assignmentItemId` để xóa quyền của riêng manager đó khỏi form.
- `formVersionId` / `versionNumber` để biết manager đang được ghim vào version nào.

Thêm manager trong popup vẫn gọi `POST /api/v1/form-assignments`, truyền `managerId` và `formVersionIds` là version `PUBLISHED` hiện tại của form. Xóa manager khỏi form gọi:

```http
DELETE /api/v1/form-assignment-items/{assignmentItemId}
```

Manager tải form được cấp:

```http
GET /api/v1/assigned-forms?page=0&size=20
GET /api/v1/assigned-forms/{assignmentItemId}
```

Endpoint detail trả `version` đầy đủ để renderer hiển thị đúng version đã được ghim. Version mới publish không tự thay assignment cũ.

## 10. Draft và nộp kết quả

### 10.1 Tạo draft

```http
POST /api/v1/form-submissions
```

```json
{
  "assignmentItemId": 125,
  "subject": {
    "type": "USER",
    "employeeCode": "NV001"
  }
}
```

Backend không nhận `fullName`, `position` hoặc `department` từ frontend. Mỗi manager chỉ có một draft mở cho cùng assignment item và nhân viên.

### 10.2 Lưu toàn bộ answers

```http
PUT /api/v1/form-submissions/{submissionId}
```

```json
{
  "lockVersion": 0,
  "answers": [
    {
      "questionKey": "33333333-3333-3333-3333-333333333333",
      "optionKey": "44444444-4444-4444-4444-444444444444"
    },
    {
      "questionKey": "55555555-5555-5555-5555-555555555555",
      "textValue": "Nhận xét bổ sung"
    }
  ]
}
```

`PUT` thay toàn bộ answers. Luôn cập nhật state và `lockVersion` từ response; `409` nghĩa là draft đã thay đổi ở request khác.

### 10.3 Submit

```http
POST /api/v1/form-submissions/{submissionId}/submission
```

```json
{ "lockVersion": 2 }
```

Sau submit, submission bất biến. `scoringStatus=NOT_CONFIGURED` nghĩa là backend vẫn nhận kết quả nhưng chưa tính điểm. Khi cấu hình đầy đủ, kết quả là `PASSED`, `FAILED_SCORE` hoặc `FAILED_CRITICAL`.

### 10.4 Quy tắc hiển thị điểm

- Chỉ câu `excludeFromScore=false` tham gia điểm.
- `Nhận xét`, `Nhận xét khác`, `Ghi chú` không tính điểm.
- `Vệ sinh tay`: Có = `1`, Không = `0`.
- Câu critical có điểm `-1` hoặc `0` làm toàn bài `FAILED_CRITICAL`.
- Backend tính bằng độ chính xác cao; frontend chỉ định dạng số nhận được, không tự tính lại.

Danh sách và chi tiết:

```http
GET /api/v1/form-submissions?page=0&size=20
GET /api/v1/form-submissions/{submissionId}
DELETE /api/v1/form-submissions/{submissionId}
```

Manager chỉ thấy submission do mình tạo; admin thấy tất cả. `DELETE` chỉ áp dụng cho draft và chuyển trạng thái thành `VOIDED`.

Admin xem response theo từng form hoặc từng version:

```http
GET /api/v1/forms/{formId}/responses?status=SUBMITTED&page=0&size=20
GET /api/v1/forms/{formId}/versions/{versionId}/responses?status=SUBMITTED&page=0&size=20
```

Mặc định hai API này trả danh sách summary nhẹ, `answers=[]` và `scoreBreakdown=[]`. Nếu màn hình cần tải luôn câu trả lời của từng response trong page, truyền:

```http
GET /api/v1/forms/{formId}/responses?status=SUBMITTED&includeAnswers=true&page=0&size=20
GET /api/v1/forms/{formId}/versions/{versionId}/responses?status=SUBMITTED&includeAnswers=true&page=0&size=20
```

`includeAnswers=true` chỉ nên dùng cho page nhỏ hoặc màn chi tiết/export vì response sẽ nặng hơn.
5. `MANAGER` tìm được mọi nhân viên chưa xóa khi có assignment hợp lệ; không giới hạn active hoặc khoa/phòng. `ADMIN` tìm toàn hệ thống.
6. Người đánh giá lấy từ tài khoản đăng nhập khi `evaluatorSource = CURRENT_USER`; không render input nhập người đánh giá.

## 11. Dashboard analytics API

Các API dưới đây phục vụ màn dashboard user + form. Backend đã implement nhóm endpoint này với mục tiêu dashboard load nhanh, không kéo danh sách response/câu trả lời nặng.

### 11.1 Nguyên tắc chung

- Base path: `/api/v1/dashboard`.
- Quyền mặc định: `ADMIN`. Nếu sau này mở cho `MANAGER`, backend phải tự giới hạn theo phạm vi được phép, frontend không tự filter bảo mật.
- Tất cả API chỉ trả số liệu tổng hợp hoặc item summary; không trả `answers`, `scoreBreakdown`, email, điện thoại, password hoặc dữ liệu đăng nhập nhạy cảm.
- `fromDate`/`toDate` là ngày local theo `Asia/Bangkok`. Backend convert thành khoảng `[fromDate 00:00:00, toDate + 1 ngày 00:00:00)`.
- Nếu không truyền ngày, backend mặc định lấy 30 ngày gần nhất cho phần submission/form performance.
- `departmentId` trong user stats dùng `users.department_id`. Với form response stats, nếu cần lọc theo người được đánh giá thì join `form_submission_contexts.subject_user_id -> users.department_id`; không dùng text snapshot `department` để filter chính.
- Response có `generatedAt` và `cacheTtlSeconds` để frontend biết số liệu có thể cache ngắn hạn.
- Mục tiêu hiệu năng: p95 `< 200ms` cho `/dashboard/overview`, p95 `< 300ms` cho các bảng/chart dashboard khi dữ liệu ở mức vài trăm nghìn submission.
- Backend validate `toDate >= fromDate`; khoảng ngày tối đa `366` ngày cho `bucket=DAY`, tối đa `5` năm cho `bucket=MONTH`.
- Rate limit khuyến nghị: `60 req/min/user` cho nhóm `/dashboard/**` để tránh refresh liên tục làm nóng database.
- Mọi service method dashboard dùng `@Transactional(readOnly = true)`, DTO projection/native SQL aggregate và kiểm tra `EXPLAIN ANALYZE` trước khi merge.

### 11.2 API load đầu dashboard

Frontend gọi API này đầu tiên để render KPI cards nhanh.

```http
GET /api/v1/dashboard/overview?fromDate=2026-07-01&toDate=2026-07-31&departmentId=10
```

Query params:

| Param | Bắt buộc | Ghi chú |
|---|---:|---|
| `fromDate` | Không | Mặc định 30 ngày gần nhất. |
| `toDate` | Không | Mặc định hôm nay. |
| `departmentId` | Không | Lọc user/form response theo khoa/phòng. |

Response:

```json
{
  "success": true,
  "message": "Get dashboard overview successfully",
  "data": {
    "generatedAt": "2026-07-05T10:00:00+07:00",
    "cacheTtlSeconds": 30,
    "period": {
      "fromDate": "2026-07-01",
      "toDate": "2026-07-31"
    },
    "users": {
      "total": 2600,
      "active": 2480,
      "inactive": 90,
      "locked": 30,
      "deleted": 12,
      "firstLoginPending": 120,
      "newInPeriod": 35,
      "managers": 45,
      "admins": 3
    },
    "forms": {
      "total": 18,
      "draft": 2,
      "published": 15,
      "retired": 1,
      "publishedVersions": 15,
      "activeAssignments": 40
    },
    "submissions": {
      "totalInPeriod": 320,
      "draft": 12,
      "submitted": 300,
      "voided": 8,
      "passed": 260,
      "failedScore": 25,
      "failedCritical": 15,
      "passRate": 86.67,
      "averageConvertedScore": 8.72
    }
  }
}
```

Tối ưu backend:

- Dùng DTO projection hoặc native aggregate query, không load entity `User`, `Form`, `FormSubmission`.
- Mỗi nhóm card nên là một aggregate query `count/sum(case when ...)`; không query từng status riêng lẻ.
- Cache server-side 30 giây theo key `fromDate|toDate|departmentId|roleScope`.
- Không join `form_answers` trong overview.

### 11.3 Thống kê user

```http
GET /api/v1/dashboard/users/summary?departmentId=10
```

Response:

```json
{
  "success": true,
  "message": "Get dashboard user summary successfully",
  "data": {
    "generatedAt": "2026-07-05T10:00:00+07:00",
    "cacheTtlSeconds": 60,
    "total": 2600,
    "byStatus": {
      "ACTIVE": 2480,
      "INACTIVE": 90,
      "LOCKED": 30
    },
    "deleted": 12,
    "firstLoginPending": 120,
    "withoutDepartment": 5,
    "byRole": [
      { "roleCode": "ADMIN", "roleName": "Admin", "count": 3 },
      { "roleCode": "MANAGER", "roleName": "Manager", "count": 45 }
    ]
  }
}
```

```http
GET /api/v1/dashboard/users/by-department?limit=20
```

Response:

```json
{
  "success": true,
  "message": "Get dashboard users by department successfully",
  "data": {
    "generatedAt": "2026-07-05T10:00:00+07:00",
    "cacheTtlSeconds": 60,
    "items": [
      {
        "departmentId": 10,
        "departmentCode": "ICU",
        "departmentName": "Khoa Hồi sức",
        "total": 120,
        "active": 115,
        "inactive": 3,
        "locked": 2
      }
    ]
  }
}
```

Tối ưu backend:

- `users/summary`: một query count theo status + một query group role; không fetch danh sách user.
- `users/by-department`: group by `department_id`, giới hạn `limit <= 50`.
- Index khuyến nghị:
  - `users(is_deleted, status, department_id)`
  - `users(department_id, is_deleted, status)`
  - `user_roles(user_id, role_id)`
  - `roles(code)`

### 11.4 Thống kê form và response

```http
GET /api/v1/dashboard/forms/summary?fromDate=2026-07-01&toDate=2026-07-31&departmentId=10
```

Response:

```json
{
  "success": true,
  "message": "Get dashboard form summary successfully",
  "data": {
    "generatedAt": "2026-07-05T10:00:00+07:00",
    "cacheTtlSeconds": 30,
    "forms": {
      "total": 18,
      "draft": 2,
      "published": 15,
      "retired": 1
    },
    "versions": {
      "draft": 2,
      "published": 15,
      "retired": 1
    },
    "assignments": {
      "activeItems": 40,
      "expiredItems": 3,
      "revokedItems": 5
    },
    "responses": {
      "totalInPeriod": 320,
      "submitted": 300,
      "draft": 12,
      "voided": 8,
      "passRate": 86.67,
      "averageConvertedScore": 8.72
    }
  }
}
```

```http
GET /api/v1/dashboard/forms/performance?fromDate=2026-07-01&toDate=2026-07-31&departmentId=10&sort=responseCount,desc&page=0&size=10
```

Response:

```json
{
  "success": true,
  "message": "Get dashboard form performance successfully",
  "data": {
    "content": [
      {
        "formId": 1,
        "formCode": "ENEMA",
        "formTitle": "THỤT THÁO",
        "currentPublishedVersionId": 8,
        "currentVersionNumber": 1,
        "responseCount": 42,
        "submittedCount": 40,
        "passedCount": 35,
        "failedScoreCount": 3,
        "failedCriticalCount": 2,
        "passRate": 87.5,
        "averageConvertedScore": 8.91,
        "lastSubmittedAt": "2026-07-05T09:20:00Z"
      }
    ],
    "page": 0,
    "size": 10,
    "totalElements": 18,
    "totalPages": 2
  }
}
```

Sort field cho phép: `responseCount`, `passRate`, `averageConvertedScore`, `lastSubmittedAt`, `failedCriticalCount`. Backend reject field khác bằng `VAL_001`.

```http
GET /api/v1/dashboard/forms/trend?fromDate=2026-07-01&toDate=2026-07-31&bucket=DAY&departmentId=10
```

Response:

```json
{
  "success": true,
  "message": "Get dashboard form trend successfully",
  "data": {
    "bucket": "DAY",
    "items": [
      {
        "period": "2026-07-01",
        "submittedCount": 12,
        "passedCount": 10,
        "failedCount": 2,
        "averageConvertedScore": 8.4
      }
    ]
  }
}
```

Tối ưu backend:

- Chỉ tính dashboard từ `form_submissions.status = SUBMITTED` cho pass rate/score; draft/voided chỉ count khi cần card trạng thái.
- `forms/performance` dùng aggregate theo `form_templates.id`, join qua `form_versions` và `form_submissions`; select đúng field cần hiển thị.
- `forms/trend` dùng `date_trunc`/bucket trên `submitted_at`, giới hạn tối đa 366 bucket. Nếu khoảng ngày lớn hơn 366 ngày, backend yêu cầu `bucket=MONTH`.
- Không join `form_answers`, không parse `score_breakdown` JSON cho dashboard.
- Index khuyến nghị:
  - `form_templates(deleted, status, owner_department_id)`
  - `form_versions(form_template_id, status)`
  - `form_assignment_items(form_template_id, status)`
  - `form_assignments(status, effective_from, effective_to)`
  - `form_submissions(status, submitted_at)`
  - `form_submissions(form_version_id, status, submitted_at)`
  - `form_submissions(result_status, status, submitted_at)`
  - `form_submission_contexts(subject_user_id)`

### 11.5 Hoạt động gần đây

```http
GET /api/v1/dashboard/recent-activity?type=SUBMISSION&limit=10
```

Response:

```json
{
  "success": true,
  "message": "Get dashboard recent activity successfully",
  "data": {
    "items": [
      {
        "type": "SUBMISSION",
        "occurredAt": "2026-07-05T09:20:00Z",
        "title": "Manager01 submitted THỤT THÁO",
        "formId": 1,
        "formCode": "ENEMA",
        "submissionId": 100,
        "actor": {
          "employeeCode": "MNG001",
          "fullName": "Manager01"
        }
      }
    ]
  }
}
```

`type`: `SUBMISSION`, `FORM`, `ASSIGNMENT`, hoặc bỏ trống để lấy tất cả.

Tối ưu backend:

- `limit` tối đa `20`.
- Với `type=SUBMISSION`, query trực tiếp `form_submissions` order by `submitted_at desc`.
- Nếu lấy tất cả loại hoạt động, ưu tiên query từng nguồn với `limit`, merge trong memory, rồi cắt top `limit`; không union phức tạp khi chưa có bảng audit/event chung.
- Không trả PII ngoài `employeeCode` và `fullName` tối thiểu.

### 11.6 Quy ước frontend khi gọi dashboard

1. Load đầu trang: gọi `GET /dashboard/overview`.
2. Các chart lớn gọi lazy:
   - User theo khoa/phòng: `/dashboard/users/by-department`.
   - Bảng hiệu suất form: `/dashboard/forms/performance`.
   - Biểu đồ thời gian: `/dashboard/forms/trend`.
3. Không dùng `/form-submissions?includeAnswers=true` để dựng dashboard.
4. Frontend cache response theo filter trong 30–60 giây; khi admin đổi filter ngày/khoa thì clear cache key cũ.
5. Mọi phần trăm backend trả dạng number `0..100`; frontend chỉ format, không tự tính lại.

## 12. Import Google Form

Import gồm hai bước tách biệt: preview/validate rồi apply. Không bước nào tự publish.

### 12.1 Tạo preview batch

```http
POST /api/v1/form-import-batches
```

```json
{
  "forms": [
    {
      "code": "PATIENT_IDENTIFICATION",
      "sourceUrl": "https://docs.google.com/forms/d/e/FORM_ID/viewform",
      "displayOrder": 0
    }
  ]
}
```

Giới hạn tối đa 25 form/batch. `code` và `displayOrder` không được trùng trong batch. URL phải là HTTPS public Google Form đúng định dạng.

Batch status:

| Status | Ý nghĩa UI |
|---|---|
| `PENDING`, `PROCESSING` | Đang xử lý |
| `VALIDATED` | Tất cả row có thể apply |
| `PARTIAL` | Một phần có thể apply |
| `FAILED` | Không row nào có thể apply |
| `APPLYING` | Đang ghi dữ liệu |
| `APPLIED` | Apply hoàn tất |
| `APPLIED_PARTIAL` | Apply hoàn tất nhưng có row lỗi/conflict |

Row status:

| Status | Có thể apply | Cách hiển thị |
|---|---:|---|
| `READY` | Có | Sẵn sàng |
| `WARNING` | Có | Cảnh báo; cho admin xem trước |
| `BLOCKED` | Không | Loại Google không hỗ trợ hoặc schema không hợp lệ |
| `IMPORTED` | Đã apply | Đã tạo form/draft |
| `SKIPPED` | Không cần | Source hash không đổi |
| `CONFLICT` | Không | Form đang có draft khác source |
| `FAILED` | Không | Fetch, parse hoặc apply lỗi |

`messages[]` có dạng:

```json
{
  "severity": "WARNING",
  "code": "SCORE_NOT_CONFIGURED",
  "message": "Score values must be configured before publication",
  "sourceItemId": 12345
}
```

Frontend nên hiển thị cả warning theo row. `normalizedSchema` dùng để preview trước khi apply.

### 12.2 Apply batch

Chỉ bật nút Apply khi batch là `VALIDATED` hoặc `PARTIAL` và có row `READY`/`WARNING`.

```http
POST /api/v1/form-import-batches/{batchId}/application
```

Sau apply:

- Code chưa tồn tại: tạo form `DRAFT` và draft version đầu tiên.
- Source hash không đổi: row thành `SKIPPED`.
- Source thay đổi và chưa có draft: tạo draft version mới.
- Đã có draft khác source: row thành `CONFLICT`, không ghi đè.
- Admin phải cấu hình điểm rồi publish thủ công.

## 13. Cấu trúc màn hình frontend đề xuất

| Route frontend | Mục đích | API chính |
|---|---|---|
| `/admin/forms` | Danh sách, filter, trạng thái | `GET /forms` |
| `/admin/forms/new` | Tạo metadata | `POST /forms` |
| `/admin/forms/:id/edit` | Sửa metadata, xem versions | `GET/PUT /forms/{id}` |
| `/admin/forms/:id/builder/:versionId` | Form builder | `GET/PUT /forms/{id}/versions/{versionId}` |
| `/admin/forms/:id/preview` | Preview động | `GET /form-previews/{id}` |
| `/admin/form-imports` | Lịch sử batch | `GET /form-import-batches` |
| `/admin/form-imports/new` | Nhập URL, preview, apply | `POST /form-import-batches` |

Nên dùng một `FormRenderer` chung cho preview và màn điền; form builder chỉ là lớp editor tạo ra cùng schema đó. Cách này tránh hai cách render khác nhau khi schema phát triển.

## 14. Danh sách kiểm tra triển khai frontend

- Đã thay toàn bộ API client sang `/forms`, `/form-import-batches`, `/form-subjects`.
- Có interceptor gắn JWT và xử lý `401/403`.
- Có component chung cho success envelope, error envelope và page envelope.
- Builder giữ UUID key ổn định và reindex `displayOrder` sau kéo thả.
- Save draft gửi toàn bộ schema và `lockVersion` mới nhất.
- `409` không âm thầm ghi đè state local.
- Publish có bước xác nhận và hiển thị field errors từ backend.
- Renderer hỗ trợ item không phải câu hỏi.
- Lookup nhân viên chỉ hiển thị dữ liệu readonly từ API.
- Khoa/phòng lấy từ `subject.department`, không hardcode và không cho nhập tay.
- Import hiển thị từng warning/error trước khi bật Apply.
- Không tự động publish form sau khi import.
