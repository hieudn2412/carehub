package vn.vietduc.carehubbackend.training.service;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.web.multipart.MultipartFile;
import vn.vietduc.carehubbackend.training.dto.request.TrainingImportApplyRequest;
import vn.vietduc.carehubbackend.training.dto.response.TrainingDurationParseResponse;
import vn.vietduc.carehubbackend.training.dto.response.TrainingImportBatchResponse;

import java.io.IOException;

public interface TrainingLegacyImportService {
    TrainingImportBatchResponse createPreview(
            MultipartFile file,
            Long activityTypeId,
            Long professionalFieldId
    ) throws IOException;

    TrainingImportBatchResponse apply(Long batchId, TrainingImportApplyRequest request);

    TrainingImportBatchResponse get(Long batchId);

    Page<TrainingImportBatchResponse> list(Pageable pageable);

    TrainingDurationParseResponse parseDuration(String rawText);
}
