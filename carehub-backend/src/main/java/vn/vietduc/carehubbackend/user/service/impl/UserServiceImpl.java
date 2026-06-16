package vn.vietduc.carehubbackend.user.service.impl;

import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.vietduc.carehubbackend.exception.BadRequestException;
import vn.vietduc.carehubbackend.exception.ConflictException;
import vn.vietduc.carehubbackend.notification.messaging.EmailMessage;
import vn.vietduc.carehubbackend.notification.messaging.EmailProducer;
import vn.vietduc.carehubbackend.user.dto.request.ChangePasswordRequest;
import vn.vietduc.carehubbackend.user.dto.request.CreateUserRequest;
import vn.vietduc.carehubbackend.user.dto.request.UpdateUserRequest;
import vn.vietduc.carehubbackend.user.dto.request.UserFilterRequest;
import vn.vietduc.carehubbackend.user.dto.response.UserDetailResponse;
import vn.vietduc.carehubbackend.user.dto.response.UserResponse;
import vn.vietduc.carehubbackend.user.dto.response.UserSummaryResponse;
import vn.vietduc.carehubbackend.user.entity.*;
import vn.vietduc.carehubbackend.user.repository.DepartmentRepository;
import vn.vietduc.carehubbackend.user.repository.EducationLevelRepository;
import vn.vietduc.carehubbackend.user.repository.PositionRepository;
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
    private final PositionRepository positionRepository;
    private final EducationLevelRepository educationLevelRepository;
    private final UserRoleRepository userRoleRepository;
    private final PasswordEncoder passwordEncoder;
    private final RoleRepository roleRepository;
    private final EmailProducer emailProducer;
    private final SecurityUtils securityUtils;

    @Override
    @Transactional
    public UserResponse createUser(CreateUserRequest request) {
        if (userRepository.existsByEmployeeCodeAndIsDeletedFalse(request.getEmployeeCode())) {
            throw new ConflictException("Employee Code already exists");
        }
        if (userRepository.existsByEmailAndIsDeletedFalse(request.getEmail())) {
            throw new ConflictException("Email already exists");
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

    @Override
    @Transactional
    public UserDetailResponse updateUser(Long id, UpdateUserRequest request) {
        User user = findUser(id);

        if (request.getEmployeeCode() != null) {
            validateText(request.getEmployeeCode(), "Employee code");
            if (userRepository.existsByEmployeeCodeAndIsDeletedFalseAndIdNot(request.getEmployeeCode(), id)) {
                throw new ConflictException("Employee Code already exists");
            }
            user.setEmployeeCode(request.getEmployeeCode().trim());
        }

        if (request.getEmail() != null) {
            validateText(request.getEmail(), "Email");
            if (userRepository.existsByEmailAndIsDeletedFalseAndIdNot(request.getEmail(), id)) {
                throw new ConflictException("Email already exists");
            }
            user.setEmail(request.getEmail().trim());
        }

        if (request.getFullName() != null) {
            validateText(request.getFullName(), "Full name");
            user.setName(request.getFullName().trim());
        }

        if (request.getPhone() != null) {
            user.setPhone(request.getPhone().isBlank() ? null : request.getPhone().trim());
        }

        if (request.getDepartmentId() != null) {
            Department department = departmentRepository.findById(request.getDepartmentId())
                    .orElseThrow(() -> new EntityNotFoundException("Department not found"));
            user.setDepartment(department);
        }

        if (request.getPositionId() != null) {
            Position position = positionRepository.findById(request.getPositionId())
                    .orElseThrow(() -> new EntityNotFoundException("Position not found"));
            user.setPosition(position);
        }

        if (request.getEducationLevelId() != null) {
            EducationLevel educationLevel = educationLevelRepository.findById(request.getEducationLevelId())
                    .orElseThrow(() -> new EntityNotFoundException("Education level not found"));
            user.setEducationLevel(educationLevel);
        }

        if (request.getBirthday() != null) {
            user.setBirthday(request.getBirthday());
        }

        if (request.getGender() != null) {
            user.setGender(request.getGender());
        }

        if (request.getStatus() != null) {
            user.setStatus(request.getStatus());
        }

        return toDetailResponse(userRepository.save(user));
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
                    .departmentId(user.getDepartment() == null ? null : user.getDepartment().getId())
                    .fullName(user.getName())
                    .status(user.getStatus())
                    .roles(roles)
                    .build();
        });
    }

    @Override
    @Transactional
    public void deleteUser(Long id) {
        User user = findUser(id);
        user.setDeleted(true);
        userRepository.save(user);
    }

    @Override
    @Transactional
    public UserDetailResponse lockUser(Long id) {
        User user = findUser(id);
        user.setStatus(UserStatus.LOCKED);
        return toDetailResponse(userRepository.save(user));
    }

    @Override
    @Transactional
    public UserDetailResponse unlockUser(Long id) {
        User user = findUser(id);
        user.setStatus(UserStatus.ACTIVE);
        return toDetailResponse(userRepository.save(user));
    }

    @Override
    @Transactional
    public UserDetailResponse assignRole(Long userId, Long roleId) {
        User user = findUser(userId);
        Role role = roleRepository.findById(roleId)
                .orElseThrow(() -> new EntityNotFoundException("Role not found"));

        if (userRoleRepository.existsByUser_IdAndRole_Id(userId, roleId)) {
            throw new ConflictException("Role already assigned to user");
        }

        userRoleRepository.save(UserRole.builder()
                .user(user)
                .role(role)
                .build());

        return toDetailResponse(user);
    }

    @Override
    @Transactional
    public UserDetailResponse removeRole(Long userId, Long roleId) {
        User user = findUser(userId);
        roleRepository.findById(roleId)
                .orElseThrow(() -> new EntityNotFoundException("Role not found"));

        if (!userRoleRepository.existsByUser_IdAndRole_Id(userId, roleId)) {
            throw new EntityNotFoundException("User role not found");
        }

        userRoleRepository.deleteByUser_IdAndRole_Id(userId, roleId);
        return toDetailResponse(user);
    }

    @Override
    public UserDetailResponse getCurrentUserProfile() {
        return toDetailResponse(findUser(securityUtils.getCurrentUserId()));
    }

    @Override
    public UserDetailResponse getUserDetails(Long id) {
        return toDetailResponse(findUser(id));
    }

    public List<UserSummaryResponse> getAllUsersToExport(UserFilterRequest filter){
        return userRepository.getAllUsersToExport(filter).stream()
                .map(
                        user -> {
                            List<Role> roles = userRoleRepository.findRolesByUserId(user.getId());
                            return UserSummaryResponse.builder()
                                    .id(user.getId())
                                    .employeeCode(user.getEmployeeCode())
                                    .departmentId(user.getDepartment() == null ? null : user.getDepartment().getId())
                                    .fullName(user.getName())
                                    .status(user.getStatus())
                                    .roles(roles)
                                    .build();
                        }
                )
                .toList();
    }

    private User findUser(Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("User not found"));
        if (user.isDeleted()) {
            throw new EntityNotFoundException("User not found");
        }
        return user;
    }

    private UserDetailResponse toDetailResponse(User user) {
        List<Role> roles = userRoleRepository.findRolesByUserId(user.getId());
        return UserDetailResponse.builder()
                .employeeCode(user.getEmployeeCode())
                .id(user.getId())
                .status(user.getStatus())
                .fullName(user.getName())
                .phone(user.getPhone())
                .createdAt(user.getCreatedAt())
                .departmentName(user.getDepartment() == null ? null : user.getDepartment().getName())
                .lastLogin(user.getLastLogin())
                .email(user.getEmail())
                .lastChangePassword(user.getLastChangePassword())
                .positionName(user.getPosition() == null ? null : user.getPosition().getName())
                .updatedBy(user.getUpdatedBy())
                .roles(roles)
                .build();
    }

    private void validateText(String value, String fieldName) {
        if (value == null || value.isBlank()) {
            throw new BadRequestException(fieldName + " is required");
        }
    }

}
