package vn.vietduc.carehubbackend.questiongeneration.repository;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
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

    /** ORDER BY trong truy vấn — xem ghi chú ở {@code QuestionBankQuestionRepository.findByStatus}. */
    @Query("SELECT c FROM DocumentQuestionCandidate c WHERE c.status IN :statuses ORDER BY c.id")
    List<DocumentQuestionCandidate> findByStatusIn(
            @Param("statuses") Collection<CandidateStatus> statuses,
            Pageable pageable
    );

    List<DocumentQuestionCandidate> findByProfessionalFieldIsNullAndStatusInOrderByIdAsc(
            Collection<CandidateStatus> statuses,
            Pageable pageable
    );
}
