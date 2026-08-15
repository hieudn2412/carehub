package vn.vietduc.carehubbackend.questiongeneration.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionSetCategory;

import java.util.Optional;

public interface QuestionSetCategoryRepository extends JpaRepository<QuestionSetCategory, Long> {
    Optional<QuestionSetCategory> findByCode(String code);
}
