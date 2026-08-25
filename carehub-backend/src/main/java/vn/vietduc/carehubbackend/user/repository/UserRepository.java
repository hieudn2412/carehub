package vn.vietduc.carehubbackend.user.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vn.vietduc.carehubbackend.user.entity.User;
import vn.vietduc.carehubbackend.user.entity.UserStatus;
import vn.vietduc.carehubbackend.user.repository.custom.UserRepositoryCustom;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long>, UserRepositoryCustom {
    interface DepartmentEmployeeCount {
        Long getDepartmentId();
        long getEmployeeCount();
    }

    Optional<User> findByEmailAndIsDeletedFalse(String email);
    Optional<User> findByEmployeeCodeAndIsDeletedFalse(String employeeCode);

    @EntityGraph(attributePaths = {"department"})
    Optional<User> findByIdAndIsDeletedFalse(Long id);

    @EntityGraph(attributePaths = {"department", "position", "educationLevel"})
    Optional<User> findByEmployeeCodeIgnoreCaseAndIsDeletedFalse(String employeeCode);

    @EntityGraph(attributePaths = {"department", "position", "educationLevel"})
    Optional<User> findByEmployeeCodeIgnoreCaseAndIsDeletedFalseAndStatus(String employeeCode, vn.vietduc.carehubbackend.user.entity.UserStatus status);
    boolean existsByEmail(String email);
    boolean existsByEmployeeCodeAndIsDeletedFalse(String employeeCode);
    boolean existsByEmailAndIsDeletedFalse(String email);
    boolean existsByEmployeeCodeAndIsDeletedFalseAndIdNot(String employeeCode, Long id);
    boolean existsByEmailAndIsDeletedFalseAndIdNot(String email, Long id);
    boolean existsByDepartment_IdAndIsDeletedFalse(Long departmentId);
    long countByDepartment_IdAndIsDeletedFalseAndStatus(Long departmentId, UserStatus status);
    boolean existsByPosition_IdAndIsDeletedFalse(Long positionId);
    boolean existsByEducationLevel_IdAndIsDeletedFalse(Long educationLevelId);
    List<User> findByEmployeeCodeIn(Collection<String> employeeCodes);

    @EntityGraph(attributePaths = {"department", "position"})
    List<User> findByDepartment_IdInAndIsDeletedFalse(Collection<Long> departmentIds);

    @EntityGraph(attributePaths = {"department", "position"})
    List<User> findByIsDeletedFalseAndStatus(UserStatus status);

    @EntityGraph(attributePaths = {"department", "position"})
    @Query(value = """
            SELECT u
            FROM User u
            WHERE u.isDeleted = false
              AND u.status = vn.vietduc.carehubbackend.user.entity.UserStatus.ACTIVE
              AND (:departmentId IS NULL OR u.department.id = :departmentId)
              AND (:keyword IS NULL
                   OR LOWER(u.name) LIKE :keyword
                   OR LOWER(u.employeeCode) LIKE :keyword)
              AND EXISTS (
                  SELECT ur.id
                  FROM UserRole ur
                  WHERE ur.user = u
                    AND (
                        UPPER(ur.role.code) = 'STAFF'
                        OR UPPER(ur.role.code) = 'USER'
                        OR UPPER(ur.role.code) = 'MANAGER'
                        OR UPPER(ur.role.code) = 'ROLE_STAFF'
                        OR UPPER(ur.role.code) = 'ROLE_USER'
                        OR UPPER(ur.role.code) = 'ROLE_MANAGER'
                    )
                    AND (
                        :roleCode IS NULL
                        OR UPPER(ur.role.code) = :roleCode
                        OR UPPER(ur.role.code) = CONCAT('ROLE_', :roleCode)
                        OR (:roleCode = 'USER' AND UPPER(ur.role.code) IN ('STAFF', 'ROLE_STAFF'))
                        OR (:roleCode = 'STAFF' AND UPPER(ur.role.code) IN ('USER', 'ROLE_USER'))
                    )
              )
              AND NOT EXISTS (
                  SELECT adminRole.id
                  FROM UserRole adminRole
                  WHERE adminRole.user = u
                    AND (UPPER(adminRole.role.code) = 'ADMIN' OR UPPER(adminRole.role.code) = 'ROLE_ADMIN')
              )
            ORDER BY u.name ASC, u.employeeCode ASC
            """,
            countQuery = """
            SELECT COUNT(u)
            FROM User u
            WHERE u.isDeleted = false
              AND u.status = vn.vietduc.carehubbackend.user.entity.UserStatus.ACTIVE
              AND (:departmentId IS NULL OR u.department.id = :departmentId)
              AND (:keyword IS NULL
                   OR LOWER(u.name) LIKE :keyword
                   OR LOWER(u.employeeCode) LIKE :keyword)
              AND EXISTS (
                  SELECT ur.id
                  FROM UserRole ur
                  WHERE ur.user = u
                    AND (
                        UPPER(ur.role.code) = 'STAFF'
                        OR UPPER(ur.role.code) = 'USER'
                        OR UPPER(ur.role.code) = 'MANAGER'
                        OR UPPER(ur.role.code) = 'ROLE_STAFF'
                        OR UPPER(ur.role.code) = 'ROLE_USER'
                        OR UPPER(ur.role.code) = 'ROLE_MANAGER'
                    )
                    AND (
                        :roleCode IS NULL
                        OR UPPER(ur.role.code) = :roleCode
                        OR UPPER(ur.role.code) = CONCAT('ROLE_', :roleCode)
                        OR (:roleCode = 'USER' AND UPPER(ur.role.code) IN ('STAFF', 'ROLE_STAFF'))
                        OR (:roleCode = 'STAFF' AND UPPER(ur.role.code) IN ('USER', 'ROLE_USER'))
                    )
              )
              AND NOT EXISTS (
                  SELECT adminRole.id
                  FROM UserRole adminRole
                  WHERE adminRole.user = u
                    AND (UPPER(adminRole.role.code) = 'ADMIN' OR UPPER(adminRole.role.code) = 'ROLE_ADMIN')
              )
            """)
    Page<User> searchFormAssignmentAssigneeCandidates(
            @Param("keyword") String keyword,
            @Param("departmentId") Long departmentId,
            @Param("roleCode") String roleCode,
            Pageable pageable);

    @EntityGraph(attributePaths = {"department", "position"})
    @Query("""
            SELECT DISTINCT u
            FROM UserRole ur
            JOIN ur.user u
            WHERE u.isDeleted = false
              AND u.status = vn.vietduc.carehubbackend.user.entity.UserStatus.ACTIVE
              AND (UPPER(ur.role.code) = 'MANAGER' OR UPPER(ur.role.code) = 'ROLE_MANAGER')
              AND NOT EXISTS (
                  SELECT adminRole.id
                  FROM UserRole adminRole
                  WHERE adminRole.user = u
                    AND (UPPER(adminRole.role.code) = 'ADMIN' OR UPPER(adminRole.role.code) = 'ROLE_ADMIN')
              )
            ORDER BY u.name ASC, u.employeeCode ASC
            """)
    List<User> findActiveManagerFormAssignmentCandidates();

    @EntityGraph(attributePaths = {"department", "position"})
    @Query(value = """
            SELECT u
            FROM User u
            WHERE u.isDeleted = false
              AND u.status = vn.vietduc.carehubbackend.user.entity.UserStatus.ACTIVE
              AND u.id <> :excludedUserId
              AND (:departmentId IS NULL OR u.department.id = :departmentId)
              AND (:keyword IS NULL
                   OR LOWER(u.name) LIKE :keyword
                   OR LOWER(u.employeeCode) LIKE :keyword)
            ORDER BY u.name ASC, u.employeeCode ASC
            """,
            countQuery = """
            SELECT COUNT(u)
            FROM User u
            WHERE u.isDeleted = false
              AND u.status = vn.vietduc.carehubbackend.user.entity.UserStatus.ACTIVE
              AND u.id <> :excludedUserId
              AND (:departmentId IS NULL OR u.department.id = :departmentId)
              AND (:keyword IS NULL
                   OR LOWER(u.name) LIKE :keyword
                   OR LOWER(u.employeeCode) LIKE :keyword)
            """)
    Page<User> searchActiveFormSubjects(
            @Param("keyword") String keyword,
            @Param("excludedUserId") Long excludedUserId,
            @Param("departmentId") Long departmentId,
            Pageable pageable);

    @EntityGraph(attributePaths = {"department", "position"})
    @Query(value = """
            SELECT u
            FROM User u
            WHERE u.isDeleted = false
              AND u.status = vn.vietduc.carehubbackend.user.entity.UserStatus.ACTIVE
              AND u.id <> :excludedUserId
              AND (:departmentIds IS NULL OR u.department.id IN :departmentIds)
              AND (:keyword IS NULL
                   OR LOWER(u.name) LIKE :keyword
                   OR LOWER(u.employeeCode) LIKE :keyword)
            ORDER BY u.name ASC, u.id ASC
            """,
            countQuery = """
            SELECT COUNT(u)
            FROM User u
            WHERE u.isDeleted = false
              AND u.status = vn.vietduc.carehubbackend.user.entity.UserStatus.ACTIVE
              AND u.id <> :excludedUserId
              AND (:departmentIds IS NULL OR u.department.id IN :departmentIds)
              AND (:keyword IS NULL
                   OR LOWER(u.name) LIKE :keyword
                   OR LOWER(u.employeeCode) LIKE :keyword)
            """)
    Page<User> searchActiveFormSubjectsInDepartments(
            @Param("keyword") String keyword,
            @Param("excludedUserId") Long excludedUserId,
            @Param("departmentIds") Collection<Long> departmentIds,
            Pageable pageable);

    @Query("""
            SELECT u.department.id AS departmentId, COUNT(u.id) AS employeeCount
            FROM User u
            WHERE u.isDeleted = false
              AND u.status = vn.vietduc.carehubbackend.user.entity.UserStatus.ACTIVE
              AND u.department IS NOT NULL
            GROUP BY u.department.id
            """)
    List<DepartmentEmployeeCount> countActiveEmployeesByDepartment();

    @EntityGraph(attributePaths = {"department", "position"})
    @Query(value = """
            SELECT u
            FROM User u
            WHERE u.isDeleted = false
              AND u.status = vn.vietduc.carehubbackend.user.entity.UserStatus.ACTIVE
              AND (:departmentId IS NULL OR u.department.id = :departmentId)
              AND (:keyword IS NULL
                   OR LOWER(u.name) LIKE :keyword
                   OR LOWER(u.employeeCode) LIKE :keyword)
            ORDER BY u.name ASC, u.id ASC
            """,
            countQuery = """
            SELECT COUNT(u)
            FROM User u
            WHERE u.isDeleted = false
              AND u.status = vn.vietduc.carehubbackend.user.entity.UserStatus.ACTIVE
              AND (:departmentId IS NULL OR u.department.id = :departmentId)
              AND (:keyword IS NULL
                   OR LOWER(u.name) LIKE :keyword
                   OR LOWER(u.employeeCode) LIKE :keyword)
            """)
    Page<User> findCompetencySummaryCandidates(
            @Param("departmentId") Long departmentId,
            @Param("keyword") String keyword,
            Pageable pageable
    );

    @EntityGraph(attributePaths = {"department", "position"})
    @Query("""
            SELECT u
            FROM User u
            WHERE u.isDeleted = false
              AND UPPER(u.employeeCode) IN :employeeCodes
            """)
    List<User> findActiveByNormalizedEmployeeCodes(@Param("employeeCodes") Collection<String> employeeCodes);

    @EntityGraph(attributePaths = {"department", "position"})
    @Query("""
            SELECT u
            FROM User u
            WHERE u.isDeleted = false
              AND u.status = vn.vietduc.carehubbackend.user.entity.UserStatus.ACTIVE
              AND (:scopeDepartmentId IS NULL OR u.department.id = :scopeDepartmentId)
              AND (:keyword IS NULL
                   OR LOWER(u.employeeCode) LIKE :keyword
                   OR LOWER(u.name) LIKE :keyword)
              AND (:departmentId IS NULL OR u.department.id = :departmentId)
              AND (:positionId IS NULL OR u.position.id = :positionId)
              AND NOT EXISTS (
                  SELECT adminRole.id
                  FROM UserRole adminRole
                  WHERE adminRole.user = u
                    AND (UPPER(adminRole.role.code) = 'ADMIN' OR UPPER(adminRole.role.code) = 'ROLE_ADMIN')
              )
            ORDER BY u.employeeCode ASC, u.id ASC
            """)
    List<User> searchTrainingEmployeeCandidates(
            @Param("scopeDepartmentId") Long scopeDepartmentId,
            @Param("keyword") String keyword,
            @Param("departmentId") Long departmentId,
            @Param("positionId") Long positionId
    );

    @Query("""
            SELECT ur.user
            FROM UserRole ur
            WHERE ur.user.isDeleted = false
              AND ur.user.department.id = :departmentId
              AND ur.role.code = 'MANAGER'
            """)
    List<User> findManagersByDepartmentId(@Param("departmentId") Long departmentId);

}
