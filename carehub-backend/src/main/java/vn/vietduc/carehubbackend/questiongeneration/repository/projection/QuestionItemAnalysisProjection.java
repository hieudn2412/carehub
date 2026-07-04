package vn.vietduc.carehubbackend.questiongeneration.repository.projection;

public interface QuestionItemAnalysisProjection {
    Long getQuestionId();
    String getStem();
    String getTopic();
    String getDifficulty();
    Long getAttemptCount();
    Long getCorrectCount();
}
