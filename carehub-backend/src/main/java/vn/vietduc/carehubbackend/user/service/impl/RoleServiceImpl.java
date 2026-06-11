package vn.vietduc.carehubbackend.user.service.impl;

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import vn.vietduc.carehubbackend.exception.BadRequestException;
import vn.vietduc.carehubbackend.exception.ResourceNotFoundException;
import vn.vietduc.carehubbackend.user.dto.request.CreateRoleRequest;
import vn.vietduc.carehubbackend.user.dto.response.RoleResponse;
import vn.vietduc.carehubbackend.user.entity.Role;
import vn.vietduc.carehubbackend.user.mapper.RoleMapper;
import vn.vietduc.carehubbackend.user.repository.RolePermissionRepository;
import vn.vietduc.carehubbackend.user.repository.RoleRepository;
import vn.vietduc.carehubbackend.user.repository.UserRoleRepository;
import vn.vietduc.carehubbackend.user.service.RoleService;

import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class RoleServiceImpl implements RoleService {
    private final RoleRepository roleRepository;
    private final UserRoleRepository userRoleRepository;
    private final RolePermissionRepository rolePermissionRepository;
    private final RoleMapper roleMapper;

    @Override
    public Optional<Role> findById(Long roleId) {
        return roleRepository.findById(roleId);
    }

    @Override
    @Transactional
    public List<RoleResponse> createRoles(List<CreateRoleRequest> requests) {
        Set<String> requestedCodes = requests.stream()
                .map(CreateRoleRequest::getCode)
                .collect(Collectors.toSet());

        if (requestedCodes.size() != requests.size()) {
            throw new BadRequestException("Duplicate role code in request");
        }

        List<Role> existingRoles = roleRepository.findByCodeIn(requestedCodes);

        if (!existingRoles.isEmpty()) {
            String existingCodes = existingRoles.stream()
                    .map(Role::getCode)
                    .collect(Collectors.joining(", "));

            throw new BadRequestException("Roles already exist: " + existingCodes);
        }

        List<Role> roles = requests.stream()
                .map(req -> Role.builder()
                        .code(req.getCode())
                        .name(req.getName())
                        .build())
                .toList();

        return roleMapper.toResponseList(roleRepository.saveAll(roles));
    }

    @Override
    public List<RoleResponse> getAllRoles() {
        return roleMapper.toResponseList(roleRepository.findAll());
    }

    @Override
    @Transactional
    public void deleteRoleById(Long roleId) {
        roleRepository.findById(roleId)
                .orElseThrow(() -> new ResourceNotFoundException("Role not found"));

        if (userRoleRepository.existsByRole_Id(roleId)) {
            throw new BadRequestException("Cannot delete role assigned to users");
        }

        rolePermissionRepository.deleteByRole_Id(roleId);
        roleRepository.deleteById(roleId);
    }
}
