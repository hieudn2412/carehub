package vn.vietduc.carehubbackend.training.converter;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import vn.vietduc.carehubbackend.training.enums.TrainingRecordChangeType;

@Converter(autoApply = true)
public class TrainingRecordChangeTypeConverter implements AttributeConverter<TrainingRecordChangeType, String> {
    @Override
    public String convertToDatabaseColumn(TrainingRecordChangeType attribute) {
        return attribute == null ? null : attribute.name();
    }

    @Override
    public TrainingRecordChangeType convertToEntityAttribute(String dbData) {
        if (dbData == null) return null;
        try {
            return TrainingRecordChangeType.valueOf(dbData);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException(
                    "Unknown value '" + dbData + "' for enum TrainingRecordChangeType");
        }
    }
}
