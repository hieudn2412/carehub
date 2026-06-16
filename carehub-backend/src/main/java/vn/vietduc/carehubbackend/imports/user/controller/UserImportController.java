package vn.vietduc.carehubbackend.imports.user.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import vn.vietduc.carehubbackend.common.response.ApiResponse;
import vn.vietduc.carehubbackend.imports.user.dto.ImportResult;
import vn.vietduc.carehubbackend.imports.user.service.UserImportServiceImpl;

import java.io.IOException;

@RestController
@RequestMapping("${app.api-prefix}")
public class UserImportController {
    private final UserImportServiceImpl userImportServiceImpl;

    public UserImportController(UserImportServiceImpl userImportServiceImpl) {
        this.userImportServiceImpl = userImportServiceImpl;
    }

    @PostMapping("/users/import")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<ImportResult>> importUsers(@RequestParam MultipartFile file) throws IOException {
        ImportResult result = userImportServiceImpl.importExcel(file);
        return ResponseEntity.ok(
                ApiResponse.success("Import users success", result)
        );
    }


}
