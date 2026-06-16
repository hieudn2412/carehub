package vn.vietduc.carehubbackend.training.converter;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import vn.vietduc.carehubbackend.training.enums.DurationUnit;

@Converter(autoApply = true)
public class DurationUnitConverter implements AttributeConverter<DurationUnit, String> {
    @Override
    public String convertToDatabaseColumn(DurationUnit attribute) {
        return attribute == null ? null : attribute.name();
    }

    @Override
    public DurationUnit convertToEntityAttribute(String dbData) {
        return dbData == null ? null : DurationUnit.valueOf(dbData);
    }
}
