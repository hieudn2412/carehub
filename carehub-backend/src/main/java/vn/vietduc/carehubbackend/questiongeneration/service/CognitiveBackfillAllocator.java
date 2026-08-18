package vn.vietduc.carehubbackend.questiongeneration.service;

import vn.vietduc.carehubbackend.questiongeneration.entity.enums.CognitiveLevel;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

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

    public record CellDemand(CognitiveLevel level, int required, int rawAvailable) {
    }

    public record CellOutcome(CognitiveLevel level, int required, int rawAvailable, int shortage, int backfilled) {
    }

    /**
     * @param demands phải được sắp theo thứ tự nhận thức (FOUNDATION trước) để khớp với thứ tự
     *                chọn câu hỏi thực tế trong {@code ExamPaperService}.
     */
    public static List<CellOutcome> allocate(List<CellDemand> demands, boolean backfillEnabled) {
        Map<CognitiveLevel, Integer> remaining = new EnumMap<>(CognitiveLevel.class);
        for (CellDemand demand : demands) {
            remaining.merge(demand.level(), demand.rawAvailable(), Integer::sum);
        }
        List<CellOutcome> results = new ArrayList<>();
        for (CellDemand demand : demands) {
            int own = Math.min(demand.required(), remaining.getOrDefault(demand.level(), 0));
            remaining.merge(demand.level(), -own, Integer::sum);
            int shortfall = demand.required() - own;
            int backfilled = 0;
            if (shortfall > 0 && backfillEnabled) {
                for (CognitiveLevel donor : nearestLevels(demand.level())) {
                    if (shortfall <= 0) break;
                    int donorRemaining = remaining.getOrDefault(donor, 0);
                    int take = Math.min(shortfall, donorRemaining);
                    if (take > 0) {
                        remaining.merge(donor, -take, Integer::sum);
                        backfilled += take;
                        shortfall -= take;
                    }
                }
            }
            results.add(new CellOutcome(demand.level(), demand.required(), demand.rawAvailable(), shortfall, backfilled));
        }
        return results;
    }
}
