package vn.vietduc.carehubbackend.imports.user.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import vn.vietduc.carehubbackend.imports.user.entity.ImportLog;

public interface ImportLogRepository extends JpaRepository<ImportLog, Long> {
    @Query("select log from ImportLog log where carehub_search_text(log.sourceFile) like concat('%', carehub_search_text(:sourceFile), '%')")
    Page<ImportLog> findBySourceFileContainingIgnoreCase(String sourceFile, Pageable pageable);

    Page<ImportLog> findByStatus(String status, Pageable pageable);

    @Query("select log from ImportLog log where log.status = :status and carehub_search_text(log.sourceFile) like concat('%', carehub_search_text(:sourceFile), '%')")
    Page<ImportLog> findBySourceFileContainingIgnoreCaseAndStatus(String sourceFile, String status, Pageable pageable);
}
