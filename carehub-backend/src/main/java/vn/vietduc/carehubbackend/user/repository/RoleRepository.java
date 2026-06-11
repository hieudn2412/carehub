package vn.vietduc.carehubbackend.user.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vn.vietduc.carehubbackend.user.entity.Role;

import java.util.List;
import java.util.Optional;
import java.util.Set;

@Repository
public interface RoleRepository extends JpaRepository<Role,Long> {
    Optional<Role> findById(Long roleId);
    Optional<Role> findByCode(String code);
    boolean existsByCode(String code);
    List<Role> findAll();
    List<Role> findByCodeIn(Set<String> code);
}
