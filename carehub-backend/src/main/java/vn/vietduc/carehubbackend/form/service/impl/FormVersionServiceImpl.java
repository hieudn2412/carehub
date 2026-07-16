package vn.vietduc.carehubbackend.form.service.impl;

import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;
import vn.vietduc.carehubbackend.exception.ConflictException;
import vn.vietduc.carehubbackend.exception.ResourceNotFoundException;
import vn.vietduc.carehubbackend.exception.UnauthorizedException;
import vn.vietduc.carehubbackend.exception.ValidationException;
import vn.vietduc.carehubbackend.form.dto.request.CreateFormVersionRequest;
import vn.vietduc.carehubbackend.form.dto.response.FormVersionResponse;
import vn.vietduc.carehubbackend.form.dto.response.FormVersionSummaryResponse;
import vn.vietduc.carehubbackend.form.entity.Form;
import vn.vietduc.carehubbackend.form.entity.FormVersion;
import vn.vietduc.carehubbackend.form.entity.enums.FormStatus;
import vn.vietduc.carehubbackend.form.entity.enums.FormVersionStatus;
import vn.vietduc.carehubbackend.form.mapper.FormMapper;
import vn.vietduc.carehubbackend.form.repository.FormRepository;
import vn.vietduc.carehubbackend.form.repository.FormVersionRepository;
import vn.vietduc.carehubbackend.form.service.FormVersionService;
import vn.vietduc.carehubbackend.form.service.FormVersionValidator;
import vn.vietduc.carehubbackend.user.entity.User;
import vn.vietduc.carehubbackend.user.repository.UserRepository;
import vn.vietduc.carehubbackend.utils.SecurityUtils;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

@Service
@RequiredArgsConstructor
public class FormVersionServiceImpl implements FormVersionService {
    private static final int MAX_PAGE_SIZE = 100;

    private final FormVersionRepository versionRepository;
    private final FormRepository formRepository;
    private final UserRepository userRepository;
    private final SecurityUtils securityUtils;
    private final FormMapper mapper;
    private final FormVersionValidator validator;
    private final EntityManager entityManager;
    private final ObjectMapper objectMapper;

    @Override
    @Transactional(readOnly = true)
    public Page<FormVersionSummaryResponse> search(
            Long formId,
            FormVersionStatus status,
            Pageable pageable
    ) {
        requireForm(formId);
        Pageable normalized = normalizePageable(pageable);
        Page<FormVersion> versions = status == null
                ? versionRepository.findByForm_Id(formId, normalized)
                : versionRepository.findByForm_IdAndStatus(formId, status, normalized);
        return versions.map(mapper::toSummaryResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public FormVersionResponse get(Long formId, Long versionId) {
        return mapper.toResponse(findVersion(formId, versionId));
    }

    @Override
    @Transactional
    public FormVersionResponse create(Long formId, CreateFormVersionRequest request) {
        Form form = formRepository.findActiveByIdForUpdate(formId)
                .orElseThrow(() -> new ResourceNotFoundException("Form not found"));
        if (versionRepository.existsByForm_IdAndStatus(formId, FormVersionStatus.DRAFT)) {
            throw new ConflictException("This form already has a draft version");
        }

        FormVersion version = FormVersion.builder()
                .form(form)
                .versionNumber(versionRepository.findMaxVersionNumber(formId) + 1)
                .status(FormVersionStatus.DRAFT)
                .title(form.getTitle())
                .description(form.getDescription())
                .build();

        FormVersion source = resolveSource(form, request.sourceVersionId());
        if (source != null) {
            mapper.cloneStructure(source, version);
        }
        mapper.replaceStructure(version, request);
        validator.validateDraft(version);
        updateSchemaSnapshot(version);
        return mapper.toResponse(saveAndRefresh(version));
    }

    @Override
    @Transactional
    public FormVersionResponse update(Long formId, Long versionId, CreateFormVersionRequest request) {
        FormVersion version = findVersion(formId, versionId);
        requireDraft(version);
        if (request.sourceVersionId() != null) {
            throw ValidationException.field("sourceVersionId", "Source version can only be specified when creating a draft");
        }
        if (request.lockVersion() == null) {
            throw ValidationException.field("lockVersion", "Lock version is required when updating a draft");
        }
        if (!request.lockVersion().equals(version.getLockVersion())) {
            throw new ConflictException("Form version has been updated by another user");
        }

        mapper.replaceStructure(version, request);
        validator.validateDraft(version);
        updateSchemaSnapshot(version);
        return mapper.toResponse(saveAndRefresh(version));
    }

    @Override
    @Transactional
    public FormVersionResponse publish(Long formId, Long versionId) {
        Form form = formRepository.findActiveByIdForUpdate(formId)
                .orElseThrow(() -> new ResourceNotFoundException("Form not found"));
        FormVersion version = findVersion(formId, versionId);
        requireDraft(version);
        validator.validatePublishable(version);

        FormVersion previous = form.getCurrentPublishedVersion();
        if (previous != null && !previous.getId().equals(version.getId())) {
            previous.setStatus(FormVersionStatus.RETIRED);
            versionRepository.save(previous);
        }

        version.setStatus(FormVersionStatus.PUBLISHED);
        version.setPublishedAt(Instant.now());
        version.setPublishedBy(currentUser());
        updateSchemaSnapshot(version);
        FormVersion published = versionRepository.saveAndFlush(version);

        form.setCurrentPublishedVersion(published);
        form.setCurrentVersionNumber(published.getVersionNumber());
        form.setStatus(FormStatus.PUBLISHED);
        formRepository.save(form);
        return mapper.toResponse(published);
    }

    @Override
    @Transactional
    public void delete(Long formId, Long versionId) {
        FormVersion version = findVersion(formId, versionId);
        requireDraft(version);
        versionRepository.delete(version);
    }

    private FormVersion resolveSource(Form form, Long sourceVersionId) {
        if (sourceVersionId != null) {
            return findVersion(form.getId(), sourceVersionId);
        }
        if (form.getCurrentPublishedVersion() != null) {
            return findVersion(form.getId(), form.getCurrentPublishedVersion().getId());
        }
        return null;
    }

    private Form requireForm(Long formId) {
        return formRepository.findByIdAndDeletedFalse(formId)
                .orElseThrow(() -> new ResourceNotFoundException("Form not found"));
    }

    private FormVersion findVersion(Long formId, Long versionId) {
        return versionRepository.findByIdAndForm_Id(versionId, formId)
                .orElseThrow(() -> new ResourceNotFoundException("Form version not found"));
    }

    private void requireDraft(FormVersion version) {
        if (version.getStatus() != FormVersionStatus.DRAFT) {
            throw new ConflictException("Only a draft version can be modified");
        }
    }

    private User currentUser() {
        Long userId;
        try {
            userId = securityUtils.getCurrentUserId();
        } catch (RuntimeException ex) {
            throw new UnauthorizedException("Authenticated user is required");
        }
        return userRepository.findById(userId)
                .orElseThrow(() -> new UnauthorizedException("Người dùng đã xác thực không còn tồn tại"));
    }

    private void updateSchemaSnapshot(FormVersion version) {
        version.setSchemaJson(mapper.toSchemaJson(version));
        version.setSchemaHash(sha256(serializeCanonical(version.getSchemaJson())));
    }

    private FormVersion saveAndRefresh(FormVersion version) {
        FormVersion saved = versionRepository.saveAndFlush(version);
        entityManager.flush();
        entityManager.refresh(saved);
        return saved;
    }

    private String sha256(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 is not available", ex);
        }
    }

    private String serializeCanonical(Object value) {
        try {
            return objectMapper.writeValueAsString(canonicalize(value));
        } catch (JacksonException ex) {
            throw new IllegalStateException("Could not serialize form schema", ex);
        }
    }

    private Object canonicalize(Object value) {
        if (value instanceof Map<?, ?> map) {
            Map<String, Object> sorted = new TreeMap<>();
            map.forEach((key, item) -> sorted.put(String.valueOf(key), canonicalize(item)));
            return sorted;
        }
        if (value instanceof List<?> list) {
            return list.stream().map(this::canonicalize).toList();
        }
        return value;
    }

    private Pageable normalizePageable(Pageable pageable) {
        if (pageable.getPageSize() < 1 || pageable.getPageSize() > MAX_PAGE_SIZE) {
            throw ValidationException.field("size", "Page size must be between 1 and " + MAX_PAGE_SIZE);
        }
        Map<String, String> allowedSorts = Map.of(
                "versionNumber", "versionNumber",
                "status", "status",
                "createdAt", "createdAt",
                "updatedAt", "updatedAt",
                "publishedAt", "publishedAt"
        );
        Sort sort = pageable.getSort().isSorted()
                ? Sort.by(pageable.getSort().stream().map(order -> {
                    String property = allowedSorts.get(order.getProperty());
                    if (property == null) {
                        throw ValidationException.field("sort", "Unsupported sort field: " + order.getProperty());
                    }
                    return new Sort.Order(order.getDirection(), property);
                }).toList())
                : Sort.by(Sort.Order.desc("versionNumber"));
        return PageRequest.of(pageable.getPageNumber(), pageable.getPageSize(), sort);
    }
}

