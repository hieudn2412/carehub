package vn.vietduc.carehubbackend.questiongeneration.service;

import vn.vietduc.carehubbackend.questiongeneration.entity.enums.CandidateLabel;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.CandidateStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.CognitiveLevel;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.DocumentStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ExamAssignmentStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ExamAttemptStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ExamConfigStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ExamPaperStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ExamResultVisibility;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.JobStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ParaphraseJobStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionBankStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionCategoryStatus;

public final class QuestionGenerationLabels {
    private QuestionGenerationLabels() {
    }

    public static String documentStatus(DocumentStatus status) {
        if (status == null) {
            return "";
        }
        return switch (status) {
            case READY -> "Sẵn sàng";
            case OCR_REQUIRED -> "Cần OCR";
            case FAILED -> "Thất bại";
        };
    }

    public static String jobStatus(JobStatus status) {
        if (status == null) {
            return "";
        }
        return switch (status) {
            case CREATED -> "Đã tạo";
            case GENERATING -> "Đang tạo";
            case GENERATED -> "Đã tạo xong";
            case PARTIALLY_COMPLETED -> "Hoàn thành một phần";
            case FAILED -> "Thất bại";
            case CANCELLED -> "Đã hủy";
        };
    }

    public static String candidateStatus(CandidateStatus status) {
        if (status == null) {
            return "";
        }
        return switch (status) {
            case GENERATED -> "Đã sinh";
            case VALIDATED -> "Đã kiểm tra";
            case NEED_REVIEW -> "Cần xem xét";
            case APPROVED -> "Đã duyệt";
            case REJECTED -> "Đã từ chối";
            case SAVED -> "Đã lưu";
        };
    }

    public static String candidateLabel(CandidateLabel label) {
        if (label == null) {
            return "";
        }
        return switch (label) {
            case GOOD -> "Đạt";
            case NEED_REVIEW -> "Cần xem xét";
            case REJECTED -> "Đã từ chối";
        };
    }

    public static String paraphraseJobStatus(ParaphraseJobStatus status) {
        if (status == null) {
            return "";
        }
        return switch (status) {
            case CREATED -> "Đang chờ xử lý";
            case GENERATING -> "Đang diễn đạt lại";
            case GENERATED -> "Đã sinh";
            case VALIDATING -> "Đang kiểm tra";
            case COMPLETED -> "Hoàn tất";
            case FAILED -> "Thất bại";
        };
    }

    public static String questionBankStatus(QuestionBankStatus status) {
        if (status == null) {
            return "";
        }
        return switch (status) {
            case DRAFT -> "Bản nháp";
            case APPROVED -> "Đã duyệt";
            case REJECTED -> "Đã từ chối";
            case ARCHIVED -> "Đã lưu trữ";
        };
    }

    public static String questionCategoryStatus(QuestionCategoryStatus status) {
        if (status == null) {
            return "";
        }
        return switch (status) {
            case ACTIVE -> "Hoạt động";
            case INACTIVE -> "Tạm ngưng";
            case ARCHIVED -> "Đã lưu trữ";
        };
    }

    public static String examConfigStatus(ExamConfigStatus status) {
        if (status == null) {
            return "";
        }
        return switch (status) {
            case DRAFT -> "Bản nháp";
            case ACTIVE -> "Đang hoạt động";
            case INACTIVE -> "Tạm ngưng";
            case ARCHIVED -> "Đã lưu trữ";
        };
    }

    public static String examPaperStatus(ExamPaperStatus status) {
        if (status == null) {
            return "";
        }
        return switch (status) {
            case DRAFT -> "Bản nháp";
            case PUBLISHED -> "Đã phát hành";
            case ARCHIVED -> "Đã lưu trữ";
        };
    }

    public static String cognitiveLevel(CognitiveLevel level) {
        if (level == null) {
            return "";
        }
        return switch (level) {
            case FOUNDATION -> "Kiến thức nền tảng";
            case CLINICAL_APPLICATION -> "Áp dụng lâm sàng";
            case CLINICAL_REASONING_ANALYSIS -> "Tư duy phân tích";
        };
    }

    public static String examAssignmentStatus(ExamAssignmentStatus status) {
        if (status == null) {
            return "";
        }
        return switch (status) {
            case DRAFT -> "Bản nháp";
            case OPEN -> "Đang mở";
            case CLOSED -> "Đã đóng";
            case ARCHIVED -> "Đã lưu trữ";
        };
    }

    public static String examAttemptStatus(ExamAttemptStatus status) {
        if (status == null) {
            return "";
        }
        return switch (status) {
            case IN_PROGRESS -> "Đang làm";
            case SUBMITTED -> "Đã nộp";
            case GRADED -> "Đã chấm";
            case EXPIRED -> "Quá hạn";
            case CANCELLED -> "Đã hủy";
        };
    }

    public static String examResultVisibility(ExamResultVisibility visibility) {
        if (visibility == null) {
            return "";
        }
        return switch (visibility) {
            case SCORE_ONLY -> "Xem điểm ngay sau khi nộp";
            case SCORE_AND_ANSWERS -> "Xem điểm và đáp án sau khi đợt thi kết thúc";
            case HIDDEN_UNTIL_END -> "Ẩn kết quả đến khi đợt thi kết thúc";
        };
    }
}
