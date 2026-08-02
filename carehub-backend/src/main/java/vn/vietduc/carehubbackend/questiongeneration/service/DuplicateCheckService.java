package vn.vietduc.carehubbackend.questiongeneration.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
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
import vn.vietduc.carehubbackend.questiongeneration.service.model.DuplicateMatchResult;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Service
@Slf4j
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
        return check(stem, null, excludedQuestionIds, excludedCandidateIds);
    }

    /**
     * So sánh một câu với các câu đứng trước trong cùng response bằng đúng vector E5 đã batch.
     * Chỉ so với phần tử trước để kết quả ổn định và câu đầu tiên thắng khi hai câu trùng nhau.
     */
    public DuplicateCheckResult checkWithinBatch(
            List<String> stems,
            double[][] vectors,
            int candidateIndex
    ) {
        if (candidateIndex <= 0 || vectors == null || candidateIndex >= vectors.length
                || vectors[candidateIndex] == null) {
            return new DuplicateCheckResult(0, null, null, false, false, null, "e5-batch");
        }
        double best = 0;
        String matchedStem = null;
        for (int index = 0; index < candidateIndex && index < vectors.length; index++) {
            if (vectors[index] == null) {
                continue;
            }
            double similarity = CosineUtil.cosine(vectors[candidateIndex], vectors[index]);
            if (similarity > best) {
                best = similarity;
                matchedStem = stems.get(index);
            }
        }
        return new DuplicateCheckResult(
                best,
                null,
                matchedStem,
                best >= properties.getDuplicate().getStrongMin(),
                best >= properties.getDuplicate().getReviewMin(),
                best >= properties.getDuplicate().getReviewMin()
                        ? "Có khả năng trùng với câu khác trong cùng response"
                        : null,
                "e5-batch"
        );
    }

    public List<DuplicateMatchResult> findPotentialMatches(
            String stem,
            Set<Long> excludedQuestionIds,
            Set<Long> excludedCandidateIds,
            int limit
    ) {
        if (stem == null || stem.isBlank() || limit <= 0) {
            return List.of();
        }
        List<DuplicateMatchResult> matches = new ArrayList<>();
        if (embeddingProperties.isE5Provider()) {
            try {
                double[] candidateVector = questionEmbeddingService.embedCandidateStem(stem);
                List<QuestionEmbeddingSnapshot> embeddings = embeddingCache.approvedStemEmbeddings();
                if (embeddings.isEmpty()) {
                    collectLexicalQuestionMatches(stem, excludedQuestionIds, matches);
                } else {
                    collectSemanticQuestionMatches(candidateVector, embeddings, excludedQuestionIds, matches);
                }
            } catch (RuntimeException ex) {
                log.warn("Không lấy được danh sách câu trùng ngữ nghĩa, dùng kiểm tra từ khóa: {}", ex.getMessage());
                collectLexicalQuestionMatches(stem, excludedQuestionIds, matches);
            }
        } else {
            collectLexicalQuestionMatches(stem, excludedQuestionIds, matches);
        }
        collectLexicalCandidateMatches(stem, excludedCandidateIds, matches);
        return matches.stream()
                .sorted(Comparator.comparingDouble(DuplicateMatchResult::similarity).reversed()
                        .thenComparing(match -> match.sourceType().name())
                        .thenComparing(DuplicateMatchResult::sourceId))
                .limit(limit)
                .toList();
    }

    private void collectSemanticQuestionMatches(
            double[] candidateVector,
            List<QuestionEmbeddingSnapshot> embeddings,
            Set<Long> excludedQuestionIds,
            List<DuplicateMatchResult> matches
    ) {
        double reviewMin = properties.getDuplicate().getReviewMin();
        double strongMin = properties.getDuplicate().getStrongMin();
        for (QuestionEmbeddingSnapshot embedding : embeddings) {
            if (excludedQuestionIds.contains(embedding.questionId())) {
                continue;
            }
            double score = CosineUtil.cosine(candidateVector, embedding.vector());
            if (score >= reviewMin) {
                matches.add(new DuplicateMatchResult(
                        DuplicateMatchResult.SourceType.QUESTION_BANK,
                        embedding.questionId(),
                        embedding.stem(),
                        score,
                        score >= strongMin
                ));
            }
        }
    }

    private void collectLexicalQuestionMatches(
            String stem,
            Set<Long> excludedQuestionIds,
            List<DuplicateMatchResult> matches
    ) {
        int page = 0;
        int pageSize = Math.max(1, embeddingProperties.getLexicalPageSize());
        List<QuestionBankQuestion> questionPage;
        do {
            questionPage = questionRepository.findByStatus(
                    QuestionBankStatus.APPROVED,
                    PageRequest.of(page++, pageSize)
            );
            for (QuestionBankQuestion question : questionPage) {
                if (excludedQuestionIds.contains(question.getId())) {
                    continue;
                }
                addMatchIfPotential(
                        matches,
                        DuplicateMatchResult.SourceType.QUESTION_BANK,
                        question.getId(),
                        question.getStem(),
                        similarity(stem, question.getStem())
                );
            }
        } while (!questionPage.isEmpty() && questionPage.size() == pageSize);
    }

    private void collectLexicalCandidateMatches(
            String stem,
            Set<Long> excludedCandidateIds,
            List<DuplicateMatchResult> matches
    ) {
        int page = 0;
        int pageSize = Math.max(1, embeddingProperties.getLexicalPageSize());
        List<DocumentQuestionCandidate> candidatePage;
        do {
            candidatePage = candidateRepository.findByStatusIn(
                    COMPARABLE_CANDIDATE_STATUSES,
                    PageRequest.of(page++, pageSize)
            );
            for (DocumentQuestionCandidate candidate : candidatePage) {
                if (excludedCandidateIds.contains(candidate.getId())) {
                    continue;
                }
                addMatchIfPotential(
                        matches,
                        DuplicateMatchResult.SourceType.DOCUMENT_CANDIDATE,
                        candidate.getId(),
                        candidate.getStem(),
                        similarity(stem, candidate.getStem())
                );
            }
        } while (!candidatePage.isEmpty() && candidatePage.size() == pageSize);
    }

    private void addMatchIfPotential(
            List<DuplicateMatchResult> matches,
            DuplicateMatchResult.SourceType sourceType,
            Long sourceId,
            String stem,
            double similarity
    ) {
        if (similarity < properties.getDuplicate().getReviewMin()) {
            return;
        }
        matches.add(new DuplicateMatchResult(
                sourceType,
                sourceId,
                stem,
                similarity,
                similarity >= properties.getDuplicate().getStrongMin()
        ));
    }

    /**
     * Nhúng sẵn cả một lô stem trong một lần chạy model, để nơi gọi khỏi phải nhúng từng câu.
     *
     * @return mảng vector theo đúng thứ tự đầu vào, hoặc {@code null} nếu không dùng embedding
     *         (provider không phải E5) hoặc model lỗi — nơi gọi cứ truyền {@code null} vào
     *         {@link #check(String, double[], Set, Set)} và luồng cũ vẫn chạy bình thường.
     */
    public double[][] precomputeVectors(List<String> stems) {
        if (!embeddingProperties.isE5Provider() || stems == null || stems.isEmpty()) {
            return null;
        }
        try {
            List<double[]> vectors = questionEmbeddingService.embedCandidateStems(stems);
            return vectors.size() == stems.size() ? vectors.toArray(double[][]::new) : null;
        } catch (RuntimeException ex) {
            log.warn("Không nhúng được lô {} stem, quay lại nhúng từng câu: {}", stems.size(), ex.getMessage());
            return null;
        }
    }

    /**
     * @param precomputedVector vector đã nhúng sẵn cho {@code stem}, hoặc {@code null} để tự nhúng.
     */
    public DuplicateCheckResult check(
            String stem,
            double[] precomputedVector,
            Set<Long> excludedQuestionIds,
            Set<Long> excludedCandidateIds
    ) {
        if (embeddingProperties.isE5Provider()) {
            try {
                return semanticCheck(stem, precomputedVector, excludedQuestionIds, excludedCandidateIds);
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

    private DuplicateCheckResult semanticCheck(
            String stem,
            double[] precomputedVector,
            Set<Long> excludedQuestionIds,
            Set<Long> excludedCandidateIds
    ) {
        double[] candidateVector = precomputedVector != null
                ? precomputedVector
                : questionEmbeddingService.embedCandidateStem(stem);
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

        double strongMin = properties.getDuplicate().getStrongMin();

        // Thử ANN search trước nếu index sẵn sàng
        if (annIndex.isReady()) {
            // Ngưỡng dừng sớm phải là strongMin: dừng ở reviewMin sẽ trả về match ĐẦU TIÊN
            // vượt 0.80 thay vì match tốt nhất, khiến câu trùng mạnh bị hạ thành NEED_REVIEW.
            AnnEmbeddingIndex.SearchResult annBest = annIndex.searchBestMatch(
                    candidateVector,
                    strongMin,
                    embeddingProperties.getAnnSearchK()
            );
            if (annBest != null && !excludedQuestionIds.contains(annBest.questionId())) {
                best = annBest.similarity();
                matchedId = annBest.questionId();
                matchedStem = annBest.stem();
                checker = "e5-ann";
            }

            // ANN chỉ quét một phần index (bucket LSH + hàng xóm, tối đa annSearchK ứng viên),
            // nên khi chưa chắc chắn trùng mạnh vẫn phải quét đầy đủ để không bỏ sót.
            if (best < strongMin) {
                checker = "e5-exact";
                ExactScan scan = exactScan(candidateVector, embeddings, excludedQuestionIds, best, strongMin);
                if (scan.similarity() > best) {
                    best = scan.similarity();
                    matchedId = scan.questionId();
                    matchedStem = scan.stem();
                }
            }
        } else {
            // Exact search (ANN chưa sẵn sàng) — giữ nhãn "e5" để phân biệt với đường có ANN.
            ExactScan scan = exactScan(candidateVector, embeddings, excludedQuestionIds, best, strongMin);
            best = scan.similarity();
            matchedId = scan.questionId();
            matchedStem = scan.stem();
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

    /** Quét cosine đầy đủ trên tập embedding, dừng sớm khi đã chắc chắn là trùng mạnh. */
    private ExactScan exactScan(
            double[] candidateVector,
            List<QuestionEmbeddingSnapshot> embeddings,
            Set<Long> excludedQuestionIds,
            double startingBest,
            double strongMin
    ) {
        double best = startingBest;
        Long matchedId = null;
        String matchedStem = null;
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
            if (best >= strongMin) {
                break;
            }
        }
        return new ExactScan(best, matchedId, matchedStem);
    }

    private record ExactScan(double similarity, Long questionId, String stem) {
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
