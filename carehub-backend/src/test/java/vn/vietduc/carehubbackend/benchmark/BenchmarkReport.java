package vn.vietduc.carehubbackend.benchmark;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;

/**
 * Bộ thu thập số đo dùng chung cho các benchmark model local.
 *
 * <p>Ghi ra hai nơi: stdout (để thấy ngay khi chạy {@code mvnw test}) và
 * {@code docs/ai/benchmarks/<slug>.md} ở gốc repo. Định dạng markdown để dán thẳng vào
 * {@code docs/ai/ai-models.md} không cần chỉnh.</p>
 *
 * <p>Cố ý KHÔNG ghi vào {@code target/}: thư mục đó nằm trong {@code .gitignore} và bị xoá
 * mỗi lần {@code mvn clean}, nên báo cáo biến mất ngay sau lần build kế tiếp — trong khi đây
 * là số liệu tốn hàng chục phút mới đo lại được.</p>
 *
 * <p>Không phải JMH: các benchmark ở đây đo thời gian tường (wall-clock) của một luồng
 * inference thật, có warmup, và báo cáo phân vị thay vì chỉ trung bình. Đủ để so sánh
 * tương đối giữa các cấu hình trên cùng một máy — không dùng để công bố con số tuyệt đối.</p>
 */
public final class BenchmarkReport {

    private static final Path OUTPUT_DIR = repositoryRoot().resolve("docs").resolve("ai").resolve("benchmarks");

    /**
     * Tìm gốc repo bằng cách đi ngược lên từ thư mục làm việc cho tới khi gặp {@code .git}.
     *
     * <p>Cần thiết vì thư mục làm việc lúc chạy test là {@code carehub-backend/}, còn thư mục
     * tài liệu nằm ở gốc repo. Dùng đường dẫn tương đối kiểu {@code ../docs} sẽ vỡ ngay khi ai
     * đó chạy test từ chỗ khác (IDE, CI).</p>
     */
    private static Path repositoryRoot() {
        Path current = Path.of("").toAbsolutePath();
        for (Path candidate = current; candidate != null; candidate = candidate.getParent()) {
            if (Files.isDirectory(candidate.resolve(".git"))) {
                return candidate;
            }
        }
        // Không tìm thấy .git (bản export, sandbox CI): lùi về thư mục cha của working dir nếu
        // đang đứng trong module con, ngược lại dùng luôn working dir.
        Path parent = current.getParent();
        return parent != null && Files.isDirectory(parent.resolve("docs")) ? parent : current;
    }

    private final String title;
    private final List<String> lines = new ArrayList<>();
    private List<String> pendingColumns;

    private BenchmarkReport(String title) {
        this.title = title;
    }

    public static BenchmarkReport of(String title) {
        BenchmarkReport report = new BenchmarkReport(title);
        report.lines.add("# " + title);
        report.lines.add("");
        return report;
    }

    /** Dòng ghi chú tự do (môi trường chạy, cấu hình, cảnh báo...). */
    public BenchmarkReport note(String format, Object... args) {
        lines.add("- " + format(format, args));
        return this;
    }

    public BenchmarkReport section(String heading) {
        lines.add("");
        lines.add("## " + heading);
        lines.add("");
        pendingColumns = null;
        return this;
    }

    public BenchmarkReport text(String format, Object... args) {
        lines.add(format(format, args));
        return this;
    }

    /** Mở một bảng mới. Mọi {@link #row(Object...)} sau đó thuộc bảng này. */
    public BenchmarkReport columns(String... headers) {
        pendingColumns = Arrays.asList(headers);
        lines.add("| " + String.join(" | ", headers) + " |");
        lines.add("|" + "---|".repeat(headers.length));
        return this;
    }

    public BenchmarkReport row(Object... values) {
        if (pendingColumns == null) {
            throw new IllegalStateException("Gọi columns(...) trước khi thêm row(...)");
        }
        if (values.length != pendingColumns.size()) {
            throw new IllegalArgumentException(
                    "Số ô (" + values.length + ") không khớp số cột (" + pendingColumns.size() + ")");
        }
        List<String> cells = new ArrayList<>(values.length);
        for (Object value : values) {
            cells.add(render(value));
        }
        lines.add("| " + String.join(" | ", cells) + " |");
        return this;
    }

    /** In ra stdout và ghi file {@code docs/ai/benchmarks/<slug>.md} ở gốc repo. */
    public Path write() {
        String body = String.join(System.lineSeparator(), lines) + System.lineSeparator();
        System.out.println();
        System.out.println(body);
        try {
            Files.createDirectories(OUTPUT_DIR);
            Path target = OUTPUT_DIR.resolve(slug(title) + ".md");
            Files.writeString(target, body, StandardCharsets.UTF_8);
            System.out.println("→ Đã ghi báo cáo: " + target.toAbsolutePath());
            return target;
        } catch (IOException ex) {
            throw new UncheckedIOException("Không ghi được báo cáo benchmark", ex);
        }
    }

    // ── Thống kê ──

    /**
     * Phân vị trên mẫu thời gian (nanô giây). Dùng phân vị thay vì trung bình vì
     * inference ONNX có đuôi dài do GC và biến động tần số CPU.
     */
    public static Stats stats(long[] samplesNanos) {
        if (samplesNanos == null || samplesNanos.length == 0) {
            return new Stats(0, 0, 0, 0, 0, 0, 0);
        }
        long[] sorted = samplesNanos.clone();
        Arrays.sort(sorted);
        double sum = 0;
        for (long sample : sorted) {
            sum += sample;
        }
        return new Stats(
                sorted.length,
                toMillis(sum / sorted.length),
                toMillis(percentile(sorted, 0.50)),
                toMillis(percentile(sorted, 0.95)),
                toMillis(percentile(sorted, 0.99)),
                toMillis(sorted[0]),
                toMillis(sorted[sorted.length - 1])
        );
    }

    /** Phân vị trên mẫu giá trị thực (điểm tương đồng, tỉ lệ...). Mảng bị sắp xếp tại chỗ. */
    public static double percentileOf(double[] values, double quantile) {
        if (values == null || values.length == 0) {
            return 0;
        }
        double[] sorted = values.clone();
        Arrays.sort(sorted);
        return sorted[index(sorted.length, quantile)];
    }

    private static double percentile(long[] sorted, double quantile) {
        return sorted[index(sorted.length, quantile)];
    }

    private static int index(int length, double quantile) {
        int position = (int) Math.ceil(quantile * length) - 1;
        return Math.max(0, Math.min(length - 1, position));
    }

    private static double toMillis(double nanos) {
        return nanos / 1_000_000d;
    }

    public record Stats(
            int count,
            double meanMs,
            double p50Ms,
            double p95Ms,
            double p99Ms,
            double minMs,
            double maxMs
    ) {
    }

    // ── Định dạng ──

    private static String render(Object value) {
        if (value instanceof Double doubleValue) {
            return format("%.3f", doubleValue);
        }
        if (value instanceof Float floatValue) {
            return format("%.3f", floatValue);
        }
        return String.valueOf(value);
    }

    private static String format(String format, Object... args) {
        return args.length == 0 ? format : String.format(Locale.ROOT, format, args);
    }

    private static String slug(String value) {
        String normalized = java.text.Normalizer.normalize(value, java.text.Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "")
                .replace('đ', 'd')
                .replace('Đ', 'D')
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("(^-|-$)", "");
        return normalized.isBlank() ? "benchmark" : normalized;
    }
}
