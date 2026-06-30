package vn.vietduc.carehubbackend.questiongeneration.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vn.vietduc.carehubbackend.common.response.ApiResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.AiModelRuntimeStatusResponse;
import vn.vietduc.carehubbackend.questiongeneration.service.AiModelRuntimeStatusService;

@RestController
@RequestMapping("${app.api-prefix}/ai-model-runtime")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AiModelRuntimeController {
    private final AiModelRuntimeStatusService statusService;

    @GetMapping("/status")
    public ResponseEntity<ApiResponse<AiModelRuntimeStatusResponse>> status() {
        return ResponseEntity.ok(ApiResponse.success(
                "Lấy trạng thái model AI thành công",
                statusService.status()
        ));
    }
}
