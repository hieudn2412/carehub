package vn.vietduc.carehubbackend.form.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
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
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;
import vn.vietduc.carehubbackend.common.response.ApiResponse;
import vn.vietduc.carehubbackend.common.response.PageResponse;
import vn.vietduc.carehubbackend.form.dto.request.CreateFormRequest;
import vn.vietduc.carehubbackend.form.dto.request.CreateFormVersionRequest;
import vn.vietduc.carehubbackend.form.dto.request.UpdateFormRequest;
import vn.vietduc.carehubbackend.form.dto.response.FormResponse;
import vn.vietduc.carehubbackend.form.dto.response.FormVersionResponse;
import vn.vietduc.carehubbackend.form.dto.response.FormVersionSummaryResponse;
import vn.vietduc.carehubbackend.form.entity.enums.FormStatus;
import vn.vietduc.carehubbackend.form.entity.enums.FormSubjectType;
import vn.vietduc.carehubbackend.form.entity.enums.FormVersionStatus;
import vn.vietduc.carehubbackend.form.service.FormService;
import vn.vietduc.carehubbackend.form.service.FormVersionService;

import java.net.URI;

@RestController
@RequestMapping("${app.api-prefix}/forms")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class FormBuilderController {
    private final FormService formService;
    private final FormVersionService versionService;

    @GetMapping
    public ResponseEntity<ApiResponse<PageResponse<FormResponse>>> listForms(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) FormStatus status,
            @RequestParam(required = false) FormSubjectType subjectType,
            @RequestParam(required = false) Long ownerDepartmentId,
            @PageableDefault(size = 20, sort = "updatedAt", direction = Sort.Direction.DESC)
            Pageable pageable
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Get forms successfully",
                PageResponse.from(formService.search(keyword, status, subjectType, ownerDepartmentId, pageable))
        ));
    }

    @GetMapping("/{formId}")
    public ResponseEntity<ApiResponse<FormResponse>> getForm(@PathVariable Long formId) {
        return ResponseEntity.ok(ApiResponse.success(
                "Get form successfully",
                formService.get(formId)
        ));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<FormResponse>> createForm(
            @Valid @RequestBody CreateFormRequest request
    ) {
        FormResponse created = formService.create(request);
        URI location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(created.id())
                .toUri();
        return ResponseEntity.created(location)
                .body(ApiResponse.success("Create form successfully", created));
    }

    @PutMapping("/{formId}")
    public ResponseEntity<ApiResponse<FormResponse>> updateForm(
            @PathVariable Long formId,
            @Valid @RequestBody UpdateFormRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Update form successfully",
                formService.update(formId, request)
        ));
    }

    @DeleteMapping("/{formId}")
    public ResponseEntity<Void> deleteForm(@PathVariable Long formId) {
        formService.delete(formId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{formId}/versions")
    public ResponseEntity<ApiResponse<PageResponse<FormVersionSummaryResponse>>> listVersions(
            @PathVariable Long formId,
            @RequestParam(required = false) FormVersionStatus status,
            @PageableDefault(size = 20, sort = "versionNumber", direction = Sort.Direction.DESC)
            Pageable pageable
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Get form versions successfully",
                PageResponse.from(versionService.search(formId, status, pageable))
        ));
    }

    @GetMapping("/{formId}/versions/{versionId}")
    public ResponseEntity<ApiResponse<FormVersionResponse>> getVersion(
            @PathVariable Long formId,
            @PathVariable Long versionId
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Get form version successfully",
                versionService.get(formId, versionId)
        ));
    }

    @PostMapping("/{formId}/versions")
    public ResponseEntity<ApiResponse<FormVersionResponse>> createVersion(
            @PathVariable Long formId,
            @Valid @RequestBody CreateFormVersionRequest request
    ) {
        FormVersionResponse created = versionService.create(formId, request);
        URI location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(created.id())
                .toUri();
        return ResponseEntity.created(location)
                .body(ApiResponse.success("Create form version successfully", created));
    }

    @PutMapping("/{formId}/versions/{versionId}")
    public ResponseEntity<ApiResponse<FormVersionResponse>> updateVersion(
            @PathVariable Long formId,
            @PathVariable Long versionId,
            @Valid @RequestBody CreateFormVersionRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Update form version successfully",
                versionService.update(formId, versionId, request)
        ));
    }

    @PostMapping("/{formId}/versions/{versionId}/publication")
    public ResponseEntity<ApiResponse<FormVersionResponse>> publishVersion(
            @PathVariable Long formId,
            @PathVariable Long versionId
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Publish form version successfully",
                versionService.publish(formId, versionId)
        ));
    }

    @DeleteMapping("/{formId}/versions/{versionId}")
    public ResponseEntity<Void> deleteVersion(
            @PathVariable Long formId,
            @PathVariable Long versionId
    ) {
        versionService.delete(formId, versionId);
        return ResponseEntity.noContent().build();
    }
}
