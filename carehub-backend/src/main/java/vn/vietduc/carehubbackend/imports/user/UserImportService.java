package vn.vietduc.carehubbackend.imports.user;

import org.springframework.web.multipart.MultipartFile;

public interface UserImportService {
    public void importExcel(MultipartFile file) throws Exception;
}
