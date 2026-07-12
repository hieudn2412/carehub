package vn.vietduc.carehubbackend.training.mapper;

import org.springframework.stereotype.Component;
import vn.vietduc.carehubbackend.training.dto.response.EmployeeComplianceSummaryResponse;
import vn.vietduc.carehubbackend.training.dto.response.PersonalTrainingStatusResponse;
import vn.vietduc.carehubbackend.user.entity.Department;
import vn.vietduc.carehubbackend.user.entity.Position;
import vn.vietduc.carehubbackend.user.entity.User;

@Component
public class TrainingComplianceMapper {
    public EmployeeComplianceSummaryResponse toEmployeeSummary(PersonalTrainingStatusResponse status, User employee) {
        Department department = employee.getDepartment();
        Position position = employee.getPosition();
        return new EmployeeComplianceSummaryResponse(
                employee.getId(),
                employee.getEmployeeCode(),
                employee.getName(),
                department == null ? null : department.getId(),
                department == null ? null : department.getName(),
                position == null ? null : position.getId(),
                position == null ? null : position.getName(),
                status.status(),
                status.requiredHours(),
                status.submittedHours(),
                status.remainingHours()
        );
    }
}
