package vn.vietduc.carehubbackend.questiongeneration.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import vn.vietduc.carehubbackend.questiongeneration.entity.DocumentQuestionJob;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.CognitiveLevel;

import java.util.EnumMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Tỷ lệ ba mức nhận thức do backend phân bổ theo từng chunk, không phó mặc cho model:
 * prompt gửi theo từng chunk và mỗi chunk chỉ sinh 1–3 câu nên model không có cách nào
 * tự giữ tỷ lệ trên toàn phiên.
 */
class CognitiveMixAllocationTest {

    private static DocumentQuestionJob job(int foundation, int application, int reasoning) {
        DocumentQuestionJob job = new DocumentQuestionJob();
        job.setCognitiveMixFoundation(foundation);
        job.setCognitiveMixApplication(application);
        job.setCognitiveMixReasoning(reasoning);
        return job;
    }

    private static Map<CognitiveLevel, Integer> allocate(DocumentQuestionJob job, int chunkCount) {
        Map<CognitiveLevel, Integer> counts = new EnumMap<>(CognitiveLevel.class);
        for (CognitiveLevel level : CognitiveLevel.values()) {
            counts.put(level, 0);
        }
        for (int i = 0; i < chunkCount; i++) {
            CognitiveLevel level = DocumentQuestionJobService.levelForChunk(job, i);
            counts.merge(level, 1, Integer::sum);
        }
        return counts;
    }

    @Test
    @DisplayName("Tỷ lệ 20/50/30 trên 100 chunk ra đúng 20/50/30")
    void balancedMixMatchesExactlyOverAHundredChunks() {
        Map<CognitiveLevel, Integer> counts = allocate(job(20, 50, 30), 100);

        assertThat(counts.get(CognitiveLevel.FOUNDATION)).isEqualTo(20);
        assertThat(counts.get(CognitiveLevel.CLINICAL_APPLICATION)).isEqualTo(50);
        assertThat(counts.get(CognitiveLevel.CLINICAL_REASONING_ANALYSIS)).isEqualTo(30);
    }

    @Test
    @DisplayName("Phiên ít chunk vẫn bám sát tỷ lệ, không dồn hết vào một mức")
    void shortJobsStillTrackTheRatio() {
        // Đúng cấu hình job 30 của người dùng: 0/20/80 trên 32 chunk.
        Map<CognitiveLevel, Integer> counts = allocate(job(0, 20, 80), 32);

        assertThat(counts.get(CognitiveLevel.FOUNDATION)).isZero();
        // 20% của 32 là 6,4 -> làm tròn xuống 6; phần còn lại là mức khó.
        assertThat(counts.get(CognitiveLevel.CLINICAL_APPLICATION)).isEqualTo(6);
        assertThat(counts.get(CognitiveLevel.CLINICAL_REASONING_ANALYSIS)).isEqualTo(26);
    }

    @Test
    @DisplayName("Đặt 100% một mức thì mọi chunk đều ra đúng mức đó")
    void singleLevelMixIsHonouredEverywhere() {
        assertThat(allocate(job(100, 0, 0), 17))
                .containsEntry(CognitiveLevel.FOUNDATION, 17);
        assertThat(allocate(job(0, 0, 100), 17))
                .containsEntry(CognitiveLevel.CLINICAL_REASONING_ANALYSIS, 17);
    }

    @Test
    @DisplayName("Chunk đầu tiên không mặc định rơi vào mức dễ khi tỷ lệ dễ bằng 0")
    void firstChunkRespectsAZeroFoundationShare() {
        assertThat(DocumentQuestionJobService.levelForChunk(job(0, 20, 80), 0))
                .isNotEqualTo(CognitiveLevel.FOUNDATION);
    }
}
