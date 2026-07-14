package vn.vietduc.carehubbackend.questiongeneration.embedding;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.stereotype.Component;
import vn.vietduc.carehubbackend.questiongeneration.config.AiEmbeddingProperties;

@Slf4j
@Component
@RequiredArgsConstructor
public class QuestionEmbeddingStartupBackfill {
    private final AiEmbeddingProperties properties;
    private final QuestionEmbeddingService embeddingService;
    private final EmbeddingCache embeddingCache;
    private final ThreadPoolTaskExecutor backfillExecutor;

    @EventListener(ApplicationReadyEvent.class)
    public void backfillAfterStartup(ApplicationReadyEvent event) {
        if (!properties.isE5Provider() || !properties.isBackfillOnStartup()) {
            return;
        }
        if (properties.isBackfillAsync()) {
            backfillExecutor.execute(() -> {
                try {
                    QuestionEmbeddingService.BackfillResult result = embeddingService.backfillApprovedQuestionEmbeddings();
                    log.info("Async E5 backfill completed: created={}, skipped={}, failed={}",
                            result.created(), result.skipped(), result.failed());
                    embeddingCache.invalidate();
                } catch (RuntimeException ex) {
                    log.warn("Async E5 backfill failed: {}", ex.getMessage());
                }
            });
        } else {
            try {
                QuestionEmbeddingService.BackfillResult result = embeddingService.backfillApprovedQuestionEmbeddings();
                log.info("Sync E5 backfill completed: created={}, skipped={}, failed={}",
                        result.created(), result.skipped(), result.failed());
            } catch (RuntimeException ex) {
                log.warn("Sync E5 backfill failed: {}", ex.getMessage());
            }
        }
    }
}
