package vn.vietduc.carehubbackend.training.service;

import org.springframework.web.multipart.MultipartFile;
import vn.vietduc.carehubbackend.training.dto.response.EvidenceDownloadUrlResponse;
import vn.vietduc.carehubbackend.training.dto.response.EvidenceMetadataResponse;

import java.util.List;

public interface TrainingEvidenceService {
    List<EvidenceMetadataResponse> list(Long recordId);

    EvidenceMetadataResponse upload(Long recordId, MultipartFile file);

    void delete(Long recordId, Long evidenceId);

    EvidenceDownloadUrlResponse createDownloadUrl(Long recordId, Long evidenceId);

    EvidenceDownloadUrlResponse createPreviewUrl(Long recordId, Long evidenceId);
}
