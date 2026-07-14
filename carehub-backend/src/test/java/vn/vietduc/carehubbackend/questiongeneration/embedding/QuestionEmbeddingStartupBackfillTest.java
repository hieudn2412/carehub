package vn.vietduc.carehubbackend.questiongeneration.embedding;

import org.junit.jupiter.api.Test;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import vn.vietduc.carehubbackend.questiongeneration.config.AiEmbeddingProperties;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class QuestionEmbeddingStartupBackfillTest {

    private final EmbeddingCache embeddingCache = mock(EmbeddingCache.class);
    private final ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();

    @Test
    void backfillsWhenE5ProviderAndStartupBackfillEnabled() {
        AiEmbeddingProperties properties = new AiEmbeddingProperties();
        properties.setProvider("e5");
        properties.setBackfillOnStartup(true);
        properties.setBackfillAsync(false); // Sync để test dễ
        QuestionEmbeddingService embeddingService = mock(QuestionEmbeddingService.class);
        when(embeddingService.backfillApprovedQuestionEmbeddings())
                .thenReturn(new QuestionEmbeddingService.BackfillResult(2, 3, 0));

        new QuestionEmbeddingStartupBackfill(properties, embeddingService, embeddingCache, executor)
                .backfillAfterStartup(null);

        verify(embeddingService).backfillApprovedQuestionEmbeddings();
    }

    @Test
    void skipsWhenProviderIsLexical() {
        AiEmbeddingProperties properties = new AiEmbeddingProperties();
        properties.setProvider("lexical");
        QuestionEmbeddingService embeddingService = mock(QuestionEmbeddingService.class);

        new QuestionEmbeddingStartupBackfill(properties, embeddingService, embeddingCache, executor)
                .backfillAfterStartup(null);

        verify(embeddingService, never()).backfillApprovedQuestionEmbeddings();
    }

    @Test
    void skipsWhenStartupBackfillDisabled() {
        AiEmbeddingProperties properties = new AiEmbeddingProperties();
        properties.setProvider("e5");
        properties.setBackfillOnStartup(false);
        QuestionEmbeddingService embeddingService = mock(QuestionEmbeddingService.class);

        new QuestionEmbeddingStartupBackfill(properties, embeddingService, embeddingCache, executor)
                .backfillAfterStartup(null);

        verify(embeddingService, never()).backfillApprovedQuestionEmbeddings();
    }
}
