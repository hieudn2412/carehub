package vn.vietduc.carehubbackend.questiongeneration.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionClassificationRule;

import java.util.List;

public interface QuestionClassificationRuleRepository extends JpaRepository<QuestionClassificationRule, Long> {
    List<QuestionClassificationRule> findByEnabledTrueOrderByPriorityDescIdAsc();

    List<QuestionClassificationRule> findAllByOrderByPriorityDescIdAsc();
}
