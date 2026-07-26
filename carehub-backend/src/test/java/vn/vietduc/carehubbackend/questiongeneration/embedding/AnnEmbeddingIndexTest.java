package vn.vietduc.carehubbackend.questiongeneration.embedding;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import vn.vietduc.carehubbackend.questiongeneration.config.AiEmbeddingProperties;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

class AnnEmbeddingIndexTest {

    private static final double STRONG_MIN = 0.93;

    private final AiEmbeddingProperties properties = new AiEmbeddingProperties();
    private AnnEmbeddingIndex index;

    @BeforeEach
    void setUp() {
        properties.setProvider("e5");
        properties.setAnnEnabled(true);
        index = new AnnEmbeddingIndex(properties);
    }

    @Test
    void returnsTheBestMatchNotTheFirstOneAboveTheReviewThreshold() {
        double[] query = normalize(new double[]{1, 0, 0, 0});
        // Câu 1 giống vừa phải (~0.85) được nạp TRƯỚC câu 2 gần như trùng khớp (~0.997).
        // Nếu dừng sớm ở ngưỡng review (0.80) thì sẽ trả về câu 1 và câu trùng mạnh
        // bị hạ cấp thành "cần xem lại" thay vì bị loại.
        QuestionEmbeddingSnapshot moderate = snapshot(1L, "gần giống", normalize(new double[]{1, 0.62, 0, 0}));
        QuestionEmbeddingSnapshot nearDuplicate = snapshot(2L, "gần như trùng", normalize(new double[]{1, 0.08, 0, 0}));

        index.rebuild(List.of(moderate, nearDuplicate), 1L);

        AnnEmbeddingIndex.SearchResult result = index.searchBestMatch(query, STRONG_MIN, 50);

        assertThat(result).isNotNull();
        assertThat(result.questionId()).isEqualTo(2L);
        assertThat(result.similarity()).isGreaterThanOrEqualTo(STRONG_MIN);
    }

    @Test
    void stopsEarlyOnceAStrongDuplicateIsFound() {
        double[] query = normalize(new double[]{1, 0, 0, 0});
        QuestionEmbeddingSnapshot exact = snapshot(1L, "trùng khít", normalize(new double[]{1, 0, 0, 0}));

        index.rebuild(List.of(exact), 1L);

        AnnEmbeddingIndex.SearchResult result = index.searchBestMatch(query, STRONG_MIN, 50);

        assertThat(result).isNotNull();
        assertThat(result.similarity()).isCloseTo(1.0, within(1e-9));
    }

    @Test
    void doesNotRebuildWhenDataVersionIsUnchanged() {
        QuestionEmbeddingSnapshot first = snapshot(1L, "câu một", normalize(new double[]{1, 0, 0, 0}));
        index.rebuild(List.of(first), 7L);

        // Cùng version → coi như dữ liệu chưa đổi, bỏ qua việc build lại.
        index.rebuild(List.of(first, snapshot(2L, "câu hai", normalize(new double[]{0, 1, 0, 0}))), 7L);

        assertThat(index.size()).isEqualTo(1);
    }

    @Test
    void rebuildsWhenDataVersionChangesEvenIfTheSizeStaysTheSame() {
        double[] query = normalize(new double[]{0, 1, 0, 0});
        index.rebuild(List.of(snapshot(1L, "nội dung cũ", normalize(new double[]{1, 0, 0, 0}))), 1L);

        // Sửa nội dung một câu hỏi: vector đổi hẳn nhưng số lượng vẫn là 1.
        index.rebuild(List.of(snapshot(1L, "nội dung mới", normalize(new double[]{0, 1, 0, 0}))), 2L);

        AnnEmbeddingIndex.SearchResult result = index.searchBestMatch(query, STRONG_MIN, 50);
        assertThat(result).isNotNull();
        assertThat(result.stem()).isEqualTo("nội dung mới");
        assertThat(result.similarity()).isCloseTo(1.0, within(1e-9));
    }

    private static QuestionEmbeddingSnapshot snapshot(Long id, String stem, double[] vector) {
        return new QuestionEmbeddingSnapshot(id, stem, vector);
    }

    private static double[] normalize(double[] vector) {
        double norm = 0;
        for (double value : vector) {
            norm += value * value;
        }
        norm = Math.sqrt(norm);
        double[] result = new double[vector.length];
        for (int i = 0; i < vector.length; i++) {
            result[i] = vector[i] / norm;
        }
        return result;
    }
}
