package vn.vietduc.carehubbackend.form.service.impl;

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
import vn.vietduc.carehubbackend.form.dto.request.CreateFormRequest;
import vn.vietduc.carehubbackend.form.dto.request.UpdateFormRequest;
import vn.vietduc.carehubbackend.form.dto.response.FormResponse;
import vn.vietduc.carehubbackend.form.entity.Form;
import vn.vietduc.carehubbackend.form.entity.enums.FormStatus;
import vn.vietduc.carehubbackend.form.entity.enums.FormSubjectType;
import vn.vietduc.carehubbackend.form.mapper.FormMapper;
import vn.vietduc.carehubbackend.form.repository.FormRepository;
import vn.vietduc.carehubbackend.form.service.FormService;
import vn.vietduc.carehubbackend.user.entity.Department;
import vn.vietduc.carehubbackend.user.repository.DepartmentRepository;

import java.util.Map;

@Service
@RequiredArgsConstructor
public class FormServiceImpl implements FormService {
    private static final int MAX_PAGE_SIZE = 100;

    private final FormRepository formRepository;
    private final DepartmentRepository departmentRepository;
    private final FormMapper mapper;

    @Override
    @Transactional(readOnly = true)
    public Page<FormResponse> search(
            String keyword,
            FormStatus status,
            FormSubjectType subjectType,
            Long ownerDepartmentId,
            Pageable pageable
    ) {
        return formRepository.search(
                normalizeKeyword(keyword),
                status,
                subjectType,
                ownerDepartmentId,
                normalizePageable(pageable)
        ).map(mapper::toResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public FormResponse get(Long id) {
        return mapper.toResponse(findActive(id));
    }

    @Override
    @Transactional
    public FormResponse create(CreateFormRequest request) {
        String code = normalizeCode(request.code());
        if (formRepository.existsByCodeIgnoreCase(code)) {
            throw new ConflictException("Form code already exists");
        }

        Form form = Form.builder()
                .code(code)
                .title(request.title().trim())
                .description(trimToNull(request.description()))
                .subjectType(request.subjectType())
                .status(FormStatus.DRAFT)
                .ownerDepartment(resolveDepartment(request.ownerDepartmentId()))
                .deleted(false)
                .build();
        return mapper.toResponse(formRepository.save(form));
    }

    @Override
    @Transactional
    public FormResponse update(Long id, UpdateFormRequest request) {
        Form form = findActive(id);
        form.setTitle(request.title().trim());
        form.setDescription(trimToNull(request.description()));
        form.setSubjectType(request.subjectType());
        form.setOwnerDepartment(resolveDepartment(request.ownerDepartmentId()));
        return mapper.toResponse(formRepository.save(form));
    }

    @Override
    @Transactional
    public void delete(Long id) {
        Form form = findActive(id);
        form.setDeleted(true);
        form.setStatus(FormStatus.RETIRED);
        formRepository.save(form);
    }

    private Form findActive(Long id) {
        return formRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new ResourceNotFoundException("Form not found"));
    }

    private Department resolveDepartment(Long id) {
        if (id == null) {
            return null;
        }
        return departmentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy phòng ban sở hữu"));
    }

    private Pageable normalizePageable(Pageable pageable) {
        if (pageable.getPageSize() < 1 || pageable.getPageSize() > MAX_PAGE_SIZE) {
            throw ValidationException.field("size", "Page size must be between 1 and " + MAX_PAGE_SIZE);
        }
        Map<String, String> allowedSorts = Map.of(
                "id", "id",
                "code", "code",
                "title", "title",
                "status", "status",
                "createdAt", "createdAt",
                "updatedAt", "updatedAt"
        );
        Sort sort = pageable.getSort().isSorted()
                ? Sort.by(pageable.getSort().stream().map(order -> {
                    String property = allowedSorts.get(order.getProperty());
                    if (property == null) {
                        throw ValidationException.field("sort", "Unsupported sort field: " + order.getProperty());
                    }
                    return new Sort.Order(order.getDirection(), property);
                }).toList())
                : Sort.by(Sort.Order.desc("updatedAt"), Sort.Order.asc("id"));
        return PageRequest.of(pageable.getPageNumber(), pageable.getPageSize(), sort);
    }

    private String normalizeKeyword(String keyword) {
        return keyword == null ? "" : keyword.trim();
    }

    private String normalizeCode(String code) {
        return code.trim().toUpperCase();
    }

    private String trimToNull(String value) {
        if (value == null || value.trim().isEmpty()) {
            return null;
        }
        return value.trim();
    }
}
