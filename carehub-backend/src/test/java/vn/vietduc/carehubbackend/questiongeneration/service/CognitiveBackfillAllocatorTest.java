package vn.vietduc.carehubbackend.questiongeneration.service;

import org.junit.jupiter.api.Test;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.CognitiveLevel;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class CognitiveBackfillAllocatorTest {

    @Test
    void doesNotCountOneFamilyTwiceAcrossCognitiveLevels() {
        var demands = List.of(
                new CognitiveBackfillAllocator.CellDemand(CognitiveLevel.FOUNDATION, 2),
                new CognitiveBackfillAllocator.CellDemand(CognitiveLevel.CLINICAL_APPLICATION, 1),
                new CognitiveBackfillAllocator.CellDemand(CognitiveLevel.CLINICAL_REASONING_ANALYSIS, 0)
        );
        Map<CognitiveLevel, Set<Long>> families = Map.of(
                CognitiveLevel.FOUNDATION, new LinkedHashSet<>(List.of(1L)),
                CognitiveLevel.CLINICAL_APPLICATION, new LinkedHashSet<>(List.of(1L, 2L)),
                CognitiveLevel.CLINICAL_REASONING_ANALYSIS, Set.of()
        );

        var outcomes = CognitiveBackfillAllocator.allocate(demands, families, true);

        assertThat(outcomes).extracting(CognitiveBackfillAllocator.CellOutcome::shortage)
                .containsExactly(1, 0, 0);
        assertThat(outcomes.stream().flatMap(outcome -> outcome.picks().stream())
                .map(CognitiveBackfillAllocator.FamilyPick::familyId))
                .containsExactlyInAnyOrder(1L, 2L)
                .doesNotHaveDuplicates();
    }
}
