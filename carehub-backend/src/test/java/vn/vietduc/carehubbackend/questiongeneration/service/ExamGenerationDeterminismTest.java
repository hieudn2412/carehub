package vn.vietduc.carehubbackend.questiongeneration.service;

import org.junit.jupiter.api.Test;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamConfigSourceFilter;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionBankQuestion;

import java.time.LocalDateTime;
import java.util.List;
import java.util.ArrayList;
import java.util.Random;

import static org.assertj.core.api.Assertions.assertThat;

class ExamGenerationDeterminismTest {

    @Test
    void ownedShuffleIsStableForTheSameSeed() {
        List<Long> first = new ArrayList<>(List.of(1L, 2L, 3L, 4L, 5L, 6L));
        List<Long> second = new ArrayList<>(first);

        ExamGenerationDeterminism.stableShuffle(first, new Random(20260813L));
        ExamGenerationDeterminism.stableShuffle(second, new Random(20260813L));

        assertThat(second).containsExactlyElementsOf(first);
        assertThat(first).isNotEqualTo(List.of(1L, 2L, 3L, 4L, 5L, 6L));
    }
    @Test
    void variantSeedIsStableAndDependsOnVariantIndex() {
        long first = ExamGenerationDeterminism.deriveVariantSeed(9123L, 1);

        assertThat(ExamGenerationDeterminism.deriveVariantSeed(9123L, 1)).isEqualTo(first);
        assertThat(ExamGenerationDeterminism.deriveVariantSeed(9123L, 2)).isNotEqualTo(first);
    }

    @Test
    void checksumIsOrderIndependentButChangesWithQuestionUpdateAndFilters() {
        QuestionBankQuestion first = question(1L, LocalDateTime.of(2026, 8, 13, 8, 0));
        QuestionBankQuestion second = question(2L, LocalDateTime.of(2026, 8, 13, 8, 1));
        ExamConfigSourceFilter filter = ExamConfigSourceFilter.builder()
                .filterType(ExamConfigSourceFilter.FilterType.INCLUDE_CATEGORY)
                .referenceId(10L)
                .build();

        String checksum = ExamGenerationDeterminism.poolChecksum(3, List.of(filter), List.of(second, first));

        assertThat(ExamGenerationDeterminism.poolChecksum(3, List.of(filter), List.of(first, second)))
                .isEqualTo(checksum);
        second.setUpdatedAt(LocalDateTime.of(2026, 8, 13, 9, 0));
        assertThat(ExamGenerationDeterminism.poolChecksum(3, List.of(filter), List.of(first, second)))
                .isNotEqualTo(checksum);
        assertThat(ExamGenerationDeterminism.poolChecksum(3, List.of(), List.of(first, second)))
                .isNotEqualTo(checksum);
    }

    @Test
    void paraphrasesShareTheRootQuestionFamily() {
        QuestionBankQuestion root = question(7L, null);
        QuestionBankQuestion child = question(8L, null);
        QuestionBankQuestion grandchild = question(9L, null);
        child.setParentQuestion(root);
        grandchild.setParentQuestion(child);

        assertThat(ExamGenerationDeterminism.familyId(root)).isEqualTo(7L);
        assertThat(ExamGenerationDeterminism.familyId(child)).isEqualTo(7L);
        assertThat(ExamGenerationDeterminism.familyId(grandchild)).isEqualTo(7L);
    }

    @Test
    void malformedParentCycleStillGetsOneCanonicalFamily() {
        QuestionBankQuestion first = question(7L, null);
        QuestionBankQuestion second = question(8L, null);
        first.setParentQuestion(second);
        second.setParentQuestion(first);

        assertThat(ExamGenerationDeterminism.familyId(first)).isEqualTo(7L);
        assertThat(ExamGenerationDeterminism.familyId(second)).isEqualTo(7L);
    }

    @Test
    void requestHashRejectsPayloadReuseButTreatsWhitespaceAsEquivalent() {
        String first = ExamGenerationDeterminism.requestHash(4L, 2, " Đề định kỳ ", 2, 99L, false);

        assertThat(ExamGenerationDeterminism.requestHash(4L, 2, "Đề định kỳ", 2, 99L, false))
                .isEqualTo(first);
        assertThat(ExamGenerationDeterminism.requestHash(4L, 2, "Đề định kỳ", 2, 99L, true))
                .isNotEqualTo(first);
    }

    private QuestionBankQuestion question(Long id, LocalDateTime updatedAt) {
        QuestionBankQuestion question = QuestionBankQuestion.builder().id(id).build();
        question.setUpdatedAt(updatedAt);
        return question;
    }
}
