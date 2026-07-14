package vn.vietduc.carehubbackend.questiongeneration.entity.enums;

public enum QuestionSelectionStrategy {
    /**
     * All questions are randomly selected from the question set (default).
     */
    RANDOM,

    /**
     * Mix of mandatory (fixed) questions + random fill to reach totalQuestions.
     * Mandatory questions are set via ExamConfigDistribution with required=true.
     */
    MIXED
}
