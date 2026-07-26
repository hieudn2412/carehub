package vn.vietduc.carehubbackend.systemsettings.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vn.vietduc.carehubbackend.common.response.ApiResponse;
import vn.vietduc.carehubbackend.systemsettings.dto.SystemSettingsRequest;
import vn.vietduc.carehubbackend.systemsettings.dto.SystemSettingsResponse;
import vn.vietduc.carehubbackend.systemsettings.service.SystemSettingsService;

@RestController
@RequestMapping("${app.api-prefix}/admin/system-settings")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class SystemSettingsController {
    private final SystemSettingsService service;

    @GetMapping
    public ResponseEntity<ApiResponse<SystemSettingsResponse>> get() {
        return ResponseEntity.ok(ApiResponse.success("Get system settings successfully", service.get()));
    }

    @PutMapping
    public ResponseEntity<ApiResponse<SystemSettingsResponse>> update(
            @Valid @RequestBody SystemSettingsRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success("Update system settings successfully", service.update(request)));
    }
}
