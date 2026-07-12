package vn.vietduc.carehubbackend.user.service;

import jakarta.persistence.EntityNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;
import vn.vietduc.carehubbackend.exception.BadRequestException;
import vn.vietduc.carehubbackend.exception.ConflictException;
import vn.vietduc.carehubbackend.notification.messaging.EmailMessage;
import vn.vietduc.carehubbackend.notification.messaging.EmailProducer;
import vn.vietduc.carehubbackend.user.dto.request.ChangePasswordRequest;
import vn.vietduc.carehubbackend.user.dto.request.CreateUserRequest;
import vn.vietduc.carehubbackend.user.entity.Department;
import vn.vietduc.carehubbackend.user.entity.Role;
import vn.vietduc.carehubbackend.user.entity.User;
import vn.vietduc.carehubbackend.user.entity.UserRole;
import vn.vietduc.carehubbackend.user.entity.UserStatus;
import vn.vietduc.carehubbackend.user.repository.DepartmentRepository;
import vn.vietduc.carehubbackend.user.repository.EducationLevelRepository;
import vn.vietduc.carehubbackend.user.repository.PositionRepository;
import vn.vietduc.carehubbackend.user.repository.RoleRepository;
import vn.vietduc.carehubbackend.user.repository.UserRepository;
import vn.vietduc.carehubbackend.user.repository.UserRoleRepository;
import vn.vietduc.carehubbackend.user.service.impl.UserServiceImpl;
import vn.vietduc.carehubbackend.utils.SecurityUtils;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UserServiceImplTest {
    @Mock
    private UserRepository userRepository;

    @Mock
    private DepartmentRepository departmentRepository;

    @Mock
    private PositionRepository positionRepository;

    @Mock
    private EducationLevelRepository educationLevelRepository;

    @Mock
    private UserRoleRepository userRoleRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private RoleRepository roleRepository;

    @Mock
    private EmailProducer emailProducer;

    @Mock
    private SecurityUtils securityUtils;

    private UserServiceImpl service;
    private Department department;
    private Role userRole;

    @BeforeEach
    void setUp() {
        service = new UserServiceImpl(
                userRepository,
                departmentRepository,
                positionRepository,
                educationLevelRepository,
                userRoleRepository,
                passwordEncoder,
                roleRepository,
                emailProducer,
                securityUtils
        );
        department = Department.builder().id(3L).departmentCode("ICU").name("ICU").build();
        userRole = Role.builder().code("USER").name("User").build();
        userRole.setId(5L);
    }

    @Test
    void createUserPersistsUserAssignsRolesAndEmailsInitialPassword() {
        when(userRepository.existsByEmployeeCodeAndIsDeletedFalse("EMP100")).thenReturn(false);
        when(userRepository.existsByEmailAndIsDeletedFalse("emp100@example.com")).thenReturn(false);
        when(departmentRepository.findById(3L)).thenReturn(Optional.of(department));
        when(roleRepository.findById(5L)).thenReturn(Optional.of(userRole));
        when(passwordEncoder.encode(anyString())).thenReturn("encoded-random-password");

        var response = service.createUser(createUserRequest());

        assertEquals("EMP100", response.getEmployeeCode());
        assertEquals("emp100@example.com", response.getEmail());
        assertEquals(UserStatus.ACTIVE, response.getStatus());

        ArgumentCaptor<User> userCaptor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(userCaptor.capture());
        User savedUser = userCaptor.getValue();
        assertEquals("EMP100", savedUser.getEmployeeCode());
        assertEquals(department, savedUser.getDepartment());
        assertEquals("encoded-random-password", savedUser.getPassword());
        assertFalse(savedUser.isFirstLogin());

        ArgumentCaptor<UserRole> userRoleCaptor = ArgumentCaptor.forClass(UserRole.class);
        verify(userRoleRepository).save(userRoleCaptor.capture());
        assertSame(savedUser, userRoleCaptor.getValue().getUser());
        assertSame(userRole, userRoleCaptor.getValue().getRole());

        ArgumentCaptor<EmailMessage> emailCaptor = ArgumentCaptor.forClass(EmailMessage.class);
        verify(emailProducer).sendEmail(emailCaptor.capture());
        assertEquals("emp100@example.com", emailCaptor.getValue().getTo());
        assertTrue(emailCaptor.getValue().getContent().contains("EMP100"));
    }

    @Test
    void createUserRejectsDuplicateEmployeeCodeBeforeCreatingSideEffects() {
        when(userRepository.existsByEmployeeCodeAndIsDeletedFalse("EMP100")).thenReturn(true);

        assertThrows(ConflictException.class, () -> service.createUser(createUserRequest()));

        verifyNoInteractions(departmentRepository, roleRepository, userRoleRepository, emailProducer);
        verify(userRepository, never()).save(any());
    }

    @Test
    void changePasswordRequiresMatchingOldPasswordAndConfirmation() {
        User user = User.builder()
                .id(9L)
                .employeeCode("EMP009")
                .name("Employee Nine")
                .password("old-hash")
                .status(UserStatus.ACTIVE)
                .build();
        when(securityUtils.getCurrentUserId()).thenReturn(9L);
        when(userRepository.findById(9L)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("old-password", "old-hash")).thenReturn(true);
        when(passwordEncoder.encode("new-password")).thenReturn("new-hash");

        service.changePassword(changePassword("old-password", "new-password", "new-password"));

        assertEquals("new-hash", user.getPassword());
        verify(userRepository).save(user);

        assertThrows(BadRequestException.class,
                () -> service.changePassword(changePassword("old-password", "old-password", "old-password")));
        assertThrows(BadRequestException.class,
                () -> service.changePassword(changePassword("old-password", "new-password", "different")));
    }

    @Test
    void assignRoleRejectsExistingAssignment() {
        User user = User.builder().id(9L).employeeCode("EMP009").name("Employee Nine").status(UserStatus.ACTIVE).build();
        when(userRepository.findById(9L)).thenReturn(Optional.of(user));
        when(roleRepository.findById(5L)).thenReturn(Optional.of(userRole));
        when(userRoleRepository.existsByUser_IdAndRole_Id(9L, 5L)).thenReturn(true);

        assertThrows(ConflictException.class, () -> service.assignRole(9L, 5L));

        verify(userRoleRepository, never()).save(any());
    }

    @Test
    void getUserDetailsTreatsSoftDeletedUsersAsNotFound() {
        User deleted = User.builder()
                .id(9L)
                .employeeCode("EMP009")
                .name("Employee Nine")
                .status(UserStatus.ACTIVE)
                .isDeleted(true)
                .build();
        when(userRepository.findById(9L)).thenReturn(Optional.of(deleted));

        assertThrows(EntityNotFoundException.class, () -> service.getUserDetails(9L));
    }

    private CreateUserRequest createUserRequest() {
        CreateUserRequest request = new CreateUserRequest();
        request.setEmployeeCode("EMP100");
        request.setDepartmentId(3L);
        request.setEmail("emp100@example.com");
        request.setFullName("Employee One Hundred");
        request.setRoleIds(List.of(5L));
        return request;
    }

    private ChangePasswordRequest changePassword(String oldPassword, String newPassword, String confirmPassword) {
        ChangePasswordRequest request = new ChangePasswordRequest();
        request.setOldPassword(oldPassword);
        request.setNewPassword(newPassword);
        request.setConfirmNewPassword(confirmPassword);
        return request;
    }
}
