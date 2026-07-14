package vn.vietduc.carehubbackend.questiongeneration.modelruntime.e5;

import ai.djl.huggingface.tokenizers.Encoding;
import ai.djl.huggingface.tokenizers.HuggingFaceTokenizer;
import ai.onnxruntime.OnnxTensor;
import ai.onnxruntime.OnnxValue;
import ai.onnxruntime.OrtEnvironment;
import ai.onnxruntime.OrtException;
import ai.onnxruntime.OrtSession;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vn.vietduc.carehubbackend.questiongeneration.config.AiEmbeddingProperties;
import vn.vietduc.carehubbackend.questiongeneration.modelruntime.EmbeddingModelException;
import vn.vietduc.carehubbackend.questiongeneration.modelruntime.EmbeddingModelService;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Consumer;
import java.util.stream.Stream;

@Slf4j
@Service
@RequiredArgsConstructor
public class E5EmbeddingModelService implements EmbeddingModelService {
    private final AiEmbeddingProperties properties;
    private volatile RuntimeHandle runtime;

    @PostConstruct
    void preload() {
        if (!properties.isE5Provider() || !properties.isPreload()) {
            return;
        }
        try {
            ensureRuntime();
        } catch (RuntimeException ex) {
            log.warn("Không preload được E5 model tại {}: {}", properties.getModelPath(), ex.getMessage());
        }
    }

    @PreDestroy
    void close() {
        RuntimeHandle handle = runtime;
        if (handle != null) {
            handle.close();
        }
    }

    @Override
    public String modelName() {
        return properties.getModel();
    }

    @Override
    public double[] embedQuery(String text) {
        return embed(E5TextPreprocessor.query(text));
    }

    @Override
    public double[] embedPassage(String text) {
        return embed(E5TextPreprocessor.passage(text));
    }

    @Override
    public List<double[]> embedPassageBatch(List<String> texts, Consumer<Integer> progressCallback) {
        if (texts == null || texts.isEmpty()) {
            return List.of();
        }

        RuntimeHandle handle = ensureRuntime();
        int batchSize = Math.max(1, Math.min(properties.getBatchSize(), texts.size()));
        List<double[]> results = new ArrayList<>(texts.size());

        for (int offset = 0; offset < texts.size(); offset += batchSize) {
            int end = Math.min(offset + batchSize, texts.size());
            List<String> batch = texts.subList(offset, end);

            // Tokenize tất cả texts trong batch
            List<long[]> batchInputIds = new ArrayList<>(batch.size());
            List<long[]> batchAttentionMasks = new ArrayList<>(batch.size());
            int maxSeqLen = 0;

            for (String text : batch) {
                String prepared = E5TextPreprocessor.passage(text);
                Encoding encoding = handle.tokenizer().encode(prepared);
                long[] inputIds = truncate(encoding.getIds());
                long[] attentionMask = truncate(encoding.getAttentionMask());
                if (attentionMask.length != inputIds.length) {
                    attentionMask = filled(inputIds.length, 1);
                }
                maxSeqLen = Math.max(maxSeqLen, inputIds.length);
                batchInputIds.add(inputIds);
                batchAttentionMasks.add(attentionMask);
            }

            // Pad tất cả sequences về cùng length
            long[][] paddedInputIds = new long[batch.size()][maxSeqLen];
            long[][] paddedAttentionMask = new long[batch.size()][maxSeqLen];
            for (int i = 0; i < batch.size(); i++) {
                System.arraycopy(batchInputIds.get(i), 0, paddedInputIds[i], 0, batchInputIds.get(i).length);
                System.arraycopy(batchAttentionMasks.get(i), 0, paddedAttentionMask[i], 0, batchAttentionMasks.get(i).length);
            }

            // Batch ONNX inference
            Map<String, OnnxTensor> tensors = new LinkedHashMap<>();
            try {
                addTensorIfExpected(handle, tensors, "input_ids", paddedInputIds);
                addTensorIfExpected(handle, tensors, "attention_mask", paddedAttentionMask);

                // token_type_ids padding với 0
                long[][] paddedTypeIds = new long[batch.size()][maxSeqLen];
                addTensorIfExpected(handle, tensors, "token_type_ids", paddedTypeIds);

                try (OrtSession.Result result = handle.session().run(tensors)) {
                    Object value = result.get(0).getValue();
                    List<double[]> batchResults = toBatchVectors(value, batchAttentionMasks);
                    results.addAll(batchResults);
                }
            } catch (Exception ex) {
                throw new EmbeddingModelException("Không tạo được batch embedding E5", ex);
            } finally {
                OnnxValue.close(tensors.values());
            }

            if (progressCallback != null) {
                progressCallback.accept(end);
            }
        }
        return results;
    }

    private double[] embed(String preparedText) {
        RuntimeHandle handle = ensureRuntime();
        try {
            Encoding encoding = handle.tokenizer().encode(preparedText);
            long[] inputIds = truncate(encoding.getIds());
            long[] attentionMask = truncate(encoding.getAttentionMask());
            long[] typeIds = truncate(encoding.getTypeIds());
            if (attentionMask.length != inputIds.length) {
                attentionMask = filled(inputIds.length, 1);
            }
            if (typeIds.length != inputIds.length) {
                typeIds = filled(inputIds.length, 0);
            }

            Map<String, OnnxTensor> tensors = new LinkedHashMap<>();
            try {
                addTensorIfExpected(handle, tensors, "input_ids", inputIds);
                addTensorIfExpected(handle, tensors, "attention_mask", attentionMask);
                addTensorIfExpected(handle, tensors, "token_type_ids", typeIds);
                try (OrtSession.Result result = handle.session().run(tensors)) {
                    Object value = result.get(0).getValue();
                    double[] vector = toVector(value, attentionMask);
                    return l2Normalize(vector);
                }
            } finally {
                OnnxValue.close(tensors.values());
            }
        } catch (Exception ex) {
            throw new EmbeddingModelException("Không tạo được embedding E5", ex);
        }
    }

    private void addTensorIfExpected(
            RuntimeHandle handle,
            Map<String, OnnxTensor> tensors,
            String name,
            long[] values
    ) throws OrtException {
        if (handle.session().getInputNames().contains(name)) {
            tensors.put(name, OnnxTensor.createTensor(handle.environment(), new long[][]{values}));
        }
    }

    private void addTensorIfExpected(
            RuntimeHandle handle,
            Map<String, OnnxTensor> tensors,
            String name,
            long[][] values
    ) throws OrtException {
        if (handle.session().getInputNames().contains(name)) {
            tensors.put(name, OnnxTensor.createTensor(handle.environment(), values));
        }
    }

    private List<double[]> toBatchVectors(Object value, List<long[]> attentionMasks) {
        if (value instanceof float[][][] tokenEmbeddings) {
            List<double[]> result = new ArrayList<>(tokenEmbeddings.length);
            for (int b = 0; b < tokenEmbeddings.length; b++) {
                double[] pooled = meanPool(tokenEmbeddings[b], attentionMasks.get(b));
                result.add(l2Normalize(pooled));
            }
            return result;
        }
        if (value instanceof double[][][] tokenEmbeddings) {
            List<double[]> result = new ArrayList<>(tokenEmbeddings.length);
            for (int b = 0; b < tokenEmbeddings.length; b++) {
                double[] pooled = meanPool(tokenEmbeddings[b], attentionMasks.get(b));
                result.add(l2Normalize(pooled));
            }
            return result;
        }
        throw new EmbeddingModelException("Batch output E5 không hỗ trợ: " + value.getClass().getName());
    }

    private RuntimeHandle ensureRuntime() {
        if (!properties.isE5Provider()) {
            throw new EmbeddingModelException("Embedding provider hiện tại không phải E5");
        }
        RuntimeHandle existing = runtime;
        if (existing != null) {
            return existing;
        }
        synchronized (this) {
            if (runtime == null) {
                runtime = loadRuntime();
            }
            return runtime;
        }
    }

    private RuntimeHandle loadRuntime() {
        try {
            Path root = properties.getModelPath();
            Path onnxModel = resolveOnnxModel(root);
            Path tokenizerPath = resolveTokenizer(root);
            HuggingFaceTokenizer tokenizer = HuggingFaceTokenizer.newInstance(tokenizerPath);
            OrtEnvironment environment = OrtEnvironment.getEnvironment();
            OrtSession.SessionOptions options = new OrtSession.SessionOptions();
            options.setOptimizationLevel(OrtSession.SessionOptions.OptLevel.ALL_OPT);

            int numThreads = properties.getIntraOpThreads();
            if (numThreads <= 0) {
                numThreads = Math.max(1, Runtime.getRuntime().availableProcessors() - 1);
            }
            options.setIntraOpNumThreads(numThreads);
            options.setInterOpNumThreads(Math.max(1, properties.getInterOpThreads()));

            OrtSession session = environment.createSession(onnxModel.toString(), options);
            options.close();
            log.info("Đã load E5 model {} từ {} (intraOpThreads={})", properties.getModel(), onnxModel, numThreads);
            return new RuntimeHandle(environment, session, tokenizer);
        } catch (Exception ex) {
            throw new EmbeddingModelException("Không load được E5 model từ " + properties.getModelPath(), ex);
        }
    }

    private Path resolveOnnxModel(Path root) throws IOException {
        if (Files.isRegularFile(root) && root.toString().endsWith(".onnx")) {
            return root;
        }
        Path direct = root.resolve("model.onnx");
        if (Files.isRegularFile(direct)) {
            return direct;
        }
        Path nested = root.resolve("onnx").resolve("model.onnx");
        if (Files.isRegularFile(nested)) {
            return nested;
        }
        if (!Files.isDirectory(root)) {
            throw new IOException("Không tìm thấy thư mục model E5: " + root);
        }
        try (Stream<Path> paths = Files.walk(root, 3)) {
            return paths
                    .filter(path -> Files.isRegularFile(path) && path.toString().endsWith(".onnx"))
                    .findFirst()
                    .orElseThrow(() -> new IOException("Không tìm thấy file .onnx trong " + root));
        }
    }

    private Path resolveTokenizer(Path root) throws IOException {
        if (Files.isRegularFile(root) && root.getFileName().toString().equals("tokenizer.json")) {
            return root;
        }
        Path direct = root.resolve("tokenizer.json");
        if (Files.isRegularFile(direct)) {
            return direct;
        }
        if (!Files.isDirectory(root)) {
            throw new IOException("Không tìm thấy tokenizer.json trong " + root);
        }
        try (Stream<Path> paths = Files.walk(root, 3)) {
            return paths
                    .filter(path -> Files.isRegularFile(path) && path.getFileName().toString().equals("tokenizer.json"))
                    .findFirst()
                    .orElseThrow(() -> new IOException("Không tìm thấy tokenizer.json trong " + root));
        }
    }

    private long[] truncate(long[] values) {
        int maxLength = Math.max(1, properties.getMaxLength());
        if (values == null) {
            return new long[0];
        }
        if (values.length <= maxLength) {
            return values;
        }
        long[] truncated = new long[maxLength];
        System.arraycopy(values, 0, truncated, 0, maxLength);
        return truncated;
    }

    private long[] filled(int length, long value) {
        long[] result = new long[length];
        for (int i = 0; i < length; i++) {
            result[i] = value;
        }
        return result;
    }

    private double[] toVector(Object value, long[] attentionMask) {
        if (value instanceof float[][] vectors) {
            return toDouble(vectors[0]);
        }
        if (value instanceof double[][] vectors) {
            return vectors[0];
        }
        if (value instanceof float[][][] tokenEmbeddings) {
            return meanPool(tokenEmbeddings[0], attentionMask);
        }
        if (value instanceof double[][][] tokenEmbeddings) {
            return meanPool(tokenEmbeddings[0], attentionMask);
        }
        throw new EmbeddingModelException("Output E5 không hỗ trợ: " + value.getClass().getName());
    }

    private double[] meanPool(float[][] tokenEmbeddings, long[] attentionMask) {
        double[] pooled = new double[tokenEmbeddings[0].length];
        double count = 0;
        for (int token = 0; token < tokenEmbeddings.length; token++) {
            if (token < attentionMask.length && attentionMask[token] == 0) {
                continue;
            }
            count++;
            for (int dim = 0; dim < pooled.length; dim++) {
                pooled[dim] += tokenEmbeddings[token][dim];
            }
        }
        return divide(pooled, count);
    }

    private double[] meanPool(double[][] tokenEmbeddings, long[] attentionMask) {
        double[] pooled = new double[tokenEmbeddings[0].length];
        double count = 0;
        for (int token = 0; token < tokenEmbeddings.length; token++) {
            if (token < attentionMask.length && attentionMask[token] == 0) {
                continue;
            }
            count++;
            for (int dim = 0; dim < pooled.length; dim++) {
                pooled[dim] += tokenEmbeddings[token][dim];
            }
        }
        return divide(pooled, count);
    }

    private double[] divide(double[] vector, double divisor) {
        double safeDivisor = divisor <= 0 ? 1 : divisor;
        for (int i = 0; i < vector.length; i++) {
            vector[i] = vector[i] / safeDivisor;
        }
        return vector;
    }

    private double[] toDouble(float[] values) {
        double[] result = new double[values.length];
        for (int i = 0; i < values.length; i++) {
            result[i] = values[i];
        }
        return result;
    }

    private double[] l2Normalize(double[] vector) {
        double norm = 0;
        for (double value : vector) {
            norm += value * value;
        }
        norm = Math.sqrt(norm);
        if (norm == 0) {
            return vector;
        }
        for (int i = 0; i < vector.length; i++) {
            vector[i] = vector[i] / norm;
        }
        return vector;
    }

    private record RuntimeHandle(
            OrtEnvironment environment,
            OrtSession session,
            HuggingFaceTokenizer tokenizer
    ) implements AutoCloseable {
        @Override
        public void close() {
            try {
                session.close();
            } catch (Exception ignored) {
                // Best effort shutdown only.
            }
            tokenizer.close();
        }

        private RuntimeHandle {
            Objects.requireNonNull(environment);
            Objects.requireNonNull(session);
            Objects.requireNonNull(tokenizer);
        }
    }
}
