package vn.vietduc.carehubbackend.user.service.impl;

import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.vietduc.carehubbackend.auth.service.RefreshTokenService;
import vn.vietduc.carehubbackend.exception.BadRequestException;
import vn.vietduc.carehubbackend.exception.ConflictException;
import vn.vietduc.carehubbackend.notification.messaging.EmailMessage;
import vn.vietduc.carehubbackend.notification.messaging.EmailProducer;
import vn.vietduc.carehubbackend.notification.service.BrandedEmailRenderer;
import vn.vietduc.carehubbackend.user.dto.request.ChangePasswordRequest;
import vn.vietduc.carehubbackend.user.dto.request.CreateUserRequest;
import vn.vietduc.carehubbackend.user.dto.request.UpdateUserRequest;
import vn.vietduc.carehubbackend.user.dto.request.UpdateMyProfileRequest;
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
    private static final int PASSWORD_LENGTH = 6;

    private final UserRepository userRepository;
    private final DepartmentRepository departmentRepository;
    private final PositionRepository positionRepository;
    private final EducationLevelRepository educationLevelRepository;
    private final UserRoleRepository userRoleRepository;
    private final PasswordEncoder passwordEncoder;
    private final RoleRepository roleRepository;
    private final EmailProducer emailProducer;
    private final SecurityUtils securityUtils;
    private final BrandedEmailRenderer emailRenderer;
    private final RefreshTokenService refreshTokenService;

    @Override
    @Transactional
    public UserResponse createUser(CreateUserRequest request) {
        String employeeCode = request.getEmployeeCode().trim();
        String email = request.getEmail().trim();
        if (userRepository.existsByEmployeeCode(employeeCode)) {
            throw new ConflictException("Mã nhân viên đã tồn tại hoặc thuộc tài khoản đã ngừng sử dụng. Vui lòng khôi phục tài khoản cũ nếu cần");
        }
        if (userRepository.existsByEmail(email)) {
            throw new ConflictException("Email này đã được sử dụng hoặc thuộc tài khoản đã ngừng sử dụng");
        }
        Department department = departmentRepository.findById(request.getDepartmentId())
                .orElseThrow(()-> new EntityNotFoundException("Không tìm thấy phòng ban"));

        String randomPassword = createRandomPassword();
        String encodedPassword = passwordEncoder.encode(randomPassword);

        User user = User.builder()
                .employeeCode(employeeCode)
                .email(email)
                .password(encodedPassword)
                .name(request.getFullName().trim())
                .phone(request.getPhone() == null || request.getPhone().isBlank()
                        ? null
                        : request.getPhone().trim())
                .department(department)
                .firstLogin(false)
                .status(UserStatus.ACTIVE)
                .build();

        userRepository.save(user);

        for (Long roleId : request.getRoleIds()) {
            Role role = roleRepository.findById(roleId)
                    .orElseThrow(() -> new BadRequestException("Không tìm thấy vai trò"));
            UserRole userRole = UserRole.builder()
                    .user(user)
                    .role(role)
                    .build();
            userRoleRepository.save(userRole);
        }

        var renderedEmail = emailRenderer.accountCreated(
                user.getName(),
                user.getEmployeeCode(),
                randomPassword
        );
        emailProducer.sendEmail(
                EmailMessage.builder()
                        .to(user.getEmail())
                        .subject(renderedEmail.subject())
                        .content(renderedEmail.plainText())
                        .htmlContent(renderedEmail.htmlContent())
                        .build()
        );

        return UserResponse.builder()
                .employeeCode(employeeCode)
                .email(email)
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
            String employeeCode = request.getEmployeeCode().trim();
            if (!employeeCode.equals(user.getEmployeeCode())) {
                throw new BadRequestException("Mã nhân viên là định danh cố định và không thể thay đổi");
            }
            if (userRepository.existsByEmployeeCodeAndIdNot(employeeCode, id)) {
                throw new ConflictException("Mã nhân viên đã tồn tại hoặc thuộc tài khoản đã ngừng sử dụng. Vui lòng khôi phục tài khoản cũ nếu cần");
            }
            user.setEmployeeCode(employeeCode);
        }

        if (request.getEmail() != null) {
            validateText(request.getEmail(), "Email");
            String email = request.getEmail().trim();
            if (userRepository.existsByEmailAndIdNot(email, id)) {
                throw new ConflictException("Email này đã được sử dụng hoặc thuộc tài khoản đã ngừng sử dụng");
            }
            user.setEmail(email);
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
                    .orElseThrow(() -> new EntityNotFoundException("Không tìm thấy phòng ban"));
            user.setDepartment(department);
        }

        if (request.getPositionId() != null) {
            Position position = positionRepository.findById(request.getPositionId())
                    .orElseThrow(() -> new EntityNotFoundException("Không tìm thấy chức danh"));
            user.setPosition(position);
        }

        if (request.getEducationLevelId() != null) {
            EducationLevel educationLevel = educationLevelRepository.findById(request.getEducationLevelId())
                    .orElseThrow(() -> new EntityNotFoundException("Không tìm thấy trình độ học vấn"));
            user.setEducationLevel(educationLevel);
        }

        if (request.getBirthday() != null) {
            user.setBirthday(request.getBirthday());
        }

        if (request.getGender() != null) {
            user.setGender(request.getGender());
        }

        if (request.getStatus() != null) {
            if (user.getStatus() != request.getStatus()) {
                invalidateUserSessions(user);
            }
            user.setStatus(request.getStatus());
        }

        return toDetailResponse(userRepository.save(user));
    }

    private String createRandomPassword() {
        String characters = "0123456789";
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
                .orElseThrow(()-> new EntityNotFoundException("Không tìm thấy người dùng"));

        String oldPassword = request.getOldPassword();
        String newPassword = request.getNewPassword();
        String confirmNewPassword = request.getConfirmNewPassword();

        if(!passwordEncoder.matches(oldPassword, user.getPassword())) {
            throw new BadRequestException("Mật khẩu cũ không chính xác");
        }
        if(newPassword.equals(oldPassword)) {
            throw new BadRequestException("Mật khẩu mới không được trùng với mật khẩu cũ");
        }
        if(!newPassword.equals(confirmNewPassword)) {
            throw new BadRequestException("Mật khẩu xác nhận không khớp");
        }

        String encodedPassword = passwordEncoder.encode(newPassword);
        user.setPassword(encodedPassword);
        user.setLastChangePassword(java.time.LocalDateTime.now());
        invalidateUserSessions(user);
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
                    .departmentName(user.getDepartment() == null ? null : user.getDepartment().getName())
                    .positionName(user.getPosition() == null ? null : user.getPosition().getName())
                    .educationLevelName(user.getEducationLevel() == null ? null : user.getEducationLevel().getName())
                    .gender(user.isGender())
                    .birthday(user.getBirthday())
                    .fullName(user.getName())
                    .status(user.getStatus())
                    .deleted(user.isDeleted())
                    .roles(roles)
                    .build();
        });
    }

    @Override
    @Transactional
    public void deleteUser(Long id) {
        User user = findUser(id);
        user.setDeleted(true);
        invalidateUserSessions(user);
        userRepository.save(user);
    }

    @Override
    @Transactional
    public UserDetailResponse restoreUser(Long id) {
        User user = findUserIncludingDeleted(id);
        if (!user.isDeleted()) {
            return toDetailResponse(user);
        }
        user.setDeleted(false);
        user.setStatus(UserStatus.ACTIVE);
        invalidateUserSessions(user);
        return toDetailResponse(userRepository.save(user));
    }

    @Override
    @Transactional
    public UserDetailResponse lockUser(Long id) {
        User user = findUser(id);
        if (user.getStatus() != UserStatus.LOCKED) {
            invalidateUserSessions(user);
        }
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
    public String resetUserPassword(Long id) {
        User user = findUser(id);
        String randomPassword = createRandomPassword();
        user.setPassword(passwordEncoder.encode(randomPassword));
        user.setLastChangePassword(java.time.LocalDateTime.now());
        invalidateUserSessions(user);
        userRepository.save(user);
        return randomPassword;
    }

    @Override
    @Transactional
    public UserDetailResponse assignRole(Long userId, Long roleId) {
        User user = findUser(userId);
        Role role = roleRepository.findById(roleId)
                .orElseThrow(() -> new EntityNotFoundException("Không tìm thấy vai trò"));

        if (userRoleRepository.existsByUser_IdAndRole_Id(userId, roleId)) {
            throw new ConflictException("Role already assigned to user");
        }

        userRoleRepository.save(UserRole.builder()
                .user(user)
                .role(role)
                .build());

        invalidateUserSessions(user);
        userRepository.save(user);
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
        invalidateUserSessions(user);
        userRepository.save(user);
        return toDetailResponse(user);
    }

    @Override
    public UserDetailResponse getCurrentUserProfile() {
        return toDetailResponse(findUser(securityUtils.getCurrentUserId()));
    }

    @Override
    @Transactional
    public UserDetailResponse updateCurrentUserProfile(UpdateMyProfileRequest request) {
        User user = findUser(securityUtils.getCurrentUserId());
        String email = normalizeOptionalText(request.email());
        if (email != null && userRepository.existsByEmailAndIdNot(email, user.getId())) {
            throw new ConflictException("Email này đã được sử dụng hoặc thuộc tài khoản đã ngừng sử dụng");
        }

        user.setName(request.fullName().trim());
        user.setEmail(email);
        user.setPhone(normalizeOptionalText(request.phone()));
        user.setBirthday(request.birthday());
        if (request.gender() != null) {
            user.setGender(request.gender());
        }
        return toDetailResponse(userRepository.save(user));
    }

    @Override
    public UserDetailResponse getUserDetails(Long id) {
        return toDetailResponse(findUserIncludingDeleted(id));
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
                                    .departmentName(user.getDepartment() == null ? null : user.getDepartment().getName())
                                    .positionName(user.getPosition() == null ? null : user.getPosition().getName())
                                    .educationLevelName(user.getEducationLevel() == null ? null : user.getEducationLevel().getName())
                                    .gender(user.isGender())
                                    .birthday(user.getBirthday())
                                    .fullName(user.getName())
                                    .status(user.getStatus())
                                    .deleted(user.isDeleted())
                                    .roles(roles)
                                    .build();
                        }
                )
                .toList();
    }

    private User findUser(Long id) {
        User user = findUserIncludingDeleted(id);
        if (user.isDeleted()) {
            throw new EntityNotFoundException("User not found");
        }
        return user;
    }

    private User findUserIncludingDeleted(Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("User not found"));
        return user;
    }

    private UserDetailResponse toDetailResponse(User user) {
        List<Role> roles = userRoleRepository.findRolesByUserId(user.getId());
        return UserDetailResponse.builder()
                .employeeCode(user.getEmployeeCode())
                .id(user.getId())
                .status(user.getStatus())
                .deleted(user.isDeleted())
                .fullName(user.getName())
                .phone(user.getPhone())
                .createdAt(user.getCreatedAt())
                .departmentName(user.getDepartment() == null ? null : user.getDepartment().getName())
                .departmentId(user.getDepartment() == null ? null : user.getDepartment().getId())
                .lastLogin(user.getLastLogin())
                .email(user.getEmail())
                .lastChangePassword(user.getLastChangePassword())
                .positionName(user.getPosition() == null ? null : user.getPosition().getName())
                .positionId(user.getPosition() == null ? null : user.getPosition().getId())
                .educationLevelId(user.getEducationLevel() == null ? null : user.getEducationLevel().getId())
                .educationLevelName(user.getEducationLevel() == null ? null : user.getEducationLevel().getName())
                .birthday(user.getBirthday())
                .gender(user.isGender())
                .updatedBy(user.getUpdatedBy())
                .roles(roles)
                .build();
    }

    private void validateText(String value, String fieldName) {
        if (value == null || value.isBlank()) {
            throw new BadRequestException(fieldName + " là bắt buộc");
        }
    }

    private void invalidateUserSessions(User user) {
        user.bumpAuthVersion();
        refreshTokenService.revokeAllUserTokens(user);
    }

    private String normalizeOptionalText(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

}
