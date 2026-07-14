package vn.vietduc.carehubbackend.questiongeneration.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vn.vietduc.carehubbackend.common.response.ApiResponse;
import vn.vietduc.carehubbackend.exception.BadRequestException;
import vn.vietduc.carehubbackend.exception.ResourceNotFoundException;
import vn.vietduc.carehubbackend.questiongeneration.entity.PromptTemplate;
import vn.vietduc.carehubbackend.questiongeneration.repository.PromptTemplateRepository;

import java.util.List;

@RestController
@RequestMapping("${app.api-prefix}/prompt-templates")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class PromptTemplateController {

    private final PromptTemplateRepository promptTemplateRepository;

    @GetMapping
    public ResponseEntity<ApiResponse<List<PromptTemplate>>> list() {
        return ResponseEntity.ok(ApiResponse.success(
                "Lấy danh sách prompt template thành công",
                promptTemplateRepository.findAllByOrderByUpdatedAtDesc()
        ));
    }

    @GetMapping("/active")
    @PreAuthorize("@evaluationSecurity.canAccess(authentication)")
    public ResponseEntity<ApiResponse<PromptTemplate>> getActive(
            @RequestParam String provider,
            @RequestParam String model) {
        PromptTemplate template = promptTemplateRepository.findByProviderAndModelAndActiveTrue(provider, model)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy prompt template đang hoạt động"));
        return ResponseEntity.ok(ApiResponse.success("Lấy prompt template thành công", template));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<PromptTemplate>> get(@PathVariable Long id) {
        PromptTemplate template = promptTemplateRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy prompt template"));
        return ResponseEntity.ok(ApiResponse.success("Lấy prompt template thành công", template));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<PromptTemplate>> create(@RequestBody PromptTemplate request) {
        if (request.getName() == null || request.getName().isBlank()) {
            throw new BadRequestException("Vui lòng nhập tên prompt template");
        }
        if (request.getProvider() == null || request.getModel() == null) {
            throw new BadRequestException("Vui lòng chọn provider và model");
        }
        // Auto-increment version
        List<PromptTemplate> existing = promptTemplateRepository
                .findByProviderAndModelOrderByVersionDesc(request.getProvider(), request.getModel());
        int nextVersion = existing.isEmpty() ? 1 : existing.get(0).getVersion() + 1;
        request.setVersion(nextVersion);
        PromptTemplate saved = promptTemplateRepository.save(request);
        return ResponseEntity.ok(ApiResponse.success("Tạo prompt template thành công", saved));
    }

    @PutMapping("/{id}/activate")
    public ResponseEntity<ApiResponse<PromptTemplate>> activate(@PathVariable Long id) {
        PromptTemplate template = promptTemplateRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy prompt template"));
        // Deactivate all others for this provider+model
        promptTemplateRepository.findByProviderAndModelOrderByVersionDesc(
                template.getProvider(), template.getModel())
                .forEach(t -> {
                    if (!t.getId().equals(id) && t.isActive()) {
                        t.setActive(false);
                        promptTemplateRepository.save(t);
                    }
                });
        template.setActive(true);
        return ResponseEntity.ok(ApiResponse.success(
                "Kích hoạt prompt template thành công",
                promptTemplateRepository.save(template)
        ));
    }
}
