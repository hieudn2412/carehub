package vn.vietduc.carehubbackend.form.assignment.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.Lock;
import jakarta.persistence.LockModeType;
import org.springframework.data.repository.query.Param;
import vn.vietduc.carehubbackend.form.assignment.entity.FormAssignmentItem;
import vn.vietduc.carehubbackend.form.assignment.entity.FormAssignmentStatus;

import java.time.Instant;
import java.util.Optional;

public interface FormAssignmentItemRepository extends JpaRepository<FormAssignmentItem, Long> {
    @EntityGraph(attributePaths = {"assignment", "assignment.manager", "form", "formVersion"})
    @Query("select i from FormAssignmentItem i where i.id = :id")
    Optional<FormAssignmentItem> findDetailById(@Param("id") Long id);

    @EntityGraph(attributePaths = {"assignment", "form", "formVersion"})
    @Query("""
            select i from FormAssignmentItem i
            where i.assignment.manager.id = :managerId
              and i.status = :active
              and i.assignment.status = :active
              and (i.assignment.effectiveFrom is null or i.assignment.effectiveFrom <= :now)
              and (i.assignment.effectiveTo is null or i.assignment.effectiveTo >= :now)
            """)
    Page<FormAssignmentItem> findActiveForManager(
            @Param("managerId") Long managerId,
            @Param("active") FormAssignmentStatus active,
            @Param("now") Instant now,
            Pageable pageable
    );

    @EntityGraph(attributePaths = {"assignment", "assignment.manager", "form", "formVersion"})
    @Query("""
            select i from FormAssignmentItem i
            where i.id = :id
              and i.assignment.manager.id = :managerId
              and i.status = :active
              and i.assignment.status = :active
              and (i.assignment.effectiveFrom is null or i.assignment.effectiveFrom <= :now)
              and (i.assignment.effectiveTo is null or i.assignment.effectiveTo >= :now)
            """)
    Optional<FormAssignmentItem> findActiveOwnedItem(
            @Param("id") Long id,
            @Param("managerId") Long managerId,
            @Param("active") FormAssignmentStatus active,
            @Param("now") Instant now
    );

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @EntityGraph(attributePaths = {"assignment", "assignment.manager", "form", "formVersion"})
    @Query("""
            select i from FormAssignmentItem i
            where i.id = :id
              and i.assignment.manager.id = :managerId
              and i.status = :active
              and i.assignment.status = :active
              and (i.assignment.effectiveFrom is null or i.assignment.effectiveFrom <= :now)
              and (i.assignment.effectiveTo is null or i.assignment.effectiveTo >= :now)
            """)
    Optional<FormAssignmentItem> findActiveOwnedItemForUpdate(
            @Param("id") Long id,
            @Param("managerId") Long managerId,
            @Param("active") FormAssignmentStatus active,
            @Param("now") Instant now
    );

    @Query("""
            select (count(i) > 0) from FormAssignmentItem i
            where i.assignment.manager.id = :managerId
              and i.formVersion.id = :versionId
              and i.status = :active
              and i.assignment.status = :active
              and (i.assignment.effectiveTo is null or i.assignment.effectiveTo >= :fromTime)
            """)
    boolean existsOpenEndedOverlappingActiveAssignment(
            @Param("managerId") Long managerId,
            @Param("versionId") Long versionId,
            @Param("active") FormAssignmentStatus active,
            @Param("fromTime") Instant fromTime
    );

    @Query("""
            select (count(i) > 0) from FormAssignmentItem i
            where i.assignment.manager.id = :managerId
              and i.formVersion.id = :versionId
              and i.status = :active
              and i.assignment.status = :active
              and (i.assignment.effectiveTo is null or i.assignment.effectiveTo >= :fromTime)
              and (i.assignment.effectiveFrom is null or i.assignment.effectiveFrom <= :toTime)
            """)
    boolean existsBoundedOverlappingActiveAssignment(
            @Param("managerId") Long managerId,
            @Param("versionId") Long versionId,
            @Param("active") FormAssignmentStatus active,
            @Param("fromTime") Instant fromTime,
            @Param("toTime") Instant toTime
    );
}
