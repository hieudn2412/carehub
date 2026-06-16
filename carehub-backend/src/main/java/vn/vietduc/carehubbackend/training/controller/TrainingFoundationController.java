package vn.vietduc.carehubbackend.training.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vn.vietduc.carehubbackend.common.response.ApiResponse;
import vn.vietduc.carehubbackend.training.dto.response.TrainingFoundationResponse;

import java.util.List;

@RestController
@RequestMapping("${app.api-prefix}/training")
public class TrainingFoundationController {
    @GetMapping("/foundation")
    public ResponseEntity<ApiResponse<TrainingFoundationResponse>> getFoundation() {
        TrainingFoundationResponse response = new TrainingFoundationResponse(
                "Training Records Management",
                "phase_01_database_domain_security",
                List.of(
                        "database_migrations",
                        "domain_entities",
                        "repositories",
                        "dto_mappers",
                        "access_policy",
                        "record_state_machine",
                        "compliance_calculator",
                        "evidence_storage_interface",
                        "local_evidence_moderation",
                        "audit_service",
                        "global_error_response",
                        "pagination_response"
                ),
                List.of(
                        "duration_conversion_rules",
                        "credit_conversion_rules",
                        "long_course_split_policy",
                        "edit_count_policy",
                        "approved_record_reopen_policy",
                        "at_risk_formula",
                        "legacy_google_drive_migration_policy"
                )
        );
        return ResponseEntity.ok(ApiResponse.success("Training foundation is ready", response));
    }
}
