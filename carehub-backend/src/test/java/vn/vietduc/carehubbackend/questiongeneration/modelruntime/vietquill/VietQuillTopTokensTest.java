package vn.vietduc.carehubbackend.questiongeneration.modelruntime.vietquill;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import vn.vietduc.carehubbackend.questiongeneration.config.AiParaphraseProperties;

import java.util.Comparator;
import java.util.List;
import java.util.Random;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

/**
 * {@code topTokens} chạy cho mỗi beam ở mỗi bước decode nên đã được viết lại để dùng
 * min-heap trên mảng nguyên thuỷ. Test này chốt lại rằng kết quả vẫn khớp với cách
 * làm ngây thơ (sắp xếp toàn bộ từ vựng rồi lấy k phần tử đầu).
 */
class VietQuillTopTokensTest {

    private final AiParaphraseProperties properties = new AiParaphraseProperties();
    private final VietQuillParaphraseModelService service = new VietQuillParaphraseModelService(
            properties,
            new ObjectMapper(),
            new VietQuillPromptBuilder(),
            new VietQuillHandlePool(properties)
    );

    @Test
    void returnsTheSameTopKAsASortOverTheWholeVocabulary() {
        double[] logits = randomLogits(4096, 20260726L);
        int k = 6;

        List<VietQuillParaphraseModelService.TopToken> actual = service.topTokens(logits, k);

        List<Integer> expectedIds = IntStream.range(0, logits.length)
                .boxed()
                .sorted(Comparator.comparingDouble((Integer i) -> logits[i]).reversed())
                .limit(k)
                .toList();

        assertThat(actual).hasSize(k);
        assertThat(actual.stream().map(token -> (int) token.id()).toList())
                .containsExactlyElementsOf(expectedIds);
    }

    @Test
    void returnsTokensSortedByDescendingLogProbability() {
        double[] logits = randomLogits(512, 7L);

        List<VietQuillParaphraseModelService.TopToken> actual = service.topTokens(logits, 5);

        assertThat(actual).isSortedAccordingTo(
                Comparator.comparingDouble(VietQuillParaphraseModelService.TopToken::logProbability).reversed());
    }

    @Test
    void logProbabilitiesAreNormalisedSoTheyExponentiateToAtMostOne() {
        // logits đều nhau trên 4 token → mỗi token có xác suất 0.25 → log(0.25).
        double[] logits = {2.0, 2.0, 2.0, 2.0};

        List<VietQuillParaphraseModelService.TopToken> actual = service.topTokens(logits, 4);

        assertThat(actual).allSatisfy(token ->
                assertThat(Math.exp(token.logProbability())).isCloseTo(0.25, within(1e-9)));
    }

    @Test
    void clampsRequestedCountToTheVocabularySize() {
        double[] logits = {0.5, 1.5, -0.5};

        assertThat(service.topTokens(logits, 99)).hasSize(3);
        assertThat(service.topTokens(logits, 0)).hasSize(1);
    }

    private static double[] randomLogits(int size, long seed) {
        Random random = new Random(seed);
        double[] logits = new double[size];
        for (int i = 0; i < size; i++) {
            logits[i] = random.nextGaussian() * 4;
        }
        return logits;
    }
}
