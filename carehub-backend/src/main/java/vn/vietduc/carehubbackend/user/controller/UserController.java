package vn.vietduc.carehubbackend.user.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import vn.vietduc.carehubbackend.common.response.ApiResponse;
import vn.vietduc.carehubbackend.user.dto.request.ChangePasswordRequest;
import vn.vietduc.carehubbackend.user.dto.request.CreateUserRequest;
import vn.vietduc.carehubbackend.user.dto.request.UpdateUserRequest;
import vn.vietduc.carehubbackend.user.dto.request.UserFilterRequest;
import vn.vietduc.carehubbackend.user.dto.response.UserDetailResponse;
import vn.vietduc.carehubbackend.user.dto.response.UserResponse;
import vn.vietduc.carehubbackend.user.dto.response.UserSummaryResponse;
import vn.vietduc.carehubbackend.user.service.UserService;

import java.util.List;

@RestController
@RequestMapping("${app.api-prefix}")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @PostMapping("/users")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<UserResponse>> createUser(@Valid @RequestBody CreateUserRequest request) {
        UserResponse response = userService.createUser(request);
        return ResponseEntity.ok(
                ApiResponse.success("Create User Successfully", response)
        );
    }

    @GetMapping("/me")
    public ResponseEntity<ApiResponse<UserDetailResponse>> getCurrentUserProfile() {
        return ResponseEntity.ok(ApiResponse.success("Get profile successfully", userService.getCurrentUserProfile()));
    }

    @PutMapping("/users/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<UserDetailResponse>> updateUser(
            @PathVariable Long id,
            @Valid @RequestBody UpdateUserRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success("User updated successfully", userService.updateUser(id, request)));
    }

    @DeleteMapping("/user/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Void>> deleteUser(@PathVariable Long id) {
        userService.deleteUser(id);
        return ResponseEntity.ok(ApiResponse.success("User deleted successfully", null));
    }

    @PatchMapping("/users/{id}/lock")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<UserDetailResponse>> lockUser(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success("User locked successfully", userService.lockUser(id)));
    }

    @PatchMapping("/users/{id}/unlock")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<UserDetailResponse>> unlockUser(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success("User unlocked successfully", userService.unlockUser(id)));
    }

    @PostMapping("/users/{userId}/roles/{roleId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<UserDetailResponse>> assignRole(
            @PathVariable Long userId,
            @PathVariable Long roleId
    ) {
        return ResponseEntity.ok(ApiResponse.success("Role assigned successfully", userService.assignRole(userId, roleId)));
    }

    @DeleteMapping("/users/{userId}/roles/{roleId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<UserDetailResponse>> removeRole(
            @PathVariable Long userId,
            @PathVariable Long roleId
    ) {
        return ResponseEntity.ok(ApiResponse.success("Role removed successfully", userService.removeRole(userId, roleId)));
    }

    @PatchMapping("/user/change-password")
    public ResponseEntity<ApiResponse<Void>> changePassword(@RequestBody ChangePasswordRequest request) {
        userService.changePassword(request);
        return ResponseEntity.ok(ApiResponse.success("Password changed successfully", null));
    }

    @GetMapping("/users")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Page<UserSummaryResponse>>> getUsers(
            @ModelAttribute UserFilterRequest filter,
            @PageableDefault(size = 20)
            Pageable pageable
    ) {

        return ResponseEntity.ok(
                ApiResponse.success("Get list users successfully" ,userService.getUsers(pageable, filter))
        );
    }

    @GetMapping("/users/export")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<List<UserSummaryResponse>>> getAllUsersToExport(
            @ModelAttribute UserFilterRequest filter
    ) {

        return ResponseEntity.ok(
                ApiResponse.success("Get list users successfully" ,userService.getAllUsersToExport(filter))
        );
    }

    @GetMapping("/user/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<UserDetailResponse>> getUserById(@PathVariable Long id) {
        UserDetailResponse user = userService.getUserDetails(id);
        return ResponseEntity.ok(ApiResponse.success("Get user successfully", user));
    }
}
