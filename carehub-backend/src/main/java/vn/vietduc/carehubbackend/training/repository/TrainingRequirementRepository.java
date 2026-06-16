package vn.vietduc.carehubbackend.training.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import vn.vietduc.carehubbackend.training.entity.TrainingRequirement;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface TrainingRequirementRepository extends JpaRepository<TrainingRequirement, Long> {
    Optional<TrainingRequirement> findByCode(String code);

    @Query("""
            SELECT r
            FROM TrainingRequirement r
            WHERE r.active = true
              AND r.effectiveFrom <= :asOf
              AND (r.effectiveTo IS NULL OR r.effectiveTo >= :asOf)
              AND (r.department IS NULL OR r.department.id = :departmentId)
              AND (r.jobPosition IS NULL OR r.jobPosition.id = :positionId)
              AND (r.professionalField IS NULL OR r.professionalField.id = :professionalFieldId)
            """)
    List<TrainingRequirement> findActiveCandidates(
            @Param("departmentId") Long departmentId,
            @Param("positionId") Long positionId,
            @Param("professionalFieldId") Long professionalFieldId,
            @Param("asOf") LocalDate asOf
    );

    @Query("""
            SELECT r
            FROM TrainingRequirement r
            WHERE r.active = true
              AND (:ignoredId IS NULL OR r.id <> :ignoredId)
              AND ((:departmentId IS NULL AND r.department IS NULL) OR r.department.id = :departmentId)
              AND ((:positionId IS NULL AND r.jobPosition IS NULL) OR r.jobPosition.id = :positionId)
              AND ((:professionalFieldId IS NULL AND r.professionalField IS NULL) OR r.professionalField.id = :professionalFieldId)
              AND (r.effectiveTo IS NULL OR r.effectiveTo >= :effectiveFrom)
              AND (:effectiveTo IS NULL OR r.effectiveFrom <= :effectiveTo)
            """)
    List<TrainingRequirement> findOverlappingActiveRequirements(
            @Param("ignoredId") Long ignoredId,
            @Param("departmentId") Long departmentId,
            @Param("positionId") Long positionId,
            @Param("professionalFieldId") Long professionalFieldId,
            @Param("effectiveFrom") LocalDate effectiveFrom,
            @Param("effectiveTo") LocalDate effectiveTo
    );
}
