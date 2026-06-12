package vn.vietduc.carehubbackend.imports.user;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

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
    public void importUsers(@RequestParam MultipartFile file) throws IOException {
        userImportServiceImpl.importExcel(file);
    }
}
