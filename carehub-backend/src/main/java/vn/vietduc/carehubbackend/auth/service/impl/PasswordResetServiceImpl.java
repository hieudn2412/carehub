package vn.vietduc.carehubbackend.auth.service.impl;

import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.vietduc.carehubbackend.auth.repository.PasswordResetRepository;
import vn.vietduc.carehubbackend.auth.service.PasswordResetService;
import vn.vietduc.carehubbackend.exception.BadRequestException;
import vn.vietduc.carehubbackend.notification.messaging.EmailMessage;
import vn.vietduc.carehubbackend.notification.messaging.EmailProducer;
import vn.vietduc.carehubbackend.auth.dto.request.ForgotPasswordRequest;
import vn.vietduc.carehubbackend.auth.dto.request.ResetPasswordRequest;
import vn.vietduc.carehubbackend.auth.entity.PasswordResetOtp;
import vn.vietduc.carehubbackend.user.entity.User;
import vn.vietduc.carehubbackend.user.entity.UserStatus;
import vn.vietduc.carehubbackend.user.repository.UserRepository;
import java.time.LocalDateTime;
import java.util.concurrent.ThreadLocalRandom;

@Service
@RequiredArgsConstructor
public class PasswordResetServiceImpl implements PasswordResetService {
    private final PasswordResetRepository passwordResetRepository;
    private final UserRepository userRepository;
    private final EmailProducer emailProducer;
    private final PasswordEncoder passwordEncoder;

    @Transactional
    public void forgotPassword(
            ForgotPasswordRequest request
    ) {
        User user = userRepository
                .findByEmailAndIsDeletedFalse(request.getEmail())
                .orElseThrow(() -> new BadRequestException("Không tìm thấy email"));

        if (user.getStatus().equals(UserStatus.LOCKED)) {
            throw new BadRequestException("Tài khoản đã bị khóa");
        }

        if (user.requiresFirstLoginSetup()) {
            throw new BadRequestException("Vui lòng hoàn tất thiết lập tài khoản lần đầu trước khi đặt lại mật khẩu");
        }

        String otp = String.format("%06d", ThreadLocalRandom.current().nextInt(1000000));

        PasswordResetOtp resetOtp = PasswordResetOtp.builder()
                .email(user.getEmail())
                .otp(otp)
                .emailVerification(false)
                .expiredAt(LocalDateTime.now().plusMinutes(5))
                .used(false)
                .build();

        passwordResetRepository.save(resetOtp);

        emailProducer.sendEmail(
                EmailMessage.builder()
                        .to(user.getEmail())
                        .subject("Reset Password OTP")
                        .content("Your OTP is: " + otp)
                        .build()
        );
    }

    @Override
    @Transactional
    public void resetPassword(ResetPasswordRequest request) {
        PasswordResetOtp otp = passwordResetRepository
                .findTopByEmailAndOtpAndEmailVerificationFalseOrderByCreatedAtDesc(
                        request.getEmail(), request.getOtp())
                .orElseThrow(() -> new BadRequestException("Mã OTP không chính xác"));
        if (otp.isUsed()) {
            throw new BadRequestException("Mã OTP đã được sử dụng");
        }

        if (otp.getExpiredAt().isBefore(LocalDateTime.now())) {
            throw new BadRequestException(
                    "Mã OTP đã hết hạn");
        }

        User user = userRepository.findByEmailAndIsDeletedFalse(request.getEmail())
                .orElseThrow(() -> new EntityNotFoundException("Không tìm thấy người dùng"));

        if (user.requiresFirstLoginSetup()) {
            throw new BadRequestException("Vui lòng hoàn tất thiết lập tài khoản lần đầu trước khi đặt lại mật khẩu");
        }

        String newPassword = passwordEncoder.encode(request.getNewPassword());
        user.setPassword(newPassword);
        otp.setUsed(true);
        userRepository.save(user);
        passwordResetRepository.save(otp);
    }
}
