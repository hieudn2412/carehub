package vn.vietduc.carehubbackend.form.service.impl;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.vietduc.carehubbackend.exception.ResourceNotFoundException;
import vn.vietduc.carehubbackend.exception.ValidationException;
import vn.vietduc.carehubbackend.form.dto.response.FormPreviewDetailResponse;
import vn.vietduc.carehubbackend.form.dto.response.FormPreviewSummaryResponse;
import vn.vietduc.carehubbackend.form.dto.response.FormResponse;
import vn.vietduc.carehubbackend.form.entity.Form;
import vn.vietduc.carehubbackend.form.entity.FormVersion;
import vn.vietduc.carehubbackend.form.entity.enums.FormStatus;
import vn.vietduc.carehubbackend.form.entity.enums.FormSubjectType;
import vn.vietduc.carehubbackend.form.entity.enums.FormVersionStatus;
import vn.vietduc.carehubbackend.form.mapper.FormMapper;
import vn.vietduc.carehubbackend.form.repository.FormRepository;
import vn.vietduc.carehubbackend.form.repository.FormVersionRepository;
import vn.vietduc.carehubbackend.form.service.FormPreviewService;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class FormPreviewServiceImpl implements FormPreviewService {
    private static final int MAX_PAGE_SIZE = 100;

    private final FormRepository formRepository;
    private final FormVersionRepository versionRepository;
    private final FormMapper mapper;

    @Override
    @Transactional(readOnly = true)
    public Page<FormPreviewSummaryResponse> search(
            String keyword,
            FormStatus status,
            FormSubjectType subjectType,
            Long ownerDepartmentId,
            Pageable pageable
    ) {
        Page<Form> forms = formRepository.search(
                keyword == null ? "" : keyword.trim(),
                status,
                subjectType,
                ownerDepartmentId,
                normalizePageable(pageable)
        );
        Map<Long, FormVersion> previewVersions = selectPreviewVersions(forms.getContent());
        return forms.map(form -> toSummary(form, previewVersions.get(form.getId())));
    }

    @Override
    @Transactional(readOnly = true)
    public FormPreviewDetailResponse get(Long formId, Long versionId) {
        Form form = formRepository.findByIdAndDeletedFalse(formId)
                .orElseThrow(() -> new ResourceNotFoundException("Form not found"));
        FormVersion version = versionId == null
                ? findPreviewVersion(formId)
                : versionRepository.findByIdAndForm_Id(versionId, formId)
                .orElseThrow(() -> new ResourceNotFoundException("Form version not found"));

        return FormPreviewDetailResponse.builder()
                .form(mapper.toResponse(form))
                .version(mapper.toResponse(version))
                .build();
    }

    private FormPreviewSummaryResponse toSummary(Form form, FormVersion previewVersion) {
        FormResponse formResponse = mapper.toResponse(form);
        return FormPreviewSummaryResponse.builder()
                .id(formResponse.id())
                .code(formResponse.code())
                .title(formResponse.title())
                .description(formResponse.description())
                .subjectType(formResponse.subjectType())
                .status(formResponse.status())
                .ownerDepartment(formResponse.ownerDepartment())
                .previewVersion(previewVersion == null ? null : mapper.toSummaryResponse(previewVersion))
                .createdAt(formResponse.createdAt())
                .updatedAt(formResponse.updatedAt())
                .build();
    }

    private Map<Long, FormVersion> selectPreviewVersions(List<Form> forms) {
        if (forms.isEmpty()) {
            return Map.of();
        }
        List<Long> formIds = forms.stream().map(Form::getId).toList();
        Map<Long, FormVersion> selected = new HashMap<>();
        versionRepository.findByForm_IdIn(formIds).forEach(candidate -> {
            Long formId = candidate.getForm().getId();
            FormVersion current = selected.get(formId);
            if (current == null || isPreferred(candidate, current)) {
                selected.put(formId, candidate);
            }
        });
        return selected;
    }

    private boolean isPreferred(FormVersion candidate, FormVersion current) {
        int candidateRank = statusRank(candidate.getStatus());
        int currentRank = statusRank(current.getStatus());
        return candidateRank < currentRank
                || candidateRank == currentRank
                && candidate.getVersionNumber() > current.getVersionNumber();
    }

    private int statusRank(FormVersionStatus status) {
        return switch (status) {
            case DRAFT -> 0;
            case PUBLISHED -> 1;
            case RETIRED -> 2;
        };
    }

    private FormVersion findPreviewVersion(Long formId) {
        FormVersion version = findPreviewVersionOrNull(formId);
        if (version == null) {
            throw new ResourceNotFoundException("Form has no version to preview");
        }
        return version;
    }

    private FormVersion findPreviewVersionOrNull(Long formId) {
        return versionRepository.findFirstByForm_IdAndStatusOrderByVersionNumberDesc(
                        formId,
                        FormVersionStatus.DRAFT
                )
                .or(() -> versionRepository.findFirstByForm_IdAndStatusOrderByVersionNumberDesc(
                        formId,
                        FormVersionStatus.PUBLISHED
                ))
                .or(() -> versionRepository.findFirstByForm_IdOrderByVersionNumberDesc(formId))
                .orElse(null);
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
}
