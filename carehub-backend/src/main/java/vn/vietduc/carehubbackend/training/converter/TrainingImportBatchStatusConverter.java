package vn.vietduc.carehubbackend.training.converter;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import vn.vietduc.carehubbackend.training.enums.TrainingImportBatchStatus;

@Converter(autoApply = true)
public class TrainingImportBatchStatusConverter implements AttributeConverter<TrainingImportBatchStatus, String> {
    @Override
    public String convertToDatabaseColumn(TrainingImportBatchStatus attribute) {
        return attribute == null ? null : attribute.name();
    }

    @Override
    public TrainingImportBatchStatus convertToEntityAttribute(String dbData) {
        if (dbData == null) return null;
        try {
            return TrainingImportBatchStatus.valueOf(dbData);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException(
                    "Unknown value '" + dbData + "' for enum TrainingImportBatchStatus");
        }
    }
}
