package vn.vietduc.carehubbackend.user.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;
import vn.vietduc.carehubbackend.auth.entity.PasswordResetOtp;
import vn.vietduc.carehubbackend.auth.repository.PasswordResetRepository;
import vn.vietduc.carehubbackend.auth.service.RefreshTokenService;
import vn.vietduc.carehubbackend.notification.config.MailProperties;
import vn.vietduc.carehubbackend.notification.messaging.EmailMessage;
import vn.vietduc.carehubbackend.notification.messaging.EmailProducer;
import vn.vietduc.carehubbackend.notification.service.BrandedEmailRenderer;
import vn.vietduc.carehubbackend.user.dto.request.SendEmailVerificationRequest;
import vn.vietduc.carehubbackend.user.entity.User;
import vn.vietduc.carehubbackend.user.entity.UserStatus;
import vn.vietduc.carehubbackend.user.repository.UserRepository;
import vn.vietduc.carehubbackend.user.service.impl.FirstLoginServiceImpl;
import vn.vietduc.carehubbackend.utils.SecurityUtils;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FirstLoginServiceImplTest {
    @Mock
    private PasswordResetRepository passwordResetRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private PasswordEncoder passwordEncoder;
    @Mock
    private SecurityUtils securityUtils;
    @Mock
    private EmailProducer emailProducer;
    @Mock
    private RefreshTokenService refreshTokenService;

    private FirstLoginServiceImpl service;

    @BeforeEach
    void setUp() {
        MailProperties properties = new MailProperties();
        properties.setBrandName("VietDuc Care");
        service = new FirstLoginServiceImpl(
                passwordResetRepository,
                userRepository,
                passwordEncoder,
                securityUtils,
                emailProducer,
                new BrandedEmailRenderer(properties),
                refreshTokenService
        );
    }

    @Test
    void queuesBrandedVerificationEmailWithFiveMinuteOtp() {
        User user = User.builder()
                .id(9L)
                .employeeCode("EMP009")
                .name("Nguyễn Văn A")
                .status(UserStatus.INACTIVE)
                .firstLogin(true)
                .build();
        when(userRepository.existsByEmailAndIsDeletedFalse("new@example.com")).thenReturn(false);
        when(securityUtils.getCurrentUserId()).thenReturn(9L);
        when(userRepository.findById(9L)).thenReturn(Optional.of(user));

        SendEmailVerificationRequest request = new SendEmailVerificationRequest();
        request.setEmail("new@example.com");
        service.sendEmailVerificationOtp(request);

        ArgumentCaptor<PasswordResetOtp> otpCaptor = ArgumentCaptor.forClass(PasswordResetOtp.class);
        verify(passwordResetRepository).save(otpCaptor.capture());
        assertThat(otpCaptor.getValue().getExpiredAt())
                .isAfter(LocalDateTime.now().plusMinutes(4))
                .isBefore(LocalDateTime.now().plusMinutes(6));

        ArgumentCaptor<EmailMessage> emailCaptor = ArgumentCaptor.forClass(EmailMessage.class);
        verify(emailProducer).sendEmail(emailCaptor.capture());
        EmailMessage email = emailCaptor.getValue();
        assertThat(email.getTo()).isEqualTo("new@example.com");
        assertThat(email.getSubject()).isEqualTo("[VietDuc Care] Xác thực địa chỉ email");
        assertThat(email.getContent()).contains(otpCaptor.getValue().getOtp(), "5 phút");
        assertThat(email.getHtmlContent()).contains(otpCaptor.getValue().getOtp(), "Nguyễn Văn A");
    }
}
