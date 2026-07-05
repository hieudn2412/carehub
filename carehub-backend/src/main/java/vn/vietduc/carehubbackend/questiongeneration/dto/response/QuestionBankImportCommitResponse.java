package vn.vietduc.carehubbackend.questiongeneration.dto.response;

import java.util.List;

public record QuestionBankImportCommitResponse(
        Long importJobId,
        Integer totalRows,
        Integer createdCount,
        Integer skippedCount,
        Integer failedCount,
        List<QuestionBankImportRowResultResponse> rows
) {
}
