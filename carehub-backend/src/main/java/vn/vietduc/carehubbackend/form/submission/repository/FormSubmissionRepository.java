package vn.vietduc.carehubbackend.form.submission.repository;

import jakarta.persistence.LockModeType;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import vn.vietduc.carehubbackend.form.submission.entity.*;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.CompetencyTechniqueOptionResponse;
import vn.vietduc.carehubbackend.questiongeneration.repository.projection.MyComplianceYearProjection;
import vn.vietduc.carehubbackend.user.entity.User;

import java.math.BigDecimal;
import java.util.Optional;
import java.time.Instant;
import java.util.Collection;
import java.util.List;

public interface FormSubmissionRepository extends JpaRepository<FormSubmission, Long> {
    interface FormHistoryProjection {
        Long getFormId();
        String getCode();
        String getTitle();
        Long getVersionCount();
        Long getSubmissionCount();
    }

    interface FormVersionHistoryProjection {
        Long getFormId();
        Long getVersionId();
        Integer getVersionNumber();
        String getTitle();
        String getDescription();
        vn.vietduc.carehubbackend.form.entity.enums.FormVersionStatus getStatus();
        Instant getPublishedAt();
        String getPublishedBy();
        Long getTotal();
        Long getPassed();
        Long getFailed();
        Double getAverageConvertedScore();
    }

    interface FormSubmissionHistorySummaryProjection {
        Long getTotal();
        Long getPassed();
        Long getFailed();
        Double getAverageConvertedScore();
    }

    interface FormSubmissionCountProjection {
        Long getFormId();
        long getResponseCount();
    }

    interface CompetencyTechniqueAggregateProjection {
        Long getEmployeeId();
        String getEmployeeCode();
        String getEmployeeName();
        String getDepartmentName();
        Long getEvaluationCount();
        Long getPassCount();
        BigDecimal getAverageScore();
    }

    @Query("""
            select s.formVersion.form.id as formId,
                   count(s.id) as responseCount
            from FormSubmission s
            where s.formVersion.form.id in :formIds
              and s.status = :submittedStatus
            group by s.formVersion.form.id
            """)
    List<FormSubmissionCountProjection> countSubmittedByFormIds(
            @Param("formIds") Collection<Long> formIds,
            @Param("submittedStatus") FormSubmissionStatus submittedStatus);

    @Query(value = """
            select v.form.id as formId,
                   v.form.code as code,
                   v.form.title as title,
                   count(distinct v.id) as versionCount,
                   count(distinct s.id) as submissionCount
            from FormVersion v
            left join FormSubmission s
              on s.formVersion = v and s.status = :submittedStatus
            where v.form.deleted = false
              and v.status in :versionStatuses
              and (:keyword is null
                   or lower(v.form.code) like :keyword
                   or lower(v.form.title) like :keyword)
            group by v.form.id, v.form.code, v.form.title
            order by max(v.createdAt) desc, v.form.id desc
            """,
            countQuery = """
            select count(distinct v.form.id)
            from FormVersion v
            where v.form.deleted = false
              and v.status in :versionStatuses
              and (:keyword is null
                   or lower(v.form.code) like :keyword
                   or lower(v.form.title) like :keyword)
            """)
    Page<FormHistoryProjection> searchHistoryForms(
            @Param("keyword") String keyword,
            @Param("versionStatuses") Collection<vn.vietduc.carehubbackend.form.entity.enums.FormVersionStatus> versionStatuses,
            @Param("submittedStatus") FormSubmissionStatus submittedStatus,
            Pageable pageable
    );

    @Query("""
            select v.form.id as formId,
                   v.id as versionId,
                   v.versionNumber as versionNumber,
                   v.title as title,
                   v.description as description,
                   v.status as status,
                   v.publishedAt as publishedAt,
                   publisher.name as publishedBy,
                   count(s.id) as total,
                   coalesce(sum(case when s.result = :passedResult then 1 else 0 end), 0) as passed,
                   coalesce(sum(case when s.result in :failedResults then 1 else 0 end), 0) as failed,
                   avg(s.convertedScore) as averageConvertedScore
            from FormVersion v
            left join v.publishedBy publisher
            left join FormSubmission s
              on s.formVersion = v and s.status = :submittedStatus
            where v.form.id = :formId
              and v.form.deleted = false
              and v.status in :versionStatuses
            group by v.form.id, v.id, v.versionNumber, v.title, v.description,
                     v.status, v.publishedAt, publisher.name
            order by v.versionNumber desc
            """)
    List<FormVersionHistoryProjection> findHistoryVersions(
            @Param("formId") Long formId,
            @Param("versionStatuses") Collection<vn.vietduc.carehubbackend.form.entity.enums.FormVersionStatus> versionStatuses,
            @Param("submittedStatus") FormSubmissionStatus submittedStatus,
            @Param("passedResult") FormSubmissionResult passedResult,
            @Param("failedResults") Collection<FormSubmissionResult> failedResults
    );

    @EntityGraph(attributePaths = {"formVersion", "formVersion.form", "submittedBy", "subjectContext"})
    @Query("""
            select s from FormSubmission s
            join s.subjectContext context
            where s.status = 'SUBMITTED'
              and s.formVersion.form.deleted = false
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

    @Query(value = """
            select distinct extract(year from s.submitted_at)::int as year
            from form_submissions s
            join form_submission_contexts context on context.submission_id = s.id
            where s.status = 'SUBMITTED'
              and s.scoring_status = 'CALCULATED'
              and s.submitted_at is not null
              and (context.subject_user_id = :userId
                   or (context.subject_user_id is null and lower(context.employee_code) = lower(:employeeCode)))
            order by year desc
            """, nativeQuery = true)
    List<MyComplianceYearProjection> findScoredEvaluationYearsForSubject(
            @Param("userId") Long userId,
            @Param("employeeCode") String employeeCode
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
              and s.formVersion.form.deleted = false
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
              and s.formVersion.form.deleted = false
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
              and s.formVersion.form.deleted = false
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

    @Query(value = """
            select subject.id as employeeId,
                   subject.employeeCode as employeeCode,
                   subject.name as employeeName,
                   subject.department.name as departmentName,
                   count(s.id) as evaluationCount,
                   coalesce(sum(case when s.result = 'PASSED' then 1 else 0 end), 0) as passCount,
                   avg(coalesce(s.convertedScore, s.totalScore, 0)) as averageScore
            from FormSubmission s
            join s.subjectContext context
            join context.subjectUser subject
            where s.status = 'SUBMITTED'
              and s.formVersion.form.deleted = false
              and s.submittedAt between :fromDate and :toDate
              and (:departmentId is null or subject.department.id = :departmentId)
              and (:formId is null or s.formVersion.form.id = :formId)
              and (:keyword is null
                   or lower(subject.name) like :keyword
                   or lower(subject.employeeCode) like :keyword)
            group by subject.id, subject.employeeCode, subject.name, subject.department.name
            order by subject.name asc, subject.id asc
            """,
            countQuery = """
            select count(distinct subject.id)
            from FormSubmission s
            join s.subjectContext context
            join context.subjectUser subject
            where s.status = 'SUBMITTED'
              and s.formVersion.form.deleted = false
              and s.submittedAt between :fromDate and :toDate
              and (:departmentId is null or subject.department.id = :departmentId)
              and (:formId is null or s.formVersion.form.id = :formId)
              and (:keyword is null
                   or lower(subject.name) like :keyword
                   or lower(subject.employeeCode) like :keyword)
            """)
    Page<CompetencyTechniqueAggregateProjection> summarizeCompetencyTechnique(
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
              and form.deleted = false
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
              and s.formVersion.form.deleted = false
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

    boolean existsByFormVersion_IdAndAssignmentItemIsNullAndSubmittedBy_IdAndSubjectContext_SubjectUser_IdAndStatus(
            Long formVersionId, Long submittedById, Long subjectUserId, FormSubmissionStatus status);

    @EntityGraph(attributePaths = {
            "assignmentItem", "formVersion", "formVersion.form", "submittedBy", "subjectContext",
            "subjectContext.subjectUser", "answers", "answers.question", "answers.selectedOption"
    })
    Optional<FormSubmission> findFirstByAssignmentItem_IdAndSubmittedBy_IdAndSubjectContext_SubjectUser_IdAndStatusOrderByCreatedAtDesc(
            Long assignmentItemId, Long submittedById, Long subjectUserId, FormSubmissionStatus status);

    @EntityGraph(attributePaths = {
            "formVersion", "formVersion.form", "submittedBy", "subjectContext",
            "subjectContext.subjectUser", "answers", "answers.question", "answers.selectedOption"
    })
    Optional<FormSubmission> findFirstByFormVersion_IdAndAssignmentItemIsNullAndSubmittedBy_IdAndSubjectContext_SubjectUser_IdAndStatusOrderByCreatedAtDesc(
            Long formVersionId, Long submittedById, Long subjectUserId, FormSubmissionStatus status);

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

    @EntityGraph(attributePaths = {
            "formVersion", "formVersion.form", "submittedBy", "subjectContext",
            "subjectContext.subjectUser", "subjectContext.subjectUser.department"
    })
    @Query("""
            select s from FormSubmission s
            left join s.subjectContext context
            left join context.subjectUser subject
            where s.formVersion.form.id = :formId
              and s.formVersion.id = :versionId
              and s.status = 'SUBMITTED'
              and (:keyword is null
                   or lower(context.fullName) like :keyword
                   or lower(context.employeeCode) like :keyword)
              and (:submittedByUserId is null or s.submittedBy.id = :submittedByUserId)
              and (:departmentId is null or subject.department.id = :departmentId)
              and (:filterDepartmentIds = false or subject.department.id in :departmentIds)
              and (:filterResults = false or s.result in :results)
              and s.submittedAt >= :fromInclusive
              and s.submittedAt < :toExclusive
            order by s.submittedAt desc, s.id desc
            """)
    Page<FormSubmission> searchHistoryByFormVersion(
            @Param("formId") Long formId,
            @Param("versionId") Long versionId,
            @Param("keyword") String keyword,
            @Param("submittedByUserId") Long submittedByUserId,
            @Param("departmentId") Long departmentId,
            @Param("filterDepartmentIds") boolean filterDepartmentIds,
            @Param("departmentIds") Collection<Long> departmentIds,
            @Param("filterResults") boolean filterResults,
            @Param("results") Collection<FormSubmissionResult> results,
            @Param("fromInclusive") Instant fromInclusive,
            @Param("toExclusive") Instant toExclusive,
            Pageable pageable
    );

    @Query("""
            select count(s.id) as total,
                   coalesce(sum(case when s.result = :passedResult then 1 else 0 end), 0) as passed,
                   coalesce(sum(case when s.result in :failedResults then 1 else 0 end), 0) as failed,
                   avg(s.convertedScore) as averageConvertedScore
            from FormSubmission s
            left join s.subjectContext context
            left join context.subjectUser subject
            where s.formVersion.form.id = :formId
              and s.formVersion.id = :versionId
              and s.status = 'SUBMITTED'
              and (:keyword is null
                   or lower(context.fullName) like :keyword
                   or lower(context.employeeCode) like :keyword)
              and (:submittedByUserId is null or s.submittedBy.id = :submittedByUserId)
              and (:departmentId is null or subject.department.id = :departmentId)
              and (:filterDepartmentIds = false or subject.department.id in :departmentIds)
              and (:filterResults = false or s.result in :results)
              and s.submittedAt >= :fromInclusive
              and s.submittedAt < :toExclusive
            """)
    FormSubmissionHistorySummaryProjection summarizeHistoryByFormVersion(
            @Param("formId") Long formId,
            @Param("versionId") Long versionId,
            @Param("keyword") String keyword,
            @Param("submittedByUserId") Long submittedByUserId,
            @Param("departmentId") Long departmentId,
            @Param("filterDepartmentIds") boolean filterDepartmentIds,
            @Param("departmentIds") Collection<Long> departmentIds,
            @Param("filterResults") boolean filterResults,
            @Param("results") Collection<FormSubmissionResult> results,
            @Param("fromInclusive") Instant fromInclusive,
            @Param("toExclusive") Instant toExclusive,
            @Param("passedResult") FormSubmissionResult passedResult,
            @Param("failedResults") Collection<FormSubmissionResult> failedResults
    );

    @EntityGraph(attributePaths = {
            "formVersion", "formVersion.form", "submittedBy", "subjectContext",
            "subjectContext.subjectUser", "subjectContext.subjectUser.department"
    })
    @Query("""
            select s from FormSubmission s
            left join s.subjectContext context
            left join context.subjectUser subject
            where (:formId is null or s.formVersion.form.id = :formId)
              and s.status = 'SUBMITTED'
              and (:keyword is null
                   or lower(context.fullName) like :keyword
                   or lower(context.employeeCode) like :keyword
                   or lower(s.formVersion.form.title) like :keyword
                   or lower(s.formVersion.form.code) like :keyword)
              and (:submittedByUserId is null or s.submittedBy.id = :submittedByUserId)
              and (:departmentId is null
                   or subject.department.id = :departmentId
                   or (context.department is not null and exists (
                       select 1 from vn.vietduc.carehubbackend.user.entity.Department d
                       where d.id = :departmentId and d.name = context.department
                   )))
              and (:filterResults = false or s.result in :results)
              and s.submittedAt >= :fromInclusive
              and s.submittedAt < :toExclusive
            order by s.submittedAt desc, s.id desc
            """)
    Page<FormSubmission> searchEvaluationsHistory(
            @Param("formId") Long formId,
            @Param("keyword") String keyword,
            @Param("submittedByUserId") Long submittedByUserId,
            @Param("departmentId") Long departmentId,
            @Param("filterResults") boolean filterResults,
            @Param("results") Collection<FormSubmissionResult> results,
            @Param("fromInclusive") Instant fromInclusive,
            @Param("toExclusive") Instant toExclusive,
            Pageable pageable
    );

    @Query("""
            select count(s.id) as total,
                   coalesce(sum(case when s.result = :passedResult then 1 else 0 end), 0) as passed,
                   coalesce(sum(case when s.result in :failedResults then 1 else 0 end), 0) as failed,
                   avg(s.convertedScore) as averageConvertedScore
            from FormSubmission s
            left join s.subjectContext context
            left join context.subjectUser subject
            where (:formId is null or s.formVersion.form.id = :formId)
              and s.status = 'SUBMITTED'
              and (:keyword is null
                   or lower(context.fullName) like :keyword
                   or lower(context.employeeCode) like :keyword
                   or lower(s.formVersion.form.title) like :keyword
                   or lower(s.formVersion.form.code) like :keyword)
              and (:submittedByUserId is null or s.submittedBy.id = :submittedByUserId)
              and (:departmentId is null
                   or subject.department.id = :departmentId
                   or (context.department is not null and exists (
                       select 1 from vn.vietduc.carehubbackend.user.entity.Department d
                       where d.id = :departmentId and d.name = context.department
                   )))
              and (:filterResults = false or s.result in :results)
              and s.submittedAt >= :fromInclusive
              and s.submittedAt < :toExclusive
            """)
    FormSubmissionHistorySummaryProjection summarizeEvaluationsHistory(
            @Param("formId") Long formId,
            @Param("keyword") String keyword,
            @Param("submittedByUserId") Long submittedByUserId,
            @Param("departmentId") Long departmentId,
            @Param("filterResults") boolean filterResults,
            @Param("results") Collection<FormSubmissionResult> results,
            @Param("fromInclusive") Instant fromInclusive,
            @Param("toExclusive") Instant toExclusive,
            @Param("passedResult") FormSubmissionResult passedResult,
            @Param("failedResults") Collection<FormSubmissionResult> failedResults
    );

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

    @EntityGraph(attributePaths = {
            "formVersion", "formVersion.form", "submittedBy", "subjectContext",
            "subjectContext.subjectUser", "subjectContext.subjectUser.department",
            "answers", "answers.question", "answers.question.section", "answers.selectedOption"
    })
    @Query("""
            select distinct s from FormSubmission s
            left join s.subjectContext context
            left join context.subjectUser subject
            where s.formVersion.form.id = :formId
              and s.formVersion.id = :versionId
              and s.status = 'SUBMITTED'
              and (:keyword is null
                   or lower(context.fullName) like :keyword
                   or lower(context.employeeCode) like :keyword)
              and (:submittedByUserId is null or s.submittedBy.id = :submittedByUserId)
              and (:departmentId is null or subject.department.id = :departmentId)
              and (:filterResults = false or s.result in :results)
              and s.submittedAt >= :fromInclusive
              and s.submittedAt < :toExclusive
            order by s.submittedAt desc, s.id desc
            """)
    List<FormSubmission> findHistoryForVersionExport(
            @Param("formId") Long formId,
            @Param("versionId") Long versionId,
            @Param("keyword") String keyword,
            @Param("submittedByUserId") Long submittedByUserId,
            @Param("departmentId") Long departmentId,
            @Param("filterResults") boolean filterResults,
            @Param("results") Collection<FormSubmissionResult> results,
            @Param("fromInclusive") Instant fromInclusive,
            @Param("toExclusive") Instant toExclusive
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
