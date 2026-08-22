package vn.vietduc.carehubbackend.questiongeneration.embedding;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import vn.vietduc.carehubbackend.questiongeneration.config.AiEmbeddingProperties;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Trọng tâm: {@code appendAfterCommit} phải THÊM vào cache thay vì xoá sạch. Xoá sạch sau mỗi lần
 * ghi biến một lượt import N dòng thành O(N²) lượt đọc DB.
 */
class EmbeddingCacheTest {
    private final QuestionEmbeddingService embeddingService = mock(QuestionEmbeddingService.class);
    private final AnnEmbeddingIndex annIndex = mock(AnnEmbeddingIndex.class);
    private final AiEmbeddingProperties properties = new AiEmbeddingProperties();

    @AfterEach
    void clearTransactionState() {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    private EmbeddingCache newCache() {
        properties.setProvider("e5");
        EmbeddingCache cache = new EmbeddingCache(embeddingService, properties, annIndex);
        cache.init();
        return cache;
    }

    private QuestionEmbeddingSnapshot snapshot(long id) {
        return new QuestionEmbeddingSnapshot(id, "Câu hỏi " + id, new double[]{1.0, 0.0});
    }

    @Test
    @DisplayName("append (ngoài transaction) nối vào danh sách đang cache, không nạp lại từ DB")
    void appendAddsToTheCachedListWithoutReloading() {
        when(embeddingService.loadAllApprovedStemEmbeddings()).thenReturn(List.of(snapshot(1L)));
        EmbeddingCache cache = newCache();
        assertThat(cache.approvedStemEmbeddings()).hasSize(1);

        cache.appendAfterCommit(snapshot(2L));

        assertThat(cache.approvedStemEmbeddings())
                .extracting(QuestionEmbeddingSnapshot::questionId)
                .containsExactly(1L, 2L);
        // Một lần nạp duy nhất: append KHÔNG được kéo lại cả bảng.
        verify(embeddingService, times(1)).loadAllApprovedStemEmbeddings();
    }

    @Test
    @DisplayName("trong transaction: chỉ nối vào cache sau khi commit")
    void appendIsDeferredUntilCommit() {
        when(embeddingService.loadAllApprovedStemEmbeddings()).thenReturn(List.of(snapshot(1L)));
        EmbeddingCache cache = newCache();
        cache.approvedStemEmbeddings();
        TransactionSynchronizationManager.initSynchronization();

        cache.appendAfterCommit(snapshot(2L));
        assertThat(cache.cachedCount()).isEqualTo(1);

        TransactionSynchronizationManager.getSynchronizations().forEach(sync -> {
            sync.afterCommit();
            sync.afterCompletion(0); // STATUS_COMMITTED
        });

        assertThat(cache.cachedCount()).isEqualTo(2);
    }

    @Test
    @DisplayName("rollback: cache bị xoá thay vì giữ lại một câu hỏi không tồn tại")
    void rollbackInvalidatesInsteadOfKeepingAPhantom() {
        when(embeddingService.loadAllApprovedStemEmbeddings()).thenReturn(List.of(snapshot(1L)));
        EmbeddingCache cache = newCache();
        cache.approvedStemEmbeddings();
        TransactionSynchronizationManager.initSynchronization();

        cache.appendAfterCommit(snapshot(2L));
        TransactionSynchronizationManager.getSynchronizations()
                .forEach(sync -> sync.afterCompletion(1)); // STATUS_ROLLED_BACK

        assertThat(cache.cachedCount()).isZero();
    }

    @Test
    @DisplayName("danh sách cache là bất biến — nơi gọi đang lặp trên bản cũ không bị sửa dưới chân")
    void cachedListIsImmutable() {
        when(embeddingService.loadAllApprovedStemEmbeddings()).thenReturn(List.of(snapshot(1L)));
        EmbeddingCache cache = newCache();
        List<QuestionEmbeddingSnapshot> before = cache.approvedStemEmbeddings();

        cache.appendAfterCommit(snapshot(2L));

        assertThat(before).hasSize(1);
    }
}
