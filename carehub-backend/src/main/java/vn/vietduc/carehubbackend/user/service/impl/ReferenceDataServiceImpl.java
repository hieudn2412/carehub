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
import java.util.Map;
import java.util.stream.Collectors;

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
        Map<Long, Long> employeeCounts = userRepository.countActiveEmployeesByDepartment().stream()
                .collect(Collectors.toMap(
                        UserRepository.DepartmentEmployeeCount::getDepartmentId,
                        UserRepository.DepartmentEmployeeCount::getEmployeeCount
                ));
        return departmentRepository.findAll().stream()
                .map(department -> DepartmentResponse.from(
                        department,
                        employeeCounts.getOrDefault(department.getId(), 0L)
                ))
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public DepartmentResponse getDepartment(Long id) {
        Department department = findDepartment(id);
        long employeeCount = userRepository.countByDepartment_IdAndIsDeletedFalseAndStatus(
                id,
                vn.vietduc.carehubbackend.user.entity.UserStatus.ACTIVE
        );
        return DepartmentResponse.from(department, employeeCount);
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

        return DepartmentResponse.from(departmentRepository.save(department), 0L);
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
        Department savedDepartment = departmentRepository.save(department);
        long employeeCount = userRepository.countByDepartment_IdAndIsDeletedFalseAndStatus(
                id,
                vn.vietduc.carehubbackend.user.entity.UserStatus.ACTIVE
        );
        return DepartmentResponse.from(savedDepartment, employeeCount);
    }

    @Override
    @Transactional
    public void deleteDepartment(Long id) {
        Department department = findDepartment(id);
        if (userRepository.existsByDepartment_IdAndIsDeletedFalse(id)) {
            throw new BadRequestException("Không thể xóa phòng ban đang có nhân viên");
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
            throw new ConflictException("Tên chức vụ đã tồn tại");
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
            throw new ConflictException("Tên chức vụ đã tồn tại");
        }

        position.setName(request.getName().trim());
        return PositionResponse.from(positionRepository.save(position));
    }

    @Override
    @Transactional
    public void deletePosition(Long id) {
        Position position = findPosition(id);
        if (userRepository.existsByPosition_IdAndIsDeletedFalse(id)) {
            throw new BadRequestException("Không thể xóa chức vụ đang được gán cho nhân viên");
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
            throw new ConflictException("Mã trình độ học vấn đã tồn tại");
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
            throw new ConflictException("Mã trình độ học vấn đã tồn tại");
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
            throw new BadRequestException("Không thể xóa trình độ học vấn đang được gán cho nhân viên");
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
