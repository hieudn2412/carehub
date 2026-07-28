package vn.vietduc.carehubbackend.questiongeneration.service;

import org.junit.jupiter.api.Test;
import vn.vietduc.carehubbackend.exception.BadRequestException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ExamDifficultyAllocatorTest {

    @Test
    void defaultPercentagesAllocateThirtyFiftyTwenty() {
        var percentages = ExamDifficultyAllocator.percentages(null, null, null);

        assertThat(ExamDifficultyAllocator.allocate(20, percentages))
                .isEqualTo(new ExamDifficultyAllocator.Counts(6, 10, 4));
    }

    @Test
    void largestRemainderPrefersMediumThenEasyOnTies() {
        var percentages = ExamDifficultyAllocator.percentages(30, 50, 20);

        assertThat(ExamDifficultyAllocator.allocate(5, percentages))
                .isEqualTo(new ExamDifficultyAllocator.Counts(1, 3, 1));
        assertThat(ExamDifficultyAllocator.allocate(7, percentages))
                .isEqualTo(new ExamDifficultyAllocator.Counts(2, 4, 1));
    }

    @Test
    void percentagesMustTotalOneHundred() {
        assertThatThrownBy(() -> ExamDifficultyAllocator.percentages(30, 40, 20))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("bằng 100");
    }

    @Test
    void missingLegacyDifficultyIsTreatedAsMedium() {
        assertThat(ExamDifficultyAllocator.normalizeDifficulty(null)).isEqualTo("MEDIUM");
        assertThat(ExamDifficultyAllocator.normalizeDifficulty("unknown")).isEqualTo("MEDIUM");
        assertThat(ExamDifficultyAllocator.normalizeDifficulty("Dễ")).isEqualTo("EASY");
        assertThat(ExamDifficultyAllocator.normalizeDifficulty("Khó")).isEqualTo("HARD");
    }
}
