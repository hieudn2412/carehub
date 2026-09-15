INSERT INTO email_templates (
    code,
    name,
    category,
    event_type,
    audience,
    subject,
    body,
    mandatory,
    active,
    lock_version,
    created_at,
    updated_at,
    updated_by
) VALUES
(
    'CME_DEFICIT_EMPLOYEE',
    'Nhắc nhở thiếu giờ CME cho nhân viên',
    'TRAINING',
    'CME_HOURS_BELOW_REQUIREMENT',
    'EMPLOYEE',
    '[VietDuc] Nhắc nhở: Bạn còn thiếu {{missing_hours}} giờ CME',
    'Kính gửi {{recipient_name}},

Tổng giờ CME hiện tại của bạn là {{current_hours}}/{{required_hours}} giờ.
Bạn còn thiếu {{missing_hours}} giờ. Vui lòng bổ sung trước {{deadline}}.

Trân trọng,
Hệ thống VietDuc',
    true,
    true,
    0,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    'system-migration'
),
(
    'CME_DEFICIT_MANAGER',
    'Cảnh báo thiếu giờ CME cho quản lý',
    'TRAINING',
    'CME_HOURS_BELOW_REQUIREMENT',
    'MANAGER',
    '[VietDuc] Cảnh báo CME: {{employee_name}} còn thiếu {{missing_hours}} giờ',
    'Kính gửi {{manager_name}},

Nhân viên {{employee_name}} ({{employee_code}}), khoa/phòng {{department}},
hiện còn thiếu {{missing_hours}} giờ CME và cần hoàn thành trước {{deadline}}.

Trân trọng,
Hệ thống VietDuc',
    true,
    true,
    0,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    'system-migration'
),
(
    'EXAM_ASSIGNED_EMPLOYEE',
    'Thông báo giao bài thi mới',
    'EVALUATION',
    'EXAM_ASSIGNED',
    'EMPLOYEE',
    '[VietDuc] Bạn được giao bài thi: {{exam_name}}',
    'Kính gửi {{recipient_name}},

Bạn đã được giao bài thi {{exam_name}}.
Hạn hoàn thành: {{due_at}}. Số lần làm tối đa: {{max_attempts}}.

Trân trọng,
Hệ thống VietDuc',
    true,
    true,
    0,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    'system-migration'
),
(
    'QUALITY_LOW_COMPLIANCE_MANAGER',
    'Cảnh báo tỷ lệ tuân thủ thấp',
    'QUALITY',
    'QUALITY_COMPLIANCE_BELOW_TARGET',
    'MANAGER',
    '[VietDuc] Cảnh báo: Tỷ lệ tuân thủ {{department}} dưới mục tiêu',
    'Kính gửi {{manager_name}},

Tỷ lệ tuân thủ của {{department}} trong {{period}} là {{compliance_rate}}%,
thấp hơn mức mục tiêu {{target_rate}}%.

Trân trọng,
Hệ thống VietDuc',
    true,
    true,
    0,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    'system-migration'
),
(
    'PERSONAL_COMPLIANCE_EMPLOYEE',
    'Thông báo vấn đề tuân thủ cá nhân',
    'QUALITY',
    'PERSONAL_COMPLIANCE_ISSUE',
    'EMPLOYEE',
    '[VietDuc] Kết quả tuân thủ cần lưu ý: {{form_name}}',
    'Kính gửi {{recipient_name}},

Kết quả đánh giá {{form_name}} của bạn là {{result}}, điểm {{score}}.
Thời điểm ghi nhận: {{submitted_at}}. Vui lòng liên hệ quản lý để được hướng dẫn.

Trân trọng,
Hệ thống VietDuc',
    true,
    true,
    0,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    'system-migration'
)
ON CONFLICT (code) DO NOTHING;
