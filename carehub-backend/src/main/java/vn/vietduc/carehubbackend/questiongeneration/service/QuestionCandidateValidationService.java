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
        Double qualityScore = null;
        boolean groundedV4 = !isBlank(question.questionType())
                || !isBlank(question.answerEvidence())
                || !isBlank(question.distractorRationales());
        String evidenceStatus = "EXACT";

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
        if (!isBlank(question.difficulty())
                && !Set.of("easy", "medium", "hard").contains(question.difficulty().toLowerCase(Locale.ROOT))) {
            warnings.add("Độ khó không thuộc easy/medium/hard");
            rejected = true;
        }
        if (groundedV4 && isGenericDocumentReferenceStem(question.stem())) {
            warnings.add("Stem không tự đứng độc lập hoặc đang tham chiếu tài liệu");
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
            evidenceStatus = "MISSING";
        } else if (groundedV4
                ? !containsExact(chunkText, question.sourceExcerpt())
                : !containsNormalized(chunkText, question.sourceExcerpt())) {
            warnings.add("Trích dẫn nguồn chưa khớp rõ với chunk gốc");
            evidenceStatus = "MISMATCH";
            if (groundedV4) {
                rejected = true;
            }
        }

        if (groundedV4) {
            if (isBlank(question.questionType())) {
                warnings.add("Thiếu loại câu hỏi Grounded v4");
                rejected = true;
            }
            if (isBlank(question.knowledgePointId())) {
                warnings.add("Thiếu liên kết knowledge point");
                rejected = true;
            }
            if (isBlank(question.answerEvidence())) {
                warnings.add("Thiếu bằng chứng hỗ trợ đáp án đúng");
                rejected = true;
                evidenceStatus = "MISSING";
            } else if (!containsExact(chunkText, question.answerEvidence())) {
                warnings.add("Bằng chứng đáp án không xuất hiện nguyên văn trong chunk");
                rejected = true;
                evidenceStatus = "MISMATCH";
            }
            if (isBlank(question.distractorRationales())) {
                warnings.add("Thiếu giải thích cho các distractor");
                rejected = true;
            }
        }

        LlmValidation llmValidation = parseLlmValidation(question.llmValidationJson());
        String validationSource = llmValidation.present() ? "RULES_AND_CRITIC" : "RULES_ONLY";
        String criticStatus = llmValidation.present() ? "PASSED" : "NOT_RUN";
        if (llmValidation.present()) {
            qualityScore = llmValidation.qualityScore();
            warnings.addAll(llmValidation.issues());
            if (Boolean.FALSE.equals(llmValidation.answerable())) {
                warnings.add("LLM validation: câu hỏi không trả lời được từ nguồn");
                rejected = true;
                criticStatus = "FAILED";
            }
            if (Boolean.FALSE.equals(llmValidation.singleBestAnswer())) {
                warnings.add("LLM validation: chưa đảm bảo một đáp án tốt nhất");
                rejected = true;
                criticStatus = "FAILED";
            }
            if (Boolean.FALSE.equals(llmValidation.correctAnswerSupported())) {
                warnings.add("LLM validation: đáp án đúng chưa được nguồn hỗ trợ");
                rejected = true;
                criticStatus = "FAILED";
            }
            if (Boolean.FALSE.equals(llmValidation.distractorsInvalid())) {
                warnings.add("LLM validation: có distractor chưa được chứng minh là sai");
                rejected = true;
                criticStatus = "FAILED";
            }
            if (Boolean.FALSE.equals(llmValidation.surfaceCueFree())) {
                warnings.add("LLM validation: đáp án có thể bị đoán nhờ dấu hiệu hình thức");
                rejected = true;
                criticStatus = "FAILED";
            }
            if (Boolean.FALSE.equals(llmValidation.distractorsPlausible())) {
                warnings.add("LLM validation: distractor chưa đủ hợp lý với người có chuyên môn");
                rejected = true;
                criticStatus = "FAILED";
            }
            boolean expectsDomainReasoning = Set.of("medium", "hard").contains(
                    isBlank(question.difficulty())
                            ? ""
                            : question.difficulty().toLowerCase(Locale.ROOT)
            );
            if (expectsDomainReasoning && Boolean.FALSE.equals(llmValidation.requiresDomainReasoning())) {
                warnings.add("LLM validation: độ khó chỉ đến từ đọc hiểu hoặc loại trừ, chưa cần suy luận chuyên môn");
                rejected = true;
                criticStatus = "FAILED";
            }
            if (!rejected && (!Boolean.TRUE.equals(llmValidation.answerable())
                    || !Boolean.TRUE.equals(llmValidation.singleBestAnswer())
                    || !Boolean.TRUE.equals(llmValidation.correctAnswerSupported())
                    || (groundedV4 && (!Boolean.TRUE.equals(llmValidation.distractorsInvalid())
                    || !Boolean.TRUE.equals(llmValidation.surfaceCueFree())
                    || !Boolean.TRUE.equals(llmValidation.distractorsPlausible())
                    || (expectsDomainReasoning
                    && !Boolean.TRUE.equals(llmValidation.requiresDomainReasoning())))))) {
                criticStatus = "UNCERTAIN";
                warnings.add("LLM validation chưa trả đủ kết luận bắt buộc");
            }
        }

        if (qualityScore != null && qualityScore < properties.getQuality().getRejectMin()) {
            warnings.add("Điểm chất lượng dưới ngưỡng tối thiểu");
            rejected = true;
            criticStatus = "FAILED";
        }
        boolean needsReview = !rejected && !warnings.isEmpty();
        return new CandidateValidationResult(
                rejected,
                needsReview,
                qualityScore == null ? null : clamp(qualityScore),
                List.copyOf(warnings),
                rejected ? "REJECT" : needsReview ? "REVIEW" : "PASS",
                validationSource,
                evidenceStatus,
                criticStatus
        );
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
                    optionalBoolean(node, "distractorsInvalid"),
                    optionalBoolean(node, "surfaceCueFree"),
                    optionalBoolean(node, "distractorsPlausible"),
                    optionalBoolean(node, "requiresDomainReasoning"),
                    node.has("qualityScore") ? node.path("qualityScore").asDouble() : null,
                    issues
            );
        } catch (Exception ex) {
            return new LlmValidation(
                    true, null, null, null, null, null, null, null,
                    null, List.of("Không đọc được kết quả LLM validation")
            );
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

    private boolean containsExact(String source, String excerpt) {
        return !isBlank(source) && !isBlank(excerpt) && source.contains(excerpt.trim());
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

    private boolean isGenericDocumentReferenceStem(String stem) {
        String normalized = normalizeForCompare(stem);
        return normalized.startsWith("theo tai lieu")
                || normalized.startsWith("dua vao tai lieu")
                || normalized.startsWith("trong tai lieu")
                || normalized.startsWith("theo noi dung")
                || normalized.contains("phu hop nhat voi noi dung trong muc")
                || normalized.contains("phu hop voi noi dung trong muc");
    }

    private record LlmValidation(
            boolean present,
            Boolean answerable,
            Boolean singleBestAnswer,
            Boolean correctAnswerSupported,
            Boolean distractorsInvalid,
            Boolean surfaceCueFree,
            Boolean distractorsPlausible,
            Boolean requiresDomainReasoning,
            Double qualityScore,
            List<String> issues
    ) {
        private static LlmValidation absent() {
            return new LlmValidation(
                    false, null, null, null, null, null, null, null, null, List.of()
            );
        }
    }
}
