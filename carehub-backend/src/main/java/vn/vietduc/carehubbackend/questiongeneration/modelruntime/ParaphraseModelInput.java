package vn.vietduc.carehubbackend.questiongeneration.modelruntime;

public record ParaphraseModelInput(
        String stem,
        String optionA,
        String optionB,
        String optionC,
        String optionD,
        String correctAnswer,
        String changeStrength,
        int requestedCount
) {
}
