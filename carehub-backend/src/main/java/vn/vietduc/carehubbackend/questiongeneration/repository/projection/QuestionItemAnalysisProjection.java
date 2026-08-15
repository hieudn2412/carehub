package vn.vietduc.carehubbackend.questiongeneration.repository.projection;

public interface QuestionItemAnalysisProjection {
    Long getQuestionId();
    String getStem();
    String getTopic();
    vn.vietduc.carehubbackend.questiongeneration.entity.enums.CognitiveLevel getCognitiveLevel();
    Long getAttemptCount();
    Long getCorrectCount();
}
