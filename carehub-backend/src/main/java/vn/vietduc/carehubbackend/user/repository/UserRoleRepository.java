package vn.vietduc.carehubbackend.user.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vn.vietduc.carehubbackend.user.entity.Role;
import vn.vietduc.carehubbackend.user.entity.User;
import vn.vietduc.carehubbackend.user.entity.UserRole;

import java.util.List;

@Repository
public interface UserRoleRepository extends JpaRepository<UserRole, Long> {

    boolean existsByRole_Id(Long roleId);
    boolean existsByUser_IdAndRole_Id(Long userId, Long roleId);

    @Query("""
            SELECT ur.role
            FROM UserRole ur
            WHERE ur.user.id = :userId
            """)
    List<Role> findRolesByUserId(@Param("userId") Long userId);

    @Query("""
            SELECT DISTINCT rp.permission.code
            FROM UserRole ur
            JOIN RolePermission rp ON rp.role.id = ur.role.id
            WHERE ur.user.id = :userId
            """)
    List<String> findPermissionCodesByUserId(@Param("userId") Long userId);

    void deleteByUser(User user);
    void deleteByUser_IdAndRole_Id(Long userId, Long roleId);
}
