package vn.vietduc.carehubbackend.user.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vn.vietduc.carehubbackend.user.entity.Permission;
import vn.vietduc.carehubbackend.user.entity.RolePermission;

import java.util.List;
@Repository
public interface RolePermissionRepository extends JpaRepository<RolePermission, Long> {

    @Query("""
            SELECT rp.permission
            FROM RolePermission rp
            WHERE rp.role.id = :roleId
            """)
    List<Permission> findPermissionsByRoleId(@Param("roleId") Long roleId);

    void deleteByRole_Id(Long roleId);
}
