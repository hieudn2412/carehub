package vn.vietduc.carehubbackend.questiongeneration.dto.response;

public record AiModelRuntimeStatusResponse(
        ModelStatus generation,
        ModelStatus embedding,
        ModelStatus paraphrase
) {
    public record ModelStatus(
            String provider,
            String model,
            String modelPath,
            boolean preload,
            boolean filesPresent,
            String statusText
    ) {
    }
}
