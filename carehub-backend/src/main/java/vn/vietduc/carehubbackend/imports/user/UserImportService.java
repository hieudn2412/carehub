package vn.vietduc.carehubbackend.imports.user;

import org.springframework.web.multipart.MultipartFile;

public interface UserImportService {
    public ImportResult importExcel(MultipartFile file) throws Exception;
}
