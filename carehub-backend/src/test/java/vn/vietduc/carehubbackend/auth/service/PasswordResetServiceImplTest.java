package vn.vietduc.carehubbackend.auth.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;
import vn.vietduc.carehubbackend.auth.dto.request.ForgotPasswordRequest;
import vn.vietduc.carehubbackend.auth.dto.request.ResetPasswordRequest;
import vn.vietduc.carehubbackend.auth.entity.PasswordResetOtp;
import vn.vietduc.carehubbackend.auth.repository.PasswordResetRepository;
import vn.vietduc.carehubbackend.auth.service.impl.PasswordResetServiceImpl;
import vn.vietduc.carehubbackend.exception.BadRequestException;
import vn.vietduc.carehubbackend.notification.messaging.EmailMessage;
import vn.vietduc.carehubbackend.notification.messaging.EmailProducer;
import vn.vietduc.carehubbackend.user.entity.User;
import vn.vietduc.carehubbackend.user.entity.UserStatus;
import vn.vietduc.carehubbackend.user.repository.UserRepository;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PasswordResetServiceImplTest {
    @Mock
    private PasswordResetRepository passwordResetRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private EmailProducer emailProducer;

    @Mock
    private PasswordEncoder passwordEncoder;

    private PasswordResetServiceImpl service;
    private User activeUser;

    @BeforeEach
    void setUp() {
        service = new PasswordResetServiceImpl(
                passwordResetRepository,
                userRepository,
                emailProducer,
                passwordEncoder
        );
        activeUser = User.builder()
                .id(7L)
                .employeeCode("EMP007")
                .email("emp007@example.com")
                .name("Employee Seven")
                .password("old-hash")
                .status(UserStatus.ACTIVE)
                .build();
    }

    @Test
    void forgotPasswordStoresOtpAndSendsEmail() {
        when(userRepository.findByEmailAndIsDeletedFalse("emp007@example.com")).thenReturn(Optional.of(activeUser));

        service.forgotPassword(forgot("emp007@example.com"));

        ArgumentCaptor<PasswordResetOtp> otpCaptor = ArgumentCaptor.forClass(PasswordResetOtp.class);
        verify(passwordResetRepository).save(otpCaptor.capture());
        PasswordResetOtp otp = otpCaptor.getValue();
        assertEquals("emp007@example.com", otp.getEmail());
        assertFalse(otp.isEmailVerification());
        assertFalse(otp.isUsed());
        assertTrue(otp.getOtp().matches("\\d{6}"));
        assertTrue(otp.getExpiredAt().isAfter(LocalDateTime.now()));

        ArgumentCaptor<EmailMessage> emailCaptor = ArgumentCaptor.forClass(EmailMessage.class);
        verify(emailProducer).sendEmail(emailCaptor.capture());
        assertEquals("emp007@example.com", emailCaptor.getValue().getTo());
        assertEquals("Reset Password OTP", emailCaptor.getValue().getSubject());
        assertTrue(emailCaptor.getValue().getContent().contains(otp.getOtp()));
    }

    @Test
    void forgotPasswordRejectsLockedAndFirstLoginUsers() {
        activeUser.setStatus(UserStatus.LOCKED);
        when(userRepository.findByEmailAndIsDeletedFalse("emp007@example.com")).thenReturn(Optional.of(activeUser));

        assertThrows(BadRequestException.class, () -> service.forgotPassword(forgot("emp007@example.com")));

        activeUser.setStatus(UserStatus.INACTIVE);
        activeUser.setFirstLogin(true);
        activeUser.setEmail(null);
        when(userRepository.findByEmailAndIsDeletedFalse("new@example.com")).thenReturn(Optional.of(activeUser));

        assertThrows(BadRequestException.class, () -> service.forgotPassword(forgot("new@example.com")));
        verify(passwordResetRepository, never()).save(any());
        verifyNoInteractions(emailProducer);
    }

    @Test
    void resetPasswordConsumesValidOtpAndUpdatesPassword() {
        PasswordResetOtp otp = PasswordResetOtp.builder()
                .email("emp007@example.com")
                .otp("123456")
                .emailVerification(false)
                .expiredAt(LocalDateTime.now().plusMinutes(5))
                .used(false)
                .build();
        when(passwordResetRepository.findTopByEmailAndOtpAndEmailVerificationFalseOrderByCreatedAtDesc(
                "emp007@example.com",
                "123456"
        )).thenReturn(Optional.of(otp));
        when(userRepository.findByEmailAndIsDeletedFalse("emp007@example.com")).thenReturn(Optional.of(activeUser));
        when(passwordEncoder.encode("new-password")).thenReturn("new-hash");

        service.resetPassword(reset("emp007@example.com", "123456", "new-password"));

        assertEquals("new-hash", activeUser.getPassword());
        assertTrue(otp.isUsed());
        verify(userRepository).save(activeUser);
        verify(passwordResetRepository).save(otp);
    }

    @Test
    void resetPasswordRejectsUsedOrExpiredOtp() {
        PasswordResetOtp used = PasswordResetOtp.builder()
                .email("emp007@example.com")
                .otp("123456")
                .expiredAt(LocalDateTime.now().plusMinutes(5))
                .used(true)
                .build();
        when(passwordResetRepository.findTopByEmailAndOtpAndEmailVerificationFalseOrderByCreatedAtDesc(
                "emp007@example.com",
                "123456"
        )).thenReturn(Optional.of(used));

        assertThrows(BadRequestException.class, () -> service.resetPassword(reset("emp007@example.com", "123456", "new-password")));

        PasswordResetOtp expired = PasswordResetOtp.builder()
                .email("emp007@example.com")
                .otp("654321")
                .expiredAt(LocalDateTime.now().minusSeconds(1))
                .used(false)
                .build();
        when(passwordResetRepository.findTopByEmailAndOtpAndEmailVerificationFalseOrderByCreatedAtDesc(
                "emp007@example.com",
                "654321"
        )).thenReturn(Optional.of(expired));

        assertThrows(BadRequestException.class, () -> service.resetPassword(reset("emp007@example.com", "654321", "new-password")));
        verify(userRepository, never()).save(any());
    }

    private ForgotPasswordRequest forgot(String email) {
        ForgotPasswordRequest request = new ForgotPasswordRequest();
        request.setEmail(email);
        return request;
    }

    private ResetPasswordRequest reset(String email, String otp, String newPassword) {
        ResetPasswordRequest request = new ResetPasswordRequest();
        request.setEmail(email);
        request.setOtp(otp);
        request.setNewPassword(newPassword);
        return request;
    }
}
