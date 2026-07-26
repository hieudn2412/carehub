package vn.vietduc.carehubbackend.questiongeneration.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vn.vietduc.carehubbackend.common.response.ApiResponse;
import vn.vietduc.carehubbackend.questiongeneration.embedding.QuestionEmbeddingService;

@RestController
@RequestMapping("${app.api-prefix}/question-embeddings")
@RequiredArgsConstructor
@PreAuthorize("@evaluationSecurity.hasAny(authentication, 'QUESTION_AUTHOR', 'QUESTION_REVIEWER')")
public class QuestionEmbeddingController {
    private final QuestionEmbeddingService embeddingService;

    /**
     * @param dropLegacy xoá các embedding sinh bằng cách nhúng cũ (bất đối xứng) trước khi
     *                   backfill. Mặc định tắt để có thể rollback code mà không mất dữ liệu.
     */
    @PostMapping("/backfill")
    public ResponseEntity<ApiResponse<QuestionEmbeddingService.BackfillResult>> backfill(
            @RequestParam(name = "dropLegacy", defaultValue = "false") boolean dropLegacy
    ) {
        if (dropLegacy) {
            embeddingService.deleteLegacyStemEmbeddings();
        }
        return ResponseEntity.ok(ApiResponse.success(
                "Backfill embedding câu hỏi hoàn tất",
                embeddingService.backfillApprovedQuestionEmbeddings()
        ));
    }
}
