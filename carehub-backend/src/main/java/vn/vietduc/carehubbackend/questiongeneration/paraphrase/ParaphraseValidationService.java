package vn.vietduc.carehubbackend.questiongeneration.paraphrase;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import vn.vietduc.carehubbackend.common.util.CosineUtil;
import vn.vietduc.carehubbackend.questiongeneration.config.AiEmbeddingProperties;
import vn.vietduc.carehubbackend.questiongeneration.config.AiParaphraseProperties;
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
import java.util.Set;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class ParaphraseValidationService {
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
            List.of("không bao giờ"),
            List.of("trước"),
            List.of("sau"),
            List.of("sớm"),
            List.of("muộn"),
            List.of("tăng"),
            List.of("giảm"),
            List.of("dương tính"),
            List.of("âm tính"),
            List.of("cao nhất"),
            List.of("thấp nhất")
    );

    /**
     * {@link #LOGICAL_MARKER_GROUPS} biên dịch sẵn thành regex có ranh giới từ, khớp trên văn bản
     * GIỮ NGUYÊN DẤU.
     *
     * <p>Hai lớp bảo vệ, cả hai đều cần thiết:</p>
     * <ul>
     *   <li><b>Giữ dấu thanh.</b> Bỏ dấu làm nhập nhằng những từ khác nghĩa hẳn nhau:
     *       "kh<b>ố</b>ng chế" và "kh<b>ô</b>ng" đều thành {@code khong}. Dấu thanh tiếng Việt
     *       mang nghĩa nên không được bỏ khi dò từ phủ định.</li>
     *   <li><b>Ranh giới từ.</b> Không có nó thì "chuẩn bị" bị coi là chứa "chưa" (cùng tiền tố
     *       "chu"), và "chuẩn đoán" cũng vậy.</li>
     * </ul>
     * Dùng lookaround {@code \p{L}\p{N}} thay cho {@code \b} vì {@code \b} của Java mặc định
     * chỉ hiểu chữ cái ASCII.
     */
    private static final List<List<Pattern>> LOGICAL_MARKER_PATTERNS = LOGICAL_MARKER_GROUPS.stream()
            .map(group -> group.stream()
                    .map(marker -> Pattern.compile(
                            "(?<![\\p{L}\\p{N}])" + Pattern.quote(normalizeKeepingDiacritics(marker))
                                    + "(?![\\p{L}\\p{N}])"))
                    .toList())
            .toList();

    private final ProtectedTermService protectedTermService;
    private final DuplicateCheckService duplicateCheckService;
    private final QuestionEmbeddingService embeddingService;
    private final AiEmbeddingProperties embeddingProperties;
    private final AiParaphraseProperties paraphraseProperties;

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

        if (hasProtectedFactChanges("Câu hỏi", source.getStem(), candidate.stem(), warnings)) {
            rejected = true;
        }

        double lexicalSimilarity = duplicateCheckService.similarity(sourceCombined(source), candidateCombined(candidate));
        double lexicalDifference = Math.max(0, 1 - lexicalSimilarity);
        if (lexicalDifference < LOW_LEXICAL_DIFFERENCE) {
            warnings.add("Biến thể còn quá giống câu gốc");
        }

        Double semanticSimilarity = sourceSemanticSimilarity(source, candidate, warnings);
        if (semanticSimilarity != null) {
            if (semanticSimilarity < paraphraseProperties.getLowSourceSemanticSimilarity()) {
                warnings.add("Biến thể có nguy cơ đổi nghĩa so với câu gốc");
                rejected = true;
            } else if (semanticSimilarity < paraphraseProperties.getReviewSourceSemanticSimilarity()) {
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
            if (hasProtectedFactChanges("Phương án " + optionLabel,
                    sourceOption, candidateOption, warnings)) {
                rejected = true;
            }
            if (!hasSameLogicalMarkers(sourceOption, candidateOption)) {
                warnings.add("Phương án " + optionLabel + " có thay đổi từ phủ định hoặc từ định lượng quan trọng");
                rejected = true;
            }
            if (!normalizeForCompare(sourceOption).equals(normalizeForCompare(candidateOption))
                    && embeddingProperties.isE5Provider()) {
                Double optionSimilarity = fieldSemanticSimilarity(sourceOption, candidateOption, optionLabel, warnings);
                if (optionSimilarity == null || optionSimilarity < paraphraseProperties.getLowOptionSemanticSimilarity()) {
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
            warnings.add("Trùng ngữ nghĩa mạnh với câu hỏi khác trong ngân hàng; cần người duyệt quyết định");
        } else if (duplicate.needsReview()) {
            warnings.add("Có khả năng trùng ngữ nghĩa với câu hỏi khác trong ngân hàng");
        }

        if (!rejected) {
            warnings.add("Biến thể do AI sinh cần người duyệt xác nhận nội dung trước khi sử dụng");
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

    private boolean hasProtectedFactChanges(
            String field,
            String source,
            String candidate,
            List<String> warnings
    ) {
        ProtectedTermService.FactChanges changes = protectedTermService.changes(source, candidate);
        if (!changes.missing().isEmpty()) {
            warnings.add(field + " mất thuật ngữ hoặc số liệu cần giữ: "
                    + String.join(", ", changes.missing()));
        }
        if (!changes.added().isEmpty()) {
            warnings.add(field + " thêm hoặc đổi thuật ngữ/số liệu: "
                    + String.join(", ", changes.added()));
        }
        return changes.changed();
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

    /**
     * Câu gốc và biến thể phải cùng có hoặc cùng không có mỗi nhóm dấu hiệu logic.
     * Mất một chữ "không" là đảo ngược đáp án đúng, nên đây là chốt chặn quan trọng nhất.
     *
     * <p>So khớp theo RANH GIỚI TỪ, không dùng {@code contains}. Sau khi bỏ dấu, "chuẩn bị"
     * thành "chuan bi" — chứa chuỗi con "chua" của từ phủ định "chưa"; "khống chế" thành
     * "khong che" — chứa "khong". Đây là những từ cực phổ biến trong văn bản điều dưỡng, và
     * dùng {@code contains} sẽ từ chối cứng các biến thể hoàn toàn hợp lệ kèm cảnh báo sai
     * sự thật về việc đổi từ phủ định.</p>
     */
    private boolean hasSameLogicalMarkers(String source, String candidate) {
        String normalizedSource = normalizeKeepingDiacritics(source);
        String normalizedCandidate = normalizeKeepingDiacritics(candidate);
        return LOGICAL_MARKER_PATTERNS.stream().allMatch(group -> {
            boolean sourceContains = group.stream().anyMatch(p -> p.matcher(normalizedSource).find());
            boolean candidateContains = group.stream().anyMatch(p -> p.matcher(normalizedCandidate).find());
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
        return normalizeForCompareStatic(value);
    }

    /**
     * Chuẩn hoá cho việc dò dấu hiệu logic: hạ chữ thường, bỏ dấu câu, gom khoảng trắng —
     * nhưng GIỮ NGUYÊN dấu thanh, vì "khống" ≠ "không" và "chưa" ≠ "chứa".
     *
     * <p>Chuẩn hoá về NFC trước để chuỗi tổ hợp (ký tự cơ sở + dấu rời) và chuỗi dựng sẵn
     * so sánh được với nhau — cùng một chữ "ố" có thể được mã hoá theo cả hai cách.</p>
     */
    private static String normalizeKeepingDiacritics(String value) {
        return Normalizer.normalize(value == null ? "" : value, Normalizer.Form.NFC)
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^\\p{L}\\p{N}\\s]", " ")
                .replaceAll("\\s+", " ")
                .trim();
    }

    /**
     * Bản static để dùng được trong khối khởi tạo static.
     *
     * <p>Chữ "đ" phải xử lý riêng: nó là CHỮ CÁI CƠ SỞ trong Unicode chứ không phải chữ có dấu,
     * nên {@code \p{M}} không đụng tới. Đổi "đ" → "d" cho nhất quán với
     * {@code VietQuillCandidateSelector.normalizeText}.</p>
     */
    private static String normalizeForCompareStatic(String value) {
        String withoutMarks = Normalizer.normalize(value == null ? "" : value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "")
                .replace('đ', 'd')
                .replace('Đ', 'D');
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
