-- Seed baseline professional fields and training activity types.
-- Existing rows are left untouched so admin-maintained reference data is not overwritten.

INSERT INTO professional_fields (
    code,
    name,
    description,
    is_active,
    moderation_status,
    rejection_reason,
    version,
    created_at,
    updated_at
)
VALUES
    ('QL-01', 'Quản lý điều dưỡng & Chất lượng chăm sóc', 'I. Quản lý, Công nghệ & Phát triển', true, 'APPROVED', null, 0, now(), now()),
    ('CN-02', 'Ứng dụng CNTT & Quản lý dữ liệu điều dưỡng', 'I. Quản lý, Công nghệ & Phát triển', true, 'APPROVED', null, 0, now(), now()),
    ('PC-03', 'Kiến thức nền tảng, Pháp luật & Đạo đức', 'I. Quản lý, Công nghệ & Phát triển', true, 'APPROVED', null, 0, now(), now()),
    ('GT-04', 'Giao tiếp – Ứng xử – Giáo dục sức khỏe', 'I. Quản lý, Công nghệ & Phát triển', true, 'APPROVED', null, 0, now(), now()),
    ('NC-05', 'Nghiên cứu khoa học & Điều dưỡng dựa trên bằng chứng', 'I. Quản lý, Công nghệ & Phát triển', true, 'APPROVED', null, 0, now(), now()),
    ('QT-25', 'An toàn lao động & Quản lý nguồn lực điều dưỡng', 'I. Quản lý, Công nghệ & Phát triển', true, 'APPROVED', null, 0, now(), now()),
    ('AT-06', 'An toàn phẫu thuật', 'II. An toàn & Kiểm soát lâm sàng', true, 'APPROVED', null, 0, now(), now()),
    ('AT-07', 'An toàn truyền máu & Dịch truyền', 'II. An toàn & Kiểm soát lâm sàng', true, 'APPROVED', null, 0, now(), now()),
    ('AT-08', 'Quản lý thuốc & An toàn sử dụng thuốc', 'II. An toàn & Kiểm soát lâm sàng', true, 'APPROVED', null, 0, now(), now()),
    ('KS-09', 'Kiểm soát nhiễm khuẩn', 'II. An toàn & Kiểm soát lâm sàng', true, 'APPROVED', null, 0, now(), now()),
    ('DP-10', 'Dự phòng biến chứng lâm sàng', 'II. An toàn & Kiểm soát lâm sàng', true, 'APPROVED', null, 0, now(), now()),
    ('VT-11', 'Chăm sóc vết thương & Da', 'II. An toàn & Kiểm soát lâm sàng', true, 'APPROVED', null, 0, now(), now()),
    ('CC-12', 'Hồi sức – Cấp cứu ban đầu', 'III. Chăm sóc Lâm sàng Chuyên khoa', true, 'APPROVED', null, 0, now(), now()),
    ('ICU-13', 'Chăm sóc người bệnh hồi sức tích cực (ICU)', 'III. Chăm sóc Lâm sàng Chuyên khoa', true, 'APPROVED', null, 0, now(), now()),
    ('NK-14', 'Chăm sóc người bệnh nội khoa', 'III. Chăm sóc Lâm sàng Chuyên khoa', true, 'APPROVED', null, 0, now(), now()),
    ('XK-15', 'Chăm sóc người bệnh ngoại khoa', 'III. Chăm sóc Lâm sàng Chuyên khoa', true, 'APPROVED', null, 0, now(), now()),
    ('SN-16', 'Chăm sóc người bệnh Sản – Nhi', 'III. Chăm sóc Lâm sàng Chuyên khoa', true, 'APPROVED', null, 0, now(), now()),
    ('GN-17', 'Chăm sóc giảm nhẹ & Điều dưỡng cuối đời', 'III. Chăm sóc Lâm sàng Chuyên khoa', true, 'APPROVED', null, 0, now(), now()),
    ('DD-18', 'Dinh dưỡng lâm sàng', 'III. Chăm sóc Lâm sàng Chuyên khoa', true, 'APPROVED', null, 0, now(), now()),
    ('PH-19', 'Phục hồi chức năng', 'III. Chăm sóc Lâm sàng Chuyên khoa', true, 'APPROVED', null, 0, now(), now()),
    ('CK-20', 'Điều dưỡng Thận nhân tạo & Lọc máu', 'III. Chăm sóc Lâm sàng Chuyên khoa', true, 'APPROVED', null, 0, now(), now()),
    ('CK-21', 'Điều dưỡng Ung bướu & An toàn hóa trị', 'III. Chăm sóc Lâm sàng Chuyên khoa', true, 'APPROVED', null, 0, now(), now()),
    ('CK-22', 'Điều dưỡng Chuyên khoa lẻ (Mắt-TMH-RHM)', 'III. Chăm sóc Lâm sàng Chuyên khoa', true, 'APPROVED', null, 0, now(), now()),
    ('PH-23', 'Sàng lọc (Triage), Phòng khám & Cấp cứu ngoại viện', 'III. Chăm sóc Lâm sàng Chuyên khoa', true, 'APPROVED', null, 0, now(), now()),
    ('CD-24', 'Chăm sóc sức khỏe tâm thần & Tâm lý lâm sàng', 'III. Chăm sóc Lâm sàng Chuyên khoa', true, 'APPROVED', null, 0, now(), now())
ON CONFLICT (code) DO NOTHING;

INSERT INTO training_activity_types (
    code,
    name,
    description,
    default_duration_unit,
    requires_evidence,
    max_credited_hours_per_record,
    sort_order,
    is_active,
    version,
    created_at,
    updated_at
)
VALUES
    ('ATC_1784908612334', 'Tham gia khóa đào tạo / tập huấn', 'Tham gia khóa đào tạo / tập huấn, bồi dưỡng ngắn hạn', 'HOUR', true, null, 0, true, 0, now(), now()),
    ('ATC_1784908835476', 'Tham dự hội thảo, hội nghị, tọa đàm khoa học', 'Tham dự hội thảo, hội nghị, tọa đàm khoa học', 'HOUR', true, null, 0, true, 0, now(), now()),
    ('ATC_1784908853782', 'Thực hiện đề tài nghiên cứu khoa học', 'Thực hiện đề tài nghiên cứu khoa học', 'HOUR', true, null, 0, true, 0, now(), now()),
    ('ATC_1784908883694', 'Hướng dẫn luận án, luận văn', 'Hướng dẫn luận án, luận văn', 'HOUR', true, null, 0, true, 0, now(), now()),
    ('ATC_1784908892547', 'Viết / đăng bài báo khoa học', 'Viết / đăng bài báo khoa học', 'HOUR', true, null, 0, true, 0, now(), now()),
    ('ATC_1784908907753', 'Biên soạn / xuất bản giáo trình chuyên môn', 'Biên soạn / xuất bản giáo trình chuyên môn', 'HOUR', true, null, 0, true, 0, now(), now()),
    ('ATC_1784908916910', 'Tham gia giảng dạy khóa / lớp đào tạo liên tục', 'Tham gia giảng dạy khóa / lớp đào tạo liên tục', 'HOUR', true, null, 0, true, 0, now(), now()),
    ('ATC_1784908934482', 'Đào tạo trực tuyến (E-learning)', 'Đào tạo trực tuyến (E-learning)', 'HOUR', true, null, 0, true, 0, now(), now()),
    ('EXAM_PASSED', 'Đạt bài kiểm tra năng lực', 'Tự động ghi nhận khi nhân viên đạt bài kiểm tra năng lực', 'HOUR', false, 2.00, 100, false, 0, now(), now())
ON CONFLICT (code) DO NOTHING;
