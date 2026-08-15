package vn.vietduc.carehubbackend.questiongeneration.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vn.vietduc.carehubbackend.common.response.ApiResponse;
import vn.vietduc.carehubbackend.questiongeneration.service.EvaluationCutoverService;

import java.util.Map;

/** Read-only operational endpoint used by the rollout checklist and admin UI. */
@RestController
@RequestMapping("${app.api-prefix}/evaluation/cutover")
@RequiredArgsConstructor
@PreAuthorize("@evaluationSecurity.canAccess(authentication)")
public class EvaluationCutoverController {
    private final EvaluationCutoverService service;

    @GetMapping("/status")
    public ResponseEntity<ApiResponse<Map<String, Boolean>>> status() {
        return ResponseEntity.ok(ApiResponse.success("Lấy trạng thái cutover đánh giá thành công", service.status()));
    }
}
