package vn.vietduc.carehubbackend.form.repository;

import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import vn.vietduc.carehubbackend.form.entity.Form;
import vn.vietduc.carehubbackend.form.entity.enums.FormStatus;
import vn.vietduc.carehubbackend.form.entity.enums.FormSubjectType;

import java.util.Optional;

public interface FormRepository extends JpaRepository<Form, Long> {
    boolean existsByCodeIgnoreCase(String code);

    Optional<Form> findByCodeIgnoreCaseAndDeletedFalse(String code);

    boolean existsByCodeIgnoreCaseAndIdNot(String code, Long id);

    @EntityGraph(attributePaths = {"ownerDepartment", "currentPublishedVersion"})
    @Query("""
            select f from Form f
            where f.deleted = false
              and (lower(f.code) like lower(concat('%', :keyword, '%'))
                   or lower(f.title) like lower(concat('%', :keyword, '%')))
              and (:status is null or f.status = :status)
              and (:subjectType is null or f.subjectType = :subjectType)
              and (:ownerDepartmentId is null or f.ownerDepartment.id = :ownerDepartmentId)
            """)
    Page<Form> search(
            @Param("keyword") String keyword,
            @Param("status") FormStatus status,
            @Param("subjectType") FormSubjectType subjectType,
            @Param("ownerDepartmentId") Long ownerDepartmentId,
            Pageable pageable
    );

    @EntityGraph(attributePaths = {"ownerDepartment", "currentPublishedVersion"})
    Optional<Form> findByIdAndDeletedFalse(Long id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select f from Form f where f.id = :id and f.deleted = false")
    Optional<Form> findActiveByIdForUpdate(@Param("id") Long id);
}
