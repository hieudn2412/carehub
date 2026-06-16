package vn.vietduc.carehubbackend.training.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import vn.vietduc.carehubbackend.training.entity.TrainingRecord;
import vn.vietduc.carehubbackend.training.enums.TrainingRecordStatus;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public interface TrainingRecordRepository extends JpaRepository<TrainingRecord, Long> {
    Page<TrainingRecord> findByEmployee_Id(Long employeeId, Pageable pageable);

    Page<TrainingRecord> findByEmployee_Department_Id(Long departmentId, Pageable pageable);

    List<TrainingRecord> findByWorkflowStatus(TrainingRecordStatus status);

    long countByActivityType_Id(Long activityTypeId);

    Page<TrainingRecord> findByActivityType_IdOrderByStartDateDesc(Long activityTypeId, Pageable pageable);

    @Query("""
            SELECT COUNT(r)
            FROM TrainingRecord r
            WHERE r.employee.id = :employeeId
              AND lower(trim(r.title)) = lower(trim(:title))
              AND r.startDate = :startDate
              AND r.declaredHours = :declaredHours
            """)
    long countDuplicateCandidates(
            @Param("employeeId") Long employeeId,
            @Param("title") String title,
            @Param("startDate") LocalDate startDate,
            @Param("declaredHours") BigDecimal declaredHours
    );

    @Query("""
            SELECT COUNT(r)
            FROM TrainingRecord r
            WHERE r.employee.id = :employeeId
              AND lower(trim(r.title)) = lower(trim(:title))
              AND r.startDate = :startDate
              AND r.declaredHours = :declaredHours
              AND r.id <> :excludeId
            """)
    long countDuplicateCandidatesExcluding(
            @Param("employeeId") Long employeeId,
            @Param("title") String title,
            @Param("startDate") LocalDate startDate,
            @Param("declaredHours") BigDecimal declaredHours,
            @Param("excludeId") Long excludeId
    );

    @Query("""
            SELECT COALESCE(SUM(r.approvedHours), 0)
            FROM TrainingRecord r
            WHERE r.employee.id = :employeeId
              AND r.workflowStatus = vn.vietduc.carehubbackend.training.enums.TrainingRecordStatus.APPROVED
              AND r.startDate >= :windowStart
              AND r.startDate <= :windowEnd
            """)
    BigDecimal sumApprovedHoursForEmployee(
            @Param("employeeId") Long employeeId,
            @Param("windowStart") LocalDate windowStart,
            @Param("windowEnd") LocalDate windowEnd
    );

    @Query("""
            SELECT r
            FROM TrainingRecord r
            WHERE r.employee.id = :employeeId
              AND r.workflowStatus = vn.vietduc.carehubbackend.training.enums.TrainingRecordStatus.APPROVED
              AND r.startDate >= :windowStart
              AND r.startDate <= :windowEnd
            ORDER BY r.startDate DESC
            """)
    List<TrainingRecord> findApprovedRecordsForEmployee(
            @Param("employeeId") Long employeeId,
            @Param("windowStart") LocalDate windowStart,
            @Param("windowEnd") LocalDate windowEnd
    );
}
