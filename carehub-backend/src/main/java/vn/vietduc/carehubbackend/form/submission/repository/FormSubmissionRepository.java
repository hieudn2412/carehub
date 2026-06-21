package vn.vietduc.carehubbackend.form.submission.repository;

import jakarta.persistence.LockModeType;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import vn.vietduc.carehubbackend.form.submission.entity.*;

import java.util.Optional;

public interface FormSubmissionRepository extends JpaRepository<FormSubmission, Long> {
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

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from FormSubmission s where s.id = :id")
    Optional<FormSubmission> findByIdForUpdate(@Param("id") Long id);
}
