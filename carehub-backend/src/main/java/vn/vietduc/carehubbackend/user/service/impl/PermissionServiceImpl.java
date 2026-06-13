package vn.vietduc.carehubbackend.user.service.impl;

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import vn.vietduc.carehubbackend.exception.BadRequestException;
import vn.vietduc.carehubbackend.exception.ResourceNotFoundException;
import vn.vietduc.carehubbackend.user.dto.request.CreateUpdatePermissionRequest;
import vn.vietduc.carehubbackend.user.dto.response.PermissionResponse;
import vn.vietduc.carehubbackend.user.entity.Permission;
import vn.vietduc.carehubbackend.user.mapper.PermissionMapper;
import vn.vietduc.carehubbackend.user.repository.PermissionRepository;
import vn.vietduc.carehubbackend.user.repository.RolePermissionRepository;
import vn.vietduc.carehubbackend.user.service.PermissionService;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PermissionServiceImpl implements PermissionService {

    private final PermissionRepository permissionRepository;
    private final RolePermissionRepository rolePermissionRepository;
    private final PermissionMapper permissionMapper;

    @Override
    public PermissionResponse getPermissionById(Long permissionId) {
        Permission permission = permissionRepository.findById(permissionId)
                .orElseThrow(() -> new ResourceNotFoundException("Permission not found"));
        return permissionMapper.toResponse(permission);
    }

    @Override
    public List<PermissionResponse> getAllPermissions() {
        return permissionMapper.toResponseList(permissionRepository.findAll());
    }

    @Override
    public List<PermissionResponse> getAllPermissionsByRoleId(Long roleId) {
        return permissionMapper.toResponseList(rolePermissionRepository.findPermissionsByRoleId(roleId));
    }

    @Override
    public PermissionResponse getPermissionByName(String permissionName) {
        Permission permission = permissionRepository.findByName(permissionName)
                .orElseThrow(() -> new ResourceNotFoundException("Permission not found"));
        return permissionMapper.toResponse(permission);
    }

    @Override
    public PermissionResponse createPermission(CreateUpdatePermissionRequest request) {
        if (permissionRepository.existsByName(request.getName())) {
            throw new BadRequestException("Permission already exists");
        }
        Permission newPermission = Permission.builder()
                .code(request.getCode())
                .name(request.getName())
                .build();
        return permissionMapper.toResponse(permissionRepository.save(newPermission));
    }

    @Override
    @Transactional
    public List<PermissionResponse> createPermissions(List<CreateUpdatePermissionRequest> requests) {
        Set<String> requestedCodes = requests.stream()
                .map(CreateUpdatePermissionRequest::getCode)
                .collect(Collectors.toSet());

        if (requestedCodes.size() != requests.size()) {
            throw new BadRequestException("Duplicate permission code in request");
        }

        List<Permission> existingPermissions = permissionRepository.findByCodeIn(requestedCodes);

        if (!existingPermissions.isEmpty()) {
            String existingCodes = existingPermissions.stream()
                    .map(Permission::getCode)
                    .collect(Collectors.joining(", "));

            throw new BadRequestException("Permissions already exist: " + existingCodes);
        }

        List<Permission> permissions = requests.stream()
                .map(req -> Permission.builder()
                        .code(req.getCode())
                        .name(req.getName())
                        .build())
                .toList();

        return permissionMapper.toResponseList(permissionRepository.saveAll(permissions));
    }

    @Override
    public PermissionResponse updatePermission(Long id, CreateUpdatePermissionRequest request) {
        Permission permission = permissionRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Permission not found"));
        permission.setName(request.getName());
        permission.setCode(request.getCode());
        return permissionMapper.toResponse(permissionRepository.save(permission));
    }
}
