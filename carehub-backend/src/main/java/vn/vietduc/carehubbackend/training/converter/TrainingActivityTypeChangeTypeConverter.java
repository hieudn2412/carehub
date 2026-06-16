package vn.vietduc.carehubbackend.training.converter;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import vn.vietduc.carehubbackend.training.enums.TrainingActivityTypeChangeType;

@Converter(autoApply = true)
public class TrainingActivityTypeChangeTypeConverter implements AttributeConverter<TrainingActivityTypeChangeType, String> {
    @Override
    public String convertToDatabaseColumn(TrainingActivityTypeChangeType attribute) {
        return attribute == null ? null : attribute.name();
    }

    @Override
    public TrainingActivityTypeChangeType convertToEntityAttribute(String dbData) {
        return dbData == null ? null : TrainingActivityTypeChangeType.valueOf(dbData);
    }
}
