package vn.vietduc.carehubbackend.imports.user.dto;

import lombok.Builder;
import vn.vietduc.carehubbackend.imports.user.entity.ImportLog;

import java.time.LocalDateTime;

@Builder
public record ImportLogResponse(
        Long id,
        String sourceFile,
        String status,
        int totalRows,
        int insertedRows,
        int updatedRows,
        int failedRows,
        long durationMs,
        LocalDateTime createdAt,
        String rowResultsJson
) {
    public static ImportLogResponse from(ImportLog log) {
        return ImportLogResponse.builder()
                .id(log.getId())
                .sourceFile(log.getSourceFile())
                .status(log.getStatus())
                .totalRows(log.getTotalRows())
                .insertedRows(log.getInsertedRows())
                .updatedRows(log.getUpdatedRows())
                .failedRows(log.getFailedRows())
                .durationMs(log.getDurationMs())
                .createdAt(log.getCreatedAt())
                .rowResultsJson(log.getRowResultsJson())
                .build();
    }
}
