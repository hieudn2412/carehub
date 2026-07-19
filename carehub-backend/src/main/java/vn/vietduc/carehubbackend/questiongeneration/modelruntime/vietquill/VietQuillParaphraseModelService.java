package vn.vietduc.carehubbackend.questiongeneration.modelruntime.vietquill;

import ai.djl.huggingface.tokenizers.Encoding;
import ai.djl.huggingface.tokenizers.HuggingFaceTokenizer;
import ai.onnxruntime.OnnxTensor;
import ai.onnxruntime.OnnxValue;
import ai.onnxruntime.OrtEnvironment;
import ai.onnxruntime.OrtException;
import ai.onnxruntime.OrtSession;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vn.vietduc.carehubbackend.questiongeneration.config.AiParaphraseProperties;
import vn.vietduc.carehubbackend.questiongeneration.modelruntime.ParaphraseModelException;
import vn.vietduc.carehubbackend.questiongeneration.modelruntime.ParaphraseModelInput;
import vn.vietduc.carehubbackend.questiongeneration.modelruntime.ParaphraseModelService;
import vn.vietduc.carehubbackend.questiongeneration.modelruntime.ParaphrasedMcq;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Slf4j
@Service
@RequiredArgsConstructor
public class VietQuillParaphraseModelService implements ParaphraseModelService {
    private static final String[] ENCODER_FILE_NAMES = {
            "encoder_model.onnx",
            "encoder.onnx"
    };
    private static final String[] DECODER_FILE_NAMES = {
            "decoder_model.onnx",
            "decoder.onnx"
    };

    private final AiParaphraseProperties properties;
    private final ObjectMapper objectMapper;
    private final VietQuillPromptBuilder promptBuilder;
    private final VietQuillMcqParser mcqParser;
    private final VietQuillHandlePool handlePool;

    private volatile boolean initialized = false;
    private ExecutorService inferenceExecutor;

    @PostConstruct
    void preload() {
        inferenceExecutor();
        if (!properties.isVietQuillProvider() || !properties.isPreload()) {
            return;
        }
        try {
            ensureInitialized();
            warmup();
            log.info("VietQuill model preloaded and warmed up successfully (pool size={})", handlePool.poolSize());
        } catch (RuntimeException ex) {
            log.warn("Không preload được VietQuill model tại {}: {}", properties.getModelPath(), ex.getMessage());
        }
    }

    private void warmup() {
        // Warmup tất cả handles trong pool để trigger JIT compilation trong ONNX Runtime
        String warmupPrompt = "paraphrase mcq:\nCâu hỏi: test\nA. test\nB. test\nC. test\nD. test\nĐáp án đúng: A\nYêu cầu: giữ nguyên.";
        try {
            handlePool.processAllHandles(handle -> {
                generate(handle.question(), warmupPrompt, 0);
                generate(handle.sentence(), "test", 0);
            });
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            log.warn("VietQuill warmup bị ngắt");
            return;
        }
        log.info("VietQuill warmup completed for all {} handles", handlePool.poolSize());
    }

    @PreDestroy
    void close() {
        if (inferenceExecutor != null) {
            inferenceExecutor.shutdownNow();
        }
        if (handlePool != null) {
            handlePool.close();
        }
    }

    @Override
    public String modelName() {
        return properties.getModel();
    }

    @Override
    public String provider() {
        return properties.isMockProvider() ? "mock" : "vietquill";
    }

    @Override
    public List<ParaphrasedMcq> paraphrase(ParaphraseModelInput input) {
        int count = Math.max(1, Math.min(10, input.requestedCount()));
        if (properties.isMockProvider()) {
            return mock(input, count);
        }
        if (!properties.isVietQuillProvider()) {
            throw new ParaphraseModelException("Provider paraphrase chưa được hỗ trợ: " + properties.getProvider());
        }

        ensureInitialized();
        AtomicBoolean timedOut = new AtomicBoolean(false);
        AtomicBoolean taskStarted = new AtomicBoolean(false);
        try {
            RuntimeHandle acquiredHandle = handlePool.acquire(properties.getAcquireTimeoutMs());
            Future<List<ParaphrasedMcq>> future = inferenceExecutor().submit(() -> {
                taskStarted.set(true);
                try {
                    return doParaphrase(acquiredHandle, input, count);
                } finally {
                    if (timedOut.get()) {
                        handlePool.retire(acquiredHandle);
                    } else {
                        handlePool.release(acquiredHandle);
                    }
                }
            });
            try {
                return future.get(Math.max(1, properties.getTimeoutSeconds()), TimeUnit.SECONDS);
            } catch (TimeoutException ex) {
                timedOut.set(true);
                future.cancel(true);
                if (!taskStarted.get()) {
                    handlePool.retire(acquiredHandle);
                }
                throw new ParaphraseModelException(
                        "Paraphrase timeout sau " + Math.max(1, properties.getTimeoutSeconds()) + " giây", ex);
            } catch (InterruptedException ex) {
                timedOut.set(true);
                future.cancel(true);
                Thread.currentThread().interrupt();
                throw new ParaphraseModelException("Bị ngắt khi chờ VietQuill inference", ex);
            } catch (java.util.concurrent.ExecutionException ex) {
                Throwable cause = ex.getCause();
                if (cause instanceof RuntimeException runtimeException) {
                    throw runtimeException;
                }
                throw new ParaphraseModelException("Paraphrase thất bại", cause);
            }
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new ParaphraseModelException("Bị ngắt khi chờ VietQuill handle", ex);
        } catch (Exception ex) {
            if (ex instanceof ParaphraseModelException paraphraseModelException) {
                throw paraphraseModelException;
            }
            throw new ParaphraseModelException("Paraphrase thất bại", ex);
        }
    }

    private List<ParaphrasedMcq> doParaphrase(RuntimeHandle handle, ParaphraseModelInput input, int count) {
        List<ParaphrasedMcq> results = new ArrayList<>();
        for (int index = 0; index < count; index++) {
            ParaphrasedMcq candidate;
            try {
                candidate = properties.isSinglePassEnabled()
                        ? paraphraseSinglePassVariant(handle, input, index, false)
                        : paraphrasePerFieldVariant(handle, input, index, false);
            } catch (RuntimeException firstFailure) {
                log.warn("VietQuill full-MCQ attempt failed for variant {}: {}", index + 1, firstFailure.getMessage());
                candidate = null;
            }
            if (!isAcceptable(input, candidate, results)) {
                candidate = paraphrasePerFieldVariant(handle, input, index, true);
            }
            if (!isAcceptable(input, candidate, results)) {
                throw new ParaphraseModelException(
                        "VietQuill không tạo được biến thể hợp lệ số " + (index + 1)
                                + ": output thiếu field, trùng câu nguồn hoặc trùng biến thể khác");
            }
            results.add(candidate);
        }
        return results;
    }

    /**
     * Generate one complete MCQ in a single model pass.
     */
    private ParaphrasedMcq paraphraseSinglePassVariant(
            RuntimeHandle handle,
            ParaphraseModelInput input,
            int index,
            boolean retry
    ) {
        String prompt = promptBuilder.buildFullMcq(input, index, retry);
        EncoderState encoderState = encodePrompt(handle.question(), prompt);
        String rawOutput = decode(handle.question(), encoderState, index);
        if (rawOutput.isBlank()) {
            throw new ParaphraseModelException("VietQuill trả về output rỗng");
        }
        return mcqParser.parseFullMcq(rawOutput);
    }

    /**
     * Retry path: generate each field separately with the sentence model.
     */
    private ParaphrasedMcq paraphrasePerFieldVariant(
            RuntimeHandle handle,
            ParaphraseModelInput input,
            int index,
            boolean retry
    ) {
        String stem = generate(handle.question(),
                promptBuilder.buildSingleField(input.stem(), input.changeStrength(), index, retry), index);
        String optionA = generate(handle.sentence(),
                promptBuilder.buildSingleField(input.optionA(), input.changeStrength(), index, retry), index);
        String optionB = generate(handle.sentence(),
                promptBuilder.buildSingleField(input.optionB(), input.changeStrength(), index, retry), index);
        String optionC = generate(handle.sentence(),
                promptBuilder.buildSingleField(input.optionC(), input.changeStrength(), index, retry), index);
        String optionD = generate(handle.sentence(),
                promptBuilder.buildSingleField(input.optionD(), input.changeStrength(), index, retry), index);
        if (List.of(stem, optionA, optionB, optionC, optionD).stream().anyMatch(this::isBlank)) {
            throw new ParaphraseModelException("VietQuill per-field trả về field rỗng");
        }
        return new ParaphrasedMcq(stem, optionA, optionB, optionC, optionD,
                rawMcq(stem, optionA, optionB, optionC, optionD));
    }

    /**
     * Generate text from a Seq2SeqHandle.
     * Convenience wrapper — encode + decode trong 1 lần gọi.
     */
    private String generate(Seq2SeqHandle handle, String prompt, int variantIndex) {
        EncoderState state = encodePrompt(handle, prompt);
        return decode(handle, state, variantIndex);
    }

    private boolean isAcceptable(
            ParaphraseModelInput input,
            ParaphrasedMcq candidate,
            List<ParaphrasedMcq> existing
    ) {
        if (candidate == null || List.of(candidate.stem(), candidate.optionA(), candidate.optionB(), candidate.optionC(), candidate.optionD())
                .stream().anyMatch(this::isBlank)) {
            return false;
        }
        List<String> source = List.of(input.stem(), input.optionA(), input.optionB(), input.optionC(), input.optionD());
        List<String> generated = List.of(candidate.stem(), candidate.optionA(), candidate.optionB(), candidate.optionC(), candidate.optionD());
        for (int i = 0; i < source.size(); i++) {
            if (normalizeForCompare(source.get(i)).equals(normalizeForCompare(generated.get(i)))) {
                return false;
            }
        }
        String candidateKey = generated.stream().map(this::normalizeForCompare).reduce("", (left, right) -> left + "|" + right);
        return existing.stream().noneMatch(previous -> {
            String previousKey = List.of(previous.stem(), previous.optionA(), previous.optionB(), previous.optionC(), previous.optionD())
                    .stream().map(this::normalizeForCompare).reduce("", (left, right) -> left + "|" + right);
            return previousKey.equals(candidateKey);
        });
    }

    private String normalizeForCompare(String value) {
        return safe(value).toLowerCase()
                .replaceAll("[\\p{Punct}]", "")
                .replaceAll("\\s+", "")
                .trim();
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private synchronized ExecutorService inferenceExecutor() {
        if (inferenceExecutor == null || inferenceExecutor.isShutdown()) {
            inferenceExecutor = Executors.newCachedThreadPool(runnable -> {
                Thread thread = new Thread(runnable, "vietquill-inference");
                thread.setDaemon(true);
                return thread;
            });
        }
        return inferenceExecutor;
    }

    /**
     * Tokenize + encode prompt → encoder hidden states.
     * Kết quả có thể reuse cho nhiều lần decode (multi-variant).
     */
    private EncoderState encodePrompt(Seq2SeqHandle handle, String prompt) {
        try {
            Encoding encoding = handle.tokenizer().encode(prompt);
            long[] inputIds = truncate(encoding.getIds(), properties.getMaxInputLength());
            long[] attentionMask = truncate(encoding.getAttentionMask(), properties.getMaxInputLength());
            if (attentionMask.length != inputIds.length) {
                attentionMask = filled(inputIds.length, 1);
            }
            return new EncoderState(encode(handle, inputIds, attentionMask), attentionMask);
        } catch (Exception ex) {
            throw new ParaphraseModelException("Không encode được prompt VietQuill ONNX", ex);
        }
    }

    /**
     * Decode từ encoder hidden states đã có sẵn.
     * Không cần encode lại — dùng khi muốn sinh nhiều variant từ cùng 1 prompt.
     */
    private String decode(Seq2SeqHandle handle, EncoderState state, int variantIndex) {
        try {
            List<String> decoded;
            if (properties.isKvCacheEnabled() && handle.kvCacheSupported()) {
                decoded = beamDecodeWithKvCache(handle, state.hiddenStates(), state.attentionMask());
            } else {
                decoded = beamDecode(handle, state.hiddenStates(), state.attentionMask());
            }
            if (decoded.isEmpty()) {
                return "";
            }
            return decoded.get(Math.min(variantIndex, decoded.size() - 1));
        } catch (Exception ex) {
            throw new ParaphraseModelException("Không decode được với VietQuill ONNX", ex);
        }
    }

    private float[][][] encode(Seq2SeqHandle handle, long[] inputIds, long[] attentionMask) throws OrtException {
        Map<String, OnnxTensor> tensors = new LinkedHashMap<>();
        try {
            addLongTensorIfExpected(handle.environment(), handle.encoder(), tensors, "input_ids", inputIds);
            addLongTensorIfExpected(handle.environment(), handle.encoder(), tensors, "attention_mask", attentionMask);
            try (OrtSession.Result result = handle.encoder().run(tensors)) {
                Object value = result.get(0).getValue();
                if (value instanceof float[][][] floats) {
                    return floats;
                }
                if (value instanceof double[][][] doubles) {
                    return toFloat(doubles);
                }
                throw new ParaphraseModelException("Output encoder VietQuill không hỗ trợ: " + value.getClass().getName());
            }
        } finally {
            OnnxValue.close(tensors.values());
        }
    }

    private List<String> beamDecode(
            Seq2SeqHandle handle,
            float[][][] encoderHiddenStates,
            long[] attentionMask
    ) throws OrtException {
        int beamWidth = Math.max(1, Math.min(6, properties.getNumBeams()));
        int maxTokens = Math.max(8, Math.min(properties.getMaxOutputLength(), properties.getMaxDecodeLength()));
        List<Beam> beams = List.of(new Beam(
                List.of((long) handle.modelConfig().decoderStartTokenId()),
                0,
                false
        ));

        for (int step = 0; step < maxTokens; step++) {
            List<Beam> candidates = new ArrayList<>();
            for (Beam beam : beams) {
                if (beam.done()) {
                    candidates.add(beam);
                    continue;
                }
                double[] logits = decodeLogits(handle, beam.tokenIds(), encoderHiddenStates, attentionMask);
                for (TopToken token : topTokens(logits, beamWidth)) {
                    boolean done = token.id() == handle.modelConfig().eosTokenId();
                    List<Long> nextIds = new ArrayList<>(beam.tokenIds());
                    if (!done) {
                        nextIds.add(token.id());
                    }
                    candidates.add(new Beam(nextIds, beam.score() + token.logProbability(), done));
                }
            }
            beams = candidates.stream()
                    .sorted((left, right) -> Double.compare(right.rankScore(), left.rankScore()))
                    .limit(beamWidth)
                    .toList();
            if (beams.stream().allMatch(Beam::done)) {
                break;
            }
        }

        return beams.stream()
                .map(beam -> decodeTokens(handle, beam.tokenIds()))
                .filter(value -> !value.isBlank())
                .distinct()
                .toList();
    }

    private double[] decodeLogits(
            Seq2SeqHandle handle,
            List<Long> generatedIds,
            float[][][] encoderHiddenStates,
            long[] attentionMask
    ) throws OrtException {
        Map<String, OnnxTensor> tensors = new LinkedHashMap<>();
        try {
            long[] decoderInputIds = generatedIds.stream().mapToLong(Long::longValue).toArray();
            addLongTensorIfExpected(handle.environment(), handle.decoder(), tensors, "input_ids", decoderInputIds);
            addLongTensorIfExpected(handle.environment(), handle.decoder(), tensors, "decoder_input_ids", decoderInputIds);
            addFloatTensorIfExpected(handle.environment(), handle.decoder(), tensors, "encoder_hidden_states", encoderHiddenStates);
            addFloatTensorIfExpected(handle.environment(), handle.decoder(), tensors, "encoder_outputs", encoderHiddenStates);
            addLongTensorIfExpected(handle.environment(), handle.decoder(), tensors, "encoder_attention_mask", attentionMask);
            addLongTensorIfExpected(handle.environment(), handle.decoder(), tensors, "attention_mask", attentionMask);
            try (OrtSession.Result result = handle.decoder().run(tensors)) {
                Object value = result.get(0).getValue();
                if (value instanceof float[][][] logits) {
                    return lastTokenLogits(logits[0]);
                }
                if (value instanceof double[][][] logits) {
                    return lastTokenLogits(logits[0]);
                }
                throw new ParaphraseModelException("Output decoder VietQuill không hỗ trợ: " + value.getClass().getName());
            }
        } finally {
            OnnxValue.close(tensors.values());
        }
    }

    private void addLongTensorIfExpected(
            OrtEnvironment environment,
            OrtSession session,
            Map<String, OnnxTensor> tensors,
            String name,
            long[] values
    ) throws OrtException {
        if (session.getInputNames().contains(name)) {
            tensors.put(name, OnnxTensor.createTensor(environment, new long[][]{values}));
        }
    }

    private void addFloatTensorIfExpected(
            OrtEnvironment environment,
            OrtSession session,
            Map<String, OnnxTensor> tensors,
            String name,
            float[][][] values
    ) throws OrtException {
        if (session.getInputNames().contains(name)) {
            tensors.put(name, OnnxTensor.createTensor(environment, values));
        }
    }

    private synchronized void ensureInitialized() {
        if (initialized) {
            return;
        }
        handlePool.initialize(index -> {
            log.info("Loading VietQuill handle {}/{}", index + 1, handlePool.poolSize());
            return loadSingleRuntime();
        });
        initialized = true;
    }

    private RuntimeHandle loadSingleRuntime() {
        try {
            Path root = properties.getModelPath();
            OrtEnvironment environment = OrtEnvironment.getEnvironment();
            Path questionRoot = resolveSeq2SeqRoot(root, "question");
            Path sentenceRoot = resolveSeq2SeqRoot(root, "sentence");
            Seq2SeqHandle question = loadSeq2Seq(environment, questionRoot);
            Seq2SeqHandle sentence = questionRoot.equals(sentenceRoot)
                    ? question
                    : loadSeq2Seq(environment, sentenceRoot);
            log.info("Đã load VietQuill ONNX model {} từ {}", properties.getModel(), root);
            return new RuntimeHandle(question, sentence);
        } catch (Exception ex) {
            throw new ParaphraseModelException("Không load được VietQuill ONNX model từ " + properties.getModelPath(), ex);
        }
    }

    private Seq2SeqHandle loadSeq2Seq(OrtEnvironment environment, Path root) throws Exception {
        Path encoderModel = resolveModelFile(root, ENCODER_FILE_NAMES, "encoder_model.onnx");
        Path decoderModel = resolveModelFile(root, DECODER_FILE_NAMES, "decoder_model.onnx");
        Path tokenizerPath = resolveTokenizer(root);
        Path configPath = resolveConfig(root);
        HuggingFaceTokenizer tokenizer = HuggingFaceTokenizer.newInstance(tokenizerPath);
        ModelConfig modelConfig = readModelConfig(configPath);
        OrtSession.SessionOptions options = new OrtSession.SessionOptions();
        options.setOptimizationLevel(OrtSession.SessionOptions.OptLevel.ALL_OPT);
        OrtSession encoder = environment.createSession(encoderModel.toString(), options);
        OrtSession decoder = environment.createSession(decoderModel.toString(), options);
        options.close();
        List<String> kvCacheInputNames = detectKvCacheInputs(decoder);
        List<String> kvCacheOutputNames = detectKvCacheOutputs(decoder);
        if (!kvCacheInputNames.isEmpty()) {
            log.info("Detected KV-cache support in decoder: {} inputs, {} outputs",
                    kvCacheInputNames.size(), kvCacheOutputNames.size());
        }
        return new Seq2SeqHandle(environment, encoder, decoder, tokenizer, modelConfig,
                kvCacheInputNames, kvCacheOutputNames);
    }

    /**
     * Detect past_key_values input names from decoder, sorted by index.
     */
    private List<String> detectKvCacheInputs(OrtSession decoder) {
        Set<String> inputNames = decoder.getInputNames();
        return inputNames.stream()
                .filter(name -> name.startsWith("past_key_values"))
                .sorted(this::compareKvCacheName)
                .collect(Collectors.toList());
    }

    /**
     * Detect present key/value output names from decoder, sorted by index.
     */
    private List<String> detectKvCacheOutputs(OrtSession decoder) {
        Set<String> outputNames = decoder.getOutputNames();
        return outputNames.stream()
                .filter(name -> name.startsWith("present"))
                .sorted(this::compareKvCacheName)
                .collect(Collectors.toList());
    }

    /**
     * Sort KV-cache names by their numeric index (e.g. past_key_values.0.key < past_key_values.1.key).
     */
    private int compareKvCacheName(String a, String b) {
        int idxA = extractKvCacheIndex(a);
        int idxB = extractKvCacheIndex(b);
        int cmp = Integer.compare(idxA, idxB);
        if (cmp != 0) {
            return cmp;
        }
        // Within same index, key comes before value
        boolean aKey = a.endsWith(".key") || a.contains(".key");
        boolean bKey = b.endsWith(".key") || b.contains(".key");
        if (aKey && !bKey) return -1;
        if (!aKey && bKey) return 1;
        return a.compareTo(b);
    }

    private int extractKvCacheIndex(String name) {
        // Extract the first number from the name
        java.util.regex.Matcher m = java.util.regex.Pattern.compile("\\d+").matcher(name);
        return m.find() ? Integer.parseInt(m.group()) : 0;
    }

    private Path resolveSeq2SeqRoot(Path root, String childName) throws IOException {
        Path child = root.resolve(childName);
        if (hasSeq2SeqFiles(child)) {
            return child;
        }
        if (hasSeq2SeqFiles(root)) {
            return root;
        }
        throw new IOException("Không tìm thấy ONNX seq2seq " + childName + " trong " + root);
    }

    private boolean hasSeq2SeqFiles(Path root) {
        return Files.isDirectory(root)
                && hasAny(root, ENCODER_FILE_NAMES)
                && hasAny(root, DECODER_FILE_NAMES)
                && Files.isRegularFile(root.resolve("tokenizer.json"))
                && Files.isRegularFile(root.resolve("config.json"));
    }

    private boolean hasAny(Path root, String[] names) {
        for (String name : names) {
            if (Files.isRegularFile(root.resolve(name))) {
                return true;
            }
        }
        return false;
    }

    private Path resolveModelFile(Path root, String[] names, String displayName) throws IOException {
        for (String name : names) {
            Path direct = root.resolve(name);
            if (Files.isRegularFile(direct)) {
                return direct;
            }
            Path nested = root.resolve("onnx").resolve(name);
            if (Files.isRegularFile(nested)) {
                return nested;
            }
        }
        if (!Files.isDirectory(root)) {
            throw new IOException("Không tìm thấy thư mục model VietQuill: " + root);
        }
        try (Stream<Path> paths = Files.walk(root, 3)) {
            return paths
                    .filter(Files::isRegularFile)
                    .filter(path -> {
                        String filename = path.getFileName().toString();
                        for (String name : names) {
                            if (filename.equals(name)) {
                                return true;
                            }
                        }
                        return false;
                    })
                    .findFirst()
                    .orElseThrow(() -> new IOException("Không tìm thấy " + displayName + " trong " + root));
        }
    }

    private Path resolveTokenizer(Path root) throws IOException {
        Path direct = root.resolve("tokenizer.json");
        if (Files.isRegularFile(direct)) {
            return direct;
        }
        Path nested = root.resolve("onnx").resolve("tokenizer.json");
        if (Files.isRegularFile(nested)) {
            return nested;
        }
        if (!Files.isDirectory(root)) {
            throw new IOException("Không tìm thấy tokenizer.json trong " + root);
        }
        try (Stream<Path> paths = Files.walk(root, 3)) {
            return paths
                    .filter(path -> Files.isRegularFile(path) && path.getFileName().toString().equals("tokenizer.json"))
                    .findFirst()
                    .orElseThrow(() -> new IOException("Không tìm thấy tokenizer.json trong " + root
                            + ". Hãy export tokenizer fast cùng ONNX model."));
        }
    }

    private Path resolveConfig(Path root) throws IOException {
        Path direct = root.resolve("config.json");
        if (Files.isRegularFile(direct)) {
            return direct;
        }
        Path nested = root.resolve("onnx").resolve("config.json");
        if (Files.isRegularFile(nested)) {
            return nested;
        }
        if (!Files.isDirectory(root)) {
            throw new IOException("Không tìm thấy config.json trong " + root);
        }
        try (Stream<Path> paths = Files.walk(root, 3)) {
            return paths
                    .filter(path -> Files.isRegularFile(path) && path.getFileName().toString().equals("config.json"))
                    .findFirst()
                    .orElseThrow(() -> new IOException("Không tìm thấy config.json trong " + root));
        }
    }

    private ModelConfig readModelConfig(Path configPath) throws IOException {
        JsonNode root = objectMapper.readTree(configPath.toFile());
        int decoderStart = intValue(root, "decoder_start_token_id", intValue(root, "pad_token_id", 0));
        int eos = intValue(root, "eos_token_id", 1);
        int pad = intValue(root, "pad_token_id", decoderStart);
        return new ModelConfig(decoderStart, eos, pad);
    }

    private int intValue(JsonNode node, String field, int fallback) {
        JsonNode value = node.get(field);
        return value == null || value.isNull() ? fallback : value.asInt(fallback);
    }

    private long[] truncate(long[] values, int maxLength) {
        int safeMaxLength = Math.max(1, maxLength);
        if (values == null) {
            return new long[0];
        }
        if (values.length <= safeMaxLength) {
            return values;
        }
        long[] truncated = new long[safeMaxLength];
        System.arraycopy(values, 0, truncated, 0, safeMaxLength);
        return truncated;
    }

    private long[] filled(int length, long value) {
        long[] result = new long[length];
        for (int i = 0; i < length; i++) {
            result[i] = value;
        }
        return result;
    }

    private double[] lastTokenLogits(float[][] logits) {
        float[] lastToken = logits[logits.length - 1];
        double[] result = new double[lastToken.length];
        for (int i = 0; i < lastToken.length; i++) {
            result[i] = lastToken[i];
        }
        return result;
    }

    private double[] lastTokenLogits(double[][] logits) {
        return logits[logits.length - 1];
    }

    private List<TopToken> topTokens(double[] logits, int count) {
        double max = Double.NEGATIVE_INFINITY;
        for (double logit : logits) {
            if (logit > max) {
                max = logit;
            }
        }
        double sum = 0;
        for (double logit : logits) {
            sum += Math.exp(logit - max);
        }
        double logSumExp = max + Math.log(sum);

        // PriorityQueue min-heap để giữ top-k tokens
        java.util.PriorityQueue<TopToken> heap = new java.util.PriorityQueue<>(
                (a, b) -> Double.compare(a.logProbability(), b.logProbability()));

        for (int i = 0; i < logits.length; i++) {
            TopToken token = new TopToken(i, logits[i] - logSumExp);
            if (heap.size() < count) {
                heap.offer(token);
            } else if (token.logProbability() > heap.peek().logProbability()) {
                heap.poll();
                heap.offer(token);
            }
        }

        List<TopToken> result = new ArrayList<>(heap);
        result.sort((a, b) -> Double.compare(b.logProbability(), a.logProbability()));
        return result;
    }

    private String decodeTokens(Seq2SeqHandle handle, List<Long> tokenIds) {
        long[] decodedIds = tokenIds.stream()
                .skip(1)
                .filter(id -> id != handle.modelConfig().padTokenId())
                .mapToLong(Long::longValue)
                .toArray();
        return handle.tokenizer().decode(decodedIds, true).trim();
    }

    private float[][][] toFloat(double[][][] values) {
        float[][][] result = new float[values.length][][];
        for (int batch = 0; batch < values.length; batch++) {
            result[batch] = new float[values[batch].length][];
            for (int token = 0; token < values[batch].length; token++) {
                result[batch][token] = new float[values[batch][token].length];
                for (int dim = 0; dim < values[batch][token].length; dim++) {
                    result[batch][token][dim] = (float) values[batch][token][dim];
                }
            }
        }
        return result;
    }

    private List<ParaphrasedMcq> mock(ParaphraseModelInput input, int count) {
        List<ParaphrasedMcq> results = new ArrayList<>();
        for (int i = 0; i < count; i++) {
            int variant = i + 1;
            results.add(new ParaphrasedMcq(
                    "Theo cách diễn đạt khác, " + decapitalize(input.stem()),
                    "Phương án A: " + input.optionA(),
                    "Phương án B: " + input.optionB(),
                    "Phương án C: " + input.optionC(),
                    "Phương án D: " + input.optionD(),
                    "mock-vietquill-variant-" + variant
            ));
        }
        return results;
    }

    private String rawMcq(String stem, String optionA, String optionB, String optionC, String optionD) {
        return """
                Câu hỏi: %s
                A. %s
                B. %s
                C. %s
                D. %s
                """.formatted(stem, optionA, optionB, optionC, optionD).trim();
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }

    private String decapitalize(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }
        String trimmed = value.trim();
        return trimmed.substring(0, 1).toLowerCase() + trimmed.substring(1);
    }

    // ──────────────────────────────────────────────
    // KV-Cache Beam Search (Phase 4)
    // ──────────────────────────────────────────────

    /**
     * Beam search decode WITH KV-cache.
     * Chỉ truyền 1 token mới mỗi step + past_key_values → O(n) thay vì O(n²).
     */
    private List<String> beamDecodeWithKvCache(
            Seq2SeqHandle handle,
            float[][][] encoderHiddenStates,
            long[] encoderAttentionMask
    ) throws OrtException {
        int beamWidth = Math.max(1, Math.min(6, properties.getNumBeams()));
        int maxTokens = Math.max(8, Math.min(properties.getMaxOutputLength(), properties.getMaxDecodeLength()));

        // Mỗi beam có KV-cache riêng (null ở step 0)
        List<BeamKv> beams = List.of(new BeamKv(
                List.of((long) handle.modelConfig().decoderStartTokenId()),
                null,   // KV-cache ban đầu null → decoder sẽ không nhận past_key_values
                0,
                false
        ));

        for (int step = 0; step < maxTokens; step++) {
            List<BeamKv> candidates = new ArrayList<>();
            for (BeamKv beam : beams) {
                if (beam.done()) {
                    candidates.add(beam);
                    continue;
                }

                // Chỉ truyền token MỚI NHẤT + KV-cache cũ
                long lastTokenId = beam.tokenIds().get(beam.tokenIds().size() - 1);
                KvDecodeResult decodeResult = decodeLogitsWithKvCache(
                        handle,
                        lastTokenId,              // ← Chỉ 1 token!
                        beam.pastKV(),            // ← KV-cache từ step trước
                        encoderHiddenStates,
                        encoderAttentionMask
                );

                List<float[][][]> sharedNextCache = decodeResult.nextPastKV();
                for (TopToken token : topTokens(decodeResult.logits(), beamWidth)) {
                    boolean done = token.id() == handle.modelConfig().eosTokenId();
                    List<Long> nextIds = new ArrayList<>(beam.tokenIds());
                    if (!done) {
                        nextIds.add(token.id());
                    }
                    // Clone KV-cache cho mỗi candidate beam để tránh sharing mutable state
                    List<float[][][]> clonedCache = sharedNextCache != null
                            ? clonePastKV(sharedNextCache)
                            : null;
                    candidates.add(new BeamKv(
                            nextIds,
                            clonedCache,
                            beam.score() + token.logProbability(),
                            done
                    ));
                }
            }
            beams = candidates.stream()
                    .sorted((left, right) -> Double.compare(right.rankScore(), left.rankScore()))
                    .limit(beamWidth)
                    .toList();
            if (beams.stream().allMatch(BeamKv::done)) {
                break;
            }
        }

        return beams.stream()
                .map(beam -> decodeTokens(handle, beam.tokenIds()))
                .filter(value -> !value.isBlank())
                .distinct()
                .toList();
    }

    /**
     * Single decode step with KV-cache.
     * Input:  1 token mới + past KV cache + encoder hidden states
     * Output: logits cho token tiếp theo + KV cache mới
     */
    private KvDecodeResult decodeLogitsWithKvCache(
            Seq2SeqHandle handle,
            long lastTokenId,
            List<float[][][]> pastKeyValues,  // null hoặc empty ở step 0
            float[][][] encoderHiddenStates,
            long[] encoderAttentionMask
    ) throws OrtException {
        Map<String, OnnxTensor> tensors = new LinkedHashMap<>();
        try {
            // 1. Chỉ truyền 1 token mới nhất
            addLongTensorIfExpected(handle.environment(), handle.decoder(), tensors,
                    "input_ids", new long[]{lastTokenId});
            addLongTensorIfExpected(handle.environment(), handle.decoder(), tensors,
                    "decoder_input_ids", new long[]{lastTokenId});

            // 2. Encoder hidden states (giữ nguyên)
            addFloatTensorIfExpected(handle.environment(), handle.decoder(), tensors,
                    "encoder_hidden_states", encoderHiddenStates);
            addFloatTensorIfExpected(handle.environment(), handle.decoder(), tensors,
                    "encoder_outputs", encoderHiddenStates);
            addLongTensorIfExpected(handle.environment(), handle.decoder(), tensors,
                    "encoder_attention_mask", encoderAttentionMask);
            addLongTensorIfExpected(handle.environment(), handle.decoder(), tensors,
                    "attention_mask", encoderAttentionMask);

            // 3. Past key values từ các step trước (nếu có)
            if (pastKeyValues != null && !pastKeyValues.isEmpty()) {
                addPastKeyValues(handle, tensors, pastKeyValues);
            }

            try (OrtSession.Result result = handle.decoder().run(tensors)) {
                // Output 0: logits
                double[] logits = extractLogitsFromResult(result);

                // Output 1+: present key values (KV-cache mới cho step sau)
                List<float[][][]> nextKvCache = extractPastKeyValues(result, handle.kvCacheOutputNames().size());

                return new KvDecodeResult(logits, nextKvCache);
            }
        } finally {
            OnnxValue.close(tensors.values());
        }
    }

    private double[] extractLogitsFromResult(OrtSession.Result result) throws OrtException {
        Object value = result.get(0).getValue();
        if (value instanceof float[][][] logits) {
            return lastTokenLogits(logits[0]);
        }
        if (value instanceof double[][][] logits) {
            return lastTokenLogits(logits[0]);
        }
        throw new ParaphraseModelException("Output decoder VietQuill không hỗ trợ: " + value.getClass().getName());
    }

    /**
     * Add past key values as decoder inputs.
     * Maps stored float[][][] arrays to ONNX tensor inputs by matching kvCacheInputNames order.
     */
    private void addPastKeyValues(
            Seq2SeqHandle handle,
            Map<String, OnnxTensor> tensors,
            List<float[][][]> pastKeyValues
    ) throws OrtException {
        List<String> inputNames = handle.kvCacheInputNames();
        for (int i = 0; i < pastKeyValues.size() && i < inputNames.size(); i++) {
            String name = inputNames.get(i);
            if (handle.decoder().getInputNames().contains(name)) {
                tensors.put(name, OnnxTensor.createTensor(handle.environment(), pastKeyValues.get(i)));
            }
        }
    }

    /**
     * Extract present key values from decoder outputs.
     * Returns a list of float[][][] matching kvCacheOutputNames order.
     */
    private List<float[][][]> extractPastKeyValues(OrtSession.Result result, int expectedCount) throws OrtException {
        List<float[][][]> entries = new ArrayList<>();
        // Output 0 is logits, outputs 1+ are present key values
        for (int i = 1; i < expectedCount + 1 && i < result.size(); i++) {
            try {
                Object value = result.get(i).getValue();
                if (value instanceof float[][][] floats) {
                    entries.add(clone3D(floats));
                } else if (value instanceof double[][][] doubles) {
                    entries.add(toFloat(doubles));
                }
            } catch (OrtException ignored) {
                break; // No more present outputs
            }
        }
        return entries.isEmpty() ? null : entries;
    }

    /**
     * Deep clone a list of float[][][] arrays (KV-cache entries).
     * Cần thiết khi fork beams để mỗi beam có cache riêng.
     */
    private List<float[][][]> clonePastKV(List<float[][][]> source) {
        List<float[][][]> cloned = new ArrayList<>(source.size());
        for (float[][][] entry : source) {
            cloned.add(clone3D(entry));
        }
        return cloned;
    }

    /**
     * Deep clone a 3D float array.
     */
    private float[][][] clone3D(float[][][] source) {
        float[][][] result = new float[source.length][][];
        for (int i = 0; i < source.length; i++) {
            result[i] = new float[source[i].length][];
            for (int j = 0; j < source[i].length; j++) {
                result[i][j] = source[i][j].clone();
            }
        }
        return result;
    }

    // ──────────────────────────────────────────────
    // Inner records
    // ──────────────────────────────────────────────

    private record Beam(List<Long> tokenIds, double score, boolean done) {
        private double rankScore() {
            return score / Math.pow(Math.max(1, tokenIds.size()), 0.7);
        }
    }

    /**
     * Beam entry with KV-cache.
     */
    private record BeamKv(
            List<Long> tokenIds,
            List<float[][][]> pastKV,  // null = step 0 (no cache yet)
            double score,
            boolean done
    ) {
        private double rankScore() {
            return score / Math.pow(Math.max(1, tokenIds.size()), 0.7);
        }
    }

    /**
     * Result of one decode step with KV-cache.
     */
    private record KvDecodeResult(
            double[] logits,
            List<float[][][]> nextPastKV  // null nếu model không output KV cache
    ) {
    }

    /**
     * Cached encoder result — tokenized prompt + encoder hidden states.
     * Có thể reuse cho nhiều lần decode (multi-variant).
     */
    private record EncoderState(float[][][] hiddenStates, long[] attentionMask) {
    }

    private record TopToken(long id, double logProbability) {
    }
}
