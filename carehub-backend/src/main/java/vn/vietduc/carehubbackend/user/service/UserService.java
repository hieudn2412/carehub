package vn.vietduc.carehubbackend.user.service;

import vn.vietduc.carehubbackend.user.dto.request.ChangePasswordRequest;
import vn.vietduc.carehubbackend.user.dto.request.CreateUserRequest;
import vn.vietduc.carehubbackend.user.dto.response.UserResponse;

public interface UserService {
    UserResponse createUser(CreateUserRequest request);
    void deleteUser(Long id);
    void changePassword(ChangePasswordRequest request);
}
