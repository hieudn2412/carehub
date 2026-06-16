package vn.vietduc.carehubbackend.training.dto.response;

import java.util.List;

public record TrainingRecordOptionsResponse(
        List<TrainingActivityTypeOptionResponse> activityTypes,
        List<TrainingProfessionalFieldOptionResponse> professionalFields
) {
}
