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
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;

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

    @EntityGraph(attributePaths = {"form", "publishedBy"})
    @Query("""
            select v from FormVersion v
            where (:keyword = ''
                   or lower(v.form.code) like lower(concat('%', :keyword, '%'))
                   or lower(v.form.title) like lower(concat('%', :keyword, '%'))
                   or lower(v.title) like lower(concat('%', :keyword, '%')))
              and (:status is null or v.status = :status)
            """)
    Page<FormVersion> searchScoringConfigurations(@Param("keyword") String keyword,
                                                   @Param("status") FormVersionStatus status,
                                                   Pageable pageable);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select v from FormVersion v where v.id = :versionId and v.form.id = :formId")
    Optional<FormVersion> findByIdAndFormIdForUpdate(@Param("formId") Long formId,
                                                     @Param("versionId") Long versionId);

    @Lock(LockModeType.PESSIMISTIC_READ)
    @Query("select v from FormVersion v where v.id = :versionId")
    Optional<FormVersion> findByIdForScoring(@Param("versionId") Long versionId);
}
