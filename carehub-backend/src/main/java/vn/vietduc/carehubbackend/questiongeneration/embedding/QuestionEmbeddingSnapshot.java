package vn.vietduc.carehubbackend.questiongeneration.embedding;

public record QuestionEmbeddingSnapshot(
        Long questionId,
        String stem,
        double[] vector
) {
}
