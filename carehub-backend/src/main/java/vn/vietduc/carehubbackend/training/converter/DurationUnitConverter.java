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
        if (dbData == null) return null;
        try {
            return DurationUnit.valueOf(dbData);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException(
                    "Unknown value '" + dbData + "' for enum DurationUnit");
        }
    }
}
