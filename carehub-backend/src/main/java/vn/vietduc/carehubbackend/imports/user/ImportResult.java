package vn.vietduc.carehubbackend.imports.user;

import lombok.Builder;

@Builder
public record ImportResult(
        int totalRows,
        int insertedUsers,
        int skippedUsers,
        int newDepartments,
        int newPositions,
        int newEducationLevels,
        long durationMs
) {}
