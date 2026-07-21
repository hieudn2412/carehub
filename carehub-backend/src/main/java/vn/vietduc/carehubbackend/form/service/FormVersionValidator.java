package vn.vietduc.carehubbackend.form.service;

import org.springframework.stereotype.Component;
import lombok.RequiredArgsConstructor;
import vn.vietduc.carehubbackend.common.response.ErrorResponse;
import vn.vietduc.carehubbackend.exception.ValidationException;
import vn.vietduc.carehubbackend.form.entity.FormOption;
import vn.vietduc.carehubbackend.form.entity.FormQuestion;
import vn.vietduc.carehubbackend.form.entity.FormSection;
import vn.vietduc.carehubbackend.form.entity.FormVersion;
import vn.vietduc.carehubbackend.form.entity.enums.FormFieldType;
import vn.vietduc.carehubbackend.form.entity.enums.FormItemType;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.math.BigDecimal;
import vn.vietduc.carehubbackend.form.scoring.FormScoringPolicy;

@Component
@RequiredArgsConstructor
public class FormVersionValidator {
    private static final Set<FormFieldType> OPTION_FIELD_TYPES = Set.of(
            FormFieldType.SINGLE_CHOICE,
            FormFieldType.MULTIPLE_CHOICE,
            FormFieldType.DROPDOWN
    );
    private final FormScoringPolicy scoringPolicy;

    public void validateDraft(FormVersion version) {
        validate(version, false);
    }

    public void validatePublishable(FormVersion version) {
        validate(version, true);
    }

    private void validate(FormVersion version, boolean publishing) {
        List<ErrorResponse.FieldErrorDetail> errors = new ArrayList<>();
        Set<UUID> sectionKeys = new HashSet<>();
        Set<UUID> itemKeys = new HashSet<>();
        Set<UUID> questionKeys = new HashSet<>();
        Set<UUID> optionKeys = new HashSet<>();
        Set<String> questionCodes = new HashSet<>();
        int scoredCriticalQuestions = 0;
        int scoredNormalQuestions = 0;

        if (publishing && version.getSections().isEmpty()) {
            add(errors, "sections", "A published form must contain at least one section");
        }

        for (int sectionIndex = 0; sectionIndex < version.getSections().size(); sectionIndex++) {
            FormSection section = version.getSections().get(sectionIndex);
            String sectionPath = "sections[" + sectionIndex + "]";
            unique(errors, sectionKeys, section.getSectionKey(), sectionPath + ".sectionKey", "Section key must be unique");
            validateOrder(errors, version.getSections(), section.getDisplayOrder(), sectionPath + ".displayOrder", FormSection::getDisplayOrder);
            if (publishing && section.getQuestions().isEmpty()) {
                add(errors, sectionPath + ".items", "A published section must contain at least one item");
            }

            for (int itemIndex = 0; itemIndex < section.getQuestions().size(); itemIndex++) {
                FormQuestion item = section.getQuestions().get(itemIndex);
                String itemPath = sectionPath + ".items[" + itemIndex + "]";
                unique(errors, itemKeys, item.getItemKey(), itemPath + ".itemKey", "Item key must be unique");
                validateOrder(errors, section.getQuestions(), item.getDisplayOrder(), itemPath + ".displayOrder", FormQuestion::getDisplayOrder);

                if (item.getItemType() != FormItemType.QUESTION) {
                    if (!item.getOptions().isEmpty()) {
                        add(errors, itemPath + ".question", "Non-question items cannot contain options");
                    }
                    continue;
                }

                FormQuestion question = item;
                String questionPath = itemPath + ".question";
                unique(errors, questionKeys, question.getQuestionKey(), questionPath + ".questionKey", "Question key must be unique");
                if (!questionCodes.add(question.getCode().toUpperCase())) {
                    add(errors, questionPath + ".code", "Question code must be unique within the version");
                }

                if (OPTION_FIELD_TYPES.contains(question.getFieldType())) {
                    if (publishing && question.getOptions().size() < 2) {
                        add(errors, questionPath + ".options", "Choice questions must contain at least two options");
                    }
                } else if (!question.getOptions().isEmpty()) {
                    add(errors, questionPath + ".options", "This field type does not support options");
                }

                if (publishing && !question.isExcludeFromScore()) {
                    if (question.getFieldType() != FormFieldType.SINGLE_CHOICE
                            && question.getFieldType() != FormFieldType.DROPDOWN) {
                        add(errors, questionPath + ".fieldType",
                                "Scored questions must use SINGLE_CHOICE or DROPDOWN");
                    }
                    if (question.getOptions().stream().anyMatch(option -> option.getScoreValue() == null)) {
                        add(errors, questionPath + ".options", "Every scored option must have a score value");
                    }
                    if (question.isCritical()) scoredCriticalQuestions++;
                    else scoredNormalQuestions++;
                }

                Set<String> optionValues = new HashSet<>();
                for (int optionIndex = 0; optionIndex < question.getOptions().size(); optionIndex++) {
                    FormOption option = question.getOptions().get(optionIndex);
                    String optionPath = questionPath + ".options[" + optionIndex + "]";
                    unique(errors, optionKeys, option.getOptionKey(), optionPath + ".optionKey", "Mã tùy chọn phải là duy nhất");
                    validateOrder(errors, question.getOptions(), option.getDisplayOrder(), optionPath + ".displayOrder", FormOption::getDisplayOrder);
                    if (!optionValues.add(option.getValue().toLowerCase())) {
                        add(errors, optionPath + ".value", "Option value must be unique within the question");
                    }
                }
            }
        }

        if (publishing && scoredCriticalQuestions > 0 && scoredNormalQuestions == 0) {
            add(errors, "sections", "A scored form cannot contain only critical questions");
        }
        if (publishing || scoringPolicy.hasConfiguredCriticalWeight(version)) {
            BigDecimal percentage = scoringPolicy.criticalWeightPercent(version);
            if (percentage.compareTo(BigDecimal.ZERO) < 0
                    || percentage.compareTo(new BigDecimal("100")) > 0
                    || Math.max(percentage.stripTrailingZeros().scale(), 0) > 0) {
                add(errors, "settings.scoring.criticalWeightPercent",
                        "Critical weight percentage must be an integer between 0 and 100");
            }
        }

        if (!errors.isEmpty()) {
            throw new ValidationException("Form version validation failed", errors);
        }
    }

    private <T> void validateOrder(
            List<ErrorResponse.FieldErrorDetail> errors,
            List<T> siblings,
            Integer displayOrder,
            String field,
            java.util.function.Function<T, Integer> orderExtractor
    ) {
        long count = siblings.stream().map(orderExtractor).filter(displayOrder::equals).count();
        if (count > 1) {
            add(errors, field, "Display order must be unique among sibling elements");
        }
    }

    private <T> void unique(
            List<ErrorResponse.FieldErrorDetail> errors,
            Set<T> seen,
            T value,
            String field,
            String message
    ) {
        if (value == null || !seen.add(value)) {
            add(errors, field, message);
        }
    }

    private void add(List<ErrorResponse.FieldErrorDetail> errors, String field, String message) {
        errors.add(ErrorResponse.FieldErrorDetail.builder().field(field).message(message).build());
    }
}
