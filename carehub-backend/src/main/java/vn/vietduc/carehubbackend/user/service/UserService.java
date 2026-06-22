package vn.vietduc.carehubbackend.user.service;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import vn.vietduc.carehubbackend.user.dto.request.ChangePasswordRequest;
import vn.vietduc.carehubbackend.user.dto.request.CreateUserRequest;
import vn.vietduc.carehubbackend.user.dto.request.UpdateUserRequest;
import vn.vietduc.carehubbackend.user.dto.request.UserFilterRequest;
import vn.vietduc.carehubbackend.user.dto.response.UserDetailResponse;
import vn.vietduc.carehubbackend.user.dto.response.UserResponse;
import vn.vietduc.carehubbackend.user.dto.response.UserSummaryResponse;

import java.util.List;
import java.util.Optional;

public interface UserService {
    UserResponse createUser(CreateUserRequest request);
    UserDetailResponse updateUser(Long id, UpdateUserRequest request);
    void deleteUser(Long id);
    UserDetailResponse lockUser(Long id);
    UserDetailResponse unlockUser(Long id);
    UserDetailResponse assignRole(Long userId, Long roleId);
    UserDetailResponse removeRole(Long userId, Long roleId);
    void changePassword(ChangePasswordRequest request);
    UserDetailResponse getCurrentUserProfile();
    Page<UserSummaryResponse> getUsers(Pageable pageable, UserFilterRequest request);
    UserDetailResponse getUserDetails(Long id);

    String resetUserPassword(Long id);
    List<UserSummaryResponse> getAllUsersToExport(UserFilterRequest filter);
}
