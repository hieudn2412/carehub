package vn.vietduc.carehubbackend.questiongeneration.security;

import java.util.Set;

public final class EvaluationPermissions {
    public static final String QUESTION_AUTHOR = "QUESTION_AUTHOR";
    public static final String QUESTION_REVIEWER = "QUESTION_REVIEWER";
    public static final String QUESTION_SET_MANAGER = "QUESTION_SET_MANAGER";
    public static final String EXAM_CONFIG_MANAGER = "EXAM_CONFIG_MANAGER";
    public static final String EXAM_PUBLISHER = "EXAM_PUBLISHER";
    public static final String ASSIGNMENT_MANAGER = "ASSIGNMENT_MANAGER";
    public static final String RESULT_VIEWER = "RESULT_VIEWER";
    public static final String AUDIT_VIEWER = "AUDIT_VIEWER";

    public static final Set<String> ALL = Set.of(
            QUESTION_AUTHOR,
            QUESTION_REVIEWER,
            QUESTION_SET_MANAGER,
            EXAM_CONFIG_MANAGER,
            EXAM_PUBLISHER,
            ASSIGNMENT_MANAGER,
            RESULT_VIEWER,
            AUDIT_VIEWER
    );

    private EvaluationPermissions() {
    }
}
