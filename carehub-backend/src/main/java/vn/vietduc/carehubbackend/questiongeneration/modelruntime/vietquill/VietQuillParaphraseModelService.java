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
import java.util.Objects;
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
    private volatile RuntimeHandle runtime;

    @PostConstruct
    void preload() {
        if (!properties.isVietQuillProvider() || !properties.isPreload()) {
            return;
        }
        try {
            ensureRuntime();
        } catch (RuntimeException ex) {
            log.warn("Không preload được VietQuill model tại {}: {}", properties.getModelPath(), ex.getMessage());
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
        RuntimeHandle handle = ensureRuntime();
        List<ParaphrasedMcq> results = new ArrayList<>();
        for (int index = 0; index < count; index++) {
            String stem = fallbackIfBlank(generate(handle.question(), input.stem(), index), input.stem());
            String optionA = fallbackIfBlank(generate(handle.sentence(), input.optionA(), index), input.optionA());
            String optionB = fallbackIfBlank(generate(handle.sentence(), input.optionB(), index), input.optionB());
            String optionC = fallbackIfBlank(generate(handle.sentence(), input.optionC(), index), input.optionC());
            String optionD = fallbackIfBlank(generate(handle.sentence(), input.optionD(), index), input.optionD());
            results.add(new ParaphrasedMcq(
                    stem,
                    optionA,
                    optionB,
                    optionC,
                    optionD,
                    rawMcq(stem, optionA, optionB, optionC, optionD)
            ));
        }
        return results;
    }

    private String generate(Seq2SeqHandle handle, String prompt, int variantIndex) {
        synchronized (handle) {
            try {
                Encoding encoding = handle.tokenizer().encode(prompt);
                long[] inputIds = truncate(encoding.getIds(), properties.getMaxInputLength());
                long[] attentionMask = truncate(encoding.getAttentionMask(), properties.getMaxInputLength());
                if (attentionMask.length != inputIds.length) {
                    attentionMask = filled(inputIds.length, 1);
                }

                float[][][] encoderHiddenStates = encode(handle, inputIds, attentionMask);
                List<String> decoded = beamDecode(handle, encoderHiddenStates, attentionMask);
                if (decoded.isEmpty()) {
                    return "";
                }
                return decoded.get(Math.min(variantIndex, decoded.size() - 1));
            } catch (Exception ex) {
                throw new ParaphraseModelException("Không sinh được paraphrase bằng VietQuill ONNX", ex);
            }
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
        int maxTokens = Math.max(8, Math.min(properties.getMaxOutputLength(), 96));
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

    private RuntimeHandle ensureRuntime() {
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
        return new Seq2SeqHandle(environment, encoder, decoder, tokenizer, modelConfig);
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
        List<TopToken> top = new ArrayList<>();
        for (int i = 0; i < logits.length; i++) {
            TopToken token = new TopToken(i, logits[i] - logSumExp);
            int insertAt = 0;
            while (insertAt < top.size() && top.get(insertAt).logProbability() >= token.logProbability()) {
                insertAt++;
            }
            if (insertAt < count) {
                top.add(insertAt, token);
                if (top.size() > count) {
                    top.remove(top.size() - 1);
                }
            }
        }
        return top;
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

    private String fallbackIfBlank(String generated, String fallback) {
        return generated == null || generated.isBlank() ? safe(fallback) : generated.trim();
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

    private record ModelConfig(int decoderStartTokenId, int eosTokenId, int padTokenId) {
    }

    private record RuntimeHandle(
            Seq2SeqHandle question,
            Seq2SeqHandle sentence
    ) implements AutoCloseable {
        private RuntimeHandle {
            Objects.requireNonNull(question);
            Objects.requireNonNull(sentence);
        }

        @Override
        public void close() {
            question.close();
            if (sentence != question) {
                sentence.close();
            }
        }
    }

    private record Seq2SeqHandle(
            OrtEnvironment environment,
            OrtSession encoder,
            OrtSession decoder,
            HuggingFaceTokenizer tokenizer,
            ModelConfig modelConfig
    ) implements AutoCloseable {
        private Seq2SeqHandle {
            Objects.requireNonNull(environment);
            Objects.requireNonNull(encoder);
            Objects.requireNonNull(decoder);
            Objects.requireNonNull(tokenizer);
            Objects.requireNonNull(modelConfig);
        }

        @Override
        public void close() {
            try {
                encoder.close();
            } catch (Exception ignored) {
                // Best effort shutdown only.
            }
            try {
                decoder.close();
            } catch (Exception ignored) {
                // Best effort shutdown only.
            }
            tokenizer.close();
        }
    }

    private record Beam(List<Long> tokenIds, double score, boolean done) {
        private double rankScore() {
            return score / Math.pow(Math.max(1, tokenIds.size()), 0.7);
        }
    }

    private record TopToken(long id, double logProbability) {
    }
}
