package vn.vietduc.carehubbackend.training.dto.response;

import vn.vietduc.carehubbackend.training.enums.TrainingImportBatchStatus;

import java.time.LocalDateTime;
import java.util.List;

public record TrainingImportBatchResponse(
        Long id,
        String originalFilename,
        TrainingImportBatchStatus status,
        Integer totalRows,
        Integer successRows,
        Integer failedRows,
        Integer warningRows,
        Long importedByUserId,
        LocalDateTime importedAt,
        List<TrainingImportRowResponse> rows
) {
}
