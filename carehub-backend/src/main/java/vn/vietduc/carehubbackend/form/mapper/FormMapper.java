package vn.vietduc.carehubbackend.form.mapper;

import org.springframework.stereotype.Component;
import vn.vietduc.carehubbackend.form.dto.request.CreateFormVersionRequest;
import vn.vietduc.carehubbackend.form.dto.request.FormItemRequest;
import vn.vietduc.carehubbackend.form.dto.request.FormOptionRequest;
import vn.vietduc.carehubbackend.form.dto.request.FormQuestionRequest;
import vn.vietduc.carehubbackend.form.dto.request.FormSectionRequest;
import vn.vietduc.carehubbackend.form.dto.response.FormResponse;
import vn.vietduc.carehubbackend.form.dto.response.FormVersionResponse;
import vn.vietduc.carehubbackend.form.dto.response.FormVersionSummaryResponse;
import vn.vietduc.carehubbackend.form.entity.Form;
import vn.vietduc.carehubbackend.form.entity.FormOption;
import vn.vietduc.carehubbackend.form.entity.FormQuestion;
import vn.vietduc.carehubbackend.form.entity.FormSection;
import vn.vietduc.carehubbackend.form.entity.FormVersion;
import vn.vietduc.carehubbackend.form.entity.enums.FormFieldType;
import vn.vietduc.carehubbackend.form.entity.enums.FormItemType;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Component
public class FormMapper {
    public FormResponse toResponse(Form form) {
        FormResponse.DepartmentSummary department = form.getOwnerDepartment() == null
                ? null
                : FormResponse.DepartmentSummary.builder()
                .id(form.getOwnerDepartment().getId())
                .code(form.getOwnerDepartment().getDepartmentCode())
                .name(form.getOwnerDepartment().getName())
                .build();
        FormResponse.VersionSummary publishedVersion = form.getCurrentPublishedVersion() == null
                ? null
                : FormResponse.VersionSummary.builder()
                .id(form.getCurrentPublishedVersion().getId())
                .versionNumber(form.getCurrentPublishedVersion().getVersionNumber())
                .passingScore(calculatePassingScore(form.getCurrentPublishedVersion()))
                .build();

        return FormResponse.builder()
                .id(form.getId())
                .code(form.getCode())
                .title(form.getTitle())
                .description(form.getDescription())
                .subjectType(form.getSubjectType())
                .status(form.getStatus())
                .ownerDepartment(department)
                .currentPublishedVersion(publishedVersion)
                .createdAt(form.getCreatedAt())
                .updatedAt(form.getUpdatedAt())
                .build();
    }

    private java.math.BigDecimal calculatePassingScore(FormVersion version) {
        if (version == null) return null;
        List<FormQuestion> scored = version.getSections().stream()
                .flatMap(s -> s.getQuestions().stream())
                .filter(q -> q.getItemType() == FormItemType.QUESTION && !q.isExcludeFromScore())
                .toList();
        if (scored.isEmpty()) return null;

        for (FormQuestion question : scored) {
            if (question.getOptions().isEmpty() || question.getOptions().stream().anyMatch(o -> o.getScoreValue() == null)) {
                return null;
            }
        }

        List<FormQuestion> critical = scored.stream().filter(FormQuestion::isCritical).toList();
        List<FormQuestion> normal = scored.stream().filter(q -> !q.isCritical()).toList();
        
        java.math.BigDecimal criticalShare;
        Object scoring = version.getSettingsJson() == null ? null : version.getSettingsJson().get("scoring");
        Object value = scoring instanceof Map<?, ?> map ? map.get("criticalWeightPercent") : null;
        try {
            criticalShare = new java.math.BigDecimal(value == null ? "55" : String.valueOf(value))
                    .divide(new java.math.BigDecimal("100"), java.math.MathContext.DECIMAL128);
        } catch (NumberFormatException ex) {
            criticalShare = new java.math.BigDecimal("0.55");
        }

        java.math.BigDecimal scoredCoefficientTotal = java.math.BigDecimal.ZERO;
        java.math.BigDecimal criticalCoefficientTotal = java.math.BigDecimal.ZERO;
        java.math.BigDecimal normalCoefficientTotal = java.math.BigDecimal.ZERO;

        for (FormQuestion q : scored) {
            java.math.BigDecimal coef = q.getWeight() == null || q.getWeight().compareTo(java.math.BigDecimal.ZERO) <= 0 
                    ? java.math.BigDecimal.ONE : q.getWeight();
            scoredCoefficientTotal = scoredCoefficientTotal.add(coef);
            if (q.isCritical()) {
                criticalCoefficientTotal = criticalCoefficientTotal.add(coef);
            } else {
                normalCoefficientTotal = normalCoefficientTotal.add(coef);
            }
        }

        java.math.BigDecimal floor = java.math.BigDecimal.ZERO;
        java.math.BigDecimal max = java.math.BigDecimal.ZERO;

        for (FormQuestion question : scored) {
            java.math.BigDecimal coef = question.getWeight() == null || question.getWeight().compareTo(java.math.BigDecimal.ZERO) <= 0 
                    ? java.math.BigDecimal.ONE : question.getWeight();
            java.math.BigDecimal weight;
            if (critical.isEmpty() || normal.isEmpty()) {
                weight = coef.divide(scoredCoefficientTotal, java.math.MathContext.DECIMAL128);
            } else {
                weight = question.isCritical()
                        ? criticalShare.multiply(coef, java.math.MathContext.DECIMAL128).divide(criticalCoefficientTotal, java.math.MathContext.DECIMAL128)
                        : java.math.BigDecimal.ONE.subtract(criticalShare, java.math.MathContext.DECIMAL128).multiply(coef, java.math.MathContext.DECIMAL128).divide(normalCoefficientTotal, java.math.MathContext.DECIMAL128);
            }

            java.math.BigDecimal questionMax = question.getOptions().stream()
                    .map(FormOption::getScoreValue)
                    .max(java.math.BigDecimal::compareTo)
                    .orElse(java.math.BigDecimal.ZERO);

            max = max.add(questionMax.multiply(weight, java.math.MathContext.DECIMAL128), java.math.MathContext.DECIMAL128);
            floor = floor.add(weight, java.math.MathContext.DECIMAL128);
        }

        if (max.compareTo(java.math.BigDecimal.ZERO) <= 0) return null;
        return floor.multiply(new java.math.BigDecimal("10"), java.math.MathContext.DECIMAL128).divide(max, java.math.MathContext.DECIMAL128);
    }


    public FormVersionSummaryResponse toSummaryResponse(FormVersion version) {
        FormVersionResponse.UserSummary publisher = version.getPublishedBy() == null
                ? null
                : FormVersionResponse.UserSummary.builder()
                .id(version.getPublishedBy().getId())
                .employeeCode(version.getPublishedBy().getEmployeeCode())
                .name(version.getPublishedBy().getName())
                .build();

        return FormVersionSummaryResponse.builder()
                .id(version.getId())
                .versionNumber(version.getVersionNumber())
                .status(version.getStatus())
                .title(version.getTitle())
                .schemaHash(version.getSchemaHash())
                .publishedAt(version.getPublishedAt())
                .publishedBy(publisher)
                .lockVersion(version.getLockVersion())
                .createdAt(version.getCreatedAt())
                .updatedAt(version.getUpdatedAt())
                .build();
    }

    public FormVersionResponse toResponse(FormVersion version) {
        FormVersionResponse.UserSummary publisher = version.getPublishedBy() == null
                ? null
                : FormVersionResponse.UserSummary.builder()
                .id(version.getPublishedBy().getId())
                .employeeCode(version.getPublishedBy().getEmployeeCode())
                .name(version.getPublishedBy().getName())
                .build();

        return FormVersionResponse.builder()
                .id(version.getId())
                .formId(version.getForm().getId())
                .versionNumber(version.getVersionNumber())
                .status(version.getStatus())
                .title(version.getTitle())
                .description(version.getDescription())
                .settings(version.getSettingsJson())
                .passingScore(calculatePassingScore(version))
                .schemaHash(version.getSchemaHash())
                .publishedAt(version.getPublishedAt())
                .publishedBy(publisher)
                .lockVersion(version.getLockVersion())
                .sections(sorted(version.getSections(), FormSection::getDisplayOrder).stream()
                        .map(this::toSectionResponse)
                        .toList())
                .createdAt(version.getCreatedAt())
                .updatedAt(version.getUpdatedAt())
                .build();
    }

    public void replaceStructure(FormVersion version, CreateFormVersionRequest request) {
        version.setTitle(trimToNull(request.title()) == null ? version.getTitle() : request.title().trim());
        if (request.description() != null) {
            version.setDescription(trimToNull(request.description()));
        }
        if (request.settings() != null) {
            version.setSettingsJson(request.settings());
        }
        if (request.sections() == null) {
            return;
        }

        version.getSections().clear();
        request.sections().forEach(sectionRequest -> version.getSections().add(toSection(sectionRequest, version)));
    }

    public void cloneStructure(FormVersion source, FormVersion target) {
        target.setTitle(source.getTitle());
        target.setDescription(source.getDescription());
        target.setSettingsJson(copyMap(source.getSettingsJson()));
        source.getSections().forEach(section -> target.getSections().add(cloneSection(section, target)));
    }

    public Map<String, Object> toSchemaJson(FormVersion version) {
        Map<String, Object> schema = new LinkedHashMap<>();
        schema.put("versionNumber", version.getVersionNumber());
        schema.put("title", version.getTitle());
        schema.put("description", version.getDescription());
        schema.put("settings", version.getSettingsJson());
        schema.put("sections", sorted(version.getSections(), FormSection::getDisplayOrder).stream()
                .map(this::sectionSchema)
                .toList());
        return schema;
    }

    private FormSection toSection(FormSectionRequest request, FormVersion version) {
        FormSection section = FormSection.builder()
                .formVersion(version)
                .sectionKey(keyOrNew(request.sectionKey()))
                .title(request.title().trim())
                .description(trimToNull(request.description()))
                .displayOrder(request.displayOrder())
                .build();
        request.items().forEach(item -> section.getQuestions().add(toQuestionRow(item, section, version)));
        return section;
    }

    private FormQuestion toQuestionRow(FormItemRequest item, FormSection section, FormVersion version) {
        UUID itemKey = keyOrNew(item.itemKey());
        FormQuestionRequest request = item.question();
        boolean questionItem = item.itemType() == FormItemType.QUESTION && request != null;
        UUID questionKey = questionItem ? keyOrNew(request.questionKey()) : itemKey;

        FormQuestion question = FormQuestion.builder()
                .formVersion(version)
                .section(section)
                .itemKey(itemKey)
                .itemType(item.itemType())
                .displayOrder(item.displayOrder())
                .itemTitle(trimToNull(item.title()))
                .description(trimToNull(item.description()))
                .mediaUrl(trimToNull(item.mediaUrl()))
                .questionKey(questionKey)
                .code(questionItem ? request.code().trim().toUpperCase() : contentCode(itemKey))
                .metricCode(questionItem ? trimToNull(request.metricCode()) : null)
                .title(questionItem ? request.title().trim() : contentTitle(item, itemKey))
                .helpText(questionItem ? trimToNull(request.helpText()) : null)
                .fieldType(questionItem ? request.fieldType() : FormFieldType.SHORT_TEXT)
                .required(questionItem && Boolean.TRUE.equals(request.required()))
                .readOnly(!questionItem || Boolean.TRUE.equals(request.readOnly()))
                .critical(questionItem && Boolean.TRUE.equals(request.critical()))
                .excludeFromScore(!questionItem || Boolean.TRUE.equals(request.excludeFromScore()))
                .weight(questionItem ? request.weight() : null)
                .validationConfig(questionItem ? request.validationConfig() : null)
                .displayConfig(questionItem ? request.displayConfig() : null)
                .build();
        if (questionItem && request.options() != null) {
            request.options().forEach(option -> question.getOptions().add(toOption(option, question)));
        }
        return question;
    }

    private FormOption toOption(FormOptionRequest request, FormQuestion question) {
        return FormOption.builder()
                .question(question)
                .optionKey(keyOrNew(request.optionKey()))
                .value(request.value().trim())
                .label(request.label().trim())
                .scoreValue(request.scoreValue())
                .compliant(request.compliant())
                .excludeFromDenominator(Boolean.TRUE.equals(request.excludeFromDenominator()))
                .displayOrder(request.displayOrder())
                .active(true)
                .build();
    }

    private FormSection cloneSection(FormSection source, FormVersion target) {
        FormSection clone = FormSection.builder()
                .formVersion(target)
                .sectionKey(source.getSectionKey())
                .title(source.getTitle())
                .description(source.getDescription())
                .displayOrder(source.getDisplayOrder())
                .build();
        source.getQuestions().forEach(item -> clone.getQuestions().add(cloneQuestionRow(item, clone, target)));
        return clone;
    }

    private FormQuestion cloneQuestionRow(FormQuestion source, FormSection section, FormVersion version) {
        FormQuestion clone = FormQuestion.builder()
                .formVersion(version)
                .section(section)
                .itemKey(source.getItemKey())
                .itemType(source.getItemType())
                .displayOrder(source.getDisplayOrder())
                .itemTitle(source.getItemTitle())
                .description(source.getDescription())
                .mediaUrl(source.getMediaUrl())
                .questionKey(source.getQuestionKey())
                .code(source.getCode())
                .metricCode(source.getMetricCode())
                .title(source.getTitle())
                .helpText(source.getHelpText())
                .fieldType(source.getFieldType())
                .required(source.isRequired())
                .readOnly(source.isReadOnly())
                .critical(source.isCritical())
                .excludeFromScore(source.isExcludeFromScore())
                .weight(source.getWeight())
                .validationConfig(copyMap(source.getValidationConfig()))
                .displayConfig(copyMap(source.getDisplayConfig()))
                .build();
        source.getOptions().forEach(option -> clone.getOptions().add(FormOption.builder()
                .question(clone)
                .optionKey(option.getOptionKey())
                .value(option.getValue())
                .label(option.getLabel())
                .scoreValue(option.getScoreValue())
                .compliant(option.getCompliant())
                .excludeFromDenominator(option.isExcludeFromDenominator())
                .displayOrder(option.getDisplayOrder())
                .active(option.isActive())
                .build()));
        return clone;
    }

    private FormVersionResponse.SectionResponse toSectionResponse(FormSection section) {
        return FormVersionResponse.SectionResponse.builder()
                .id(section.getId())
                .sectionKey(section.getSectionKey())
                .title(section.getTitle())
                .description(section.getDescription())
                .displayOrder(section.getDisplayOrder())
                .items(sorted(section.getQuestions(), FormQuestion::getDisplayOrder).stream()
                        .map(this::toItemResponse)
                        .toList())
                .build();
    }

    private FormVersionResponse.ItemResponse toItemResponse(FormQuestion item) {
        return FormVersionResponse.ItemResponse.builder()
                .id(item.getId())
                .itemKey(item.getItemKey())
                .itemType(item.getItemType())
                .displayOrder(item.getDisplayOrder())
                .title(item.getItemTitle())
                .description(item.getDescription())
                .mediaUrl(item.getMediaUrl())
                .question(item.getItemType() == FormItemType.QUESTION ? toQuestionResponse(item) : null)
                .build();
    }

    private FormVersionResponse.QuestionResponse toQuestionResponse(FormQuestion question) {
        return FormVersionResponse.QuestionResponse.builder()
                .id(question.getId())
                .questionKey(question.getQuestionKey())
                .code(question.getCode())
                .metricCode(question.getMetricCode())
                .title(question.getTitle())
                .helpText(question.getHelpText())
                .fieldType(question.getFieldType())
                .required(question.isRequired())
                .readOnly(question.isReadOnly())
                .critical(question.isCritical())
                .excludeFromScore(question.isExcludeFromScore())
                .weight(question.getWeight())
                .validationConfig(question.getValidationConfig())
                .displayConfig(question.getDisplayConfig())
                .options(sorted(question.getOptions(), FormOption::getDisplayOrder).stream()
                        .map(this::toOptionResponse)
                        .toList())
                .build();
    }

    private FormVersionResponse.OptionResponse toOptionResponse(FormOption option) {
        return FormVersionResponse.OptionResponse.builder()
                .id(option.getId())
                .optionKey(option.getOptionKey())
                .value(option.getValue())
                .label(option.getLabel())
                .scoreValue(option.getScoreValue())
                .compliant(option.getCompliant())
                .excludeFromDenominator(option.isExcludeFromDenominator())
                .displayOrder(option.getDisplayOrder())
                .build();
    }

    private Map<String, Object> sectionSchema(FormSection section) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("sectionKey", section.getSectionKey());
        map.put("title", section.getTitle());
        map.put("description", section.getDescription());
        map.put("displayOrder", section.getDisplayOrder());
        map.put("items", sorted(section.getQuestions(), FormQuestion::getDisplayOrder).stream()
                .map(this::itemSchema)
                .toList());
        return map;
    }

    private Map<String, Object> itemSchema(FormQuestion item) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("itemKey", item.getItemKey());
        map.put("itemType", item.getItemType());
        map.put("displayOrder", item.getDisplayOrder());
        map.put("title", item.getItemTitle());
        map.put("description", item.getDescription());
        map.put("mediaUrl", item.getMediaUrl());
        map.put("question", item.getItemType() == FormItemType.QUESTION ? questionSchema(item) : null);
        return map;
    }

    private Map<String, Object> questionSchema(FormQuestion question) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("questionKey", question.getQuestionKey());
        map.put("code", question.getCode());
        map.put("metricCode", question.getMetricCode());
        map.put("title", question.getTitle());
        map.put("helpText", question.getHelpText());
        map.put("fieldType", question.getFieldType());
        map.put("required", question.isRequired());
        map.put("readOnly", question.isReadOnly());
        map.put("critical", question.isCritical());
        map.put("excludeFromScore", question.isExcludeFromScore());
        map.put("weight", question.getWeight());
        map.put("validationConfig", question.getValidationConfig());
        map.put("displayConfig", question.getDisplayConfig());
        map.put("options", sorted(question.getOptions(), FormOption::getDisplayOrder).stream()
                .map(this::optionSchema)
                .toList());
        return map;
    }

    private Map<String, Object> optionSchema(FormOption option) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("optionKey", option.getOptionKey());
        map.put("value", option.getValue());
        map.put("label", option.getLabel());
        map.put("scoreValue", option.getScoreValue());
        map.put("compliant", option.getCompliant());
        map.put("excludeFromDenominator", option.isExcludeFromDenominator());
        map.put("displayOrder", option.getDisplayOrder());
        return map;
    }

    private String contentCode(UUID itemKey) {
        return "CONTENT_" + itemKey.toString().replace("-", "").toUpperCase();
    }

    private String contentTitle(FormItemRequest item, UUID itemKey) {
        String title = trimToNull(item.title());
        return title == null ? "Nội dung " + itemKey : title;
    }

    private UUID keyOrNew(UUID key) {
        return key == null ? UUID.randomUUID() : key;
    }

    private String trimToNull(String value) {
        return value == null || value.trim().isEmpty() ? null : value.trim();
    }

    private Map<String, Object> copyMap(Map<String, Object> source) {
        return source == null ? null : new LinkedHashMap<>(source);
    }

    private <T> List<T> sorted(List<T> values, java.util.function.Function<T, Integer> order) {
        List<T> copy = new ArrayList<>(values);
        copy.sort(Comparator.comparing(order));
        return copy;
    }
}
