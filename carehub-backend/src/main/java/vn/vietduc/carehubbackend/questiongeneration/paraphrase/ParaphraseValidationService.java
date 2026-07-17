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
    private static final double LOW_SOURCE_SEMANTIC_SIMILARITY = 0.55;
    private static final double REVIEW_SOURCE_SEMANTIC_SIMILARITY = 0.75;
    private static final double LOW_LEXICAL_DIFFERENCE = 0.08;
    private static final List<String> BANNED_OPTION_PATTERNS = List.of(
            "tat ca deu dung",
            "tất cả đều đúng",
            "ca a va b",
            "cả a và b",
            "khong co dap an nao",
            "không có đáp án nào"
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
        List<String> options = List.of(candidate.optionA(), candidate.optionB(), candidate.optionC(), candidate.optionD());
        if (options.stream().anyMatch(this::isBlank)) {
            warnings.add("Thiếu một hoặc nhiều phương án A/B/C/D");
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
