package vn.vietduc.carehubbackend.common;

import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.Expression;

import java.text.Normalizer;
import java.util.Locale;
import java.util.regex.Pattern;

/** Text folding for user-facing searches; stored values and exact identifiers stay unchanged. */
public final class SearchText {
    public static final String SQL_FUNCTION = "carehub_search_text";
    private static final Pattern MARKS = Pattern.compile("\\p{M}+");
    private static final Pattern WHITESPACE = Pattern.compile("\\s+");

    private SearchText() {
    }

    public static String normalize(String value) {
        if (value == null) return "";
        String folded = MARKS.matcher(Normalizer.normalize(value, Normalizer.Form.NFD)).replaceAll("")
                .replace('đ', 'd').replace('Đ', 'D').toLowerCase(Locale.ROOT);
        return WHITESPACE.matcher(folded).replaceAll(" ").trim();
    }

    public static boolean contains(String value, String keyword) {
        return normalize(value).contains(normalize(keyword));
    }

    public static Expression<String> expression(CriteriaBuilder builder, Expression<String> value) {
        return builder.function(SQL_FUNCTION, String.class, value);
    }
}
