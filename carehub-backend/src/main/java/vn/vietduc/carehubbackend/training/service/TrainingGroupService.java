package vn.vietduc.carehubbackend.training.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.vietduc.carehubbackend.exception.BadRequestException;
import vn.vietduc.carehubbackend.exception.ResourceNotFoundException;
import vn.vietduc.carehubbackend.training.dto.request.UpsertTrainingGroupRequest;
import vn.vietduc.carehubbackend.training.dto.response.TrainingGroupResponse;
import vn.vietduc.carehubbackend.training.entity.TrainingGroup;
import vn.vietduc.carehubbackend.training.repository.TrainingGroupRepository;
import vn.vietduc.carehubbackend.user.entity.User;
import vn.vietduc.carehubbackend.user.repository.UserRepository;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TrainingGroupService {

    private final TrainingGroupRepository trainingGroupRepository;
    private final UserRepository userRepository;

    public List<TrainingGroupResponse> list(String q) {
        List<TrainingGroup> groups;
        if (q != null && !q.isBlank()) {
            groups = trainingGroupRepository.findAll().stream()
                    .filter(g -> g.getName().toLowerCase().contains(q.toLowerCase()))
                    .collect(Collectors.toList());
        } else {
            groups = trainingGroupRepository.findByActiveTrueOrderByNameAsc();
        }
        return groups.stream().map(this::toResponse).collect(Collectors.toList());
    }

    public TrainingGroupResponse get(Long id) {
        TrainingGroup group = trainingGroupRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy nhóm đào tạo #" + id));
        return toResponse(group);
    }

    @Transactional
    public TrainingGroupResponse create(UpsertTrainingGroupRequest request) {
        if (trainingGroupRepository.findAll().stream()
                .anyMatch(g -> g.getName().equalsIgnoreCase(request.name()))) {
            throw new BadRequestException("Tên nhóm đào tạo đã tồn tại: " + request.name());
        }

        TrainingGroup group = TrainingGroup.builder()
                .name(request.name())
                .description(request.description())
                .active(request.active() != null ? request.active() : true)
                .members(new HashSet<>())
                .build();

        if (request.memberIds() != null && !request.memberIds().isEmpty()) {
            List<User> users = userRepository.findAllById(request.memberIds());
            group.setMembers(new HashSet<>(users));
        }

        return toResponse(trainingGroupRepository.save(group));
    }

    @Transactional
    public TrainingGroupResponse update(Long id, UpsertTrainingGroupRequest request) {
        TrainingGroup group = trainingGroupRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy nhóm đào tạo #" + id));

        // Check name uniqueness excluding self
        if (trainingGroupRepository.findAll().stream()
                .anyMatch(g -> !g.getId().equals(id) && g.getName().equalsIgnoreCase(request.name()))) {
            throw new BadRequestException("Tên nhóm đào tạo đã tồn tại: " + request.name());
        }

        group.setName(request.name());
        group.setDescription(request.description());
        if (request.active() != null) {
            group.setActive(request.active());
        }

        if (request.memberIds() != null) {
            List<User> users = userRepository.findAllById(request.memberIds());
            group.setMembers(new HashSet<>(users));
        }

        return toResponse(trainingGroupRepository.save(group));
    }

    @Transactional
    public void delete(Long id) {
        TrainingGroup group = trainingGroupRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy nhóm đào tạo #" + id));
        group.setActive(false);
        trainingGroupRepository.save(group);
    }

    private TrainingGroupResponse toResponse(TrainingGroup group) {
        List<TrainingGroupResponse.MemberInfo> members = group.getMembers().stream()
                .map(u -> new TrainingGroupResponse.MemberInfo(
                        u.getId(),
                        u.getEmployeeCode(),
                        u.getName(),
                        u.getDepartment() != null ? u.getDepartment().getName() : null
                ))
                .collect(Collectors.toList());

        return new TrainingGroupResponse(
                group.getId(),
                group.getName(),
                group.getDescription(),
                members.size(),
                members,
                group.isActive(),
                group.getCreatedAt(),
                group.getUpdatedAt()
        );
    }
}
