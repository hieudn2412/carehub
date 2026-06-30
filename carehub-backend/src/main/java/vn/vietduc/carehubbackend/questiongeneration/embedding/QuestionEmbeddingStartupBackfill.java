package vn.vietduc.carehubbackend.questiongeneration.embedding;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import vn.vietduc.carehubbackend.questiongeneration.config.AiEmbeddingProperties;

@Slf4j
@Component
@RequiredArgsConstructor
public class QuestionEmbeddingStartupBackfill {
    private final AiEmbeddingProperties properties;
    private final QuestionEmbeddingService embeddingService;

    @EventListener(ApplicationReadyEvent.class)
    public void backfillAfterStartup(ApplicationReadyEvent event) {
        if (!properties.isE5Provider() || !properties.isBackfillOnStartup()) {
            return;
        }
        try {
            QuestionEmbeddingService.BackfillResult result = embeddingService.backfillApprovedQuestionEmbeddings();
            log.info(
                    "Question bank E5 embedding backfill completed: created={}, skipped={}, failed={}",
                    result.created(),
                    result.skipped(),
                    result.failed()
            );
        } catch (RuntimeException ex) {
            log.warn("Không backfill được E5 embedding cho ngân hàng câu hỏi: {}", ex.getMessage());
        }
    }
}
