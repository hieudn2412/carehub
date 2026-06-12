package vn.vietduc.carehubbackend.user.service;

import vn.vietduc.carehubbackend.user.dto.request.ChangePasswordRequest;
import vn.vietduc.carehubbackend.user.dto.request.CreateUserRequest;
import vn.vietduc.carehubbackend.user.dto.response.UserDetailResponse;
import vn.vietduc.carehubbackend.user.dto.response.UserResponse;
import vn.vietduc.carehubbackend.user.dto.response.UserSummaryResponse;

import java.util.List;
import java.util.Optional;

public interface UserService {
    UserResponse createUser(CreateUserRequest request);
    void deleteUser(Long id);
    void changePassword(ChangePasswordRequest request);
    List<UserSummaryResponse> getAllUsers();
    UserDetailResponse getUserDetails(Long id);
}
