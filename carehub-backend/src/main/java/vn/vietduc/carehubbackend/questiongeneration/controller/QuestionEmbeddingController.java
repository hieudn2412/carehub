package vn.vietduc.carehubbackend.questiongeneration.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vn.vietduc.carehubbackend.common.response.ApiResponse;
import vn.vietduc.carehubbackend.questiongeneration.embedding.QuestionEmbeddingService;

@RestController
@RequestMapping("${app.api-prefix}/question-embeddings")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class QuestionEmbeddingController {
    private final QuestionEmbeddingService embeddingService;

    @PostMapping("/backfill")
    public ResponseEntity<ApiResponse<QuestionEmbeddingService.BackfillResult>> backfill() {
        return ResponseEntity.ok(ApiResponse.success(
                "Backfill embedding câu hỏi hoàn tất",
                embeddingService.backfillApprovedQuestionEmbeddings()
        ));
    }
}
