package vn.vietduc.carehubbackend.auth.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;
import vn.vietduc.carehubbackend.auth.dto.request.LoginRequest;
import vn.vietduc.carehubbackend.auth.dto.response.AccessTokenResult;
import vn.vietduc.carehubbackend.auth.entity.RefreshToken;
import vn.vietduc.carehubbackend.auth.service.impl.AuthServiceImpl;
import vn.vietduc.carehubbackend.exception.BadRequestException;
import vn.vietduc.carehubbackend.exception.TokenException;
import vn.vietduc.carehubbackend.exception.UnauthorizedException;
import vn.vietduc.carehubbackend.user.entity.User;
import vn.vietduc.carehubbackend.user.entity.UserStatus;
import vn.vietduc.carehubbackend.user.repository.UserRepository;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthServiceImplTest {
    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private JwtTokenService jwtTokenService;

    @Mock
    private RefreshTokenService refreshTokenService;

    private AuthServiceImpl service;
    private User activeUser;

    @BeforeEach
    void setUp() {
        service = new AuthServiceImpl(
                userRepository,
                passwordEncoder,
                jwtTokenService,
                refreshTokenService
        );
        activeUser = User.builder()
                .id(11L)
                .employeeCode("EMP001")
                .email("emp001@example.com")
                .name("Employee One")
                .password("encoded-password")
                .status(UserStatus.ACTIVE)
                .build();
    }

    @Test
    void loginKeepsOtherSessionsPersistsLastLoginAndReturnsFreshTokens() {
        when(userRepository.findByEmployeeCodeAndIsDeletedFalse("EMP001")).thenReturn(Optional.of(activeUser));
        when(passwordEncoder.matches("plain-password", "encoded-password")).thenReturn(true);
        when(jwtTokenService.generateAccessToken(activeUser)).thenReturn(new AccessTokenResult("access-token", 900));
        when(refreshTokenService.createRefreshToken(activeUser)).thenReturn(RefreshToken.builder()
                .token("refresh-token")
                .user(activeUser)
                .revoked(false)
                .expiredAt(LocalDateTime.now().plusDays(7))
                .build());

        var response = service.login(login("EMP001", "plain-password"));

        assertEquals("access-token", response.getAccessToken());
        assertEquals("refresh-token", response.getRefreshToken());
        assertEquals("Bearer", response.getTokenType());
        assertEquals(900L, response.getExpiresIn());
        assertFalse(response.isRequiresFirstLoginSetup());
        assertNotNull(activeUser.getLastLogin());
        verify(refreshTokenService, never()).revokeAllUserTokens(any());
        verify(userRepository).save(activeUser);
    }

    @Test
    void loginActivatesImportedFirstLoginUserWithoutEmailSetup() {
        User firstLoginUser = User.builder()
                .id(22L)
                .employeeCode("NEW001")
                .name("New Employee")
                .password("encoded-password")
                .firstLogin(true)
                .status(UserStatus.INACTIVE)
                .build();
        when(userRepository.findByEmployeeCodeAndIsDeletedFalse("NEW001")).thenReturn(Optional.of(firstLoginUser));
        when(passwordEncoder.matches("plain-password", "encoded-password")).thenReturn(true);
        when(jwtTokenService.generateAccessToken(firstLoginUser)).thenReturn(new AccessTokenResult("access-token", 900));
        when(refreshTokenService.createRefreshToken(firstLoginUser)).thenReturn(RefreshToken.builder()
                .token("refresh-token")
                .user(firstLoginUser)
                .revoked(false)
                .expiredAt(LocalDateTime.now().plusDays(7))
                .build());

        var response = service.login(login("NEW001", "plain-password"));

        assertEquals("access-token", response.getAccessToken());
        assertFalse(response.isRequiresFirstLoginSetup());
        assertFalse(firstLoginUser.isFirstLogin());
        assertEquals(UserStatus.ACTIVE, firstLoginUser.getStatus());
        assertEquals(1L, firstLoginUser.getAuthVersion());
        assertNotNull(firstLoginUser.getLastLogin());
        verify(refreshTokenService).revokeAllUserTokens(firstLoginUser);
        verify(userRepository).save(firstLoginUser);
    }

    @Test
    void loginRejectsInactiveNonFirstLoginAccount() {
        activeUser.setStatus(UserStatus.INACTIVE);
        activeUser.setFirstLogin(false);
        when(userRepository.findByEmployeeCodeAndIsDeletedFalse("EMP001")).thenReturn(Optional.of(activeUser));
        when(passwordEncoder.matches("plain-password", "encoded-password")).thenReturn(true);

        UnauthorizedException exception = assertThrows(
                UnauthorizedException.class,
                () -> service.login(login("EMP001", "plain-password"))
        );

        assertEquals("Tài khoản chưa được kích hoạt", exception.getMessage());
        verify(refreshTokenService, never()).revokeAllUserTokens(any());
        verify(jwtTokenService, never()).generateAccessToken(any());
    }

    @Test
    void loginRejectsInvalidPasswordWithoutRevokingTokens() {
        when(userRepository.findByEmployeeCodeAndIsDeletedFalse("EMP001")).thenReturn(Optional.of(activeUser));
        when(passwordEncoder.matches("wrong", "encoded-password")).thenReturn(false);

        BadRequestException exception = assertThrows(
                BadRequestException.class,
                () -> service.login(login("EMP001", "wrong"))
        );

        assertEquals("Mã nhân viên hoặc mật khẩu không chính xác", exception.getMessage());
        verifyNoInteractions(jwtTokenService, refreshTokenService);
        verify(userRepository, never()).save(any());
    }

    @Test
    void loginRejectsLockedAccountAfterCredentialCheck() {
        activeUser.setStatus(UserStatus.LOCKED);
        when(userRepository.findByEmployeeCodeAndIsDeletedFalse("EMP001")).thenReturn(Optional.of(activeUser));
        when(passwordEncoder.matches("plain-password", "encoded-password")).thenReturn(true);

        UnauthorizedException exception = assertThrows(
                UnauthorizedException.class,
                () -> service.login(login("EMP001", "plain-password"))
        );

        assertEquals("Tài khoản đã bị khóa", exception.getMessage());
        verify(refreshTokenService, never()).revokeAllUserTokens(any());
        verify(jwtTokenService, never()).generateAccessToken(any());
    }

    @Test
    void refreshTokenRejectsRevokedOrExpiredTokens() {
        RefreshToken revoked = RefreshToken.builder()
                .token("revoked")
                .user(activeUser)
                .revoked(true)
                .expiredAt(LocalDateTime.now().plusDays(1))
                .build();
        when(refreshTokenService.rotateRefreshToken("revoked")).thenThrow(new TokenException("Token đã bị thu hồi"));

        assertThrows(TokenException.class, () -> service.refreshToken("revoked"));

        RefreshToken expired = RefreshToken.builder()
                .token("expired")
                .user(activeUser)
                .revoked(false)
                .expiredAt(LocalDateTime.now().minusSeconds(1))
                .build();
        when(refreshTokenService.rotateRefreshToken("expired")).thenThrow(new TokenException("Token đã hết hạn"));

        assertThrows(TokenException.class, () -> service.refreshToken("expired"));
        verify(jwtTokenService, never()).generateAccessToken(any());
    }

    @Test
    void refreshTokenAllowsFirstLoginSetupUserEvenWhenNotActive() {
        User firstLoginUser = User.builder()
                .id(22L)
                .employeeCode("NEW001")
                .name("New Employee")
                .password("encoded")
                .firstLogin(true)
                .status(UserStatus.INACTIVE)
                .build();
        RefreshToken token = RefreshToken.builder()
                .token("refresh")
                .user(firstLoginUser)
                .revoked(false)
                .expiredAt(LocalDateTime.now().plusDays(1))
                .build();
        when(refreshTokenService.rotateRefreshToken("refresh")).thenReturn(token);
        when(jwtTokenService.generateAccessToken(firstLoginUser)).thenReturn(new AccessTokenResult("access", 900));

        var response = service.refreshToken("refresh");

        assertEquals("access", response.getAccessToken());
        assertTrue(response.isRequiresFirstLoginSetup());
    }

    @Test
    void logoutRevokesRefreshToken() {
        RefreshToken token = RefreshToken.builder()
                .token("refresh")
                .user(activeUser)
                .revoked(false)
                .expiredAt(LocalDateTime.now().plusDays(1))
                .build();

        service.logout("refresh");

        verify(refreshTokenService).revokeRefreshToken("refresh");
    }

    private LoginRequest login(String employeeCode, String password) {
        LoginRequest request = new LoginRequest();
        request.setEmployeeCode(employeeCode);
        request.setPassword(password);
        return request;
    }

}
