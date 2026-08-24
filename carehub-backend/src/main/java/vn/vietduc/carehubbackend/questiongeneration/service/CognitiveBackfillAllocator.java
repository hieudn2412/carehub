package vn.vietduc.carehubbackend.questiongeneration.service;

import vn.vietduc.carehubbackend.questiongeneration.entity.enums.CognitiveLevel;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Bù câu hỏi giữa các mức nhận thức trong cùng một lĩnh vực chuyên môn khi một mức bị thiếu nguồn.
 *
 * <p>Chỉ mượn trong nội bộ lĩnh vực (không mượn chéo lĩnh vực) và ưu tiên mức nhận thức gần nhất
 * theo thứ tự FOUNDATION - CLINICAL_APPLICATION - CLINICAL_REASONING_ANALYSIS, để hạn chế lệch cấu
 * trúc đề so với ma trận đã cấu hình. Dùng chung cho preview (ExamConfigService) và sinh đề thật
 * (ExamPaperService) để hai luồng luôn cho ra kết quả khớp nhau.</p>
 */
public final class CognitiveBackfillAllocator {

    private static final List<CognitiveLevel> ORDER = List.of(
            CognitiveLevel.FOUNDATION, CognitiveLevel.CLINICAL_APPLICATION, CognitiveLevel.CLINICAL_REASONING_ANALYSIS);

    private CognitiveBackfillAllocator() {
    }

    public static int order(CognitiveLevel level) {
        int idx = level == null ? -1 : ORDER.indexOf(level);
        return idx < 0 ? Integer.MAX_VALUE : idx;
    }

    /** Các mức nhận thức khác, sắp theo khoảng cách gần nhất tới {@code level}. */
    public static List<CognitiveLevel> nearestLevels(CognitiveLevel level) {
        int base = order(level);
        return ORDER.stream()
                .filter(l -> l != level)
                .sorted(Comparator.comparingInt((CognitiveLevel l) -> Math.abs(order(l) - base))
                        .thenComparingInt(CognitiveBackfillAllocator::order))
                .toList();
    }

    public record CellDemand(CognitiveLevel level, int required) {
    }

    public record FamilyPick(long familyId, CognitiveLevel sourceLevel) {
    }

    public record CellOutcome(
            CognitiveLevel level,
            int required,
            int rawAvailable,
            int shortage,
            int backfilled,
            List<FamilyPick> picks
    ) {
    }

    /**
     * @param demands phải được sắp theo thứ tự nhận thức (FOUNDATION trước) để khớp với thứ tự
     *                chọn câu hỏi thực tế trong {@code ExamPaperService}.
     */
    public static List<CellOutcome> allocate(
            List<CellDemand> demands,
            Map<CognitiveLevel, Set<Long>> familiesByLevel,
            boolean backfillEnabled
    ) {
        List<CognitiveLevel> slots = new ArrayList<>();
        for (CellDemand demand : demands) {
            for (int index = 0; index < demand.required(); index++) slots.add(demand.level());
        }

        Long[] slotFamilies = new Long[slots.size()];
        Map<Long, Integer> familyToSlot = new HashMap<>();
        for (int slot = 0; slot < slots.size(); slot++) {
            matchOwnLevel(slot, slots, familiesByLevel, familyToSlot, slotFamilies, new HashSet<>());
        }

        Set<Long> usedFamilies = new HashSet<>(familyToSlot.keySet());
        FamilyPick[] picks = new FamilyPick[slots.size()];
        for (int slot = 0; slot < slots.size(); slot++) {
            if (slotFamilies[slot] != null) {
                picks[slot] = new FamilyPick(slotFamilies[slot], slots.get(slot));
            }
        }
        if (backfillEnabled) {
            for (int slot = 0; slot < slots.size(); slot++) {
                if (picks[slot] != null) continue;
                for (CognitiveLevel donor : nearestLevels(slots.get(slot))) {
                    Long familyId = orderedFamilies(familiesByLevel, donor).stream()
                            .filter(candidate -> !usedFamilies.contains(candidate))
                            .findFirst()
                            .orElse(null);
                    if (familyId == null) continue;
                    picks[slot] = new FamilyPick(familyId, donor);
                    usedFamilies.add(familyId);
                    break;
                }
            }
        }

        List<CellOutcome> results = new ArrayList<>();
        int slot = 0;
        for (CellDemand demand : demands) {
            List<FamilyPick> cellPicks = new ArrayList<>();
            for (int index = 0; index < demand.required(); index++, slot++) {
                if (picks[slot] != null) cellPicks.add(picks[slot]);
            }
            int backfilled = (int) cellPicks.stream()
                    .filter(pick -> pick.sourceLevel() != demand.level())
                    .count();
            results.add(new CellOutcome(
                    demand.level(),
                    demand.required(),
                    orderedFamilies(familiesByLevel, demand.level()).size(),
                    demand.required() - cellPicks.size(),
                    backfilled,
                    List.copyOf(cellPicks)
            ));
        }
        return results;
    }

    private static boolean matchOwnLevel(
            int slot,
            List<CognitiveLevel> slots,
            Map<CognitiveLevel, Set<Long>> familiesByLevel,
            Map<Long, Integer> familyToSlot,
            Long[] slotFamilies,
            Set<Long> visited
    ) {
        for (Long familyId : orderedFamilies(familiesByLevel, slots.get(slot))) {
            if (!visited.add(familyId)) continue;
            Integer previousSlot = familyToSlot.get(familyId);
            if (previousSlot == null
                    || matchOwnLevel(previousSlot, slots, familiesByLevel, familyToSlot, slotFamilies, visited)) {
                familyToSlot.put(familyId, slot);
                slotFamilies[slot] = familyId;
                return true;
            }
        }
        return false;
    }

    private static List<Long> orderedFamilies(
            Map<CognitiveLevel, Set<Long>> familiesByLevel,
            CognitiveLevel level
    ) {
        return List.copyOf(familiesByLevel.getOrDefault(level, Set.of()));
    }
}
