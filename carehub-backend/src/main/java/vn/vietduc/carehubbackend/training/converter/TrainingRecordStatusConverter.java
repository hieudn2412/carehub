package vn.vietduc.carehubbackend.training.converter;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import vn.vietduc.carehubbackend.training.enums.TrainingRecordStatus;

@Converter(autoApply = true)
public class TrainingRecordStatusConverter implements AttributeConverter<TrainingRecordStatus, String> {
    @Override
    public String convertToDatabaseColumn(TrainingRecordStatus attribute) {
        return attribute == null ? null : attribute.name();
    }

    @Override
    public TrainingRecordStatus convertToEntityAttribute(String dbData) {
        return dbData == null ? null : TrainingRecordStatus.valueOf(dbData);
    }
}
