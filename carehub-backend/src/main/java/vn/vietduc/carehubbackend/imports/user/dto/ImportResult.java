package vn.vietduc.carehubbackend.imports.user.dto;

import lombok.Builder;

import java.util.List;

@Builder
public record ImportResult(
        Long importLogId,
        int totalRows,
        int insertedUsers,
        int updatedUsers,
        int skippedUsers,
        int failedRows,
        int newDepartments,
        int newPositions,
        int newEducationLevels,
        long durationMs,
        List<ImportRowResult> rowResults
) {}
