package vn.vietduc.carehubbackend.questiongeneration.embedding;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.stereotype.Component;
import vn.vietduc.carehubbackend.questiongeneration.config.AiEmbeddingProperties;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionBankStatus;
import vn.vietduc.carehubbackend.questiongeneration.repository.QuestionBankQuestionRepository;

@Slf4j
@Component
@RequiredArgsConstructor
public class QuestionEmbeddingStartupBackfill {
    private final AiEmbeddingProperties properties;
    private final QuestionEmbeddingService embeddingService;
    private final EmbeddingCache embeddingCache;
    private final ThreadPoolTaskExecutor backfillExecutor;
    private final QuestionBankQuestionRepository questionRepository;

    @EventListener(ApplicationReadyEvent.class)
    public void backfillAfterStartup(ApplicationReadyEvent event) {
        if (!properties.isE5Provider()) {
            return;
        }
        if (!properties.isBackfillOnStartup()) {
            warnIfEmbeddingsMissing();
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

    /**
     * Bảng embedding rỗng trong khi provider = e5 là trạng thái IM LẶNG nguy hiểm: mọi lần so trùng
     * rơi về {@code lexical-fallback} (Jaccard, ngưỡng khác hẳn), tức chống trùng ngữ nghĩa không hề
     * chạy — nhưng hệ thống vẫn trả về kết quả bình thường nên không ai nhận ra.
     */
    private void warnIfEmbeddingsMissing() {
        try {
            long approvedQuestions = questionRepository.countByStatus(QuestionBankStatus.APPROVED);
            if (approvedQuestions == 0) {
                return;
            }
            long embeddings = embeddingService.countApprovedStemEmbeddings();
            if (embeddings == 0) {
                log.warn("E5 bật nhưng chưa có embedding nào cho {} câu hỏi đã duyệt — mọi lần so trùng"
                                + " sẽ rơi về lexical-fallback. Chạy POST /api/v1/question-embeddings/backfill"
                                + " hoặc đặt E5_BACKFILL_ON_STARTUP=true.",
                        approvedQuestions);
            } else if (embeddings < approvedQuestions) {
                log.warn("E5 mới có embedding cho {}/{} câu hỏi đã duyệt — số câu còn lại không tham gia"
                                + " so trùng. Chạy POST /api/v1/question-embeddings/backfill.",
                        embeddings, approvedQuestions);
            }
        } catch (RuntimeException ex) {
            log.warn("Không kiểm tra được tình trạng embedding lúc khởi động: {}", ex.getMessage());
        }
    }
}
