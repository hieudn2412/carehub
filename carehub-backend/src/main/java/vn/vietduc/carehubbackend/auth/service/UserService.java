package vn.vietduc.carehubbackend.auth.service;

import vn.vietduc.carehubbackend.auth.dto.response.AdminUserSummaryResponse;
import vn.vietduc.carehubbackend.auth.dto.response.UserProfileResponse;

import java.util.List;

public interface UserService {
    UserProfileResponse findByEmail(String email);
    boolean existsByEmail(String email);
    List<AdminUserSummaryResponse> findAll();
}
