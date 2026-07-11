package vn.vietduc.carehubbackend.notification.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;
import vn.vietduc.carehubbackend.common.response.ApiResponse;
import vn.vietduc.carehubbackend.common.response.PageResponse;
import vn.vietduc.carehubbackend.notification.dto.EmailTemplatePreviewRequest;
import vn.vietduc.carehubbackend.notification.dto.EmailTemplatePreviewResponse;
import vn.vietduc.carehubbackend.notification.dto.EmailTemplateRequest;
import vn.vietduc.carehubbackend.notification.dto.EmailTemplateResponse;
import vn.vietduc.carehubbackend.notification.dto.NotificationActionRequest;
import vn.vietduc.carehubbackend.notification.dto.NotificationConfigRequest;
import vn.vietduc.carehubbackend.notification.dto.NotificationConfigResponse;
import vn.vietduc.carehubbackend.notification.dto.NotificationEventDefinitionResponse;
import vn.vietduc.carehubbackend.notification.dto.NotificationReadRequest;
import vn.vietduc.carehubbackend.notification.dto.NotificationResponse;
import vn.vietduc.carehubbackend.notification.dto.NotificationUnreadCountResponse;
import vn.vietduc.carehubbackend.notification.entity.NotificationCategory;
import vn.vietduc.carehubbackend.notification.entity.NotificationEventType;
import vn.vietduc.carehubbackend.notification.service.EmailTemplateService;
import vn.vietduc.carehubbackend.notification.service.NotificationPolicyService;
import vn.vietduc.carehubbackend.notification.service.NotificationService;
import vn.vietduc.carehubbackend.notification.service.NotificationEventCatalog;

import java.net.URI;
import java.util.Arrays;
import java.util.List;

@RestController
@RequestMapping("${app.api-prefix}")
@RequiredArgsConstructor
public class NotificationController {
    private final NotificationService notificationService;
    private final NotificationPolicyService policyService;
    private final EmailTemplateService emailTemplateService;
    private final NotificationEventCatalog eventCatalog;

    @GetMapping("/notification-events")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<List<NotificationEventDefinitionResponse>>> getNotificationEvents() {
        List<NotificationEventDefinitionResponse> definitions = Arrays.stream(NotificationEventType.values())
                .map(eventType -> NotificationEventDefinitionResponse.from(eventType, eventCatalog))
                .toList();
        return ResponseEntity.ok(ApiResponse.success("Get notification event definitions successfully", definitions));
    }

    @GetMapping("/me/notifications")
    public ResponseEntity<ApiResponse<PageResponse<NotificationResponse>>> getMyNotifications(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) Boolean read,
            @PageableDefault(size = 20) Pageable pageable
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Get notifications successfully",
                PageResponse.from(notificationService.getCurrentUserNotifications(q, read, pageable))));
    }

    @GetMapping("/me/notifications/{id}")
    public ResponseEntity<ApiResponse<NotificationResponse>> getMyNotification(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(
                "Get notification successfully",
                notificationService.getCurrentUserNotification(id)));
    }

    @GetMapping("/me/notifications/unread-count")
    public ResponseEntity<ApiResponse<NotificationUnreadCountResponse>> getUnreadCount() {
        return ResponseEntity.ok(ApiResponse.success(
                "Get unread notification count successfully",
                new NotificationUnreadCountResponse(notificationService.countCurrentUserUnreadNotifications())));
    }

    @PatchMapping("/me/notifications/{id}")
    public ResponseEntity<ApiResponse<NotificationResponse>> updateMyNotification(
            @PathVariable Long id,
            @Valid @RequestBody NotificationReadRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Notification updated successfully",
                notificationService.setCurrentUserNotificationRead(id, request.read())));
    }

    @PatchMapping("/me/notifications/read-status")
    public ResponseEntity<ApiResponse<Integer>> updateAllMyNotifications(
            @Valid @RequestBody NotificationReadRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Notification read status updated successfully",
                notificationService.setAllCurrentUserNotificationsRead(request.read())));
    }

    @Deprecated(forRemoval = false)
    @PostMapping("/me/notifications/{id}/action")
    public ResponseEntity<ApiResponse<NotificationResponse>> actionMyNotification(
            @PathVariable Long id,
            @Valid @RequestBody NotificationActionRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Notification action completed",
                notificationService.actionCurrentUserNotification(id, request.getAction())));
    }

    @DeleteMapping("/me/notifications/{id}")
    public ResponseEntity<Void> deleteMyNotification(@PathVariable Long id) {
        notificationService.deleteCurrentUserNotification(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/notifications/config")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<NotificationConfigResponse>> getNotificationConfig() {
        return ResponseEntity.ok(ApiResponse.success("Get notification config successfully", policyService.getConfig()));
    }

    @PutMapping("/notifications/config")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<NotificationConfigResponse>> updateNotificationConfig(
            @Valid @RequestBody NotificationConfigRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Update notification config successfully",
                policyService.updateConfig(request)));
    }

    @PutMapping("/notifications/config/defaults")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<NotificationConfigResponse>> resetNotificationConfig() {
        return ResponseEntity.ok(ApiResponse.success(
                "Restore notification defaults successfully",
                policyService.resetDefaults()));
    }

    @GetMapping("/email/templates")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<PageResponse<EmailTemplateResponse>>> getEmailTemplates(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) NotificationCategory category,
            @RequestParam(required = false) NotificationEventType eventType,
            @RequestParam(required = false) Boolean active,
            @PageableDefault(size = 20) Pageable pageable
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Get email templates successfully",
                PageResponse.from(emailTemplateService.list(q, category, eventType, active, pageable))));
    }

    @GetMapping("/email/templates/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<EmailTemplateResponse>> getEmailTemplate(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success("Get email template successfully", emailTemplateService.get(id)));
    }

    @PostMapping("/email/templates")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<EmailTemplateResponse>> createEmailTemplate(
            @Valid @RequestBody EmailTemplateRequest request
    ) {
        EmailTemplateResponse created = emailTemplateService.create(request);
        URI location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(created.id())
                .toUri();
        return ResponseEntity.created(location)
                .body(ApiResponse.success("Create email template successfully", created));
    }

    @PutMapping("/email/templates/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<EmailTemplateResponse>> updateEmailTemplate(
            @PathVariable Long id,
            @Valid @RequestBody EmailTemplateRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Update email template successfully",
                emailTemplateService.update(id, request)));
    }

    @DeleteMapping("/email/templates/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> deleteEmailTemplate(@PathVariable Long id) {
        emailTemplateService.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/email/template-previews")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<EmailTemplatePreviewResponse>> previewEmailTemplate(
            @Valid @RequestBody EmailTemplatePreviewRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Preview email template successfully",
                emailTemplateService.preview(request)));
    }
}
