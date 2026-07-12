package vn.vietduc.carehubbackend.training.converter;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import vn.vietduc.carehubbackend.training.enums.TrainingImportRowStatus;

@Converter(autoApply = true)
public class TrainingImportRowStatusConverter implements AttributeConverter<TrainingImportRowStatus, String> {
    @Override
    public String convertToDatabaseColumn(TrainingImportRowStatus attribute) {
        return attribute == null ? null : attribute.name();
    }

    @Override
    public TrainingImportRowStatus convertToEntityAttribute(String dbData) {
        if (dbData == null) return null;
        try {
            return TrainingImportRowStatus.valueOf(dbData);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException(
                    "Unknown value '" + dbData + "' for enum TrainingImportRowStatus");
        }
    }
}
