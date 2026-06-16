package vn.vietduc.carehubbackend.training.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vn.vietduc.carehubbackend.training.entity.ProfessionalField;

import java.util.Optional;
import java.util.List;

public interface ProfessionalFieldRepository extends JpaRepository<ProfessionalField, Long> {
    Optional<ProfessionalField> findByCode(String code);

    List<ProfessionalField> findByActiveTrueOrderByNameAsc();
}
