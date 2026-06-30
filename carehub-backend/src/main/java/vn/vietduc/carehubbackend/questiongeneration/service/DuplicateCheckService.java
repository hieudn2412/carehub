package vn.vietduc.carehubbackend.questiongeneration.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import vn.vietduc.carehubbackend.questiongeneration.config.ValidationRulesProperties;
import vn.vietduc.carehubbackend.questiongeneration.entity.DocumentQuestionCandidate;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionBankQuestion;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.CandidateStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionBankStatus;
import vn.vietduc.carehubbackend.questiongeneration.repository.DocumentQuestionCandidateRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.QuestionBankQuestionRepository;
import vn.vietduc.carehubbackend.questiongeneration.service.model.DuplicateCheckResult;

import java.text.Normalizer;
import java.util.Arrays;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class DuplicateCheckService {
    private static final Collection<CandidateStatus> COMPARABLE_CANDIDATE_STATUSES = List.of(
            CandidateStatus.VALIDATED,
            CandidateStatus.NEED_REVIEW,
            CandidateStatus.APPROVED,
            CandidateStatus.SAVED
    );

    private final DocumentQuestionCandidateRepository candidateRepository;
    private final QuestionBankQuestionRepository questionRepository;
    private final ValidationRulesProperties properties;

    public DuplicateCheckResult check(String stem) {
        double best = 0;
        Long matchedId = null;
        String matchedStem = null;

        for (QuestionBankQuestion question : questionRepository.findTop100ByStatus(QuestionBankStatus.APPROVED)) {
            double score = similarity(stem, question.getStem());
            if (score > best) {
                best = score;
                matchedId = question.getId();
                matchedStem = question.getStem();
            }
        }
        for (DocumentQuestionCandidate candidate : candidateRepository.findTop100ByStatusIn(COMPARABLE_CANDIDATE_STATUSES)) {
            double score = similarity(stem, candidate.getStem());
            if (score > best) {
                best = score;
                matchedId = candidate.getId();
                matchedStem = candidate.getStem();
            }
        }

        return new DuplicateCheckResult(
                best,
                matchedId,
                matchedStem,
                best >= properties.getDuplicate().getStrongMin(),
                best >= properties.getDuplicate().getReviewMin()
        );
    }

    private double similarity(String left, String right) {
        Set<String> a = tokenSet(left);
        Set<String> b = tokenSet(right);
        if (a.isEmpty() || b.isEmpty()) {
            return 0;
        }
        Set<String> intersection = new HashSet<>(a);
        intersection.retainAll(b);
        Set<String> union = new HashSet<>(a);
        union.addAll(b);
        return (double) intersection.size() / union.size();
    }

    private Set<String> tokenSet(String text) {
        String normalized = Normalizer.normalize(text == null ? "" : text, Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "")
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^\\p{L}\\p{N}\\s]", " ")
                .replaceAll("\\s+", " ")
                .trim();
        if (normalized.isBlank()) {
            return Set.of();
        }
        return new HashSet<>(Arrays.asList(normalized.split("\\s+")));
    }
}
