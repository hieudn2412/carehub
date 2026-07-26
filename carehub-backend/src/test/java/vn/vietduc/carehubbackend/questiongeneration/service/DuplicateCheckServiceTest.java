package vn.vietduc.carehubbackend.questiongeneration.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.data.domain.Pageable;
import vn.vietduc.carehubbackend.questiongeneration.config.AiEmbeddingProperties;
import vn.vietduc.carehubbackend.questiongeneration.config.ValidationRulesProperties;
import vn.vietduc.carehubbackend.questiongeneration.embedding.AnnEmbeddingIndex;
import vn.vietduc.carehubbackend.questiongeneration.embedding.EmbeddingCache;
import vn.vietduc.carehubbackend.questiongeneration.embedding.QuestionEmbeddingService;
import vn.vietduc.carehubbackend.questiongeneration.embedding.QuestionEmbeddingSnapshot;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionBankQuestion;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.CandidateStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionBankStatus;
import vn.vietduc.carehubbackend.questiongeneration.repository.DocumentQuestionCandidateRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.QuestionBankQuestionRepository;
import vn.vietduc.carehubbackend.questiongeneration.service.model.DuplicateCheckResult;

import java.util.Collection;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * L1 unit tests — sheet {@code DuplicateCheckService}, Test ID prefix {@code L1-DUP}.
 *
 * <p>Boundary references: BV-07 (duplicate.strong-min = 0.93) and BV-08 (duplicate.review-min = 0.80)
 * in SRS 4.5 Boundary Value Register.
 *
 * <p>Similarity is controlled exactly rather than approximately: {@code CosineUtil.cosine} is a plain
 * dot product (it assumes L2-normalised E5 vectors), so scoring a candidate {@code [1, 0]} against a
 * stored {@code [c, 0]} yields exactly {@code c}. That lets the boundary cases sit precisely on
 * strongMin / reviewMin instead of near them.
 */
class DuplicateCheckServiceTest {
    private static final double[] CANDIDATE_VECTOR = {1.0, 0.0};
    private static final String STEM = "Cần xác định người bệnh bằng mấy thông tin?";

    private final DocumentQuestionCandidateRepository candidateRepository =
            mock(DocumentQuestionCandidateRepository.class);
    private final QuestionBankQuestionRepository questionRepository = mock(QuestionBankQuestionRepository.class);
    private final QuestionEmbeddingService embeddingService = mock(QuestionEmbeddingService.class);
    private final EmbeddingCache embeddingCache = mock(EmbeddingCache.class);
    private final AnnEmbeddingIndex annIndex = mock(AnnEmbeddingIndex.class);
    private final AiEmbeddingProperties embeddingProperties = new AiEmbeddingProperties();
    private final ValidationRulesProperties validationProperties = new ValidationRulesProperties();
    private DuplicateCheckService service;

    @BeforeEach
    void setUp() {
        embeddingProperties.setProvider("e5");
        embeddingProperties.setAnnEnabled(false);
        service = new DuplicateCheckService(
                candidateRepository,
                questionRepository,
                embeddingService,
                embeddingCache,
                annIndex,
                embeddingProperties,
                validationProperties
        );
        when(candidateRepository.findByStatusIn(
                org.mockito.ArgumentMatchers.<Collection<CandidateStatus>>any(),
                any(Pageable.class)))
                .thenReturn(List.of());
        when(annIndex.isReady()).thenReturn(false);
    }

    // ── Block: configured thresholds (BV-07 / BV-08 / BV-09) ──────────────────

    @Test
    @DisplayName("L1-DUP-01 | BV-07/08/09: default thresholds are strongMin 0.93, reviewMin 0.80, qualityReject 0.55")
    void defaultThresholdsMatchTheBoundaryRegister() {
        ValidationRulesProperties defaults = new ValidationRulesProperties();

        assertThat(defaults.getDuplicate().getStrongMin()).isEqualTo(0.93);
        assertThat(defaults.getDuplicate().getReviewMin()).isEqualTo(0.80);
        assertThat(defaults.getQuality().getRejectMin()).isEqualTo(0.55);
    }

    // ── Block: semanticCheck() — BVA on strongMin / reviewMin ─────────────────

    @ParameterizedTest(name = "similarity={0} → strong={1}, review={2}")
    @CsvSource({
            "1.00, true,  true",   // identical stem
            "0.94, true,  true",   // BVA-Max+1: just above strongMin
            "0.93, true,  true",   // BVA-Max: exactly strongMin — inclusive
            "0.92, false, true",   // BVA-Max-1: just below strongMin, still needs review
            "0.81, false, true",   // inside the review band
            "0.80, false, true",   // BVA-Min: exactly reviewMin — inclusive
            "0.79, false, false",  // BVA-Min-1: just below reviewMin
            "0.00, false, false"   // no similarity at all
    })
    @DisplayName("L1-DUP-02 | BVA: strongDuplicate/needsReview flags across every threshold edge")
    void flagsFollowThresholdBoundaries(double similarity, boolean strong, boolean review) {
        when(embeddingService.embedCandidateStem(STEM)).thenReturn(CANDIDATE_VECTOR);
        when(embeddingCache.approvedStemEmbeddings()).thenReturn(List.of(
                new QuestionEmbeddingSnapshot(11L, "Câu hỏi tương tự", new double[]{similarity, 0.0})
        ));

        DuplicateCheckResult result = service.check(STEM);

        assertThat(result.maxSimilarity()).isCloseTo(similarity, within(1e-12));
        assertThat(result.strongDuplicate()).isEqualTo(strong);
        assertThat(result.needsReview()).isEqualTo(review);
        assertThat(result.checker()).isEqualTo("e5");
        assertThat(result.warning()).isNull();
    }

    @Test
    @DisplayName("L1-DUP-03 | EP-Valid: excluded source question is skipped, next best match is reported")
    void semanticCheckHonorsExcludedSourceQuestion() {
        when(embeddingService.embedCandidateStem(STEM)).thenReturn(CANDIDATE_VECTOR);
        when(embeddingCache.approvedStemEmbeddings()).thenReturn(List.of(
                new QuestionEmbeddingSnapshot(10L, "Nguồn gốc cần bỏ qua", new double[]{1.0, 0.0}),
                new QuestionEmbeddingSnapshot(11L, "Đối chiếu hai thông tin nhận diện người bệnh",
                        new double[]{0.96, 0.0})
        ));

        DuplicateCheckResult result = service.check(STEM, Set.of(10L));

        assertThat(result.checker()).isEqualTo("e5");
        assertThat(result.matchedQuestionId()).isEqualTo(11L);
        assertThat(result.maxSimilarity()).isCloseTo(0.96, within(1e-12));
        assertThat(result.strongDuplicate()).isTrue();
        assertThat(result.needsReview()).isTrue();
        assertThat(result.warning()).isNull();
    }

    @Test
    @DisplayName("L1-DUP-04 | EP-Valid: precomputed vector is used instead of re-embedding the stem")
    void precomputedVectorSkipsEmbeddingCall() {
        when(embeddingCache.approvedStemEmbeddings()).thenReturn(List.of(
                new QuestionEmbeddingSnapshot(11L, "Câu hỏi tương tự", new double[]{0.95, 0.0})
        ));

        DuplicateCheckResult result = service.check(STEM, CANDIDATE_VECTOR, Set.of(), Set.of());

        assertThat(result.maxSimilarity()).isCloseTo(0.95, within(1e-12));
        verify(embeddingService, never()).embedCandidateStem(anyString());
    }

    // ── Block: fallback paths ─────────────────────────────────────────────────

    @Test
    @DisplayName("L1-DUP-05 | EP-Invalid + Negative: embedding model failure → lexical fallback with warning")
    void semanticFailureFallsBackToLexicalCheckWithWarning() {
        when(embeddingService.embedCandidateStem(anyString()))
                .thenThrow(new IllegalStateException("model missing"));
        when(questionRepository.findByStatus(
                org.mockito.ArgumentMatchers.eq(QuestionBankStatus.APPROVED), any(Pageable.class)))
                .thenReturn(List.of(approvedQuestion(20L, "Cần xác định người bệnh bằng hai thông tin nhận diện")))
                .thenReturn(List.of());

        DuplicateCheckResult result = service.check("Cần xác định người bệnh bằng hai thông tin nhận diện");

        assertThat(result.checker()).isEqualTo("lexical-fallback");
        assertThat(result.warning()).contains("kiểm tra trùng ngữ nghĩa");
        assertThat(result.matchedQuestionId()).isEqualTo(20L);
        assertThat(result.maxSimilarity()).isEqualTo(1.0);
        assertThat(result.strongDuplicate()).isTrue();
    }

    @Test
    @DisplayName("L1-DUP-06 | BC-TRUE: empty embedding cache → lexical fallback with the 'no embedding' warning")
    void emptyEmbeddingCacheFallsBackToLexical() {
        when(embeddingService.embedCandidateStem(STEM)).thenReturn(CANDIDATE_VECTOR);
        when(embeddingCache.approvedStemEmbeddings()).thenReturn(List.of());
        when(questionRepository.findByStatus(
                org.mockito.ArgumentMatchers.eq(QuestionBankStatus.APPROVED), any(Pageable.class)))
                .thenReturn(List.of());

        DuplicateCheckResult result = service.check(STEM);

        assertThat(result.checker()).isEqualTo("lexical-fallback");
        assertThat(result.warning()).contains("Chưa có embedding E5");
    }

    @Test
    @DisplayName("L1-DUP-07 | BC-FALSE: non-E5 provider goes straight to the lexical checker")
    void nonE5ProviderUsesLexicalCheckerDirectly() {
        embeddingProperties.setProvider("lexical");
        when(questionRepository.findByStatus(
                org.mockito.ArgumentMatchers.eq(QuestionBankStatus.APPROVED), any(Pageable.class)))
                .thenReturn(List.of(approvedQuestion(20L, "Một câu hỏi hoàn toàn khác")));

        DuplicateCheckResult result = service.check(STEM);

        assertThat(result.checker()).isEqualTo("lexical");
        verify(embeddingService, never()).embedCandidateStem(anyString());
        verify(embeddingCache, never()).approvedStemEmbeddings();
    }

    // ── Block: ANN search path ────────────────────────────────────────────────

    @Test
    @DisplayName("L1-DUP-08 | BC-TRUE: ANN returns a strong match → checker e5-ann, exact scan skipped")
    void annStrongMatchShortCircuitsExactScan() {
        when(annIndex.isReady()).thenReturn(true);
        when(embeddingService.embedCandidateStem(STEM)).thenReturn(CANDIDATE_VECTOR);
        when(embeddingCache.approvedStemEmbeddings()).thenReturn(List.of(
                new QuestionEmbeddingSnapshot(11L, "Câu trong index", new double[]{0.99, 0.0})
        ));
        when(annIndex.searchBestMatch(any(double[].class), anyDouble(), anyInt()))
                .thenReturn(new AnnEmbeddingIndex.SearchResult(
                        42L, "Câu ANN tìm được", 0.97, new double[]{0.97, 0.0}));

        DuplicateCheckResult result = service.check(STEM);

        assertThat(result.checker()).isEqualTo("e5-ann");
        assertThat(result.matchedQuestionId()).isEqualTo(42L);
        assertThat(result.maxSimilarity()).isCloseTo(0.97, within(1e-12));
        assertThat(result.strongDuplicate()).isTrue();
    }

    @Test
    @DisplayName("L1-DUP-09 | BC-FALSE: ANN match below strongMin → full exact scan runs, checker e5-exact")
    void annWeakMatchFallsThroughToExactScan() {
        when(annIndex.isReady()).thenReturn(true);
        when(embeddingService.embedCandidateStem(STEM)).thenReturn(CANDIDATE_VECTOR);
        when(embeddingCache.approvedStemEmbeddings()).thenReturn(List.of(
                new QuestionEmbeddingSnapshot(11L, "Câu trùng mạnh chỉ có trong exact scan",
                        new double[]{0.98, 0.0})
        ));
        when(annIndex.searchBestMatch(any(double[].class), anyDouble(), anyInt()))
                .thenReturn(new AnnEmbeddingIndex.SearchResult(
                        42L, "Câu ANN yếu", 0.85, new double[]{0.85, 0.0}));

        DuplicateCheckResult result = service.check(STEM);

        assertThat(result.checker()).isEqualTo("e5-exact");
        assertThat(result.matchedQuestionId()).isEqualTo(11L);
        assertThat(result.maxSimilarity()).isCloseTo(0.98, within(1e-12));
    }

    @Test
    @DisplayName("L1-DUP-10 | Guard-FALSE: ANN hit on an excluded question is discarded")
    void annMatchOnExcludedQuestionIsDiscarded() {
        when(annIndex.isReady()).thenReturn(true);
        when(embeddingService.embedCandidateStem(STEM)).thenReturn(CANDIDATE_VECTOR);
        when(embeddingCache.approvedStemEmbeddings()).thenReturn(List.of(
                new QuestionEmbeddingSnapshot(11L, "Câu hợp lệ", new double[]{0.90, 0.0})
        ));
        when(annIndex.searchBestMatch(any(double[].class), anyDouble(), anyInt()))
                .thenReturn(new AnnEmbeddingIndex.SearchResult(
                        42L, "Câu bị loại trừ", 0.99, new double[]{0.99, 0.0}));

        DuplicateCheckResult result = service.check(STEM, Set.of(42L));

        assertThat(result.matchedQuestionId()).isEqualTo(11L);
        assertThat(result.maxSimilarity()).isCloseTo(0.90, within(1e-12));
        assertThat(result.strongDuplicate()).isFalse();
    }

    @Test
    @DisplayName("L1-DUP-11 | BC-FALSE: ANN returns nothing → exact scan supplies the match")
    void annNoMatchFallsBackToExactScan() {
        when(annIndex.isReady()).thenReturn(true);
        when(embeddingService.embedCandidateStem(STEM)).thenReturn(CANDIDATE_VECTOR);
        when(embeddingCache.approvedStemEmbeddings()).thenReturn(List.of(
                new QuestionEmbeddingSnapshot(11L, "Câu duy nhất", new double[]{0.95, 0.0})
        ));
        when(annIndex.searchBestMatch(any(double[].class), anyDouble(), anyInt())).thenReturn(null);

        DuplicateCheckResult result = service.check(STEM);

        assertThat(result.checker()).isEqualTo("e5-exact");
        assertThat(result.matchedQuestionId()).isEqualTo(11L);
    }

    // ── Block: lexical similarity (Jaccard on accent-stripped tokens) ─────────

    @ParameterizedTest(name = "\"{0}\" vs \"{1}\" → {2}")
    @CsvSource({
            "'Rửa tay thường quy', 'Rửa tay thường quy', 1.0",
            "'Rửa tay thường quy', 'RUA TAY THUONG QUY', 1.0",
            "'Rửa tay thường quy', 'Rửa tay!! thường quy?', 1.0",
            "'Rửa tay', 'Đeo khẩu trang', 0.0",
            "'', 'Rửa tay', 0.0"
    })
    @DisplayName("L1-DUP-12 | EP: similarity() is accent- and punctuation-insensitive Jaccard")
    void lexicalSimilarityNormalisesAccentsAndPunctuation(String left, String right, double expected) {
        assertThat(service.similarity(left, right)).isCloseTo(expected, within(1e-12));
    }

    @Test
    @DisplayName("L1-DUP-13 | EP-Invalid: similarity() with a null side → 0 without NPE")
    void lexicalSimilarityHandlesNull() {
        assertThat(service.similarity(null, "Rửa tay")).isZero();
        assertThat(service.similarity("Rửa tay", null)).isZero();
    }

    @Test
    @DisplayName("L1-DUP-14 | EP: partial token overlap yields intersection/union")
    void lexicalSimilarityIsIntersectionOverUnion() {
        // {rua, tay} vs {rua, tay, thuong, quy} → 2/4 = 0.5
        assertThat(service.similarity("Rửa tay", "Rửa tay thường quy")).isCloseTo(0.5, within(1e-12));
    }

    // ── Block: precomputeVectors() ────────────────────────────────────────────

    @Test
    @DisplayName("L1-DUP-15 | BC-FALSE: precomputeVectors returns null for non-E5 provider, null and empty input")
    void precomputeVectorsGuardClauses() {
        embeddingProperties.setProvider("lexical");
        assertThat(service.precomputeVectors(List.of("a", "b"))).isNull();

        embeddingProperties.setProvider("e5");
        assertThat(service.precomputeVectors(null)).isNull();
        assertThat(service.precomputeVectors(List.of())).isNull();
    }

    @Test
    @DisplayName("L1-DUP-16 | EP-Invalid: batch embedding failure or size mismatch → null, caller re-embeds one by one")
    void precomputeVectorsReturnsNullOnFailureOrSizeMismatch() {
        when(embeddingService.embedCandidateStems(List.of("a", "b")))
                .thenThrow(new IllegalStateException("model missing"));
        assertThat(service.precomputeVectors(List.of("a", "b"))).isNull();

        when(embeddingService.embedCandidateStems(List.of("c", "d")))
                .thenReturn(List.of(new double[]{1.0}));
        assertThat(service.precomputeVectors(List.of("c", "d"))).isNull();
    }

    @Test
    @DisplayName("L1-DUP-17 | EP-Valid: precomputeVectors returns one vector per stem, in order")
    void precomputeVectorsReturnsVectorsInOrder() {
        when(embeddingService.embedCandidateStems(List.of("a", "b")))
                .thenReturn(List.of(new double[]{1.0, 0.0}, new double[]{0.0, 1.0}));

        double[][] vectors = service.precomputeVectors(List.of("a", "b"));

        assertThat(vectors).hasDimensions(2, 2);
        assertThat(vectors[0]).containsExactly(1.0, 0.0);
        assertThat(vectors[1]).containsExactly(0.0, 1.0);
    }

    // ── Block: lexicalCheck() — pagination and the candidate-batch stage ──────

    @Test
    @DisplayName("L1-DUP-18 | BC-TRUE: a full page triggers a second fetch until a partial page arrives")
    void lexicalCheckPaginatesUntilAPartialPage() {
        embeddingProperties.setProvider("lexical");
        embeddingProperties.setLexicalPageSize(2);
        when(questionRepository.findByStatus(
                org.mockito.ArgumentMatchers.eq(QuestionBankStatus.APPROVED), any(Pageable.class)))
                .thenReturn(List.of(
                        approvedQuestion(20L, "Một câu hoàn toàn khác"),
                        approvedQuestion(21L, "Một câu khác nữa")))       // full page → keep going
                .thenReturn(List.of(approvedQuestion(22L, "Rửa tay thường quy"))); // partial → stop

        DuplicateCheckResult result = service.check("Rửa tay thường quy");

        assertThat(result.checker()).isEqualTo("lexical");
        assertThat(result.matchedQuestionId()).isEqualTo(22L);
        assertThat(result.maxSimilarity()).isEqualTo(1.0);
        verify(questionRepository, org.mockito.Mockito.times(2))
                .findByStatus(org.mockito.ArgumentMatchers.eq(QuestionBankStatus.APPROVED), any(Pageable.class));
    }

    @Test
    @DisplayName("L1-DUP-19 | BC-TRUE: no strong match in the bank → comparable candidates are scanned too")
    void lexicalCheckFallsThroughToCandidates() {
        embeddingProperties.setProvider("lexical");
        when(questionRepository.findByStatus(
                org.mockito.ArgumentMatchers.eq(QuestionBankStatus.APPROVED), any(Pageable.class)))
                .thenReturn(List.of());
        when(candidateRepository.findByStatusIn(
                org.mockito.ArgumentMatchers.<Collection<CandidateStatus>>any(), any(Pageable.class)))
                .thenReturn(List.of(candidate(90L, "Rửa tay thường quy")))
                .thenReturn(List.of());

        DuplicateCheckResult result = service.check("Rửa tay thường quy");

        assertThat(result.matchedQuestionId()).isEqualTo(90L);
        assertThat(result.strongDuplicate()).isTrue();
    }

    @Test
    @DisplayName("L1-DUP-20 | Guard-TRUE: excludedCandidateIds skips the candidate it names")
    void excludedCandidateIsSkipped() {
        embeddingProperties.setProvider("lexical");
        when(questionRepository.findByStatus(
                org.mockito.ArgumentMatchers.eq(QuestionBankStatus.APPROVED), any(Pageable.class)))
                .thenReturn(List.of());
        when(candidateRepository.findByStatusIn(
                org.mockito.ArgumentMatchers.<Collection<CandidateStatus>>any(), any(Pageable.class)))
                .thenReturn(List.of(
                        candidate(90L, "Rửa tay thường quy"),
                        candidate(91L, "Rửa tay")))
                .thenReturn(List.of());

        DuplicateCheckResult result = service.check("Rửa tay thường quy", Set.of(), Set.of(90L));

        assertThat(result.matchedQuestionId()).isEqualTo(91L);
        assertThat(result.strongDuplicate()).isFalse();
    }

    @Test
    @DisplayName("L1-DUP-21 | BC-TRUE: a candidate-batch duplicate beats a weaker semantic match")
    void candidateBatchDuplicateOverridesWeakerSemanticMatch() {
        when(embeddingService.embedCandidateStem("Rửa tay thường quy")).thenReturn(CANDIDATE_VECTOR);
        when(embeddingCache.approvedStemEmbeddings()).thenReturn(List.of(
                new QuestionEmbeddingSnapshot(11L, "Câu chỉ hơi giống", new double[]{0.40, 0.0})
        ));
        when(candidateRepository.findByStatusIn(
                org.mockito.ArgumentMatchers.<Collection<CandidateStatus>>any(), any(Pageable.class)))
                .thenReturn(List.of(candidate(90L, "Rửa tay thường quy")))
                .thenReturn(List.of());

        DuplicateCheckResult result = service.check("Rửa tay thường quy");

        assertThat(result.checker()).isEqualTo("lexical-candidate");
        assertThat(result.matchedQuestionId()).isEqualTo(90L);
        assertThat(result.maxSimilarity()).isEqualTo(1.0);
        assertThat(result.strongDuplicate()).isTrue();
    }

    @ParameterizedTest(name = "lexicalPageSize={0}")
    @CsvSource({"0", "-10"})
    @DisplayName("L1-DUP-22 | BVA-Min: a non-positive configured page size is floored at 1")
    void nonPositivePageSizeIsFlooredAtOne(int pageSize) {
        embeddingProperties.setProvider("lexical");
        embeddingProperties.setLexicalPageSize(pageSize);
        when(questionRepository.findByStatus(
                org.mockito.ArgumentMatchers.eq(QuestionBankStatus.APPROVED), any(Pageable.class)))
                .thenAnswer(invocation -> {
                    Pageable pageable = invocation.getArgument(1);
                    assertThat(pageable.getPageSize()).isEqualTo(1);
                    return List.of();
                });

        assertThat(service.check("Rửa tay thường quy").maxSimilarity()).isZero();
    }

    private vn.vietduc.carehubbackend.questiongeneration.entity.DocumentQuestionCandidate candidate(
            Long id, String stem) {
        var candidate = new vn.vietduc.carehubbackend.questiongeneration.entity.DocumentQuestionCandidate();
        candidate.setId(id);
        candidate.setStem(stem);
        return candidate;
    }

    private QuestionBankQuestion approvedQuestion(Long id, String stem) {
        return QuestionBankQuestion.builder()
                .id(id)
                .stem(stem)
                .optionA("A")
                .optionB("B")
                .optionC("C")
                .optionD("D")
                .correctAnswer("A")
                .language("vi")
                .status(QuestionBankStatus.APPROVED)
                .build();
    }
}
