package vn.vietduc.carehubbackend.imports.user.service;

import org.springframework.web.multipart.MultipartFile;
import vn.vietduc.carehubbackend.imports.user.dto.ImportResult;

public interface UserImportService {
    public ImportResult importExcel(MultipartFile file) throws Exception;
}
