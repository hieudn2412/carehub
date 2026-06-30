package vn.vietduc.carehubbackend.questiongeneration.modelruntime;

public record ParaphrasedMcq(
        String stem,
        String optionA,
        String optionB,
        String optionC,
        String optionD,
        String rawOutput
) {
}
