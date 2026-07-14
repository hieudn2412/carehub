package vn.vietduc.carehubbackend.training.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vn.vietduc.carehubbackend.training.entity.TrainingGroup;

import java.util.List;

@Repository
public interface TrainingGroupRepository extends JpaRepository<TrainingGroup, Long> {

    List<TrainingGroup> findByActiveTrueOrderByNameAsc();

    List<TrainingGroup> findByIdInAndActiveTrue(java.util.Set<Long> ids);
}
