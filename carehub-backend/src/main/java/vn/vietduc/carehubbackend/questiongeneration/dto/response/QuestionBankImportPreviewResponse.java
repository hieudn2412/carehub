package vn.vietduc.carehubbackend.questiongeneration.dto.response;

import java.util.List;

public record QuestionBankImportPreviewResponse(
        Long importJobId,
        List<String> sourceHeaders,
        Integer totalRows,
        Integer validRows,
        Integer invalidRows,
        Integer skippedRows,
        List<QuestionBankImportRowResultResponse> rows
) {
    public QuestionBankImportPreviewResponse(
            Long importJobId, List<String> sourceHeaders, Integer totalRows,
            Integer validRows, Integer invalidRows, List<QuestionBankImportRowResultResponse> rows
    ) {
        this(importJobId, sourceHeaders, totalRows, validRows, invalidRows, 0, rows);
    }
}
