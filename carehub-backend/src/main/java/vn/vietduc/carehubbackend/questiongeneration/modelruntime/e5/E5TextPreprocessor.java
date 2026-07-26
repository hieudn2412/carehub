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

    /**
     * Tiền tố cho phép so ĐỐI XỨNG (hai đoạn cùng loại, ví dụ hai câu hỏi).
     *
     * <p>Theo hướng dẫn của họ model E5, bài toán đối xứng dùng {@code query: } cho cả hai vế;
     * cặp {@code query:}/{@code passage:} chỉ dành cho truy hồi bất đối xứng.</p>
     */
    public static String symmetric(String text) {
        return query(text);
    }

    public static String normalize(String text) {
        return Normalizer.normalize(text == null ? "" : text, Normalizer.Form.NFC)
                .replaceAll("\\s+", " ")
                .trim()
                .toLowerCase(Locale.ROOT);
    }
}
