package vn.vietduc.carehubbackend.training.service;

import org.springframework.stereotype.Component;
import vn.vietduc.carehubbackend.exception.BadRequestException;
import vn.vietduc.carehubbackend.training.enums.TrainingRecordStatus;

import java.util.EnumSet;
import java.util.Set;

@Component
public class TrainingRecordStateMachine {
    private static final Set<TrainingRecordStatus> TERMINAL_STATUSES = EnumSet.of(
            TrainingRecordStatus.APPROVED,
            TrainingRecordStatus.CANCELLED
    );

    public boolean canTransition(TrainingRecordStatus from, TrainingRecordStatus to, boolean adminActor) {
        if (from == null || to == null || from == to || TERMINAL_STATUSES.contains(from)) {
            return false;
        }

        return switch (from) {
            case DRAFT -> to == TrainingRecordStatus.PENDING_REVIEW || to == TrainingRecordStatus.CANCELLED;
            case PENDING_REVIEW -> to == TrainingRecordStatus.APPROVED
                    || to == TrainingRecordStatus.REJECTED
                    || (adminActor && to == TrainingRecordStatus.CANCELLED);
            case REJECTED -> to == TrainingRecordStatus.PENDING_REVIEW || to == TrainingRecordStatus.CANCELLED;
            case APPROVED, CANCELLED -> false;
        };
    }

    public void requireTransition(TrainingRecordStatus from, TrainingRecordStatus to, boolean adminActor) {
        if (!canTransition(from, to, adminActor)) {
            throw new BadRequestException("Invalid training record status transition: " + from + " -> " + to);
        }
    }

    public void requireRejectReason(String reason) {
        if (reason == null || reason.isBlank()) {
            throw new BadRequestException("Reject reason is required");
        }
    }
}
