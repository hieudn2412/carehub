package vn.vietduc.carehubbackend.questiongeneration.modelruntime.vietquill;

import org.springframework.stereotype.Service;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class ProtectedTermService {
    private static final Pattern NUMBER_WITH_UNIT = Pattern.compile(
            "\\b\\d+(?:[,.]\\d+)?\\s*(?:%|mg|mcg|g|kg|ml|l|mmHg|bpm|l/phút|l/min|giờ|phút|ngày)\\b",
            Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE
    );
    private static final Pattern RANGE = Pattern.compile("\\b\\d+(?:[,.]\\d+)?\\s*[-–]\\s*\\d+(?:[,.]\\d+)?\\b");
    private static final Pattern MEDICAL_ABBREVIATION = Pattern.compile(
            "\\b(?:SpO2|ECG|CPR|ABCDE|BMI|HA|M|NT|IV|IM|SC|PPE|SARS-CoV-2)\\b",
            Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE
    );
    private static final Pattern UPPER_TOKEN = Pattern.compile("\\b[A-ZĐ]{2,}[A-ZĐ0-9-]*\\b");

    public List<String> extract(String... texts) {
        Set<String> terms = new LinkedHashSet<>();
        for (String text : texts) {
            if (text == null || text.isBlank()) {
                continue;
            }
            collect(NUMBER_WITH_UNIT, text, terms);
            collect(RANGE, text, terms);
            collect(MEDICAL_ABBREVIATION, text, terms);
            collect(UPPER_TOKEN, text, terms);
        }
        return List.copyOf(terms);
    }

    public List<String> missingTerms(List<String> protectedTerms, String... candidateTexts) {
        StringBuilder builder = new StringBuilder();
        if (candidateTexts != null) {
            for (String candidateText : candidateTexts) {
                if (candidateText != null) {
                    builder.append(candidateText).append(' ');
                }
            }
        }
        String combined = builder.toString();
        String lowerCombined = combined.toLowerCase();
        return protectedTerms.stream()
                .filter(term -> !combined.contains(term) && !lowerCombined.contains(term.toLowerCase()))
                .toList();
    }

    private void collect(Pattern pattern, String text, Set<String> terms) {
        Matcher matcher = pattern.matcher(text);
        while (matcher.find()) {
            String term = matcher.group().trim();
            if (!term.isBlank()) {
                terms.add(term);
            }
        }
    }
}
