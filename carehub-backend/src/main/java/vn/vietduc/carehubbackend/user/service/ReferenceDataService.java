package vn.vietduc.carehubbackend.user.service;

import vn.vietduc.carehubbackend.user.dto.request.DepartmentRequest;
import vn.vietduc.carehubbackend.user.dto.request.EducationLevelRequest;
import vn.vietduc.carehubbackend.user.dto.request.PositionRequest;
import vn.vietduc.carehubbackend.user.dto.response.DepartmentResponse;
import vn.vietduc.carehubbackend.user.dto.response.EducationLevelResponse;
import vn.vietduc.carehubbackend.user.dto.response.PositionResponse;

import java.util.List;

public interface ReferenceDataService {
    List<DepartmentResponse> getDepartments();
    DepartmentResponse getDepartment(Long id);
    DepartmentResponse createDepartment(DepartmentRequest request);
    DepartmentResponse updateDepartment(Long id, DepartmentRequest request);
    void deleteDepartment(Long id);

    List<PositionResponse> getPositions();
    PositionResponse getPosition(Long id);
    PositionResponse createPosition(PositionRequest request);
    PositionResponse updatePosition(Long id, PositionRequest request);
    void deletePosition(Long id);

    List<EducationLevelResponse> getEducationLevels();
    EducationLevelResponse getEducationLevel(Long id);
    EducationLevelResponse createEducationLevel(EducationLevelRequest request);
    EducationLevelResponse updateEducationLevel(Long id, EducationLevelRequest request);
    void deleteEducationLevel(Long id);
}
