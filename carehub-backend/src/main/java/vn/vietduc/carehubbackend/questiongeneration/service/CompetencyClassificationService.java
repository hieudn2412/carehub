package vn.vietduc.carehubbackend.questiongeneration.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.vietduc.carehubbackend.questiongeneration.entity.CompetencyThresholdConfig;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionCategory;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.CompetencyLevel;
import vn.vietduc.carehubbackend.questiongeneration.repository.CompetencyThresholdConfigRepository;

import java.math.BigDecimal;
import java.util.Comparator;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class CompetencyClassificationService {

    private final CompetencyThresholdConfigRepository thresholdRepository;

    public static final BigDecimal DEFAULT_NOT_COMPETENT_MAX = BigDecimal.valueOf(40);
    public static final BigDecimal DEFAULT_BEGINNER_MAX = BigDecimal.valueOf(60);
    public static final BigDecimal DEFAULT_BASIC_MAX = BigDecimal.valueOf(75);
    public static final BigDecimal DEFAULT_PROFICIENT_MAX = BigDecimal.valueOf(90);

    /**
     * Classify a score (0-100) into a CompetencyLevel using configured thresholds.
     * Falls back to default thresholds if no config exists.
     */
    public CompetencyLevel classify(BigDecimal score, QuestionCategory category) {
        if (score == null) {
            return CompetencyLevel.NOT_COMPETENT;
        }
        List<CompetencyThresholdConfig> thresholds = category == null
                ? thresholdRepository.findByCategoryIsNullOrderBySortOrderAsc()
                : thresholdRepository.findByCategoryOrderBySortOrderAsc(category);

        if (thresholds.isEmpty()) {
            return classifyWithDefaults(score);
        }

        for (CompetencyThresholdConfig threshold : thresholds) {
            if (score.compareTo(threshold.getMinScore()) >= 0
                    && score.compareTo(threshold.getMaxScore()) <= 0) {
                return threshold.getCompetencyLevel();
            }
        }
        // Fallback: find the closest threshold
        return thresholds.stream()
                .max(Comparator.comparing(CompetencyThresholdConfig::getMaxScore))
                .map(CompetencyThresholdConfig::getCompetencyLevel)
                .orElse(CompetencyLevel.NOT_COMPETENT);
    }

    /**
     * Overall classification using global (non-category) thresholds.
     */
    public CompetencyLevel classifyOverall(BigDecimal score) {
        return classify(score, null);
    }

    /**
     * Default classification when no threshold config exists in DB.
     */
    private CompetencyLevel classifyWithDefaults(BigDecimal score) {
        BigDecimal hundred = BigDecimal.valueOf(100);
        if (score.compareTo(hundred) > 0) {
            score = hundred;
        }
        if (score.compareTo(DEFAULT_NOT_COMPETENT_MAX) < 0) {
            return CompetencyLevel.NOT_COMPETENT;
        } else if (score.compareTo(DEFAULT_BEGINNER_MAX) < 0) {
            return CompetencyLevel.BEGINNER;
        } else if (score.compareTo(DEFAULT_BASIC_MAX) < 0) {
            return CompetencyLevel.BASIC;
        } else if (score.compareTo(DEFAULT_PROFICIENT_MAX) < 0) {
            return CompetencyLevel.PROFICIENT;
        } else {
            return CompetencyLevel.ADVANCED;
        }
    }

    @Transactional(readOnly = true)
    public List<CompetencyThresholdConfig> getGlobalThresholds() {
        return thresholdRepository.findByCategoryIsNullOrderBySortOrderAsc();
    }

    @Transactional(readOnly = true)
    public List<CompetencyThresholdConfig> getThresholdsByCategory(QuestionCategory category) {
        return thresholdRepository.findByCategoryOrderBySortOrderAsc(category);
    }

    @Transactional
    public List<CompetencyThresholdConfig> saveGlobalThresholds(List<CompetencyThresholdConfig> thresholds) {
        thresholdRepository.deleteByCategory(null);
        return thresholdRepository.saveAll(thresholds);
    }

    @Transactional
    public List<CompetencyThresholdConfig> saveThresholdsForCategory(QuestionCategory category, List<CompetencyThresholdConfig> thresholds) {
        thresholdRepository.deleteByCategory(category);
        thresholds.forEach(t -> t.setCategory(category));
        return thresholdRepository.saveAll(thresholds);
    }

    /**
     * Get default thresholds (not persisted) for bootstrapping.
     */
    public static List<CompetencyThresholdConfig> defaultThresholds() {
        return List.of(
                CompetencyThresholdConfig.builder()
                        .competencyLevel(CompetencyLevel.NOT_COMPETENT)
                        .minScore(BigDecimal.ZERO)
                        .maxScore(DEFAULT_NOT_COMPETENT_MAX.subtract(BigDecimal.valueOf(0.01)))
                        .label("Chưa đạt năng lực")
                        .colorHex("#EF4444")
                        .sortOrder(1)
                        .build(),
                CompetencyThresholdConfig.builder()
                        .competencyLevel(CompetencyLevel.BEGINNER)
                        .minScore(DEFAULT_NOT_COMPETENT_MAX)
                        .maxScore(DEFAULT_BEGINNER_MAX.subtract(BigDecimal.valueOf(0.01)))
                        .label("Sơ cấp")
                        .colorHex("#F59E0B")
                        .sortOrder(2)
                        .build(),
                CompetencyThresholdConfig.builder()
                        .competencyLevel(CompetencyLevel.BASIC)
                        .minScore(DEFAULT_BEGINNER_MAX)
                        .maxScore(DEFAULT_BASIC_MAX.subtract(BigDecimal.valueOf(0.01)))
                        .label("Cơ bản")
                        .colorHex("#3B82F6")
                        .sortOrder(3)
                        .build(),
                CompetencyThresholdConfig.builder()
                        .competencyLevel(CompetencyLevel.PROFICIENT)
                        .minScore(DEFAULT_BASIC_MAX)
                        .maxScore(DEFAULT_PROFICIENT_MAX.subtract(BigDecimal.valueOf(0.01)))
                        .label("Thành thạo")
                        .colorHex("#10B981")
                        .sortOrder(4)
                        .build(),
                CompetencyThresholdConfig.builder()
                        .competencyLevel(CompetencyLevel.ADVANCED)
                        .minScore(DEFAULT_PROFICIENT_MAX)
                        .maxScore(BigDecimal.valueOf(100))
                        .label("Chuyên sâu")
                        .colorHex("#8B5CF6")
                        .sortOrder(5)
                        .build()
        );
    }
}
