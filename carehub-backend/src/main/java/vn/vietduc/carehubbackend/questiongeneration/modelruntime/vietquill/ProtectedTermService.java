package vn.vietduc.carehubbackend.questiongeneration.modelruntime.vietquill;

import org.springframework.stereotype.Service;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class ProtectedTermService {
    private static final Pattern NUMBER_WITH_UNIT = Pattern.compile(
            "(?<![\\p{L}\\p{N}])\\d+(?:[,.]\\d+)?(?:\\s*/\\s*\\d+(?:[,.]\\d+)?)?\\s*"
                    + "(?:mg/dl|mmol/l|meq/l|ng/l|u/l|iu/l|cmh2o|mmhg|lần/phút|nhịp/phút|"
                    + "lít/phút|l/phút|l/min|mg/kg|mcg/kg|µg/kg|μg/kg|mg|mcg|µg|μg|g|kg|"
                    + "ml|l|mm|cm|bpm|%|°c|độ c|giờ|phút|ngày|tuần|tháng|tuổi|đơn vị)"
                    + "(?![\\p{L}\\p{N}])",
            Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE
    );
    private static final Pattern RANGE = Pattern.compile("\\b\\d+(?:[,.]\\d+)?\\s*[-–]\\s*\\d+(?:[,.]\\d+)?\\b");
    private static final Pattern PLAIN_NUMBER = Pattern.compile(
            "(?<![\\p{L}\\p{N}])\\d+(?:[,.]\\d+)?(?![\\p{L}\\p{N}])"
    );
    private static final Pattern MEDICAL_ABBREVIATION = Pattern.compile(
            "\\b(?:SpO2|PaO2|PaCO2|FiO2|ECG|hs-TnT|HbA1c|CPR|ABCDE|BMI|GCS|NANDA|HA|NT|IV|IM|SC|PPE|SARS-CoV-2)\\b"
    );
    private static final Pattern UPPER_TOKEN = Pattern.compile(
            "(?<![\\p{L}\\p{N}])[A-ZĐ]{2,}[A-ZĐ0-9-]*(?![\\p{L}\\p{N}])"
    );

    public List<String> extract(String... texts) {
        var terms = new LinkedHashSet<String>();
        for (String text : texts) {
            if (text == null || text.isBlank()) {
                continue;
            }
            collect(NUMBER_WITH_UNIT, text, terms);
            collect(RANGE, text, terms);
            collect(MEDICAL_ABBREVIATION, text, terms);
            collect(UPPER_TOKEN, text, terms);
            collect(PLAIN_NUMBER, text, terms);
        }
        return List.copyOf(terms);
    }

    public List<String> missingTerms(List<String> protectedTerms, String... candidateTexts) {
        var candidateTerms = new LinkedHashSet<String>();
        extract(candidateTexts).stream().map(this::normalizeTerm).forEach(candidateTerms::add);
        return protectedTerms.stream()
                .filter(term -> !candidateTerms.contains(normalizeTerm(term)))
                .toList();
    }

    public FactChanges changes(String source, String candidate) {
        return new FactChanges(
                missingTerms(extract(source), candidate),
                missingTerms(extract(candidate), source)
        );
    }

    private String normalizeTerm(String value) {
        return value.toLowerCase(java.util.Locale.ROOT)
                .replaceAll("\\s*([/–-])\\s*", "$1")
                .replaceAll("\\s+", " ")
                .trim();
    }

    private void collect(Pattern pattern, String text, java.util.Set<String> terms) {
        Matcher matcher = pattern.matcher(text);
        while (matcher.find()) {
            String term = matcher.group().trim();
            if (!term.isBlank()) {
                terms.add(term);
            }
        }
    }

    public record FactChanges(List<String> missing, List<String> added) {
        public boolean changed() {
            return !missing.isEmpty() || !added.isEmpty();
        }
    }
}
