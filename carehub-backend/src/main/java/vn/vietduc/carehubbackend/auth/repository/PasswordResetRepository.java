package vn.vietduc.carehubbackend.auth.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vn.vietduc.carehubbackend.auth.entity.PasswordResetOtp;

import java.util.Optional;

public interface PasswordResetRepository extends JpaRepository<PasswordResetOtp, Long> {
    Optional<PasswordResetOtp> findTopByEmailAndOtpAndEmailVerificationFalseOrderByCreatedAtDesc(String email, String otp);

    Optional<PasswordResetOtp> findTopByEmailAndUserIdAndOtpAndEmailVerificationTrueOrderByCreatedAtDesc(
            String email, Long userId, String otp);
}
