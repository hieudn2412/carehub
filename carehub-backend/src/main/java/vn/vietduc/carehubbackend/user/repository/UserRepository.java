package vn.vietduc.carehubbackend.user.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vn.vietduc.carehubbackend.user.entity.User;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);
    Optional<User> findByEmployeeCode(String employeeCode);
    Optional<User> findByEmailAndIsDeletedFalse(String email);
    Optional<User> findByEmployeeCodeAndIsDeletedFalse(String employeeCode);
    boolean existsByEmail(String email);
    boolean existsByEmployeeCodeAndIsDeletedFalse(String employeeCode);
    boolean existsByEmailAndIsDeletedFalse(String email);
    boolean existsByEmployeeCode(String employeeCode);
}
