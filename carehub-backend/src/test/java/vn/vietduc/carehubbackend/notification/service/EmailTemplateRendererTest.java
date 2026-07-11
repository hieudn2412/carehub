package vn.vietduc.carehubbackend.notification.service;

import org.junit.jupiter.api.Test;
import vn.vietduc.carehubbackend.exception.UnprocessableEntityException;
import vn.vietduc.carehubbackend.notification.entity.NotificationAudience;
import vn.vietduc.carehubbackend.notification.entity.NotificationEventType;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class EmailTemplateRendererTest {
    private final EmailTemplateRenderer renderer = new EmailTemplateRenderer(new NotificationEventCatalog());

    @Test
    void rendersOnlyVariablesAllowedForTheBoundEvent() {
        EmailTemplateRenderer.RenderedTemplate rendered = renderer.render(
                NotificationEventType.EXAM_ASSIGNED,
                NotificationAudience.EMPLOYEE,
                "Bài thi {{exam_name}}",
                "Chào {{recipient_name}}, hạn {{due_at}}",
                Map.of(
                        "exam_name", "An toàn người bệnh",
                        "recipient_name", "Nguyễn Văn A",
                        "due_at", "2026-07-15"
                )
        );

        assertEquals("Bài thi An toàn người bệnh", rendered.subject());
        assertEquals("Chào Nguyễn Văn A, hạn 2026-07-15", rendered.body());
    }

    @Test
    void rejectsUnsupportedOrMalformedVariables() {
        assertThrows(UnprocessableEntityException.class, () -> renderer.validate(
                NotificationEventType.EXAM_ASSIGNED,
                NotificationAudience.EMPLOYEE,
                "{{manager_name}}",
                "Nội dung"
        ));
        assertThrows(UnprocessableEntityException.class, () -> renderer.validate(
                NotificationEventType.EXAM_ASSIGNED,
                NotificationAudience.EMPLOYEE,
                "{{exam_name}",
                "Nội dung"
        ));
    }

    @Test
    void rejectsMissingRuntimeVariable() {
        assertThrows(UnprocessableEntityException.class, () -> renderer.render(
                NotificationEventType.CME_HOURS_BELOW_REQUIREMENT,
                NotificationAudience.MANAGER,
                "{{employee_name}}",
                "Thiếu {{missing_hours}} giờ",
                Map.of("employee_name", "Nguyễn Văn A")
        ));
    }

    @Test
    void examAssignmentCannotBeBoundToManagerAudience() {
        assertThrows(UnprocessableEntityException.class, () -> renderer.validate(
                NotificationEventType.EXAM_ASSIGNED,
                NotificationAudience.MANAGER,
                "Thông báo",
                "Nội dung"
        ));
    }
}
