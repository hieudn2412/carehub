package vn.vietduc.carehubbackend.questiongeneration.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionSetCategory;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionSetCategoryStatus;

import java.util.List;
import java.util.Optional;

public interface QuestionSetCategoryRepository extends JpaRepository<QuestionSetCategory, Long> {
    Optional<QuestionSetCategory> findByCode(String code);

    List<QuestionSetCategory> findByStatusOrderBySortOrderAscNameAsc(QuestionSetCategoryStatus status);
}
