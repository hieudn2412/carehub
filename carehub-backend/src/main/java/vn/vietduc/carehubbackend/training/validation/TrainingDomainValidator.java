package vn.vietduc.carehubbackend.training.validation;

import org.springframework.stereotype.Component;
import vn.vietduc.carehubbackend.exception.BadRequestException;
import vn.vietduc.carehubbackend.training.dto.request.RequirementFormRequest;
import vn.vietduc.carehubbackend.training.dto.request.TrainingRecordFormRequest;

import java.math.BigDecimal;
import java.util.Set;

@Component
public class TrainingDomainValidator {
    private static final BigDecimal MIN_DIRECT_RECORD_HOURS = BigDecimal.valueOf(0.5);
    private static final BigDecimal MAX_DIRECT_RECORD_HOURS = BigDecimal.valueOf(24);
    private static final Set<String> ALLOWED_MIME_TYPES = Set.of(
            "image/jpeg",
            "image/png",
            "application/pdf"
    );
    private static final long MAX_EVIDENCE_BYTES = 5 * 1024 * 1024;

    public void validateRecordForm(TrainingRecordFormRequest request, boolean legacyImport) {
        if (request.endDate() != null && request.endDate().isBefore(request.startDate())) {
            throw new BadRequestException("End date must be greater than or equal to start date");
        }
        if ((request.endDate() == null || request.endDate().isEqual(request.startDate()))
                && request.startTime() != null
                && request.endTime() != null
                && request.endTime().isBefore(request.startTime())) {
            throw new BadRequestException("End time must be greater than or equal to start time");
        }
        if (!legacyImport && request.declaredHours() != null) {
            if (request.declaredHours().compareTo(MIN_DIRECT_RECORD_HOURS) < 0) {
                throw new BadRequestException("Declared hours must be at least 0.5 for manual records");
            }
            if (request.declaredHours().compareTo(MAX_DIRECT_RECORD_HOURS) > 0) {
                throw new BadRequestException("Declared hours must not exceed 24 for manual records");
            }
        }
    }

    public void validateRequirementForm(RequirementFormRequest request) {
        if (request.effectiveTo() != null && request.effectiveTo().isBefore(request.effectiveFrom())) {
            throw new BadRequestException("Requirement effective_to must be greater than or equal to effective_from");
        }
    }

    public void validateEvidenceMetadata(String mimeType, long fileSizeBytes) {
        if (fileSizeBytes <= 0 || fileSizeBytes > MAX_EVIDENCE_BYTES) {
            throw new BadRequestException("Evidence file size must be greater than 0 and not exceed 5 MB");
        }
        if (!ALLOWED_MIME_TYPES.contains(mimeType)) {
            throw new BadRequestException("Evidence file type must be JPG, PNG, or PDF");
        }
    }
}
