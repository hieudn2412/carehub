package vn.vietduc.carehubbackend.user.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vn.vietduc.carehubbackend.user.entity.User;
import vn.vietduc.carehubbackend.user.repository.custom.UserRepositoryCustom;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long>, UserRepositoryCustom {
    Optional<User> findByEmailAndIsDeletedFalse(String email);
    Optional<User> findByEmployeeCodeAndIsDeletedFalse(String employeeCode);
    boolean existsByEmail(String email);
    boolean existsByEmployeeCodeAndIsDeletedFalse(String employeeCode);
    boolean existsByEmailAndIsDeletedFalse(String email);
    boolean existsByEmployeeCodeAndIsDeletedFalseAndIdNot(String employeeCode, Long id);
    boolean existsByEmailAndIsDeletedFalseAndIdNot(String email, Long id);
    boolean existsByDepartment_IdAndIsDeletedFalse(Long departmentId);
    boolean existsByPosition_IdAndIsDeletedFalse(Long positionId);
    boolean existsByEducationLevel_IdAndIsDeletedFalse(Long educationLevelId);
    List<User> findByEmployeeCodeIn(Collection<String> employeeCodes);

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
}
