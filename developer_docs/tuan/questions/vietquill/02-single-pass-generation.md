# Phase 2: Gom nhóm inference — Single-pass generation

> **Mục tiêu:** Giảm số lần encode-decode từ 5N xuống N (N = số biến thể)
> **Độ phức tạp:** Trung bình | **Risk:** Trung bình | **Kỳ vọng cải thiện:** Nhanh hơn ~5x cho phần inference

---

## 2.1 Hiện trạng — Gọi riêng từng field

### File: `VietQuillParaphraseModelService.java` (lines 80-107)

```java
public List<ParaphrasedMcq> paraphrase(ParaphraseModelInput input) {
    int count = Math.max(1, Math.min(10, input.requestedCount()));
    RuntimeHandle handle = ensureRuntime();
    List<ParaphrasedMcq> results = new ArrayList<>();
    for (int index = 0; index < count; index++) {
        // 5 lần encode+beamDecode RIÊNG BIỆT cho mỗi variant
        String stem    = fallbackIfBlank(generate(handle.question(),  input.stem(),    index), input.stem());
        String optionA = fallbackIfBlank(generate(handle.sentence(), input.optionA(), index), input.optionA());
        String optionB = fallbackIfBlank(generate(handle.sentence(), input.optionB(), index), input.optionB());
        String optionC = fallbackIfBlank(generate(handle.sentence(), input.optionC(), index), input.optionC());
        String optionD = fallbackIfBlank(generate(handle.sentence(), input.optionD(), index), input.optionD());
        results.add(new ParaphrasedMcq(stem, optionA, optionB, optionC, optionD, rawMcq(...)));
    }
    return results;
}
```

### Chi phí thực tế:
- `requestedCount=3` (mặc định): **3 variant × 5 fields = 15 lần encode+beamDecode**
- Mỗi lần beam decode: `beamWidth × maxTokens × O(sequence_length)` forward pass qua decoder
- Với `numBeams=4, maxTokens=96`: ~384 decoder forward pass **cho mỗi field**
- **Tổng: 15 × 384 = 5,760 decoder forward pass cho 1 request paraphrase**

---

## 2.2 Giải pháp: Single-pass full MCQ generation

### Ý tưởng
Thay vì generate từng field riêng lẻ, generate **toàn bộ MCQ trong 1 lần**:

```
INPUT:
  paraphrase mcq:
  Câu hỏi: Khi xác định người bệnh trước khi tiêm thuốc, điều dưỡng cần làm gì?
  A. Đối chiếu ít nhất hai thông tin nhận diện.
  B. Chỉ hỏi số phòng của người bệnh.
  C. Chỉ dựa vào vị trí giường hiện tại.
  D. Bỏ qua nếu người bệnh tỉnh táo.
  Đáp án đúng: A
  Yêu cầu: diễn đạt lại toàn bộ câu hỏi và các phương án...

OUTPUT (1 lần generate):
  Câu hỏi: Trước khi thực hiện tiêm thuốc, điều dưỡng viên cần phải làm gì để xác định đúng người bệnh?
  A. Kiểm tra và đối chiếu ít nhất hai thông tin nhận dạng của người bệnh.
  B. Chỉ cần hỏi số phòng mà người bệnh đang nằm.
  C. Xác định người bệnh dựa trên vị trí giường bệnh hiện tại.
  D. Có thể bỏ qua bước xác định nếu người bệnh đang tỉnh táo hoàn toàn.
```

Parser (`VietQuillMcqParser`) extract stem + options từ output.

### Chi phí mới:
- `requestedCount=3`: **3 variant × 1 lần = 3 lần encode+beamDecode**
- **Giảm từ 5,760 → 1,152 decoder forward pass (nhanh hơn ~5x)**

---

## 2.3 Implementation

### 2.3.1 Cập nhật `VietQuillPromptBuilder`

**File: `VietQuillPromptBuilder.java`**

```java
@Component
public class VietQuillPromptBuilder {

    /**
     * Build prompt cho single-pass full MCQ paraphrase.
     * Model được yêu cầu output toàn bộ MCQ (Câu hỏi + A/B/C/D) trong 1 lần.
     */
    public String buildFullMcq(ParaphraseModelInput input) {
        return """
                paraphrase mcq:
                Câu hỏi: %s
                A. %s
                B. %s
                C. %s
                D. %s
                Đáp án đúng: %s
                Yêu cầu: diễn đạt lại toàn bộ câu hỏi và 4 phương án A/B/C/D, giữ nguyên nghĩa, \
                giữ nguyên số liệu/thuật ngữ y khoa và giữ nguyên đáp án đúng. \
                Trả lại đúng format:
                Câu hỏi: <stem mới>
                A. <option A mới>
                B. <option B mới>
                C. <option C mới>
                D. <option D mới>
                """.formatted(
                safe(input.stem()),
                safe(input.optionA()),
                safe(input.optionB()),
                safe(input.optionC()),
                safe(input.optionD()),
                safe(input.correctAnswer())
        ).trim();
    }

    /**
     * Build prompt cho single field (giữ lại cho fallback hoặc sentence model).
     */
    public String buildSingleField(String text) {
        return "paraphrase: " + safe(text);
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }
}
```

### 2.3.2 Cập nhật `VietQuillMcqParser`

**File: `VietQuillMcqParser.java`**

Parser hiện tại đã hỗ trợ parse full MCQ output. Cần verify regex hoạt động với output Tiếng Việt:

```java
// Regex hiện tại (đã OK):
private static final Pattern STEM = Pattern.compile(
    "(?is)(?:Câu hỏi|Question)\\s*[:：]\\s*(.*?)(?=\\n\\s*(?:A|B)\\s*[\\).:：])"
);
private static final Pattern OPTION = Pattern.compile(
    "(?ims)^\\s*%s\\s*[\\).:：]\\s*(.*?)(?=^\\s*[ABCD]\\s*[\\).:：]|\\z)"
);
```

**Cần thêm**: Fallback parsing nếu model output không theo format chuẩn (dùng newline-based heuristic).

```java
/**
 * Attempt to parse model output as full MCQ.
 * Falls back to line-by-line heuristic if regex fails.
 */
public ParaphrasedMcq parseFullMcq(String rawOutput) {
    try {
        return parse(rawOutput);  // Dùng parser hiện tại trước
    } catch (ParaphraseModelException ex) {
        return parseHeuristic(rawOutput);  // Fallback heuristic
    }
}

private ParaphrasedMcq parseHeuristic(String rawOutput) {
    String[] lines = rawOutput.split("\n");
    // Tìm dòng bắt đầu bằng "Câu hỏi:" hoặc dòng đầu tiên không rỗng làm stem
    // Tìm các dòng A./A)/A: làm options
    // ...
}
```

### 2.3.3 Cập nhật `VietQuillParaphraseModelService.paraphrase()`

```java
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

    if (properties.isSinglePassEnabled()) {  // ← Feature flag mới
        return paraphraseSinglePass(handle, input, count);
    }
    return paraphrasePerField(handle, input, count);  // ← Logic cũ giữ lại làm fallback
}

/**
 * Single-pass: 1 lần encode+decode cho toàn bộ MCQ.
 */
private List<ParaphrasedMcq> paraphraseSinglePass(RuntimeHandle handle, ParaphraseModelInput input, int count) {
    String prompt = promptBuilder.buildFullMcq(input);
    List<ParaphrasedMcq> results = new ArrayList<>();

    for (int index = 0; index < count; index++) {
        String rawOutput = generate(handle.question(), prompt, index);
        if (rawOutput.isBlank()) {
            // Fallback: generate từng field nếu single-pass fail
            rawOutput = generatePerFieldAndCombine(handle, input, index);
        }
        ParaphrasedMcq mcq = mcqParser.parseFullMcq(rawOutput);
        results.add(new ParaphrasedMcq(
            fallbackIfBlank(mcq.stem(), input.stem()),
            fallbackIfBlank(mcq.optionA(), input.optionA()),
            fallbackIfBlank(mcq.optionB(), input.optionB()),
            fallbackIfBlank(mcq.optionC(), input.optionC()),
            fallbackIfBlank(mcq.optionD(), input.optionD()),
            rawMcq(mcq.stem(), mcq.optionA(), mcq.optionB(), mcq.optionC(), mcq.optionD())
        ));
    }
    return results;
}
```

### 2.3.4 Feature flag trong config

**File: `AiParaphraseProperties.java`**
```java
private boolean singlePassEnabled = true;  // Bật single-pass mặc định
```

**File: `application.yaml`**
```yaml
ai:
  paraphrase:
    single-pass-enabled: ${VIETQUILL_SINGLE_PASS:true}
```

---

## 2.4 Kế hoạch triển khai

### Bước 1: Verify parser hoạt động
- Viết unit test cho `VietQuillMcqParser` với output mẫu từ model
- Đảm bảo parse được các format output khác nhau

### Bước 2: Cập nhật PromptBuilder
- Thêm method `buildFullMcq()` với format yêu cầu rõ ràng
- Test thủ công với model để đảm bảo model tuân theo format

### Bước 3: Triển khai single-pass trong Service
- Thêm `singlePassEnabled` flag
- Implement `paraphraseSinglePass()`
- Giữ logic cũ làm fallback

### Bước 4: Test & tune
- So sánh chất lượng output giữa single-pass và per-field
- Điều chỉnh prompt nếu model output không ổn định
- Đo latency improvement

---

## 2.5 Files cần sửa

| File | Thay đổi |
|---|---|
| `AiParaphraseProperties.java` | Thêm `singlePassEnabled` |
| `VietQuillPromptBuilder.java` | Thêm `buildFullMcq()`, giữ `buildSingleField()` |
| `VietQuillMcqParser.java` | Thêm `parseFullMcq()` + heuristic fallback |
| `VietQuillParaphraseModelService.java` | Thêm `paraphraseSinglePass()`, feature flag routing |
| `application.yaml` | Thêm config `single-pass-enabled` |

---

## 2.6 Kỳ vọng kết quả

| Metric | Trước (per-field) | Sau (single-pass) |
|---|---|---|
| Số lần encode+decode cho 3 variants | 15 | 3 |
| Số decoder forward pass | ~5,760 | ~1,152 |
| Latency (ước tính) | 8-15s | 2-4s |
| Chất lượng output | Tốt (từng field riêng) | Tốt (cả câu nhất quán hơn) |

---

## 2.7 Risk assessment

- **Model không tuân theo format**: Cần fallback parser + test kỹ prompt engineering
- **Single-pass output dài hơn** → Có thể cần tăng `maxOutputLength` cho single-pass
- **Chất lượng paraphrase có thể khác**: Cần A/B test so sánh. Model có thể paraphrase tốt hơn khi thấy toàn bộ context của MCQ thay vì từng field riêng lẻ
- **Nếu single-pass thất bại**: Fallback về per-field logic cũ → không mất chức năng
