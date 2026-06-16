package vn.vietduc.carehubbackend.training.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vn.vietduc.carehubbackend.training.service.impl.LocalEvidenceStorageService;

@RestController
@RequestMapping("${app.api-prefix}/training/evidence-download")
@RequiredArgsConstructor
public class TrainingEvidenceDownloadController {
    private final LocalEvidenceStorageService storageService;

    @GetMapping("/{token}")
    public ResponseEntity<Resource> download(@PathVariable String token) {
        LocalEvidenceStorageService.LocalEvidenceDownload download = storageService.loadByDownloadToken(token);
        return ResponseEntity.ok()
                .contentType(download.mediaType())
                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(download.objectKey()).build().toString()
                )
                .body(new FileSystemResource(download.path()));
    }
}
