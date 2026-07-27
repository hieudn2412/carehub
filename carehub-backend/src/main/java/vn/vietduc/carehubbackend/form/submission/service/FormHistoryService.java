package vn.vietduc.carehubbackend.form.submission.service;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.vietduc.carehubbackend.exception.ResourceNotFoundException;
import vn.vietduc.carehubbackend.exception.ValidationException;
import vn.vietduc.carehubbackend.form.dto.response.FormResponse;
import vn.vietduc.carehubbackend.form.entity.enums.FormVersionStatus;
import vn.vietduc.carehubbackend.form.repository.FormRepository;
import vn.vietduc.carehubbackend.form.service.FormService;
import vn.vietduc.carehubbackend.form.submission.dto.FormHistorySummaryResponse;
import vn.vietduc.carehubbackend.form.submission.dto.FormVersionHistorySummaryResponse;
import vn.vietduc.carehubbackend.form.submission.entity.FormSubmissionResult;
import vn.vietduc.carehubbackend.form.submission.entity.FormSubmissionStatus;
import vn.vietduc.carehubbackend.form.submission.repository.FormSubmissionRepository;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class FormHistoryService {
    private static final int MAX_PAGE_SIZE = 100;
    private static final Set<FormVersionStatus> HISTORY_VERSION_STATUSES = Set.of(
            FormVersionStatus.PUBLISHED,
            FormVersionStatus.RETIRED
    );
    private static final List<FormSubmissionResult> FAILED_RESULTS = List.of(
            FormSubmissionResult.FAILED_SCORE,
            FormSubmissionResult.FAILED_CRITICAL
    );

    private final FormSubmissionRepository submissionRepository;
    private final FormRepository formRepository;
    private final FormService formService;

    @Transactional(readOnly = true)
    public Page<FormHistorySummaryResponse> searchForms(String keyword, Pageable pageable) {
        String normalizedKeyword = keyword == null || keyword.isBlank()
                ? null
                : "%" + keyword.trim().toLowerCase(Locale.ROOT) + "%";
        return submissionRepository.searchHistoryForms(
                        normalizedKeyword,
                        HISTORY_VERSION_STATUSES,
                        FormSubmissionStatus.SUBMITTED,
                        normalize(pageable)
                )
                .map(item -> new FormHistorySummaryResponse(
                        item.getFormId(),
                        item.getCode(),
                        item.getTitle(),
                        value(item.getVersionCount()),
                        value(item.getSubmissionCount())
                ));
    }

    @Transactional(readOnly = true)
    public FormResponse getForm(Long formId) {
        return formService.get(formId);
    }

    @Transactional(readOnly = true)
    public List<FormVersionHistorySummaryResponse> getVersions(Long formId) {
        formRepository.findByIdAndDeletedFalse(formId)
                .orElseThrow(() -> new ResourceNotFoundException("Form not found"));
        return submissionRepository.findHistoryVersions(
                        formId,
                        HISTORY_VERSION_STATUSES,
                        FormSubmissionStatus.SUBMITTED,
                        FormSubmissionResult.PASSED,
                        FAILED_RESULTS
                ).stream()
                .map(item -> new FormVersionHistorySummaryResponse(
                        item.getFormId(),
                        item.getVersionId(),
                        item.getVersionNumber(),
                        item.getTitle(),
                        item.getDescription(),
                        item.getStatus(),
                        item.getPublishedAt(),
                        item.getPublishedBy(),
                        value(item.getTotal()),
                        value(item.getPassed()),
                        value(item.getFailed()),
                        decimal(item.getAverageConvertedScore())
                ))
                .toList();
    }

    private Pageable normalize(Pageable pageable) {
        if (pageable.getPageSize() < 1 || pageable.getPageSize() > MAX_PAGE_SIZE) {
            throw ValidationException.field("size", "Page size must be between 1 and " + MAX_PAGE_SIZE);
        }
        return PageRequest.of(pageable.getPageNumber(), pageable.getPageSize(), Sort.unsorted());
    }

    private long value(Long value) {
        return value == null ? 0 : value;
    }

    private BigDecimal decimal(Double value) {
        return value == null ? null : BigDecimal.valueOf(value).setScale(4, RoundingMode.HALF_UP);
    }
}
