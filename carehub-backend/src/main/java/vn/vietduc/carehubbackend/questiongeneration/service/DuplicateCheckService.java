package vn.vietduc.carehubbackend.questiongeneration.service;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import vn.vietduc.carehubbackend.common.util.CosineUtil;
import vn.vietduc.carehubbackend.questiongeneration.config.AiEmbeddingProperties;
import vn.vietduc.carehubbackend.questiongeneration.config.ValidationRulesProperties;
import vn.vietduc.carehubbackend.questiongeneration.embedding.AnnEmbeddingIndex;
import vn.vietduc.carehubbackend.questiongeneration.embedding.EmbeddingCache;
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
    private final EmbeddingCache embeddingCache;
    private final AnnEmbeddingIndex annIndex;
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
        String checker = "e5";

        List<QuestionEmbeddingSnapshot> embeddings = embeddingCache.approvedStemEmbeddings();
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

        // Thử ANN search trước nếu index sẵn sàng
        if (annIndex.isReady()) {
            AnnEmbeddingIndex.SearchResult annBest = annIndex.searchBestMatch(
                    candidateVector,
                    properties.getDuplicate().getReviewMin(),
                    embeddingProperties.getAnnSearchK()
            );
            if (annBest != null && !excludedQuestionIds.contains(annBest.questionId())) {
                best = annBest.similarity();
                matchedId = annBest.questionId();
                matchedStem = annBest.stem();
                checker = "e5-ann";
            }

            // Chỉ fallback exact khi ANN không tìm thấy gì hoặc best dưới reviewMin
            // (nếu ANN đã tìm thấy match ≥ reviewMin thì đủ để đánh dấu needsReview, không cần exact)
            if (annBest == null || best < properties.getDuplicate().getReviewMin()) {
                for (QuestionEmbeddingSnapshot embedding : embeddings) {
                    if (excludedQuestionIds.contains(embedding.questionId())) {
                        continue;
                    }
                    double score = CosineUtil.cosine(candidateVector, embedding.vector());
                    if (score > best) {
                        best = score;
                        matchedId = embedding.questionId();
                        matchedStem = embedding.stem();
                    }
                    if (best >= properties.getDuplicate().getStrongMin()) {
                        checker = "e5-exact";
                        break;
                    }
                }
            }
        } else {
            // Exact search (ANN chưa sẵn sàng)
            for (QuestionEmbeddingSnapshot embedding : embeddings) {
                if (excludedQuestionIds.contains(embedding.questionId())) {
                    continue;
                }
                double score = CosineUtil.cosine(candidateVector, embedding.vector());
                if (score > best) {
                    best = score;
                    matchedId = embedding.questionId();
                    matchedStem = embedding.stem();
                }
                if (best >= properties.getDuplicate().getStrongMin()) {
                    break;
                }
            }
        }

        // Chỉ lexical candidate check nếu chưa strong duplicate
        if (best < properties.getDuplicate().getStrongMin()) {
            DuplicateCheckResult candidateBatchDuplicate = lexicalCandidateCheck(stem, excludedCandidateIds);
            if (candidateBatchDuplicate.maxSimilarity() > best) {
                return candidateBatchDuplicate;
            }
        }
        return new DuplicateCheckResult(
                best,
                matchedId,
                matchedStem,
                best >= properties.getDuplicate().getStrongMin(),
                best >= properties.getDuplicate().getReviewMin(),
                null,
                checker
        );
    }

    private DuplicateCheckResult lexicalCheck(String stem, Set<Long> excludedQuestionIds, Set<Long> excludedCandidateIds) {
        double best = 0;
        Long matchedId = null;
        String matchedStem = null;
        int page = 0;
        int pageSize = Math.max(1, embeddingProperties.getLexicalPageSize());

        // Paginate qua toàn bộ approved questions
        List<QuestionBankQuestion> questionPage;
        do {
            questionPage = questionRepository.findByStatus(
                    QuestionBankStatus.APPROVED, PageRequest.of(page++, pageSize));
            for (QuestionBankQuestion question : questionPage) {
                if (excludedQuestionIds.contains(question.getId())) {
                    continue;
                }
                double score = similarity(stem, question.getStem());
                if (score > best) {
                    best = score;
                    matchedId = question.getId();
                    matchedStem = question.getStem();
                }
                if (best >= properties.getDuplicate().getStrongMin()) {
                    break;
                }
            }
        } while (!questionPage.isEmpty() && questionPage.size() == pageSize
                && best < properties.getDuplicate().getStrongMin());

        // Paginate qua toàn bộ comparable candidates
        if (best < properties.getDuplicate().getStrongMin()) {
            int candidatePage = 0;
            List<DocumentQuestionCandidate> candidatePageResult;
            do {
                candidatePageResult = candidateRepository.findByStatusIn(
                        COMPARABLE_CANDIDATE_STATUSES, PageRequest.of(candidatePage++, pageSize));
                for (DocumentQuestionCandidate candidate : candidatePageResult) {
                    if (excludedCandidateIds.contains(candidate.getId())) {
                        continue;
                    }
                    double score = similarity(stem, candidate.getStem());
                    if (score > best) {
                        best = score;
                        matchedId = candidate.getId();
                        matchedStem = candidate.getStem();
                    }
                    if (best >= properties.getDuplicate().getStrongMin()) {
                        break;
                    }
                }
            } while (!candidatePageResult.isEmpty() && candidatePageResult.size() == pageSize
                    && best < properties.getDuplicate().getStrongMin());
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
        int page = 0;
        int pageSize = Math.max(1, embeddingProperties.getLexicalPageSize());

        List<DocumentQuestionCandidate> candidatePage;
        do {
            candidatePage = candidateRepository.findByStatusIn(
                    COMPARABLE_CANDIDATE_STATUSES, PageRequest.of(page++, pageSize));
            for (DocumentQuestionCandidate candidate : candidatePage) {
                if (excludedCandidateIds.contains(candidate.getId())) {
                    continue;
                }
                double score = similarity(stem, candidate.getStem());
                if (score > best) {
                    best = score;
                    matchedId = candidate.getId();
                    matchedStem = candidate.getStem();
                }
                if (best >= properties.getDuplicate().getStrongMin()) {
                    break;
                }
            }
        } while (!candidatePage.isEmpty() && candidatePage.size() == pageSize
                && best < properties.getDuplicate().getStrongMin());

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
