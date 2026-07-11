package vn.vietduc.carehubbackend.notification.service;

import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.vietduc.carehubbackend.exception.ConflictException;
import vn.vietduc.carehubbackend.exception.ResourceNotFoundException;
import vn.vietduc.carehubbackend.exception.ValidationException;
import vn.vietduc.carehubbackend.notification.dto.EmailTemplatePreviewRequest;
import vn.vietduc.carehubbackend.notification.dto.EmailTemplatePreviewResponse;
import vn.vietduc.carehubbackend.notification.dto.EmailTemplateRequest;
import vn.vietduc.carehubbackend.notification.dto.EmailTemplateResponse;
import vn.vietduc.carehubbackend.notification.entity.EmailTemplate;
import vn.vietduc.carehubbackend.notification.entity.NotificationAudience;
import vn.vietduc.carehubbackend.notification.entity.NotificationCadence;
import vn.vietduc.carehubbackend.notification.entity.NotificationCategory;
import vn.vietduc.carehubbackend.notification.entity.NotificationEventType;
import vn.vietduc.carehubbackend.notification.repository.EmailTemplateRepository;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class EmailTemplateService {
    private static final int MAX_PAGE_SIZE = 100;
    private static final Set<String> ALLOWED_SORTS = Set.of("name", "code", "category", "eventType", "active", "updatedAt", "createdAt");

    private final EmailTemplateRepository repository;
    private final NotificationEventCatalog catalog;
    private final NotificationPolicyService policyService;
    private final EmailTemplateRenderer renderer;

    @Transactional(readOnly = true)
    public Page<EmailTemplateResponse> list(
            String q,
            NotificationCategory category,
            NotificationEventType eventType,
            Boolean active,
            Pageable pageable
    ) {
        Pageable normalized = normalizePageable(pageable);
        String query = q == null || q.isBlank() ? null : q.trim().toLowerCase(Locale.ROOT);
        Specification<EmailTemplate> specification = (root, ignored, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (query != null) {
                String pattern = "%" + query + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("code")), pattern),
                        cb.like(cb.lower(root.get("name")), pattern),
                        cb.like(cb.lower(root.get("subject")), pattern)
                ));
            }
            if (category != null) {
                predicates.add(cb.equal(root.get("category"), category));
            }
            if (eventType != null) {
                predicates.add(cb.equal(root.get("eventType"), eventType));
            }
            if (active != null) {
                predicates.add(cb.equal(root.get("active"), active));
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };
        return repository.findAll(specification, normalized).map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public EmailTemplateResponse get(Long id) {
        return toResponse(find(id));
    }

    @Transactional
    public EmailTemplateResponse create(EmailTemplateRequest request) {
        String code = normalizeCode(request.getCode());
        if (repository.existsByCode(code)) {
            throw new ConflictException("Email template code already exists");
        }
        validateRequest(request);
        EmailTemplate template = EmailTemplate.builder()
                .code(code)
                .name(request.getName().trim())
                .category(request.getCategory())
                .eventType(request.getEventType())
                .audience(request.getAudience())
                .subject(request.getSubject().trim())
                .body(request.getBody())
                .mandatory(false)
                .active(request.isActive())
                .build();
        if (template.isActive()) {
            deactivateCompetingTemplates(template, null);
        }
        return toResponse(repository.save(template));
    }

    @Transactional
    public EmailTemplateResponse update(Long id, EmailTemplateRequest request) {
        EmailTemplate template = find(id);
        if (request.getVersion() != null && !Objects.equals(request.getVersion(), template.getVersion())) {
            throw new ConflictException("Email template was updated by another request");
        }
        String code = normalizeCode(request.getCode());
        if (template.isMandatory()) {
            if (!template.getCode().equals(code)
                    || template.getEventType() != request.getEventType()
                    || template.getAudience() != request.getAudience()) {
                throw new ConflictException("System template code, event type and audience cannot be changed");
            }
        } else if (repository.existsByCodeAndIdNot(code, id)) {
            throw new ConflictException("Email template code already exists");
        }
        validateRequest(request);
        template.setCode(code);
        template.setName(request.getName().trim());
        template.setCategory(request.getCategory());
        template.setEventType(request.getEventType());
        template.setAudience(request.getAudience());
        template.setSubject(request.getSubject().trim());
        template.setBody(request.getBody());
        template.setActive(request.isActive());
        if (template.isActive()) {
            deactivateCompetingTemplates(template, template.getId());
        }
        return toResponse(repository.save(template));
    }

    @Transactional
    public void delete(Long id) {
        EmailTemplate template = find(id);
        if (template.isMandatory()) {
            throw new ConflictException("System email templates cannot be deleted");
        }
        repository.delete(template);
    }

    @Transactional(readOnly = true)
    public EmailTemplatePreviewResponse preview(EmailTemplatePreviewRequest request) {
        EmailTemplateRenderer.RenderedTemplate rendered = renderer.render(
                request.eventType(),
                request.audience(),
                request.subject(),
                request.body(),
                request.variables()
        );
        return new EmailTemplatePreviewResponse(rendered.subject(), rendered.body());
    }

    @Transactional(readOnly = true)
    public Optional<RenderedEmail> renderActive(
            NotificationEventType eventType,
            NotificationAudience audience,
            java.util.Map<String, String> variables
    ) {
        return repository.findFirstByEventTypeAndAudienceAndActiveTrueOrderByUpdatedAtDesc(eventType, audience)
                .map(template -> {
                    EmailTemplateRenderer.RenderedTemplate rendered = renderer.render(
                            eventType,
                            audience,
                            template.getSubject(),
                            template.getBody(),
                            variables
                    );
                    return new RenderedEmail(template.getCode(), rendered.subject(), rendered.body());
                });
    }

    private void validateRequest(EmailTemplateRequest request) {
        catalog.validateBinding(request.getEventType(), request.getAudience(), request.getCategory());
        renderer.validate(request.getEventType(), request.getAudience(), request.getSubject(), request.getBody());
    }

    private void deactivateCompetingTemplates(EmailTemplate template, Long currentId) {
        repository.findByEventTypeAndAudienceAndActiveTrue(template.getEventType(), template.getAudience())
                .stream()
                .filter(existing -> currentId == null || !existing.getId().equals(currentId))
                .forEach(existing -> existing.setActive(false));
    }

    private EmailTemplateResponse toResponse(EmailTemplate template) {
        NotificationEventType eventType = template.getEventType();
        NotificationAudience audience = template.getAudience();
        Set<String> variables = eventType == null || audience == null
                ? Set.of()
                : catalog.allowedVariables(eventType, audience);
        NotificationCadence cadence = eventType == null
                ? NotificationCadence.IMMEDIATE
                : policyService.getPolicy(eventType).getCadence();
        return new EmailTemplateResponse(
                template.getId(),
                template.getCode(),
                template.getName() == null ? template.getCode() : template.getName(),
                template.getCategory(),
                eventType,
                audience,
                eventType == null ? "Không xác định" : catalog.triggerLabel(eventType, cadence),
                template.getSubject(),
                template.getBody(),
                template.isActive(),
                template.isMandatory(),
                template.isMandatory(),
                true,
                !template.isMandatory(),
                variables,
                template.getVersion(),
                template.getCreatedAt(),
                template.getUpdatedAt()
        );
    }

    private EmailTemplate find(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Email template not found"));
    }

    private String normalizeCode(String code) {
        return code == null ? "" : code.trim().toUpperCase(Locale.ROOT);
    }

    private Pageable normalizePageable(Pageable pageable) {
        int size = pageable.getPageSize();
        if (size < 1 || size > MAX_PAGE_SIZE) {
            throw ValidationException.field("size", "Page size must be between 1 and " + MAX_PAGE_SIZE);
        }
        Sort sort = pageable.getSort().isSorted() ? pageable.getSort() : Sort.by(Sort.Order.desc("updatedAt"));
        sort.forEach(order -> {
            if (!ALLOWED_SORTS.contains(order.getProperty())) {
                throw ValidationException.field("sort", "Unsupported sort field: " + order.getProperty());
            }
        });
        return PageRequest.of(Math.max(0, pageable.getPageNumber()), size, sort);
    }

    public record RenderedEmail(String templateCode, String subject, String body) {
    }
}
