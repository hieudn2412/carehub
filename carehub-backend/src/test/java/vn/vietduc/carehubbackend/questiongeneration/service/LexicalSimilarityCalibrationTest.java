package vn.vietduc.carehubbackend.questiongeneration.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import vn.vietduc.carehubbackend.benchmark.BenchmarkReport;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/**
 * Hiệu chỉnh hai ngưỡng dành riêng cho đường lexical fallback
 * ({@code validation.duplicate.lexical-strong-min} / {@code lexical-review-min}) trên dữ liệu
 * thật, thay vì tái dùng ngưỡng cosine của E5 ({@code strong-min}=0.95, {@code review-min}=0.88)
 * cho một thang điểm hoàn toàn khác (Jaccard trên tập từ đã bỏ dấu).
 *
 * <p>Đường lexical chỉ chạy khi provider = {@code lexical}, hoặc E5 lỗi/chưa backfill xong — xem
 * {@code DuplicateCheckService.check(...)}. Cùng phương pháp hiệu chỉnh với
 * {@link vn.vietduc.carehubbackend.questiongeneration.modelruntime.e5.E5SimilarityCalibrationTest}:
 * dùng nhãn {@code lesson} của corpus (cùng bài = được phép giống nhau, khác bài = phải khác
 * nhau), quét ngưỡng, và đề xuất dựa trên phân vị của chính phân bố Jaccard chứ không dựa nhãn
 * chủ đề tuyệt đối.</p>
 *
 * <p>Không cần model AI (Jaccard thuần token-set) nên chạy nhanh và không tốn RAM, nhưng vẫn gate
 * bằng biến môi trường cho nhất quán với các benchmark khác và để không chạy trong CI thường
 * xuyên: {@code RUN_LEXICAL_CALIBRATION=true ./mvnw.cmd test -Dtest=LexicalSimilarityCalibrationTest}.
 * Kích thước corpus chỉnh qua {@code LEXICAL_CALIBRATION_LIMIT} (mặc định dùng hết).</p>
 */
@EnabledIfEnvironmentVariable(named = "RUN_LEXICAL_CALIBRATION", matches = "true")
class LexicalSimilarityCalibrationTest {

    private static final Path CORPUS_PATH =
            Path.of("src", "main", "resources", "question-bank", "hospital-review-questions.json");

    /** Sweep 0.30→0.80: dưới 0.30 gần như mọi cặp câu y tế đều có vài từ khoá chung. */
    private static final double SWEEP_START = 0.30;
    private static final double SWEEP_END = 0.80;
    private static final double SWEEP_STEP = 0.05;

    @Test
    void calibratesLexicalThresholdsOnRealQuestionBank() throws Exception {
        assumeTrue(Files.isRegularFile(CORPUS_PATH),
                "Thiếu corpus hospital-review-questions.json — bỏ qua hiệu chỉnh");

        int corpusLimit = envInt("LEXICAL_CALIBRATION_LIMIT", Integer.MAX_VALUE);
        Corpus corpus = loadCorpus(CORPUS_PATH, corpusLimit);
        int questionCount = corpus.stems().size();
        assumeTrue(questionCount >= 2, "Corpus phải có ít nhất 2 câu để tạo cặp");

        // similarity(...) là method public duy nhất không đụng field nào của DuplicateCheckService
        // (chỉ gọi lexicalSimilarity/tokenSet nội bộ) — dùng thẳng instance với mọi dependency null
        // để KHÔNG lặp lại logic Jaccard, tránh calibration trôi khỏi code thật theo thời gian.
        DuplicateCheckService similarityService =
                new DuplicateCheckService(null, null, null, null, null, null, null);

        int pairCount = questionCount * (questionCount - 1) / 2;
        double[] sameLessonScores = new double[pairCount];
        double[] crossLessonScores = new double[pairCount];
        int sameLessonCount = 0;
        int crossLessonCount = 0;

        for (int i = 0; i < questionCount; i++) {
            for (int j = i + 1; j < questionCount; j++) {
                double score = similarityService.similarity(corpus.stems().get(i), corpus.stems().get(j));
                if (corpus.lessons().get(i).equals(corpus.lessons().get(j))) {
                    sameLessonScores[sameLessonCount++] = score;
                } else {
                    crossLessonScores[crossLessonCount++] = score;
                }
            }
        }
        double[] sameLesson = java.util.Arrays.copyOf(sameLessonScores, sameLessonCount);
        double[] crossLesson = java.util.Arrays.copyOf(crossLessonScores, crossLessonCount);

        BenchmarkReport report = BenchmarkReport.of("Hiệu chỉnh ngưỡng trùng lặp lexical (Jaccard)");
        report.note("Corpus: %s — %d câu hỏi, %d bài", CORPUS_PATH, questionCount, corpus.lessonSizes().size())
                .note("Số cặp so sánh: %d (cùng bài=%d, khác bài=%d)", pairCount, sameLessonCount, crossLessonCount)
                .note("Đây là thang Jaccard trên tập từ đã bỏ dấu — KHÁC thang cosine của E5,"
                        + " không dùng chung ngưỡng strong-min/review-min hiện có.");

        report.section("A. Phân bố theo chủ đề");
        report.text("Cùng `lesson` = cùng chủ đề (được phép giống nhau); khác `lesson` = khác chủ đề");
        report.text("(vượt ngưỡng ở nhóm này gần như chắc chắn là dương tính giả).");
        report.text("");
        report.columns("Nhóm cặp", "số cặp", "p50", "p90", "p95", "p99", "max");
        report.row("cùng bài", sameLessonCount,
                BenchmarkReport.percentileOf(sameLesson, 0.50),
                BenchmarkReport.percentileOf(sameLesson, 0.90),
                BenchmarkReport.percentileOf(sameLesson, 0.95),
                BenchmarkReport.percentileOf(sameLesson, 0.99),
                BenchmarkReport.percentileOf(sameLesson, 1.00));
        report.row("khác bài", crossLessonCount,
                BenchmarkReport.percentileOf(crossLesson, 0.50),
                BenchmarkReport.percentileOf(crossLesson, 0.90),
                BenchmarkReport.percentileOf(crossLesson, 0.95),
                BenchmarkReport.percentileOf(crossLesson, 0.99),
                BenchmarkReport.percentileOf(crossLesson, 1.00));
        report.text("");

        double sameLessonMean = mean(sameLesson);
        double crossLessonMean = mean(crossLesson);
        report.text("TB cùng bài = %.4f, TB khác bài = %.4f, chênh lệch = %+.4f.",
                sameLessonMean, crossLessonMean, sameLessonMean - crossLessonMean);

        report.section("B. Quét ngưỡng ứng viên");
        report.text("Với mỗi ngưỡng t: đếm số cặp vượt t ở từng nhóm. Cặp KHÁC BÀI vượt t = dương tính giả tiềm năng.");
        report.text("");
        report.columns("ngưỡng", "cặp khác bài vượt", "cặp cùng bài vượt", "tỉ lệ khác bài (%)");

        double recommendedStrongMin = Double.NaN;
        int steps = (int) Math.round((SWEEP_END - SWEEP_START) / SWEEP_STEP);
        for (int step = 0; step <= steps; step++) {
            double threshold = SWEEP_START + SWEEP_STEP * step;
            int crossAbove = countAtLeast(crossLesson, threshold);
            int sameAbove = countAtLeast(sameLesson, threshold);
            double crossRatioPercent = crossLessonCount == 0 ? 0 : 100d * crossAbove / crossLessonCount;

            report.row(String.format(Locale.ROOT, "%.2f", threshold), crossAbove, sameAbove, crossRatioPercent);

            if (Double.isNaN(recommendedStrongMin) && crossAbove == 0) {
                recommendedStrongMin = threshold;
            }
        }
        report.text("");

        double crossP99 = BenchmarkReport.percentileOf(crossLesson, 0.99);
        double recommendedReviewMin = Math.ceil(crossP99 * 100) / 100d;
        double strongMinProposal = !Double.isNaN(recommendedStrongMin) ? recommendedStrongMin : SWEEP_END;

        report.text("ĐỀ XUẤT lexical-strong-min = %.2f — ngưỡng thấp nhất trong dải quét mà số cặp KHÁC BÀI",
                strongMinProposal);
        report.text("vượt bằng 0. ĐỀ XUẤT lexical-review-min = %.2f — làm tròn lên từ p99 nhóm khác bài (%.4f).",
                recommendedReviewMin, crossP99);
        report.text("LƯU Ý: rút ra từ %d câu SEED một học phần — chạy lại trên ngân hàng thật trước khi chốt.",
                questionCount);

        report.write();

        assertThat(sameLessonMean)
                .as("cặp cùng bài phải giống nhau hơn cặp khác bài về từ vựng")
                .isGreaterThan(crossLessonMean);
        assertThat(min(crossLesson)).as("Jaccard nhỏ nhất").isGreaterThanOrEqualTo(0d);
        assertThat(max(crossLesson)).as("Jaccard lớn nhất").isLessThanOrEqualTo(1d);
    }

    private static int countAtLeast(double[] values, double threshold) {
        int count = 0;
        for (double value : values) {
            if (value >= threshold) {
                count++;
            }
        }
        return count;
    }

    private static double min(double[] values) {
        double result = Double.POSITIVE_INFINITY;
        for (double value : values) {
            result = Math.min(result, value);
        }
        return values.length == 0 ? 0 : result;
    }

    private static double max(double[] values) {
        double result = Double.NEGATIVE_INFINITY;
        for (double value : values) {
            result = Math.max(result, value);
        }
        return values.length == 0 ? 0 : result;
    }

    private static double mean(double[] values) {
        if (values.length == 0) {
            return 0;
        }
        double sum = 0;
        for (double value : values) {
            sum += value;
        }
        return sum / values.length;
    }

    /** Đọc corpus; nếu giới hạn nhỏ hơn tổng số câu thì lấy giãn đều để không mất bài nào. */
    private Corpus loadCorpus(Path path, int limit) throws Exception {
        JsonNode root = new ObjectMapper().readTree(path.toFile());
        JsonNode questions = root.path("questions");

        List<String> allStems = new ArrayList<>();
        List<String> allLessons = new ArrayList<>();
        for (JsonNode question : questions) {
            String stem = question.path("stem").asText("").trim();
            if (stem.isEmpty()) {
                continue;
            }
            allStems.add(stem);
            allLessons.add(question.path("lesson").asText("(không rõ bài)"));
        }

        List<String> stems = allStems;
        List<String> lessons = allLessons;
        if (limit > 0 && limit < allStems.size()) {
            int total = allStems.size();
            stems = new ArrayList<>(limit);
            lessons = new ArrayList<>(limit);
            for (int k = 0; k < limit; k++) {
                int i = (int) ((long) k * total / limit);
                stems.add(allStems.get(i));
                lessons.add(allLessons.get(i));
            }
        }

        Map<String, Integer> lessonSizes = new LinkedHashMap<>();
        for (String lesson : lessons) {
            lessonSizes.merge(lesson, 1, Integer::sum);
        }
        return new Corpus(List.copyOf(stems), List.copyOf(lessons), lessonSizes);
    }

    private static int envInt(String name, int fallback) {
        String raw = System.getenv(name);
        if (raw == null || raw.isBlank()) {
            return fallback;
        }
        try {
            return Integer.parseInt(raw.trim());
        } catch (NumberFormatException ex) {
            return fallback;
        }
    }

    private record Corpus(List<String> stems, List<String> lessons, Map<String, Integer> lessonSizes) {
    }
}
