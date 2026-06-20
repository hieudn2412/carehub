package vn.vietduc.carehubbackend.training.service;

import vn.vietduc.carehubbackend.training.dto.response.PersonalTrainingStatusResponse;

import java.time.LocalDate;

public interface TrainingStatusService {
    PersonalTrainingStatusResponse getMyStatus(Long professionalFieldId, LocalDate asOf);

    PersonalTrainingStatusResponse getEmployeeStatus(Long employeeId, Long professionalFieldId, LocalDate asOf);
}
