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
import vn.vietduc.carehubbackend.form.entity.enums.FormStatus;
import vn.vietduc.carehubbackend.form.entity.enums.FormVersionStatus;
import vn.vietduc.carehubbackend.user.entity.Department;

import java.time.Instant;
import java.util.Optional;
import java.util.List;

public interface FormAssignmentItemRepository extends JpaRepository<FormAssignmentItem, Long> {
    interface FormAssignmentOverviewProjection {
        long getAssignedFormCount();
        long getRecipientCount();
        long getActivePairCount();
        long getExpiringSoonCount();
    }

    interface FormAssignmentFormRowProjection {
        Long getFormId();
        String getFormCode();
        String getFormTitle();
        Long getFormVersionId();
        Integer getVersionNumber();
        Long getOwnerDepartmentId();
        String getOwnerDepartmentName();
        long getRecipientCount();
        Instant getNearestExpiry();
    }

    interface FormAssignmentAssigneeRowProjection {
        Long getAssigneeId();
        String getEmployeeCode();
        String getFullName();
        Long getDepartmentId();
        String getDepartmentName();
        long getFormCount();
        Instant getNearestExpiry();
    }

    @Query("""
            select (count(i) > 0) from FormAssignmentItem i
            where i.assignment.manager.id = :managerId
              and i.form.id = :formId
            """)
    boolean existsEverAssignedToManager(@Param("managerId") Long managerId,
                                         @Param("formId") Long formId);

    @Query("""
            select distinct d.id from FormAssignmentItem i
            join i.allowedDepartments d
            where i.assignment.manager.id = :assigneeId
              and i.form.id = :formId
              and i.status = :active
              and i.assignment.status = :active
              and i.assignment.manager.isDeleted = false
              and i.assignment.manager.status = vn.vietduc.carehubbackend.user.entity.UserStatus.ACTIVE
              and i.form.deleted = false
              and i.form.status = :publishedForm
              and i.form.currentPublishedVersion is not null
              and i.form.currentPublishedVersion.status = :publishedVersion
              and (i.assignment.effectiveFrom is null or i.assignment.effectiveFrom <= :now)
              and (i.assignment.effectiveTo is null or i.assignment.effectiveTo >= :now)
            """)
    List<Long> findActiveAllowedDepartmentIds(
            @Param("assigneeId") Long assigneeId,
            @Param("formId") Long formId,
            @Param("active") FormAssignmentStatus active,
            @Param("publishedForm") FormStatus publishedForm,
            @Param("publishedVersion") FormVersionStatus publishedVersion,
            @Param("now") Instant now);

    @Query("""
            select distinct d from FormAssignmentItem i
            join i.allowedDepartments d
            where i.assignment.manager.id = :assigneeId
              and i.form.id = :formId
              and i.status = :active
              and i.assignment.status = :active
              and i.assignment.manager.isDeleted = false
              and i.assignment.manager.status = vn.vietduc.carehubbackend.user.entity.UserStatus.ACTIVE
              and i.form.deleted = false
              and i.form.status = :publishedForm
              and i.form.currentPublishedVersion is not null
              and i.form.currentPublishedVersion.status = :publishedVersion
              and (i.assignment.effectiveFrom is null or i.assignment.effectiveFrom <= :now)
              and (i.assignment.effectiveTo is null or i.assignment.effectiveTo >= :now)
            order by d.name asc
            """)
    List<Department> findActiveAllowedDepartments(
            @Param("assigneeId") Long assigneeId,
            @Param("formId") Long formId,
            @Param("active") FormAssignmentStatus active,
            @Param("publishedForm") FormStatus publishedForm,
            @Param("publishedVersion") FormVersionStatus publishedVersion,
            @Param("now") Instant now);

    @Query("""
            select (count(i) > 0) from FormAssignmentItem i
            where i.assignment.manager.id = :assigneeId and i.formVersion.id = :versionId
              and i.status = :active and i.assignment.status = :active
              and (i.assignment.effectiveFrom is null or i.assignment.effectiveFrom <= :now)
              and (i.assignment.effectiveTo is null or i.assignment.effectiveTo >= :now)
            """)
    boolean existsActiveForAssigneeAndVersion(@Param("assigneeId") Long assigneeId,
                                               @Param("versionId") Long versionId,
                                               @Param("active") FormAssignmentStatus active,
                                               @Param("now") Instant now);
    List<FormAssignmentItem> findAllByFormVersion_IdAndStatus(Long versionId, FormAssignmentStatus status);
    @EntityGraph(attributePaths = {"assignment", "assignment.manager", "form", "formVersion", "allowedDepartments"})
    Optional<FormAssignmentItem> findFirstByAssignment_Manager_IdAndFormVersion_IdAndStatusOrderByIdDesc(
            Long assigneeId, Long formVersionId, FormAssignmentStatus status);

    @EntityGraph(attributePaths = {"assignment", "assignment.manager", "form", "formVersion", "allowedDepartments"})
    Optional<FormAssignmentItem> findFirstByAssignment_Manager_IdAndForm_IdOrderByIdDesc(
            Long assigneeId, Long formId);

    long countByAssignment_Id(Long assignmentId);

    @EntityGraph(attributePaths = {"assignment", "assignment.manager", "form", "form.currentPublishedVersion", "formVersion", "allowedDepartments"})
    @Query("""
            select i from FormAssignmentItem i
            where i.assignment.manager.id = :assigneeId
              and i.form.id in :formIds
            order by i.id desc
            """)
    List<FormAssignmentItem> findHistoryByAssigneeAndForms(
            @Param("assigneeId") Long assigneeId,
            @Param("formIds") List<Long> formIds);

    @EntityGraph(attributePaths = {
            "assignment", "assignment.manager", "assignment.manager.department",
            "assignment.assignedBy", "form", "form.ownerDepartment", "form.currentPublishedVersion", "formVersion",
            "allowedDepartments"
    })
    List<FormAssignmentItem> findByIdIn(List<Long> ids);

    @Query("""
            select
              count(distinct i.form.id) as assignedFormCount,
              count(distinct i.assignment.manager.id) as recipientCount,
              count(i.id) as activePairCount,
              coalesce(sum(case when i.assignment.effectiveTo is not null
                 and i.assignment.effectiveTo >= :now
                 and i.assignment.effectiveTo <= :expiryDeadline then 1 else 0 end), 0) as expiringSoonCount
            from FormAssignmentItem i
            where i.status = :active
              and i.assignment.status = :active
              and i.assignment.manager.isDeleted = false
              and i.assignment.manager.status = vn.vietduc.carehubbackend.user.entity.UserStatus.ACTIVE
              and i.form.deleted = false
              and i.form.status = :publishedForm
              and i.form.currentPublishedVersion is not null
              and i.form.currentPublishedVersion.status = :publishedVersion
              and (i.assignment.effectiveFrom is null or i.assignment.effectiveFrom <= :now)
              and (i.assignment.effectiveTo is null or i.assignment.effectiveTo >= :now)
            """)
    FormAssignmentOverviewProjection overview(
            @Param("active") FormAssignmentStatus active,
            @Param("publishedForm") FormStatus publishedForm,
            @Param("publishedVersion") FormVersionStatus publishedVersion,
            @Param("now") Instant now,
            @Param("expiryDeadline") Instant expiryDeadline);

    @Query(value = """
            select i.form.id as formId,
                   i.form.code as formCode,
                   i.form.title as formTitle,
                   currentVersion.id as formVersionId,
                   currentVersion.versionNumber as versionNumber,
                   ownerDepartment.id as ownerDepartmentId,
                   ownerDepartment.name as ownerDepartmentName,
                   count(distinct i.assignment.manager.id) as recipientCount,
                   min(i.assignment.effectiveTo) as nearestExpiry
            from FormAssignmentItem i
            left join i.form.ownerDepartment ownerDepartment
            left join i.form.currentPublishedVersion currentVersion
            where i.status = :active
              and i.assignment.status = :active
              and i.assignment.manager.isDeleted = false
              and i.assignment.manager.status = vn.vietduc.carehubbackend.user.entity.UserStatus.ACTIVE
              and i.form.deleted = false
              and i.form.status = :publishedForm
              and i.form.currentPublishedVersion is not null
              and i.form.currentPublishedVersion.status = :publishedVersion
              and (i.assignment.effectiveFrom is null or i.assignment.effectiveFrom <= :now)
              and (i.assignment.effectiveTo is null or i.assignment.effectiveTo >= :now)
              and (:keyword is null
                   or lower(i.form.code) like :keyword
                   or lower(i.form.title) like :keyword)
              and (:ownerDepartmentId is null or ownerDepartment.id = :ownerDepartmentId)
              and (:expiringSoon = false or (i.assignment.effectiveTo is not null
                   and i.assignment.effectiveTo >= :now
                   and i.assignment.effectiveTo <= :expiryDeadline))
            group by i.form.id, i.form.code, i.form.title,
                     currentVersion.id, currentVersion.versionNumber,
                     ownerDepartment.id, ownerDepartment.name
            order by count(distinct i.assignment.manager.id) desc, i.form.title asc
            """,
            countQuery = """
            select count(distinct i.form.id)
            from FormAssignmentItem i
            left join i.form.ownerDepartment ownerDepartment
            where i.status = :active
              and i.assignment.status = :active
              and i.assignment.manager.isDeleted = false
              and i.assignment.manager.status = vn.vietduc.carehubbackend.user.entity.UserStatus.ACTIVE
              and i.form.deleted = false
              and i.form.status = :publishedForm
              and i.form.currentPublishedVersion is not null
              and i.form.currentPublishedVersion.status = :publishedVersion
              and (i.assignment.effectiveFrom is null or i.assignment.effectiveFrom <= :now)
              and (i.assignment.effectiveTo is null or i.assignment.effectiveTo >= :now)
              and (:keyword is null
                   or lower(i.form.code) like :keyword
                   or lower(i.form.title) like :keyword)
              and (:ownerDepartmentId is null or ownerDepartment.id = :ownerDepartmentId)
              and (:expiringSoon = false or (i.assignment.effectiveTo is not null
                   and i.assignment.effectiveTo >= :now
                   and i.assignment.effectiveTo <= :expiryDeadline))
            """)
    Page<FormAssignmentFormRowProjection> searchAssignedForms(
            @Param("keyword") String keyword,
            @Param("ownerDepartmentId") Long ownerDepartmentId,
            @Param("expiringSoon") boolean expiringSoon,
            @Param("active") FormAssignmentStatus active,
            @Param("publishedForm") FormStatus publishedForm,
            @Param("publishedVersion") FormVersionStatus publishedVersion,
            @Param("now") Instant now,
            @Param("expiryDeadline") Instant expiryDeadline,
            Pageable pageable);

    @Query(value = """
            select i.assignment.manager.id as assigneeId,
                   i.assignment.manager.employeeCode as employeeCode,
                   i.assignment.manager.name as fullName,
                   department.id as departmentId,
                   department.name as departmentName,
                   count(distinct i.form.id) as formCount,
                   min(i.assignment.effectiveTo) as nearestExpiry
            from FormAssignmentItem i
            left join i.assignment.manager.department department
            where i.status = :active
              and i.assignment.status = :active
              and i.assignment.manager.isDeleted = false
              and i.assignment.manager.status = vn.vietduc.carehubbackend.user.entity.UserStatus.ACTIVE
              and i.form.deleted = false
              and i.form.status = :publishedForm
              and i.form.currentPublishedVersion is not null
              and i.form.currentPublishedVersion.status = :publishedVersion
              and (i.assignment.effectiveFrom is null or i.assignment.effectiveFrom <= :now)
              and (i.assignment.effectiveTo is null or i.assignment.effectiveTo >= :now)
              and (:keyword is null
                   or lower(i.assignment.manager.employeeCode) like :keyword
                   or lower(i.assignment.manager.name) like :keyword)
              and (:departmentId is null or department.id = :departmentId)
              and exists (
                    select ur.id from UserRole ur
                    where ur.user = i.assignment.manager
                      and (
                          upper(ur.role.code) = 'STAFF'
                          or upper(ur.role.code) = 'USER'
                          or upper(ur.role.code) = 'MANAGER'
                          or upper(ur.role.code) = 'ROLE_STAFF'
                          or upper(ur.role.code) = 'ROLE_USER'
                          or upper(ur.role.code) = 'ROLE_MANAGER'
                      )
                      and (
                          :roleCode is null
                          or upper(ur.role.code) = :roleCode
                          or upper(ur.role.code) = concat('ROLE_', :roleCode)
                          or (:roleCode = 'USER' and upper(ur.role.code) in ('STAFF', 'ROLE_STAFF'))
                          or (:roleCode = 'STAFF' and upper(ur.role.code) in ('USER', 'ROLE_USER'))
                      )
              )
              and not exists (
                    select adminRole.id from UserRole adminRole
                    where adminRole.user = i.assignment.manager
                      and (upper(adminRole.role.code) = 'ADMIN' or upper(adminRole.role.code) = 'ROLE_ADMIN')
              )
              and (:expiringSoon = false or (i.assignment.effectiveTo is not null
                   and i.assignment.effectiveTo >= :now
                   and i.assignment.effectiveTo <= :expiryDeadline))
            group by i.assignment.manager.id, i.assignment.manager.employeeCode,
                     i.assignment.manager.name, department.id, department.name
            order by count(distinct i.form.id) desc, i.assignment.manager.name asc
            """,
            countQuery = """
            select count(distinct i.assignment.manager.id)
            from FormAssignmentItem i
            left join i.assignment.manager.department department
            where i.status = :active
              and i.assignment.status = :active
              and i.assignment.manager.isDeleted = false
              and i.assignment.manager.status = vn.vietduc.carehubbackend.user.entity.UserStatus.ACTIVE
              and i.form.deleted = false
              and i.form.status = :publishedForm
              and i.form.currentPublishedVersion is not null
              and i.form.currentPublishedVersion.status = :publishedVersion
              and (i.assignment.effectiveFrom is null or i.assignment.effectiveFrom <= :now)
              and (i.assignment.effectiveTo is null or i.assignment.effectiveTo >= :now)
              and (:keyword is null
                   or lower(i.assignment.manager.employeeCode) like :keyword
                   or lower(i.assignment.manager.name) like :keyword)
              and (:departmentId is null or department.id = :departmentId)
              and exists (
                    select ur.id from UserRole ur
                    where ur.user = i.assignment.manager
                      and (
                          upper(ur.role.code) = 'STAFF'
                          or upper(ur.role.code) = 'USER'
                          or upper(ur.role.code) = 'MANAGER'
                          or upper(ur.role.code) = 'ROLE_STAFF'
                          or upper(ur.role.code) = 'ROLE_USER'
                          or upper(ur.role.code) = 'ROLE_MANAGER'
                      )
                      and (
                          :roleCode is null
                          or upper(ur.role.code) = :roleCode
                          or upper(ur.role.code) = concat('ROLE_', :roleCode)
                          or (:roleCode = 'USER' and upper(ur.role.code) in ('STAFF', 'ROLE_STAFF'))
                          or (:roleCode = 'STAFF' and upper(ur.role.code) in ('USER', 'ROLE_USER'))
                      )
              )
              and not exists (
                    select adminRole.id from UserRole adminRole
                    where adminRole.user = i.assignment.manager
                      and (upper(adminRole.role.code) = 'ADMIN' or upper(adminRole.role.code) = 'ROLE_ADMIN')
              )
              and (:expiringSoon = false or (i.assignment.effectiveTo is not null
                   and i.assignment.effectiveTo >= :now
                   and i.assignment.effectiveTo <= :expiryDeadline))
            """)
    Page<FormAssignmentAssigneeRowProjection> searchAssignedAssignees(
            @Param("keyword") String keyword,
            @Param("departmentId") Long departmentId,
            @Param("roleCode") String roleCode,
            @Param("expiringSoon") boolean expiringSoon,
            @Param("active") FormAssignmentStatus active,
            @Param("publishedForm") FormStatus publishedForm,
            @Param("publishedVersion") FormVersionStatus publishedVersion,
            @Param("now") Instant now,
            @Param("expiryDeadline") Instant expiryDeadline,
            Pageable pageable);

    @EntityGraph(attributePaths = {
            "assignment", "assignment.manager", "assignment.manager.department",
            "assignment.assignedBy", "form", "form.ownerDepartment", "form.currentPublishedVersion", "formVersion"
    })
    @Query("""
            select i from FormAssignmentItem i
            where i.status = :active
              and i.assignment.status = :active
              and i.assignment.manager.isDeleted = false
              and i.assignment.manager.status = vn.vietduc.carehubbackend.user.entity.UserStatus.ACTIVE
              and i.form.deleted = false
              and i.form.status = :publishedForm
              and i.form.currentPublishedVersion is not null
              and i.form.currentPublishedVersion.status = :publishedVersion
              and (i.assignment.effectiveFrom is null or i.assignment.effectiveFrom <= :now)
              and (i.assignment.effectiveTo is null or i.assignment.effectiveTo >= :now)
              and (:formId is null or i.form.id = :formId)
              and (:assigneeId is null or i.assignment.manager.id = :assigneeId)
            order by i.assignment.effectiveTo asc nulls last, i.id desc
            """)
    Page<FormAssignmentItem> searchActiveItems(
            @Param("formId") Long formId,
            @Param("assigneeId") Long assigneeId,
            @Param("active") FormAssignmentStatus active,
            @Param("publishedForm") FormStatus publishedForm,
            @Param("publishedVersion") FormVersionStatus publishedVersion,
            @Param("now") Instant now,
            Pageable pageable);

    @Query("""
            select d from FormAssignmentItem i
            join i.allowedDepartments d
            where i.id = :itemId
            order by d.name asc
            """)
    List<Department> findAllowedDepartmentsByItemId(@Param("itemId") Long itemId);

    @Query("""
            select i.id, count(d.id)
            from FormAssignmentItem i
            left join i.allowedDepartments d
            where i.id in :itemIds
            group by i.id
            """)
    List<Object[]> countAllowedDepartmentsGroupedByItemIds(@Param("itemIds") List<Long> itemIds);
    @EntityGraph(attributePaths = {"assignment", "assignment.manager", "assignment.manager.department", "form", "formVersion", "allowedDepartments"})
    @Query("select i from FormAssignmentItem i where i.id = :id")
    Optional<FormAssignmentItem> findDetailById(@Param("id") Long id);

    @EntityGraph(attributePaths = {"assignment", "assignment.manager", "assignment.assignedBy", "form", "formVersion", "allowedDepartments"})
    @Query("""
            select i from FormAssignmentItem i
            where i.form.id = :formId
              and (:status is null or i.status = :status)
            order by i.assignment.assignedAt desc, i.id desc
            """)
    Page<FormAssignmentItem> findByFormId(
            @Param("formId") Long formId,
            @Param("status") FormAssignmentStatus status,
            Pageable pageable
    );

    @EntityGraph(attributePaths = {"assignment", "assignment.manager", "assignment.manager.department", "form", "formVersion", "allowedDepartments"})
    @Query("""
            select i from FormAssignmentItem i
            where i.assignment.manager.id = :managerId
              and i.status = :active
              and i.assignment.status = :active
              and i.form.deleted = false
              and i.form.status = :publishedForm
              and i.form.currentPublishedVersion is not null
              and i.form.currentPublishedVersion.status = :publishedVersion
              and (i.assignment.effectiveFrom is null or i.assignment.effectiveFrom <= :now)
              and (i.assignment.effectiveTo is null or i.assignment.effectiveTo >= :now)
            """)
    Page<FormAssignmentItem> findActiveForManager(
            @Param("managerId") Long managerId,
            @Param("active") FormAssignmentStatus active,
            @Param("publishedForm") FormStatus publishedForm,
            @Param("publishedVersion") FormVersionStatus publishedVersion,
            @Param("now") Instant now,
            Pageable pageable
    );

    @EntityGraph(attributePaths = {"assignment", "assignment.manager", "assignment.manager.department", "form", "formVersion", "allowedDepartments"})
    @Query("""
            select i from FormAssignmentItem i
            where i.id = :id
              and i.assignment.manager.id = :managerId
              and i.status = :active
              and i.assignment.status = :active
              and i.form.deleted = false
              and i.form.status = :publishedForm
              and i.form.currentPublishedVersion is not null
              and i.form.currentPublishedVersion.status = :publishedVersion
              and (i.assignment.effectiveFrom is null or i.assignment.effectiveFrom <= :now)
              and (i.assignment.effectiveTo is null or i.assignment.effectiveTo >= :now)
            """)
    Optional<FormAssignmentItem> findActiveOwnedItem(
            @Param("id") Long id,
            @Param("managerId") Long managerId,
            @Param("active") FormAssignmentStatus active,
            @Param("publishedForm") FormStatus publishedForm,
            @Param("publishedVersion") FormVersionStatus publishedVersion,
            @Param("now") Instant now
    );

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @EntityGraph(attributePaths = {"assignment", "assignment.manager", "form", "formVersion", "allowedDepartments"})
    @Query("""
            select i from FormAssignmentItem i
            where i.id = :id
              and i.assignment.manager.id = :managerId
              and i.status = :active
              and i.assignment.status = :active
              and i.form.deleted = false
              and i.form.status = :publishedForm
              and i.form.currentPublishedVersion is not null
              and i.form.currentPublishedVersion.status = :publishedVersion
              and (i.assignment.effectiveFrom is null or i.assignment.effectiveFrom <= :now)
              and (i.assignment.effectiveTo is null or i.assignment.effectiveTo >= :now)
            """)
    Optional<FormAssignmentItem> findActiveOwnedItemForUpdate(
            @Param("id") Long id,
            @Param("managerId") Long managerId,
            @Param("active") FormAssignmentStatus active,
            @Param("publishedForm") FormStatus publishedForm,
            @Param("publishedVersion") FormVersionStatus publishedVersion,
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
