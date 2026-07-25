package vn.vietduc.carehubbackend.questiongeneration.paraphrase;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import vn.vietduc.carehubbackend.common.util.CosineUtil;
import vn.vietduc.carehubbackend.questiongeneration.config.AiEmbeddingProperties;
import vn.vietduc.carehubbackend.questiongeneration.embedding.QuestionEmbeddingService;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionBankQuestion;
import vn.vietduc.carehubbackend.questiongeneration.modelruntime.ParaphrasedMcq;
import vn.vietduc.carehubbackend.questiongeneration.modelruntime.vietquill.ProtectedTermService;
import vn.vietduc.carehubbackend.questiongeneration.service.DuplicateCheckService;
import vn.vietduc.carehubbackend.questiongeneration.service.model.DuplicateCheckResult;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Service
@RequiredArgsConstructor
public class ParaphraseValidationService {
    private static final double LOW_SOURCE_SEMANTIC_SIMILARITY = 0.72;
    private static final double REVIEW_SOURCE_SEMANTIC_SIMILARITY = 0.85;
    private static final double LOW_OPTION_SEMANTIC_SIMILARITY = 0.72;
    private static final double LOW_LEXICAL_DIFFERENCE = 0.08;
    private static final List<String> BANNED_OPTION_PATTERNS = List.of(
            "tat ca deu dung",
            "tất cả đều đúng",
            "ca a va b",
            "cả a và b",
            "khong co dap an nao",
            "không có đáp án nào"
    );
    private static final List<String> PROMPT_LEAKAGE_PATTERNS = List.of(
            "sem_",
            "syn_",
            "lex_",
            "biến thể số",
            "mức độ thay đổi",
            "yêu cầu:",
            "paraphrase:"
    );
    private static final List<List<String>> LOGICAL_MARKER_GROUPS = List.of(
            List.of("không"),
            List.of("chưa"),
            List.of("ngoại trừ"),
            List.of("ít nhất", "tối thiểu"),
            List.of("nhiều nhất", "tối đa"),
            List.of("duy nhất", "chỉ một"),
            List.of("luôn luôn"),
            List.of("không bao giờ")
    );

    private final ProtectedTermService protectedTermService;
    private final DuplicateCheckService duplicateCheckService;
    private final QuestionEmbeddingService embeddingService;
    private final AiEmbeddingProperties embeddingProperties;

    private final Map<Long, List<String>> protectedTermsCache = new ConcurrentHashMap<>();

    public ParaphraseValidationResult validate(QuestionBankQuestion source, ParaphrasedMcq candidate) {
        List<String> warnings = new ArrayList<>();
        boolean rejected = false;

        if (isBlank(candidate.stem())) {
            warnings.add("Thiếu nội dung câu hỏi");
            rejected = true;
        }
        List<String> options = java.util.Arrays.asList(
                candidate.optionA(),
                candidate.optionB(),
                candidate.optionC(),
                candidate.optionD()
        );
        if (options.stream().anyMatch(this::isBlank)) {
            warnings.add("Thiếu một hoặc nhiều phương án A/B/C/D");
            rejected = true;
        }
        if (containsPromptLeakage(candidate)) {
            warnings.add("Output chứa nội dung điều khiển hoặc prompt của model");
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

        List<String> protectedTerms = protectedTermsCache.computeIfAbsent(source.getId(),
                id -> protectedTermService.extract(
                        source.getStem(),
                        source.getOptionA(),
                        source.getOptionB(),
                        source.getOptionC(),
                        source.getOptionD()
                ));
        List<String> missingTerms = protectedTermService.missingTerms(
                protectedTerms,
                candidate.stem(),
                candidate.optionA(),
                candidate.optionB(),
                candidate.optionC(),
                candidate.optionD()
        );
        if (!missingTerms.isEmpty()) {
            warnings.add("Mất thuật ngữ hoặc số liệu cần giữ: " + String.join(", ", missingTerms));
            rejected = true;
        }

        double lexicalSimilarity = duplicateCheckService.similarity(sourceCombined(source), candidateCombined(candidate));
        double lexicalDifference = Math.max(0, 1 - lexicalSimilarity);
        if (lexicalDifference < LOW_LEXICAL_DIFFERENCE) {
            warnings.add("Biến thể còn quá giống câu gốc");
        }

        Double semanticSimilarity = sourceSemanticSimilarity(source, candidate, warnings);
        if (semanticSimilarity != null) {
            if (semanticSimilarity < LOW_SOURCE_SEMANTIC_SIMILARITY) {
                warnings.add("Biến thể có nguy cơ đổi nghĩa so với câu gốc");
                rejected = true;
            } else if (semanticSimilarity < REVIEW_SOURCE_SEMANTIC_SIMILARITY) {
                warnings.add("Biến thể cần xem lại vì độ tương đồng ngữ nghĩa với câu gốc chưa cao");
            }
        } else if (embeddingProperties.isE5Provider()) {
            rejected = true;
        }

        if (!hasSameLogicalMarkers(source.getStem(), candidate.stem())) {
            warnings.add("Câu hỏi có thay đổi từ phủ định hoặc từ định lượng quan trọng");
            rejected = true;
        }

        List<String> sourceOptions = List.of(
                source.getOptionA(),
                source.getOptionB(),
                source.getOptionC(),
                source.getOptionD()
        );
        for (int index = 0; index < sourceOptions.size(); index++) {
            String sourceOption = sourceOptions.get(index);
            String candidateOption = options.get(index);
            String optionLabel = String.valueOf((char) ('A' + index));
            if (!hasSameLogicalMarkers(sourceOption, candidateOption)) {
                warnings.add("Phương án " + optionLabel + " có thay đổi từ phủ định hoặc từ định lượng quan trọng");
                rejected = true;
            }
            if (!normalizeForCompare(sourceOption).equals(normalizeForCompare(candidateOption))
                    && embeddingProperties.isE5Provider()) {
                Double optionSimilarity = fieldSemanticSimilarity(sourceOption, candidateOption, optionLabel, warnings);
                if (optionSimilarity == null || optionSimilarity < LOW_OPTION_SEMANTIC_SIMILARITY) {
                    warnings.add("Phương án " + optionLabel + " có nguy cơ đổi nghĩa so với câu gốc");
                    rejected = true;
                }
            }
        }

        DuplicateCheckResult duplicate = duplicateCheckService.check(candidate.stem(), Set.of(source.getId()));
        if (duplicate.warning() != null && !duplicate.warning().isBlank()) {
            warnings.add(duplicate.warning());
        }
        if (duplicate.strongDuplicate()) {
            warnings.add("Trùng ngữ nghĩa mạnh với câu hỏi khác trong ngân hàng");
            rejected = true;
        } else if (duplicate.needsReview()) {
            warnings.add("Có khả năng trùng ngữ nghĩa với câu hỏi khác trong ngân hàng");
        }

        boolean needsReview = !rejected && !warnings.isEmpty();
        return new ParaphraseValidationResult(
                rejected,
                needsReview,
                lexicalDifference,
                semanticSimilarity,
                duplicate.maxSimilarity(),
                duplicate.matchedQuestionId(),
                duplicate.matchedQuestionStem(),
                List.copyOf(warnings)
        );
    }

    private Double sourceSemanticSimilarity(
            QuestionBankQuestion source,
            ParaphrasedMcq candidate,
            List<String> warnings
    ) {
        if (!embeddingProperties.isE5Provider()) {
            return null;
        }
        try {
            double[] sourceVector = embeddingService.embedSourceStem(source.getStem());
            double[] candidateVector = embeddingService.embedCandidateStem(candidate.stem());
            return CosineUtil.cosine(sourceVector, candidateVector);
        } catch (RuntimeException ex) {
            warnings.add("Không chạy được E5 để so ngữ nghĩa với câu gốc");
            return null;
        }
    }

    private Double fieldSemanticSimilarity(
            String source,
            String candidate,
            String optionLabel,
            List<String> warnings
    ) {
        try {
            double[] sourceVector = embeddingService.embedSourceStem(source);
            double[] candidateVector = embeddingService.embedCandidateStem(candidate);
            return CosineUtil.cosine(sourceVector, candidateVector);
        } catch (RuntimeException ex) {
            warnings.add("Không kiểm tra được ngữ nghĩa phương án " + optionLabel);
            return null;
        }
    }

    private boolean containsPromptLeakage(ParaphrasedMcq candidate) {
        String combined = normalizeForCompare(String.join(" ",
                safe(candidate.stem()),
                safe(candidate.optionA()),
                safe(candidate.optionB()),
                safe(candidate.optionC()),
                safe(candidate.optionD())
        ));
        return PROMPT_LEAKAGE_PATTERNS.stream()
                .map(this::normalizeForCompare)
                .anyMatch(combined::contains);
    }

    private boolean hasSameLogicalMarkers(String source, String candidate) {
        String normalizedSource = normalizeForCompare(source);
        String normalizedCandidate = normalizeForCompare(candidate);
        return LOGICAL_MARKER_GROUPS.stream().allMatch(group -> {
            boolean sourceContains = group.stream()
                    .map(this::normalizeForCompare)
                    .anyMatch(normalizedSource::contains);
            boolean candidateContains = group.stream()
                    .map(this::normalizeForCompare)
                    .anyMatch(normalizedCandidate::contains);
            return sourceContains == candidateContains;
        });
    }

    private String sourceCombined(QuestionBankQuestion source) {
        return String.join(" ",
                safe(source.getStem()),
                safe(source.getOptionA()),
                safe(source.getOptionB()),
                safe(source.getOptionC()),
                safe(source.getOptionD())
        );
    }

    private String candidateCombined(ParaphrasedMcq candidate) {
        return String.join(" ",
                safe(candidate.stem()),
                safe(candidate.optionA()),
                safe(candidate.optionB()),
                safe(candidate.optionC()),
                safe(candidate.optionD())
        );
    }

    private boolean containsBannedOptionPattern(String option) {
        String normalized = normalizeForCompare(option);
        return BANNED_OPTION_PATTERNS.stream().anyMatch(pattern -> normalized.contains(normalizeForCompare(pattern)));
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

    private String safe(String value) {
        return value == null ? "" : value;
    }
}
