package vn.vietduc.carehubbackend.questiongeneration.repository;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import vn.vietduc.carehubbackend.questiongeneration.entity.DocumentQuestionCandidate;
import vn.vietduc.carehubbackend.questiongeneration.entity.DocumentQuestionJob;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.CandidateStatus;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface DocumentQuestionCandidateRepository extends JpaRepository<DocumentQuestionCandidate, Long> {
    List<DocumentQuestionCandidate> findByJobOrderByIdAsc(DocumentQuestionJob job);

    Optional<DocumentQuestionCandidate> findFirstByGenerationKeyAndStatusIn(
            String generationKey,
            Collection<CandidateStatus> statuses
    );

    /** @deprecated use {@link #findByStatusIn(Collection, Pageable)} with pagination instead */
    @Deprecated
    List<DocumentQuestionCandidate> findTop100ByStatusIn(Collection<CandidateStatus> statuses);

    List<DocumentQuestionCandidate> findByStatusIn(Collection<CandidateStatus> statuses, Pageable pageable);
}
