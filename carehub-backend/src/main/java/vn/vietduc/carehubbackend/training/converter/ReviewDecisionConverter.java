package vn.vietduc.carehubbackend.training.converter;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import vn.vietduc.carehubbackend.training.enums.ReviewDecision;

@Converter(autoApply = true)
public class ReviewDecisionConverter implements AttributeConverter<ReviewDecision, String> {
    @Override
    public String convertToDatabaseColumn(ReviewDecision attribute) {
        return attribute == null ? null : attribute.name();
    }

    @Override
    public ReviewDecision convertToEntityAttribute(String dbData) {
        return dbData == null ? null : ReviewDecision.valueOf(dbData);
    }
}
