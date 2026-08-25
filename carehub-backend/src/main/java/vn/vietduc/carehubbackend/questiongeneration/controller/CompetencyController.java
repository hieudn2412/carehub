package vn.vietduc.carehubbackend.questiongeneration.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vn.vietduc.carehubbackend.common.response.ApiResponse;
import vn.vietduc.carehubbackend.exception.ResourceNotFoundException;
import vn.vietduc.carehubbackend.exception.ForbiddenException;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.CompetencyByTechniqueResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.CompetencyClassificationResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.CompetencyEmployeeByTechniqueResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.CompetencySummaryResponse;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamAttempt;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ExamAttemptStatus;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamAttemptRepository;
import vn.vietduc.carehubbackend.questiongeneration.service.CompetencyScoring;
import vn.vietduc.carehubbackend.questiongeneration.service.CompetencyService;
import vn.vietduc.carehubbackend.systemsettings.service.SystemSettingsService;
import vn.vietduc.carehubbackend.user.repository.UserRepository;
import vn.vietduc.carehubbackend.utils.SecurityUtils;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;

@RestController
@RequestMapping("${app.api-prefix}/competency")
@RequiredArgsConstructor
public class CompetencyController {

    private final ExamAttemptRepository attemptRepository;
    private final UserRepository userRepository;
    private final CompetencyService competencyService;
    private final SystemSettingsService systemSettingsService;
    private final SecurityUtils securityUtils;

    @GetMapping("/employees/{id}")
    @PreAuthorize("hasRole('MANAGER') or @evaluationSecurity.canViewResults(authentication)")
    public ResponseEntity<ApiResponse<CompetencyClassificationResponse>> getEmployeeClassification(
            @PathVariable Long id,
            Authentication authentication
    ) {
        requireManagerEmployeeScope(id, authentication);
        vn.vietduc.carehubbackend.user.entity.User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy nhân viên"));

        List<ExamAttempt> attempts = attemptRepository.findByUserOrderByStartedAtDesc(user);

        BigDecimal overallScore = null;
        long scoredCount = 0;
        BigDecimal total = BigDecimal.ZERO;
        for (ExamAttempt a : attempts) {
            if (a.getScore() != null && (a.getStatus() == ExamAttemptStatus.GRADED || a.getStatus() == ExamAttemptStatus.SUBMITTED)) {
                total = total.add(a.getScore());
                scoredCount++;
            }
        }
        BigDecimal avgScore = scoredCount > 0
                ? total.divide(BigDecimal.valueOf(scoredCount), 2, RoundingMode.HALF_UP)
                : null;

        BigDecimal targetScore = CompetencyScoring.normalizeTarget(systemSettingsService.competencyTargetScore());

        return ResponseEntity.ok(ApiResponse.success(
                "Lấy kết quả năng lực thành công",
                new CompetencyClassificationResponse(
                        user.getId(),
                        user.getEmployeeCode(),
                        user.getName(),
                        user.getDepartment() != null ? user.getDepartment().getName() : null,
                        avgScore,
                        CompetencyScoring.meetsTarget(avgScore, targetScore),
                        (int) scoredCount,
                        attempts.isEmpty() ? null : attempts.get(0).getStartedAt(),
                        List.of()
                )
        ));
    }

    @GetMapping({"/by-technique", "/compliance"})
    @PreAuthorize("hasRole('MANAGER') or @evaluationSecurity.canViewResults(authentication)")
    public ResponseEntity<ApiResponse<CompetencyByTechniqueResponse>> getByTechnique(
            @RequestParam(required = false) Long departmentId,
            @RequestParam(required = false) Long formId,
            @RequestParam(required = false) LocalDate fromDate,
            @RequestParam(required = false) LocalDate toDate,
            @RequestParam(required = false) String keyword,
            @PageableDefault(size = 10) Pageable pageable,
            Authentication authentication) {
        requireManagerDepartmentScope(departmentId, authentication);
        CompetencyByTechniqueResponse data = competencyService.getByTechnique(
                departmentId, formId, fromDate, toDate, keyword, pageable
        );
        return ResponseEntity.ok(ApiResponse.success("Lấy tuân thủ kỹ thuật thành công", data));
    }

    @GetMapping({"/employees/{employeeId}/by-technique", "/compliance/{employeeId}"})
    @PreAuthorize("hasRole('MANAGER') or @evaluationSecurity.canViewResults(authentication)")
    public ResponseEntity<ApiResponse<CompetencyEmployeeByTechniqueResponse>> getEmployeeByTechnique(
            @PathVariable Long employeeId,
            @RequestParam(required = false) LocalDate fromDate,
            @RequestParam(required = false) LocalDate toDate,
            Authentication authentication) {
        requireManagerEmployeeScope(employeeId, authentication);
        CompetencyEmployeeByTechniqueResponse data = competencyService.getEmployeeByTechnique(
                employeeId, fromDate, toDate);
        return ResponseEntity.ok(ApiResponse.success("Lấy tuân thủ kỹ thuật cá nhân thành công", data));
    }

    @GetMapping("/summary")
    @PreAuthorize("hasAnyRole('MANAGER','ADMIN') or @evaluationSecurity.canViewResults(authentication)")
    public ResponseEntity<ApiResponse<CompetencySummaryResponse>> getSummary(
            @RequestParam(required = false) Long departmentId,
            @RequestParam(required = false) LocalDate fromDate,
            @RequestParam(required = false) LocalDate toDate,
            @RequestParam(required = false) String keyword,
            @PageableDefault(size = 10) Pageable pageable,
            Authentication authentication) {
        requireManagerDepartmentScope(departmentId, authentication);
        CompetencySummaryResponse data = competencyService.getSummary(
                departmentId, fromDate, toDate, keyword, pageable
        );
        return ResponseEntity.ok(ApiResponse.success("Lấy tổng hợp năng lực thành công", data));
    }

    private void requireManagerDepartmentScope(Long departmentId, Authentication authentication) {
        boolean admin = hasAuthority(authentication, "ROLE_ADMIN", "ADMIN");
        boolean manager = hasAuthority(authentication, "ROLE_MANAGER", "MANAGER");
        if (departmentId == null) {
            if (!admin) {
                throw new ForbiddenException("Chỉ Admin được xem dữ liệu năng lực toàn viện");
            }
            return;
        }
        if (!manager || admin) {
            return;
        }
        vn.vietduc.carehubbackend.user.entity.User actor = userRepository.findById(securityUtils.getCurrentUserId())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy người dùng"));
        if (actor.getDepartment() == null || !departmentId.equals(actor.getDepartment().getId())) {
            throw new ForbiddenException("Manager chỉ được xem dữ liệu của khoa mình");
        }
    }

    private void requireManagerEmployeeScope(Long employeeId, Authentication authentication) {
        boolean admin = hasAuthority(authentication, "ROLE_ADMIN", "ADMIN");
        boolean manager = hasAuthority(authentication, "ROLE_MANAGER", "MANAGER");
        if (!manager || admin) {
            return;
        }
        vn.vietduc.carehubbackend.user.entity.User employee =
                userRepository.findByIdAndIsDeletedFalse(employeeId)
                        .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy nhân viên"));
        if (employee.getDepartment() == null) {
            throw new ForbiddenException("Manager chỉ được xem nhân viên thuộc khoa mình");
        }
        requireManagerDepartmentScope(employee.getDepartment().getId(), authentication);
    }

    private boolean hasAuthority(Authentication authentication, String... authorities) {
        List<String> expected = Arrays.asList(authorities);
        return authentication != null && authentication.getAuthorities().stream()
                .anyMatch(authority -> expected.contains(authority.getAuthority()));
    }
}
