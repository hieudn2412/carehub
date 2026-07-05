package vn.vietduc.carehubbackend.questiongeneration.dto.response;

import java.time.LocalDateTime;
import java.util.List;

public record EvaluationImportJobResponse(
        Long id,
        String importType,
        String importTypeText,
        String status,
        String statusText,
        String fileName,
        String contentType,
        Long fileSize,
        String actor,
        Integer totalRows,
        Integer validRows,
        Integer invalidRows,
        Integer createdRows,
        Integer skippedRows,
        Integer failedRows,
        String errorMessage,
        LocalDateTime createdAt,
        List<EvaluationImportJobRowResponse> rows
) {
}
