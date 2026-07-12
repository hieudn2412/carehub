package vn.vietduc.carehubbackend.training.converter;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import vn.vietduc.carehubbackend.training.enums.EvidenceModerationStatus;

@Converter(autoApply = true)
public class EvidenceModerationStatusConverter implements AttributeConverter<EvidenceModerationStatus, String> {
    @Override
    public String convertToDatabaseColumn(EvidenceModerationStatus attribute) {
        return attribute == null ? null : attribute.name();
    }

    @Override
    public EvidenceModerationStatus convertToEntityAttribute(String dbData) {
        if (dbData == null) return null;
        try {
            return EvidenceModerationStatus.valueOf(dbData);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException(
                    "Unknown value '" + dbData + "' for enum EvidenceModerationStatus");
        }
    }
}
