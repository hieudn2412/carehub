package vn.vietduc.carehubbackend.questiongeneration.dto.request;

/** A regrade is explicit because it rewrites result aggregates used for remediation audiences. */
public record RegradeExamAttemptRequest(String policy, String reason) { }
