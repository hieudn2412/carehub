package vn.vietduc.carehubbackend.questiongeneration.modelruntime.e5;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import vn.vietduc.carehubbackend.benchmark.BenchmarkReport;
import vn.vietduc.carehubbackend.common.util.CosineUtil;
import vn.vietduc.carehubbackend.questiongeneration.config.AiEmbeddingProperties;
import vn.vietduc.carehubbackend.questiongeneration.config.ValidationRulesProperties;
import vn.vietduc.carehubbackend.questiongeneration.embedding.AnnEmbeddingIndex;
import vn.vietduc.carehubbackend.questiongeneration.embedding.QuestionEmbeddingSnapshot;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.PriorityQueue;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/**
 * Hiệu chỉnh hai ngưỡng so trùng câu hỏi ({@code validation.duplicate.strong-min} = 0.93 và
 * {@code validation.duplicate.review-min} = 0.80) bằng số liệu thật, thay vì con số đoán.
 *
 * <p>Nghiệp vụ: câu ứng viên có cosine ≥ strongMin bị LOẠI (trùng mạnh), ≥ reviewMin thì bị gắn cờ
 * CẦN XEM LẠI, thấp hơn thì chấp nhận. Đặt ngưỡng quá thấp làm mất câu hỏi tốt và ngập việc cho
 * người duyệt; đặt quá cao thì câu trùng lọt vào ngân hàng. Vì vậy phải nhìn PHÂN BỐ cosine thật
 * trên ngân hàng câu hỏi seed (270 câu y tế tiếng Việt) chứ không chỉ nhìn một vài ví dụ.</p>
 *
 * <p>Nhãn tự nhiên để hiệu chỉnh: trường {@code lesson} của corpus. Hai câu CÙNG BÀI là cùng chủ đề
 * (được phép giống nhau ở mức vừa phải), hai câu KHÁC BÀI là khác chủ đề — nếu một cặp khác bài mà
 * vượt ngưỡng trùng thì gần như chắc chắn đó là DƯƠNG TÍNH GIẢ. Ngưỡng tốt là ngưỡng nằm trên toàn
 * bộ đuôi phân bố của nhóm khác bài.</p>
 *
 * <p>Benchmark mặc định TẮT (nạp model ONNX 449 MB tốn hàng trăm MB RAM). Bật bằng:
 * {@code RUN_E5_CALIBRATION=true ./mvnw.cmd test -Dtest=E5SimilarityCalibrationTest}.
 * Số vòng đo lặp lại phần tìm kiếm ANN chỉnh qua {@code BENCH_ITERATIONS} (mặc định 3),
 * kích thước corpus chỉnh qua {@code E5_CALIBRATION_LIMIT} (mặc định 270 = dùng hết).</p>
 */
@EnabledIfEnvironmentVariable(named = "RUN_E5_CALIBRATION", matches = "true")
class E5SimilarityCalibrationTest {

    private static final Path MODEL_ROOT = Path.of("models", "intfloat", "multilingual-e5-small");
    private static final Path CORPUS_PATH =
            Path.of("src", "main", "resources", "question-bank", "hospital-review-questions.json");

    /** Số lần embed bỏ đi trước khi đo, để JIT biên dịch xong và ONNX cấp phát xong bộ đệm nội bộ. */
    private static final int EMBED_WARMUP_RUNS = 3;

    /** Số lần tìm kiếm ANN bỏ đi trước khi đo, cho mỗi cấu hình. */
    private static final int ANN_WARMUP_RUNS = 5;

    /** Các cấu hình LSH cần quét: số bit băm × số ứng viên kiểm tra chính xác. */
    private static final int[] ANN_LSH_BITS_SWEEP = {8, 12, 16, 20};
    private static final int[] ANN_SEARCH_K_SWEEP = {10, 50, 100};

    /** Cấu hình đang chạy production — dùng để đối chiếu trong phần đề xuất. */
    private static final int DEFAULT_ANN_LSH_BITS = 16;
    private static final int DEFAULT_ANN_SEARCH_K = 50;

    @Test
    void calibratesDuplicateThresholdsOnRealQuestionBank() throws Exception {
        assumeTrue(Files.isRegularFile(MODEL_ROOT.resolve("onnx").resolve("model.onnx")),
                "Thiếu model.onnx của E5 — bỏ qua hiệu chỉnh");
        assumeTrue(Files.isRegularFile(MODEL_ROOT.resolve("onnx").resolve("tokenizer.json")),
                "Thiếu tokenizer.json của E5 — bỏ qua hiệu chỉnh");
        assumeTrue(Files.isRegularFile(CORPUS_PATH),
                "Thiếu corpus hospital-review-questions.json — bỏ qua hiệu chỉnh");

        // Tối thiểu 1 vòng: BENCH_ITERATIONS=0 sẽ làm mảng mẫu rỗng và recall@1 luôn bằng 0.
        int annIterations = Math.max(1, envInt("BENCH_ITERATIONS", 3));
        int corpusLimit = envInt("E5_CALIBRATION_LIMIT", Integer.MAX_VALUE);

        Corpus corpus = loadCorpus(CORPUS_PATH, corpusLimit);
        int questionCount = corpus.stems().size();
        assumeTrue(questionCount >= 2, "Corpus phải có ít nhất 2 câu để tạo cặp");

        ValidationRulesProperties validationRules = new ValidationRulesProperties();
        double currentStrongMin = validationRules.getDuplicate().getStrongMin();
        double currentReviewMin = validationRules.getDuplicate().getReviewMin();

        BenchmarkReport report = BenchmarkReport.of("Hiệu chỉnh ngưỡng trùng lặp E5");
        report.note("Máy: %d CPU khả dụng, maxMemory=%.1f GB, %s, Java %s",
                        Runtime.getRuntime().availableProcessors(),
                        Runtime.getRuntime().maxMemory() / (1024d * 1024d * 1024d),
                        System.getProperty("os.name"),
                        System.getProperty("java.version"))
                .note("Corpus: %s — %d câu hỏi, %d bài", CORPUS_PATH, questionCount, corpus.lessonSizes().size())
                .note("Ngưỡng đang cấu hình: strongMin=%.2f, reviewMin=%.2f", currentStrongMin, currentReviewMin)
                .note("Số cặp so sánh: %d", questionCount * (questionCount - 1) / 2);

        AiEmbeddingProperties embeddingProperties = e5Properties();
        E5EmbeddingModelService embeddingService = new E5EmbeddingModelService(embeddingProperties);

        double checksum = 0;
        try {
            // ── Nạp model: đo RIÊNG, không được lẫn vào thời gian inference ──
            // preload=false nên runtime được nạp lười ở lần embed đầu tiên.
            long loadStartNanos = System.nanoTime();
            double[] probeVector = embeddingService.embedSymmetric("khởi động mô hình nhúng");
            long loadNanos = System.nanoTime() - loadStartNanos;
            checksum += probeVector[0];
            report.note("Thời gian nạp model + lần nhúng đầu tiên: %.0f ms", loadNanos / 1_000_000d);

            // Warmup: bỏ đi vài lần chạy đầu để JIT ổn định trước khi đo.
            for (int warmup = 0; warmup < EMBED_WARMUP_RUNS; warmup++) {
                checksum += embeddingService.embedSymmetric(corpus.stems().get(warmup % questionCount))[0];
                checksum += embeddingService.embedQuery(corpus.stems().get(warmup % questionCount))[0];
                checksum += embeddingService.embedPassage(corpus.stems().get(warmup % questionCount))[0];
            }

            // ── Nhúng toàn bộ corpus ──
            // E5TextPreprocessor.symmetric() gọi thẳng query(), nên embedSymmetric(x) và embedQuery(x)
            // đưa CÙNG một chuỗi vào model. Vì vậy queryVectors chính là vector "đối xứng" của đường
            // gọi ĐƠN LẺ, và toàn bộ phân tích A–E dùng nó: cả hai vế của mọi phép so đều đi qua cùng
            // một đường mã, nên chênh lệch đo được chỉ đến từ TIỀN TỐ chứ không lẫn thứ gì khác.
            // Lô (batch) chỉ dùng để đo THÔNG LƯỢNG và để đối chiếu độ đồng thuận với đường đơn lẻ.
            long batchStartNanos = System.nanoTime();
            List<double[]> batchSymmetricVectors = embeddingService.embedSymmetricBatch(corpus.stems());
            long batchNanos = System.nanoTime() - batchStartNanos;

            double[][] queryVectors = new double[questionCount][];
            double[][] passageVectors = new double[questionCount][];
            long[] singleEmbedSamples = new long[questionCount * 2];
            for (int i = 0; i < questionCount; i++) {
                String stem = corpus.stems().get(i);

                long queryStart = System.nanoTime();
                queryVectors[i] = embeddingService.embedQuery(stem);
                singleEmbedSamples[i * 2] = System.nanoTime() - queryStart;

                long passageStart = System.nanoTime();
                passageVectors[i] = embeddingService.embedPassage(stem);
                singleEmbedSamples[i * 2 + 1] = System.nanoTime() - passageStart;

                checksum += queryVectors[i][0] + passageVectors[i][0];
            }

            // Vector dùng cho MỌI phân tích bên dưới: đường gọi đơn lẻ, cùng tiền tố `query: `.
            List<double[]> symmetricVectors = java.util.Arrays.asList(queryVectors);

            BenchmarkReport.Stats singleEmbedStats = BenchmarkReport.stats(singleEmbedSamples);
            report.note("Nhúng batch đối xứng %d câu: %.0f ms (%.1f ms/câu)",
                            questionCount, batchNanos / 1_000_000d,
                            batchNanos / 1_000_000d / questionCount)
                    .note("Nhúng đơn lẻ (query/passage), n=%d: p50=%.1f ms, p95=%.1f ms, TB=%.1f ms",
                            singleEmbedStats.count(), singleEmbedStats.p50Ms(),
                            singleEmbedStats.p95Ms(), singleEmbedStats.meanMs());

            // Batch và đơn lẻ nhận CÙNG stem với CÙNG tiền tố nên về lý thuyết phải ra vector y hệt
            // (cosine = 1.0). Đo thật để biết có được phép trộn hai nguồn vector trong một phép so
            // trùng hay không — ngân hàng câu hỏi được backfill theo lô, còn câu ứng viên thì nhúng
            // đơn lẻ, nên nếu hai đường lệch nhau thì mọi ngưỡng hiệu chỉnh đều bị trôi.
            double batchAgreementSum = 0;
            double worstBatchAgreement = 1;
            for (int i = 0; i < questionCount; i++) {
                double agreement = CosineUtil.cosine(batchSymmetricVectors.get(i), queryVectors[i]);
                batchAgreementSum += agreement;
                worstBatchAgreement = Math.min(worstBatchAgreement, agreement);
                checksum += agreement;
            }
            report.note("Đồng thuận batch vs đơn lẻ trên CÙNG stem: cosine TB=%.6f, thấp nhất=%.6f",
                    batchAgreementSum / questionCount, worstBatchAgreement);
            report.note("(1.0 = trùng khít. Lệch khỏi 1.0 nghĩa là hai đường mã cho vector khác nhau"
                    + " — phân tích A–E dưới đây vì vậy CHỈ dùng vector đơn lẻ để không lẫn hai hiệu ứng.)");

            // ── A. Đối xứng vs bất đối xứng ──
            int pairCount = questionCount * (questionCount - 1) / 2;
            double[] symmetricScores = new double[pairCount];
            double[] asymmetricScores = new double[pairCount];
            double[] sameLessonScores = new double[pairCount];
            double[] crossLessonScores = new double[pairCount];
            int sameLessonCount = 0;
            int crossLessonCount = 0;

            // Giữ 15 cặp giống nhau nhất bằng min-heap kích thước cố định (rẻ hơn sort 36k cặp).
            PriorityQueue<ScoredPair> topPairs =
                    new PriorityQueue<>(Comparator.comparingDouble(ScoredPair::score));

            int pairIndex = 0;
            for (int i = 0; i < questionCount; i++) {
                for (int j = i + 1; j < questionCount; j++) {
                    double symmetricScore = CosineUtil.cosine(symmetricVectors.get(i), symmetricVectors.get(j));
                    // Cách CŨ của repo: ngân hàng nhúng bằng passage, ứng viên nhúng bằng query.
                    double asymmetricScore = CosineUtil.cosine(queryVectors[i], passageVectors[j]);

                    symmetricScores[pairIndex] = symmetricScore;
                    asymmetricScores[pairIndex] = asymmetricScore;
                    pairIndex++;

                    if (corpus.lessons().get(i).equals(corpus.lessons().get(j))) {
                        sameLessonScores[sameLessonCount++] = symmetricScore;
                    } else {
                        crossLessonScores[crossLessonCount++] = symmetricScore;
                    }

                    topPairs.offer(new ScoredPair(symmetricScore, i, j));
                    if (topPairs.size() > 15) {
                        topPairs.poll();
                    }
                    checksum += symmetricScore + asymmetricScore;
                }
            }

            double[] sameLesson = java.util.Arrays.copyOf(sameLessonScores, sameLessonCount);
            double[] crossLesson = java.util.Arrays.copyOf(crossLessonScores, crossLessonCount);

            double symmetricMean = mean(symmetricScores);
            double asymmetricMean = mean(asymmetricScores);

            report.section("A. Tiền tố đối xứng vs bất đối xứng (toàn bộ " + pairCount + " cặp)");
            report.text("Cả hai vế của phép so trùng phải dùng CÙNG tiền tố. Trộn `query:` với `passage:`");
            report.text("đẩy hai vector về hai vùng khác nhau của không gian nhúng nên kéo cosine xuống có hệ thống.");
            report.text("Cả hai hàng đều dùng vector nhúng ĐƠN LẺ, nên khác biệt duy nhất giữa chúng là tiền tố.");
            report.text("");
            report.columns("Cách nhúng", "p50", "p75", "p90", "p95", "p99", "max", "TB");
            report.row("đối xứng (query: cả hai vế)",
                    BenchmarkReport.percentileOf(symmetricScores, 0.50),
                    BenchmarkReport.percentileOf(symmetricScores, 0.75),
                    BenchmarkReport.percentileOf(symmetricScores, 0.90),
                    BenchmarkReport.percentileOf(symmetricScores, 0.95),
                    BenchmarkReport.percentileOf(symmetricScores, 0.99),
                    BenchmarkReport.percentileOf(symmetricScores, 1.00),
                    symmetricMean);
            report.row("bất đối xứng (query: vs passage:)",
                    BenchmarkReport.percentileOf(asymmetricScores, 0.50),
                    BenchmarkReport.percentileOf(asymmetricScores, 0.75),
                    BenchmarkReport.percentileOf(asymmetricScores, 0.90),
                    BenchmarkReport.percentileOf(asymmetricScores, 0.95),
                    BenchmarkReport.percentileOf(asymmetricScores, 0.99),
                    BenchmarkReport.percentileOf(asymmetricScores, 1.00),
                    asymmetricMean);
            report.text("");

            double meanShift = symmetricMean - asymmetricMean;
            double p99Shift = BenchmarkReport.percentileOf(symmetricScores, 0.99)
                    - BenchmarkReport.percentileOf(asymmetricScores, 0.99);
            report.text("Chuyển sang nhúng đối xứng làm điểm dịch %s trung bình %+.4f (p99 dịch %+.4f).",
                    meanShift >= 0 ? "LÊN" : "XUỐNG", meanShift, p99Shift);
            report.text("Ý nghĩa với ngưỡng đang dùng (strongMin=%.2f, reviewMin=%.2f): toàn bộ thang điểm dịch,",
                    currentStrongMin, currentReviewMin);
            report.text("nên hai ngưỡng cũ vốn được chọn trên thang BẤT ĐỐI XỨNG giờ tương đương với");
            report.text("khoảng %.3f / %.3f trên thang cũ — tức là đang chặt hơn (hoặc lỏng hơn) so với ý định ban đầu",
                    currentStrongMin - meanShift, currentReviewMin - meanShift);
            report.text("và bắt buộc phải hiệu chỉnh lại theo phần C bên dưới.");

            // ── B. Cùng bài vs khác bài ──
            report.section("B. Phân bố theo chủ đề (nhúng đối xứng)");
            report.text("Cùng `lesson` = cùng chủ đề (được phép giống nhau); khác `lesson` = khác chủ đề");
            report.text("(vượt ngưỡng trùng ở nhóm này gần như chắc chắn là dương tính giả).");
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
            report.text("Chênh lệch dương xác nhận model PHÂN BIỆT ĐƯỢC chủ đề; nếu âm thì pipeline nhúng đang hỏng.");

            // ── C. Quét ngưỡng ứng viên ──
            report.section("C. Quét ngưỡng ứng viên");
            report.text("Với mỗi ngưỡng t: đếm số cặp vượt t ở từng nhóm. Cặp KHÁC BÀI vượt t = dương tính giả tiềm năng.");
            report.text("");
            report.columns("ngưỡng", "cặp khác bài vượt", "cặp cùng bài vượt", "tỉ lệ khác bài (%)");

            double recommendedStrongMin = Double.NaN;
            double lowestNearZeroThreshold = Double.NaN;
            for (int step = 0; step <= 9; step++) {
                double threshold = 0.80 + 0.02 * step;
                int crossAbove = countAtLeast(crossLesson, threshold);
                int sameAbove = countAtLeast(sameLesson, threshold);
                double crossRatioPercent = crossLessonCount == 0 ? 0 : 100d * crossAbove / crossLessonCount;

                report.row(String.format(Locale.ROOT, "%.2f", threshold),
                        crossAbove, sameAbove, crossRatioPercent);

                if (Double.isNaN(recommendedStrongMin) && crossAbove == 0) {
                    recommendedStrongMin = threshold;
                }
                // "Gần 0" = dưới 0.01% số cặp khác bài — đủ hiếm để người duyệt xử lý tay được.
                if (Double.isNaN(lowestNearZeroThreshold) && crossRatioPercent <= 0.01) {
                    lowestNearZeroThreshold = threshold;
                }
            }
            report.text("");

            // reviewMin nên nằm ngay trên đuôi phân bố khác bài: dưới mức đó, người duyệt bị ngập
            // bởi những cặp không liên quan gì nhau.
            double crossP99 = BenchmarkReport.percentileOf(crossLesson, 0.99);
            double recommendedReviewMin = Math.ceil(crossP99 * 100) / 100d;
            double strongMinProposal = !Double.isNaN(recommendedStrongMin)
                    ? recommendedStrongMin
                    : (!Double.isNaN(lowestNearZeroThreshold) ? lowestNearZeroThreshold : 0.98);

            report.text("ĐỀ XUẤT strongMin = %.2f — đây là ngưỡng thấp nhất trong dải quét mà số cặp KHÁC BÀI vượt",
                    strongMinProposal);
            report.text("bằng 0 (hoặc dưới 0.01%). Ở mức này việc LOẠI THẲNG câu ứng viên là an toàn: không có cặp");
            report.text("khác chủ đề nào đạt tới đó, nên điểm cao chỉ có thể đến từ trùng lặp thật.");
            report.text("");
            report.text("ĐỀ XUẤT reviewMin = %.2f — làm tròn lên từ p99 của nhóm khác bài (%.4f). Đặt thấp hơn mức này",
                    recommendedReviewMin, crossP99);
            report.text("sẽ đẩy hơn 1% số cặp KHÔNG liên quan vào hàng đợi xem lại; đặt cao hơn thì bỏ lọt vùng xám");
            report.text("giữa \"diễn đạt lại\" và \"trùng thật\" mà con người cần phán.");
            report.text("");
            report.text("So với cấu hình hiện tại (strongMin=%.2f, reviewMin=%.2f): chênh %+.2f / %+.2f.",
                    currentStrongMin, currentReviewMin,
                    strongMinProposal - currentStrongMin, recommendedReviewMin - currentReviewMin);
            report.text("LƯU Ý: đây là đề xuất rút ra từ %d câu hỏi SEED của một học phần. Ngân hàng câu hỏi thật của",
                    questionCount);
            report.text("bệnh viện trải rộng nhiều chuyên khoa và có nhiều câu diễn đạt lại hơn, nên PHẢI chạy lại phép");
            report.text("đo này trên dữ liệu thật trước khi chốt giá trị vào `application.yaml`.");

            // ── D. Top 15 cặp giống nhau nhất ──
            report.section("D. Top 15 cặp giống nhau nhất (đối xứng)");
            report.text("Đọc bằng mắt để tự phán: điểm cao ở đây có thật sự là trùng lặp, hay chỉ là cùng khuôn câu hỏi?");
            report.text("");
            report.columns("điểm", "bài A", "bài B", "stem A (rút gọn)", "stem B (rút gọn)");
            List<ScoredPair> rankedPairs = new ArrayList<>(topPairs);
            rankedPairs.sort(Comparator.comparingDouble(ScoredPair::score).reversed());
            for (ScoredPair pair : rankedPairs) {
                report.row(pair.score(),
                        corpus.lessons().get(pair.left()),
                        corpus.lessons().get(pair.right()),
                        shorten(corpus.stems().get(pair.left())),
                        shorten(corpus.stems().get(pair.right())));
            }

            // ── E. Độ chính xác của ANN so với quét toàn bộ ──
            report.section("E. Độ chính xác ANN (LSH) so với quét toàn bộ");
            report.text("Mỗi câu lần lượt làm truy vấn; index được dựng lại từ %d câu CÒN LẠI (leave-one-out) để",
                    questionCount - 1);
            report.text("chính nó không tự khớp với mình. recall@1 = tỉ lệ truy vấn mà ANN trả về ĐÚNG câu mà quét");
            report.text("toàn bộ tìm ra. Thời gian đo là searchBestMatch, KHÔNG tính thời gian rebuild index.");
            report.text("");
            report.columns("annLshBits", "annSearchK", "recall@1", "sai số điểm TB", "thời gian truy vấn TB (µs)");

            Map<String, AnnOutcome> annOutcomes = new LinkedHashMap<>();
            for (int lshBits : ANN_LSH_BITS_SWEEP) {
                for (int searchK : ANN_SEARCH_K_SWEEP) {
                    AnnOutcome outcome = evaluateAnnConfiguration(
                            corpus, symmetricVectors, lshBits, searchK, currentStrongMin, annIterations);
                    annOutcomes.put(lshBits + "/" + searchK, outcome);
                    checksum += outcome.checksum();
                    report.row(lshBits, searchK, outcome.recallAtOne(),
                            String.format(Locale.ROOT, "%.5f", outcome.meanScoreError()),
                            outcome.meanQueryMicros());
                }
            }
            report.text("");

            AnnOutcome defaultOutcome = annOutcomes.get(DEFAULT_ANN_LSH_BITS + "/" + DEFAULT_ANN_SEARCH_K);
            report.text("Cấu hình mặc định %d bits / k=%d: recall@1 = %.3f, %d truy vấn không tìm thấy ứng viên nào.",
                    DEFAULT_ANN_LSH_BITS, DEFAULT_ANN_SEARCH_K,
                    defaultOutcome.recallAtOne(), defaultOutcome.emptyResults());

            // Chọn cấu hình tốt nhất: ưu tiên recall, hoà thì lấy cái nhanh hơn.
            Map.Entry<String, AnnOutcome> best = annOutcomes.entrySet().stream()
                    .max(Comparator
                            .comparingDouble((Map.Entry<String, AnnOutcome> entry) -> entry.getValue().recallAtOne())
                            .thenComparing(entry -> -entry.getValue().meanQueryMicros()))
                    .orElseThrow();
            report.text("ĐỀ XUẤT cấu hình ANN: %s (recall@1=%.3f, %.1f µs/truy vấn) so với mặc định %d/%d",
                    best.getKey(), best.getValue().recallAtOne(), best.getValue().meanQueryMicros(),
                    DEFAULT_ANN_LSH_BITS, DEFAULT_ANN_SEARCH_K);
            report.text("(recall@1=%.3f, %.1f µs/truy vấn).",
                    defaultOutcome.recallAtOne(), defaultOutcome.meanQueryMicros());
            report.text("Ít bit băm ⇒ bucket to ⇒ nhiều ứng viên ⇒ recall cao nhưng chậm; nhiều bit ⇒ bucket nhỏ ⇒");
            report.text("nhanh nhưng dễ bỏ sót láng giềng thật. annSearchK là trần số ứng viên được verify chính xác,");
            report.text("nên tăng k chỉ giúp khi bucket đủ đông. Với ngân hàng vài trăm câu, chênh lệch thời gian là");
            report.text("micro-giây — hãy ưu tiên recall; chỉ khi ngân hàng lên hàng chục nghìn câu mới cần đánh đổi.");
            report.text("");
            report.text("Đối chiếu lý thuyết: với random projection, xác suất một láng giềng có cosine c rơi vào bucket");
            report.text("cách ≤1 bit là p^b + b·p^(b-1)·(1-p), với p = 1 - arccos(c)/π. Ở b=16 và cosine láng giềng");
            report.text("thực tế khoảng 0.85–0.90, con số này chỉ còn ~0.20–0.31. Nói cách khác 16 bit là QUÁ NHIỀU");
            report.text("cho ngân hàng vài trăm câu: 2^16 = 65536 bucket cho ~270 vector nên gần như mỗi câu nằm");
            report.text("một bucket riêng, và ANN bỏ sót phần lớn láng giềng thật. Nếu bảng trên xác nhận recall thấp");
            report.text("ở cấu hình mặc định thì nên giảm annLshBits, hoặc tắt ANN khi ngân hàng còn nhỏ — quét toàn");
            report.text("bộ vài trăm vector 384 chiều chỉ tốn cỡ 0.1 ms, rẻ hơn nhiều so với rủi ro bỏ lọt câu trùng.");

            report.note("Checksum (chống loại bỏ mã chết): %.6f", checksum);
            report.write();

            // ── F. Bất biến phải đúng trên mọi máy (không assert vào con số tuyệt đối) ──
            // Cận trên nới 1e-9: tích vô hướng của hai vector đã chuẩn hoá có thể vượt 1.0 vài ulp
            // do sai số dấu phẩy động, không phải lỗi logic.
            assertThat(symmetricVectors).allSatisfy(vector -> assertThat(vector).hasSize(384));
            assertThat(batchSymmetricVectors).allSatisfy(vector -> assertThat(vector).hasSize(384));
            assertThat(min(symmetricScores)).as("cosine đối xứng nhỏ nhất").isGreaterThanOrEqualTo(0d);
            assertThat(max(symmetricScores)).as("cosine đối xứng lớn nhất").isLessThanOrEqualTo(1d + 1e-9d);
            assertThat(min(asymmetricScores)).as("cosine bất đối xứng nhỏ nhất").isGreaterThanOrEqualTo(0d);
            assertThat(max(asymmetricScores)).as("cosine bất đối xứng lớn nhất").isLessThanOrEqualTo(1d + 1e-9d);

            for (int i = 0; i < questionCount; i++) {
                assertThat(CosineUtil.cosine(symmetricVectors.get(i), symmetricVectors.get(i)))
                        .as("cosine của câu %d với chính nó phải ≈ 1.0", i)
                        .isCloseTo(1.0d, org.assertj.core.data.Offset.offset(1e-6d));
            }

            assertThat(sameLessonMean)
                    .as("cặp cùng bài phải giống nhau hơn cặp khác bài — nếu không, pipeline nhúng đang hỏng")
                    .isGreaterThan(crossLessonMean);

            // CHỈ assert khoảng hợp lệ. KHÔNG assert recall > một mức cụ thể: với random-projection LSH,
            // xác suất láng giềng thật rơi vào bucket cách ≤1 bit là p^b + b·p^(b-1)·(1-p) với
            // p = 1 - arccos(cos)/π. Ở mặc định 16 bit và cosine láng giềng thực tế ~0.85–0.90, con số
            // đó chỉ khoảng 0.20–0.31 — một ngưỡng cứng kiểu "> 0.5" sẽ đỏ gần như mọi lần chạy.
            // Recall là KẾT QUẢ CẦN ĐO của benchmark này, không phải bất biến để assert.
            assertThat(defaultOutcome.recallAtOne())
                    .as("recall@1 của cấu hình ANN mặc định (%d bits, k=%d)",
                            DEFAULT_ANN_LSH_BITS, DEFAULT_ANN_SEARCH_K)
                    .isBetween(0d, 1d);
        } finally {
            // Giải phóng OrtSession/tokenizer native — không để rò rỉ sang test kế tiếp.
            embeddingService.close();
        }
    }

    /**
     * Đo một cấu hình LSH: dựng index leave-one-out cho từng truy vấn rồi so ANN với quét toàn bộ.
     *
     * <p>Mỗi cấu hình cần {@link AiEmbeddingProperties} MỚI vì {@code annLshBits} được đọc tại thời
     * điểm rebuild, và {@link AnnEmbeddingIndex} MỚI để không dính state của cấu hình trước.
     * {@code dataVersion} tăng đơn điệu vì index bỏ qua rebuild khi version trùng lần trước.</p>
     */
    private AnnOutcome evaluateAnnConfiguration(
            Corpus corpus,
            List<double[]> vectors,
            int lshBits,
            int searchK,
            double strongMin,
            int iterations
    ) {
        int questionCount = vectors.size();

        AiEmbeddingProperties properties = e5Properties();
        properties.setAnnEnabled(true);
        properties.setAnnLshBits(lshBits);
        properties.setAnnSearchK(searchK);
        AnnEmbeddingIndex index = new AnnEmbeddingIndex(properties);

        long dataVersion = 0;
        double checksum = 0;

        // Warmup phải đi ĐÚNG đường mã của vòng đo: câu truy vấn KHÔNG được nằm trong index.
        // Nếu để nó trong index, nó tự khớp với chính mình ở điểm 1.0 ≥ strongMin nên searchBestMatch
        // dừng sớm ngay ứng viên đầu tiên — JIT chỉ biên dịch nhánh ngắn đó và số đo sau bị lệch.
        List<QuestionEmbeddingSnapshot> warmupSnapshots = new ArrayList<>(questionCount - 1);
        for (int i = 1; i < questionCount; i++) {
            warmupSnapshots.add(new QuestionEmbeddingSnapshot((long) i, corpus.stems().get(i), vectors.get(i)));
        }
        index.rebuild(warmupSnapshots, ++dataVersion);
        for (int warmup = 0; warmup < ANN_WARMUP_RUNS; warmup++) {
            AnnEmbeddingIndex.SearchResult result = index.searchBestMatch(vectors.get(0), strongMin, searchK);
            checksum += result == null ? 0 : result.similarity();
        }

        int hits = 0;
        int emptyResults = 0;
        double scoreErrorSum = 0;
        long[] querySamples = new long[questionCount * iterations];
        int sampleIndex = 0;

        for (int queryIndex = 0; queryIndex < questionCount; queryIndex++) {
            // Index chỉ chứa các câu KHÁC câu truy vấn: nếu để chính nó trong index thì mọi truy vấn
            // đều khớp với chính mình ở điểm 1.0 và dừng sớm ngay, phép đo mất hết ý nghĩa.
            List<QuestionEmbeddingSnapshot> snapshots = new ArrayList<>(questionCount - 1);
            for (int i = 0; i < questionCount; i++) {
                if (i != queryIndex) {
                    snapshots.add(new QuestionEmbeddingSnapshot((long) i, corpus.stems().get(i), vectors.get(i)));
                }
            }
            index.rebuild(snapshots, ++dataVersion);

            // Chuẩn vàng: quét toàn bộ.
            double bruteForceScore = -1;
            long bruteForceId = -1;
            double[] queryVector = vectors.get(queryIndex);
            for (int i = 0; i < questionCount; i++) {
                if (i == queryIndex) {
                    continue;
                }
                double score = CosineUtil.cosine(queryVector, vectors.get(i));
                if (score > bruteForceScore) {
                    bruteForceScore = score;
                    bruteForceId = i;
                }
            }

            AnnEmbeddingIndex.SearchResult annResult = null;
            for (int iteration = 0; iteration < iterations; iteration++) {
                long start = System.nanoTime();
                AnnEmbeddingIndex.SearchResult result = index.searchBestMatch(queryVector, strongMin, searchK);
                querySamples[sampleIndex++] = System.nanoTime() - start;
                checksum += result == null ? 0 : result.similarity();
                if (iteration == 0) {
                    annResult = result;
                }
            }

            if (annResult == null) {
                emptyResults++;
                // Không tìm thấy gì = điểm 0 trên thực tế, sai số chính bằng điểm chuẩn vàng.
                scoreErrorSum += bruteForceScore;
            } else {
                if (annResult.questionId() != null && annResult.questionId() == bruteForceId) {
                    hits++;
                }
                scoreErrorSum += Math.abs(annResult.similarity() - bruteForceScore);
            }
        }

        BenchmarkReport.Stats queryStats = BenchmarkReport.stats(querySamples);
        return new AnnOutcome(
                (double) hits / questionCount,
                scoreErrorSum / questionCount,
                queryStats.meanMs() * 1000d,
                emptyResults,
                checksum
        );
    }

    private AiEmbeddingProperties e5Properties() {
        AiEmbeddingProperties properties = new AiEmbeddingProperties();
        properties.setProvider("e5");
        properties.setModelPath(MODEL_ROOT);
        // Nạp lười để đo được RIÊNG thời gian nạp model ở lần embed đầu tiên.
        properties.setPreload(false);
        properties.setBackfillOnStartup(false);
        return properties;
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
            // Lấy giãn đều trên TOÀN corpus bằng chỉ số tỉ lệ k*n/limit. Dùng bước nhảy cố định
            // (n/limit làm tròn xuống) sẽ dừng trước khi hết mảng — ví dụ n=270, limit=200 cho
            // bước 1 và chỉ lấy 200 câu ĐẦU, tức mất sạch Bài 8–9 và phá nhãn cùng bài/khác bài.
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

    /** Rút gọn stem về 30 ký tự và khử ký tự phá vỡ bảng markdown. */
    private static String shorten(String text) {
        String flattened = text.replace('|', '/').replaceAll("\\s+", " ").trim();
        return flattened.length() <= 30 ? flattened : flattened.substring(0, 30) + "…";
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

    private record ScoredPair(double score, int left, int right) {
    }

    private record AnnOutcome(
            double recallAtOne,
            double meanScoreError,
            double meanQueryMicros,
            int emptyResults,
            double checksum
    ) {
    }
}
