package vn.vietduc.carehubbackend.training.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vn.vietduc.carehubbackend.common.response.ApiResponse;
import vn.vietduc.carehubbackend.common.response.PageResponse;
import vn.vietduc.carehubbackend.training.dto.request.ProfessionalFieldFormRequest;
import vn.vietduc.carehubbackend.training.dto.response.ProfessionalFieldResponse;
import vn.vietduc.carehubbackend.training.service.ProfessionalFieldAdminService;

@RestController
@RequestMapping("${app.api-prefix}/training/professional-fields")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class ProfessionalFieldAdminController {
    private final ProfessionalFieldAdminService service;

    @GetMapping
    public ResponseEntity<ApiResponse<PageResponse<ProfessionalFieldResponse>>> list(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Boolean active,
            @PageableDefault(size = 50) Pageable pageable
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Lấy danh sách lĩnh vực chuyên môn thành công",
                PageResponse.from(service.search(keyword, active, pageable))
        ));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<ProfessionalFieldResponse>> create(
            @Valid @RequestBody ProfessionalFieldFormRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Tạo lĩnh vực chuyên môn thành công",
                service.create(request)
        ));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<ProfessionalFieldResponse>> update(
            @PathVariable Long id,
            @Valid @RequestBody ProfessionalFieldFormRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Cập nhật lĩnh vực chuyên môn thành công",
                service.update(id, request)
        ));
    }
}
