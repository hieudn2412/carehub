package vn.vietduc.carehubbackend.auth.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vn.vietduc.carehubbackend.auth.entity.RefreshToken;
import vn.vietduc.carehubbackend.user.entity.User;

import java.util.List;
import java.util.Optional;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, Long> {
    Optional<RefreshToken> findByToken(String token);
    void deleteByUser(User user);
    List<RefreshToken> findByUserAndRevokedFalse(User user);
    RefreshToken findByUserAndRevokedTrue(User user);
}
