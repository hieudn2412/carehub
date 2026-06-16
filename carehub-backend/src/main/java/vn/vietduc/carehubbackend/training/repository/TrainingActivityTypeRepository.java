package vn.vietduc.carehubbackend.training.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import vn.vietduc.carehubbackend.training.entity.TrainingActivityType;
import vn.vietduc.carehubbackend.training.enums.DurationUnit;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface TrainingActivityTypeRepository extends JpaRepository<TrainingActivityType, Long> {
    boolean existsByCode(String code);

    boolean existsByCodeAndIdNot(String code, Long id);

    Optional<TrainingActivityType> findByCode(String code);

    Page<TrainingActivityType> findByActiveTrue(Pageable pageable);

    @Query("""
            SELECT t
            FROM TrainingActivityType t
            WHERE (:keyword IS NULL
                   OR LOWER(t.code) LIKE LOWER(CONCAT('%', :keyword, '%'))
                   OR LOWER(t.name) LIKE LOWER(CONCAT('%', :keyword, '%')))
              AND (:active IS NULL OR t.active = :active)
              AND (:requiresEvidence IS NULL OR t.requiresEvidence = :requiresEvidence)
              AND (:durationUnit IS NULL OR t.defaultDurationUnit = :durationUnit)
            """)
    Page<TrainingActivityType> search(
            @Param("keyword") String keyword,
            @Param("active") Boolean active,
            @Param("requiresEvidence") Boolean requiresEvidence,
            @Param("durationUnit") DurationUnit durationUnit,
            Pageable pageable
    );

    @Query("""
            SELECT r.activityType.id AS activityTypeId, COUNT(r.id) AS usageCount
            FROM TrainingRecord r
            WHERE r.activityType.id IN :activityTypeIds
            GROUP BY r.activityType.id
            """)
    List<ActivityTypeUsageCount> countUsageByActivityTypeIds(@Param("activityTypeIds") Collection<Long> activityTypeIds);

    interface ActivityTypeUsageCount {
        Long getActivityTypeId();

        long getUsageCount();
    }
}
