package vn.vietduc.carehubbackend.questiongeneration.modelruntime.vietquill;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import vn.vietduc.carehubbackend.benchmark.BenchmarkReport;
import vn.vietduc.carehubbackend.questiongeneration.config.AiParaphraseProperties;
import vn.vietduc.carehubbackend.questiongeneration.modelruntime.ParaphraseModelException;
import vn.vietduc.carehubbackend.questiongeneration.modelruntime.ParaphraseModelInput;
import vn.vietduc.carehubbackend.questiongeneration.modelruntime.ParaphrasedMcq;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.lang.management.ManagementFactory;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/**
 * Benchmark đường paraphrase VietQuill ViT5-base (encoder + decoder ONNX rời).
 *
 * <p><b>Vì sao cần benchmark riêng cho VietQuill</b> — khác với E5 (chỉ một lượt encoder),
 * VietQuill là seq2seq sinh tự hồi quy: mỗi câu phải chạy encoder một lần rồi chạy decoder
 * hàng chục lần. Do {@code ai.paraphrase.kv-cache-enabled} mặc định tắt, mỗi bước decode
 * chạy lại decoder trên TOÀN BỘ prefix đã sinh → chi phí tăng theo bình phương độ dài đầu ra.
 * Các phép đo dưới đây nhằm định lượng đúng đặc tính đó, thay vì chỉ đưa ra một con số
 * "trung bình" không diễn giải được.</p>
 *
 * <p><b>Bốn hiểu lầm mà benchmark này làm rõ</b>:</p>
 * <ol>
 *   <li>{@code num-beams} KHÔNG phải beam width thật. {@code generateCandidates()} tính
 *       {@code desiredBeamWidth = max(numBeams, max(requestedCount*2, requestedCount+3))};
 *       với {@code requestedCount=3} thì sàn luôn là 6, nên chỉnh {@code num-beams} trong
 *       khoảng 1..6 gần như KHÔNG đổi thời gian chạy.</li>
 *   <li>{@code max-decode-length} mới là tham số chi phối chi phí, và chi phí tăng siêu tuyến tính.</li>
 *   <li>{@code paraphrase-options=true} chạy {@code generateCandidates()} 5 lần (stem + 4 phương án)
 *       thay vì 1 → đắt gấp khoảng 5 lần.</li>
 *   <li>Áp lực cấp phát bộ nhớ đến từ tensor logits {@code [1, seqLen, 36153]} đọc ở mỗi bước decode.</li>
 * </ol>
 *
 * <p><b>Mặc định TẮT</b>: mỗi cấu hình phải nạp lại 2 model (question + sentence), mỗi model
 * gồm encoder ~431 MB và decoder ~645 MB → một lần chạy đầy đủ tốn nhiều GB RAM native và
 * nhiều phút. Bật bằng {@code RUN_VIETQUILL_BENCH=true}. Trên Windows PowerShell:
 * {@code $env:RUN_VIETQUILL_BENCH="true"; ./mvnw.cmd test -Dtest=VietQuillParaphraseBenchmarkTest}</p>
 *
 * <p>Các biến môi trường điều chỉnh khối lượng đo (mặc định để ưu tiên số lượt nạp model tối thiểu):
 * {@code BENCH_SOURCE_QUESTIONS} (số câu nguồn mỗi phép đo, mặc định 5),
 * {@code BENCH_ITERATIONS} (số lượt quét lại danh sách câu nguồn, mặc định 1),
 * {@code BENCH_WARMUP_ROUNDS} (số lượt warmup bỏ đi trước mỗi phép đo, mặc định 3),
 * {@code VIETQUILL_MODEL_PATH} (thư mục model).</p>
 *
 * <p><b>Quản lý bộ nhớ native</b>: mỗi {@link VietQuillHandlePool} giữ {@code poolSize} handle,
 * mỗi handle 4 {@code OrtSession} (encoder/decoder × question/sentence) ≈ 2 GB.
 * {@code OrtSession} chỉ được tạo một lần trong {@code loadSingleRuntime()}, nên MỖI cấu hình
 * bắt buộc phải dùng service + pool MỚI, và service cũ phải {@code close()} TRƯỚC khi tạo cái
 * mới — nếu không JVM sẽ hết bộ nhớ native giữa chừng.</p>
 *
 * <p>Không assert vào con số tuyệt đối (máy khác cho số khác); chỉ assert các bất biến hành vi
 * ở phần G.</p>
 */
@EnabledIfEnvironmentVariable(named = "RUN_VIETQUILL_BENCH", matches = "true")
class VietQuillParaphraseBenchmarkTest {

    private static final String REPORT_TITLE = "Benchmark VietQuill ViT5-base";
    private static final Path DEFAULT_MODEL_ROOT =
            Path.of("models", "ngwgsang", "vietquill-vit5-base-tsubaki");
    private static final Path CORPUS_PATH =
            Path.of("src", "main", "resources", "question-bank", "hospital-review-questions.json");

    private static final int REQUESTED_COUNT = 3;
    private static final String BASELINE_STRENGTH = "medium";
    private static final int BASELINE_NUM_BEAMS = 2;
    private static final int BASELINE_MAX_DECODE_LENGTH = 96;
    /** Timeout nới rộng: phép đo có thể chạy vài phút, không được để timeout cắt ngang. */
    private static final int BENCH_TIMEOUT_SECONDS = 300;
    private static final double MEGABYTE = 1024d * 1024d;

    /**
     * Số lượt chạy BỎ ĐI trước mỗi phép đo. Lượt đầu nạp model và cho ONNX Runtime cấp phát arena;
     * các lượt sau để JIT biên dịch xong phần Java nặng của vòng lặp decode ({@code topTokens},
     * {@code sequenceSimilarity} trong bộ chọn ứng viên) — nếu chỉ warmup một lượt thì cấu hình đo
     * ĐẦU TIÊN sẽ mang thêm chi phí biên dịch mà các cấu hình sau không có, làm bảng so sánh lệch.
     * Hạ xuống 1 bằng {@code BENCH_WARMUP_ROUNDS=1} nếu cần rút ngắn thời gian chạy.
     */
    private static final int DEFAULT_WARMUP_ROUNDS = 3;

    /**
     * Số lượt quét lại toàn bộ danh sách câu nguồn trong mỗi phép đo. Mặc định 1 vì mỗi cấu hình
     * đã phải nạp lại ~2 GB model; tăng bằng {@code BENCH_ITERATIONS} khi cần phân vị đáng tin hơn.
     */
    private static final int DEFAULT_ITERATIONS = 1;

    /** Đọc một lần ở đầu test rồi dùng chung cho mọi phép đo. */
    private int warmupRounds = DEFAULT_WARMUP_ROUNDS;
    private int iterations = DEFAULT_ITERATIONS;

    @Test
    void doVaBaoCaoHieuNangParaphraseVietQuill() {
        warmupRounds = readIntEnv("BENCH_WARMUP_ROUNDS", DEFAULT_WARMUP_ROUNDS);
        iterations = readIntEnv("BENCH_ITERATIONS", DEFAULT_ITERATIONS);

        Path modelRoot = resolveModelRoot();
        Path questionRoot = modelRoot.resolve("question");
        Path sentenceRoot = modelRoot.resolve("sentence");
        assumeSeq2SeqFiles(questionRoot);
        assumeSeq2SeqFiles(sentenceRoot);

        List<SourceQuestion> sources = loadSourceQuestions();
        assumeTrue(!sources.isEmpty(), "Không đọc được câu hỏi nguồn từ corpus");

        BenchmarkReport report = BenchmarkReport.of(REPORT_TITLE);
        VariantCollector collector = new VariantCollector();
        writeEnvironmentNotes(report, modelRoot, sources);

        // ── A. Thời gian nạp model (cold) ─────────────────────────────────────────────
        ColdStart coldStart = measureColdStart(report, modelRoot, sources.get(0), collector);

        // ── Cấu hình CƠ SỞ, đo một lần rồi tái sử dụng ở các bảng B/C/D/F ─────────────
        // Nạp lại model cho từng ô của từng bảng sẽ tốn thêm ~5 lượt nạp × hàng chục giây
        // mà không thêm thông tin gì, nên cấu hình numBeams=2 / maxDecodeLength=96 /
        // paraphraseOptions=false / changeStrength=medium được đo MỘT lần và dùng chung.
        // Đây cũng là cấu hình dùng để đo áp lực cấp phát bộ nhớ (phép đo E).
        AllocationProbe allocationProbe = AllocationProbe.create();
        Measurement baseline;
        long allocatedBytes;
        AiParaphraseProperties baselineProperties = benchmarkProperties(modelRoot, properties -> {
            properties.setNumBeams(BASELINE_NUM_BEAMS);
            properties.setMaxDecodeLength(BASELINE_MAX_DECODE_LENGTH);
            properties.setParaphraseOptions(false);
        });
        VietQuillParaphraseModelService baselineService = newService(baselineProperties);
        try {
            // Warmup: lần chạy đầu nạp model + JIT của ONNX Runtime, phải LOẠI khỏi số đo.
            warmup(baselineService, sources.get(0), BASELINE_STRENGTH);
            long allocatedBefore = allocationProbe.snapshotBytes();
            baseline = measure(baselineService, sources, BASELINE_STRENGTH, false, collector);
            allocatedBytes = allocationProbe.snapshotBytes() - allocatedBefore;
        } finally {
            baselineService.close();
        }

        // ── B. Độ trễ theo numBeams ───────────────────────────────────────────────────
        Map<Integer, Measurement> beamMeasurements = new LinkedHashMap<>();
        beamMeasurements.put(BASELINE_NUM_BEAMS, baseline);
        for (int numBeams : new int[]{1, 4, 6}) {
            beamMeasurements.put(numBeams, measureWithFreshService(
                    modelRoot,
                    sources,
                    collector,
                    BASELINE_STRENGTH,
                    properties -> {
                        properties.setNumBeams(numBeams);
                        properties.setMaxDecodeLength(BASELINE_MAX_DECODE_LENGTH);
                        properties.setParaphraseOptions(false);
                    }
            ));
        }
        writeBeamSection(report, beamMeasurements);

        // ── C. Ảnh hưởng của maxDecodeLength ──────────────────────────────────────────
        Map<Integer, Measurement> decodeLengthMeasurements = new LinkedHashMap<>();
        decodeLengthMeasurements.put(BASELINE_MAX_DECODE_LENGTH, baseline);
        for (int maxDecodeLength : new int[]{48, 160}) {
            decodeLengthMeasurements.put(maxDecodeLength, measureWithFreshService(
                    modelRoot,
                    sources,
                    collector,
                    BASELINE_STRENGTH,
                    properties -> {
                        properties.setNumBeams(BASELINE_NUM_BEAMS);
                        properties.setMaxDecodeLength(maxDecodeLength);
                        properties.setParaphraseOptions(false);
                    }
            ));
        }
        writeDecodeLengthSection(report, decodeLengthMeasurements);

        // ── D. Ảnh hưởng của paraphraseOptions ────────────────────────────────────────
        Measurement optionsEnabled = measureWithFreshService(
                modelRoot,
                sources,
                collector,
                BASELINE_STRENGTH,
                properties -> {
                    properties.setNumBeams(BASELINE_NUM_BEAMS);
                    properties.setMaxDecodeLength(BASELINE_MAX_DECODE_LENGTH);
                    properties.setParaphraseOptions(true);
                }
        );
        writeParaphraseOptionsSection(report, baseline, optionsEnabled);

        // ── E. Áp lực cấp phát bộ nhớ ─────────────────────────────────────────────────
        writeAllocationSection(report, allocationProbe, allocatedBytes, baseline);

        // ── F. Tỉ lệ chấp nhận biến thể theo changeStrength ───────────────────────────
        Map<String, Measurement> strengthMeasurements = new LinkedHashMap<>();
        strengthMeasurements.put(BASELINE_STRENGTH, baseline);
        for (String changeStrength : new String[]{"low", "high"}) {
            strengthMeasurements.put(changeStrength, measureWithFreshService(
                    modelRoot,
                    sources,
                    collector,
                    changeStrength,
                    properties -> {
                        properties.setNumBeams(BASELINE_NUM_BEAMS);
                        properties.setMaxDecodeLength(BASELINE_MAX_DECODE_LENGTH);
                        properties.setParaphraseOptions(false);
                    }
            ));
        }
        writeChangeStrengthSection(report, strengthMeasurements);

        // Checksum: buộc JIT phải giữ lại kết quả của mọi vòng lặp đo (chống dead-code elimination).
        report.section("Tổng kết");
        report.note("Checksum nội dung biến thể (chống loại bỏ mã chết): %d", collector.checksum());
        report.note("Tổng số biến thể thu thập được qua mọi cấu hình: %d", collector.variants().size());
        report.note("Cold start đã đo ở phần A: %.3f ms", coldStart.coldMs());
        report.write();

        // ── G. Assert các bất biến hành vi (KHÔNG assert con số tuyệt đối) ────────────
        assertBehaviouralInvariants(collector);
    }

    // ══════════════════════════════════════════════════════════════════════════════════
    // Phép đo A — cold start
    // ══════════════════════════════════════════════════════════════════════════════════

    /**
     * Đo riêng chi phí nạp model. Lần {@code paraphrase()} đầu tiên trên một service mới
     * (preload=false, poolSize=1) kích hoạt {@code ensureInitialized()} → nạp CẢ HAI model
     * question và sentence, mỗi model gồm encoder + decoder ONNX. Lần thứ hai chạy trên
     * session đã sẵn sàng, nên hiệu số xấp xỉ thời gian nạp thuần.
     */
    private ColdStart measureColdStart(
            BenchmarkReport report,
            Path modelRoot,
            SourceQuestion source,
            VariantCollector collector
    ) {
        AiParaphraseProperties properties = benchmarkProperties(modelRoot, unused -> {
            unused.setNumBeams(BASELINE_NUM_BEAMS);
            unused.setMaxDecodeLength(BASELINE_MAX_DECODE_LENGTH);
            unused.setParaphraseOptions(false);
        });
        properties.setPreload(false);
        properties.setPoolSize(1);

        VietQuillParaphraseModelService service = newService(properties);
        double coldMs;
        double warmMs;
        try {
            // optionsPreserved=true vì cấu hình này để paraphraseOptions=false — bốn phương án
            // phải được giữ nguyên, và phần G sẽ kiểm chứng đúng bất biến đó.
            long startedAt = System.nanoTime();
            collector.accept(source, safeParaphrase(service, source, BASELINE_STRENGTH), true);
            coldMs = toMillis(System.nanoTime() - startedAt);

            startedAt = System.nanoTime();
            collector.accept(source, safeParaphrase(service, source, BASELINE_STRENGTH), true);
            warmMs = toMillis(System.nanoTime() - startedAt);
        } finally {
            // Giải phóng ~2 GB bộ nhớ native trước khi nạp cấu hình tiếp theo.
            service.close();
        }

        report.section("A. Thời gian nạp model (cold start)");
        report.columns("giai đoạn", "thời gian (ms)");
        report.row("cold — nạp model + paraphrase lần đầu", coldMs);
        report.row("warm — paraphrase lần thứ hai trên cùng session", warmMs);
        report.row("ước lượng thời gian nạp thuần (cold − warm)", Math.max(0, coldMs - warmMs));
        report.text("");
        report.text("Con số cold GỒM CẢ việc nạp hai model: `question/` và `sentence/`, mỗi model là"
                + " encoder ~431 MB + decoder ~645 MB, tức khoảng 2 GB đọc từ đĩa và khởi tạo"
                + " OrtSession với OptLevel.ALL_OPT. Vì `preload=false`, chi phí này rơi vào"
                + " REQUEST ĐẦU TIÊN của người dùng thật; bật `ai.paraphrase.preload=true` sẽ dời"
                + " nó về lúc khởi động ứng dụng.");
        report.text("Phép đo này chạy ĐẦU TIÊN, trước mọi cấu hình khác, nên đây là con số cold thật:"
                + " các lần nạp sau đã có sẵn ~2 GB trọng số trong page cache của hệ điều hành và sẽ"
                + " nhanh hơn đáng kể — đừng lấy chúng làm chuẩn cho request đầu tiên của production.");
        report.text("Mọi bảng phía sau đều warmup %d lượt trước khi đo, nên thời gian nạp KHÔNG lẫn"
                + " vào số liệu.", warmupRounds);
        return new ColdStart(coldMs, warmMs);
    }

    // ══════════════════════════════════════════════════════════════════════════════════
    // Phép đo B — numBeams
    // ══════════════════════════════════════════════════════════════════════════════════

    private void writeBeamSection(
            BenchmarkReport report,
            Map<Integer, Measurement> measurements
    ) {
        report.section("B. Độ trễ đầu-cuối theo numBeams");
        report.text("requestedCount=%d, changeStrength=%s, paraphraseOptions=false, maxDecodeLength=%d.",
                REQUESTED_COUNT, BASELINE_STRENGTH, BASELINE_MAX_DECODE_LENGTH);
        report.text("");
        report.columns(
                "numBeams (config)",
                "beam width thật",
                "số mẫu",
                "mean(ms)",
                "p50(ms)",
                "p95(ms)",
                "số biến thể thu được"
        );
        List<Integer> beamValues = new ArrayList<>(measurements.keySet());
        beamValues.sort(Integer::compareTo);
        for (Integer numBeams : beamValues) {
            Measurement measurement = measurements.get(numBeams);
            BenchmarkReport.Stats stats = BenchmarkReport.stats(measurement.samplesNanos());
            report.row(
                    numBeams,
                    effectiveBeamWidth(numBeams, REQUESTED_COUNT),
                    stats.count(),
                    stats.meanMs(),
                    stats.p50Ms(),
                    stats.p95Ms(),
                    measurement.variantCount()
            );
        }
        report.text("");
        report.text("**Phát hiện quan trọng — `num-beams` gần như KHÔNG có tác dụng ở dải 1..6.**"
                + " `generateCandidates()` nâng beam width lên cho đủ ứng viên để"
                + " `VietQuillCandidateSelector` sàng lọc:");
        report.text("");
        report.text("```");
        report.text("candidatePoolSize  = max(requestedCount * 2, requestedCount + 3)");
        report.text("desiredBeamWidth   = max(numBeams, candidatePoolSize)");
        report.text("```");
        report.text("");
        report.text("Với requestedCount=%d thì candidatePoolSize = %d, nên MỌI giá trị numBeams ≤ %d"
                        + " đều bị kéo lên đúng %d. Đó là lý do bốn hàng trên có thời gian gần như nhau"
                        + " (chênh lệch còn lại là nhiễu đo, không phải tác động của tham số).",
                REQUESTED_COUNT,
                candidatePoolSize(REQUESTED_COUNT),
                candidatePoolSize(REQUESTED_COUNT),
                candidatePoolSize(REQUESTED_COUNT));
        report.text("Hệ quả vận hành: muốn giảm độ trễ thì phải giảm `requestedCount` (kéo sàn beam"
                + " width xuống) hoặc `max-decode-length`, chứ chỉnh `num-beams` là vô ích."
                + " Ngược lại, đặt `num-beams` > %d mới thật sự làm chậm hệ thống.",
                candidatePoolSize(REQUESTED_COUNT));
        report.text("");
        report.text("**Cách đọc phân vị**: mỗi MẪU là MỘT lần gọi `paraphrase()` cho MỘT câu nguồn,"
                + " chạy tuần tự trên pool 1 handle. Vì các mẫu đến từ những câu nguồn dài ngắn khác"
                + " nhau, phân vị ở đây phản ánh cả biến thiên độ dài đầu vào chứ không chỉ nhiễu giữa"
                + " các lần chạy. So sánh GIỮA CÁC HÀNG vẫn công bằng vì mọi cấu hình dùng đúng cùng"
                + " một bộ câu nguồn theo đúng thứ tự. Muốn phân vị phản ánh nhiễu thuần tuý thì tăng"
                + " `BENCH_ITERATIONS` (đang là %d) để mỗi câu được đo lặp lại nhiều lượt.", iterations);
    }

    // ══════════════════════════════════════════════════════════════════════════════════
    // Phép đo C — maxDecodeLength
    // ══════════════════════════════════════════════════════════════════════════════════

    private void writeDecodeLengthSection(BenchmarkReport report, Map<Integer, Measurement> measurements) {
        report.section("C. Ảnh hưởng của maxDecodeLength (chi phí O(n²) của đường không KV-cache)");
        report.text("numBeams=%d, requestedCount=%d, paraphraseOptions=false, changeStrength=%s.",
                BASELINE_NUM_BEAMS, REQUESTED_COUNT, BASELINE_STRENGTH);
        report.text("");
        report.columns("maxDecodeLength", "mean(ms)", "p50(ms)", "ms trên mỗi token tối đa");
        List<Integer> lengths = new ArrayList<>(measurements.keySet());
        lengths.sort(Integer::compareTo);
        double shortestMean = 0;
        int shortestLength = 0;
        double longestMean = 0;
        int longestLength = 0;
        for (Integer maxDecodeLength : lengths) {
            BenchmarkReport.Stats stats = BenchmarkReport.stats(measurements.get(maxDecodeLength).samplesNanos());
            report.row(
                    maxDecodeLength,
                    stats.meanMs(),
                    stats.p50Ms(),
                    stats.meanMs() / maxDecodeLength
            );
            if (shortestLength == 0) {
                shortestLength = maxDecodeLength;
                shortestMean = stats.meanMs();
            }
            longestLength = maxDecodeLength;
            longestMean = stats.meanMs();
        }
        report.text("");
        report.text("Cột cuối là mean chia cho maxDecodeLength — nếu chi phí TUYẾN TÍNH theo số token"
                + " sinh ra thì cột này phải gần như HẰNG SỐ giữa các hàng.");
        if (shortestLength > 0 && shortestMean > 0) {
            double lengthRatio = (double) longestLength / shortestLength;
            double timeRatio = longestMean / shortestMean;
            report.text("Ở lần chạy này: tăng maxDecodeLength gấp %.3f lần làm thời gian tăng %.3f lần.",
                    lengthRatio, timeRatio);
            report.text(timeRatio > lengthRatio
                    ? "Thời gian tăng NHANH HƠN độ dài → siêu tuyến tính, đúng như dự đoán."
                    : "Thời gian tăng chậm hơn độ dài ở lần chạy này — thường do beam kết thúc sớm bằng"
                    + " eos_token_id trước khi chạm trần, nên trần chỉ là giới hạn trên chứ không phải"
                    + " số bước thực tế.");
        }
        report.text("");
        report.text("**Vì sao siêu tuyến tính**: `ai.paraphrase.kv-cache-enabled` mặc định false, nên"
                + " `beamDecode()` gọi `decodeLogits()` với TOÀN BỘ prefix `decoder_input_ids` ở mỗi"
                + " bước. Bước thứ n phải chạy lại self-attention trên n token thay vì 1 token, nên"
                + " tổng chi phí là 1+2+...+n = O(n²) thay vì O(n). Cộng thêm: tensor logits trả về"
                + " có shape [1, n, 36153] và cũng lớn dần theo n.");
        report.text("Lưu ý đọc số: số bước decode THỰC TẾ là min(maxOutputLength, maxDecodeLength) và"
                + " beam có thể dừng sớm khi gặp eos_token_id=1, nên maxDecodeLength là TRẦN chứ không"
                + " phải số bước chắc chắn chạy. Vì vậy hiệu ứng O(n²) chỉ bộc lộ rõ khi câu nguồn đủ"
                + " dài để beam chạm trần.");
    }

    // ══════════════════════════════════════════════════════════════════════════════════
    // Phép đo D — paraphraseOptions
    // ══════════════════════════════════════════════════════════════════════════════════

    private void writeParaphraseOptionsSection(
            BenchmarkReport report,
            Measurement optionsDisabled,
            Measurement optionsEnabled
    ) {
        BenchmarkReport.Stats disabledStats = BenchmarkReport.stats(optionsDisabled.samplesNanos());
        BenchmarkReport.Stats enabledStats = BenchmarkReport.stats(optionsEnabled.samplesNanos());
        double slowdown = disabledStats.meanMs() > 0
                ? enabledStats.meanMs() / disabledStats.meanMs()
                : 0;

        report.section("D. Ảnh hưởng của paraphraseOptions");
        report.text("numBeams=%d, requestedCount=%d, changeStrength=%s, maxDecodeLength=%d.",
                BASELINE_NUM_BEAMS, REQUESTED_COUNT, BASELINE_STRENGTH, BASELINE_MAX_DECODE_LENGTH);
        report.text("");
        report.columns("paraphraseOptions", "mean(ms)", "nhanh/chậm gấp");
        report.row("false (mặc định)", disabledStats.meanMs(), 1.0d);
        report.row("true", enabledStats.meanMs(), slowdown);
        report.text("");
        report.text("**Vì sao chậm khoảng 5 lần**: khi `paraphraseOptions=false`, `fieldCandidates()`"
                + " trả về `Collections.nCopies(count, source)` — bốn phương án được GIỮ NGUYÊN, không"
                + " chạy model. Mỗi câu chỉ tốn ĐÚNG MỘT lượt `generateCandidates()` cho phần stem"
                + " (dùng model `question/`).");
        report.text("Khi bật true, mỗi phương án A/B/C/D chạy thêm một lượt `generateCandidates()` đầy"
                + " đủ trên model `sentence/` → 5 lượt encode + 5 chuỗi beam decode cho MỘT câu hỏi,"
                + " tức TRẦN lý thuyết là chậm gấp ≈ 5 lần.");
        if (slowdown >= 3d) {
            report.text("Đo được %.3f lần — cùng bậc với trần lý thuyết. Phần còn thiếu so với 5 lần"
                    + " đến từ việc bốn phương án ngắn hơn stem nhiều nên beam gặp `eos_token_id` sớm"
                    + " và chạy ít bước decode hơn.", slowdown);
        } else {
            report.text("Đo được %.3f lần — THẤP HƠN HẲN trần lý thuyết ≈ 5 lần. Nguyên nhân thường"
                    + " gặp: bốn phương án ngắn hơn stem rất nhiều nên mỗi lượt decode phương án rẻ hơn"
                    + " hẳn lượt decode stem, và `VietQuillStructuralRewriter` có thể trả sẵn đủ ứng"
                    + " viên cho chuỗi ngắn khiến bộ chọn dừng sớm. Đừng đọc con số này như bằng chứng"
                    + " rằng bật tuỳ chọn là rẻ — nó vẫn nhân số lượt chạy model lên 5.", slowdown);
        }
        report.text("Hệ quả vận hành: bật `paraphrase-options` không chỉ đắt gấp 5 mà còn rủi ro về"
                + " chất lượng (diễn đạt lại đáp án đúng có thể làm sai y khoa) — đó là lý do mặc định"
                + " để false.");
    }

    // ══════════════════════════════════════════════════════════════════════════════════
    // Phép đo E — áp lực cấp phát bộ nhớ
    // ══════════════════════════════════════════════════════════════════════════════════

    private void writeAllocationSection(
            BenchmarkReport report,
            AllocationProbe probe,
            long allocatedBytes,
            Measurement baseline
    ) {
        int paraphraseCalls = Math.max(1, baseline.callCount());
        double totalMb = allocatedBytes / MEGABYTE;
        double perCallMb = totalMb / paraphraseCalls;

        report.section("E. Áp lực cấp phát bộ nhớ mỗi lần paraphrase");
        report.text("Đo trên cấu hình cơ sở (numBeams=%d, maxDecodeLength=%d, paraphraseOptions=false),"
                        + " SAU warmup nên KHÔNG gồm bộ nhớ nạp model.",
                BASELINE_NUM_BEAMS, BASELINE_MAX_DECODE_LENGTH);
        report.text("");
        report.columns("phương pháp đo", "số lần paraphrase", "tổng cấp phát (MB)", "MB / lần paraphrase");
        report.row(probe.methodName(), paraphraseCalls, totalMb, perCallMb);
        report.text("");
        if (probe.precise()) {
            report.text("Cách đo: cộng `ThreadMXBean.getThreadAllocatedBytes(id)` cho thread chạy test"
                    + " và các thread `vietquill-inference`, chụp trước và sau phép đo. Không dùng"
                    + " `getCurrentThreadAllocatedBytes()` vì beam decode chạy trên thread executor"
                    + " riêng nên thread test không thấy phần cấp phát đó; cũng không cộng MỌI thread"
                    + " vì như vậy sẽ lẫn cả rác của Surefire và logger vào con số.");
            report.text("Sai số đã biết: nếu một thread inference bị thu hồi giữa hai lần chụp thì phần"
                    + " đóng góp của nó biến mất; ngược lại phần tokenize và ghi log chạy trên đúng hai"
                    + " loại thread này vẫn bị tính vào. Vì vậy đây là con số XẤP XỈ, dùng để so sánh"
                    + " tương đối chứ không phải số tuyệt đối.");
        } else {
            report.text("CẢNH BÁO: JVM này không hỗ trợ `com.sun.management.ThreadMXBean"
                    + ".getThreadAllocatedBytes`, đã fallback sang"
                    + " `Runtime.totalMemory() - Runtime.freeMemory()` kèm `System.gc()`."
                    + " Đây chỉ là ƯỚC LƯỢNG THÔ: GC có thể chạy giữa chừng và thu hồi bớt, nên con số"
                    + " thường THẤP HƠN nhiều so với tổng cấp phát thật.");
        }
        report.text("");
        report.text("**So với lý thuyết**: mỗi bước decode đọc tensor logits shape [1, seqLen, 36153]."
                + " Nếu materialize thành mảng Java lồng nhau `float[1][seqLen][36153]` thì riêng bước"
                + " thứ 100 đã cấp phát 100 × 36153 × 4 byte ≈ %.1f MB, và tổng qua %d bước là"
                + " ≈ %.1f MB CHỈ cho logits của MỘT beam.",
                (100d * 36153d * 4d) / MEGABYTE,
                BASELINE_MAX_DECODE_LENGTH,
                triangularLogitsMegabytes(BASELINE_MAX_DECODE_LENGTH));
        report.text("Tối ưu hiện tại đọc logits qua `FloatBuffer` và chỉ lấy HÀNG CUỐI (36153 float"
                + " ≈ %.3f MB mỗi bước, hằng số theo seqLen) thay vì cả tensor. Vì vậy con số MB/lần"
                + " đo được ở trên nhỏ hơn hẳn ước lượng lý thuyết phía trên — chênh lệch đó chính là"
                + " phần tiết kiệm được.",
                (36153d * 4d) / MEGABYTE);
    }

    /** Tổng MB nếu materialize toàn bộ tensor logits ở mọi bước decode: sum(n × vocab × 4 byte). */
    private static double triangularLogitsMegabytes(int steps) {
        double totalBytes = ((double) steps * (steps + 1) / 2d) * 36153d * 4d;
        return totalBytes / MEGABYTE;
    }

    // ══════════════════════════════════════════════════════════════════════════════════
    // Phép đo F — changeStrength
    // ══════════════════════════════════════════════════════════════════════════════════

    private void writeChangeStrengthSection(
            BenchmarkReport report,
            Map<String, Measurement> measurements
    ) {
        report.section("F. Tỉ lệ chấp nhận biến thể theo changeStrength");
        report.text("numBeams=%d, requestedCount=%d, paraphraseOptions=false. `VietQuillCandidateSelector`"
                + " loại ứng viên theo hai ngưỡng: mức thay đổi tối thiểu và độ giữ lại từ khoá nội dung.",
                BASELINE_NUM_BEAMS, REQUESTED_COUNT);
        report.text("");
        report.columns(
                "changeStrength",
                "số lần gọi",
                "yêu cầu / lần",
                "thu được TB / lần",
                "tỉ lệ đạt (%)",
                "số lần không ra biến thể nào",
                "mean(ms)"
        );
        String bestStrength = null;
        double bestRate = -1;
        for (String changeStrength : new String[]{"low", "medium", "high"}) {
            Measurement measurement = measurements.get(changeStrength);
            if (measurement == null) {
                continue;
            }
            BenchmarkReport.Stats stats = BenchmarkReport.stats(measurement.samplesNanos());
            int callCount = Math.max(1, measurement.callCount());
            double averageObtained = (double) measurement.variantCount() / callCount;
            double successRate = 100d * measurement.variantCount() / (callCount * REQUESTED_COUNT);
            report.row(
                    changeStrength,
                    callCount,
                    REQUESTED_COUNT,
                    averageObtained,
                    successRate,
                    measurement.emptyCount(),
                    stats.meanMs()
            );
            if (successRate > bestRate) {
                bestRate = successRate;
                bestStrength = changeStrength;
            }
        }
        report.text("");
        report.text("Ngưỡng lọc theo từng mức (trong `DiversityTarget.forStrength`):");
        report.text("");
        report.columns("changeStrength", "minimumChange", "preferredChange", "minimumCoverage");
        report.row("low", 0.08d, 0.18d, 0.65d);
        report.row("medium", 0.22d, 0.32d, 0.58d);
        report.row("high", 0.22d, 0.42d, 0.60d);
        report.text("");
        if (bestStrength != null) {
            report.text("Mức đạt tỉ lệ tốt nhất trong lần chạy này: **%s** (%.3f%%).", bestStrength, bestRate);
        }
        report.text("Cách đọc: `low` đòi hỏi thay đổi ít nhất (minimumChange=0.08) nên gần như ứng viên"
                + " nào cũng qua cửa mức-thay-đổi, nhưng lại yêu cầu giữ từ khoá cao nhất"
                + " (minimumCoverage=0.65). `high` giữ nguyên minimumChange=0.22 như `medium` nhưng"
                + " đẩy preferredChange lên 0.42 — điều này KHÔNG loại thêm ứng viên (preferredChange chỉ"
                + " dùng để CHẤM ĐIỂM, không phải ngưỡng cắt), nên chênh lệch giữa `medium` và `high`"
                + " chủ yếu là thứ tự ưu tiên chứ không phải số lượng qua cửa.");
        report.text("Cột \"số lần không ra biến thể nào\" đếm những lần `doParaphrase()` ném"
                + " `ParaphraseModelException` vì không còn ứng viên nào khác câu gốc. Benchmark đếm"
                + " những lần đó là 0 biến thể nhưng VẪN ghi nhận thời gian, vì công việc decode đã"
                + " thực sự chạy trước khi bộ lọc loại hết ứng viên — cột `mean(ms)` vì thế là chi phí"
                + " đã bỏ ra, không phải chi phí của một lần thành công.");
        report.text("Lưu ý: chỉ đúng ngoại lệ \"không tạo được biến thể\" mới bị đếm là 0; mọi lỗi khác"
                + " (không nạp được model, timeout, decode hỏng) đều làm benchmark dừng ngay thay vì"
                + " lặng lẽ in ra một bảng toàn số 0 trông vẫn hợp lệ.");
    }

    // ══════════════════════════════════════════════════════════════════════════════════
    // Phép đo G — assert bất biến hành vi
    // ══════════════════════════════════════════════════════════════════════════════════

    private void assertBehaviouralInvariants(VariantCollector collector) {
        List<CollectedVariant> variants = collector.variants();
        assertThat(variants)
                .as("Benchmark phải thu được ít nhất một biến thể để kiểm chứng")
                .isNotEmpty();

        // 1. Mọi biến thể phải KHÁC câu gốc — nếu trùng thì paraphrase vô nghĩa.
        assertThat(variants).allSatisfy(collected ->
                assertThat(collected.variant().stem())
                        .as("Biến thể phải khác câu gốc (sourceIndex=%d)", collected.source().sourceIndex())
                        .isNotBlank()
                        .isNotEqualTo(collected.source().stem()));

        // 2. Với paraphraseOptions=false, bốn phương án phải GIỮ NGUYÊN y hệt câu gốc.
        List<CollectedVariant> optionPreserving = variants.stream()
                .filter(CollectedVariant::optionsPreserved)
                .toList();
        assertThat(optionPreserving)
                .as("Phải có biến thể từ cấu hình paraphraseOptions=false")
                .isNotEmpty();
        // So khớp trên chuỗi ĐÃ TRIM: fieldCandidates() trả về Collections.nCopies(count, safe(source))
        // và safe() có gọi trim(), nên phương án trả về là bản đã cắt khoảng trắng của câu gốc.
        // So sánh với chuỗi thô sẽ hỏng ngay khi corpus có một ô thừa dấu cách.
        assertThat(optionPreserving).allSatisfy(collected -> {
            SourceQuestion source = collected.source();
            ParaphrasedMcq variant = collected.variant();
            assertThat(variant.optionA()).isEqualTo(source.optionA().trim());
            assertThat(variant.optionB()).isEqualTo(source.optionB().trim());
            assertThat(variant.optionC()).isEqualTo(source.optionC().trim());
            assertThat(variant.optionD()).isEqualTo(source.optionD().trim());
        });

        // 3. Prompt điều khiển "SEM_x SYN_y LEX_z :" không được rò rỉ ra đầu ra.
        assertThat(variants).allSatisfy(collected -> {
            ParaphrasedMcq variant = collected.variant();
            assertThat(variant.rawOutput())
                    .as("rawOutput không được rò rỉ token điều khiển")
                    .doesNotContain("SEM_")
                    .doesNotContain("SYN_")
                    .doesNotContain("LEX_");
            assertThat(variant.stem())
                    .doesNotContain("SEM_")
                    .doesNotContain("SYN_")
                    .doesNotContain("LEX_");
        });

        // 4. Bất biến số học của beam width — độc lập với máy chạy.
        for (int numBeams : new int[]{1, 2, 4, 6}) {
            assertThat(effectiveBeamWidth(numBeams, REQUESTED_COUNT))
                    .as("beam width thật không bao giờ nhỏ hơn candidatePoolSize")
                    .isGreaterThanOrEqualTo(candidatePoolSize(REQUESTED_COUNT))
                    .isGreaterThanOrEqualTo(numBeams);
        }
    }

    // ══════════════════════════════════════════════════════════════════════════════════
    // Hạ tầng đo
    // ══════════════════════════════════════════════════════════════════════════════════

    /**
     * Nạp model MỚI cho một cấu hình, warmup, đo, rồi đóng ngay.
     *
     * <p>Bắt buộc phải tạo service mới: {@code OrtSession} chỉ được tạo một lần trong
     * {@code loadSingleRuntime()} với {@code SessionOptions} cố định, nên không thể đổi cấu hình
     * trên một service đang sống. Thời gian nạp KHÔNG lọt vào số đo vì đồng hồ chỉ chạy trong
     * {@link #measure} — sau warmup.</p>
     */
    private Measurement measureWithFreshService(
            Path modelRoot,
            List<SourceQuestion> sources,
            VariantCollector collector,
            String changeStrength,
            Consumer<AiParaphraseProperties> customizer
    ) {
        AiParaphraseProperties properties = benchmarkProperties(modelRoot, customizer);
        VietQuillParaphraseModelService service = newService(properties);
        try {
            warmup(service, sources.get(0), changeStrength);
            return measure(service, sources, changeStrength, properties.isParaphraseOptions(), collector);
        } finally {
            // Đóng NGAY: mỗi handle giữ 4 OrtSession ≈ 2 GB native. Không đóng thì cấu hình
            // tiếp theo sẽ làm JVM hết bộ nhớ native giữa chừng.
            service.close();
        }
    }

    /**
     * Chạy paraphrase tuần tự trên các câu nguồn cố định và ghi lại thời gian từng lần.
     * Ngoại lệ {@link ParaphraseModelException} được coi là "0 biến thể" nhưng VẪN tính thời gian,
     * vì công việc decode đã thực sự chạy trước khi bộ lọc loại hết ứng viên.
     */
    private Measurement measure(
            VietQuillParaphraseModelService service,
            List<SourceQuestion> sources,
            String changeStrength,
            boolean paraphraseOptions,
            VariantCollector collector
    ) {
        long[] samplesNanos = new long[sources.size() * iterations];
        int variantCount = 0;
        int emptyCount = 0;
        int sampleIndex = 0;
        for (int round = 0; round < iterations; round++) {
            for (SourceQuestion source : sources) {
                long startedAt = System.nanoTime();
                List<ParaphrasedMcq> variants = safeParaphrase(service, source, changeStrength);
                samplesNanos[sampleIndex++] = System.nanoTime() - startedAt;
                if (variants.isEmpty()) {
                    emptyCount++;
                }
                variantCount += variants.size();
                collector.accept(source, variants, !paraphraseOptions);
            }
        }
        return new Measurement(samplesNanos, variantCount, emptyCount);
    }

    /**
     * Warmup: bỏ đi vài lượt chạy đầu để nạp model, khởi tạo arena của ONNX Runtime và để JIT
     * biên dịch xong phần Java nặng của vòng lặp decode trước khi bấm giờ.
     */
    private void warmup(VietQuillParaphraseModelService service, SourceQuestion source, String changeStrength) {
        for (int round = 0; round < warmupRounds; round++) {
            safeParaphrase(service, source, changeStrength);
        }
    }

    /**
     * Chỉ nuốt đúng MỘT trường hợp: {@code doParaphrase()} không giữ lại được ứng viên nào khác câu
     * gốc. Đó là kết quả hợp lệ mà phép đo F cần đếm, và service ném nó với message thuần, KHÔNG kèm
     * cause.
     *
     * <p>Mọi {@code ParaphraseModelException} khác — không nạp được model, timeout, encode/decode
     * hỏng — đều được service bọc KÈM cause. Nếu nuốt luôn những lỗi đó thì một đường dẫn model sai
     * sẽ cho ra bản báo cáo đầy số 0 chạy nhanh bất thường mà vẫn trông như benchmark thành công,
     * nên ở đây phải ném lại để hỏng SỚM và hỏng RÕ.</p>
     */
    private List<ParaphrasedMcq> safeParaphrase(
            VietQuillParaphraseModelService service,
            SourceQuestion source,
            String changeStrength
    ) {
        try {
            return service.paraphrase(source.toInput(changeStrength, REQUESTED_COUNT));
        } catch (ParaphraseModelException ex) {
            String message = ex.getMessage() == null ? "" : ex.getMessage();
            if (ex.getCause() == null && message.contains("không tạo được biến thể")) {
                return List.of();
            }
            throw ex;
        }
    }

    private VietQuillParaphraseModelService newService(AiParaphraseProperties properties) {
        return new VietQuillParaphraseModelService(
                properties,
                new ObjectMapper(),
                new VietQuillPromptBuilder(),
                new VietQuillHandlePool(properties)
        );
    }

    /**
     * Cấu hình chuẩn cho benchmark: pool 1 handle (đo tuần tự, tiết kiệm ~2 GB mỗi handle thừa),
     * preload=false (để phép đo A tự kiểm soát thời điểm nạp), timeout nới rộng để không bị
     * cắt ngang giữa phép đo.
     */
    private AiParaphraseProperties benchmarkProperties(Path modelRoot, Consumer<AiParaphraseProperties> customizer) {
        AiParaphraseProperties properties = new AiParaphraseProperties();
        properties.setProvider("vietquill");
        properties.setModelPath(modelRoot);
        properties.setPreload(false);
        properties.setPoolSize(1);
        properties.setKvCacheEnabled(false);
        properties.setMaxInputLength(512);
        // maxTokens thực tế = min(maxOutputLength, maxDecodeLength); giữ maxOutputLength ở mức
        // mặc định 512 để maxDecodeLength mới là biến chi phối trong phép đo C.
        properties.setMaxOutputLength(512);
        properties.setRequestedCountDefault(REQUESTED_COUNT);
        properties.setTimeoutSeconds(BENCH_TIMEOUT_SECONDS);
        properties.setGenerateTimeoutSeconds(BENCH_TIMEOUT_SECONDS);
        properties.setAcquireTimeoutMs(BENCH_TIMEOUT_SECONDS * 1000L);
        customizer.accept(properties);
        return properties;
    }

    /** Bản sao công thức trong {@code generateCandidates()} — dùng để hiển thị và assert. */
    private static int candidatePoolSize(int requestedCount) {
        return Math.max(requestedCount * 2, requestedCount + 3);
    }

    private static int effectiveBeamWidth(int numBeams, int requestedCount) {
        return Math.max(numBeams, candidatePoolSize(requestedCount));
    }

    private static double toMillis(long nanos) {
        return nanos / 1_000_000d;
    }

    // ══════════════════════════════════════════════════════════════════════════════════
    // Nạp dữ liệu & môi trường
    // ══════════════════════════════════════════════════════════════════════════════════

    private Path resolveModelRoot() {
        String configured = System.getenv("VIETQUILL_MODEL_PATH");
        return configured == null || configured.isBlank()
                ? DEFAULT_MODEL_ROOT
                : Path.of(configured);
    }

    private void assumeSeq2SeqFiles(Path root) {
        assumeTrue(Files.isRegularFile(root.resolve("encoder_model.onnx")),
                "Thiếu encoder_model.onnx tại " + root);
        assumeTrue(Files.isRegularFile(root.resolve("decoder_model.onnx")),
                "Thiếu decoder_model.onnx tại " + root);
        assumeTrue(Files.isRegularFile(root.resolve("tokenizer.json")),
                "Thiếu tokenizer.json tại " + root);
        assumeTrue(Files.isRegularFile(root.resolve("config.json")),
                "Thiếu config.json tại " + root);
    }

    /**
     * Lấy câu ĐẦU TIÊN của từng bài trong corpus 270 câu, để phổ chủ đề rộng nhất có thể.
     *
     * <p>Lưu ý về dữ liệu: {@code sourceIndex} trong corpus đánh số 1..30 LẶP LẠI TRONG TỪNG BÀI,
     * không phải 1..270 toàn cục. Vì vậy khoá định danh duy nhất một câu là cặp
     * {@code (lesson, sourceIndex)}. Ở đây gom theo {@code lesson} và giữ câu đầu tiên của mỗi
     * bài — thứ tự trong file là cố định nên kết quả tái lập được.</p>
     */
    private List<SourceQuestion> loadSourceQuestions() {
        int limit = Math.max(1, readIntEnv("BENCH_SOURCE_QUESTIONS", 5));
        JsonNode root;
        try {
            root = new ObjectMapper().readTree(CORPUS_PATH.toFile());
        } catch (IOException ex) {
            throw new UncheckedIOException("Không đọc được corpus " + CORPUS_PATH.toAbsolutePath(), ex);
        }
        Map<String, JsonNode> firstOfEachLesson = new LinkedHashMap<>();
        for (JsonNode question : root.path("questions")) {
            firstOfEachLesson.putIfAbsent(question.path("lesson").asText(""), question);
        }
        List<SourceQuestion> selected = new ArrayList<>();
        for (JsonNode question : firstOfEachLesson.values()) {
            if (selected.size() >= limit) {
                break;
            }
            selected.add(new SourceQuestion(
                    question.path("sourceIndex").asInt(),
                    question.path("lesson").asText(""),
                    question.path("stem").asText(""),
                    question.path("optionA").asText(""),
                    question.path("optionB").asText(""),
                    question.path("optionC").asText(""),
                    question.path("optionD").asText(""),
                    question.path("correctAnswer").asText("A")
            ));
        }
        if (selected.isEmpty()) {
            throw new IllegalStateException("Không chọn được câu nguồn nào từ corpus " + CORPUS_PATH);
        }
        return List.copyOf(selected);
    }

    private static int readIntEnv(String name, int fallback) {
        String raw = System.getenv(name);
        if (raw == null || raw.isBlank()) {
            return fallback;
        }
        try {
            return Math.max(1, Integer.parseInt(raw.trim()));
        } catch (NumberFormatException ex) {
            return fallback;
        }
    }

    private void writeEnvironmentNotes(BenchmarkReport report, Path modelRoot, List<SourceQuestion> sources) {
        Runtime runtime = Runtime.getRuntime();
        report.note("Model: ngwgsang/vietquill-vit5-base-tsubaki (ViT5-base, vocab=36153, d_model=768,"
                + " 12 lớp encoder + 12 lớp decoder)");
        report.note("Thư mục model: %s (question/ + sentence/, mỗi thư mục encoder ~431 MB + decoder ~645 MB)",
                modelRoot.toAbsolutePath());
        report.note("Corpus: %s — chọn câu đầu của mỗi bài: %s",
                CORPUS_PATH, sources.stream().map(SourceQuestion::lesson).toList());
        report.note("Số câu nguồn: %d (chỉnh bằng biến môi trường BENCH_SOURCE_QUESTIONS)", sources.size());
        report.note("Khối lượng đo mỗi cấu hình: %d lượt warmup BỎ ĐI (BENCH_WARMUP_ROUNDS) rồi"
                        + " %d lượt quét (BENCH_ITERATIONS) × %d câu = %d mẫu",
                warmupRounds, iterations, sources.size(), iterations * sources.size());
        report.note("requestedCount cố định: %d → candidatePoolSize = %d",
                REQUESTED_COUNT, candidatePoolSize(REQUESTED_COUNT));
        report.note("KV-cache: TẮT (ai.paraphrase.kv-cache-enabled=false) — decode lại toàn bộ prefix mỗi bước");
        report.note("poolSize = 1 cho mọi cấu hình; đo tuần tự, không đo throughput đồng thời");
        report.note("availableProcessors = %d", runtime.availableProcessors());
        report.note("maxMemory = %.0f MB", runtime.maxMemory() / MEGABYTE);
        report.note("os.name = %s (%s)", System.getProperty("os.name"), System.getProperty("os.arch"));
        report.note("java.version = %s", System.getProperty("java.version"));
        report.note("Mỗi cấu hình dùng service + handle pool MỚI và đóng ngay sau khi đo;"
                + " thời gian nạp model bị LOẠI khỏi mọi số đo nhờ warmup trước khi bấm giờ.");
        report.note("Cấu hình cơ sở (numBeams=%d, maxDecodeLength=%d, paraphraseOptions=false,"
                        + " changeStrength=%s) được đo MỘT lần và dùng lại ở các bảng B, C, D, F"
                        + " để tránh %d lượt nạp model thừa.",
                BASELINE_NUM_BEAMS, BASELINE_MAX_DECODE_LENGTH, BASELINE_STRENGTH, 3);
    }

    // ══════════════════════════════════════════════════════════════════════════════════
    // Kiểu dữ liệu phụ trợ
    // ══════════════════════════════════════════════════════════════════════════════════

    private record SourceQuestion(
            int sourceIndex,
            String lesson,
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

    private record Measurement(long[] samplesNanos, int variantCount, int emptyCount) {
        /** Số lần gọi {@code paraphrase()} đã đo = số câu nguồn × số lượt lặp. */
        int callCount() {
            return samplesNanos.length;
        }
    }

    private record ColdStart(double coldMs, double warmMs) {
    }

    private record CollectedVariant(SourceQuestion source, ParaphrasedMcq variant, boolean optionsPreserved) {
    }

    /**
     * Thu thập mọi biến thể sinh ra để (a) assert bất biến ở phần G và (b) cộng checksum,
     * bảo đảm JIT không loại bỏ vòng lặp đo vì "kết quả không được dùng".
     */
    private static final class VariantCollector {
        private final List<CollectedVariant> variants = new ArrayList<>();
        private long checksum;

        void accept(SourceQuestion source, List<ParaphrasedMcq> results, boolean optionsPreserved) {
            for (ParaphrasedMcq result : results) {
                variants.add(new CollectedVariant(source, result, optionsPreserved));
                checksum += result.stem() == null ? 0 : result.stem().length();
                checksum += result.rawOutput() == null ? 0 : result.rawOutput().length();
            }
        }

        List<CollectedVariant> variants() {
            return variants;
        }

        long checksum() {
            return checksum;
        }
    }

    /**
     * Đo lượng byte JVM đã cấp phát.
     *
     * <p>Không dùng {@code getCurrentThreadAllocatedBytes()}: beam decode chạy trên thread
     * {@code vietquill-inference} do service tự submit vào executor, nên thread test không hề
     * cấp phát phần lớn bộ nhớ cần đo. Nhưng cũng KHÔNG cộng mọi thread của JVM: Surefire, logger
     * và các thread nền khác cấp phát liên tục và sẽ lẫn vào con số. Chỉ cộng thread chạy test
     * (nơi tokenize và gom kết quả) cùng các thread {@code vietquill-inference}.</p>
     *
     * <p>Nếu JVM không hỗ trợ API này thì fallback sang chênh lệch heap sau {@code System.gc()} —
     * chỉ là ước lượng thô.</p>
     */
    private static final class AllocationProbe {
        private static final String INFERENCE_THREAD_PREFIX = "vietquill-inference";

        private final com.sun.management.ThreadMXBean threadBean;
        private final String ownerThreadName;

        private AllocationProbe(com.sun.management.ThreadMXBean threadBean, String ownerThreadName) {
            this.threadBean = threadBean;
            this.ownerThreadName = ownerThreadName;
        }

        static AllocationProbe create() {
            String ownerThreadName = Thread.currentThread().getName();
            try {
                java.lang.management.ThreadMXBean base = ManagementFactory.getThreadMXBean();
                if (base instanceof com.sun.management.ThreadMXBean sunBean
                        && sunBean.isThreadAllocatedMemorySupported()) {
                    if (!sunBean.isThreadAllocatedMemoryEnabled()) {
                        sunBean.setThreadAllocatedMemoryEnabled(true);
                    }
                    return new AllocationProbe(sunBean, ownerThreadName);
                }
            } catch (RuntimeException | LinkageError ignored) {
                // JVM không phải HotSpot hoặc API bị chặn — rơi xuống fallback.
            }
            return new AllocationProbe(null, ownerThreadName);
        }

        boolean precise() {
            return threadBean != null;
        }

        String methodName() {
            return precise()
                    ? "ThreadMXBean.getThreadAllocatedBytes (thread test + vietquill-inference)"
                    : "Runtime heap sau System.gc() (ước lượng thô)";
        }

        long snapshotBytes() {
            if (threadBean == null) {
                System.gc();
                Runtime runtime = Runtime.getRuntime();
                return runtime.totalMemory() - runtime.freeMemory();
            }
            long[] threadIds = threadBean.getAllThreadIds();
            java.lang.management.ThreadInfo[] infos = threadBean.getThreadInfo(threadIds, 0);
            long[] allocated = threadBean.getThreadAllocatedBytes(threadIds);
            long total = 0;
            for (int index = 0; index < threadIds.length; index++) {
                java.lang.management.ThreadInfo info = infos[index];
                if (info == null || allocated[index] < 0) {
                    // Thread đã chết giữa hai lần gọi, hoặc JVM không đo được thread đó.
                    continue;
                }
                String name = info.getThreadName();
                if (name.equals(ownerThreadName) || name.startsWith(INFERENCE_THREAD_PREFIX)) {
                    total += allocated[index];
                }
            }
            return total;
        }
    }
}
