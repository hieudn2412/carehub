package vn.vietduc.carehubbackend.questiongeneration.service;

import vn.vietduc.carehubbackend.questiongeneration.entity.enums.CandidateLabel;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.CandidateStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.DocumentStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.JobStatus;

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
}
