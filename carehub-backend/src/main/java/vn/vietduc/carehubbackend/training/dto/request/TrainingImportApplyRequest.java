package vn.vietduc.carehubbackend.training.dto.request;

import java.util.Set;

public record TrainingImportApplyRequest(
        Boolean commitWarnings,
        Set<Long> confirmedRowIds
) {
    public boolean shouldCommitWarning(Long rowId) {
        return Boolean.TRUE.equals(commitWarnings)
                || (confirmedRowIds != null && confirmedRowIds.contains(rowId));
    }
}
