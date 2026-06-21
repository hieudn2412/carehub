package vn.vietduc.carehubbackend.form.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import vn.vietduc.carehubbackend.form.entity.FormVersion;
import vn.vietduc.carehubbackend.form.entity.enums.FormVersionStatus;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface FormVersionRepository extends JpaRepository<FormVersion, Long> {
    boolean existsByForm_IdAndStatus(Long formId, FormVersionStatus status);

    @Query("select coalesce(max(v.versionNumber), 0) from FormVersion v where v.form.id = :formId")
    int findMaxVersionNumber(@Param("formId") Long formId);

    @EntityGraph(attributePaths = {"publishedBy"})
    Page<FormVersion> findByForm_IdAndStatus(
            Long formId,
            FormVersionStatus status,
            Pageable pageable
    );

    @EntityGraph(attributePaths = {"publishedBy"})
    Page<FormVersion> findByForm_Id(Long formId, Pageable pageable);

    @EntityGraph(attributePaths = {"form", "publishedBy"})
    Optional<FormVersion> findByIdAndForm_Id(Long id, Long formId);

    Optional<FormVersion> findFirstByForm_IdAndStatusOrderByVersionNumberDesc(
            Long formId,
            FormVersionStatus status
    );

    Optional<FormVersion> findFirstByForm_IdOrderByVersionNumberDesc(Long formId);

    List<FormVersion> findByForm_IdIn(Collection<Long> formIds);
}
