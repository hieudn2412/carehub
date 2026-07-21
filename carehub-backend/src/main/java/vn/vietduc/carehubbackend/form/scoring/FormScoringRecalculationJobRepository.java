package vn.vietduc.carehubbackend.form.scoring;

import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.*;

public interface FormScoringRecalculationJobRepository
        extends JpaRepository<FormScoringRecalculationJob, Long> {
    boolean existsByFormVersion_IdAndStatusIn(Long versionId,
                                              Collection<FormScoringRecalculationStatus> statuses);

    Optional<FormScoringRecalculationJob> findFirstByFormVersion_IdOrderByCreatedAtDesc(Long versionId);

    List<FormScoringRecalculationJob> findByStatusOrderByCreatedAtAsc(
            FormScoringRecalculationStatus status, Pageable pageable);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select job from FormScoringRecalculationJob job where job.id = :id")
    Optional<FormScoringRecalculationJob> findByIdForUpdate(@Param("id") Long id);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            update FormScoringRecalculationJob job
               set job.status = :pending, job.startedAt = null,
                   job.errorMessage = 'Tác vụ được khôi phục sau khi tiến trình bị gián đoạn'
             where job.status = :running and job.startedAt < :cutoff
            """)
    int recoverStale(@Param("running") FormScoringRecalculationStatus running,
                     @Param("pending") FormScoringRecalculationStatus pending,
                     @Param("cutoff") Instant cutoff);
}
