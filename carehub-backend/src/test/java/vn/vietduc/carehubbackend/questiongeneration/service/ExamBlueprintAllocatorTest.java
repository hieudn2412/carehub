package vn.vietduc.carehubbackend.questiongeneration.service;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.Arrays;

import static org.assertj.core.api.Assertions.assertThat;

class ExamBlueprintAllocatorTest {
    @Test
    void preservesTotalsAtBoundarySizes() {
        for (int total : List.of(1, 2, 3, 7, 10, 20, 101)) {
            List<Integer> counts = ExamBlueprintAllocator.allocate(
                    List.of(new BigDecimal("33.33"), new BigDecimal("33.33"), new BigDecimal("33.34")),
                    Arrays.asList(null, null, null), total);
            assertThat(counts).hasSize(3);
            assertThat(counts.stream().mapToInt(Integer::intValue).sum()).isEqualTo(total);
        }
    }

    @Test
    void givesRemainderToStableDisplayOrderOnTie() {
        assertThat(ExamBlueprintAllocator.allocate(
                List.of(new BigDecimal("50"), new BigDecimal("50")), Arrays.asList(null, null), 3))
                .containsExactly(2, 1);
    }

    @Test
    void acceptsExplicitCountsWithoutChangingThem() {
        assertThat(ExamBlueprintAllocator.allocate(
                Arrays.asList(null, null), List.of(2, 5), 7))
                .containsExactly(2, 5);
    }
}
