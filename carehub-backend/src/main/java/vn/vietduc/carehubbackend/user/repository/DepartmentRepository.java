package vn.vietduc.carehubbackend.user.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vn.vietduc.carehubbackend.user.entity.Department;

import java.util.Collection;
import java.util.List;

public interface DepartmentRepository extends JpaRepository<Department, Long> {
    boolean existsById(Long id);
    boolean existsByDepartmentCode(String departmentCode);
    boolean existsByDepartmentCodeAndIdNot(String departmentCode, Long id);

    List<Department> findByDepartmentCodeIn(Collection<String> departmentCodes);
}
