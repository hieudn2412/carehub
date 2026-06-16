package vn.vietduc.carehubbackend.training.converter;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import vn.vietduc.carehubbackend.training.enums.TrainingSourceType;

@Converter(autoApply = true)
public class TrainingSourceTypeConverter implements AttributeConverter<TrainingSourceType, String> {
    @Override
    public String convertToDatabaseColumn(TrainingSourceType attribute) {
        return attribute == null ? null : attribute.name();
    }

    @Override
    public TrainingSourceType convertToEntityAttribute(String dbData) {
        return dbData == null ? null : TrainingSourceType.valueOf(dbData);
    }
}
