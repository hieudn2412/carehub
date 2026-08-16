package vn.vietduc.carehubbackend.questiongeneration.dto.response;

public record ExamAssignmentTargetCandidateResponse(
        Long userId,
        String employeeCode,
        String fullName,
        String position,
        String department
) {
}
