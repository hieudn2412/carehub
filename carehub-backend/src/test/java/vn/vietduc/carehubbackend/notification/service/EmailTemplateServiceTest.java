package vn.vietduc.carehubbackend.notification.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import vn.vietduc.carehubbackend.exception.ConflictException;
import vn.vietduc.carehubbackend.exception.ValidationException;
import vn.vietduc.carehubbackend.notification.dto.EmailTemplateRequest;
import vn.vietduc.carehubbackend.notification.entity.EmailTemplate;
import vn.vietduc.carehubbackend.notification.entity.NotificationAudience;
import vn.vietduc.carehubbackend.notification.entity.NotificationCadence;
import vn.vietduc.carehubbackend.notification.entity.NotificationCategory;
import vn.vietduc.carehubbackend.notification.entity.NotificationConfig;
import vn.vietduc.carehubbackend.notification.entity.NotificationEventType;
import vn.vietduc.carehubbackend.notification.repository.EmailTemplateRepository;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class EmailTemplateServiceTest {
    @Mock
    private EmailTemplateRepository repository;

    @Mock
    private NotificationEventCatalog catalog;

    @Mock
    private NotificationPolicyService policyService;

    @Mock
    private EmailTemplateRenderer renderer;

    private EmailTemplateService service;

    @BeforeEach
    void setUp() {
        service = new EmailTemplateService(repository, catalog, policyService, renderer);
        lenient().when(catalog.allowedVariables(NotificationEventType.EXAM_ASSIGNED, NotificationAudience.EMPLOYEE))
                .thenReturn(Set.of("recipient_name", "exam_name"));
        lenient().when(policyService.getPolicy(NotificationEventType.EXAM_ASSIGNED)).thenReturn(NotificationConfig.builder()
                .eventType(NotificationEventType.EXAM_ASSIGNED)
                .cadence(NotificationCadence.IMMEDIATE)
                .build());
        lenient().when(catalog.triggerLabel(NotificationEventType.EXAM_ASSIGNED, NotificationCadence.IMMEDIATE))
                .thenReturn("Tự động · khi được giao");
    }

    @Test
    void createNormalizesCodeValidatesTemplateAndDeactivatesCompetingActiveTemplates() {
        EmailTemplate competing = template("OLD_EXAM", true);
        when(repository.existsByCode("EXAM_ASSIGNED_TEMPLATE")).thenReturn(false);
        when(repository.findByEventTypeAndAudienceAndActiveTrue(
                NotificationEventType.EXAM_ASSIGNED,
                NotificationAudience.EMPLOYEE
        )).thenReturn(List.of(competing));
        when(repository.save(any())).thenAnswer(invocation -> {
            EmailTemplate saved = invocation.getArgument(0);
            saved.setId(10L);
            saved.setVersion(0L);
            return saved;
        });

        var response = service.create(request(" exam_assigned_template ", true, null));

        assertEquals("EXAM_ASSIGNED_TEMPLATE", response.code());
        assertFalse(competing.isActive());
        verify(catalog).validateBinding(
                NotificationEventType.EXAM_ASSIGNED,
                NotificationAudience.EMPLOYEE,
                NotificationCategory.EVALUATION
        );
        verify(renderer).validate(
                eq(NotificationEventType.EXAM_ASSIGNED),
                eq(NotificationAudience.EMPLOYEE),
                anyString(),
                anyString()
        );
    }

    @Test
    void updateRejectsStaleVersionBeforeChangingTemplate() {
        EmailTemplate existing = template("EXAM_ASSIGNED_TEMPLATE", true);
        existing.setId(10L);
        existing.setVersion(3L);
        when(repository.findById(10L)).thenReturn(Optional.of(existing));

        assertThrows(ConflictException.class, () -> service.update(10L, request("EXAM_ASSIGNED_TEMPLATE", true, 2L)));

        verify(repository, never()).save(any());
    }

    @Test
    void deleteRejectsMandatorySystemTemplate() {
        EmailTemplate mandatory = template("SYSTEM_EXAM", true);
        mandatory.setMandatory(true);
        when(repository.findById(10L)).thenReturn(Optional.of(mandatory));

        assertThrows(ConflictException.class, () -> service.delete(10L));

        verify(repository, never()).delete(any(EmailTemplate.class));
    }

    @Test
    void listRejectsUnsupportedSortField() {
        assertThrows(
                ValidationException.class,
                () -> service.list(null, null, null, null, PageRequest.of(0, 20, Sort.by("subject;drop")))
        );
    }

    @Test
    void renderActiveUsesNewestActiveTemplateAndVariables() {
        EmailTemplate active = template("ACTIVE_EXAM", true);
        when(repository.findFirstByEventTypeAndAudienceAndActiveTrueOrderByUpdatedAtDesc(
                NotificationEventType.EXAM_ASSIGNED,
                NotificationAudience.EMPLOYEE
        )).thenReturn(Optional.of(active));
        when(renderer.render(
                eq(NotificationEventType.EXAM_ASSIGNED),
                eq(NotificationAudience.EMPLOYEE),
                eq(active.getSubject()),
                eq(active.getBody()),
                eq(Map.of("exam_name", "Safety test"))
        )).thenReturn(new EmailTemplateRenderer.RenderedTemplate("Rendered subject", "Rendered body"));

        var rendered = service.renderActive(
                NotificationEventType.EXAM_ASSIGNED,
                NotificationAudience.EMPLOYEE,
                Map.of("exam_name", "Safety test")
        );

        assertTrue(rendered.isPresent());
        assertEquals("ACTIVE_EXAM", rendered.get().templateCode());
        assertEquals("Rendered subject", rendered.get().subject());
        assertEquals("Rendered body", rendered.get().body());
    }

    @Test
    void updateDeactivatesCompetingTemplatesWhenActivating() {
        EmailTemplate existing = template("EXAM_ASSIGNED_TEMPLATE", false);
        existing.setId(10L);
        existing.setVersion(0L);
        EmailTemplate competing = template("COMPETING", true);
        competing.setId(11L);
        when(repository.findById(10L)).thenReturn(Optional.of(existing));
        when(repository.findByEventTypeAndAudienceAndActiveTrue(
                NotificationEventType.EXAM_ASSIGNED,
                NotificationAudience.EMPLOYEE
        )).thenReturn(List.of(competing));
        when(repository.save(existing)).thenReturn(existing);

        service.update(10L, request("EXAM_ASSIGNED_TEMPLATE", true, 0L));

        assertFalse(competing.isActive());
        ArgumentCaptor<EmailTemplate> captor = ArgumentCaptor.forClass(EmailTemplate.class);
        verify(repository).save(captor.capture());
        assertTrue(captor.getValue().isActive());
    }

    private EmailTemplateRequest request(String code, boolean active, Long version) {
        EmailTemplateRequest request = new EmailTemplateRequest();
        request.setCode(code);
        request.setName("Exam assigned");
        request.setCategory(NotificationCategory.EVALUATION);
        request.setEventType(NotificationEventType.EXAM_ASSIGNED);
        request.setAudience(NotificationAudience.EMPLOYEE);
        request.setSubject("Exam {{exam_name}} assigned");
        request.setBody("Hello {{recipient_name}}, exam {{exam_name}} is ready.");
        request.setActive(active);
        request.setVersion(version);
        return request;
    }

    private EmailTemplate template(String code, boolean active) {
        return EmailTemplate.builder()
                .id(10L)
                .code(code)
                .name("Exam assigned")
                .category(NotificationCategory.EVALUATION)
                .eventType(NotificationEventType.EXAM_ASSIGNED)
                .audience(NotificationAudience.EMPLOYEE)
                .subject("Exam {{exam_name}} assigned")
                .body("Hello {{recipient_name}}, exam {{exam_name}} is ready.")
                .active(active)
                .mandatory(false)
                .version(0L)
                .build();
    }
}
