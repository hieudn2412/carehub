package vn.vietduc.carehubbackend.notification.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vn.vietduc.carehubbackend.common.response.ApiResponse;
import vn.vietduc.carehubbackend.notification.dto.EmailTemplateRequest;
import vn.vietduc.carehubbackend.notification.dto.EmailTemplateResponse;
import vn.vietduc.carehubbackend.notification.dto.NotificationActionRequest;
import vn.vietduc.carehubbackend.notification.dto.NotificationConfigRequest;
import vn.vietduc.carehubbackend.notification.dto.NotificationConfigResponse;
import vn.vietduc.carehubbackend.notification.dto.NotificationResponse;
import vn.vietduc.carehubbackend.notification.service.NotificationService;

@RestController
@RequestMapping("${app.api-prefix}")
@RequiredArgsConstructor
public class NotificationController {
    private final NotificationService notificationService;

    @GetMapping("/me/notifications")
    public ResponseEntity<ApiResponse<Page<NotificationResponse>>> getMyNotifications(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) Boolean read,
            @PageableDefault(size = 20) Pageable pageable
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Get notifications successfully",
                notificationService.getCurrentUserNotifications(q, read, pageable)));
    }

    @GetMapping("/me/notifications/{id}")
    public ResponseEntity<ApiResponse<NotificationResponse>> getMyNotification(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(
                "Get notification successfully",
                notificationService.getCurrentUserNotification(id)));
    }

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
    public ResponseEntity<ApiResponse<Void>> deleteMyNotification(@PathVariable Long id) {
        notificationService.deleteCurrentUserNotification(id);
        return ResponseEntity.ok(ApiResponse.success("Notification deleted successfully", null));
    }

    @GetMapping("/notifications/config")
    @PreAuthorize("hasAnyRole('MANAGER', 'ADMIN')")
    public ResponseEntity<ApiResponse<NotificationConfigResponse>> getNotificationConfig() {
        return ResponseEntity.ok(ApiResponse.success(
                "Get notification config successfully",
                notificationService.getConfig()));
    }

    @PutMapping("/notifications/config")
    @PreAuthorize("hasAnyRole('MANAGER', 'ADMIN')")
    public ResponseEntity<ApiResponse<NotificationConfigResponse>> updateNotificationConfig(
            @Valid @RequestBody NotificationConfigRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Update notification config successfully",
                notificationService.updateConfig(request)));
    }

    @GetMapping("/email/templates")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Page<EmailTemplateResponse>>> getEmailTemplates(
            @RequestParam(required = false) String q,
            @PageableDefault(size = 20) Pageable pageable
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Get email templates successfully",
                notificationService.getEmailTemplates(q, pageable)));
    }

    @GetMapping("/email/templates/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<EmailTemplateResponse>> getEmailTemplate(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(
                "Get email template successfully",
                notificationService.getEmailTemplate(id)));
    }

    @PostMapping("/email/templates")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<EmailTemplateResponse>> createEmailTemplate(
            @Valid @RequestBody EmailTemplateRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Create email template successfully",
                notificationService.createEmailTemplate(request)));
    }

    @PutMapping("/email/templates/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<EmailTemplateResponse>> updateEmailTemplate(
            @PathVariable Long id,
            @Valid @RequestBody EmailTemplateRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Update email template successfully",
                notificationService.updateEmailTemplate(id, request)));
    }

    @DeleteMapping("/email/templates/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Void>> deleteEmailTemplate(@PathVariable Long id) {
        notificationService.deleteEmailTemplate(id);
        return ResponseEntity.ok(ApiResponse.success("Email template deleted successfully", null));
    }
}
