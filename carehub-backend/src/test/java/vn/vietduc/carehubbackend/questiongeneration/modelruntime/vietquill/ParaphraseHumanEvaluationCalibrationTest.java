package vn.vietduc.carehubbackend.questiongeneration.modelruntime.vietquill;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import vn.vietduc.carehubbackend.benchmark.BenchmarkReport;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/** Đọc nhãn kép trong CSV export và đo ngưỡng semantic trên đúng dữ liệu vận hành. */
class ParaphraseHumanEvaluationCalibrationTest {
    private static final Path INPUT = Path.of("..", "developer_docs", "ai", "benchmarks",
            "paraphrase-human-evaluation.csv");
    private static final Path AI_LABELS = Path.of("..", "developer_docs", "ai", "benchmarks",
            "paraphrase-ai-labels.csv");

    @Test
    @EnabledIfEnvironmentVariable(named = "RUN_PARAPHRASE_HUMAN_CALIBRATION", matches = "true")
    void calibratesThresholdFromDoubleReviewedCandidates() throws Exception {
        assertThat(INPUT).isRegularFile();
        List<Map<String, String>> allRows = readCsv(INPUT);
        List<Map<String, String>> rows = allRows.stream()
                .filter(row -> !row.getOrDefault("candidate_index", "0").equals("0"))
                .filter(row -> row.getOrDefault("evaluation_sample", "FALSE").equalsIgnoreCase("TRUE"))
                .toList();
        List<LabeledCandidate> labeled = rows.stream().map(this::labeledCandidate).toList();
        assertThat(labeled)
                .as("Cần ít nhất 100 candidate có đủ nhãn TRUE/FALSE của 2 reviewer và adjudication")
                .hasSizeGreaterThanOrEqualTo(100);

        long agreements = labeled.stream().filter(candidate -> candidate.reviewer1() == candidate.reviewer2()).count();
        double agreement = ratio(agreements, labeled.size());
        double kappa = cohenKappa(labeled, agreement);
        double acceptedRate = ratio(labeled.stream().filter(LabeledCandidate::accepted).count(), labeled.size());

        List<ThresholdResult> thresholds = new ArrayList<>();
        for (int step = 180; step <= 199; step++) {
            thresholds.add(evaluate(labeled, step / 200.0));
        }
        ThresholdResult best = thresholds.stream()
                .max(java.util.Comparator.comparingDouble(ThresholdResult::f1)
                        .thenComparingDouble(ThresholdResult::threshold))
                .orElseThrow();
        long sourceCount = allRows.stream()
                .filter(row -> !row.getOrDefault("candidate_index", "0").equals("0"))
                .map(row -> row.get("source_id")).distinct().count();
        long failedSources = allRows.stream()
                .filter(row -> row.getOrDefault("candidate_index", "0").equals("0"))
                .count();
        double generationSuccess = ratio(sourceCount, sourceCount + failedSources);
        boolean go = agreement >= 0.80 && kappa >= 0.60 && acceptedRate >= 0.80
                && generationSuccess >= 0.95 && best.unsafePassRate() <= 0.05;

        BenchmarkReport report = BenchmarkReport.of("Hiệu chỉnh chất lượng paraphrase bằng nhãn người thật")
                .note("Mẫu đã adjudicate: %d candidate / %d nguồn", labeled.size(), sourceCount)
                .note("Đồng thuận reviewer: %.1f%%; Cohen kappa: %.3f", agreement * 100, kappa)
                .note("Tỉ lệ candidate được chấp nhận: %.1f%%", acceptedRate * 100)
                .note("Tỉ lệ nguồn sinh thành công: %.1f%%", generationSuccess * 100)
                .note("Ngưỡng F1 tốt nhất: %.3f (F1=%.3f, precision=%.3f, recall=%.3f, unsafe-pass=%.1f%%)",
                        best.threshold(), best.f1(), best.precision(), best.recall(), best.unsafePassRate() * 100)
                .note("Kết luận theo gate đã công bố: %s", go ? "GO" : "NO-GO")
                .section("Quét ngưỡng semantic")
                .columns("Ngưỡng", "Precision", "Recall", "F1", "Unsafe pass");
        thresholds.forEach(result -> report.row(result.threshold(), result.precision(), result.recall(),
                result.f1(), String.format(Locale.ROOT, "%.1f%%", result.unsafePassRate() * 100)));
        report.write();
    }

    @Test
    @EnabledIfEnvironmentVariable(named = "RUN_PARAPHRASE_AI_CALIBRATION", matches = "true")
    void calibratesThresholdFromAiOnlyLabels() throws Exception {
        assertThat(INPUT).isRegularFile();
        assertThat(AI_LABELS).isRegularFile();
        List<Map<String, String>> allRows = readCsv(INPUT);
        List<Map<String, String>> rows = allRows.stream()
                .filter(row -> !row.getOrDefault("candidate_index", "0").equals("0"))
                .filter(row -> row.getOrDefault("evaluation_sample", "FALSE").equalsIgnoreCase("TRUE"))
                .toList();
        Map<String, AiLabel> labels = new HashMap<>();
        for (Map<String, String> row : readCsv(AI_LABELS)) {
            AiLabel previous = labels.put(row.get("key"), aiLabel(row));
            assertThat(previous).as("Nhãn AI bị trùng key %s", row.get("key")).isNull();
        }
        List<LabeledCandidate> labeled = rows.stream().map(row -> {
            String key = row.get("source_id") + ":" + row.get("candidate_index");
            AiLabel label = labels.get(key);
            assertThat(label).as("Thiếu nhãn AI cho %s", key).isNotNull();
            return new LabeledCandidate(Double.parseDouble(row.get("semantic_similarity")),
                    label.accepted(), label.accepted(), label.accepted());
        }).toList();
        assertThat(labels).as("File nhãn AI phải khớp chính xác mẫu đánh giá").hasSize(rows.size());

        List<ThresholdResult> thresholds = new ArrayList<>();
        for (int step = 180; step <= 199; step++) thresholds.add(evaluate(labeled, step / 200.0));
        ThresholdResult best = thresholds.stream()
                .max(java.util.Comparator.comparingDouble(ThresholdResult::f1)
                        .thenComparingDouble(ThresholdResult::threshold))
                .orElseThrow();
        long sourceCount = allRows.stream()
                .filter(row -> !row.getOrDefault("candidate_index", "0").equals("0"))
                .map(row -> row.get("source_id")).distinct().count();
        long failedSources = allRows.stream()
                .filter(row -> row.getOrDefault("candidate_index", "0").equals("0"))
                .count();
        double generationSuccess = ratio(sourceCount, sourceCount + failedSources);
        double acceptedRate = ratio(labeled.stream().filter(LabeledCandidate::accepted).count(), labeled.size());
        boolean technicalGo = acceptedRate >= 0.80 && generationSuccess >= 0.95
                && best.unsafePassRate() <= 0.05;

        BenchmarkReport report = BenchmarkReport.of("Hiệu chỉnh chất lượng paraphrase bằng nhãn AI-only")
                .note("AI-only: đây là phép sàng lọc tạm thời, không phải nhãn người thật hay chứng nhận production")
                .note("Mẫu phân tầng đều theo cosine: %d candidate / %d nguồn; tỉ lệ dưới đây không đại diện tần suất production",
                        labeled.size(), sourceCount)
                .note("Đạt nghĩa: %.1f%%; giữ fact: %.1f%%; đúng ngữ pháp: %.1f%%; hữu dụng: %.1f%%",
                        passRate(labels, AiLabel::meaning), passRate(labels, AiLabel::facts),
                        passRate(labels, AiLabel::grammar), passRate(labels, AiLabel::useful))
                .note("Đạt cả 4 tiêu chí: %.1f%%; nguồn sinh thành công: %.1f%%",
                        acceptedRate * 100, generationSuccess * 100)
                .note("Ngưỡng F1 tốt nhất: %.3f (F1=%.3f, precision=%.3f, recall=%.3f, unsafe-pass=%.1f%%)",
                        best.threshold(), best.f1(), best.precision(), best.recall(), best.unsafePassRate() * 100)
                .note("Kết luận kỹ thuật tạm thời: %s", technicalGo ? "PROVISIONAL-GO" : "PROVISIONAL-NO-GO")
                .note("Hành động an toàn: giữ hard guard, không auto-approve; mọi candidate hợp lệ phải qua reviewer")
                .section("Quét ngưỡng semantic")
                .columns("Ngưỡng", "Precision", "Recall", "F1", "Unsafe pass");
        thresholds.forEach(result -> report.row(result.threshold(), result.precision(), result.recall(),
                result.f1(), String.format(Locale.ROOT, "%.1f%%", result.unsafePassRate() * 100)));
        report.write();
    }

    @Test
    void parsesQuotedCsvWithoutAnExtraDependency() {
        assertThat(parseLine("\"a,b\",\"c\"\"d\",\"\""))
                .containsExactly("a,b", "c\"d", "");
        assertThat(parseLine("\uFEFF\"source_id\",\"candidate_index\""))
                .containsExactly("source_id", "candidate_index");
    }

    private LabeledCandidate labeledCandidate(Map<String, String> row) {
        boolean reviewer1 = bool(row, "reviewer_1_meaning_preserved")
                && bool(row, "reviewer_1_facts_preserved")
                && bool(row, "reviewer_1_grammar")
                && bool(row, "reviewer_1_useful");
        boolean reviewer2 = bool(row, "reviewer_2_meaning_preserved")
                && bool(row, "reviewer_2_facts_preserved")
                && bool(row, "reviewer_2_grammar")
                && bool(row, "reviewer_2_useful");
        return new LabeledCandidate(
                Double.parseDouble(row.get("semantic_similarity")),
                reviewer1,
                reviewer2,
                bool(row, "adjudicated_accept")
        );
    }

    private AiLabel aiLabel(Map<String, String> row) {
        return new AiLabel(bool(row, "meaning_preserved"), bool(row, "facts_preserved"),
                bool(row, "grammar"), bool(row, "useful"));
    }

    private double passRate(Map<String, AiLabel> labels, java.util.function.Predicate<AiLabel> criterion) {
        return ratio(labels.values().stream().filter(criterion).count(), labels.size()) * 100;
    }

    private boolean bool(Map<String, String> row, String column) {
        String value = row.getOrDefault(column, "").trim();
        assertThat(value).as("%s phải là TRUE hoặc FALSE", column)
                .matches("(?i:true|false)");
        return Boolean.parseBoolean(value);
    }

    private ThresholdResult evaluate(List<LabeledCandidate> rows, double threshold) {
        long accepted = rows.stream().filter(LabeledCandidate::accepted).count();
        long unsafe = rows.size() - accepted;
        long truePositive = rows.stream().filter(row -> row.accepted() && row.similarity() >= threshold).count();
        long falsePositive = rows.stream().filter(row -> !row.accepted() && row.similarity() >= threshold).count();
        double precision = ratio(truePositive, truePositive + falsePositive);
        double recall = ratio(truePositive, accepted);
        double f1 = precision + recall == 0 ? 0 : 2 * precision * recall / (precision + recall);
        return new ThresholdResult(threshold, precision, recall, f1, ratio(falsePositive, unsafe));
    }

    private double cohenKappa(List<LabeledCandidate> rows, double observed) {
        double reviewer1Positive = ratio(rows.stream().filter(LabeledCandidate::reviewer1).count(), rows.size());
        double reviewer2Positive = ratio(rows.stream().filter(LabeledCandidate::reviewer2).count(), rows.size());
        double expected = reviewer1Positive * reviewer2Positive
                + (1 - reviewer1Positive) * (1 - reviewer2Positive);
        return expected == 1 ? (observed == 1 ? 1 : 0) : (observed - expected) / (1 - expected);
    }

    private double ratio(long numerator, long denominator) {
        return denominator == 0 ? 0 : (double) numerator / denominator;
    }

    private List<Map<String, String>> readCsv(Path path) throws Exception {
        List<String> lines = Files.readAllLines(path, StandardCharsets.UTF_8);
        assertThat(lines).isNotEmpty();
        List<String> headers = parseLine(lines.get(0));
        List<Map<String, String>> rows = new ArrayList<>();
        for (int line = 1; line < lines.size(); line++) {
            if (lines.get(line).isBlank()) continue;
            List<String> values = parseLine(lines.get(line));
            assertThat(values).as("CSV line %d", line + 1).hasSameSizeAs(headers);
            Map<String, String> row = new HashMap<>();
            for (int column = 0; column < headers.size(); column++) row.put(headers.get(column), values.get(column));
            rows.add(row);
        }
        return rows;
    }

    private List<String> parseLine(String line) {
        if (line.startsWith("\uFEFF")) line = line.substring(1);
        List<String> values = new ArrayList<>();
        StringBuilder value = new StringBuilder();
        boolean quoted = false;
        for (int index = 0; index < line.length(); index++) {
            char current = line.charAt(index);
            if (current == '"') {
                if (quoted && index + 1 < line.length() && line.charAt(index + 1) == '"') {
                    value.append('"');
                    index++;
                } else {
                    quoted = !quoted;
                }
            } else if (current == ',' && !quoted) {
                values.add(value.toString());
                value.setLength(0);
            } else {
                value.append(current);
            }
        }
        assertThat(quoted).as("Dấu nháy CSV phải đóng").isFalse();
        values.add(value.toString());
        return values;
    }

    private record LabeledCandidate(double similarity, boolean reviewer1, boolean reviewer2, boolean accepted) {}

    private record AiLabel(boolean meaning, boolean facts, boolean grammar, boolean useful) {
        private boolean accepted() {
            return meaning && facts && grammar && useful;
        }
    }

    private record ThresholdResult(double threshold, double precision, double recall, double f1,
                                   double unsafePassRate) {}
}
