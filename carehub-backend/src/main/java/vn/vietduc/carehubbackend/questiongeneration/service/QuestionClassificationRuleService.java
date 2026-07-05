package vn.vietduc.carehubbackend.questiongeneration.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.vietduc.carehubbackend.exception.BadRequestException;
import vn.vietduc.carehubbackend.exception.ResourceNotFoundException;
import vn.vietduc.carehubbackend.questiongeneration.dto.request.TestQuestionClassificationRuleRequest;
import vn.vietduc.carehubbackend.questiongeneration.dto.request.UpsertQuestionClassificationRuleRequest;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.QuestionClassificationRuleResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.QuestionClassificationTestResponse;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionCategory;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionClassificationRule;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionCategoryStatus;
import vn.vietduc.carehubbackend.questiongeneration.repository.QuestionCategoryRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.QuestionClassificationRuleRepository;

import java.text.Normalizer;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class QuestionClassificationRuleService {
    private final QuestionClassificationRuleRepository ruleRepository;
    private final QuestionCategoryRepository categoryRepository;

    @Transactional(readOnly = true)
    public List<QuestionClassificationRuleResponse> list(String query, Boolean enabled) {
        String normalizedQuery = normalize(query);
        return ruleRepository.findAllByOrderByPriorityDescIdAsc().stream()
                .filter(rule -> enabled == null || rule.getEnabled().equals(enabled))
                .filter(rule -> normalizedQuery.isBlank()
                        || normalize(rule.getName()).contains(normalizedQuery)
                        || normalize(rule.getKeywords()).contains(normalizedQuery)
                        || normalize(rule.getSourcePattern()).contains(normalizedQuery)
                        || normalize(rule.getCategory().getName()).contains(normalizedQuery))
                .sorted(Comparator.comparing(QuestionClassificationRule::getPriority).reversed()
                        .thenComparing(QuestionClassificationRule::getId))
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public QuestionClassificationRuleResponse get(Long ruleId) {
        return toResponse(find(ruleId));
    }

    @Transactional
    public QuestionClassificationRuleResponse create(UpsertQuestionClassificationRuleRequest request, String actor) {
        QuestionCategory category = resolveCategory(request.categoryId());
        QuestionClassificationRule rule = QuestionClassificationRule.builder()
                .name(required(request.name(), "Tên quy tắc không được để trống"))
                .category(category)
                .keywords(required(request.keywords(), "Từ khóa phân loại không được để trống"))
                .sourcePattern(trimToNull(request.sourcePattern()))
                .priority(request.priority() == null ? 0 : request.priority())
                .enabled(request.enabled() == null || request.enabled())
                .createdBy(actor)
                .build();
        return toResponse(ruleRepository.save(rule));
    }

    @Transactional
    public QuestionClassificationRuleResponse update(Long ruleId, UpsertQuestionClassificationRuleRequest request) {
        QuestionClassificationRule rule = find(ruleId);
        QuestionCategory category = resolveCategory(request.categoryId());
        rule.setName(required(request.name(), "Tên quy tắc không được để trống"));
        rule.setCategory(category);
        rule.setKeywords(required(request.keywords(), "Từ khóa phân loại không được để trống"));
        rule.setSourcePattern(trimToNull(request.sourcePattern()));
        rule.setPriority(request.priority() == null ? 0 : request.priority());
        rule.setEnabled(request.enabled() == null || request.enabled());
        return toResponse(ruleRepository.save(rule));
    }

    @Transactional
    public QuestionClassificationRuleResponse disable(Long ruleId) {
        QuestionClassificationRule rule = find(ruleId);
        rule.setEnabled(false);
        return toResponse(ruleRepository.save(rule));
    }

    @Transactional(readOnly = true)
    public QuestionClassificationTestResponse test(TestQuestionClassificationRuleRequest request) {
        Match match = classify(request);
        if (match == null) {
            return new QuestionClassificationTestResponse(
                    null,
                    null,
                    null,
                    "Chưa phân loại",
                    0,
                    "Không có quy tắc hoạt động nào khớp với nội dung thử nghiệm"
            );
        }
        return new QuestionClassificationTestResponse(
                match.rule().getId(),
                match.rule().getName(),
                match.rule().getCategory().getId(),
                match.rule().getCategory().getName(),
                match.confidence(),
                match.reason()
        );
    }

    @Transactional(readOnly = true)
    public QuestionClassificationTestResponse classifyQuestion(
            String stem,
            String explanation,
            String sourceDocument,
            String sectionTitle,
            String sourceExcerpt
    ) {
        return test(new TestQuestionClassificationRuleRequest(stem, explanation, sourceDocument, sectionTitle, sourceExcerpt));
    }

    private Match classify(TestQuestionClassificationRuleRequest request) {
        String content = normalize(String.join(" ",
                safe(request.stem()),
                safe(request.explanation()),
                safe(request.sectionTitle()),
                safe(request.sourceExcerpt())
        ));
        String source = normalize(request.sourceDocument());
        Match best = null;
        for (QuestionClassificationRule rule : ruleRepository.findByEnabledTrueOrderByPriorityDescIdAsc()) {
            if (rule.getCategory().getStatus() != QuestionCategoryStatus.ACTIVE) {
                continue;
            }
            int keywordHits = keywordHits(rule, content);
            boolean sourceMatched = sourceMatched(rule, source);
            if (keywordHits == 0 && !sourceMatched) {
                continue;
            }
            double confidence = Math.min(0.98, (keywordHits * 0.25) + (sourceMatched ? 0.25 : 0.0) + 0.35);
            String reason = sourceMatched
                    ? "Khớp từ khóa và nguồn tài liệu"
                    : "Khớp " + keywordHits + " từ khóa";
            Match candidate = new Match(rule, confidence, reason);
            if (best == null || candidate.confidence() > best.confidence()) {
                best = candidate;
            }
        }
        return best;
    }

    private int keywordHits(QuestionClassificationRule rule, String content) {
        if (content.isBlank()) {
            return 0;
        }
        int hits = 0;
        for (String keyword : splitTokens(rule.getKeywords())) {
            if (!keyword.isBlank() && content.contains(normalize(keyword))) {
                hits++;
            }
        }
        return hits;
    }

    private boolean sourceMatched(QuestionClassificationRule rule, String source) {
        if (source.isBlank()) {
            return false;
        }
        for (String pattern : splitTokens(rule.getSourcePattern())) {
            if (!pattern.isBlank() && source.contains(normalize(pattern))) {
                return true;
            }
        }
        return false;
    }

    private List<String> splitTokens(String value) {
        if (value == null || value.isBlank()) {
            return List.of();
        }
        return Arrays.stream(value.split("[,;\\n]"))
                .map(String::trim)
                .filter(token -> !token.isBlank())
                .toList();
    }

    private QuestionCategory resolveCategory(Long categoryId) {
        if (categoryId == null) {
            throw new BadRequestException("Vui lòng chọn danh mục câu hỏi");
        }
        QuestionCategory category = categoryRepository.findById(categoryId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy danh mục câu hỏi"));
        if (category.getStatus() == QuestionCategoryStatus.ARCHIVED) {
            throw new BadRequestException("Không thể dùng danh mục đã lưu trữ");
        }
        return category;
    }

    private QuestionClassificationRule find(Long ruleId) {
        return ruleRepository.findById(ruleId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy quy tắc phân loại"));
    }

    private QuestionClassificationRuleResponse toResponse(QuestionClassificationRule rule) {
        return new QuestionClassificationRuleResponse(
                rule.getId(),
                rule.getName(),
                rule.getCategory().getId(),
                rule.getCategory().getName(),
                rule.getKeywords(),
                rule.getSourcePattern(),
                rule.getPriority(),
                rule.getEnabled(),
                Boolean.TRUE.equals(rule.getEnabled()) ? "Hoạt động" : "Tạm ngưng",
                rule.getCreatedAt(),
                rule.getUpdatedAt()
        );
    }

    private String required(String value, String message) {
        if (value == null || value.isBlank()) {
            throw new BadRequestException(message);
        }
        return value.trim();
    }

    private String trimToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private String safe(String value) {
        return value == null ? "" : value;
    }

    private String normalize(String value) {
        return Normalizer.normalize(value == null ? "" : value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "")
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^\\p{L}\\p{N}\\s]", " ")
                .replaceAll("\\s+", " ")
                .trim();
    }

    private record Match(QuestionClassificationRule rule, double confidence, String reason) {
    }
}
