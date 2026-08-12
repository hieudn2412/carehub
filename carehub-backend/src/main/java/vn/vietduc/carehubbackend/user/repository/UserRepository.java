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
    @Query(value = """
            SELECT u
            FROM User u
            WHERE u.isDeleted = false
              AND (:departmentId IS NULL OR u.department.id = :departmentId)
              AND (:keyword IS NULL
                   OR LOWER(u.name) LIKE :keyword
                   OR LOWER(u.employeeCode) LIKE :keyword)
              AND EXISTS (
                  SELECT a.id
                  FROM ExamAttempt a
                  WHERE a.user = u
                    AND a.status IN ('SUBMITTED', 'GRADED')
                    AND a.score IS NOT NULL
                    AND a.submittedAt >= :fromDate
                    AND a.submittedAt <= :toDate
                    AND (:category IS NULL
                         OR a.examPaper.examConfig.questionSet.category = :category)
              )
            ORDER BY u.name ASC, u.id ASC
            """,
            countQuery = """
            SELECT COUNT(u)
            FROM User u
            WHERE u.isDeleted = false
              AND (:departmentId IS NULL OR u.department.id = :departmentId)
              AND (:keyword IS NULL
                   OR LOWER(u.name) LIKE :keyword
                   OR LOWER(u.employeeCode) LIKE :keyword)
              AND EXISTS (
                  SELECT a.id
                  FROM ExamAttempt a
                  WHERE a.user = u
                    AND a.status IN ('SUBMITTED', 'GRADED')
                    AND a.score IS NOT NULL
                    AND a.submittedAt >= :fromDate
                    AND a.submittedAt <= :toDate
                    AND (:category IS NULL
                         OR a.examPaper.examConfig.questionSet.category = :category)
              )
            """)
    Page<User> findCompetencyFieldCandidates(
            @Param("departmentId") Long departmentId,
            @Param("keyword") String keyword,
            @Param("category") String category,
            @Param("fromDate") java.time.LocalDateTime fromDate,
            @Param("toDate") java.time.LocalDateTime toDate,
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

    @Query("""
            SELECT COUNT(u)
            FROM User u
            WHERE u.isDeleted = false
              AND (:departmentId IS NULL OR u.department.id = :departmentId)
              AND (:positionId IS NULL OR u.position.id = :positionId)
            """)
    long countActiveTrainingRequirementCandidates(
            @Param("departmentId") Long departmentId,
            @Param("positionId") Long positionId
    );

    @Query("""
            SELECT COUNT(u)
            FROM User u
            WHERE u.isDeleted = false
              AND u.department.id IN :applicableDepartmentIds
              AND (:departmentId IS NULL OR u.department.id = :departmentId)
              AND (:positionId IS NULL OR u.position.id = :positionId)
            """)
    long countScopedTrainingRequirementCandidates(
            @Param("applicableDepartmentIds") Collection<Long> applicableDepartmentIds,
            @Param("departmentId") Long departmentId,
            @Param("positionId") Long positionId
    );

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
