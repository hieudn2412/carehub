package vn.vietduc.carehubbackend.imports.user.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import vn.vietduc.carehubbackend.imports.user.entity.ImportLog;

public interface ImportLogRepository extends JpaRepository<ImportLog, Long> {
    Page<ImportLog> findBySourceFileContainingIgnoreCase(String sourceFile, Pageable pageable);

    Page<ImportLog> findByStatus(String status, Pageable pageable);

    Page<ImportLog> findBySourceFileContainingIgnoreCaseAndStatus(String sourceFile, String status, Pageable pageable);
}
