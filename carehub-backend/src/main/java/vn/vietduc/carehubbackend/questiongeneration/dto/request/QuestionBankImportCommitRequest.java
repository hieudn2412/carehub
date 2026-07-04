package vn.vietduc.carehubbackend.questiongeneration.dto.request;

import java.util.List;

public record QuestionBankImportCommitRequest(
        Long importJobId,
        String duplicateHandlingMode,
        List<QuestionBankImportRowRequest> rows
) {
}
