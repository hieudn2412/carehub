package vn.vietduc.carehubbackend.form.importer.service;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.vietduc.carehubbackend.exception.ConflictException;
import vn.vietduc.carehubbackend.exception.ResourceNotFoundException;
import vn.vietduc.carehubbackend.exception.ValidationException;
import vn.vietduc.carehubbackend.form.importer.client.GooglePublicFormClient;
import vn.vietduc.carehubbackend.form.importer.config.FormImportProperties;
import vn.vietduc.carehubbackend.form.importer.dto.FormImportBatchResponse;
import vn.vietduc.carehubbackend.form.importer.dto.FormImportRequest;
import vn.vietduc.carehubbackend.form.importer.entity.*;
import vn.vietduc.carehubbackend.form.importer.mapper.GoogleFormMapper;
import vn.vietduc.carehubbackend.form.importer.parser.GoogleFormModel;
import vn.vietduc.carehubbackend.form.importer.parser.GooglePublicFormParser;
import vn.vietduc.carehubbackend.form.importer.repository.FormImportBatchRepository;
import vn.vietduc.carehubbackend.form.importer.repository.FormImportRowRepository;
import vn.vietduc.carehubbackend.user.entity.User;
import vn.vietduc.carehubbackend.user.repository.UserRepository;
import vn.vietduc.carehubbackend.utils.SecurityUtils;

import java.net.URI;
import java.time.LocalDateTime;
import java.util.*;

@Service
@RequiredArgsConstructor
public class FormImportService {
    private final FormImportBatchRepository batchRepository;
    private final FormImportRowRepository rowRepository;
    private final UserRepository userRepository;
    private final SecurityUtils securityUtils;
    private final FormImportProperties properties;
    private final GooglePublicFormClient client;
    private final GooglePublicFormParser parser;
    private final GoogleFormMapper mapper;
    private final FormImportApplier applier;

    @Transactional
    public FormImportBatchResponse createPreview(FormImportRequest request) {
        validateRequest(request);
        User actor = userRepository.findById(securityUtils.getCurrentUserId())
                .orElseThrow(() -> new ResourceNotFoundException("Authenticated user not found"));
        FormImportBatch batch = FormImportBatch.builder()
                .status(FormImportBatchStatus.PENDING).totalForms(request.forms().size())
                .importedByUser(actor).build();
        for (FormImportRequest.FormSource source : request.forms()) {
            URI uri = client.validate(source.sourceUrl());
            FormImportRow row = FormImportRow.builder().batch(batch).displayOrder(source.displayOrder())
                    .requestedCode(source.code().trim().toUpperCase(Locale.ROOT))
                    .sourceFormId(client.extractFormId(uri)).sourceUrl(uri.toString())
                    .status(FormImportRowStatus.PENDING).messages(new ArrayList<>()).build();
            batch.getRows().add(row);
        }
        batch = batchRepository.saveAndFlush(batch);
        batch.setStatus(FormImportBatchStatus.PROCESSING);
        batchRepository.saveAndFlush(batch);

        for (FormImportRow row : batch.getRows()) {
            processRow(row);
        }
        updatePreviewSummary(batch);
        return toResponse(batchRepository.saveAndFlush(batch), true);
    }

    public FormImportBatchResponse apply(Long batchId) {
        FormImportBatch batch = batchRepository.findDetailedById(batchId)
                .orElseThrow(() -> new ResourceNotFoundException("Form import batch not found"));
        if (batch.getStatus() != FormImportBatchStatus.VALIDATED && batch.getStatus() != FormImportBatchStatus.PARTIAL) {
            throw new ConflictException("Only a validated import batch can be applied");
        }
        batch.setStatus(FormImportBatchStatus.APPLYING);
        batchRepository.saveAndFlush(batch);
        for (FormImportRow row : batch.getRows()) {
            if (row.getStatus() == FormImportRowStatus.READY || row.getStatus() == FormImportRowStatus.WARNING) {
                try {
                    applier.apply(row.getId());
                } catch (Exception ex) {
                    applier.markFailed(row.getId(), ex.getMessage());
                }
            }
        }
        batch = batchRepository.findDetailedById(batchId).orElseThrow();
        boolean partial = batch.getRows().stream().anyMatch(row ->
                row.getStatus() == FormImportRowStatus.BLOCKED || row.getStatus() == FormImportRowStatus.CONFLICT
                        || row.getStatus() == FormImportRowStatus.FAILED);
        batch.setStatus(partial ? FormImportBatchStatus.APPLIED_PARTIAL : FormImportBatchStatus.APPLIED);
        batch.setAppliedAt(LocalDateTime.now());
        updateApplySummary(batch);
        return toResponse(batchRepository.saveAndFlush(batch), true);
    }

    @Transactional(readOnly = true)
    public FormImportBatchResponse get(Long id) {
        return toResponse(batchRepository.findDetailedById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Form import batch not found")), true);
    }

    @Transactional(readOnly = true)
    public Page<FormImportBatchResponse> list(Pageable pageable) {
        if (pageable.getPageSize() < 1 || pageable.getPageSize() > 100) {
            throw ValidationException.field("size", "Page size must be between 1 and 100");
        }
        return batchRepository.findAllByOrderByCreatedAtDesc(pageable).map(batch -> toResponse(batch, false));
    }

    private void processRow(FormImportRow row) {
        try {
            GooglePublicFormClient.Source fetched = client.fetch(row.getSourceUrl());
            GoogleFormModel parsed = parser.parse(fetched.formId(), fetched.html());
            GoogleFormMapper.Mapped mapped = mapper.map(parsed, fetched.normalizedUrl());
            row.setSourceTitle(limit(parsed.title(), 255));
            row.setRawPayload(parsed.rawPayload());
            row.setNormalizedSchema(mapped.schema());
            row.setSourceHash(mapped.sourceHash());
            row.setMessages(new ArrayList<>(mapped.messages()));
            row.setStatus(mapped.blocked() ? FormImportRowStatus.BLOCKED
                    : mapped.messages().isEmpty() ? FormImportRowStatus.READY : FormImportRowStatus.WARNING);
        } catch (Exception ex) {
            row.setStatus(FormImportRowStatus.FAILED);
            row.setMessages(List.of(Map.of("severity", "ERROR", "code", "FETCH_OR_PARSE_FAILED",
                    "message", ex.getMessage() == null ? "Unknown import error" : ex.getMessage())));
        }
        rowRepository.save(row);
    }

    private void validateRequest(FormImportRequest request) {
        if (request.forms().size() > properties.maxBatchSize()) {
            throw ValidationException.field("forms", "Batch may contain at most " + properties.maxBatchSize() + " forms");
        }
        Set<String> codes = new HashSet<>();
        Set<Integer> orders = new HashSet<>();
        for (FormImportRequest.FormSource source : request.forms()) {
            if (!codes.add(source.code().trim().toUpperCase(Locale.ROOT))) {
                throw ValidationException.field("forms", "Form codes must be unique within a batch");
            }
            if (!orders.add(source.displayOrder())) {
                throw ValidationException.field("forms", "Display orders must be unique within a batch");
            }
        }
    }

    private void updatePreviewSummary(FormImportBatch batch) {
        long ready = batch.getRows().stream().filter(row -> row.getStatus() == FormImportRowStatus.READY).count();
        long warning = batch.getRows().stream().filter(row -> row.getStatus() == FormImportRowStatus.WARNING).count();
        long failed = batch.getRows().stream().filter(row -> row.getStatus() == FormImportRowStatus.BLOCKED
                || row.getStatus() == FormImportRowStatus.FAILED).count();
        batch.setSuccessForms((int) (ready + warning));
        batch.setWarningForms((int) warning);
        batch.setFailedForms((int) failed);
        batch.setStatus(failed == 0 ? FormImportBatchStatus.VALIDATED
                : ready + warning == 0 ? FormImportBatchStatus.FAILED : FormImportBatchStatus.PARTIAL);
    }

    private void updateApplySummary(FormImportBatch batch) {
        batch.setSuccessForms((int) batch.getRows().stream().filter(row -> row.getStatus() == FormImportRowStatus.IMPORTED
                || row.getStatus() == FormImportRowStatus.SKIPPED).count());
        batch.setFailedForms((int) batch.getRows().stream().filter(row -> row.getStatus() == FormImportRowStatus.BLOCKED
                || row.getStatus() == FormImportRowStatus.CONFLICT || row.getStatus() == FormImportRowStatus.FAILED).count());
    }

    private FormImportBatchResponse toResponse(FormImportBatch batch, boolean includeRows) {
        List<FormImportBatchResponse.Row> rows = includeRows ? batch.getRows().stream().map(row ->
                FormImportBatchResponse.Row.builder().id(row.getId()).displayOrder(row.getDisplayOrder())
                        .code(row.getRequestedCode()).sourceFormId(row.getSourceFormId()).sourceUrl(row.getSourceUrl())
                        .sourceTitle(row.getSourceTitle()).sourceHash(row.getSourceHash()).status(row.getStatus())
                        .messages(row.getMessages()).normalizedSchema(row.getNormalizedSchema())
                        .formId(row.getForm() == null ? null : row.getForm().getId())
                        .versionId(row.getFormVersion() == null ? null : row.getFormVersion().getId()).build()).toList()
                : List.of();
        return FormImportBatchResponse.builder().id(batch.getId()).status(batch.getStatus())
                .totalForms(batch.getTotalForms()).successForms(batch.getSuccessForms())
                .failedForms(batch.getFailedForms()).warningForms(batch.getWarningForms())
                .importedByUserId(batch.getImportedByUser().getId()).createdAt(batch.getCreatedAt())
                .appliedAt(batch.getAppliedAt()).rows(rows).build();
    }

    private String limit(String value, int max) {
        if (value == null || value.isBlank()) return "Imported Google Form";
        return value.length() <= max ? value : value.substring(0, max);
    }
}

