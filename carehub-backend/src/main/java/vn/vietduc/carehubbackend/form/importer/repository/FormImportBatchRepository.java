package vn.vietduc.carehubbackend.form.importer.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import vn.vietduc.carehubbackend.form.importer.entity.FormImportBatch;

import java.util.Optional;

public interface FormImportBatchRepository extends JpaRepository<FormImportBatch, Long> {
    @EntityGraph(attributePaths = {"importedByUser", "rows", "rows.form", "rows.formVersion"})
    Optional<FormImportBatch> findDetailedById(Long id);

    @EntityGraph(attributePaths = {"importedByUser"})
    Page<FormImportBatch> findAllByOrderByCreatedAtDesc(Pageable pageable);
}

