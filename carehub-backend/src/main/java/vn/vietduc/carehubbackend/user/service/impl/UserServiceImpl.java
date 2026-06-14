package vn.vietduc.carehubbackend.user.service.impl;

import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.vietduc.carehubbackend.exception.BadRequestException;
import vn.vietduc.carehubbackend.notification.EmailMessage;
import vn.vietduc.carehubbackend.notification.EmailProducer;
import vn.vietduc.carehubbackend.user.dto.request.ChangePasswordRequest;
import vn.vietduc.carehubbackend.user.dto.request.CreateUserRequest;
import vn.vietduc.carehubbackend.user.dto.request.UserFilterRequest;
import vn.vietduc.carehubbackend.user.dto.response.UserDetailResponse;
import vn.vietduc.carehubbackend.user.dto.response.UserResponse;
import vn.vietduc.carehubbackend.user.dto.response.UserSummaryResponse;
import vn.vietduc.carehubbackend.user.entity.*;
import vn.vietduc.carehubbackend.user.repository.DepartmentRepository;
import vn.vietduc.carehubbackend.user.repository.RoleRepository;
import vn.vietduc.carehubbackend.user.repository.UserRepository;
import vn.vietduc.carehubbackend.user.repository.UserRoleRepository;
import vn.vietduc.carehubbackend.user.service.UserService;
import vn.vietduc.carehubbackend.utils.SecurityUtils;

import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class UserServiceImpl implements UserService {
    private static final int PASSWORD_LENGTH = 12;

    private final UserRepository userRepository;
    private final DepartmentRepository departmentRepository;
    private final UserRoleRepository userRoleRepository;
    private final PasswordEncoder passwordEncoder;
    private final RoleRepository roleRepository;
    private final EmailProducer emailProducer;
    private final SecurityUtils securityUtils;

    @Override
    @Transactional
    public UserResponse createUser(CreateUserRequest request) {
        if (userRepository.existsByEmployeeCodeAndIsDeletedFalse(request.getEmployeeCode())) {
            throw new BadRequestException("Employee Code already exists");
        }
        if (userRepository.existsByEmailAndIsDeletedFalse(request.getEmail())) {
            throw new BadRequestException("Email already exists");
        }
        Department department = departmentRepository.findById(request.getDepartmentId())
                .orElseThrow(()-> new EntityNotFoundException("Department not found"));

        String randomPassword = createRandomPassword();
        String encodedPassword = passwordEncoder.encode(randomPassword);

        User user = User.builder()
                .employeeCode(request.getEmployeeCode())
                .email(request.getEmail())
                .password(encodedPassword)
                .name(request.getFullName())
                .department(department)
                .firstLogin(false)
                .status(UserStatus.ACTIVE)
                .build();

        userRepository.save(user);

        for (Long roleId : request.getRoleIds()) {
            Role role = roleRepository.findById(roleId)
                    .orElseThrow(() -> new BadRequestException("Role Not Found"));
            UserRole userRole = UserRole.builder()
                    .user(user)
                    .role(role)
                    .build();
            userRoleRepository.save(userRole);
        }

        emailProducer.sendEmail(
                EmailMessage.builder()
                        .to(user.getEmail())
                        .subject("Account Created")
                        .content("""
                            Employee Code: %s
                            Password: %s
                            """.formatted(user.getEmployeeCode(), randomPassword))
                        .build()
        );

        return UserResponse.builder()
                .employeeCode(request.getEmployeeCode())
                .email(request.getEmail())
                .fullName(request.getFullName())
                .status(UserStatus.ACTIVE)
                .build();
    }

    private String createRandomPassword() {
        String characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%";
        SecureRandom random = new SecureRandom();
        StringBuilder password = new StringBuilder();
        for (int i = 0; i < PASSWORD_LENGTH; i++) {
            int index = random.nextInt(characters.length());
            password.append(characters.charAt(index));
        }
        return password.toString();
    }

    @Override
    public void changePassword(ChangePasswordRequest request) {
        Long userId = securityUtils.getCurrentUserId();
        User user = userRepository.findById(userId)
                .orElseThrow(()-> new EntityNotFoundException("User not found"));

        String oldPassword = request.getOldPassword();
        String newPassword = request.getNewPassword();
        String confirmNewPassword = request.getConfirmNewPassword();

        if(!passwordEncoder.matches(oldPassword, user.getPassword())) {
            throw new BadRequestException("Old Password Do Not Match");
        }
        if(newPassword.equals(oldPassword)) {
            throw new BadRequestException("Password cannot be the same");
        }
        if(!newPassword.equals(confirmNewPassword)) {
            throw new BadRequestException("New Password Do Not Match");
        }

        String encodedPassword = passwordEncoder.encode(newPassword);
        user.setPassword(encodedPassword);
        userRepository.save(user);
    }

    @Override
    public Page<UserSummaryResponse> getUsers(Pageable pageable, UserFilterRequest request) {
        Page<User> users = userRepository.searchUsers(request, pageable);

        return users.map(user -> {
            List<Role> roles = userRoleRepository.findRolesByUserId(user.getId());
            return UserSummaryResponse.builder()
                    .id(user.getId())
                    .employeeCode(user.getEmployeeCode())
                    .departmentId(user.getDepartment().getId())
                    .fullName(user.getName())
                    .status(user.getStatus())
                    .roles(roles)
                    .build();
        });
    }

    @Override
    @Transactional
    public void deleteUser(Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("User not found"));
        user.setDeleted(true);
        userRepository.save(user);
    }

    @Override
    public UserDetailResponse getUserDetails(Long id) {
        User rawUser = userRepository.findById(id)
                .orElseThrow(()-> new EntityNotFoundException("User not found"));
        List<Role> roles = userRoleRepository.findRolesByUserId(rawUser.getId());
        UserDetailResponse userResponse = UserDetailResponse.builder()
                .employeeCode(rawUser.getEmployeeCode())
                .id(rawUser.getId())
                .status(rawUser.getStatus())
                .fullName(rawUser.getName())
                .phone(rawUser.getPhone())
                .createdAt(rawUser.getCreatedAt())
                .departmentName(rawUser.getDepartment().getName())
                .lastLogin(rawUser.getLastLogin())
                .email(rawUser.getEmail())
                .lastChangePassword(rawUser.getLastChangePassword())
                .positionName(rawUser.getPosition().getName())
                .updatedBy(rawUser.getUpdatedBy())
                .roles(roles)
                .build();
        return userResponse;
    }

    public List<UserSummaryResponse> getAllUsersToExport(UserFilterRequest filter){
        return userRepository.getAllUsersToExport(filter).stream()
                .map(
                        user -> {
                            List<Role> roles = userRoleRepository.findRolesByUserId(user.getId());
                            return UserSummaryResponse.builder()
                                    .id(user.getId())
                                    .employeeCode(user.getEmployeeCode())
                                    .departmentId(user.getDepartment().getId())
                                    .fullName(user.getName())
                                    .status(user.getStatus())
                                    .roles(roles)
                                    .build();
                        }
                )
                .toList();
    }

}
