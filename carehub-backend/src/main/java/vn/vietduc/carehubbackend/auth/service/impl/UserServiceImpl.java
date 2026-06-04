package vn.vietduc.carehubbackend.auth.service.impl;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import vn.vietduc.carehubbackend.auth.dto.response.AdminUserSummaryResponse;
import vn.vietduc.carehubbackend.auth.dto.response.UserProfileResponse;
import vn.vietduc.carehubbackend.auth.repository.UserRepository;
import vn.vietduc.carehubbackend.auth.service.UserService;
import vn.vietduc.carehubbackend.auth.service.mapper.AdminUserMapper;
import vn.vietduc.carehubbackend.exception.BadRequestException;
import vn.vietduc.carehubbackend.user.entity.User;

import java.util.List;

@Service
@RequiredArgsConstructor
public class UserServiceImpl implements UserService {
    private final UserRepository userRepository;
    private final AdminUserMapper adminUserMapper;

    @Override
    public UserProfileResponse findByEmail(String email) {
        User user = userRepository.findByEmail(email).orElseThrow(() -> new BadRequestException("User not found"));
        return UserProfileResponse.builder()
                .email(user.getEmail())
                .id(user.getId())
                .fullName(user.getName())
                .role(user.getRole())
                .build();
    }

    @Override
    public List<AdminUserSummaryResponse> findAll() {
        return adminUserMapper.toDto(userRepository.findAll());
    }

    @Override
    public boolean existsByEmail(String email) {
        return userRepository.existsByEmail(email);
    }
}
