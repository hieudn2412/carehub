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
        return dbData == null ? null : EvidenceModerationStatus.valueOf(dbData);
    }
}
