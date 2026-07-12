package vn.vietduc.carehubbackend.training.service;

import org.springframework.stereotype.Component;
import vn.vietduc.carehubbackend.exception.BadRequestException;
import vn.vietduc.carehubbackend.training.enums.TrainingRecordStatus;

import java.util.EnumSet;
import java.util.Set;

@Component
public class TrainingRecordStateMachine {
    private static final Set<TrainingRecordStatus> TERMINAL_STATUSES = EnumSet.of(
            TrainingRecordStatus.CANCELLED
    );

    public boolean canTransition(TrainingRecordStatus from, TrainingRecordStatus to, boolean adminActor) {
        if (from == null || to == null || from == to || TERMINAL_STATUSES.contains(from)) {
            return false;
        }

        return switch (from) {
            case DRAFT -> to == TrainingRecordStatus.SUBMITTED || to == TrainingRecordStatus.CANCELLED;
            case SUBMITTED -> adminActor && to == TrainingRecordStatus.CANCELLED;
            case CANCELLED -> false;
        };
    }

    public void requireTransition(TrainingRecordStatus from, TrainingRecordStatus to, boolean adminActor) {
        if (!canTransition(from, to, adminActor)) {
            throw new BadRequestException("Invalid training record status transition: " + from + " -> " + to);
        }
    }

    public boolean isEditable(TrainingRecordStatus status) {
        return status == TrainingRecordStatus.DRAFT;
    }

    public void requireEditable(TrainingRecordStatus status) {
        if (!isEditable(status)) {
            throw new BadRequestException("Training record with status " + status + " cannot be edited");
        }
    }
}
