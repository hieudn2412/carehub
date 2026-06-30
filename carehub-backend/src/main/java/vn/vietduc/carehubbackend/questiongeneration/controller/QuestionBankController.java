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
import vn.vietduc.carehubbackend.questiongeneration.dto.response.QuestionBankQuestionResponse;
import vn.vietduc.carehubbackend.questiongeneration.service.QuestionBankService;

import java.util.List;

@RestController
@RequestMapping("${app.api-prefix}/questions")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class QuestionBankController {
    private final QuestionBankService questionBankService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<QuestionBankQuestionResponse>>> list(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String status
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Lấy danh sách câu hỏi thành công",
                questionBankService.list(q, status)
        ));
    }

    @GetMapping("/{questionId}")
    public ResponseEntity<ApiResponse<QuestionBankQuestionResponse>> get(@PathVariable Long questionId) {
        return ResponseEntity.ok(ApiResponse.success(
                "Lấy chi tiết câu hỏi thành công",
                questionBankService.get(questionId)
        ));
    }
}
