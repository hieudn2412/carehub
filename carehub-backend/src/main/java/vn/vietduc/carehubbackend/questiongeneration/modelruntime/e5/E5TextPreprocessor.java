package vn.vietduc.carehubbackend.questiongeneration.modelruntime.e5;

import java.text.Normalizer;
import java.util.Locale;

public final class E5TextPreprocessor {
    private E5TextPreprocessor() {
    }

    public static String query(String text) {
        return "query: " + normalize(text);
    }

    public static String passage(String text) {
        return "passage: " + normalize(text);
    }

    public static String normalize(String text) {
        return Normalizer.normalize(text == null ? "" : text, Normalizer.Form.NFC)
                .replaceAll("\\s+", " ")
                .trim()
                .toLowerCase(Locale.ROOT);
    }
}
