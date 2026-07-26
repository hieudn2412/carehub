package vn.vietduc.carehubbackend.form.submission.repository;

import jakarta.persistence.LockModeType;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import vn.vietduc.carehubbackend.form.submission.entity.*;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.CompetencyTechniqueOptionResponse;
import vn.vietduc.carehubbackend.user.entity.User;

import java.math.BigDecimal;
import java.util.Optional;
import java.time.Instant;
import java.util.Collection;
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

    @EntityGraph(attributePaths = {
            "formVersion", "formVersion.form", "submittedBy",
            "subjectContext", "subjectContext.subjectUser", "subjectContext.subjectUser.department"
    })
    @Query("""
            select s from FormSubmission s
            join s.subjectContext context
            join context.subjectUser subject
            where s.status = 'SUBMITTED'
              and s.scoringStatus = 'CALCULATED'
              and s.submittedAt between :fromDate and :toDate
              and subject.department.id = :departmentId
            order by s.submittedAt desc
            """)
    List<FormSubmission> findScoredEvaluationsForDepartment(
            @Param("departmentId") Long departmentId,
            @Param("fromDate") Instant fromDate,
            @Param("toDate") Instant toDate
    );

    @Query(value = """
            select distinct subject
            from FormSubmission s
            join s.subjectContext context
            join context.subjectUser subject
            where s.status = 'SUBMITTED'
              and s.scoringStatus = 'CALCULATED'
              and s.submittedAt between :fromDate and :toDate
              and (:departmentId is null or subject.department.id = :departmentId)
              and (:formId is null or s.formVersion.form.id = :formId)
              and (:keyword is null
                   or lower(subject.name) like :keyword
                   or lower(subject.employeeCode) like :keyword)
            order by subject.name asc, subject.id asc
            """,
            countQuery = """
            select count(distinct subject.id)
            from FormSubmission s
            join s.subjectContext context
            join context.subjectUser subject
            where s.status = 'SUBMITTED'
              and s.scoringStatus = 'CALCULATED'
              and s.submittedAt between :fromDate and :toDate
              and (:departmentId is null or subject.department.id = :departmentId)
              and (:formId is null or s.formVersion.form.id = :formId)
              and (:keyword is null
                   or lower(subject.name) like :keyword
                   or lower(subject.employeeCode) like :keyword)
            """)
    Page<User> findCompetencyTechniqueCandidates(
            @Param("departmentId") Long departmentId,
            @Param("formId") Long formId,
            @Param("keyword") String keyword,
            @Param("fromDate") Instant fromDate,
            @Param("toDate") Instant toDate,
            Pageable pageable
    );

    @Query("""
            select distinct new vn.vietduc.carehubbackend.questiongeneration.dto.response.CompetencyTechniqueOptionResponse(
                form.id, form.title
            )
            from FormSubmission s
            join s.subjectContext context
            join context.subjectUser subject
            join s.formVersion version
            join version.form form
            where s.status = 'SUBMITTED'
              and s.scoringStatus = 'CALCULATED'
              and s.submittedAt between :fromDate and :toDate
              and (:departmentId is null or subject.department.id = :departmentId)
            order by form.title
            """)
    List<CompetencyTechniqueOptionResponse> findCompetencyTechniqueOptions(
            @Param("departmentId") Long departmentId,
            @Param("fromDate") Instant fromDate,
            @Param("toDate") Instant toDate
    );

    @EntityGraph(attributePaths = {
            "formVersion", "formVersion.form", "submittedBy",
            "subjectContext", "subjectContext.subjectUser", "subjectContext.subjectUser.department"
    })
    @Query("""
            select s from FormSubmission s
            join s.subjectContext context
            left join context.subjectUser subject
            where s.status = 'SUBMITTED'
              and s.scoringStatus = 'CALCULATED'
              and s.submittedAt between :fromDate and :toDate
              and (subject.id in :userIds
                   or (subject is null and lower(context.employeeCode) in :employeeCodes))
            order by s.submittedAt desc
            """)
    List<FormSubmission> findScoredEvaluationsForCandidateUsers(
            @Param("userIds") Collection<Long> userIds,
            @Param("employeeCodes") Collection<String> employeeCodes,
            @Param("fromDate") Instant fromDate,
            @Param("toDate") Instant toDate
    );

    @EntityGraph(attributePaths = {
            "formVersion", "formVersion.form", "submittedBy",
            "subjectContext", "subjectContext.subjectUser", "subjectContext.subjectUser.department"
    })
    @Query("""
            select s from FormSubmission s
            join s.subjectContext context
            join context.subjectUser subject
            where s.status = 'SUBMITTED'
              and s.scoringStatus = 'CALCULATED'
              and s.submittedAt between :fromDate and :toDate
              and subject.id in :userIds
              and (:formId is null or s.formVersion.form.id = :formId)
            order by s.submittedAt desc
            """)
    List<FormSubmission> findScoredEvaluationsForTechniqueCandidates(
            @Param("userIds") Collection<Long> userIds,
            @Param("formId") Long formId,
            @Param("fromDate") Instant fromDate,
            @Param("toDate") Instant toDate
    );

    boolean existsByAssignmentItem_IdAndSubmittedBy_IdAndSubjectContext_SubjectUser_IdAndStatus(
            Long assignmentItemId, Long submittedById, Long subjectUserId, FormSubmissionStatus status);

    @Query("""
            select s from FormSubmission s
            left join s.subjectContext context
            where (:status is null or s.status = :status)
              and (:keyword is null
                   or lower(s.formVersion.title) like :keyword
                   or lower(context.fullName) like :keyword
                   or lower(context.employeeCode) like :keyword
                   or lower(s.submittedBy.name) like :keyword)
            order by s.createdAt desc
            """)
    Page<FormSubmission> searchAll(@Param("status") FormSubmissionStatus status,
                                   @Param("keyword") String keyword,
                                   Pageable pageable);

    @Query("""
            select s from FormSubmission s
            left join s.subjectContext context
            where s.submittedBy.id = :userId
              and (:status is null or s.status = :status)
              and (:keyword is null
                   or lower(s.formVersion.title) like :keyword
                   or lower(context.fullName) like :keyword
                   or lower(context.employeeCode) like :keyword)
            order by s.createdAt desc
            """)
    Page<FormSubmission> searchOwned(@Param("userId") Long userId,
                                     @Param("status") FormSubmissionStatus status,
                                     @Param("keyword") String keyword,
                                     Pageable pageable);

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
              and (:result is null or s.result = :result)
            order by s.createdAt desc
            """)
    Page<FormSubmission> searchByFormVersionId(@Param("formId") Long formId,
                                               @Param("versionId") Long versionId,
                                               @Param("status") FormSubmissionStatus status,
                                               @Param("result") FormSubmissionResult result,
                                               Pageable pageable);

    long countByFormVersion_IdAndStatusAndResult(
            Long versionId,
            FormSubmissionStatus status,
            FormSubmissionResult result
    );

    @Query("""
            select avg(s.convertedScore) from FormSubmission s
            where s.formVersion.id = :versionId
              and s.status = :status
            """)
    BigDecimal averageConvertedScoreByVersionAndStatus(
            @Param("versionId") Long versionId,
            @Param("status") FormSubmissionStatus status
    );

    @EntityGraph(attributePaths = {
            "formVersion", "formVersion.form", "submittedBy", "subjectContext",
            "answers", "answers.question", "answers.question.section", "answers.selectedOption"
    })
    @Query("""
            select distinct s from FormSubmission s
            where s.formVersion.form.id = :formId
              and s.formVersion.id = :versionId
              and s.status = 'SUBMITTED'
              and (:result is null or s.result = :result)
            order by s.submittedAt desc, s.id desc
            """)
    List<FormSubmission> findSubmittedForVersionExport(
            @Param("formId") Long formId,
            @Param("versionId") Long versionId,
            @Param("result") FormSubmissionResult result
    );

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
