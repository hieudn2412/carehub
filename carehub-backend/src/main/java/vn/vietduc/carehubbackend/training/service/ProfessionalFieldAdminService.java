package vn.vietduc.carehubbackend.training.service;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.vietduc.carehubbackend.exception.ConflictException;
import vn.vietduc.carehubbackend.exception.ResourceNotFoundException;
import vn.vietduc.carehubbackend.exception.ValidationException;
import vn.vietduc.carehubbackend.training.dto.request.ProfessionalFieldFormRequest;
import vn.vietduc.carehubbackend.training.dto.response.ProfessionalFieldResponse;
import vn.vietduc.carehubbackend.training.entity.ProfessionalField;
import vn.vietduc.carehubbackend.training.repository.ProfessionalFieldRepository;

import java.util.Locale;

@Service
@RequiredArgsConstructor
public class ProfessionalFieldAdminService {
    private final ProfessionalFieldRepository repository;

    @Transactional(readOnly = true)
    public Page<ProfessionalFieldResponse> search(String keyword, Boolean active, Pageable pageable) {
        String pattern = keyword == null || keyword.isBlank()
                ? null
                : "%" + keyword.trim().toLowerCase(Locale.ROOT) + "%";
        Pageable normalized = PageRequest.of(
                pageable.getPageNumber(),
                Math.min(pageable.getPageSize(), 100),
                pageable.getSort().isSorted() ? pageable.getSort() : Sort.by("name").ascending()
        );
        return repository.search(pattern, active, normalized).map(this::response);
    }

    @Transactional
    public ProfessionalFieldResponse create(ProfessionalFieldFormRequest request) {
        String code = normalizeCode(request.code());
        if (repository.findByCode(code).isPresent()) {
            throw new ConflictException("Mã lĩnh vực chuyên môn đã tồn tại");
        }
        ProfessionalField field = repository.save(ProfessionalField.builder()
                .code(code)
                .name(request.name().trim())
                .description(trimToNull(request.description()))
                .active(request.active() == null || request.active())
                .build());
        return response(field);
    }

    @Transactional
    public ProfessionalFieldResponse update(Long id, ProfessionalFieldFormRequest request) {
        ProfessionalField field = repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy lĩnh vực chuyên môn"));
        if (request.version() != null && !request.version().equals(field.getVersion())) {
            throw new ConflictException("Lĩnh vực chuyên môn đã được cập nhật bởi người khác");
        }
        String code = normalizeCode(request.code());
        if (repository.existsByCodeAndIdNot(code, id)) {
            throw new ConflictException("Mã lĩnh vực chuyên môn đã tồn tại");
        }
        field.setCode(code);
        field.setName(request.name().trim());
        field.setDescription(trimToNull(request.description()));
        if (request.active() != null) {
            field.setActive(request.active());
        }
        return response(repository.save(field));
    }

    private ProfessionalFieldResponse response(ProfessionalField field) {
        return new ProfessionalFieldResponse(
                field.getId(), field.getCode(), field.getName(), field.getDescription(),
                field.isActive(), field.getVersion(), field.getUpdatedAt()
        );
    }

    private String normalizeCode(String code) {
        String normalized = code.trim().toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9_]+", "_");
        if (normalized.length() < 2) {
            throw ValidationException.field("code", "Mã lĩnh vực phải có ít nhất 2 ký tự chữ hoặc số");
        }
        return normalized;
    }

    private String trimToNull(String value) {
        if (value == null || value.isBlank()) return null;
        return value.trim();
    }
}
