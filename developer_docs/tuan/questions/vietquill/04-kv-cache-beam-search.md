# Phase 4: KV-Cache & Tối ưu Beam Search

> **Mục tiêu:** Giảm độ phức tạp decoder từ O(n²) xuống O(n) bằng KV-cache
> **Độ phức tạp:** Cao | **Risk:** Cao | **Kỳ vọng cải thiện:** Nhanh hơn 3-10x cho decoder

---

## 4.1 Hiện trạng — Beam search không có KV-cache

### File: `VietQuillParaphraseModelService.java` (lines 151-195, 197-225)

```java
private List<String> beamDecode(
        Seq2SeqHandle handle,
        float[][][] encoderHiddenStates,
        long[] attentionMask
) throws OrtException {
    int beamWidth = 4;
    int maxTokens = 96;
    List<Beam> beams = List.of(new Beam(List.of(decoderStartTokenId()), 0, false));

    for (int step = 0; step < maxTokens; step++) {           // ← O(n)
        List<Beam> candidates = new ArrayList<>();
        for (Beam beam : beams) {                             // ← O(beamWidth)
            if (beam.done()) continue;
            double[] logits = decodeLogits(                   // ← O(step) vì reprocess toàn bộ sequence!
                handle, beam.tokenIds(), encoderHiddenStates, attentionMask
            );
            // ...
        }
    }
}
```

```java
private double[] decodeLogits(
        Seq2SeqHandle handle,
        List<Long> generatedIds,              // ← Mỗi step, list này dài thêm 1 token
        float[][][] encoderHiddenStates,
        long[] attentionMask
) throws OrtException {
    // Tạo tensor decoder_input_ids với TOÀN BỘ generatedIds
    long[] decoderInputIds = generatedIds.stream().mapToLong(Long::longValue).toArray();
    addLongTensorIfExpected(handle.environment(), handle.decoder(), tensors, "input_ids", decoderInputIds);
    // ... encoder_hidden_states cũng được truyền vào mỗi lần (tốn băng thông)
    addFloatTensorIfExpected(handle.environment(), handle.decoder(), tensors, "encoder_hidden_states", encoderHiddenStates);
    // ...
}
```

### Chi phí thực tế:

Với T5 decoder, mỗi token mới cần attention qua **toàn bộ các token trước đó**. Nếu không cache:

```
Step 1: process [token_0]               → 1 token
Step 2: process [token_0, token_1]      → 2 tokens
Step 3: process [token_0, token_1, token_2] → 3 tokens
...
Step 96: process [96 tokens]            → 96 tokens
```

**Tổng số token được xử lý: 1 + 2 + 3 + ... + 96 = 4,656 token-operations**
**Với KV-cache: 96 token-operations (mỗi step chỉ xử lý 1 token mới)**

**Thêm beam_width=4:**
- Không cache: 4 × 4,656 = 18,624 token-operations
- Có cache: 4 × 96 = 384 token-operations
- **Speedup lý thuyết: ~48x cho decoder!**

---

## 4.2 Giải pháp: KV-Cache với ONNX Runtime

### Cơ chế

Trong Transformer decoder, mỗi step chỉ cần:
1. **Token mới** (1 token, không phải toàn bộ sequence)
2. **KV-cache** từ các step trước (key-value pairs của tất cả token đã generate)

Thay vì truyền `decoder_input_ids = [t0, t1, t2, ..., t_n]`, ta truyền:
- `decoder_input_ids = [t_n]` (chỉ token mới nhất)
- `past_key_values` = KV-cache tích lũy từ step 0 → n-1

### Yêu cầu với ONNX model

Model ONNX phải export với `use_cache=True` để có input/output `past_key_values`.

**Kiểm tra model hiện tại có hỗ trợ KV-cache không:**

```python
# Python script kiểm tra
import onnx
model = onnx.load("decoder_model.onnx")
inputs = [i.name for i in model.graph.input]
outputs = [o.name for o in model.graph.output]
print("Inputs:", inputs)
print("Outputs:", outputs)
# Tìm "past_key_values" trong inputs và outputs
```

### 2 tình huống:

#### A) Model ĐÃ export với KV-cache
→ Implement trực tiếp (xem section 4.3)

#### B) Model CHƯA export với KV-cache
→ Cần re-export model từ PyTorch/HuggingFace với `use_cache=True`
→ Đây là bước extra, cần Python script

---

## 4.3 Implementation (nếu model có KV-cache)

### 4.3.1 Cấu trúc Past Key Values

```java
/**
 * Container cho KV-cache của 1 decoder layer.
 * Mỗi T5 layer có 2 cache tensors: key và value (cho self-attention + cross-attention).
 */
private record KvCacheEntry(
    float[][][] selfAttentionKey,    // [batch, heads, seq_len, head_dim]
    float[][][] selfAttentionValue,
    float[][][] crossAttentionKey,
    float[][][] crossAttentionValue
) {}

/**
 * Toàn bộ KV-cache cho decoder: list các layer.
 * List<KvCacheEntry> với mỗi entry là 1 decoder layer.
 */
```

### 4.3.2 BeamDecode với KV-cache

```java
private List<String> beamDecodeWithKvCache(
        Seq2SeqHandle handle,
        float[][][] encoderHiddenStates,
        long[] encoderAttentionMask
) throws OrtException {
    int beamWidth = Math.max(1, Math.min(6, properties.getNumBeams()));
    int maxTokens = Math.max(8, Math.min(properties.getMaxOutputLength(), properties.getMaxDecodeLength()));

    // Mỗi beam có KV-cache riêng → cần clone khi fork beam
    List<BeamKv> beams = List.of(new BeamKv(
        List.of((long) handle.modelConfig().decoderStartTokenId()),
        null,   // ← KV-cache ban đầu là null/rỗng
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

            // CHỈ truyền token MỚI NHẤT + KV-cache cũ
            long lastTokenId = beam.tokenIds().get(beam.tokenIds().size() - 1);
            KvDecodeResult decodeResult = decodeLogitsWithKvCache(
                handle,
                lastTokenId,              // ← Chỉ 1 token!
                beam.kvCache(),           // ← KV-cache từ step trước
                encoderHiddenStates,
                encoderAttentionMask
            );

            for (TopToken token : topTokens(decodeResult.logits(), beamWidth)) {
                boolean done = token.id() == handle.modelConfig().eosTokenId();
                List<Long> nextIds = new ArrayList<>(beam.tokenIds());
                if (!done) {
                    nextIds.add(token.id());
                }
                candidates.add(new BeamKv(
                    nextIds,
                    decodeResult.nextKvCache(),  // ← KV-cache mới từ decoder output
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
```

### 4.3.3 DecodeLogits với KV-cache

```java
private KvDecodeResult decodeLogitsWithKvCache(
        Seq2SeqHandle handle,
        long lastTokenId,
        List<KvCacheEntry> pastKeyValues,  // null hoặc empty ở step 0
        float[][][] encoderHiddenStates,
        long[] encoderAttentionMask
) throws OrtException {
    Map<String, OnnxTensor> tensors = new LinkedHashMap<>();
    try {
        // 1. Chỉ truyền 1 token mới nhất
        addLongTensorIfExpected(handle.environment(), handle.decoder(), tensors,
            "input_ids", new long[]{lastTokenId});

        // 2. Encoder hidden states (giữ nguyên)
        addFloatTensorIfExpected(handle.environment(), handle.decoder(), tensors,
            "encoder_hidden_states", encoderHiddenStates);

        // 3. Past key values từ các step trước
        if (pastKeyValues != null) {
            addPastKeyValues(handle, tensors, pastKeyValues);
        }

        try (OrtSession.Result result = handle.decoder().run(tensors)) {
            // Output 0: logits
            float[][][] outputLogits = (float[][][]) result.get(0).getValue();
            double[] logits = lastTokenLogits(outputLogits[0]);

            // Output 1+: present key values (KV-cache mới cho step sau)
            List<KvCacheEntry> nextKvCache = extractPastKeyValues(result);

            return new KvDecodeResult(logits, nextKvCache);
        }
    } finally {
        OnnxValue.close(tensors.values());
    }
}
```

---

## 4.4 Nếu model CHƯA có KV-cache — Re-export

### Python script re-export model:

```python
# export_vietquill_with_cache.py
import torch
from transformers import T5ForConditionalGeneration, AutoTokenizer

model_name = "ngwgsang/vietquill-vit5-base-tsubaki"
model = T5ForConditionalGeneration.from_pretrained(model_name)
tokenizer = AutoTokenizer.from_pretrained(model_name)

# Export encoder
encoder = model.encoder
encoder.eval()
dummy_input_ids = torch.randint(0, 32000, (1, 128))
dummy_attention_mask = torch.ones(1, 128, dtype=torch.long)
torch.onnx.export(
    encoder,
    (dummy_input_ids, dummy_attention_mask),
    "encoder_model.onnx",
    input_names=["input_ids", "attention_mask"],
    output_names=["encoder_hidden_states"],
    dynamic_axes={
        "input_ids": {0: "batch", 1: "sequence"},
        "attention_mask": {0: "batch", 1: "sequence"},
        "encoder_hidden_states": {0: "batch", 1: "sequence"}
    },
    opset_version=14
)

# Export decoder WITH cache
decoder = model.decoder
decoder.eval()
encoder_hidden_states = torch.randn(1, 128, 768)
dummy_decoder_input = torch.randint(0, 32000, (1, 1))  # Chỉ 1 token!

# Tạo dummy past_key_values từ 1 forward pass với full sequence để lấy shape
with torch.no_grad():
    dummy_full_input = torch.randint(0, 32000, (1, 64))
    encoder_out = encoder(dummy_full_input, torch.ones(1, 64, dtype=torch.long))
    decoder_out = decoder(
        input_ids=dummy_full_input,
        encoder_hidden_states=encoder_out.last_hidden_state,
        use_cache=True
    )
    past_key_values = decoder_out.past_key_values

# Build input/output names
past_kv_input_names = []
past_kv_output_names = []
for i, (k, v) in enumerate(past_key_values):
    past_kv_input_names.append(f"past_key_values.{i}.key")
    past_kv_input_names.append(f"past_key_values.{i}.value")
    past_kv_output_names.append(f"present.{i}.key")
    past_kv_output_names.append(f"present.{i}.value")

torch.onnx.export(
    decoder,
    (dummy_decoder_input, encoder_out.last_hidden_state, *past_key_values),
    "decoder_model.onnx",
    input_names=["input_ids", "encoder_hidden_states"] + past_kv_input_names,
    output_names=["logits"] + past_kv_output_names,
    dynamic_axes={...},
    opset_version=14
)
```

---

## 4.5 Giải pháp thay thế: Greedy Decoding + Sampling

Nếu việc implement KV-cache quá phức tạp, có thể cân nhắc thay beam search bằng greedy decoding với temperature sampling. Code mẫu trong file đầy đủ.

**Trade-off:**
| | Beam search (hiện tại) | Greedy + sampling |
|---|---|---|
| Chất lượng | Cao (tìm global best) | Khá (có thể sub-optimal) |
| Tốc độ | O(n²) | O(n²) — vẫn không có KV-cache |
| Đa dạng | Các beam khác nhau ít | Đa dạng hơn (sampling ngẫu nhiên) |

> **Lưu ý:** Greedy không giải quyết được vấn đề O(n²)! Nó chỉ giảm hằng số (1 path thay vì beamWidth paths). Vấn đề gốc vẫn là không có KV-cache.

---

## 4.6 Kế hoạch triển khai thực tế

### Giai đoạn 4A: Nghiên cứu & Chuẩn bị (1-2 ngày)
1. Kiểm tra model ONNX hiện tại có `past_key_values` input không
2. Nếu không → viết script Python re-export model với KV-cache
3. Test model mới với ONNX Runtime Java

### Giai đoạn 4B: Implement KV-cache (2-3 ngày)
1. Implement `KvDecodeResult`, `KvCacheEntry` data structures
2. Implement `decodeLogitsWithKvCache()` — truyền 1 token + past KV
3. Implement `beamDecodeWithKvCache()` — manage KV-cache cho từng beam
4. Thêm feature flag: `kv-cache-enabled`

### Giai đoạn 4C: Test & Verify (1-2 ngày)
1. Unit test: verify output giống hệt giữa cache và non-cache
2. Performance test: đo latency trước/sau
3. So sánh chất lượng output (beam search có KV-cache vs không)

---

## 4.7 Kỳ vọng kết quả

| Metric | Trước (không cache) | Sau (có KV-cache) |
|---|---|---|
| Decoder complexity | O(n²) = 4,656 token-ops | O(n) = 96 token-ops |
| Decoder speedup | Baseline | **~48x lý thuyết, ~5-10x thực tế** |
| Tổng latency 1 variant | 2-4s | **0.3-0.8s** |
| RAM cho KV-cache | 0 | ~10-50MB per beam |

---

## 4.8 Risk assessment

- **Cao — Cần re-export model**: Nếu model hiện tại không có KV-cache, phải re-export từ PyTorch → có thể thay đổi behavior
- **Độ phức tạp implementation cao**: Quản lý KV-cache cho beam search phức tạp (mỗi beam có cache riêng, cần clone khi fork)
- **Memory leak risk**: KV-cache tensors cần được đóng đúng cách sau mỗi beam
- **Compatibility**: Cần đảm bảo ONNX model version tương thích với ONNX Runtime Java
- **Fallback plan**: Giữ logic cũ làm fallback nếu KV-cache model không hoạt động

---

## 4.9 Ước tính tổng hợp sau 4 Phase

| Phase | Latency giảm | Throughput tăng | Risk |
|---|---|---|---|
| 1. Cấu hình | 20-30% (request đầu) | 0% | Thấp |
| 2. Single-pass | ~5x (inference) | 0% | Trung bình |
| 3. Handle pool | 0% (per-request) | Nx (N=pool size) | Trung bình |
| 4. KV-cache | 5-10x (decoder) | 5-10x | Cao |

**Tổng hợp lý tưởng (sau cả 4 phase):**
- Latency: từ 8-15s → **0.5-1.5s** (nhanh hơn 10-15x)
- Throughput: từ 6-12 req/min → **40-120 req/min** (với pool=3)
