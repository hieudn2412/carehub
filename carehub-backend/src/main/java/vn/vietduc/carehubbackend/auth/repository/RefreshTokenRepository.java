package vn.vietduc.carehubbackend.auth.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import vn.vietduc.carehubbackend.auth.entity.RefreshToken;
import vn.vietduc.carehubbackend.user.entity.User;

import jakarta.persistence.LockModeType;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, Long> {
    Optional<RefreshToken> findByToken(String token);

    Optional<RefreshToken> findBySessionId(String sessionId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT token FROM RefreshToken token WHERE token.sessionId = :sessionId")
    Optional<RefreshToken> findBySessionIdForUpdate(@Param("sessionId") String sessionId);

    void deleteByUser(User user);
    List<RefreshToken> findByUserAndRevokedFalse(User user);
    RefreshToken findByUserAndRevokedTrue(User user);

    @Modifying
    @Query("""
            UPDATE RefreshToken token
            SET token.revoked = true,
                token.revokedAt = :now
            WHERE token.user = :user
              AND token.revoked = false
            """)
    int revokeActiveTokensByUser(@Param("user") User user, @Param("now") LocalDateTime now);

    @Modifying
    @Query("""
            DELETE FROM RefreshToken token
            WHERE token.expiredAt < :expiredBefore
               OR (token.revoked = true AND token.revokedAt < :revokedBefore)
            """)
    int deleteExpiredOrOldRevoked(
            @Param("expiredBefore") LocalDateTime expiredBefore,
            @Param("revokedBefore") LocalDateTime revokedBefore
    );
}
