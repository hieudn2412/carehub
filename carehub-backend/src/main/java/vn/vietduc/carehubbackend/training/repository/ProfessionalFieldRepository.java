package vn.vietduc.carehubbackend.training.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import vn.vietduc.carehubbackend.training.entity.ProfessionalField;

import java.util.Optional;
import java.util.List;

public interface ProfessionalFieldRepository extends JpaRepository<ProfessionalField, Long> {
    Optional<ProfessionalField> findByCode(String code);

    boolean existsByCodeAndIdNot(String code, Long id);

    List<ProfessionalField> findByActiveTrueOrderByNameAsc();

    @Query("""
            SELECT field
            FROM ProfessionalField field
            WHERE (:keyword IS NULL
                   OR carehub_search_text(field.code) LIKE carehub_search_text(:keyword)
                   OR carehub_search_text(field.name) LIKE carehub_search_text(:keyword))
              AND (:active IS NULL OR field.active = :active)
            """)
    Page<ProfessionalField> search(
            @Param("keyword") String keyword,
            @Param("active") Boolean active,
            Pageable pageable
    );
}
