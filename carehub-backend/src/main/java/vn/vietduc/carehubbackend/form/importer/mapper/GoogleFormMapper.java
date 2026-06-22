package vn.vietduc.carehubbackend.form.importer.mapper;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;
import vn.vietduc.carehubbackend.form.dto.request.*;
import vn.vietduc.carehubbackend.form.entity.enums.FormFieldType;
import vn.vietduc.carehubbackend.form.entity.enums.FormItemType;
import vn.vietduc.carehubbackend.form.importer.parser.GoogleFormModel;

import java.nio.charset.StandardCharsets;
import java.math.BigDecimal;
import java.security.MessageDigest;
import java.text.Normalizer;
import java.util.*;

@Component
@RequiredArgsConstructor
public class GoogleFormMapper {
    private static final Set<String> PROFILE_TITLES = Set.of(
            "ho ten nhan vien", "ho va ten nhan vien", "ho ten dieu duong ky thuat vien",
            "ho ten dieu duong ktv", "ma nhan vien", "tuoi", "tuoi nhan vien", "gioi",
            "gioi tinh", "chuc danh", "chuc danh nghe nghiep", "trinh do", "khoa phong",
            "nguoi danh gia"
    );
    private static final Set<FormFieldType> CHOICE_TYPES = Set.of(
            FormFieldType.SINGLE_CHOICE, FormFieldType.MULTIPLE_CHOICE, FormFieldType.DROPDOWN);

    private final ObjectMapper objectMapper;

    public Mapped map(GoogleFormModel source, String sourceUrl) {
        List<Map<String, Object>> messages = new ArrayList<>();
        List<FormSectionRequest> sections = new ArrayList<>();
        List<FormItemRequest> currentItems = new ArrayList<>();
        int sectionOrder = 0;
        String sectionTitle = "Nội dung đánh giá";

        for (GoogleFormModel.Item sourceItem : source.items()) {
            if (isProfileField(sourceItem.title())) {
                continue;
            }
            if (sourceItem.type() == 8) {
                if (!currentItems.isEmpty()) {
                    sections.add(section(source, sectionTitle, sectionOrder++, currentItems));
                    currentItems = new ArrayList<>();
                }
                sectionTitle = blankToDefault(sourceItem.title(), "Phần " + (sectionOrder + 1));
                continue;
            }
            List<FormItemRequest> mapped = mapItem(source, sourceItem, currentItems.size(), messages);
            currentItems.addAll(mapped);
        }
        if (!currentItems.isEmpty() || sections.isEmpty()) {
            sections.add(section(source, sectionTitle, sectionOrder, currentItems));
        }
        if (sections.stream().allMatch(section -> section.items().isEmpty())) {
            messages.add(message("ERROR", "EMPTY_FORM", "No importable form questions were found", 0));
        }

        Map<String, Object> settings = baseSettings(source, sourceUrl, null);
        String title = limit(source.title(), 255, "Imported Google Form");
        String description = limit(source.description(), 4000, null);
        CreateFormVersionRequest canonical = CreateFormVersionRequest.builder()
                .title(title).description(description).settings(settings).sections(sections).build();
        String sourceHash = hash(canonical);
        CreateFormVersionRequest request = CreateFormVersionRequest.builder()
                .title(title).description(description)
                .settings(baseSettings(source, sourceUrl, sourceHash)).sections(sections).build();
        @SuppressWarnings("unchecked")
        Map<String, Object> schema = objectMapper.convertValue(request, Map.class);
        boolean blocked = messages.stream().anyMatch(message -> "ERROR".equals(message.get("severity")));
        return new Mapped(request, schema, sourceHash, messages, blocked);
    }

    private List<FormItemRequest> mapItem(GoogleFormModel form, GoogleFormModel.Item item, int order,
                                          List<Map<String, Object>> messages) {
        if (item.type() == 6) {
            return List.of(FormItemRequest.builder().itemKey(key(form, "item", item.id(), 0))
                    .itemType(FormItemType.TITLE_DESCRIPTION).displayOrder(order)
                    .title(limit(item.title(), 255, null)).description(limit(item.description(), 4000, null)).build());
        }
        if (item.type() == 7) {
            List<FormItemRequest> result = new ArrayList<>();
            int row = 0;
            for (GoogleFormModel.Entry entry : item.entries()) {
                String title = blankToDefault(entry.rowTitle(), item.title());
                result.add(questionItem(form, item, entry, title, order + row, row, FormFieldType.SINGLE_CHOICE, messages));
                row++;
            }
            return result;
        }
        FormFieldType fieldType = switch (item.type()) {
            case 0 -> FormFieldType.SHORT_TEXT;
            case 1 -> FormFieldType.LONG_TEXT;
            case 2 -> FormFieldType.SINGLE_CHOICE;
            case 3 -> FormFieldType.DROPDOWN;
            case 4 -> FormFieldType.MULTIPLE_CHOICE;
            case 5 -> FormFieldType.LINEAR_SCALE;
            case 9 -> FormFieldType.DATE;
            case 10 -> FormFieldType.TIME;
            case 13 -> FormFieldType.FILE_UPLOAD;
            default -> null;
        };
        if (fieldType == null) {
            if (item.type() == 11) {
                return List.of(FormItemRequest.builder().itemKey(key(form, "item", item.id(), 0))
                        .itemType(FormItemType.IMAGE).displayOrder(order).title(item.title())
                        .description(item.description()).build());
            }
            messages.add(message("ERROR", "UNSUPPORTED_ITEM_TYPE", "Unsupported Google item type " + item.type(), item.id()));
            return List.of();
        }
        GoogleFormModel.Entry entry = item.entries().isEmpty()
                ? new GoogleFormModel.Entry(item.id(), false, null, List.of()) : item.entries().get(0);
        return List.of(questionItem(form, item, entry, item.title(), order, 0, fieldType, messages));
    }

    private FormItemRequest questionItem(GoogleFormModel form, GoogleFormModel.Item item,
                                         GoogleFormModel.Entry entry, String title, int order, int row,
                                         FormFieldType fieldType, List<Map<String, Object>> messages) {
        boolean noteQuestion = isNonScoringNote(title);
        boolean excludedFromScore = noteQuestion || isNonScoringContext(title);
        boolean handHygieneQuestion = isHandHygieneQuestion(title);
        List<FormOptionRequest> options = new ArrayList<>();
        for (int i = 0; i < entry.options().size(); i++) {
            if (CHOICE_TYPES.contains(fieldType)) {
                String label = limit(entry.options().get(i), 1000, "Option " + (i + 1));
                BigDecimal score = scoreForLabel(label);
                String value = handHygieneQuestion ? handHygieneValue(label) : "OPT_" + i;
                options.add(FormOptionRequest.builder()
                        .optionKey(key(form, "option", entry.id(), i)).value(value)
                        .label(label).scoreValue(score).displayOrder(i).build());
            }
        }
        if (CHOICE_TYPES.contains(fieldType)) {
            if (options.size() < 2) {
                messages.add(message("ERROR", "CHOICE_OPTIONS_MISSING",
                        "Choice questions require at least two options", entry.id()));
            }
            if (!excludedFromScore && options.stream().anyMatch(option -> option.scoreValue() == null)) {
                messages.add(message("WARNING", "SCORE_NOT_CONFIGURED",
                        "Score values must be configured before publication", entry.id()));
            }
        }
        String code = "GF_" + entry.id() + (item.type() == 7 ? "_" + row : "");
        FormQuestionRequest question = FormQuestionRequest.builder()
                .questionKey(key(form, "question", entry.id(), row)).code(code)
                .title(limit(blankToDefault(title, "Câu hỏi " + entry.id()), 2000, "Câu hỏi " + entry.id()))
                .helpText(limit(item.description(), 4000, null)).fieldType(fieldType)
                .required(!noteQuestion && entry.required())
                .critical(!excludedFromScore && isCriticalTitle(title)).excludeFromScore(excludedFromScore)
                .validationConfig(fieldType == FormFieldType.LINEAR_SCALE && !entry.options().isEmpty()
                        ? Map.of("min", 1, "max", entry.options().size()) : null)
                .options(options).build();
        return FormItemRequest.builder().itemKey(key(form, "item", item.id(), row))
                .itemType(FormItemType.QUESTION).displayOrder(order).question(question).build();
    }

    private FormSectionRequest section(GoogleFormModel form, String title, int order, List<FormItemRequest> items) {
        List<FormItemRequest> reordered = new ArrayList<>();
        for (int i = 0; i < items.size(); i++) {
            FormItemRequest item = items.get(i);
            reordered.add(FormItemRequest.builder().itemKey(item.itemKey()).itemType(item.itemType())
                    .displayOrder(i).title(item.title()).description(item.description()).mediaUrl(item.mediaUrl())
                    .question(item.question()).build());
        }
        return FormSectionRequest.builder().sectionKey(key(form, "section", order, 0))
                .title(limit(title, 255, "Phần " + (order + 1))).displayOrder(order).items(reordered).build();
    }

    private Map<String, Object> baseSettings(GoogleFormModel source, String sourceUrl, String sourceHash) {
        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("sourceType", "GOOGLE_PUBLIC");
        metadata.put("sourceFormId", source.formId());
        metadata.put("sourceUrl", sourceUrl);
        if (sourceHash != null) metadata.put("sourceHash", sourceHash);
        Map<String, Object> selector = new LinkedHashMap<>();
        selector.put("lookupBy", "employeeCode");
        selector.put("required", true);
        selector.put("displayFields", List.of("employeeCode", "fullName", "position", "department"));
        selector.put("readOnly", true);
        Map<String, Object> settings = new LinkedHashMap<>();
        settings.put("subjectSelector", selector);
        settings.put("evaluatorSource", "CURRENT_USER");
        settings.put("importMetadata", metadata);
        return settings;
    }

    private String hash(CreateFormVersionRequest request) {
        try {
            byte[] bytes = objectMapper.writeValueAsBytes(request);
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (Exception ex) {
            throw new IllegalStateException("Unable to calculate source hash", ex);
        }
    }

    private UUID key(GoogleFormModel form, String kind, long id, int index) {
        return UUID.nameUUIDFromBytes(("google:" + form.formId() + ":" + kind + ":" + id + ":" + index)
                .getBytes(StandardCharsets.UTF_8));
    }

    private boolean isProfileField(String title) {
        if (title == null) return false;
        String normalized = normalize(title).replaceFirst("^\\d+\\s+", "");
        return PROFILE_TITLES.contains(normalized);
    }

    private boolean isNonScoringNote(String title) {
        String normalized = normalize(title).replaceFirst("^\\d+\\s+", "");
        return normalized.equals("ghi chu") || normalized.equals("nhan xet")
                || normalized.equals("nhan xet khac") || normalized.startsWith("ghi chu ")
                || normalized.startsWith("nhan xet ");
    }

    private boolean isHandHygieneQuestion(String title) {
        return normalize(title).replaceFirst("^\\d+\\s+", "").equals("ve sinh tay");
    }

    private boolean isNonScoringContext(String title) {
        String normalized = normalize(title).replaceFirst("^\\d+\\s+", "");
        return normalized.equals("thoi diem ve sinh tay") || normalized.equals("thoi diem dinh danh");
    }

    private boolean isCriticalTitle(String title) {
        return title != null && title.trim().matches(".*(?:\\*|\\(\\*\\))\\s*$");
    }

    private BigDecimal scoreForLabel(String label) {
        return switch (normalize(label)) {
            case "khong thuc hien" -> new BigDecimal("-1");
            case "khong dat", "thuc hien nhung khong dat", "khong ve sinh tay" -> BigDecimal.ZERO;
            case "dat", "co ve sinh tay" -> BigDecimal.ONE;
            case "tot" -> new BigDecimal("1.2");
            case "rat tot" -> new BigDecimal("1.5");
            default -> null;
        };
    }

    private String handHygieneValue(String label) {
        return switch (normalize(label)) {
            case "co ve sinh tay" -> "YES";
            case "khong ve sinh tay" -> "NO";
            default -> "OPT_" + Math.abs(normalize(label).hashCode());
        };
    }

    private String normalize(String value) {
        if (value == null) return "";
        return Normalizer.normalize(value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "").replace('đ', 'd').replace('Đ', 'D')
                .toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", " ").trim();
    }

    private Map<String, Object> message(String severity, String code, String text, long sourceItemId) {
        return Map.of("severity", severity, "code", code, "message", text, "sourceItemId", sourceItemId);
    }

    private String blankToDefault(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.trim();
    }

    private String limit(String value, int max, String fallback) {
        if (value == null || value.isBlank()) return fallback;
        String trimmed = value.trim();
        return trimmed.length() <= max ? trimmed : trimmed.substring(0, max);
    }

    public record Mapped(CreateFormVersionRequest request, Map<String, Object> schema, String sourceHash,
                         List<Map<String, Object>> messages, boolean blocked) {
    }
}
