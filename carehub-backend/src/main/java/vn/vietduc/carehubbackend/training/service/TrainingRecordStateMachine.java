package vn.vietduc.carehubbackend.training.service;

import org.springframework.stereotype.Component;
import vn.vietduc.carehubbackend.exception.BadRequestException;
import vn.vietduc.carehubbackend.training.enums.TrainingRecordStatus;

@Component
public class TrainingRecordStateMachine {
    public boolean canTransition(TrainingRecordStatus from, TrainingRecordStatus to, boolean adminActor) {
        if (from == null || to == null || from == to || from == TrainingRecordStatus.CANCELLED) {
            return false;
        }

        return switch (from) {
            case DRAFT -> to == TrainingRecordStatus.SUBMITTED || to == TrainingRecordStatus.CANCELLED;
            case SUBMITTED -> to == TrainingRecordStatus.DRAFT
                    || (adminActor && to == TrainingRecordStatus.CANCELLED);
            case CANCELLED -> false;
        };
    }

    public void requireTransition(TrainingRecordStatus from, TrainingRecordStatus to, boolean adminActor) {
        if (!canTransition(from, to, adminActor)) {
            throw new BadRequestException("Không thể chuyển trạng thái hồ sơ đào tạo: " + from + " -> " + to);
        }
    }

    public boolean isEditable(TrainingRecordStatus status) {
        return status == TrainingRecordStatus.DRAFT;
    }

    public void requireEditable(TrainingRecordStatus status) {
        if (!isEditable(status)) {
            throw new BadRequestException("Hồ sơ đào tạo ở trạng thái " + status + " không thể chỉnh sửa");
        }
    }
}
