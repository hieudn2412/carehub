package vn.vietduc.carehubbackend.form.importer.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;
import vn.vietduc.carehubbackend.form.dto.request.CreateFormRequest;
import vn.vietduc.carehubbackend.form.dto.request.CreateFormVersionRequest;
import vn.vietduc.carehubbackend.form.dto.response.FormResponse;
import vn.vietduc.carehubbackend.form.dto.response.FormVersionResponse;
import vn.vietduc.carehubbackend.form.entity.Form;
import vn.vietduc.carehubbackend.form.entity.FormVersion;
import vn.vietduc.carehubbackend.form.entity.enums.FormSubjectType;
import vn.vietduc.carehubbackend.form.entity.enums.FormVersionStatus;
import vn.vietduc.carehubbackend.form.importer.entity.FormImportRow;
import vn.vietduc.carehubbackend.form.importer.entity.FormImportRowStatus;
import vn.vietduc.carehubbackend.form.importer.repository.FormImportRowRepository;
import vn.vietduc.carehubbackend.form.repository.FormRepository;
import vn.vietduc.carehubbackend.form.repository.FormVersionRepository;
import vn.vietduc.carehubbackend.form.service.FormService;
import vn.vietduc.carehubbackend.form.service.FormVersionService;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class FormImportApplier {
    private final FormImportRowRepository rowRepository;
    private final FormRepository formRepository;
    private final FormVersionRepository versionRepository;
    private final FormService formService;
    private final FormVersionService versionService;
    private final ObjectMapper objectMapper;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void apply(Long rowId) {
        FormImportRow row = rowRepository.findById(rowId).orElseThrow();
        if (row.getStatus() != FormImportRowStatus.READY && row.getStatus() != FormImportRowStatus.WARNING) {
            return;
        }
        Form form = formRepository.findByCodeIgnoreCaseAndDeletedFalse(row.getRequestedCode()).orElse(null);
        if (form != null) {
            FormVersion draft = versionRepository
                    .findFirstByForm_IdAndStatusOrderByVersionNumberDesc(form.getId(), FormVersionStatus.DRAFT)
                    .orElse(null);
            FormVersion published = versionRepository
                    .findFirstByForm_IdAndStatusOrderByVersionNumberDesc(form.getId(), FormVersionStatus.PUBLISHED)
                    .orElse(null);
            if (sameHash(draft, row.getSourceHash()) || sameHash(published, row.getSourceHash())) {
                row.setStatus(FormImportRowStatus.SKIPPED);
                row.setForm(form);
                row.setFormVersion(draft != null && sameHash(draft, row.getSourceHash()) ? draft : published);
                rowRepository.save(row);
                return;
            }
            if (draft != null) {
                row.setStatus(FormImportRowStatus.CONFLICT);
                appendMessage(row, "ERROR", "EXISTING_DRAFT", "Form already has a different draft version");
                row.setForm(form);
                row.setFormVersion(draft);
                rowRepository.save(row);
                return;
            }
        } else {
            FormResponse created = formService.create(CreateFormRequest.builder()
                    .code(row.getRequestedCode()).title(row.getSourceTitle())
                    .subjectType(FormSubjectType.USER).build());
            form = formRepository.findById(created.id()).orElseThrow();
        }

        CreateFormVersionRequest request = objectMapper.convertValue(row.getNormalizedSchema(), CreateFormVersionRequest.class);
        FormVersionResponse version = versionService.create(form.getId(), request);
        row.setStatus(FormImportRowStatus.IMPORTED);
        row.setForm(form);
        row.setFormVersion(versionRepository.findById(version.id()).orElseThrow());
        rowRepository.save(row);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void markFailed(Long rowId, String message) {
        FormImportRow row = rowRepository.findById(rowId).orElseThrow();
        row.setStatus(FormImportRowStatus.FAILED);
        appendMessage(row, "ERROR", "APPLY_FAILED", message);
        rowRepository.save(row);
    }

    private boolean sameHash(FormVersion version, String sourceHash) {
        if (version == null || version.getSettingsJson() == null) return false;
        Object metadata = version.getSettingsJson().get("importMetadata");
        if (!(metadata instanceof Map<?, ?> map)) return false;
        return sourceHash.equals(map.get("sourceHash"));
    }

    private void appendMessage(FormImportRow row, String severity, String code, String message) {
        List<Map<String, Object>> messages = row.getMessages() == null
                ? new ArrayList<>() : new ArrayList<>(row.getMessages());
        Map<String, Object> detail = new LinkedHashMap<>();
        detail.put("severity", severity);
        detail.put("code", code);
        detail.put("message", message == null ? "Unknown import error" : message);
        messages.add(detail);
        row.setMessages(messages);
    }
}

