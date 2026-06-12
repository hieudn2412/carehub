package vn.vietduc.carehubbackend.user.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vn.vietduc.carehubbackend.user.entity.Department;

public interface DepartmentRepository extends JpaRepository<Department, Long> {
    boolean existsById(Long id);
}
