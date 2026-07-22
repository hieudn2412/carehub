package vn.vietduc.carehubbackend.training.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import software.amazon.awssdk.services.s3.presigner.model.PresignedGetObjectRequest;
import vn.vietduc.carehubbackend.config.R2Properties;
import vn.vietduc.carehubbackend.training.service.impl.R2EvidenceStorageService;

import java.net.URI;
import java.time.Duration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class R2EvidenceStorageServiceTest {
    private S3Client s3Client;
    private S3Presigner presigner;
    private R2EvidenceStorageService service;

    @BeforeEach
    void setUp() {
        s3Client = mock(S3Client.class);
        presigner = mock(S3Presigner.class);
        service = new R2EvidenceStorageService(
                s3Client,
                presigner,
                new R2Properties("https://account.r2.cloudflarestorage.com", "access", "secret", "evidence")
        );
    }

    @Test
    void storesObjectUnderTrainingRecordPrefix() {
        byte[] content = {1, 2, 3};
        EvidenceStorageService.StoredEvidenceObject stored = service.store(
                new EvidenceStorageService.EvidenceObjectRequest(
                        42L,
                        "certificate.jpg",
                        "image/jpeg",
                        content.length,
                        "stored-sha"
                ),
                content
        );

        ArgumentCaptor<PutObjectRequest> request = ArgumentCaptor.forClass(PutObjectRequest.class);
        verify(s3Client).putObject(request.capture(), any(RequestBody.class));
        assertEquals("evidence", request.getValue().bucket());
        assertTrue(request.getValue().key().matches("training-records/42/evidences/[0-9a-f-]+\\.jpg"));
        assertEquals("image/jpeg", request.getValue().contentType());
        assertEquals("stored-sha", request.getValue().metadata().get("sha256"));
        assertEquals(request.getValue().key(), stored.objectKey());
    }

    @Test
    void createsFiveMinutePresignedDownloadUrl() throws Exception {
        PresignedGetObjectRequest presigned = mock(PresignedGetObjectRequest.class);
        when(presigned.url()).thenReturn(URI.create("https://download.example/certificate").toURL());
        when(presigner.presignGetObject(any(GetObjectPresignRequest.class))).thenReturn(presigned);

        String url = service.createDownloadUrl("key.jpg", "certificate.jpg", Duration.ofMinutes(5));

        ArgumentCaptor<GetObjectPresignRequest> request = ArgumentCaptor.forClass(GetObjectPresignRequest.class);
        verify(presigner).presignGetObject(request.capture());
        assertEquals(Duration.ofMinutes(5), request.getValue().signatureDuration());
        assertEquals("key.jpg", request.getValue().getObjectRequest().key());
        assertEquals(
                "attachment; filename=\"certificate.jpg\"",
                request.getValue().getObjectRequest().responseContentDisposition()
        );
        assertEquals("https://download.example/certificate", url);
    }

    @Test
    void createsInlinePresignedPreviewUrl() throws Exception {
        PresignedGetObjectRequest presigned = mock(PresignedGetObjectRequest.class);
        when(presigned.url()).thenReturn(URI.create("https://preview.example/certificate").toURL());
        when(presigner.presignGetObject(any(GetObjectPresignRequest.class))).thenReturn(presigned);

        String url = service.createPreviewUrl("key.jpg", "certificate.jpg", Duration.ofMinutes(5));

        ArgumentCaptor<GetObjectPresignRequest> request = ArgumentCaptor.forClass(GetObjectPresignRequest.class);
        verify(presigner).presignGetObject(request.capture());
        assertEquals(Duration.ofMinutes(5), request.getValue().signatureDuration());
        assertEquals("key.jpg", request.getValue().getObjectRequest().key());
        assertEquals(
                "inline; filename=\"certificate.jpg\"",
                request.getValue().getObjectRequest().responseContentDisposition()
        );
        assertEquals("https://preview.example/certificate", url);
    }

    @Test
    void deletesObjectIdempotently() {
        service.delete("key.jpg");

        ArgumentCaptor<DeleteObjectRequest> request = ArgumentCaptor.forClass(DeleteObjectRequest.class);
        verify(s3Client).deleteObject(request.capture());
        assertEquals("evidence", request.getValue().bucket());
        assertEquals("key.jpg", request.getValue().key());
    }
}
