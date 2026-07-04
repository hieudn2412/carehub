package vn.vietduc.carehubbackend.questiongeneration.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.vietduc.carehubbackend.exception.BadRequestException;
import vn.vietduc.carehubbackend.exception.ResourceNotFoundException;
import vn.vietduc.carehubbackend.questiongeneration.dto.request.UpsertQuestionCategoryRequest;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.QuestionCategoryResponse;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionCategory;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionBankStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionCategoryStatus;
import vn.vietduc.carehubbackend.questiongeneration.repository.QuestionBankQuestionRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.QuestionCategoryRepository;

import java.text.Normalizer;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class QuestionCategoryService {
    private final QuestionCategoryRepository categoryRepository;
    private final QuestionBankQuestionRepository questionRepository;

    @Transactional(readOnly = true)
    public List<QuestionCategoryResponse> list(String query, String status) {
        String normalizedQuery = normalize(query);
        QuestionCategoryStatus statusFilter = parseStatusOrNull(status);
        return categoryRepository.findAll().stream()
                .filter(category -> statusFilter == null
                        ? category.getStatus() != QuestionCategoryStatus.ARCHIVED
                        : category.getStatus() == statusFilter)
                .filter(category -> normalizedQuery.isBlank()
                        || normalize(category.getName()).contains(normalizedQuery)
                        || normalize(category.getDescription()).contains(normalizedQuery)
                        || normalize(category.getCode()).contains(normalizedQuery))
                .sorted(Comparator
                        .comparing(QuestionCategory::getSortOrder, Comparator.nullsLast(Integer::compareTo))
                        .thenComparing(QuestionCategory::getName, String.CASE_INSENSITIVE_ORDER))
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public QuestionCategoryResponse get(Long categoryId) {
        return toResponse(find(categoryId));
    }

    @Transactional
    public QuestionCategoryResponse create(UpsertQuestionCategoryRequest request, String actor) {
        String name = required(request.name(), "Tên danh mục không được để trống");
        String code = codeOrSlug(request.code(), name);
        if (categoryRepository.findByCode(code).isPresent()) {
            throw new BadRequestException("Mã danh mục đã tồn tại");
        }
        QuestionCategory category = QuestionCategory.builder()
                .code(code)
                .name(name)
                .description(trimToNull(request.description()))
                .status(parseStatus(request.status(), QuestionCategoryStatus.ACTIVE))
                .sortOrder(request.sortOrder() == null ? 0 : request.sortOrder())
                .createdBy(actor)
                .build();
        return toResponse(categoryRepository.save(category));
    }

    @Transactional
    public QuestionCategoryResponse update(Long categoryId, UpsertQuestionCategoryRequest request) {
        String name = required(request.name(), "Tên danh mục không được để trống");
        QuestionCategory category = find(categoryId);
        String code = codeOrSlug(request.code(), name);
        categoryRepository.findByCode(code)
                .filter(existing -> !existing.getId().equals(category.getId()))
                .ifPresent(existing -> {
                    throw new BadRequestException("Mã danh mục đã tồn tại");
                });
        category.setCode(code);
        category.setName(name);
        category.setDescription(trimToNull(request.description()));
        category.setStatus(parseStatus(request.status(), category.getStatus()));
        category.setSortOrder(request.sortOrder() == null ? 0 : request.sortOrder());
        return toResponse(categoryRepository.save(category));
    }

    @Transactional
    public QuestionCategoryResponse archive(Long categoryId) {
        QuestionCategory category = find(categoryId);
        category.setStatus(QuestionCategoryStatus.ARCHIVED);
        return toResponse(categoryRepository.save(category));
    }

    public QuestionCategory find(Long categoryId) {
        return categoryRepository.findById(categoryId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy danh mục câu hỏi"));
    }

    private QuestionCategoryResponse toResponse(QuestionCategory category) {
        long questionCount = questionRepository.countByTopicIgnoreCaseAndStatus(
                category.getName(),
                QuestionBankStatus.APPROVED
        );
        return new QuestionCategoryResponse(
                category.getId(),
                category.getCode(),
                category.getName(),
                category.getDescription(),
                category.getStatus().name(),
                QuestionGenerationLabels.questionCategoryStatus(category.getStatus()),
                category.getSortOrder(),
                questionCount,
                category.getCreatedAt(),
                category.getUpdatedAt()
        );
    }

    private QuestionCategoryStatus parseStatus(String value, QuestionCategoryStatus fallback) {
        if (value == null || value.isBlank()) {
            return fallback;
        }
        try {
            return QuestionCategoryStatus.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (Exception ex) {
            throw new BadRequestException("Trạng thái danh mục không hợp lệ");
        }
    }

    private QuestionCategoryStatus parseStatusOrNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return parseStatus(value, null);
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

    private String codeOrSlug(String code, String name) {
        String value = trimToNull(code);
        if (value == null) {
            value = name;
        }
        return Normalizer.normalize(value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "")
                .toUpperCase(Locale.ROOT)
                .replaceAll("[^A-Z0-9]+", "_")
                .replaceAll("^_+|_+$", "");
    }

    private String normalize(String value) {
        return Normalizer.normalize(value == null ? "" : value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "")
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^\\p{L}\\p{N}\\s]", " ")
                .replaceAll("\\s+", " ")
                .trim();
    }
}
