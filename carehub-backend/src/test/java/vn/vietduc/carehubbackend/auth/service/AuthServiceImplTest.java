package vn.vietduc.carehubbackend.auth.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;
import vn.vietduc.carehubbackend.auth.dto.request.LoginRequest;
import vn.vietduc.carehubbackend.auth.dto.request.LogoutRequest;
import vn.vietduc.carehubbackend.auth.dto.request.RefreshTokenRequest;
import vn.vietduc.carehubbackend.auth.dto.response.AccessTokenResult;
import vn.vietduc.carehubbackend.auth.entity.RefreshToken;
import vn.vietduc.carehubbackend.auth.repository.RefreshTokenRepository;
import vn.vietduc.carehubbackend.auth.service.impl.AuthServiceImpl;
import vn.vietduc.carehubbackend.exception.BadRequestException;
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

    @Mock
    private RefreshTokenRepository refreshTokenRepository;

    private AuthServiceImpl service;
    private User activeUser;

    @BeforeEach
    void setUp() {
        service = new AuthServiceImpl(
                userRepository,
                passwordEncoder,
                jwtTokenService,
                refreshTokenService,
                refreshTokenRepository
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
    void loginRevokesPreviousTokensPersistsLastLoginAndReturnsFreshTokens() {
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
        verify(refreshTokenService).revokeAllUserTokens(activeUser);
        verify(userRepository).save(activeUser);
    }

    @Test
    void loginRejectsInvalidPasswordWithoutRevokingTokens() {
        when(userRepository.findByEmployeeCodeAndIsDeletedFalse("EMP001")).thenReturn(Optional.of(activeUser));
        when(passwordEncoder.matches("wrong", "encoded-password")).thenReturn(false);

        BadRequestException exception = assertThrows(
                BadRequestException.class,
                () -> service.login(login("EMP001", "wrong"))
        );

        assertEquals("Invalid code or password", exception.getMessage());
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

        assertEquals("Account is locked", exception.getMessage());
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
        when(refreshTokenService.findToken("revoked")).thenReturn(revoked);

        assertThrows(BadRequestException.class, () -> service.refreshToken(refresh("revoked")));

        RefreshToken expired = RefreshToken.builder()
                .token("expired")
                .user(activeUser)
                .revoked(false)
                .expiredAt(LocalDateTime.now().minusSeconds(1))
                .build();
        when(refreshTokenService.findToken("expired")).thenReturn(expired);

        assertThrows(BadRequestException.class, () -> service.refreshToken(refresh("expired")));
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
        when(refreshTokenService.findToken("refresh")).thenReturn(token);
        when(jwtTokenService.generateAccessToken(firstLoginUser)).thenReturn(new AccessTokenResult("access", 900));

        var response = service.refreshToken(refresh("refresh"));

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
        when(refreshTokenService.findToken("refresh")).thenReturn(token);

        service.logout(logout("refresh"));

        ArgumentCaptor<RefreshToken> captor = ArgumentCaptor.forClass(RefreshToken.class);
        verify(refreshTokenRepository).save(captor.capture());
        assertTrue(captor.getValue().getRevoked());
    }

    private LoginRequest login(String employeeCode, String password) {
        LoginRequest request = new LoginRequest();
        request.setEmployeeCode(employeeCode);
        request.setPassword(password);
        return request;
    }

    private RefreshTokenRequest refresh(String token) {
        RefreshTokenRequest request = new RefreshTokenRequest();
        request.setRefreshToken(token);
        return request;
    }

    private LogoutRequest logout(String token) {
        LogoutRequest request = new LogoutRequest();
        request.setRefreshToken(token);
        return request;
    }
}
