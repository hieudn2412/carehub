package vn.vietduc.carehubbackend.questiongeneration.dto.response;

import java.util.List;

public record QuestionBankImportPreviewResponse(
        Long importJobId,
        List<String> sourceHeaders,
        Integer totalRows,
        Integer validRows,
        Integer invalidRows,
        List<QuestionBankImportRowResultResponse> rows
) {
}
