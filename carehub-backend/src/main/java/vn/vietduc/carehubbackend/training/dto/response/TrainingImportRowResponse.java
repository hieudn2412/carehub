package vn.vietduc.carehubbackend.training.dto.response;

import vn.vietduc.carehubbackend.training.enums.TrainingImportRowStatus;

import java.util.List;
import java.util.Map;

public record TrainingImportRowResponse(
        Long id,
        Integer sourceRowNumber,
        TrainingImportRowStatus validationStatus,
        Map<String, Object> rawData,
        Map<String, Object> normalizedData,
        List<String> errors,
        List<String> warnings,
        Long trainingRecordId
) {
}
