package vn.vietduc.carehubbackend.training.service;

import vn.vietduc.carehubbackend.training.enums.TrainingRecordStatus;

import java.time.LocalDate;

public final class TrainingRecordValidity {
    private TrainingRecordValidity() {
    }

    public static LocalDate validUntil(LocalDate startDate, int windowYears) {
        return startDate == null ? null : startDate.plusYears(windowYears);
    }

    public static boolean isExpired(LocalDate startDate, LocalDate asOf, int windowYears) {
        if (startDate == null || asOf == null) {
            return false;
        }
        return startDate.isBefore(asOf.minusYears(windowYears));
    }

    public static boolean countsTowardTotal(
            LocalDate startDate,
            TrainingRecordStatus workflowStatus,
            LocalDate asOf,
            int windowYears
    ) {
        return workflowStatus == TrainingRecordStatus.SUBMITTED
                && startDate != null
                && asOf != null
                && !startDate.isAfter(asOf)
                && !isExpired(startDate, asOf, windowYears);
    }
}
