package vn.vietduc.carehubbackend.user.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vn.vietduc.carehubbackend.common.response.ApiResponse;
import vn.vietduc.carehubbackend.user.dto.request.DepartmentRequest;
import vn.vietduc.carehubbackend.user.dto.request.EducationLevelRequest;
import vn.vietduc.carehubbackend.user.dto.request.PositionRequest;
import vn.vietduc.carehubbackend.user.dto.response.DepartmentResponse;
import vn.vietduc.carehubbackend.user.dto.response.EducationLevelResponse;
import vn.vietduc.carehubbackend.user.dto.response.PositionResponse;
import vn.vietduc.carehubbackend.user.service.ReferenceDataService;

import java.util.List;

@RestController
@RequestMapping("${app.api-prefix}")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class ReferenceDataController {
    private final ReferenceDataService referenceDataService;

    @GetMapping("/departments")
    public ResponseEntity<ApiResponse<List<DepartmentResponse>>> getDepartments() {
        return ResponseEntity.ok(ApiResponse.success("Get departments successfully", referenceDataService.getDepartments()));
    }

    @GetMapping("/departments/{id}")
    public ResponseEntity<ApiResponse<DepartmentResponse>> getDepartment(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success("Get department successfully", referenceDataService.getDepartment(id)));
    }

    @PostMapping("/departments")
    public ResponseEntity<ApiResponse<DepartmentResponse>> createDepartment(@Valid @RequestBody DepartmentRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Create department successfully", referenceDataService.createDepartment(request)));
    }

    @PutMapping("/departments/{id}")
    public ResponseEntity<ApiResponse<DepartmentResponse>> updateDepartment(
            @PathVariable Long id,
            @Valid @RequestBody DepartmentRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success("Update department successfully", referenceDataService.updateDepartment(id, request)));
    }

    @DeleteMapping("/departments/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteDepartment(@PathVariable Long id) {
        referenceDataService.deleteDepartment(id);
        return ResponseEntity.ok(ApiResponse.success("Department deleted successfully", null));
    }

    @GetMapping("/positions")
    public ResponseEntity<ApiResponse<List<PositionResponse>>> getPositions() {
        return ResponseEntity.ok(ApiResponse.success("Get positions successfully", referenceDataService.getPositions()));
    }

    @GetMapping("/positions/{id}")
    public ResponseEntity<ApiResponse<PositionResponse>> getPosition(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success("Get position successfully", referenceDataService.getPosition(id)));
    }

    @PostMapping("/positions")
    public ResponseEntity<ApiResponse<PositionResponse>> createPosition(@Valid @RequestBody PositionRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Create position successfully", referenceDataService.createPosition(request)));
    }

    @PutMapping("/positions/{id}")
    public ResponseEntity<ApiResponse<PositionResponse>> updatePosition(
            @PathVariable Long id,
            @Valid @RequestBody PositionRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success("Update position successfully", referenceDataService.updatePosition(id, request)));
    }

    @DeleteMapping("/positions/{id}")
    public ResponseEntity<ApiResponse<Void>> deletePosition(@PathVariable Long id) {
        referenceDataService.deletePosition(id);
        return ResponseEntity.ok(ApiResponse.success("Position deleted successfully", null));
    }

    @GetMapping("/education-levels")
    public ResponseEntity<ApiResponse<List<EducationLevelResponse>>> getEducationLevels() {
        return ResponseEntity.ok(ApiResponse.success("Get education levels successfully", referenceDataService.getEducationLevels()));
    }

    @GetMapping("/education-levels/{id}")
    public ResponseEntity<ApiResponse<EducationLevelResponse>> getEducationLevel(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success("Get education level successfully", referenceDataService.getEducationLevel(id)));
    }

    @PostMapping("/education-levels")
    public ResponseEntity<ApiResponse<EducationLevelResponse>> createEducationLevel(@Valid @RequestBody EducationLevelRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Create education level successfully", referenceDataService.createEducationLevel(request)));
    }

    @PutMapping("/education-levels/{id}")
    public ResponseEntity<ApiResponse<EducationLevelResponse>> updateEducationLevel(
            @PathVariable Long id,
            @Valid @RequestBody EducationLevelRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success("Update education level successfully", referenceDataService.updateEducationLevel(id, request)));
    }

    @DeleteMapping("/education-levels/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteEducationLevel(@PathVariable Long id) {
        referenceDataService.deleteEducationLevel(id);
        return ResponseEntity.ok(ApiResponse.success("Education level deleted successfully", null));
    }
}
