package vn.vietduc.carehubbackend.training.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import vn.vietduc.carehubbackend.training.dto.response.TrainingRecordListResponse;
import vn.vietduc.carehubbackend.training.entity.TrainingRecord;
import vn.vietduc.carehubbackend.training.enums.EvidenceModerationStatus;
import vn.vietduc.carehubbackend.training.enums.TrainingRecordStatus;
import vn.vietduc.carehubbackend.training.enums.TrainingSourceType;

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
            SELECT r
            FROM TrainingRecord r
            JOIN FETCH r.activityType activityType
            LEFT JOIN FETCH r.professionalField professionalField
            WHERE r.employee.id = :employeeId
              AND r.startDate >= :windowStart
              AND r.startDate <= :windowEnd
            ORDER BY r.startDate DESC, r.id DESC
            """)
    List<TrainingRecord> findComplianceWindowRecords(
            @Param("employeeId") Long employeeId,
            @Param("windowStart") LocalDate windowStart,
            @Param("windowEnd") LocalDate windowEnd
    );

    @Query(
            value = """
                    SELECT new vn.vietduc.carehubbackend.training.dto.response.TrainingRecordListResponse(
                        r.id,
                        employee.id,
                        employee.employeeCode,
                        employee.name,
                        department.id,
                        department.name,
                        activityType.id,
                        activityType.name,
                        professionalField.id,
                        professionalField.name,
                        r.title,
                        r.provider,
                        r.startDate,
                        r.endDate,
                        r.declaredHours,
                        r.approvedHours,
                        r.workflowStatus,
                        r.sourceType,
                        r.submittedAt,
                        r.updatedAt,
                        (SELECT COUNT(evidence.id)
                         FROM TrainingEvidenceFile evidence
                         WHERE evidence.trainingRecord.id = r.id AND evidence.active = true),
                        (SELECT COUNT(passedEvidence.id)
                         FROM TrainingEvidenceFile passedEvidence
                         WHERE passedEvidence.trainingRecord.id = r.id
                           AND passedEvidence.active = true
                           AND passedEvidence.moderationStatus = vn.vietduc.carehubbackend.training.enums.EvidenceModerationStatus.PASSED),
                        (SELECT COUNT(failedEvidence.id)
                         FROM TrainingEvidenceFile failedEvidence
                         WHERE failedEvidence.trainingRecord.id = r.id
                           AND failedEvidence.active = true
                           AND failedEvidence.moderationStatus IN (
                               vn.vietduc.carehubbackend.training.enums.EvidenceModerationStatus.FAILED,
                               vn.vietduc.carehubbackend.training.enums.EvidenceModerationStatus.ERROR
                           )),
                        r.version
                    )
                    FROM TrainingRecord r
                    JOIN r.employee employee
                    LEFT JOIN r.employeeDepartmentSnapshot department
                    JOIN r.activityType activityType
                    LEFT JOIN r.professionalField professionalField
                    WHERE (:scopeEmployeeId IS NULL OR employee.id = :scopeEmployeeId)
                      AND (:scopeDepartmentId IS NULL OR employee.department.id = :scopeDepartmentId)
                      AND (:keyword IS NULL
                           OR LOWER(r.title) LIKE :keyword
                           OR LOWER(COALESCE(r.provider, '')) LIKE :keyword
                           OR LOWER(employee.employeeCode) LIKE :keyword
                           OR LOWER(employee.name) LIKE :keyword)
                      AND (:dateFrom IS NULL OR r.startDate >= :dateFrom)
                      AND (:dateTo IS NULL OR r.startDate <= :dateTo)
                      AND (:activityTypeId IS NULL OR activityType.id = :activityTypeId)
                      AND (:professionalFieldId IS NULL OR professionalField.id = :professionalFieldId)
                      AND (:workflowStatus IS NULL OR r.workflowStatus = :workflowStatus)
                      AND (:employeeId IS NULL OR employee.id = :employeeId)
                      AND (:departmentId IS NULL OR employee.department.id = :departmentId)
                      AND (:sourceType IS NULL OR r.sourceType = :sourceType)
                      AND (:hasEvidence IS NULL
                           OR (:hasEvidence = true AND EXISTS (
                               SELECT evidenceWithFile.id
                               FROM TrainingEvidenceFile evidenceWithFile
                               WHERE evidenceWithFile.trainingRecord.id = r.id
                                 AND evidenceWithFile.active = true
                           ))
                           OR (:hasEvidence = false AND NOT EXISTS (
                               SELECT evidenceWithoutFile.id
                               FROM TrainingEvidenceFile evidenceWithoutFile
                               WHERE evidenceWithoutFile.trainingRecord.id = r.id
                                 AND evidenceWithoutFile.active = true
                           )))
                      AND (:moderationStatus IS NULL OR EXISTS (
                           SELECT moderatedEvidence.id
                           FROM TrainingEvidenceFile moderatedEvidence
                           WHERE moderatedEvidence.trainingRecord.id = r.id
                             AND moderatedEvidence.active = true
                             AND moderatedEvidence.moderationStatus = :moderationStatus
                      ))
                    """,
            countQuery = """
                    SELECT COUNT(r)
                    FROM TrainingRecord r
                    JOIN r.employee employee
                    LEFT JOIN r.professionalField professionalField
                    JOIN r.activityType activityType
                    WHERE (:scopeEmployeeId IS NULL OR employee.id = :scopeEmployeeId)
                      AND (:scopeDepartmentId IS NULL OR employee.department.id = :scopeDepartmentId)
                      AND (:keyword IS NULL
                           OR LOWER(r.title) LIKE :keyword
                           OR LOWER(COALESCE(r.provider, '')) LIKE :keyword
                           OR LOWER(employee.employeeCode) LIKE :keyword
                           OR LOWER(employee.name) LIKE :keyword)
                      AND (:dateFrom IS NULL OR r.startDate >= :dateFrom)
                      AND (:dateTo IS NULL OR r.startDate <= :dateTo)
                      AND (:activityTypeId IS NULL OR activityType.id = :activityTypeId)
                      AND (:professionalFieldId IS NULL OR professionalField.id = :professionalFieldId)
                      AND (:workflowStatus IS NULL OR r.workflowStatus = :workflowStatus)
                      AND (:employeeId IS NULL OR employee.id = :employeeId)
                      AND (:departmentId IS NULL OR employee.department.id = :departmentId)
                      AND (:sourceType IS NULL OR r.sourceType = :sourceType)
                      AND (:hasEvidence IS NULL
                           OR (:hasEvidence = true AND EXISTS (
                               SELECT evidenceWithFile.id
                               FROM TrainingEvidenceFile evidenceWithFile
                               WHERE evidenceWithFile.trainingRecord.id = r.id
                                 AND evidenceWithFile.active = true
                           ))
                           OR (:hasEvidence = false AND NOT EXISTS (
                               SELECT evidenceWithoutFile.id
                               FROM TrainingEvidenceFile evidenceWithoutFile
                               WHERE evidenceWithoutFile.trainingRecord.id = r.id
                                 AND evidenceWithoutFile.active = true
                           )))
                      AND (:moderationStatus IS NULL OR EXISTS (
                           SELECT moderatedEvidence.id
                           FROM TrainingEvidenceFile moderatedEvidence
                           WHERE moderatedEvidence.trainingRecord.id = r.id
                             AND moderatedEvidence.active = true
                             AND moderatedEvidence.moderationStatus = :moderationStatus
                      ))
                    """
    )
    Page<TrainingRecordListResponse> searchRecords(
            @Param("scopeEmployeeId") Long scopeEmployeeId,
            @Param("scopeDepartmentId") Long scopeDepartmentId,
            @Param("keyword") String keyword,
            @Param("dateFrom") LocalDate dateFrom,
            @Param("dateTo") LocalDate dateTo,
            @Param("activityTypeId") Long activityTypeId,
            @Param("professionalFieldId") Long professionalFieldId,
            @Param("workflowStatus") TrainingRecordStatus workflowStatus,
            @Param("hasEvidence") Boolean hasEvidence,
            @Param("moderationStatus") EvidenceModerationStatus moderationStatus,
            @Param("employeeId") Long employeeId,
            @Param("departmentId") Long departmentId,
            @Param("sourceType") TrainingSourceType sourceType,
            Pageable pageable
    );

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
