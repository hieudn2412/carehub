package vn.vietduc.carehubbackend.user.service.impl;

import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.vietduc.carehubbackend.auth.entity.PasswordResetOtp;
import vn.vietduc.carehubbackend.auth.repository.PasswordResetRepository;
import vn.vietduc.carehubbackend.exception.BadRequestException;
import vn.vietduc.carehubbackend.notification.EmailMessage;
import vn.vietduc.carehubbackend.notification.EmailProducer;
import vn.vietduc.carehubbackend.user.dto.request.CompleteFirstLoginRequest;
import vn.vietduc.carehubbackend.user.dto.request.SendEmailVerificationRequest;
import vn.vietduc.carehubbackend.user.entity.User;
import vn.vietduc.carehubbackend.user.entity.UserStatus;
import vn.vietduc.carehubbackend.user.repository.UserRepository;
import vn.vietduc.carehubbackend.user.service.FirstLoginService;
import vn.vietduc.carehubbackend.utils.SecurityUtils;

import java.time.LocalDateTime;
import java.util.concurrent.ThreadLocalRandom;

@Service
@RequiredArgsConstructor
public class FirstLoginServiceImpl implements FirstLoginService {

    private static final int OTP_EXPIRY_MINUTES = 5;

    private final PasswordResetRepository passwordResetRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final SecurityUtils securityUtils;
    private final EmailProducer emailProducer;

    @Override
    public void sendEmailVerificationOtp(SendEmailVerificationRequest request) {
        String email = request.getEmail();

        if (userRepository.existsByEmailAndIsDeletedFalse(email)) {
            throw new BadRequestException("Email already exists");
        }

        User user = getCurrentUserRequiringFirstLoginSetup();

        String otp = String.format("%06d", ThreadLocalRandom.current().nextInt(1_000_000));

        PasswordResetOtp resetOtp = PasswordResetOtp.builder()
                .userId(user.getId())
                .email(email)
                .otp(otp)
                .emailVerification(true)
                .expiredAt(LocalDateTime.now().plusMinutes(OTP_EXPIRY_MINUTES))
                .used(false)
                .build();

        passwordResetRepository.save(resetOtp);

        emailProducer.sendEmail(
                EmailMessage.builder()
                        .to(email)
                        .subject("Email Verification OTP")
                        .content("Your OTP is: " + otp)
                        .build()
        );
    }

    @Override
    @Transactional
    public void completeFirstLoginSetup(CompleteFirstLoginRequest request) {
        Long userId = securityUtils.getCurrentUserId();

        PasswordResetOtp otp = passwordResetRepository
                .findTopByEmailAndUserIdAndOtpAndEmailVerificationTrueOrderByCreatedAtDesc(
                        request.getEmail(), userId, request.getOtp())
                .orElseThrow(() -> new BadRequestException("Invalid OTP"));

        if (otp.isUsed()) {
            throw new BadRequestException("OTP already used");
        }

        if (otp.getExpiredAt().isBefore(LocalDateTime.now())) {
            throw new BadRequestException("OTP expired");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new EntityNotFoundException("User not found"));

        if (!user.requiresFirstLoginSetup()) {
            throw new BadRequestException("First login setup is not required for this account");
        }

        if (userRepository.existsByEmailAndIsDeletedFalse(request.getEmail())) {
            throw new BadRequestException("Email already exists");
        }

        user.setEmail(request.getEmail());
        user.setPassword(passwordEncoder.encode(request.getNewPassword()));
        user.setFirstLogin(false);
        user.setStatus(UserStatus.ACTIVE);

        otp.setUsed(true);
        userRepository.save(user);
        passwordResetRepository.save(otp);
    }

    private User getCurrentUserRequiringFirstLoginSetup() {
        Long userId = securityUtils.getCurrentUserId();
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new EntityNotFoundException("User not found"));

        if (!user.requiresFirstLoginSetup()) {
            throw new BadRequestException("First login setup is not required for this account");
        }

        return user;
    }
}
