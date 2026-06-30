package vn.vietduc.carehubbackend.questiongeneration.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import vn.vietduc.carehubbackend.common.response.ApiResponse;
import vn.vietduc.carehubbackend.common.response.PageResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.DocumentResponse;
import vn.vietduc.carehubbackend.questiongeneration.service.QuestionDocumentService;

@RestController
@RequestMapping("${app.api-prefix}/documents")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class QuestionDocumentController {
    private final QuestionDocumentService documentService;

    @GetMapping
    public ResponseEntity<ApiResponse<PageResponse<DocumentResponse>>> list(
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Lấy danh sách tài liệu thành công",
                PageResponse.from(documentService.list(pageable))
        ));
    }

    @GetMapping("/{documentId}")
    public ResponseEntity<ApiResponse<DocumentResponse>> get(@PathVariable Long documentId) {
        return ResponseEntity.ok(ApiResponse.success(
                "Lấy chi tiết tài liệu thành công",
                documentService.get(documentId)
        ));
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<DocumentResponse>> upload(
            @RequestPart("file") MultipartFile file,
            Authentication authentication
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Tải tài liệu và tạo chunk thành công",
                documentService.upload(file, actor(authentication))
        ));
    }

    private String actor(Authentication authentication) {
        return authentication == null ? "system" : authentication.getName();
    }
}
