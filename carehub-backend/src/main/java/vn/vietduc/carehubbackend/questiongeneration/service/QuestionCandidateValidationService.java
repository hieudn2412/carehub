package vn.vietduc.carehubbackend.questiongeneration.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import vn.vietduc.carehubbackend.questiongeneration.config.ValidationRulesProperties;
import vn.vietduc.carehubbackend.questiongeneration.service.model.CandidateValidationResult;
import vn.vietduc.carehubbackend.questiongeneration.service.model.GeneratedQuestion;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class QuestionCandidateValidationService {
    private static final List<String> BANNED_OPTION_PATTERNS = List.of(
            "tat ca deu dung",
            "tất cả đều đúng",
            "ca a va b",
            "cả a và b",
            "khong co dap an nao",
            "không có đáp án nào"
    );

    private final ObjectMapper objectMapper;
    private final ValidationRulesProperties properties;

    public CandidateValidationResult validate(GeneratedQuestion question, String chunkText) {
        List<String> warnings = new ArrayList<>();
        boolean rejected = false;
        double qualityScore = 0.86;

        if (isBlank(question.stem())) {
            warnings.add("Thiếu nội dung câu hỏi");
            rejected = true;
        }
        List<String> options = List.of(question.optionA(), question.optionB(), question.optionC(), question.optionD());
        if (options.stream().anyMatch(this::isBlank)) {
            warnings.add("Thiếu một hoặc nhiều phương án A/B/C/D");
            rejected = true;
        }
        if (question.correctAnswer() == null || !question.correctAnswer().matches("[ABCD]")) {
            warnings.add("Đáp án đúng không thuộc A/B/C/D");
            rejected = true;
        }
        Set<String> normalizedOptions = new HashSet<>();
        for (String option : options) {
            String normalized = normalizeForCompare(option);
            if (!normalized.isBlank() && !normalizedOptions.add(normalized)) {
                warnings.add("Có phương án trả lời bị trùng nội dung");
                rejected = true;
            }
            if (containsBannedOptionPattern(option)) {
                warnings.add("Phương án trả lời chứa mẫu không phù hợp như 'tất cả đều đúng' hoặc 'cả A và B'");
                rejected = true;
            }
        }
        if (isBlank(question.sourceExcerpt())) {
            warnings.add("Thiếu trích dẫn nguồn");
            rejected = true;
        } else if (!containsNormalized(chunkText, question.sourceExcerpt())) {
            warnings.add("Trích dẫn nguồn chưa khớp rõ với chunk gốc");
            qualityScore -= 0.12;
        }

        LlmValidation llmValidation = parseLlmValidation(question.llmValidationJson());
        if (llmValidation.present()) {
            qualityScore = llmValidation.qualityScore() == null ? qualityScore : llmValidation.qualityScore();
            warnings.addAll(llmValidation.issues());
            if (Boolean.FALSE.equals(llmValidation.answerable())) {
                warnings.add("LLM validation: câu hỏi không trả lời được từ nguồn");
                rejected = true;
            }
            if (Boolean.FALSE.equals(llmValidation.singleBestAnswer())) {
                warnings.add("LLM validation: chưa đảm bảo một đáp án tốt nhất");
                rejected = true;
            }
            if (Boolean.FALSE.equals(llmValidation.correctAnswerSupported())) {
                warnings.add("LLM validation: đáp án đúng chưa được nguồn hỗ trợ");
                rejected = true;
            }
        }

        if (qualityScore < properties.getQuality().getRejectMin()) {
            warnings.add("Điểm chất lượng dưới ngưỡng tối thiểu");
            rejected = true;
        }
        boolean needsReview = !rejected && !warnings.isEmpty();
        return new CandidateValidationResult(rejected, needsReview, clamp(qualityScore), List.copyOf(warnings));
    }

    private LlmValidation parseLlmValidation(String json) {
        if (isBlank(json)) {
            return LlmValidation.absent();
        }
        try {
            JsonNode node = objectMapper.readTree(json);
            List<String> issues = new ArrayList<>();
            JsonNode issuesNode = node.path("issues");
            if (issuesNode.isArray()) {
                issuesNode.forEach(issue -> {
                    if (!issue.asText("").isBlank()) {
                        issues.add(issue.asText());
                    }
                });
            }
            return new LlmValidation(
                    true,
                    optionalBoolean(node, "answerable"),
                    optionalBoolean(node, "singleBestAnswer"),
                    optionalBoolean(node, "correctAnswerSupported"),
                    node.has("qualityScore") ? node.path("qualityScore").asDouble() : null,
                    issues
            );
        } catch (Exception ex) {
            return new LlmValidation(true, null, null, null, null, List.of("Không đọc được kết quả LLM validation"));
        }
    }

    private Boolean optionalBoolean(JsonNode node, String field) {
        if (!node.has(field)) {
            return null;
        }
        return node.path(field).asBoolean();
    }

    private boolean containsBannedOptionPattern(String option) {
        String normalized = normalizeForCompare(option);
        return BANNED_OPTION_PATTERNS.stream().anyMatch(pattern -> normalized.contains(normalizeForCompare(pattern)));
    }

    private boolean containsNormalized(String source, String excerpt) {
        return normalizeWhitespace(source).contains(normalizeWhitespace(excerpt));
    }

    private String normalizeWhitespace(String value) {
        return value == null ? "" : value.replaceAll("\\s+", " ").trim();
    }

    private String normalizeForCompare(String value) {
        String withoutMarks = Normalizer.normalize(value == null ? "" : value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "");
        return withoutMarks
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^\\p{L}\\p{N}\\s]", " ")
                .replaceAll("\\s+", " ")
                .trim();
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    private double clamp(double value) {
        return Math.max(0, Math.min(1, value));
    }

    private record LlmValidation(
            boolean present,
            Boolean answerable,
            Boolean singleBestAnswer,
            Boolean correctAnswerSupported,
            Double qualityScore,
            List<String> issues
    ) {
        private static LlmValidation absent() {
            return new LlmValidation(false, null, null, null, null, List.of());
        }
    }
}
