package vn.vietduc.carehubbackend.questiongeneration.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vn.vietduc.carehubbackend.common.response.ApiResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.ExamAttemptResponse;
import vn.vietduc.carehubbackend.questiongeneration.service.ExamAttemptService;

import java.util.List;

@RestController
@RequestMapping("${app.api-prefix}/exam-attempts")
@RequiredArgsConstructor
@PreAuthorize("@evaluationSecurity.canViewResults(authentication)")
public class ExamAttemptController {
    private final ExamAttemptService attemptService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<ExamAttemptResponse>>> list(
            @RequestParam(required = false) Long assignmentId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Long professionalFieldId
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Lấy danh sách lượt làm bài thành công",
                attemptService.listAdmin(assignmentId, status, professionalFieldId)
        ));
    }

    @GetMapping("/{attemptId}")
    public ResponseEntity<ApiResponse<ExamAttemptResponse>> get(@PathVariable Long attemptId) {
        return ResponseEntity.ok(ApiResponse.success(
                "Lấy chi tiết lượt làm bài thành công",
                attemptService.getAdmin(attemptId)
        ));
    }
}
