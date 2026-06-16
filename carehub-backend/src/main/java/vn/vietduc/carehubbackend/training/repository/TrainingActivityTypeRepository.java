package vn.vietduc.carehubbackend.training.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import vn.vietduc.carehubbackend.training.entity.TrainingActivityType;

import java.util.Optional;

public interface TrainingActivityTypeRepository extends JpaRepository<TrainingActivityType, Long> {
    boolean existsByCode(String code);

    Optional<TrainingActivityType> findByCode(String code);

    Page<TrainingActivityType> findByActiveTrue(Pageable pageable);
}
