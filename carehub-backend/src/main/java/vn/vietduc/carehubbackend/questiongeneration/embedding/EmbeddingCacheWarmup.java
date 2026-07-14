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
public class EmbeddingCacheWarmup {
    private final EmbeddingCache cache;
    private final AiEmbeddingProperties properties;

    @EventListener(ApplicationReadyEvent.class)
    public void warmupAfterStartup() {
        if (!properties.isE5Provider() || !properties.isCacheWarmupEnabled()) {
            return;
        }
        try {
            int count = cache.approvedStemEmbeddings().size();
            log.info("Embedding cache warmed up with {} embeddings", count);
        } catch (RuntimeException ex) {
            log.warn("Không warmup được embedding cache: {}", ex.getMessage());
        }
    }
}
