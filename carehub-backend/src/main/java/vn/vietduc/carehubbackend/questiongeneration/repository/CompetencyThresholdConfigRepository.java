package vn.vietduc.carehubbackend.questiongeneration.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vn.vietduc.carehubbackend.questiongeneration.entity.CompetencyThresholdConfig;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionCategory;

import java.util.List;
import java.util.Optional;

@Repository
public interface CompetencyThresholdConfigRepository extends JpaRepository<CompetencyThresholdConfig, Long> {

    List<CompetencyThresholdConfig> findByCategoryIsNullOrderBySortOrderAsc();

    List<CompetencyThresholdConfig> findByCategoryOrderBySortOrderAsc(QuestionCategory category);

    Optional<CompetencyThresholdConfig> findByCategoryAndCompetencyLevel(QuestionCategory category, String competencyLevel);

    void deleteByCategory(QuestionCategory category);
}
