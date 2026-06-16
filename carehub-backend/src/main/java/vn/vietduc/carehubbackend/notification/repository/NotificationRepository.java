package vn.vietduc.carehubbackend.notification.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import vn.vietduc.carehubbackend.notification.entity.Notification;

import java.util.Optional;

public interface NotificationRepository extends JpaRepository<Notification, Long> {
    Optional<Notification> findByIdAndUser_Id(Long id, Long userId);

    boolean existsByDedupKey(String dedupKey);

    @Query("""
            SELECT n
            FROM Notification n
            WHERE n.user.id = :userId
              AND (:q IS NULL
                   OR LOWER(n.title) LIKE LOWER(CONCAT('%', :q, '%'))
                   OR LOWER(n.type) LIKE LOWER(CONCAT('%', :q, '%')))
              AND (:read IS NULL OR n.read = :read)
            ORDER BY n.createdAt DESC
            """)
    Page<Notification> findScoped(
            @Param("userId") Long userId,
            @Param("q") String q,
            @Param("read") Boolean read,
            Pageable pageable
    );
}
