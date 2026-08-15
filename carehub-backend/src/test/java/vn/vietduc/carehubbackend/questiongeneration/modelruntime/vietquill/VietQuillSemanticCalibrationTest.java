package vn.vietduc.carehubbackend.questiongeneration.modelruntime.vietquill;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import vn.vietduc.carehubbackend.benchmark.BenchmarkReport;
import vn.vietduc.carehubbackend.common.util.CosineUtil;
import vn.vietduc.carehubbackend.questiongeneration.config.AiEmbeddingProperties;
import vn.vietduc.carehubbackend.questiongeneration.config.AiParaphraseProperties;
import vn.vietduc.carehubbackend.questiongeneration.modelruntime.ParaphraseModelException;
import vn.vietduc.carehubbackend.questiongeneration.modelruntime.ParaphraseModelInput;
import vn.vietduc.carehubbackend.questiongeneration.modelruntime.ParaphrasedMcq;
import vn.vietduc.carehubbackend.questiongeneration.modelruntime.e5.E5EmbeddingModelService;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/**
 * Hiệu chỉnh 3 ngưỡng validate paraphrase ({@code ai.paraphrase.low-source-semantic-similarity}=0.72,
 * {@code review-source-semantic-similarity}=0.85, {@code low-option-semantic-similarity}=0.72) bằng
 * số liệu thật — sinh biến thể qua VietQuill thật rồi đo cosine(gốc, biến thể) qua E5 thật, thay vì
 * dùng con số đã hardcode sẵn trong code từ trước mà chưa từng đo.
 *
 * <p>Nghiệp vụ: cosine(gốc, biến thể) THẤP nghĩa là biến thể có nguy cơ đổi nghĩa so với câu gốc —
 * dưới {@code low} thì loại thẳng, dưới {@code review} thì gắn cờ xem lại. Vì đây LÀ phân bố của
 * paraphrase THẬT (không có nhãn "sai nghĩa" độc lập để đối chiếu như cách hiệu chỉnh dedup dùng
 * nhãn {@code lesson}), ngưỡng được chọn theo PHÂN VỊ THẤP của chính phân bố quan sát được: phần
 * đuôi dưới là những biến thể có khả năng lệch nghĩa nhất trong chính mẻ đã sinh, đối chiếu thêm với
 * baseline cosine giữa các câu KHÔNG liên quan trong corpus để xác nhận paraphrase thật sự tách biệt
 * khỏi nhiễu nền.</p>
 *
 * <p>Mặc định TẮT (nạp 2 model native ~4.3 GB RAM: VietQuill question + E5, cùng hàng chục lượt
 * decode không cache). Bật bằng:
 * {@code RUN_VIETQUILL_CALIBRATION=true ./mvnw.cmd test -Dtest=VietQuillSemanticCalibrationTest}.
 * Kích thước mẫu chỉnh qua {@code VIETQUILL_CALIBRATION_LIMIT} (mặc định 20 câu — VietQuill decode
 * không cache nên chi phí tăng nhanh theo số câu × số biến thể).</p>
 */
@EnabledIfEnvironmentVariable(named = "RUN_VIETQUILL_CALIBRATION", matches = "true")
class VietQuillSemanticCalibrationTest {

    private static final Path VIETQUILL_MODEL_ROOT =
            Path.of("models", "ngwgsang", "vietquill-vit5-base-tsubaki");
    private static final Path E5_MODEL_ROOT = Path.of("models", "intfloat", "multilingual-e5-small");
    private static final Path CORPUS_PATH =
            Path.of("src", "main", "resources", "question-bank", "hospital-review-questions.json");

    private static final String CHANGE_STRENGTH = "medium";
    private static final int REQUESTED_COUNT = 3;

    @Test
    void calibratesParaphraseThresholdsOnRealModel() throws Exception {
        Path questionModelRoot = VIETQUILL_MODEL_ROOT.resolve("question");
        assumeTrue(Files.isRegularFile(questionModelRoot.resolve("encoder_model.onnx")),
                "Thiếu encoder_model.onnx của VietQuill (question) — bỏ qua hiệu chỉnh");
        assumeTrue(Files.isRegularFile(questionModelRoot.resolve("decoder_model.onnx")),
                "Thiếu decoder_model.onnx của VietQuill (question) — bỏ qua hiệu chỉnh");
        assumeTrue(Files.isRegularFile(E5_MODEL_ROOT.resolve("onnx").resolve("model.onnx")),
                "Thiếu model.onnx của E5 — bỏ qua hiệu chỉnh");
        assumeTrue(Files.isRegularFile(CORPUS_PATH),
                "Thiếu corpus hospital-review-questions.json — bỏ qua hiệu chỉnh");

        int limit = Math.max(2, envInt("VIETQUILL_CALIBRATION_LIMIT", 20));
        List<SourceQuestion> sample = loadSample(CORPUS_PATH, limit);
        assumeTrue(sample.size() >= 2, "Cần tối thiểu 2 câu để có baseline khác câu");

        AiParaphraseProperties paraphraseProperties = new AiParaphraseProperties();
        paraphraseProperties.setProvider("vietquill");
        paraphraseProperties.setModelPath(questionModelRoot);
        paraphraseProperties.setPreload(false);
        paraphraseProperties.setPoolSize(1);
        paraphraseProperties.setKvCacheEnabled(false);
        paraphraseProperties.setRequestedCountDefault(REQUESTED_COUNT);
        VietQuillParaphraseModelService paraphraseService = new VietQuillParaphraseModelService(
                paraphraseProperties,
                new ObjectMapper(),
                new VietQuillPromptBuilder(),
                new VietQuillHandlePool(paraphraseProperties));

        AiEmbeddingProperties embeddingProperties = new AiEmbeddingProperties();
        embeddingProperties.setProvider("e5");
        embeddingProperties.setModelPath(E5_MODEL_ROOT);
        embeddingProperties.setPreload(false);
        embeddingProperties.setBackfillOnStartup(false);
        // Không gọi embeddingService.close() ở cuối: method này package-private trong
        // modelruntime.e5, khác package với test này. Chấp nhận được vì đây là một lượt chạy
        // ngắn, JVM thoát ngay sau assert — không phải vòng lặp nhiều cấu hình như benchmark.
        E5EmbeddingModelService embeddingService = new E5EmbeddingModelService(embeddingProperties);

        BenchmarkReport report = BenchmarkReport.of("Hiệu chỉnh ngưỡng ngữ nghĩa paraphrase VietQuill");
        report.note("Corpus: %s — mẫu %d câu", CORPUS_PATH, sample.size())
                .note("changeStrength=%s, requestedCount=%d", CHANGE_STRENGTH, REQUESTED_COUNT)
                .note("Ngưỡng đang cấu hình: low-source=%.2f, review-source=%.2f, low-option=%.2f",
                        new AiParaphraseProperties().getLowSourceSemanticSimilarity(),
                        new AiParaphraseProperties().getReviewSourceSemanticSimilarity(),
                        new AiParaphraseProperties().getLowOptionSemanticSimilarity());

        List<Double> pairedScores = new ArrayList<>();
        List<double[]> sourceVectors = new ArrayList<>();
        int emptyCount = 0;

        try {
            for (SourceQuestion source : sample) {
                double[] sourceVector = embeddingService.embedSymmetric(source.stem());
                sourceVectors.add(sourceVector);

                List<ParaphrasedMcq> variants = generate(paraphraseService, source);
                if (variants.isEmpty()) {
                    emptyCount++;
                    continue;
                }
                for (ParaphrasedMcq variant : variants) {
                    double[] variantVector = embeddingService.embedSymmetric(variant.stem());
                    pairedScores.add(CosineUtil.cosine(sourceVector, variantVector));
                }
            }

            assumeTrue(!pairedScores.isEmpty(),
                    "VietQuill không sinh được biến thể nào cho mẫu này — bỏ qua hiệu chỉnh");

            // Baseline: cosine giữa các câu NGUỒN khác nhau trong mẫu (không phải biến thể) — đại
            // diện cho "khác nghĩa hoàn toàn", để đối chiếu xem phân bố paraphrase thật có tách biệt
            // rõ khỏi nhiễu nền hay không.
            List<Double> baselineScores = new ArrayList<>();
            for (int i = 0; i < sourceVectors.size(); i++) {
                for (int j = i + 1; j < sourceVectors.size(); j++) {
                    baselineScores.add(CosineUtil.cosine(sourceVectors.get(i), sourceVectors.get(j)));
                }
            }

            double[] paired = toArray(pairedScores);
            double[] baseline = toArray(baselineScores);

            report.section("A. Phân bố cosine(gốc, biến thể thật)");
            report.text("Mỗi điểm là một biến thể VietQuill thật đã sinh, so với đúng câu gốc của nó.");
            report.text("");
            report.columns("n", "p05", "p10", "p25", "p50", "p75", "p95", "TB");
            report.row(paired.length,
                    BenchmarkReport.percentileOf(paired, 0.05),
                    BenchmarkReport.percentileOf(paired, 0.10),
                    BenchmarkReport.percentileOf(paired, 0.25),
                    BenchmarkReport.percentileOf(paired, 0.50),
                    BenchmarkReport.percentileOf(paired, 0.75),
                    BenchmarkReport.percentileOf(paired, 0.95),
                    mean(paired));
            report.text("");
            report.text("%d/%d câu nguồn không sinh được biến thể nào (bỏ qua khỏi phân bố trên).",
                    emptyCount, sample.size());

            report.section("B. Baseline — cosine giữa các câu KHÔNG liên quan trong mẫu");
            report.text("Đại diện cho \"khác nghĩa hoàn toàn\": nếu phân bố A không tách biệt rõ khỏi B,");
            report.text("nghĩa là VietQuill đang sinh biến thể lệch nghĩa nhiều, hoặc E5 không phân biệt được.");
            report.text("");
            report.columns("n", "p50", "p90", "p99", "max", "TB");
            report.row(baseline.length,
                    BenchmarkReport.percentileOf(baseline, 0.50),
                    BenchmarkReport.percentileOf(baseline, 0.90),
                    BenchmarkReport.percentileOf(baseline, 0.99),
                    BenchmarkReport.percentileOf(baseline, 1.00),
                    mean(baseline));
            report.text("");

            double pairedMean = mean(paired);
            double baselineMean = mean(baseline);
            report.text("TB paraphrase = %.4f, TB baseline (không liên quan) = %.4f, chênh lệch = %+.4f.",
                    pairedMean, baselineMean, pairedMean - baselineMean);

            double lowProposal = round2(BenchmarkReport.percentileOf(paired, 0.05));
            double reviewProposal = round2(BenchmarkReport.percentileOf(paired, 0.25));

            report.section("C. Đề xuất ngưỡng");
            report.text("ĐỀ XUẤT low-source-semantic-similarity = %.2f — xấp xỉ p05 của chính phân bố paraphrase",
                    lowProposal);
            report.text("thật. Biến thể rơi vào 5%% thấp nhất trong mẻ đã sinh có khả năng lệch nghĩa cao nhất.");
            report.text("ĐỀ XUẤT review-source-semantic-similarity = %.2f — xấp xỉ p25. Biến thể dưới mức này",
                    reviewProposal);
            report.text("nằm trong phần tư dưới của phân bố, đáng để người duyệt xem lại trước khi chấp nhận.");
            report.text("");
            report.text("So với cấu hình hiện tại (low=%.2f, review=%.2f): chênh %+.2f / %+.2f.",
                    new AiParaphraseProperties().getLowSourceSemanticSimilarity(),
                    new AiParaphraseProperties().getReviewSourceSemanticSimilarity(),
                    lowProposal - new AiParaphraseProperties().getLowSourceSemanticSimilarity(),
                    reviewProposal - new AiParaphraseProperties().getReviewSourceSemanticSimilarity());
            report.text("LƯU Ý: rút ra từ %d biến thể của %d câu SEED một học phần, KHÔNG có nhãn \"đổi nghĩa\"",
                    paired.length, sample.size());
            report.text("độc lập để đối chiếu — chỉ là phân vị của chính phân bố quan sát được. Chạy lại trên");
            report.text("mẫu lớn hơn (%d+ câu, trải nhiều chuyên khoa) trước khi chốt vào application.yaml.",
                    100);
            report.text("low-option-semantic-similarity dùng ĐÚNG thang đo với câu hỏi (cùng E5, cùng cosine) nên");
            report.text("có thể lấy chung đề xuất %.2f cho low-source, trừ khi đo riêng trên phương án cho thấy",
                    lowProposal);
            report.text("phân bố khác biệt đáng kể (phương án thường ngắn hơn câu hỏi nên cosine có thể nhiễu hơn).");

            report.write();

            assertThat(pairedMean)
                    .as("paraphrase thật phải giống câu gốc hơn hẳn so với câu không liên quan")
                    .isGreaterThan(baselineMean);
            assertThat(min(paired)).as("cosine nhỏ nhất").isGreaterThanOrEqualTo(0d);
            assertThat(max(paired)).as("cosine lớn nhất").isLessThanOrEqualTo(1d + 1e-9d);
        } finally {
            // VietQuillParaphraseModelService.close() là package-private nhưng cùng package với
            // test này nên gọi được trực tiếp — giải phóng OrtSession + thread pool nội bộ.
            paraphraseService.close();
        }
    }

    private List<ParaphrasedMcq> generate(VietQuillParaphraseModelService service, SourceQuestion source) {
        try {
            return service.paraphrase(source.toInput(CHANGE_STRENGTH, REQUESTED_COUNT));
        } catch (ParaphraseModelException ex) {
            String message = ex.getMessage() == null ? "" : ex.getMessage();
            if (ex.getCause() == null && message.contains("không tạo được biến thể")) {
                return List.of();
            }
            throw ex;
        }
    }

    private List<SourceQuestion> loadSample(Path path, int limit) throws Exception {
        JsonNode root = new ObjectMapper().readTree(path.toFile());
        JsonNode questions = root.path("questions");

        List<SourceQuestion> all = new ArrayList<>();
        for (JsonNode question : questions) {
            String stem = question.path("stem").asText("").trim();
            if (stem.isEmpty()) {
                continue;
            }
            all.add(new SourceQuestion(
                    stem,
                    question.path("optionA").asText(""),
                    question.path("optionB").asText(""),
                    question.path("optionC").asText(""),
                    question.path("optionD").asText(""),
                    question.path("correctAnswer").asText("A")
            ));
        }

        if (limit >= all.size()) {
            return all;
        }
        // Lấy giãn đều trên toàn corpus để không thiên lệch về một bài duy nhất.
        List<SourceQuestion> sample = new ArrayList<>(limit);
        int total = all.size();
        for (int k = 0; k < limit; k++) {
            sample.add(all.get((int) ((long) k * total / limit)));
        }
        return sample;
    }

    private static double[] toArray(List<Double> values) {
        double[] result = new double[values.size()];
        for (int i = 0; i < result.length; i++) {
            result[i] = values.get(i);
        }
        return result;
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

    private static double round2(double value) {
        return Math.round(value * 100d) / 100d;
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

    private record SourceQuestion(
            String stem,
            String optionA,
            String optionB,
            String optionC,
            String optionD,
            String correctAnswer
    ) {
        ParaphraseModelInput toInput(String changeStrength, int requestedCount) {
            return new ParaphraseModelInput(
                    stem, optionA, optionB, optionC, optionD, correctAnswer, changeStrength, requestedCount);
        }
    }
}
