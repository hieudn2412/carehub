package vn.vietduc.carehubbackend.user.service.impl;

import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.vietduc.carehubbackend.exception.BadRequestException;
import vn.vietduc.carehubbackend.exception.ConflictException;
import vn.vietduc.carehubbackend.user.dto.request.DepartmentRequest;
import vn.vietduc.carehubbackend.user.dto.request.EducationLevelRequest;
import vn.vietduc.carehubbackend.user.dto.request.PositionRequest;
import vn.vietduc.carehubbackend.user.dto.response.DepartmentResponse;
import vn.vietduc.carehubbackend.user.dto.response.EducationLevelResponse;
import vn.vietduc.carehubbackend.user.dto.response.PositionResponse;
import vn.vietduc.carehubbackend.user.entity.Department;
import vn.vietduc.carehubbackend.user.entity.EducationLevel;
import vn.vietduc.carehubbackend.user.entity.Position;
import vn.vietduc.carehubbackend.user.repository.DepartmentRepository;
import vn.vietduc.carehubbackend.user.repository.EducationLevelRepository;
import vn.vietduc.carehubbackend.user.repository.PositionRepository;
import vn.vietduc.carehubbackend.user.repository.UserRepository;
import vn.vietduc.carehubbackend.user.service.ReferenceDataService;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ReferenceDataServiceImpl implements ReferenceDataService {
    private final DepartmentRepository departmentRepository;
    private final PositionRepository positionRepository;
    private final EducationLevelRepository educationLevelRepository;
    private final UserRepository userRepository;

    @Override
    @Transactional(readOnly = true)
    public List<DepartmentResponse> getDepartments() {
        return departmentRepository.findAll().stream()
                .map(DepartmentResponse::from)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public DepartmentResponse getDepartment(Long id) {
        return DepartmentResponse.from(findDepartment(id));
    }

    @Override
    @Transactional
    public DepartmentResponse createDepartment(DepartmentRequest request) {
        if (departmentRepository.existsByDepartmentCode(request.getDepartmentCode())) {
            throw new ConflictException("Mã phòng ban đã tồn tại");
        }

        Department department = Department.builder()
                .departmentCode(request.getDepartmentCode().trim())
                .name(request.getName().trim())
                .build();

        return DepartmentResponse.from(departmentRepository.save(department));
    }

    @Override
    @Transactional
    public DepartmentResponse updateDepartment(Long id, DepartmentRequest request) {
        Department department = findDepartment(id);
        if (departmentRepository.existsByDepartmentCodeAndIdNot(request.getDepartmentCode(), id)) {
            throw new ConflictException("Mã phòng ban đã tồn tại");
        }

        department.setDepartmentCode(request.getDepartmentCode().trim());
        department.setName(request.getName().trim());
        return DepartmentResponse.from(departmentRepository.save(department));
    }

    @Override
    @Transactional
    public void deleteDepartment(Long id) {
        Department department = findDepartment(id);
        if (userRepository.existsByDepartment_IdAndIsDeletedFalse(id)) {
            throw new BadRequestException("Cannot delete department assigned to users");
        }
        departmentRepository.delete(department);
    }

    @Override
    @Transactional(readOnly = true)
    public List<PositionResponse> getPositions() {
        return positionRepository.findAll().stream()
                .map(PositionResponse::from)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public PositionResponse getPosition(Long id) {
        return PositionResponse.from(findPosition(id));
    }

    @Override
    @Transactional
    public PositionResponse createPosition(PositionRequest request) {
        if (positionRepository.existsByName(request.getName())) {
            throw new ConflictException("Position name already exists");
        }

        Position position = Position.builder()
                .name(request.getName().trim())
                .build();

        return PositionResponse.from(positionRepository.save(position));
    }

    @Override
    @Transactional
    public PositionResponse updatePosition(Long id, PositionRequest request) {
        Position position = findPosition(id);
        if (positionRepository.existsByNameAndIdNot(request.getName(), id)) {
            throw new ConflictException("Position name already exists");
        }

        position.setName(request.getName().trim());
        return PositionResponse.from(positionRepository.save(position));
    }

    @Override
    @Transactional
    public void deletePosition(Long id) {
        Position position = findPosition(id);
        if (userRepository.existsByPosition_IdAndIsDeletedFalse(id)) {
            throw new BadRequestException("Cannot delete position assigned to users");
        }
        positionRepository.delete(position);
    }

    @Override
    @Transactional(readOnly = true)
    public List<EducationLevelResponse> getEducationLevels() {
        return educationLevelRepository.findAll().stream()
                .map(EducationLevelResponse::from)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public EducationLevelResponse getEducationLevel(Long id) {
        return EducationLevelResponse.from(findEducationLevel(id));
    }

    @Override
    @Transactional
    public EducationLevelResponse createEducationLevel(EducationLevelRequest request) {
        if (educationLevelRepository.existsByEducationCode(request.getEducationCode())) {
            throw new ConflictException("Education code already exists");
        }

        EducationLevel educationLevel = EducationLevel.builder()
                .educationCode(request.getEducationCode().trim())
                .name(request.getName().trim())
                .build();

        return EducationLevelResponse.from(educationLevelRepository.save(educationLevel));
    }

    @Override
    @Transactional
    public EducationLevelResponse updateEducationLevel(Long id, EducationLevelRequest request) {
        EducationLevel educationLevel = findEducationLevel(id);
        if (educationLevelRepository.existsByEducationCodeAndIdNot(request.getEducationCode(), id)) {
            throw new ConflictException("Education code already exists");
        }

        educationLevel.setEducationCode(request.getEducationCode().trim());
        educationLevel.setName(request.getName().trim());
        return EducationLevelResponse.from(educationLevelRepository.save(educationLevel));
    }

    @Override
    @Transactional
    public void deleteEducationLevel(Long id) {
        EducationLevel educationLevel = findEducationLevel(id);
        if (userRepository.existsByEducationLevel_IdAndIsDeletedFalse(id)) {
            throw new BadRequestException("Cannot delete education level assigned to users");
        }
        educationLevelRepository.delete(educationLevel);
    }

    private Department findDepartment(Long id) {
        return departmentRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Department not found"));
    }

    private Position findPosition(Long id) {
        return positionRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Position not found"));
    }

    private EducationLevel findEducationLevel(Long id) {
        return educationLevelRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Không tìm thấy trình độ học vấn"));
    }
}
