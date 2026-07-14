package vn.vietduc.carehubbackend.questiongeneration.dto.response;

public record DiscriminationIndexResponse(
        Long questionId,
        String stem,
        String topic,
        String difficulty,
        Double discriminationIndex,
        String interpretation,
        Long highGroupCorrect,
        Long lowGroupCorrect,
        Long highGroupTotal,
        Long lowGroupTotal
) {
}
