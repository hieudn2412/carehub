package vn.vietduc.carehubbackend.questiongeneration.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vn.vietduc.carehubbackend.questiongeneration.entity.ParaphraseCandidate;
import vn.vietduc.carehubbackend.questiongeneration.entity.ParaphraseJob;

import java.util.List;

public interface ParaphraseCandidateRepository extends JpaRepository<ParaphraseCandidate, Long> {
    List<ParaphraseCandidate> findByJobOrderByIdAsc(ParaphraseJob job);
}
