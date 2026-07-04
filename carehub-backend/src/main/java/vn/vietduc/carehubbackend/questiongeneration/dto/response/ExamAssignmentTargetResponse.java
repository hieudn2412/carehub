package vn.vietduc.carehubbackend.questiongeneration.dto.response;

public record ExamAssignmentTargetResponse(
        Long userId,
        String employeeCode,
        String name,
        String departmentName
) {
}
