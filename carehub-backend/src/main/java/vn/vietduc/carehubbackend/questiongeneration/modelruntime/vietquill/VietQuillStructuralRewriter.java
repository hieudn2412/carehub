package vn.vietduc.carehubbackend.questiongeneration.modelruntime.vietquill;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Safe structural rewrites for common Vietnamese assessment-question forms.
 * These transformations move complete clauses rather than replacing clinical
 * terms, which provides real syntactic diversity without changing the answer.
 */
final class VietQuillStructuralRewriter {
    private static final Pattern LEADING_CONTEXT = Pattern.compile(
            "^(Khi|Trước khi|Sau khi|Trong khi|Nếu|Trong trường hợp)\\s+(.+?),\\s*(.+?)([?!.]?)$",
            Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE
    );
    private static final Pattern PURPOSE_QUESTION = Pattern.compile(
            "^(.+?)\\s+cần\\s+làm\\s+gì\\s+để\\s+(.+?)([?]?)$",
            Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE
    );
    private static final Pattern PURPOSE_DEFINITION = Pattern.compile(
            "^Mục đích của\\s+(.+?)\\s+là\\s+gì([?]?)$",
            Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE
    );

    List<String> rewrite(String source) {
        String value = safe(source);
        if (value.isBlank()) {
            return List.of();
        }

        List<String> results = new ArrayList<>();
        addLeadingContextRewrite(value, results);
        addPurposeRewrite(value, results);
        addPurposeDefinitionRewrite(value, results);
        return results.stream().distinct().toList();
    }

    private void addLeadingContextRewrite(String source, List<String> results) {
        Matcher matcher = LEADING_CONTEXT.matcher(source);
        if (!matcher.matches()) {
            return;
        }
        String connector = matcher.group(1).toLowerCase(Locale.ROOT);
        String context = stripEndingPunctuation(matcher.group(2));
        String mainClause = stripEndingPunctuation(matcher.group(3));
        String ending = questionEnding(matcher.group(4), source);
        results.add(capitalize(mainClause) + " " + connector + " " + context + ending);
    }

    private void addPurposeRewrite(String source, List<String> results) {
        Matcher matcher = PURPOSE_QUESTION.matcher(source);
        if (!matcher.matches()) {
            return;
        }
        String subject = stripEndingPunctuation(matcher.group(1));
        String purpose = stripEndingPunctuation(matcher.group(2));
        results.add("Để " + decapitalize(purpose) + ", "
                + decapitalize(subject) + " cần thực hiện điều gì?");
    }

    private void addPurposeDefinitionRewrite(String source, List<String> results) {
        Matcher matcher = PURPOSE_DEFINITION.matcher(source);
        if (!matcher.matches()) {
            return;
        }
        String subject = stripEndingPunctuation(matcher.group(1));
        results.add(capitalize(subject) + " nhằm mục đích gì?");
    }

    private String questionEnding(String captured, String source) {
        if (captured != null && !captured.isBlank()) {
            return captured;
        }
        return source.endsWith("?") ? "?" : ".";
    }

    private String stripEndingPunctuation(String value) {
        return safe(value).replaceFirst("[?!.]+$", "").trim();
    }

    private String capitalize(String value) {
        String text = safe(value);
        return text.isBlank() ? text : text.substring(0, 1).toUpperCase(Locale.ROOT) + text.substring(1);
    }

    private String decapitalize(String value) {
        String text = safe(value);
        return text.isBlank() ? text : text.substring(0, 1).toLowerCase(Locale.ROOT) + text.substring(1);
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }
}
