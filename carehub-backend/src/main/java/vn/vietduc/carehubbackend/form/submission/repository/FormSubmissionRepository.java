package vn.vietduc.carehubbackend.form.submission.repository;

import jakarta.persistence.LockModeType;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import vn.vietduc.carehubbackend.form.submission.entity.*;

import java.util.Optional;
import java.time.Instant;
import java.util.List;

public interface FormSubmissionRepository extends JpaRepository<FormSubmission, Long> {
    @EntityGraph(attributePaths = {"formVersion", "formVersion.form", "submittedBy", "subjectContext"})
    @Query("""
            select s from FormSubmission s
            join s.subjectContext context
            where s.status = 'SUBMITTED'
              and s.scoringStatus = 'CALCULATED'
              and s.submittedAt between :fromDate and :toDate
              and (context.subjectUser.id = :userId
                   or (context.subjectUser is null and lower(context.employeeCode) = lower(:employeeCode)))
            order by s.submittedAt desc
            """)
    List<FormSubmission> findScoredEvaluationsForSubject(
            @Param("userId") Long userId,
            @Param("employeeCode") String employeeCode,
            @Param("fromDate") Instant fromDate,
            @Param("toDate") Instant toDate
    );

    boolean existsByAssignmentItem_IdAndSubmittedBy_IdAndSubjectContext_SubjectUser_IdAndStatus(
            Long assignmentItemId, Long submittedById, Long subjectUserId, FormSubmissionStatus status);

    @Query("select s from FormSubmission s where (:status is null or s.status = :status) order by s.createdAt desc")
    Page<FormSubmission> searchAll(@Param("status") FormSubmissionStatus status, Pageable pageable);

    @Query("""
            select s from FormSubmission s
            where s.submittedBy.id = :userId and (:status is null or s.status = :status)
            order by s.createdAt desc
            """)
    Page<FormSubmission> searchOwned(@Param("userId") Long userId,
                                     @Param("status") FormSubmissionStatus status, Pageable pageable);

    @EntityGraph(attributePaths = {"assignmentItem", "formVersion", "formVersion.form", "subjectContext"})
    @Query("""
            select s from FormSubmission s
            where s.formVersion.form.id = :formId
              and (:status is null or s.status = :status)
            order by s.createdAt desc
            """)
    Page<FormSubmission> searchByFormId(@Param("formId") Long formId,
                                        @Param("status") FormSubmissionStatus status,
                                        Pageable pageable);

    @EntityGraph(attributePaths = {"assignmentItem", "formVersion", "formVersion.form", "subjectContext"})
    @Query("""
            select s from FormSubmission s
            where s.formVersion.form.id = :formId
              and s.formVersion.id = :versionId
              and (:status is null or s.status = :status)
            order by s.createdAt desc
            """)
    Page<FormSubmission> searchByFormVersionId(@Param("formId") Long formId,
                                               @Param("versionId") Long versionId,
                                               @Param("status") FormSubmissionStatus status,
                                               Pageable pageable);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from FormSubmission s where s.id = :id")
    Optional<FormSubmission> findByIdForUpdate(@Param("id") Long id);

    long countByFormVersion_IdAndStatus(Long versionId, FormSubmissionStatus status);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
            update form_submissions
               set passing_score = max_score * :passingScore / 10.0,
                   result_status = case
                       when critical_failure = true then 'FAILED_CRITICAL'
                       when converted_score >= :passingScore then 'PASSED'
                       else 'FAILED_SCORE'
                   end,
                   updated_at = current_timestamp
             where form_version_id = :versionId
               and status = 'SUBMITTED'
               and scoring_status = 'CALCULATED'
            """, nativeQuery = true)
    int recalculateWithCustomFloor(@Param("versionId") Long versionId,
                                   @Param("passingScore") java.math.BigDecimal passingScore);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
            update form_submissions
               set passing_score = :rawPassingScore,
                   result_status = case
                       when critical_failure = true then 'FAILED_CRITICAL'
                       when total_score >= :rawPassingScore then 'PASSED'
                       else 'FAILED_SCORE'
                   end,
                   updated_at = current_timestamp
             where form_version_id = :versionId
               and status = 'SUBMITTED'
               and scoring_status = 'CALCULATED'
            """, nativeQuery = true)
    int recalculateWithDefaultFloor(@Param("versionId") Long versionId,
                                    @Param("rawPassingScore") java.math.BigDecimal rawPassingScore);
}
