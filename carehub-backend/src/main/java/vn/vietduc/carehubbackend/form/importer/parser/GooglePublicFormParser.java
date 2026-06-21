package vn.vietduc.carehubbackend.form.importer.parser;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import vn.vietduc.carehubbackend.exception.BadRequestException;

import java.util.ArrayList;
import java.util.List;

@Component
@RequiredArgsConstructor
public class GooglePublicFormParser {
    private static final String MARKER = "var FB_PUBLIC_LOAD_DATA_ = ";
    private final ObjectMapper objectMapper;

    public GoogleFormModel parse(String formId, String html) {
        int start = html.indexOf(MARKER);
        if (start < 0) {
            throw new BadRequestException("Google Form public payload was not found");
        }
        start += MARKER.length();
        int end = html.indexOf(";</script>", start);
        if (end < 0) {
            throw new BadRequestException("Google Form public payload is incomplete");
        }
        String payload = html.substring(start, end).trim();
        String normalizedPayload = escapeControlCharactersInStrings(payload);
        try {
            JsonNode root = objectMapper.readTree(normalizedPayload);
            JsonNode form = locateFormNode(root);
            JsonNode sourceItems = form.path(1);
            if (!sourceItems.isArray()) {
                throw new BadRequestException("Google Form item list is missing");
            }
            List<GoogleFormModel.Item> items = new ArrayList<>();
            for (JsonNode item : sourceItems) {
                List<GoogleFormModel.Entry> entries = new ArrayList<>();
                JsonNode sourceEntries = item.path(4);
                if (sourceEntries.isArray()) {
                    for (JsonNode entry : sourceEntries) {
                        long entryId = entry.path(0).asLong();
                        boolean required = entry.path(2).asInt(0) == 1;
                        String rowTitle = text(entry.path(3).path(0));
                        List<String> options = parseOptions(entry.path(1));
                        entries.add(new GoogleFormModel.Entry(entryId, required, rowTitle, options));
                    }
                }
                items.add(new GoogleFormModel.Item(
                        item.path(0).asLong(), text(item.path(1)), text(item.path(2)), item.path(3).asInt(-1), entries));
            }
            String title = text(form.path(8));
            if (title == null) {
                title = text(root.path(3));
            }
            String description = text(form.path(0));
            return new GoogleFormModel(formId, title == null ? "Imported Google Form" : title,
                    description, normalizedPayload, items);
        } catch (BadRequestException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new BadRequestException(parserFailureMessage(ex));
        }
    }

    private JsonNode locateFormNode(JsonNode root) {
        JsonNode direct = root.path(1);
        if (looksLikeItemList(direct.path(1))) {
            return direct;
        }

        // Kept for older/fixture payloads where the form object is wrapped once more.
        JsonNode nested = direct.path(1);
        if (looksLikeItemList(nested.path(1))) {
            return nested;
        }
        throw new BadRequestException("Google Form item list is missing");
    }

    private boolean looksLikeItemList(JsonNode candidate) {
        if (!candidate.isArray()) {
            return false;
        }
        if (candidate.isEmpty()) {
            return true;
        }
        for (JsonNode item : candidate) {
            if (item.isArray() && item.path(0).isIntegralNumber() && item.path(3).isIntegralNumber()) {
                return true;
            }
        }
        return false;
    }

    /**
     * FB_PUBLIC_LOAD_DATA_ is a JavaScript array literal rather than guaranteed strict JSON.
     * Google Forms can leave tabs and other control characters unescaped inside string values,
     * while Jackson correctly rejects them as invalid JSON. Escape only characters inside JSON
     * strings so structural whitespace remains untouched and existing escape sequences are kept.
     */
    private String escapeControlCharactersInStrings(String payload) {
        StringBuilder normalized = new StringBuilder(payload.length());
        boolean inString = false;
        boolean escaped = false;

        for (int index = 0; index < payload.length(); index++) {
            char current = payload.charAt(index);
            if (!inString) {
                normalized.append(current);
                if (current == '"') {
                    inString = true;
                }
                continue;
            }

            if (escaped) {
                normalized.append(current);
                escaped = false;
                continue;
            }
            if (current == '\\') {
                normalized.append(current);
                escaped = true;
                continue;
            }
            if (current == '"') {
                normalized.append(current);
                inString = false;
                continue;
            }

            switch (current) {
                case '\b' -> normalized.append("\\b");
                case '\f' -> normalized.append("\\f");
                case '\n' -> normalized.append("\\n");
                case '\r' -> normalized.append("\\r");
                case '\t' -> normalized.append("\\t");
                default -> {
                    if (current < 0x20) {
                        normalized.append(String.format("\\u%04x", (int) current));
                    } else {
                        normalized.append(current);
                    }
                }
            }
        }
        return normalized.toString();
    }

    private String parserFailureMessage(Exception exception) {
        String detail = exception.getMessage();
        if (detail == null || detail.isBlank()) {
            return "Unable to parse Google Form public payload";
        }
        detail = detail.replace('\r', ' ').replace('\n', ' ').trim();
        if (detail.length() > 240) {
            detail = detail.substring(0, 240) + "...";
        }
        return "Unable to parse Google Form public payload: " + detail;
    }

    private List<String> parseOptions(JsonNode node) {
        List<String> options = new ArrayList<>();
        if (!node.isArray()) {
            return options;
        }
        for (JsonNode option : node) {
            String label = option.isArray() ? text(option.path(0)) : text(option);
            if (label != null && !label.isBlank()) {
                options.add(label);
            }
        }
        return options;
    }

    private String text(JsonNode node) {
        return node == null || node.isMissingNode() || node.isNull() ? null : node.asString();
    }
}
