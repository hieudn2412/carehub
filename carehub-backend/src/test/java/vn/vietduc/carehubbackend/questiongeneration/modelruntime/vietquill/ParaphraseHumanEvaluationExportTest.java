package vn.vietduc.carehubbackend.questiongeneration.modelruntime.vietquill;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import vn.vietduc.carehubbackend.benchmark.BenchmarkReport;
import vn.vietduc.carehubbackend.common.util.CosineUtil;
import vn.vietduc.carehubbackend.questiongeneration.config.AiEmbeddingProperties;
import vn.vietduc.carehubbackend.questiongeneration.config.AiParaphraseProperties;
import vn.vietduc.carehubbackend.questiongeneration.modelruntime.ParaphraseModelInput;
import vn.vietduc.carehubbackend.questiongeneration.modelruntime.ParaphrasedMcq;
import vn.vietduc.carehubbackend.questiongeneration.modelruntime.e5.E5EmbeddingModelService;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.DriverManager;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/** Xuất bộ 120 câu DB × tối đa 3 biến thể để hai reviewer gán nhãn độc lập. */
class ParaphraseHumanEvaluationExportTest {
    private static final Path VIETQUILL_ROOT =
            Path.of("models", "ngwgsang", "vietquill-vit5-base-tsubaki", "question");
    private static final Path E5_ROOT = Path.of("models", "intfloat", "multilingual-e5-small");
    private static final int REQUESTED_COUNT = 3;
    private static final int HUMAN_SAMPLE_SIZE = 180;

    @Test
    @EnabledIfEnvironmentVariable(named = "RUN_PARAPHRASE_HUMAN_EVAL", matches = "true")
    void exportsStratifiedDatabaseCandidatesForTwoReviewers() throws Exception {
        assumeTrue(Files.isRegularFile(VIETQUILL_ROOT.resolve("encoder_model.onnx")), "Thiếu VietQuill");
        assumeTrue(Files.isRegularFile(E5_ROOT.resolve("onnx").resolve("model.onnx")), "Thiếu E5");

        int limit = Math.max(2, envInt("PARAPHRASE_EVAL_SOURCE_LIMIT", 120));
        Set<Long> sourceIds = envLongSet("PARAPHRASE_EVAL_SOURCE_IDS");
        if (!sourceIds.isEmpty()) limit = sourceIds.size();
        List<SourceQuestion> sources = loadStratifiedSources(limit, sourceIds);
        assertThat(sources.size()).isBetween(2, limit);
        Path output = outputPath();

        AiParaphraseProperties paraphraseProperties = new AiParaphraseProperties();
        paraphraseProperties.setProvider("vietquill");
        paraphraseProperties.setModelPath(VIETQUILL_ROOT);
        paraphraseProperties.setPoolSize(1);
        paraphraseProperties.setPreload(false);
        paraphraseProperties.setParaphraseOptions(false);
        paraphraseProperties.setNumBeams(envInt("PARAPHRASE_EVAL_NUM_BEAMS", 8));
        VietQuillParaphraseModelService paraphraseService = new VietQuillParaphraseModelService(
                paraphraseProperties,
                new ObjectMapper(),
                new VietQuillPromptBuilder(),
                new VietQuillHandlePool(paraphraseProperties)
        );

        AiEmbeddingProperties embeddingProperties = new AiEmbeddingProperties();
        embeddingProperties.setProvider("e5");
        embeddingProperties.setModelPath(E5_ROOT);
        embeddingProperties.setPreload(false);
        embeddingProperties.setBackfillOnStartup(false);
        E5EmbeddingModelService embeddingService = new E5EmbeddingModelService(embeddingProperties);
        ProtectedTermService protectedTerms = new ProtectedTermService();

        List<EvaluationRow> rows = new ArrayList<>();
        List<Long> latencySamples = new ArrayList<>();
        int failedSources = 0;
        try {
            for (SourceQuestion source : sources) {
                long started = System.nanoTime();
                List<ParaphrasedMcq> variants;
                String error = "";
                try {
                    variants = paraphraseService.paraphrase(source.toInput());
                } catch (RuntimeException ex) {
                    variants = List.of();
                    error = ex.getMessage() == null ? ex.getClass().getSimpleName() : ex.getMessage();
                    failedSources++;
                }
                latencySamples.add(System.nanoTime() - started);

                if (variants.isEmpty()) {
                    rows.add(EvaluationRow.failed(source, error));
                    continue;
                }
                double[] sourceVector = embeddingService.embedSymmetric(source.stem());
                for (int i = 0; i < variants.size(); i++) {
                    ParaphrasedMcq variant = variants.get(i);
                    double similarity = CosineUtil.cosine(
                            sourceVector, embeddingService.embedSymmetric(variant.stem()));
                    ProtectedTermService.FactChanges facts = protectedTerms.changes(source.stem(), variant.stem());
                    rows.add(EvaluationRow.generated(source, i + 1, variant, similarity, facts));
                }
            }
        } finally {
            paraphraseService.close();
        }

        Files.createDirectories(output.getParent());
        Set<String> sampleKeys = evaluationSample(rows, HUMAN_SAMPLE_SIZE);
        Files.writeString(output, toCsv(rows, sampleKeys), StandardCharsets.UTF_8);

        long[] latency = latencySamples.stream().mapToLong(Long::longValue).toArray();
        String tag = safeTag(System.getenv("PARAPHRASE_EVAL_OUTPUT_TAG"));
        BenchmarkReport report = BenchmarkReport.of("Xuất bộ gán nhãn paraphrase DB" + (tag.isBlank() ? "" : " " + tag));
        report.note("Nguồn: PostgreSQL questions APPROVED — %d câu, %d lĩnh vực", sources.size(),
                        sources.stream().map(SourceQuestion::field).distinct().count())
                .note("VietQuill num-beams=%d, requested-count=%d", paraphraseProperties.getNumBeams(), REQUESTED_COUNT)
                .note("Sinh được %d candidate; %d/%d nguồn không có candidate", rows.stream()
                                .filter(row -> row.candidateIndex() > 0).count(), failedSources, sources.size())
                .note("Bộ reviewer: %d candidate trải đều toàn dải cosine", sampleKeys.size())
                .note("Latency/job: p50=%.0f ms, p95=%.0f ms", BenchmarkReport.stats(latency).p50Ms(),
                        BenchmarkReport.stats(latency).p95Ms())
                .note("CSV gán nhãn kép: %s", output.toAbsolutePath().normalize());
        report.write();

        assertThat(rows).isNotEmpty();
        assertThat(Files.size(output)).isGreaterThan(0L);
    }

    @Test
    void evaluationSampleSpansTheWholeSimilarityRange() {
        List<EvaluationRow> rows = new ArrayList<>();
        for (int index = 1; index <= 10; index++) {
            rows.add(new EvaluationRow(index, "field", "source", "options", "A", 1,
                    "candidate", 0.90 + index / 100.0, "", "", ""));
        }

        assertThat(evaluationSample(rows, 4))
                .containsExactly("1:1", "4:1", "7:1", "10:1");
    }

    private List<SourceQuestion> loadStratifiedSources(int limit, Set<Long> sourceIds) throws Exception {
        String url = requiredEnv("DB_URL");
        String username = requiredEnv("DB_USERNAME");
        String password = requiredEnv("DB_PASSWORD");
        var byField = new LinkedHashMap<String, ArrayDeque<SourceQuestion>>();
        String sql = """
                SELECT q.id, pf.name, q.stem, q.option_a, q.option_b, q.option_c, q.option_d, q.correct_answer
                FROM questions q
                JOIN professional_fields pf ON pf.id = q.professional_field_id
                WHERE q.status = 'APPROVED' AND BTRIM(q.stem) <> ''
                ORDER BY pf.id, q.id
                """;
        try (var connection = DriverManager.getConnection(url, username, password)) {
            connection.setReadOnly(true);
            try (var statement = connection.createStatement(); var result = statement.executeQuery(sql)) {
                while (result.next()) {
                    SourceQuestion source = new SourceQuestion(
                            result.getLong(1), result.getString(2), result.getString(3), result.getString(4),
                            result.getString(5), result.getString(6), result.getString(7), result.getString(8));
                    if (!sourceIds.isEmpty() && !sourceIds.contains(source.id())) continue;
                    byField.computeIfAbsent(source.field(), ignored -> new ArrayDeque<>()).add(source);
                }
            }
        }

        List<SourceQuestion> selected = new ArrayList<>(limit);
        boolean added;
        do {
            added = false;
            for (var group : byField.values()) {
                if (selected.size() == limit) {
                    return selected;
                }
                SourceQuestion source = group.pollFirst();
                if (source != null) {
                    selected.add(source);
                    added = true;
                }
            }
        } while (added);
        return selected;
    }

    private Set<String> evaluationSample(List<EvaluationRow> rows, int limit) {
        List<EvaluationRow> generated = rows.stream()
                .filter(row -> row.candidateIndex() > 0)
                .sorted(java.util.Comparator.comparingDouble(EvaluationRow::semanticSimilarity)
                        .thenComparingLong(EvaluationRow::sourceId)
                        .thenComparingInt(EvaluationRow::candidateIndex))
                .toList();
        int sampleSize = Math.min(limit, generated.size());
        Set<String> selected = new LinkedHashSet<>();
        for (int index = 0; index < sampleSize; index++) {
            int position = sampleSize == 1 ? 0
                    : (int) Math.round((double) index * (generated.size() - 1) / (sampleSize - 1));
            selected.add(generated.get(position).sampleKey());
        }
        return selected;
    }

    private String toCsv(List<EvaluationRow> rows, Set<String> sampleKeys) {
        List<String> lines = new ArrayList<>();
        lines.add(String.join(",", EvaluationRow.headers()));
        for (EvaluationRow row : rows) {
            lines.add(row.values(sampleKeys.contains(row.sampleKey())).stream()
                    .map(this::csv).reduce((a, b) -> a + "," + b).orElse(""));
        }
        return String.join(System.lineSeparator(), lines) + System.lineSeparator();
    }

    private String csv(Object value) {
        String text = String.valueOf(value == null ? "" : value)
                .replace('\r', ' ')
                .replace('\n', ' ')
                .replace("\"", "\"\"");
        return "\"" + text + "\"";
    }

    private static String requiredEnv(String name) {
        String value = System.getenv(name);
        assertThat(value).as(name).isNotBlank();
        return value;
    }

    private static int envInt(String name, int fallback) {
        try {
            return Integer.parseInt(System.getenv().getOrDefault(name, String.valueOf(fallback)));
        } catch (NumberFormatException ignored) {
            return fallback;
        }
    }

    private static Set<Long> envLongSet(String name) {
        String value = System.getenv(name);
        if (value == null || value.isBlank()) return Set.of();
        return Arrays.stream(value.split(","))
                .map(String::trim)
                .filter(part -> !part.isBlank())
                .map(Long::parseLong)
                .collect(Collectors.toUnmodifiableSet());
    }

    private static Path outputPath() {
        String tag = safeTag(System.getenv("PARAPHRASE_EVAL_OUTPUT_TAG"));
        String suffix = tag.isBlank() ? "" : "-" + tag;
        return Path.of("..", "developer_docs", "ai", "benchmarks",
                "paraphrase-human-evaluation" + suffix + ".csv");
    }

    private static String safeTag(String value) {
        return value == null ? "" : value.trim().toLowerCase(java.util.Locale.ROOT)
                .replaceAll("[^a-z0-9-]+", "-")
                .replaceAll("(^-|-$)", "");
    }

    private record SourceQuestion(
            long id, String field, String stem, String optionA, String optionB,
            String optionC, String optionD, String correctAnswer
    ) {
        ParaphraseModelInput toInput() {
            return new ParaphraseModelInput(
                    stem, optionA, optionB, optionC, optionD, correctAnswer, "medium", REQUESTED_COUNT);
        }
    }

    private record EvaluationRow(
            long sourceId, String field, String sourceStem, String sourceOptions, String correctAnswer,
            int candidateIndex, String candidateStem, double semanticSimilarity, String missingFacts,
            String addedFacts, String generationError
    ) {
        static EvaluationRow generated(SourceQuestion source, int index, ParaphrasedMcq candidate,
                                       double similarity, ProtectedTermService.FactChanges facts) {
            return new EvaluationRow(source.id(), source.field(), source.stem(), sourceOptions(source),
                    source.correctAnswer(), index, candidate.stem(), similarity,
                    String.join(" | ", facts.missing()), String.join(" | ", facts.added()), "");
        }

        static EvaluationRow failed(SourceQuestion source, String error) {
            return new EvaluationRow(source.id(), source.field(), source.stem(), sourceOptions(source),
                    source.correctAnswer(), 0, "", 0, "", "", error);
        }

        static String sourceOptions(SourceQuestion source) {
            return "A. " + source.optionA() + " | B. " + source.optionB()
                    + " | C. " + source.optionC() + " | D. " + source.optionD();
        }

        static List<String> headers() {
            return List.of("source_id", "professional_field", "source_stem", "source_options", "correct_answer",
                    "candidate_index", "candidate_stem", "semantic_similarity", "missing_facts", "added_facts",
                    "generation_error", "evaluation_sample", "reviewer_1_meaning_preserved", "reviewer_1_facts_preserved",
                    "reviewer_1_grammar", "reviewer_1_useful", "reviewer_1_notes",
                    "reviewer_2_meaning_preserved", "reviewer_2_facts_preserved", "reviewer_2_grammar",
                    "reviewer_2_useful", "reviewer_2_notes", "adjudicated_accept", "adjudication_notes");
        }

        String sampleKey() {
            return sourceId + ":" + candidateIndex;
        }

        List<Object> values(boolean evaluationSample) {
            return List.of(sourceId, field, sourceStem, sourceOptions, correctAnswer, candidateIndex,
                    candidateStem, String.format(java.util.Locale.ROOT, "%.6f", semanticSimilarity),
                    missingFacts, addedFacts, generationError,
                    evaluationSample ? "TRUE" : "FALSE",
                    "", "", "", "", "", "", "", "", "", "", "", "");
        }
    }
}
