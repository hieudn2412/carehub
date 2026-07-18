package vn.vietduc.carehubbackend.questiongeneration.service;

import vn.vietduc.carehubbackend.questiongeneration.entity.enums.CandidateLabel;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.CandidateStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.CompetencyLevel;
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
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionSetCategoryStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionSetStatus;

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
            case CREATED -> "Đã tạo";
            case GENERATING -> "Đang diễn đạt lại";
            case GENERATED -> "Đã sinh";
            case VALIDATING -> "Đang kiểm tra";
            case COMPLETED -> "Hoàn tất";
            case FAILED -> "Thất bại";
        };
    }

    public static String questionSetStatus(QuestionSetStatus status) {
        if (status == null) {
            return "";
        }
        return switch (status) {
            case DRAFT -> "Bản nháp";
            case ACTIVE -> "Hoạt động";
            case INACTIVE -> "Tạm ngưng";
            case ARCHIVED -> "Đã lưu trữ";
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

    public static String questionSetCategoryStatus(QuestionSetCategoryStatus status) {
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
            case SCORE_ONLY -> "Chỉ hiển thị điểm";
            case SCORE_AND_ANSWERS -> "Hiển thị điểm, đáp án và giải thích";
        };
    }

    public static String competencyLevel(CompetencyLevel level) {
        if (level == null) {
            return "";
        }
        return switch (level) {
            case NOT_COMPETENT -> "Chưa đạt năng lực";
            case BEGINNER -> "Sơ cấp";
            case BASIC -> "Cơ bản";
            case PROFICIENT -> "Thành thạo";
            case ADVANCED -> "Chuyên sâu";
        };
    }

    public static String competencyLevelColor(CompetencyLevel level) {
        if (level == null) {
            return "#6B7280";
        }
        return switch (level) {
            case NOT_COMPETENT -> "#EF4444";
            case BEGINNER -> "#F59E0B";
            case BASIC -> "#3B82F6";
            case PROFICIENT -> "#10B981";
            case ADVANCED -> "#8B5CF6";
        };
    }
}
