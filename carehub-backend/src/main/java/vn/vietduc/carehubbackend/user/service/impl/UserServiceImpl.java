package vn.vietduc.carehubbackend.user.service.impl;

import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.vietduc.carehubbackend.exception.BadRequestException;
import vn.vietduc.carehubbackend.notification.EmailMessage;
import vn.vietduc.carehubbackend.notification.EmailProducer;
import vn.vietduc.carehubbackend.user.dto.request.ChangePasswordRequest;
import vn.vietduc.carehubbackend.user.dto.request.CreateUserRequest;
import vn.vietduc.carehubbackend.user.dto.response.UserResponse;
import vn.vietduc.carehubbackend.user.entity.*;
import vn.vietduc.carehubbackend.user.repository.RoleRepository;
import vn.vietduc.carehubbackend.user.repository.UserRepository;
import vn.vietduc.carehubbackend.user.repository.UserRoleRepository;
import vn.vietduc.carehubbackend.user.service.UserService;
import vn.vietduc.carehubbackend.utils.SecurityUtils;

import java.security.SecureRandom;

@Service
@RequiredArgsConstructor
public class UserServiceImpl implements UserService {
    private static final int PASSWORD_LENGTH = 12;

    private final UserRepository userRepository;
    private final UserRoleRepository userRoleRepository;
    private final PasswordEncoder passwordEncoder;
    private final RoleRepository roleRepository;
    private final EmailProducer emailProducer;
    private final SecurityUtils securityUtils;

    @Override
    @Transactional
    public UserResponse createUser(CreateUserRequest request) {
        if (userRepository.existsByEmployeeCode(request.getEmployeeCode())) {
            throw new BadRequestException("Employee Code already exists");
        }
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new BadRequestException("Email already exists");
        }

        String randomPassword = createRandomPassword();
        String encodedPassword = passwordEncoder.encode(randomPassword);

        User user = User.builder()
                .employeeCode(request.getEmployeeCode())
                .email(request.getEmail())
                .password(encodedPassword)
                .name(request.getFullName())
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
    @Transactional
    public void deleteUser(Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("User not found"));
        userRoleRepository.deleteByUser(user);
        userRepository.delete(user);
    }
}
