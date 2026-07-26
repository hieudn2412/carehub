package vn.vietduc.carehubbackend.questiongeneration.modelruntime.e5;

import ai.djl.huggingface.tokenizers.HuggingFaceTokenizer;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import vn.vietduc.carehubbackend.benchmark.BenchmarkReport;
import vn.vietduc.carehubbackend.common.util.CosineUtil;
import vn.vietduc.carehubbackend.questiongeneration.config.AiEmbeddingProperties;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Random;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/**
 * Benchmark hiệu năng cho {@link E5EmbeddingModelService} chạy trên model ONNX thật.
 *
 * <p>Mục tiêu không phải công bố con số tuyệt đối mà là ĐỊNH LƯỢNG các quyết định tối ưu
 * đã áp dụng trong mã nguồn, để khi ai đó muốn gỡ bỏ chúng thì có số liệu mà cân nhắc:</p>
 * <ul>
 *   <li>Vì sao phải batch thay vì gọi từng câu (phần C).</li>
 *   <li>Vì sao {@code embedBatch()} sắp xếp input theo độ dài token trước khi chia lô (phần D).</li>
 *   <li>Đặt {@code intraOpThreads} bao nhiêu thì hết lãi (phần E).</li>
 * </ul>
 *
 * <p>Benchmark bị TẮT mặc định vì mỗi lần chạy nạp vài trăm MB trọng số vào bộ nhớ native.
 * Bật bằng biến môi trường {@code RUN_E5_BENCH=true}. Trên Windows PowerShell:
 * {@code $env:RUN_E5_BENCH="true"; ./mvnw.cmd test -Dtest=E5EmbeddingBenchmarkTest}</p>
 *
 * <p>Các biến môi trường điều chỉnh khối lượng đo (mặc định để một lần chạy dưới ~5 phút):
 * {@code BENCH_ITERATIONS} (số mẫu đo độ trễ đơn lẻ mỗi nhóm, mặc định 30),
 * {@code BENCH_BATCH_ROUNDS} (số lượt lặp mỗi cấu hình batch, mặc định 3),
 * {@code BENCH_THREAD_ROUNDS} (số lượt lặp mỗi cấu hình luồng, mặc định 2),
 * {@code BENCH_VERIFY_SAMPLE} (số câu dùng kiểm chứng batch vs đơn lẻ, mặc định 64),
 * {@code BENCH_VECTOR_TOLERANCE} (ngưỡng CẢNH BÁO khi so khớp vector, mặc định 1e-6 —
 * chỉ để in cảnh báo vào báo cáo, KHÔNG dùng làm assert vì hai đường chạy hai shape tensor
 * khác nhau nên sai số float32 phụ thuộc build ONNX Runtime của từng máy).</p>
 *
 * <p>Test nằm trong package {@code ...modelruntime.e5} vì {@link E5EmbeddingModelService#close()}
 * là package-private — mỗi cấu hình giữ một {@code OrtSession} nên bắt buộc phải đóng tay.</p>
 */
@EnabledIfEnvironmentVariable(named = "RUN_E5_BENCH", matches = "true")
class E5EmbeddingBenchmarkTest {

    private static final Path MODEL_ROOT = Path.of("models", "intfloat", "multilingual-e5-small");
    private static final Path ONNX_FILE = MODEL_ROOT.resolve("onnx").resolve("model.onnx");
    private static final Path TOKENIZER_FILE = MODEL_ROOT.resolve("onnx").resolve("tokenizer.json");
    private static final Path CORPUS_FILE =
            Path.of("src", "main", "resources", "question-bank", "hospital-review-questions.json");

    /** Chiều vector của multilingual-e5-small — bất biến của model, không phụ thuộc máy chạy. */
    private static final int EXPECTED_DIMENSION = 384;

    /** batchSize dùng cho các phép đo không sweep batchSize (khớp mặc định của production). */
    private static final int DEFAULT_BATCH_SIZE = 32;

    /** Số lượt chạy bỏ đi trước mỗi phép đo, để JIT kịp biên dịch và ONNX kịp cấp phát arena. */
    private static final int WARMUP_ROUNDS = 3;

    /** Số câu dùng cho lượt warmup batch — nhỏ để warmup ở batchSize=1 không tốn hàng chục giây. */
    private static final int WARMUP_CORPUS_SIZE = 64;

    /**
     * Tổng dồn giá trị lấy từ mỗi vector trả về. Không có biến này JIT có quyền loại bỏ
     * toàn bộ vòng lặp đo vì kết quả không được dùng ở đâu (dead-code elimination).
     */
    private double checksum;

    @Test
    void doHieuNangNhungE5TrenCorpusCauHoiThat() throws Exception {
        assumeTrue(Files.isRegularFile(ONNX_FILE), "Thiếu model E5: " + ONNX_FILE.toAbsolutePath());
        assumeTrue(Files.isRegularFile(TOKENIZER_FILE), "Thiếu tokenizer E5: " + TOKENIZER_FILE.toAbsolutePath());
        assumeTrue(Files.isRegularFile(CORPUS_FILE), "Thiếu corpus: " + CORPUS_FILE.toAbsolutePath());

        // Chặn dưới ở 1: BENCH_* nhận từ môi trường nên phải chịu được giá trị 0 hoặc âm,
        // nếu không sẽ chia cho 0 và ra NaN trong bảng số ký tự trung bình.
        int latencySamples = Math.max(1, envInt("BENCH_ITERATIONS", 30));
        int batchRounds = Math.max(1, envInt("BENCH_BATCH_ROUNDS", 3));
        int threadRounds = Math.max(1, envInt("BENCH_THREAD_ROUNDS", 2));
        int verifySample = Math.max(1, envInt("BENCH_VERIFY_SAMPLE", 64));
        double vectorTolerance = envDouble("BENCH_VECTOR_TOLERANCE", 1e-6);

        List<String> stems = loadStems();
        assertThat(stems).as("Corpus phải có câu hỏi thì mới đo được").isNotEmpty();

        List<String> warmupCorpus = stems.subList(0, Math.min(WARMUP_CORPUS_SIZE, stems.size()));

        BenchmarkReport report = BenchmarkReport.of("Benchmark E5 multilingual-e5-small");
        report.note("Model: %s", ONNX_FILE.toAbsolutePath());
        report.note("Corpus: %d câu hỏi y tế tiếng Việt từ %s", stems.size(), CORPUS_FILE);
        report.note("Máy chạy: os=%s, java=%s, availableProcessors=%d, maxMemory=%d MB",
                System.getProperty("os.name"),
                System.getProperty("java.version"),
                Runtime.getRuntime().availableProcessors(),
                Runtime.getRuntime().maxMemory() / (1024 * 1024));
        report.note("Cấu hình đo: latencySamples=%d, batchRounds=%d, threadRounds=%d, verifySample=%d, "
                        + "maxLength=%d, interOpThreads=%d",
                latencySamples, batchRounds, threadRounds, verifySample,
                new AiEmbeddingProperties().getMaxLength(), new AiEmbeddingProperties().getInterOpThreads());
        report.note("Warmup: %d lượt bỏ đi trước mỗi phép đo (batch warmup dùng %d câu đầu)",
                WARMUP_ROUNDS, warmupCorpus.size());
        report.note("Con số chỉ so sánh được TRONG CÙNG một lần chạy trên cùng một máy.");

        try {
            AiEmbeddingProperties sharedProperties = embeddingProperties(DEFAULT_BATCH_SIZE, -1);
            E5EmbeddingModelService service = new E5EmbeddingModelService(sharedProperties);
            try {
                measureColdStart(report, service, stems);
                measureSingleLatencyByLength(report, service, stems, latencySamples);
                measureBatchSizeSweep(report, service, sharedProperties, stems, warmupCorpus, batchRounds);
                measurePaddingWaste(report, service, stems, batchRounds);
                verifyBatchMatchesSingle(report, service, stems, verifySample, vectorTolerance);
            } finally {
                // Giải phóng OrtSession trước khi phần E tạo các session mới, tránh giữ
                // nhiều bản trọng số cùng lúc trong bộ nhớ native.
                service.close();
            }

            measureIntraOpThreadSweep(report, stems, warmupCorpus, threadRounds);
        } finally {
            // Ghi báo cáo kể cả khi một assert phía trên ném: số đo đã thu được vẫn có giá trị
            // chẩn đoán, và người chạy cần thấy chúng để biết cấu hình nào hỏng.
            report.section("Phụ lục");
            report.note("Checksum tích luỹ (chỉ để chặn dead-code elimination, không mang ý nghĩa): %.6f",
                    checksum);
            report.write();
        }
    }

    // ── A. Cold start ──────────────────────────────────────────────────────────────

    /**
     * Model được nạp LƯỜI trong {@code ensureRuntime()} nên lần embed đầu tiên trên một
     * instance mới gánh cả chi phí đọc 449 MB trọng số + tạo OrtSession. Đo riêng để chi phí
     * này không lẫn vào các số đo inference phía sau.
     */
    private void measureColdStart(BenchmarkReport report, E5EmbeddingModelService service, List<String> stems) {
        String probe = stems.get(0);

        long coldStartNanos = System.nanoTime();
        double[] firstVector = service.embedSymmetric(probe);
        long coldNanos = System.nanoTime() - coldStartNanos;
        checksum += firstVector[0];

        // Lần gọi thứ hai VẪN CÒN NGUỘI: JIT chưa biên dịch đường nóng, ONNX Runtime chưa
        // ổn định arena cho shape này. Lấy nó làm mốc "đã ấm" sẽ ĐÁNH GIÁ THẤP chi phí nạp
        // model, nên phải warmup rồi mới đo mốc ấm thật sự.
        long secondStartNanos = System.nanoTime();
        double[] secondVector = service.embedSymmetric(probe);
        long secondNanos = System.nanoTime() - secondStartNanos;
        checksum += secondVector[0];

        for (int i = 0; i < WARMUP_ROUNDS; i++) {
            checksum += service.embedSymmetric(probe)[0];
        }

        long[] warmNanos = new long[WARMUP_ROUNDS];
        for (int i = 0; i < warmNanos.length; i++) {
            long start = System.nanoTime();
            double[] vector = service.embedSymmetric(probe);
            warmNanos[i] = System.nanoTime() - start;
            checksum += vector[0];
        }

        double coldMs = coldNanos / 1_000_000d;
        double secondMs = secondNanos / 1_000_000d;
        double warmMs = BenchmarkReport.stats(warmNanos).p50Ms();

        report.section("A. Cold start (nạp model + inference đầu tiên)");
        report.text("- Lần embed ĐẦU TIÊN trên instance mới (gồm nạp trọng số + tạo OrtSession): **%.3f ms**", coldMs);
        report.text("- Lần embed thứ hai (chưa warmup, còn nguội): **%.3f ms**", secondMs);
        report.text("- Lần embed đã warmup %d lượt, p50 của %d mẫu: **%.3f ms**", WARMUP_ROUNDS, warmNanos.length, warmMs);
        report.text("- Chi phí nạp model ước tính = lần đầu trừ mốc đã ấm: **%.3f ms**", coldMs - warmMs);
        report.text("");
        report.text("Đây là lý do `ai.embedding.preload=true` ở production: nếu để lười, request đầu "
                + "tiên chạm vào tính năng dedup sẽ phải trả toàn bộ chi phí nạp model.");
    }

    // ── B. Độ trễ đơn lẻ theo độ dài văn bản ───────────────────────────────────────

    /**
     * Chia corpus thành ba nhóm theo phân vị 33/66 của độ dài ký tự rồi đo riêng từng nhóm.
     * Transformer có chi phí tăng theo độ dài chuỗi, nên gộp chung mọi độ dài vào một con số
     * trung bình sẽ che mất phần đuôi — thứ quyết định p95 mà người dùng thực sự cảm nhận.
     */
    private void measureSingleLatencyByLength(
            BenchmarkReport report,
            E5EmbeddingModelService service,
            List<String> stems,
            int samplesPerGroup
    ) {
        double[] lengths = new double[stems.size()];
        for (int i = 0; i < stems.size(); i++) {
            lengths[i] = stems.get(i).length();
        }
        double shortBoundary = BenchmarkReport.percentileOf(lengths, 0.33);
        double mediumBoundary = BenchmarkReport.percentileOf(lengths, 0.66);

        List<String> shortGroup = new ArrayList<>();
        List<String> mediumGroup = new ArrayList<>();
        List<String> longGroup = new ArrayList<>();
        for (String stem : stems) {
            if (stem.length() <= shortBoundary) {
                shortGroup.add(stem);
            } else if (stem.length() <= mediumBoundary) {
                mediumGroup.add(stem);
            } else {
                longGroup.add(stem);
            }
        }

        report.section("B. Độ trễ nhúng ĐƠN LẺ theo độ dài văn bản");
        report.text("Ranh giới phân vị độ dài ký tự: p33 = %.0f, p66 = %.0f "
                        + "→ kích thước nhóm: ngắn=%d, vừa=%d, dài=%d.",
                shortBoundary, mediumBoundary, shortGroup.size(), mediumGroup.size(), longGroup.size());
        report.text("Mỗi nhóm lấy %d mẫu đo, câu được chọn theo bước nhảy đều để trải khắp nhóm.",
                samplesPerGroup);
        report.text("");
        report.columns("Nhóm", "Số ký tự TB", "Số mẫu", "mean(ms)", "p50(ms)", "p95(ms)");

        measureGroupLatency(report, service, "Ngắn", shortGroup, samplesPerGroup);
        measureGroupLatency(report, service, "Vừa", mediumGroup, samplesPerGroup);
        measureGroupLatency(report, service, "Dài", longGroup, samplesPerGroup);
    }

    private void measureGroupLatency(
            BenchmarkReport report,
            E5EmbeddingModelService service,
            String label,
            List<String> group,
            int samples
    ) {
        if (group.isEmpty()) {
            return;
        }

        // Warmup riêng cho từng nhóm: độ dài chuỗi khác nhau tạo shape tensor khác nhau,
        // ONNX Runtime cấp phát lại bộ đệm cho shape mới ở lần chạy đầu.
        for (int i = 0; i < WARMUP_ROUNDS; i++) {
            checksum += service.embedSymmetric(group.get(i % group.size()))[0];
        }

        // Trải mẫu đều khắp nhóm thay vì chỉ lấy N câu đầu: corpus xếp theo "Bài" nên N câu đầu
        // của một nhóm thường cùng một bài, giống nhau cả về độ dài lẫn từ vựng — đo chúng
        // không đại diện cho cả nhóm.
        int stride = Math.max(1, group.size() / Math.max(1, samples));

        long[] samplesNanos = new long[samples];
        long totalChars = 0;
        for (int i = 0; i < samples; i++) {
            String stem = group.get((i * stride) % group.size());
            totalChars += stem.length();
            long start = System.nanoTime();
            double[] vector = service.embedSymmetric(stem);
            samplesNanos[i] = System.nanoTime() - start;
            checksum += vector[0];
        }

        BenchmarkReport.Stats stats = BenchmarkReport.stats(samplesNanos);
        double averageChars = (double) totalChars / samples;
        report.row(label, averageChars, stats.count(), stats.meanMs(), stats.p50Ms(), stats.p95Ms());
    }

    // ── C. Sweep batchSize ─────────────────────────────────────────────────────────

    /**
     * Đo lợi ích của việc gom lô. Mỗi lần gọi {@code session.run()} có chi phí cố định
     * (dựng tensor, vào/ra JNI, đồng bộ luồng); batch chia chi phí đó cho nhiều câu.
     *
     * <p>Mốc so sánh là đường ĐƠN LẺ {@code embedSymmetric()} gọi từng câu — đúng hành vi của
     * phiên bản trước khi có batch. {@code batchSize=1} KHÔNG phải mốc đó: nó vẫn đi qua
     * {@code embedBatch()} (tokenize gộp một lượt, sắp xếp theo độ dài) nên đã rẻ hơn sẵn.
     * Lẫn hai thứ này với nhau sẽ thổi phồng hoặc bóp méo con số "nhanh gấp".</p>
     */
    private void measureBatchSizeSweep(
            BenchmarkReport report,
            E5EmbeddingModelService service,
            AiEmbeddingProperties properties,
            List<String> stems,
            List<String> warmupCorpus,
            int rounds
    ) {
        int[] batchSizes = {1, 8, 16, 32, 64};

        report.section("C. Lợi ích của gom lô trên toàn corpus (" + stems.size() + " câu)");
        report.text("Mốc so sánh là đường ĐƠN LẺ: gọi `embedSymmetric()` cho từng câu — mỗi câu một "
                + "lần `session.run()` với tensor shape [1, L], đúng hành vi trước khi có batch.");
        report.text("`batchSize=1` KHÔNG đồng nghĩa với mốc đó: nó vẫn chạy qua `embedBatch()` "
                + "(tokenize gộp, sắp xếp theo độ dài) nên đã rẻ hơn đường đơn lẻ đôi chút.");
        report.text("Mỗi cấu hình chạy %d lượt sau warmup; cột tổng(ms) là trung bình các lượt.", rounds);
        report.text("");
        report.columns("Cấu hình", "tổng(ms)", "câu/giây", "nhanh gấp mốc đơn lẻ");

        double singleMs = measureSinglePass(service, stems, warmupCorpus, rounds);
        report.row("đơn lẻ (embedSymmetric)", singleMs, stems.size() / (singleMs / 1000d), 1.0d);

        double batch1Ms = 0;
        double batch32Ms = 0;
        for (int batchSize : batchSizes) {
            properties.setBatchSize(batchSize);
            double meanMs = measureFullPass(service, stems, warmupCorpus, rounds);
            double throughput = stems.size() / (meanMs / 1000d);

            if (batchSize == 1) {
                batch1Ms = meanMs;
            }
            if (batchSize == DEFAULT_BATCH_SIZE) {
                batch32Ms = meanMs;
            }
            report.row("batchSize=" + batchSize, meanMs, throughput, singleMs / meanMs);
        }

        // Trả properties về mặc định NGAY sau vòng sweep, trước cả assert: không để trạng thái
        // dùng chung mắc kẹt ở giá trị cuối vòng lặp (64) nếu ai đó thêm assert mềm về sau.
        properties.setBatchSize(DEFAULT_BATCH_SIZE);

        // Bất biến định tính, không phụ thuộc máy: gom lô luôn rẻ hơn gọi từng câu một.
        // Không assert vào bất kỳ con số tuyệt đối hay hệ số tăng tốc cụ thể nào.
        assertThat(batch32Ms)
                .as("batchSize=%d phải nhanh hơn đường đơn lẻ trên cùng corpus", DEFAULT_BATCH_SIZE)
                .isLessThan(singleMs);
        assertThat(batch32Ms)
                .as("batchSize=%d phải nhanh hơn batchSize=1 trên cùng corpus", DEFAULT_BATCH_SIZE)
                .isLessThan(batch1Ms);
    }

    /**
     * Quét toàn corpus bằng đường ĐƠN LẺ và trả về thời gian trung bình mỗi lượt (ms).
     * Đây là mốc "trước khi có batch" mà phần C so sánh vào.
     */
    private double measureSinglePass(
            E5EmbeddingModelService service,
            List<String> corpus,
            List<String> warmupCorpus,
            int rounds
    ) {
        for (int i = 0; i < WARMUP_ROUNDS; i++) {
            for (String text : warmupCorpus) {
                checksum += service.embedSymmetric(text)[0];
            }
        }

        long[] roundNanos = new long[Math.max(1, rounds)];
        for (int round = 0; round < roundNanos.length; round++) {
            double roundChecksum = 0;
            long start = System.nanoTime();
            for (String text : corpus) {
                roundChecksum += service.embedSymmetric(text)[0];
            }
            roundNanos[round] = System.nanoTime() - start;
            checksum += roundChecksum;
        }
        return BenchmarkReport.stats(roundNanos).meanMs();
    }

    /** Chạy {@code rounds} lượt nhúng toàn corpus và trả về thời gian trung bình mỗi lượt (ms). */
    private double measureFullPass(
            E5EmbeddingModelService service,
            List<String> corpus,
            List<String> warmupCorpus,
            int rounds
    ) {
        for (int i = 0; i < WARMUP_ROUNDS; i++) {
            consume(service.embedSymmetricBatch(warmupCorpus));
        }

        long[] roundNanos = new long[Math.max(1, rounds)];
        for (int round = 0; round < roundNanos.length; round++) {
            long start = System.nanoTime();
            List<double[]> vectors = service.embedSymmetricBatch(corpus);
            roundNanos[round] = System.nanoTime() - start;
            consume(vectors);
        }
        return BenchmarkReport.stats(roundNanos).meanMs();
    }

    // ── D. Định lượng tối ưu "sắp xếp theo độ dài trước khi chia lô" ────────────────

    /**
     * {@code embedBatch()} sắp xếp input theo độ dài token rồi mới chia lô, vì mỗi lô bị pad
     * về câu dài nhất trong lô. Vì việc sắp xếp nằm BÊN TRONG service, mọi thứ tự đầu vào đều
     * được hưởng lợi như nhau — nên đo thời gian tường chỉ chứng minh được "thứ tự đầu vào
     * không còn quan trọng". Muốn thấy tối ưu này đáng giá bao nhiêu thì phải tính chi phí
     * padding LÝ THUYẾT: so tổng token thật với tổng token sau khi pad theo từng cách chia lô.
     */
    private void measurePaddingWaste(
            BenchmarkReport report,
            E5EmbeddingModelService service,
            List<String> stems,
            int rounds
    ) throws IOException {
        List<TokenizedStem> original = tokenizeCorpus(stems);

        List<TokenizedStem> shuffled = new ArrayList<>(original);
        Collections.shuffle(shuffled, new Random(42));

        List<TokenizedStem> sorted = new ArrayList<>(original);
        sorted.sort(Comparator.comparingInt(TokenizedStem::tokenLength));

        // Trường hợp xấu nhất cho padding: xen kẽ câu ngắn nhất với câu dài nhất, nên
        // lô nào cũng chứa cả hai thái cực và phải pad về độ dài lớn nhất của corpus.
        List<TokenizedStem> interleaved = interleaveExtremes(sorted);

        PaddingCost originalCost = paddingCost(original, DEFAULT_BATCH_SIZE);
        PaddingCost shuffledCost = paddingCost(shuffled, DEFAULT_BATCH_SIZE);
        PaddingCost interleavedCost = paddingCost(interleaved, DEFAULT_BATCH_SIZE);
        PaddingCost sortedCost = paddingCost(sorted, DEFAULT_BATCH_SIZE);

        report.section("D. Chi phí padding theo cách chia lô (batchSize=" + DEFAULT_BATCH_SIZE + ")");
        report.text("Token đếm bằng chính tokenizer của model trên văn bản đã qua "
                + "`E5TextPreprocessor.symmetric()` — tức đúng chuỗi mà service đưa vào ONNX.");
        report.text("");
        report.columns("Cách chia lô", "tổng token thật", "tổng token sau pad", "lãng phí %");
        report.row("Thứ tự gốc (JSON)", originalCost.realTokens(), originalCost.paddedTokens(),
                originalCost.wastePercent());
        report.row("Trộn ngẫu nhiên (seed 42)", shuffledCost.realTokens(), shuffledCost.paddedTokens(),
                shuffledCost.wastePercent());
        report.row("Xen kẽ ngắn/dài (xấu nhất)", interleavedCost.realTokens(), interleavedCost.paddedTokens(),
                interleavedCost.wastePercent());
        report.row("Sắp xếp theo độ dài (service làm)", sortedCost.realTokens(), sortedCost.paddedTokens(),
                sortedCost.wastePercent());
        report.text("");
        report.text("Sắp xếp trước khi chia lô cắt được **%.1f điểm phần trăm** lãng phí so với thứ tự gốc "
                        + "và **%.1f điểm phần trăm** so với trường hợp xấu nhất.",
                originalCost.wastePercent() - sortedCost.wastePercent(),
                interleavedCost.wastePercent() - sortedCost.wastePercent());

        // Các assert dưới đây TẤT ĐỊNH: chúng chỉ phụ thuộc corpus trong repo, không phụ thuộc
        // máy chạy hay thời gian, nên không thể bập bênh.
        // Lưu ý về mặt lý thuyết: "sắp xếp cho tổng token sau pad nhỏ nhất" KHÔNG phải định lý
        // đúng với mọi dữ liệu — khi lô cuối ngắn hơn các lô khác, vẫn dựng được phản ví dụ
        // (batchSize=2, độ dài {1,10,10}: sắp xếp cho 30, còn {10,10},{1} cho 21). Với phân bố
        // độ dài thực của corpus này thì sắp xếp thắng áp đảo, và đó chính là điều cần đo.
        assertThat(sortedCost.paddedTokens())
                .as("Sắp xếp theo độ dài phải giảm được padding so với thứ tự gốc")
                .isLessThanOrEqualTo(originalCost.paddedTokens());
        assertThat(sortedCost.paddedTokens())
                .as("Sắp xếp theo độ dài phải giảm được padding so với thứ tự trộn ngẫu nhiên")
                .isLessThanOrEqualTo(shuffledCost.paddedTokens());
        assertThat(sortedCost.paddedTokens())
                .as("Sắp xếp theo độ dài phải giảm được padding so với trường hợp xấu nhất")
                .isLessThanOrEqualTo(interleavedCost.paddedTokens());
        assertThat(sortedCost.paddedTokens())
                .as("Tổng token sau pad không bao giờ nhỏ hơn tổng token thật")
                .isGreaterThanOrEqualTo(sortedCost.realTokens());

        // Đo thời gian tường của hai thứ tự đầu vào để xác nhận: nhờ sắp xếp bên trong,
        // thứ tự người gọi truyền vào KHÔNG còn ảnh hưởng đáng kể tới thời gian chạy.
        List<String> shuffledTexts = textsOf(shuffled);
        List<String> interleavedTexts = textsOf(interleaved);
        List<String> warmupCorpus = shuffledTexts.subList(0, Math.min(WARMUP_CORPUS_SIZE, shuffledTexts.size()));

        double shuffledMs = measureFullPass(service, shuffledTexts, warmupCorpus, rounds);
        double interleavedMs = measureFullPass(service, interleavedTexts, warmupCorpus, rounds);

        report.text("");
        report.columns("Thứ tự đầu vào", "tổng(ms)", "câu/giây");
        report.row("Trộn ngẫu nhiên (seed 42)", shuffledMs, stems.size() / (shuffledMs / 1000d));
        report.row("Xen kẽ ngắn/dài (xấu nhất)", interleavedMs, stems.size() / (interleavedMs / 1000d));
        report.text("");
        report.text("Hai dòng trên gần bằng nhau là ĐÚNG KỲ VỌNG: service sắp xếp lại input trước khi "
                + "chia lô nên cả hai thứ tự đều quy về cùng một cách chia lô tối ưu.");
    }

    /** Đếm token bằng chính tokenizer của model, áp cùng giới hạn cắt như service. */
    private List<TokenizedStem> tokenizeCorpus(List<String> stems) throws IOException {
        int maxLength = new AiEmbeddingProperties().getMaxLength();
        List<TokenizedStem> tokenized = new ArrayList<>(stems.size());
        try (HuggingFaceTokenizer tokenizer = HuggingFaceTokenizer.newInstance(TOKENIZER_FILE)) {
            for (String stem : stems) {
                int tokenLength = tokenizer.encode(E5TextPreprocessor.symmetric(stem)).getIds().length;
                tokenized.add(new TokenizedStem(stem, Math.min(tokenLength, maxLength)));
            }
        }
        return tokenized;
    }

    /** Xen kẽ hai đầu của danh sách đã sắp xếp: ngắn nhất, dài nhất, ngắn nhì, dài nhì... */
    private static List<TokenizedStem> interleaveExtremes(List<TokenizedStem> sortedAscending) {
        List<TokenizedStem> result = new ArrayList<>(sortedAscending.size());
        int low = 0;
        int high = sortedAscending.size() - 1;
        while (low <= high) {
            result.add(sortedAscending.get(low++));
            if (low <= high) {
                result.add(sortedAscending.get(high--));
            }
        }
        return result;
    }

    /** Tổng token thật và tổng token sau khi pad mỗi lô về câu dài nhất của lô đó. */
    private static PaddingCost paddingCost(List<TokenizedStem> arrangement, int batchSize) {
        long realTokens = 0;
        long paddedTokens = 0;
        for (int offset = 0; offset < arrangement.size(); offset += batchSize) {
            int end = Math.min(offset + batchSize, arrangement.size());
            int maxSeqLen = 0;
            for (int i = offset; i < end; i++) {
                int tokenLength = arrangement.get(i).tokenLength();
                realTokens += tokenLength;
                maxSeqLen = Math.max(maxSeqLen, tokenLength);
            }
            paddedTokens += (long) maxSeqLen * (end - offset);
        }
        return new PaddingCost(realTokens, paddedTokens);
    }

    private static List<String> textsOf(List<TokenizedStem> tokenized) {
        List<String> texts = new ArrayList<>(tokenized.size());
        for (TokenizedStem item : tokenized) {
            texts.add(item.stem());
        }
        return texts;
    }

    // ── E. Sweep intraOpThreads ────────────────────────────────────────────────────

    /**
     * {@code intraOpThreads} được nạp vào {@code OrtSession.SessionOptions} lúc tạo session,
     * nên đổi giá trị bắt buộc phải dựng service MỚI. Mỗi service giữ một bản trọng số trong
     * bộ nhớ native, vì vậy phải {@code close()} cấu hình cũ trước khi mở cấu hình kế tiếp.
     */
    private void measureIntraOpThreadSweep(
            BenchmarkReport report,
            List<String> stems,
            List<String> warmupCorpus,
            int rounds
    ) {
        int availableProcessors = Runtime.getRuntime().availableProcessors();
        Set<Integer> threadCounts = new LinkedHashSet<>(List.of(1, 2, 4, Math.max(1, availableProcessors - 1)));
        threadCounts.removeIf(value -> value <= 0 || value > availableProcessors);

        report.section("E. Sweep intraOpThreads (batchSize=" + DEFAULT_BATCH_SIZE
                + ", corpus " + stems.size() + " câu)");
        report.text("Máy có %d CPU khả dụng; mặc định của service là `intraOpThreads=-1` "
                + "→ tự chọn %d luồng.", availableProcessors, Math.max(1, availableProcessors - 1));
        report.text("Mỗi cấu hình dùng một OrtSession mới, session cũ được đóng trước khi mở session sau.");
        report.text("");
        report.columns("intraOpThreads", "tổng(ms)", "câu/giây");

        for (int threads : threadCounts) {
            AiEmbeddingProperties properties = embeddingProperties(DEFAULT_BATCH_SIZE, threads);
            E5EmbeddingModelService service = new E5EmbeddingModelService(properties);
            try {
                double meanMs = measureFullPass(service, stems, warmupCorpus, rounds);
                report.row(threads, meanMs, stems.size() / (meanMs / 1000d));
            } finally {
                service.close();
            }
        }
    }

    // ── F. Kiểm chứng tính đúng ────────────────────────────────────────────────────

    /**
     * Đây là ASSERT thật, không phải phép đo. {@code embedBatch()} sắp xếp lại input theo độ dài
     * rồi phải trả kết quả về đúng vị trí ban đầu qua mảng {@code order}. Nếu bước khôi phục thứ tự
     * sai, vector sẽ bị gán nhầm câu — lỗi này không làm test nào khác đỏ, nhưng phá âm thầm
     * toàn bộ tính năng chống trùng. So batch với đường đơn lẻ trên input ĐÃ TRỘN sẽ bắt được ngay.
     *
     * <p>KHÔNG assert "hai đường cho vector bằng nhau tới 1e-6": đường đơn lẻ chạy tensor
     * {@code [1, L]} còn đường batch chạy {@code [size, maxSeqLen]} có padding, nên thứ tự cộng dồn
     * float32 và cả kernel GEMM được chọn đều khác nhau — sai số là chuyện bình thường và phụ thuộc
     * build ONNX Runtime của từng máy. Bất biến ĐÚNG cho bước khôi phục thứ tự là: vector batch của
     * câu i phải giống vector đơn lẻ của CHÍNH câu i hơn của mọi câu khác trong mẫu. Nếu ánh xạ
     * {@code order[]} sai thì vector rơi sang câu khác và khoảng cách lệch ở mức O(1), lớn hơn mọi
     * sai số số học hàng chục bậc. Độ lệch phần tử vẫn được ĐO và ghi vào báo cáo.</p>
     */
    private void verifyBatchMatchesSingle(
            BenchmarkReport report,
            E5EmbeddingModelService service,
            List<String> stems,
            int sampleSize,
            double warnTolerance
    ) {
        List<String> shuffled = new ArrayList<>(stems);
        Collections.shuffle(shuffled, new Random(7));
        List<String> sample = shuffled.subList(0, Math.min(Math.max(1, sampleSize), shuffled.size()));

        List<double[]> batchVectors = service.embedSymmetricBatch(sample);
        assertThat(batchVectors)
                .as("Batch phải trả đúng số vector bằng số câu đầu vào")
                .hasSize(sample.size());

        List<double[]> singleVectors = new ArrayList<>(sample.size());
        double maxNormDeviation = 0;
        double maxElementDeviation = 0;
        for (int i = 0; i < sample.size(); i++) {
            double[] batchVector = batchVectors.get(i);
            assertThat(batchVector)
                    .as("Vector câu thứ %d phải có đúng %d chiều", i, EXPECTED_DIMENSION)
                    .hasSize(EXPECTED_DIMENSION);

            double batchNorm = l2Norm(batchVector);
            assertThat(batchNorm)
                    .as("Vector batch của câu thứ %d phải đã được chuẩn hoá L2", i)
                    .isCloseTo(1.0d, within(1e-6d));

            double[] singleVector = service.embedSymmetric(sample.get(i));
            assertThat(singleVector)
                    .as("Đường nhúng đơn lẻ cũng phải trả đúng %d chiều", EXPECTED_DIMENSION)
                    .hasSize(EXPECTED_DIMENSION);

            double singleNorm = l2Norm(singleVector);
            assertThat(singleNorm)
                    .as("Vector đơn lẻ của câu thứ %d phải đã được chuẩn hoá L2", i)
                    .isCloseTo(1.0d, within(1e-6d));

            maxNormDeviation = Math.max(maxNormDeviation,
                    Math.max(Math.abs(batchNorm - 1.0d), Math.abs(singleNorm - 1.0d)));
            for (int dim = 0; dim < EXPECTED_DIMENSION; dim++) {
                maxElementDeviation = Math.max(maxElementDeviation,
                        Math.abs(batchVector[dim] - singleVector[dim]));
            }
            singleVectors.add(singleVector);
            checksum += batchVector[0] + singleVector[0];
        }

        // "Gần nhất phải là chính nó": bắt lỗi khôi phục thứ tự mà không phụ thuộc sai số float32.
        int misplaced = 0;
        double minSelfSimilarity = 1;
        double maxRivalSimilarity = 0;
        for (int i = 0; i < sample.size(); i++) {
            double selfSimilarity = CosineUtil.cosine(batchVectors.get(i), singleVectors.get(i));
            double bestRivalSimilarity = 0;
            for (int j = 0; j < sample.size(); j++) {
                if (j != i) {
                    bestRivalSimilarity = Math.max(bestRivalSimilarity,
                            CosineUtil.cosine(batchVectors.get(i), singleVectors.get(j)));
                }
            }
            if (selfSimilarity <= bestRivalSimilarity) {
                misplaced++;
            }
            minSelfSimilarity = Math.min(minSelfSimilarity, selfSimilarity);
            maxRivalSimilarity = Math.max(maxRivalSimilarity, bestRivalSimilarity);
        }

        assertThat(misplaced)
                .as("Vector batch phải gần vector đơn lẻ của CHÍNH câu đó nhất — lệch đi nghĩa là "
                        + "bước khôi phục thứ tự trong embedBatch() gán vector sang nhầm câu")
                .isZero();

        report.section("F. Kiểm chứng tính đúng (assert thật, không phải phép đo)");
        report.text("- Số câu kiểm chứng: %d (lấy từ danh sách đã trộn để bước sắp xếp bên trong "
                + "thực sự đảo thứ tự)", sample.size());
        report.text("- Số chiều vector: %d ✓", EXPECTED_DIMENSION);
        report.text("- Lệch chuẩn L2 lớn nhất so với 1.0: %.3e (dung sai assert 1e-6)", maxNormDeviation);
        report.text("- Số câu bị gán nhầm vector giữa batch và đơn lẻ: %d ✓", misplaced);
        report.text("- cosine(batch_i, đơn lẻ_i) thấp nhất: %.6f — cosine cao nhất với một câu KHÁC: %.6f",
                minSelfSimilarity, maxRivalSimilarity);
        report.text("- Lệch phần tử lớn nhất giữa batch và đơn lẻ: %.3e (ngưỡng cảnh báo %.1e)",
                maxElementDeviation, warnTolerance);
        if (maxElementDeviation > warnTolerance) {
            report.text("");
            report.text("CẢNH BÁO: hai đường cho vector lệch quá ngưỡng. Nếu độ lệch lớn hơn hẳn mức "
                    + "sai số float32 (cỡ 1e-5 trở xuống) thì nghi vấn nằm ở khâu gộp trung bình của "
                    + "đường batch: `embedBatch()` đưa vào `toBatchVectors()` mask CHƯA pad (dài L của "
                    + "từng câu) trong khi tensor output có `maxSeqLen` hàng, mà `meanPool()` chỉ bỏ qua "
                    + "vị trí có `attentionMask[token] == 0` — mọi vị trí vượt quá `attentionMask.length` "
                    + "bị COI LÀ HỢP LỆ và bị tính vào trung bình. Xem `E5EmbeddingModelService`.");
        }
    }

    private static double l2Norm(double[] vector) {
        double sum = 0;
        for (double value : vector) {
            sum += value * value;
        }
        return Math.sqrt(sum);
    }

    // ── Hạ tầng dùng chung ─────────────────────────────────────────────────────────

    private AiEmbeddingProperties embeddingProperties(int batchSize, int intraOpThreads) {
        AiEmbeddingProperties properties = new AiEmbeddingProperties();
        properties.setProvider("e5");
        properties.setModelPath(MODEL_ROOT);
        // Tắt preload để phần A đo được chi phí nạp model một cách rõ ràng.
        properties.setPreload(false);
        properties.setBackfillOnStartup(false);
        properties.setBatchSize(batchSize);
        properties.setIntraOpThreads(intraOpThreads);
        return properties;
    }

    private List<String> loadStems() throws IOException {
        JsonNode root = new ObjectMapper().readTree(CORPUS_FILE.toFile());
        List<String> stems = new ArrayList<>();
        for (JsonNode question : root.path("questions")) {
            String stem = question.path("stem").asText("");
            if (!stem.isBlank()) {
                stems.add(stem);
            }
        }
        return stems;
    }

    /** Chạm vào từng vector để JIT không loại bỏ lời gọi nhúng khỏi vòng lặp đo. */
    private void consume(List<double[]> vectors) {
        for (double[] vector : vectors) {
            if (vector != null && vector.length > 0) {
                checksum += vector[0];
            }
        }
    }

    private static int envInt(String name, int fallback) {
        try {
            return Integer.parseInt(System.getenv().getOrDefault(name, String.valueOf(fallback)).trim());
        } catch (NumberFormatException ex) {
            return fallback;
        }
    }

    private static double envDouble(String name, double fallback) {
        try {
            return Double.parseDouble(System.getenv().getOrDefault(name, String.valueOf(fallback)).trim());
        } catch (NumberFormatException ex) {
            return fallback;
        }
    }

    /** Một câu hỏi kèm độ dài token thật của nó — dữ liệu đầu vào cho bài toán chia lô. */
    private record TokenizedStem(String stem, int tokenLength) {
    }

    /** Tổng token trước và sau khi pad, dùng để quy tối ưu sắp xếp ra một con số. */
    private record PaddingCost(long realTokens, long paddedTokens) {
        double wastePercent() {
            return realTokens == 0 ? 0d : (paddedTokens - realTokens) * 100d / realTokens;
        }
    }
}
