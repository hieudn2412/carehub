package vn.vietduc.carehubbackend.questiongeneration.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import vn.vietduc.carehubbackend.questiongeneration.config.AiEmbeddingProperties;
import vn.vietduc.carehubbackend.questiongeneration.config.ValidationRulesProperties;
import vn.vietduc.carehubbackend.questiongeneration.embedding.QuestionEmbeddingService;
import vn.vietduc.carehubbackend.questiongeneration.embedding.QuestionEmbeddingSnapshot;
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
    private final QuestionEmbeddingService questionEmbeddingService;
    private final AiEmbeddingProperties embeddingProperties;
    private final ValidationRulesProperties properties;

    public DuplicateCheckResult check(String stem) {
        return check(stem, Set.of(), Set.of());
    }

    public DuplicateCheckResult check(String stem, Set<Long> excludedQuestionIds) {
        return check(stem, excludedQuestionIds, Set.of());
    }

    public DuplicateCheckResult check(String stem, Set<Long> excludedQuestionIds, Set<Long> excludedCandidateIds) {
        if (embeddingProperties.isE5Provider()) {
            try {
                return semanticCheck(stem, excludedQuestionIds, excludedCandidateIds);
            } catch (RuntimeException ex) {
                DuplicateCheckResult fallback = lexicalCheck(stem, excludedQuestionIds, excludedCandidateIds);
                return new DuplicateCheckResult(
                        fallback.maxSimilarity(),
                        fallback.matchedQuestionId(),
                        fallback.matchedQuestionStem(),
                        fallback.strongDuplicate(),
                        fallback.needsReview(),
                        "Không chạy được kiểm tra trùng ngữ nghĩa, đã dùng kiểm tra từ khóa",
                        "lexical-fallback"
                );
            }
        }
        return lexicalCheck(stem, excludedQuestionIds, excludedCandidateIds);
    }

    private DuplicateCheckResult semanticCheck(String stem, Set<Long> excludedQuestionIds, Set<Long> excludedCandidateIds) {
        double[] candidateVector = questionEmbeddingService.embedCandidateStem(stem);
        double best = 0;
        Long matchedId = null;
        String matchedStem = null;

        List<QuestionEmbeddingSnapshot> embeddings = questionEmbeddingService.approvedStemEmbeddings();
        if (embeddings.isEmpty()) {
            DuplicateCheckResult fallback = lexicalCheck(stem, excludedQuestionIds, excludedCandidateIds);
            return new DuplicateCheckResult(
                    fallback.maxSimilarity(),
                    fallback.matchedQuestionId(),
                    fallback.matchedQuestionStem(),
                    fallback.strongDuplicate(),
                    fallback.needsReview(),
                    "Chưa có embedding E5 trong ngân hàng câu hỏi, đã dùng kiểm tra từ khóa",
                    "lexical-fallback"
            );
        }

        for (QuestionEmbeddingSnapshot embedding : embeddings) {
            if (excludedQuestionIds.contains(embedding.questionId())) {
                continue;
            }
            double score = cosine(candidateVector, embedding.vector());
            if (score > best) {
                best = score;
                matchedId = embedding.questionId();
                matchedStem = embedding.stem();
            }
        }

        DuplicateCheckResult candidateBatchDuplicate = lexicalCandidateCheck(stem, excludedCandidateIds);
        if (candidateBatchDuplicate.maxSimilarity() > best) {
            return candidateBatchDuplicate;
        }
        return new DuplicateCheckResult(
                best,
                matchedId,
                matchedStem,
                best >= properties.getDuplicate().getStrongMin(),
                best >= properties.getDuplicate().getReviewMin(),
                null,
                "e5"
        );
    }

    private DuplicateCheckResult lexicalCheck(String stem, Set<Long> excludedQuestionIds, Set<Long> excludedCandidateIds) {
        double best = 0;
        Long matchedId = null;
        String matchedStem = null;

        for (QuestionBankQuestion question : questionRepository.findTop100ByStatus(QuestionBankStatus.APPROVED)) {
            if (excludedQuestionIds.contains(question.getId())) {
                continue;
            }
            double score = similarity(stem, question.getStem());
            if (score > best) {
                best = score;
                matchedId = question.getId();
                matchedStem = question.getStem();
            }
        }
        for (DocumentQuestionCandidate candidate : candidateRepository.findTop100ByStatusIn(COMPARABLE_CANDIDATE_STATUSES)) {
            if (excludedCandidateIds.contains(candidate.getId())) {
                continue;
            }
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

    private DuplicateCheckResult lexicalCandidateCheck(String stem, Set<Long> excludedCandidateIds) {
        double best = 0;
        Long matchedId = null;
        String matchedStem = null;
        for (DocumentQuestionCandidate candidate : candidateRepository.findTop100ByStatusIn(COMPARABLE_CANDIDATE_STATUSES)) {
            if (excludedCandidateIds.contains(candidate.getId())) {
                continue;
            }
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
                best >= properties.getDuplicate().getReviewMin(),
                null,
                "lexical-candidate"
        );
    }

    public double similarity(String left, String right) {
        return lexicalSimilarity(left, right);
    }

    private double lexicalSimilarity(String left, String right) {
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

    private double cosine(double[] left, double[] right) {
        int size = Math.min(left.length, right.length);
        if (size == 0) {
            return 0;
        }
        double dot = 0;
        double leftNorm = 0;
        double rightNorm = 0;
        for (int i = 0; i < size; i++) {
            dot += left[i] * right[i];
            leftNorm += left[i] * left[i];
            rightNorm += right[i] * right[i];
        }
        if (leftNorm == 0 || rightNorm == 0) {
            return 0;
        }
        return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
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
