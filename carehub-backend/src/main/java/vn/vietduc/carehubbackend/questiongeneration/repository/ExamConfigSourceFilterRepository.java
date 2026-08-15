package vn.vietduc.carehubbackend.questiongeneration.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamConfig;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamConfigSourceFilter;

import java.util.List;

public interface ExamConfigSourceFilterRepository extends JpaRepository<ExamConfigSourceFilter, Long> {
    List<ExamConfigSourceFilter> findByExamConfigOrderByIdAsc(ExamConfig config);
    void deleteByExamConfig(ExamConfig config);
}
