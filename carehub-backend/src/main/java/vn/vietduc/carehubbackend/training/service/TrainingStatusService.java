package vn.vietduc.carehubbackend.training.service;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import vn.vietduc.carehubbackend.training.dto.request.EmployeeTrainingStatusSearchRequest;
import vn.vietduc.carehubbackend.training.dto.response.EmployeeTrainingRecordLedgerResponse;
import vn.vietduc.carehubbackend.training.dto.response.EmployeeTrainingStatusSummaryResponse;
import vn.vietduc.carehubbackend.training.dto.response.PersonalTrainingStatusResponse;
import vn.vietduc.carehubbackend.training.enums.TrainingRecordStatus;

import java.time.LocalDate;

public interface TrainingStatusService {
    PersonalTrainingStatusResponse getMyStatus(Long professionalFieldId, LocalDate asOf);

    PersonalTrainingStatusResponse getEmployeeStatus(Long employeeId, Long professionalFieldId, LocalDate asOf);

    Page<EmployeeTrainingStatusSummaryResponse> getEmployeeStatuses(
            EmployeeTrainingStatusSearchRequest request,
            Pageable pageable
    );

    Page<EmployeeTrainingRecordLedgerResponse> getEmployeeRecords(
            Long employeeId,
            Long professionalFieldId,
            LocalDate asOf,
            TrainingRecordStatus workflowStatus,
            Pageable pageable
    );
}
