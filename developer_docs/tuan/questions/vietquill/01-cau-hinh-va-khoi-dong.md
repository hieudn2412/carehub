# Phase 1: Cấu hình & Khởi động tối ưu

> **Mục tiêu:** Quick wins — tối ưu cấu hình và khởi động mà không thay đổi kiến trúc inference.
> **Độ phức tạp:** Thấp | **Risk:** Thấp | **Kỳ vọng cải thiện:** Giảm 20-30% latency request đầu tiên, ổn định hơn

---

## 1.1 Hiện trạng

### File: `AiParaphraseProperties.java`
```java
private boolean preload = false;       // KHÔNG preload model khi startup
private int numBeams = 4;              // Beam width = 4 (cao)
private int maxOutputLength = 512;     // Max output tokens (cao, thực tế chỉ dùng 96)
private int maxInputLength = 512;
private int timeoutSeconds = 60;       // Timeout nhưng không được enforce trong code
```

### File: `VietQuillParaphraseModelService.java`
```java
@PostConstruct
void preload() {
    if (!properties.isVietQuillProvider() || !properties.isPreload()) {
        return;  // ← Luôn return vì preload=false mặc định
    }
    // ...
}
```

### File: `application.yaml`
```yaml
ai:
  paraphrase:
    preload: ${VIETQUILL_PRELOAD:false}       # Mặc định false
    num-beams: ${VIETQUILL_NUM_BEAMS:4}       # Mặc định 4
    max-output-length: ${VIETQUILL_MAX_OUTPUT_LENGTH:512}
    timeout-seconds: ${VIETQUILL_TIMEOUT_SECONDS:60}
```

### Vấn đề:
1. **Model không preload** → Request đầu tiên phải load ONNX model + tokenizer + config (~2-5 giây)
2. **Không có warmup** → ONNX Runtime JIT-compile graph khi infer lần đầu → request đầu chậm thêm
3. **`numBeams=4`** quá cao khi không có KV-cache → mỗi step duyệt 4 beams × O(n) token = rất chậm
4. **`maxOutputLength=512`** nhưng `beamDecode` hard-cap ở 96 tokens → config không nhất quán
5. **`timeoutSeconds`** được khai báo nhưng không có code nào check timeout khi generate

---

## 1.2 Thay đổi đề xuất

### 1.2.1 Bật preload + warmup

**File: `application.yaml`**
```yaml
ai:
  paraphrase:
    preload: ${VIETQUILL_PRELOAD:true}        # Bật preload mặc định
```

**File: `VietQuillParaphraseModelService.java`** — Thêm warmup inference sau khi load model:

```java
@PostConstruct
void preload() {
    if (!properties.isVietQuillProvider() || !properties.isPreload()) {
        return;
    }
    try {
        ensureRuntime();
        warmup();  // ← Thêm warmup
        log.info("VietQuill model preloaded and warmed up successfully");
    } catch (RuntimeException ex) {
        log.warn("Không preload được VietQuill model tại {}: {}", properties.getModelPath(), ex.getMessage());
    }
}

private void warmup() {
    // Chạy 1 inference nhỏ để trigger JIT compilation trong ONNX Runtime
    String warmupPrompt = "paraphrase mcq:\nCâu hỏi: test\nA. test\nB. test\nC. test\nD. test\nĐáp án đúng: A\nYêu cầu: giữ nguyên.";
    RuntimeHandle handle = runtime;
    generate(handle.question(), warmupPrompt, 0);
    generate(handle.sentence(), "test", 0);
    log.info("VietQuill warmup inference completed");
}
```

### 1.2.2 Giảm beam width + điều chỉnh max output

**File: `application.yaml`**
```yaml
ai:
  paraphrase:
    num-beams: ${VIETQUILL_NUM_BEAMS:2}                    # Giảm từ 4 → 2
    max-output-length: ${VIETQUILL_MAX_OUTPUT_LENGTH:128}   # Giảm từ 512 → 128 (thực tế không cần dài)
```

**File: `VietQuillParaphraseModelService.java`** — Sửa `beamDecode` dùng `maxOutputLength` thay vì hard-cap:

```java
// Trước (hard-cap 96):
int maxTokens = Math.max(8, Math.min(properties.getMaxOutputLength(), 96));

// Sau (tôn trọng config, cap hợp lý):
int maxTokens = Math.max(8, Math.min(properties.getMaxOutputLength(), 256));
```

### 1.2.3 Thêm timeout cho generate

**File: `AiParaphraseProperties.java`** — Thêm field mới:
```java
private int generateTimeoutSeconds = 30;  // Timeout cho 1 lần generate()
```

**File: `VietQuillParaphraseModelService.java`** — Wrap paraphrase với `CompletableFuture` timeout:

```java
@Override
public List<ParaphrasedMcq> paraphrase(ParaphraseModelInput input) {
    int count = Math.max(1, Math.min(10, input.requestedCount()));
    // ... validation ...

    try {
        return CompletableFuture
            .supplyAsync(() -> doParaphrase(input, count))
            .get(properties.getTimeoutSeconds(), TimeUnit.SECONDS);
    } catch (TimeoutException ex) {
        throw new ParaphraseModelException(
            "Paraphrase timeout sau " + properties.getTimeoutSeconds() + "s", ex);
    } catch (Exception ex) {
        throw new ParaphraseModelException("Paraphrase thất bại", ex);
    }
}

private List<ParaphrasedMcq> doParaphrase(ParaphraseModelInput input, int count) {
    // Logic paraphrase hiện tại (lines 89-106)
}
```

### 1.2.4 Tách biệt hard-cap cho beam decode

**File: `AiParaphraseProperties.java`:**
```java
private int maxDecodeLength = 96;  // Hard-cap cho beam decode (token Tiếng Việt ngắn)
```

---

## 1.3 Files cần sửa

| File | Thay đổi |
|---|---|
| `application.yaml` | `preload: true`, `num-beams: 2`, `max-output-length: 128` |
| `AiParaphraseProperties.java` | Thêm `generateTimeoutSeconds`, `maxDecodeLength` |
| `VietQuillParaphraseModelService.java` | Thêm `warmup()`, wrap `paraphrase()` với `CompletableFuture` timeout, dùng `maxDecodeLength` config |

---

## 1.4 Kỳ vọng kết quả

| Metric | Trước | Sau |
|---|---|---|
| Thời gian request đầu tiên | ~8-12s (load + JIT + infer) | ~3-5s (đã preload + warmup, chỉ infer) |
| Thời gian request thứ 2+ | ~3-8s | ~2-4s (beam_width=2 thay vì 4) |
| Timeout protection | Không có → treo vĩnh viễn | Có → throw exception sau N giây |
| Startup time | +0s (không load) | +2-4s (chấp nhận được) |

---

## 1.5 Risk assessment

- **Preload tăng startup time**: Chấp nhận được (2-4s), model được load 1 lần
- **Giảm beam width**: Có thể giảm nhẹ chất lượng paraphrase. Beam width 2 thường đủ cho T5 text generation
- **Timeout**: Cần chọn giá trị hợp lý, quá thấp sẽ fail legitimate requests
