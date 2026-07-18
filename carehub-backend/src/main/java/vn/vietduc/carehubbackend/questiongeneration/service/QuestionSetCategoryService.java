package vn.vietduc.carehubbackend.questiongeneration.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.vietduc.carehubbackend.exception.BadRequestException;
import vn.vietduc.carehubbackend.exception.ResourceNotFoundException;
import vn.vietduc.carehubbackend.questiongeneration.dto.request.UpsertQuestionSetCategoryRequest;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.QuestionSetCategoryResponse;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionSetCategory;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionSetCategoryStatus;
import vn.vietduc.carehubbackend.questiongeneration.repository.QuestionSetCategoryRepository;

import java.text.Normalizer;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class QuestionSetCategoryService {
    private final QuestionSetCategoryRepository categoryRepository;

    @Transactional(readOnly = true)
    public List<QuestionSetCategoryResponse> list(String query, String status) {
        String normalizedQuery = normalize(query);
        QuestionSetCategoryStatus statusFilter = parseStatusOrNull(status);
        return categoryRepository.findAll().stream()
                .filter(category -> statusFilter == null
                        ? category.getStatus() != QuestionSetCategoryStatus.ARCHIVED
                        : category.getStatus() == statusFilter)
                .filter(category -> normalizedQuery.isBlank()
                        || normalize(category.getName()).contains(normalizedQuery)
                        || normalize(category.getDescription()).contains(normalizedQuery)
                        || normalize(category.getCode()).contains(normalizedQuery))
                .sorted(Comparator
                        .comparing(QuestionSetCategory::getSortOrder, Comparator.nullsLast(Integer::compareTo))
                        .thenComparing(QuestionSetCategory::getName, String.CASE_INSENSITIVE_ORDER))
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public QuestionSetCategoryResponse get(Long categoryId) {
        return toResponse(find(categoryId));
    }

    @Transactional
    public QuestionSetCategoryResponse create(UpsertQuestionSetCategoryRequest request, String actor) {
        String name = required(request.name(), "Tên danh mục bộ câu hỏi không được để trống");
        String code = codeOrSlug(request.code(), name);
        if (categoryRepository.findByCode(code).isPresent()) {
            throw new BadRequestException("Mã danh mục bộ câu hỏi đã tồn tại");
        }
        QuestionSetCategory category = QuestionSetCategory.builder()
                .code(code)
                .name(name)
                .description(trimToNull(request.description()))
                .status(parseStatus(request.status(), QuestionSetCategoryStatus.ACTIVE))
                .sortOrder(request.sortOrder() == null ? 0 : request.sortOrder())
                .createdBy(actor)
                .build();
        return toResponse(categoryRepository.save(category));
    }

    @Transactional
    public QuestionSetCategoryResponse update(Long categoryId, UpsertQuestionSetCategoryRequest request) {
        String name = required(request.name(), "Tên danh mục bộ câu hỏi không được để trống");
        QuestionSetCategory category = find(categoryId);
        String code = codeOrSlug(request.code(), name);
        categoryRepository.findByCode(code)
                .filter(existing -> !existing.getId().equals(category.getId()))
                .ifPresent(existing -> {
                    throw new BadRequestException("Mã danh mục bộ câu hỏi đã tồn tại");
                });
        category.setCode(code);
        category.setName(name);
        category.setDescription(trimToNull(request.description()));
        category.setStatus(parseStatus(request.status(), category.getStatus()));
        category.setSortOrder(request.sortOrder() == null ? 0 : request.sortOrder());
        return toResponse(categoryRepository.save(category));
    }

    @Transactional
    public QuestionSetCategoryResponse archive(Long categoryId) {
        QuestionSetCategory category = find(categoryId);
        category.setStatus(QuestionSetCategoryStatus.ARCHIVED);
        return toResponse(categoryRepository.save(category));
    }

    public QuestionSetCategory find(Long categoryId) {
        return categoryRepository.findById(categoryId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy danh mục bộ câu hỏi"));
    }

    private QuestionSetCategoryResponse toResponse(QuestionSetCategory category) {
        return new QuestionSetCategoryResponse(
                category.getId(),
                category.getCode(),
                category.getName(),
                category.getDescription(),
                category.getStatus().name(),
                QuestionGenerationLabels.questionSetCategoryStatus(category.getStatus()),
                category.getSortOrder(),
                category.getCreatedAt(),
                category.getUpdatedAt()
        );
    }

    private QuestionSetCategoryStatus parseStatus(String value, QuestionSetCategoryStatus fallback) {
        if (value == null || value.isBlank()) {
            return fallback;
        }
        try {
            return QuestionSetCategoryStatus.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (Exception ex) {
            throw new BadRequestException("Trạng thái danh mục bộ câu hỏi không hợp lệ");
        }
    }

    private QuestionSetCategoryStatus parseStatusOrNull(String value) {
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
