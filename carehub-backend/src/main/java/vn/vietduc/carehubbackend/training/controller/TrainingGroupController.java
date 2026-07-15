package vn.vietduc.carehubbackend.training.controller;

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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vn.vietduc.carehubbackend.common.response.ApiResponse;
import vn.vietduc.carehubbackend.training.dto.request.UpsertTrainingGroupRequest;
import vn.vietduc.carehubbackend.training.dto.response.TrainingGroupResponse;
import vn.vietduc.carehubbackend.training.service.TrainingGroupService;

import java.util.List;

@RestController
@RequestMapping("${app.api-prefix}/training-groups")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
public class TrainingGroupController {

    private final TrainingGroupService trainingGroupService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<TrainingGroupResponse>>> list(
            @RequestParam(required = false) String q
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Lấy danh sách nhóm đào tạo thành công",
                trainingGroupService.list(q)
        ));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<TrainingGroupResponse>> get(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(
                "Lấy chi tiết nhóm đào tạo thành công",
                trainingGroupService.get(id)
        ));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<TrainingGroupResponse>> create(
            @Valid @RequestBody UpsertTrainingGroupRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Tạo nhóm đào tạo thành công",
                trainingGroupService.create(request)
        ));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<TrainingGroupResponse>> update(
            @PathVariable Long id,
            @Valid @RequestBody UpsertTrainingGroupRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Cập nhật nhóm đào tạo thành công",
                trainingGroupService.update(id, request)
        ));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable Long id) {
        trainingGroupService.delete(id);
        return ResponseEntity.ok(ApiResponse.success(
                "Đã vô hiệu hóa nhóm đào tạo",
                null
        ));
    }
}
