package vn.vietduc.carehubbackend.form.importer.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vn.vietduc.carehubbackend.form.importer.entity.FormImportRow;

public interface FormImportRowRepository extends JpaRepository<FormImportRow, Long> {
}

