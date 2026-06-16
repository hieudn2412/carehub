package vn.vietduc.carehubbackend.user.repository.custom;

import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Repository;
import vn.vietduc.carehubbackend.user.dto.request.UserFilterRequest;
import vn.vietduc.carehubbackend.user.entity.User;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Repository
@RequiredArgsConstructor
public class UserRepositoryCustomImpl implements UserRepositoryCustom {
    @Override
    public List<User> getAllUsersToExport(UserFilterRequest request) {
        StringBuilder sql = new StringBuilder("""
                SELECT DISTINCT u.*
                FROM users u
                LEFT JOIN user_roles ur
                    ON ur.user_id = u.id
                WHERE 1 = 1
                """);

        Map<String, Object> params = new HashMap<>();

        appendConditions(request, sql, null, params);

        sql.append("""
                ORDER BY u.id DESC
                """);

        Query dataQuery = entityManager.createNativeQuery(sql.toString(), User.class);

        params.forEach((key, value) -> {
            dataQuery.setParameter(key, value);
        });

        List<User> users = dataQuery.getResultList();
        return users;
    }

    private final EntityManager entityManager;

    @Override
    public Page<User> searchUsers(
            UserFilterRequest request,
            Pageable pageable
    ) {

        StringBuilder sql = new StringBuilder("""
                SELECT DISTINCT u.*
                FROM users u
                LEFT JOIN user_roles ur
                    ON ur.user_id = u.id
                WHERE 1 = 1
                """);

        StringBuilder countSql = new StringBuilder("""
                SELECT COUNT(DISTINCT u.id)
                FROM users u
                LEFT JOIN user_roles ur
                    ON ur.user_id = u.id
                WHERE 1 = 1
                """);

        Map<String, Object> params = new HashMap<>();

        appendConditions(
                request,
                sql,
                countSql,
                params
        );

        sql.append("""
                ORDER BY u.id DESC
                LIMIT :limit
                OFFSET :offset
                """);

        Query dataQuery =
                entityManager.createNativeQuery(
                        sql.toString(),
                        User.class
                );

        Query totalQuery =
                entityManager.createNativeQuery(
                        countSql.toString()
                );

        params.forEach((key, value) -> {
            dataQuery.setParameter(key, value);
            totalQuery.setParameter(key, value);
        });

        dataQuery.setParameter(
                "limit",
                pageable.getPageSize()
        );

        dataQuery.setParameter(
                "offset",
                pageable.getOffset()
        );

        List<User> users = dataQuery.getResultList();

        Long total =
                ((Number) totalQuery.getSingleResult())
                        .longValue();

        return new PageImpl<>(
                users,
                pageable,
                total
        );
    }

    private void appendConditions(
            UserFilterRequest request,
            StringBuilder sql,
            StringBuilder countSql,
            Map<String, Object> params
    ) {
        if (request == null) {
            return;
        }

        if (request.getKeyword() != null
                && !request.getKeyword().isBlank()) {

            String condition = """
                    AND (
                        LOWER(u.name) LIKE :keyword
                        OR LOWER(u.employee_code) LIKE :keyword
                    )
                    """;

            sql.append(condition);
            if (countSql != null) {
                countSql.append(condition);
            }

            params.put(
                    "keyword",
                    "%" + request.getKeyword().toLowerCase() + "%"
            );
        }

        if (request.getDepartmentId() != null) {

            String condition = """
                    AND u.department_id = :departmentId
                    """;

            sql.append(condition);
            if (countSql != null) {
                countSql.append(condition);
            }

            params.put(
                    "departmentId",
                    request.getDepartmentId()
            );
        }

        if (request.getPositionId() != null) {

            String condition = """
                    AND u.position_id = :positionId
                    """;

            sql.append(condition);
            if (countSql != null) {
                countSql.append(condition);
            }

            params.put(
                    "positionId",
                    request.getPositionId()
            );
        }

        if (request.getRoleId() != null) {

            String condition = """
                    AND ur.role_id = :roleId
                    """;

            sql.append(condition);
            if (countSql != null) {
                countSql.append(condition);
            }

            params.put(
                    "roleId",
                    request.getRoleId()
            );
        }

        if (request.getStatus() != null) {

            String condition = """
                    AND u.status = :status
                    """;

            sql.append(condition);
            if (countSql != null) {
                countSql.append(condition);
            }

            params.put(
                    "status",
                    request.getStatus().name()
            );
        }
    }
}
