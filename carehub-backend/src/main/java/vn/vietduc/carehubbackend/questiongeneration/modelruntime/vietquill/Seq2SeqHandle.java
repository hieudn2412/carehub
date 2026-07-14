package vn.vietduc.carehubbackend.questiongeneration.modelruntime.vietquill;

import ai.djl.huggingface.tokenizers.HuggingFaceTokenizer;
import ai.onnxruntime.OrtEnvironment;
import ai.onnxruntime.OrtSession;

import java.util.List;
import java.util.Objects;

/**
 * Handle chứa ONNX encoder + decoder session và tokenizer cho 1 model seq2seq.
 */
record Seq2SeqHandle(
        OrtEnvironment environment,
        OrtSession encoder,
        OrtSession decoder,
        HuggingFaceTokenizer tokenizer,
        ModelConfig modelConfig,
        List<String> kvCacheInputNames,
        List<String> kvCacheOutputNames
) implements AutoCloseable {
    Seq2SeqHandle {
        Objects.requireNonNull(environment);
        Objects.requireNonNull(encoder);
        Objects.requireNonNull(decoder);
        Objects.requireNonNull(tokenizer);
        Objects.requireNonNull(modelConfig);
        if (kvCacheInputNames == null) {
            kvCacheInputNames = List.of();
        }
        if (kvCacheOutputNames == null) {
            kvCacheOutputNames = List.of();
        }
    }

    /**
     * Whether this model supports KV-cache (has past_key_values inputs/outputs in decoder).
     */
    public boolean kvCacheSupported() {
        return !kvCacheInputNames.isEmpty() && !kvCacheOutputNames.isEmpty();
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
