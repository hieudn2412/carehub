package vn.vietduc.carehubbackend.questiongeneration.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamConfig;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamConfigDistribution;

import java.util.List;

public interface ExamConfigDistributionRepository extends JpaRepository<ExamConfigDistribution, Long> {
    List<ExamConfigDistribution> findByExamConfigOrderByIdAsc(ExamConfig examConfig);

    void deleteByExamConfig(ExamConfig examConfig);
}
