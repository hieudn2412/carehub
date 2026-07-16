package vn.vietduc.carehubbackend.questiongeneration.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vn.vietduc.carehubbackend.common.response.ApiResponse;
import vn.vietduc.carehubbackend.exception.ResourceNotFoundException;
import vn.vietduc.carehubbackend.questiongeneration.dto.request.SaveCompetencyThresholdsRequest;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.CompetencyByFieldResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.CompetencyByTechniqueResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.CompetencyClassificationResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.CompetencyEmployeeByFieldResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.CompetencyEmployeeByTechniqueResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.CompetencyLevelCountResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.CompetencySummaryResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.DepartmentCompetencyResponse;
import vn.vietduc.carehubbackend.questiongeneration.entity.CompetencyThresholdConfig;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamAttempt;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionCategory;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.CompetencyLevel;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ExamAttemptStatus;
import vn.vietduc.carehubbackend.questiongeneration.repository.CompetencyThresholdConfigRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamAttemptRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.QuestionCategoryRepository;
import vn.vietduc.carehubbackend.questiongeneration.service.CompetencyClassificationService;
import vn.vietduc.carehubbackend.questiongeneration.service.CompetencyService;
import vn.vietduc.carehubbackend.questiongeneration.service.QuestionGenerationLabels;
import vn.vietduc.carehubbackend.user.entity.Department;
import vn.vietduc.carehubbackend.user.repository.DepartmentRepository;
import vn.vietduc.carehubbackend.user.repository.UserRepository;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("${app.api-prefix}/competency")
@RequiredArgsConstructor
public class CompetencyController {

    private final ExamAttemptRepository attemptRepository;
    private final UserRepository userRepository;
    private final DepartmentRepository departmentRepository;
    private final CompetencyClassificationService classificationService;
    private final CompetencyThresholdConfigRepository thresholdRepository;
    private final QuestionCategoryRepository categoryRepository;
    private final CompetencyService competencyService;

    @GetMapping("/employees/{id}")
    @PreAuthorize("@evaluationSecurity.canViewResults(authentication)")
    public ResponseEntity<ApiResponse<CompetencyClassificationResponse>> getEmployeeClassification(@PathVariable Long id) {
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

        CompetencyLevel overallLevel = avgScore != null ? classificationService.classifyOverall(avgScore) : null;

        return ResponseEntity.ok(ApiResponse.success(
                "Lấy phân loại năng lực thành công",
                new CompetencyClassificationResponse(
                        user.getId(),
                        user.getEmployeeCode(),
                        user.getName(),
                        user.getDepartment() != null ? user.getDepartment().getName() : null,
                        overallLevel != null ? overallLevel.name() : null,
                        overallLevel != null ? QuestionGenerationLabels.competencyLevel(overallLevel) : null,
                        overallLevel != null ? QuestionGenerationLabels.competencyLevelColor(overallLevel) : null,
                        avgScore,
                        (int) scoredCount,
                        attempts.isEmpty() ? null : attempts.get(0).getStartedAt(),
                        List.of()
                )
        ));
    }

    @GetMapping("/departments/{id}")
    @PreAuthorize("@evaluationSecurity.canViewResults(authentication)")
    public ResponseEntity<ApiResponse<DepartmentCompetencyResponse>> getDepartmentClassification(@PathVariable Long id) {
        Department department = departmentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy khoa/phòng"));

        List<vn.vietduc.carehubbackend.user.entity.User> users =
                userRepository.findByDepartment_IdInAndIsDeletedFalse(java.util.Set.of(id));

        List<CompetencyClassificationResponse> employees = new ArrayList<>();
        Map<CompetencyLevel, Long> levelCounts = new LinkedHashMap<>();
        for (CompetencyLevel l : CompetencyLevel.values()) {
            levelCounts.put(l, 0L);
        }

        for (vn.vietduc.carehubbackend.user.entity.User user : users) {
            List<ExamAttempt> userAttempts = attemptRepository.findByUserOrderByStartedAtDesc(user);

            BigDecimal total = BigDecimal.ZERO;
            long scoredCount = 0;
            for (ExamAttempt a : userAttempts) {
                if (a.getScore() != null && (a.getStatus() == ExamAttemptStatus.GRADED || a.getStatus() == ExamAttemptStatus.SUBMITTED)) {
                    total = total.add(a.getScore());
                    scoredCount++;
                }
            }
            BigDecimal avgScore = scoredCount > 0
                    ? total.divide(BigDecimal.valueOf(scoredCount), 2, RoundingMode.HALF_UP)
                    : null;

            CompetencyLevel level = avgScore != null ? classificationService.classifyOverall(avgScore) : null;

            if (level != null) {
                levelCounts.merge(level, 1L, Long::sum);
            }

            employees.add(new CompetencyClassificationResponse(
                    user.getId(),
                    user.getEmployeeCode(),
                    user.getName(),
                    user.getDepartment() != null ? user.getDepartment().getName() : null,
                    level != null ? level.name() : null,
                    level != null ? QuestionGenerationLabels.competencyLevel(level) : null,
                    level != null ? QuestionGenerationLabels.competencyLevelColor(level) : null,
                    avgScore,
                    (int) scoredCount,
                    userAttempts.isEmpty() ? null : userAttempts.get(0).getStartedAt(),
                    List.of()
            ));
        }

        List<CompetencyLevelCountResponse> distribution = levelCounts.entrySet().stream()
                .map(e -> new CompetencyLevelCountResponse(
                        e.getKey().name(),
                        QuestionGenerationLabels.competencyLevel(e.getKey()),
                        QuestionGenerationLabels.competencyLevelColor(e.getKey()),
                        e.getValue()
                ))
                .toList();

        return ResponseEntity.ok(ApiResponse.success(
                "Lấy phân loại năng lực theo khoa thành công",
                new DepartmentCompetencyResponse(
                        department.getId(),
                        department.getName(),
                        users.size(),
                        (int) employees.stream().filter(e -> e.overallLevel() != null).count(),
                        distribution,
                        employees
                )
        ));
    }

    @GetMapping("/by-field")
    @PreAuthorize("@evaluationSecurity.canViewResults(authentication)")
    public ResponseEntity<ApiResponse<CompetencyByFieldResponse>> getByField(
            @RequestParam Long departmentId,
            @RequestParam(required = false) Long categoryId,
            @RequestParam(required = false) LocalDate fromDate,
            @RequestParam(required = false) LocalDate toDate) {
        CompetencyByFieldResponse data = competencyService.getByField(departmentId, categoryId, fromDate, toDate);
        return ResponseEntity.ok(ApiResponse.success("Lấy năng lực theo lĩnh vực thành công", data));
    }

    @GetMapping("/employees/{employeeId}/by-field")
    @PreAuthorize("@evaluationSecurity.canViewResults(authentication)")
    public ResponseEntity<ApiResponse<CompetencyEmployeeByFieldResponse>> getEmployeeByField(
            @PathVariable Long employeeId,
            @RequestParam(required = false) LocalDate fromDate,
            @RequestParam(required = false) LocalDate toDate) {
        CompetencyEmployeeByFieldResponse data = competencyService.getEmployeeByField(employeeId, fromDate, toDate);
        return ResponseEntity.ok(ApiResponse.success("Lấy năng lực cá nhân theo lĩnh vực thành công", data));
    }

    @GetMapping("/by-technique")
    @PreAuthorize("@evaluationSecurity.canViewResults(authentication)")
    public ResponseEntity<ApiResponse<CompetencyByTechniqueResponse>> getByTechnique(
            @RequestParam Long departmentId,
            @RequestParam(required = false) Long formId,
            @RequestParam(required = false) LocalDate fromDate,
            @RequestParam(required = false) LocalDate toDate) {
        CompetencyByTechniqueResponse data = competencyService.getByTechnique(departmentId, formId, fromDate, toDate);
        return ResponseEntity.ok(ApiResponse.success("Lấy tuân thủ kỹ thuật thành công", data));
    }

    @GetMapping("/employees/{employeeId}/by-technique")
    @PreAuthorize("@evaluationSecurity.canViewResults(authentication)")
    public ResponseEntity<ApiResponse<CompetencyEmployeeByTechniqueResponse>> getEmployeeByTechnique(
            @PathVariable Long employeeId,
            @RequestParam(required = false) LocalDate fromDate,
            @RequestParam(required = false) LocalDate toDate) {
        CompetencyEmployeeByTechniqueResponse data = competencyService.getEmployeeByTechnique(employeeId, fromDate, toDate);
        return ResponseEntity.ok(ApiResponse.success("Lấy tuân thủ kỹ thuật cá nhân thành công", data));
    }

    @GetMapping("/summary")
    @PreAuthorize("@evaluationSecurity.canViewResults(authentication)")
    public ResponseEntity<ApiResponse<CompetencySummaryResponse>> getSummary(
            @RequestParam Long departmentId,
            @RequestParam(required = false) LocalDate fromDate,
            @RequestParam(required = false) LocalDate toDate) {
        CompetencySummaryResponse data = competencyService.getSummary(departmentId, fromDate, toDate);
        return ResponseEntity.ok(ApiResponse.success("Lấy tổng hợp năng lực thành công", data));
    }

    @GetMapping("/thresholds")
    @PreAuthorize("@evaluationSecurity.canViewResults(authentication)")
    public ResponseEntity<ApiResponse<List<CompetencyThresholdConfig>>> getThresholds() {
        return ResponseEntity.ok(ApiResponse.success(
                "Lấy cấu hình ngưỡng thành công",
                classificationService.getGlobalThresholds()
        ));
    }

    @PutMapping("/thresholds")
    @PreAuthorize("@evaluationSecurity.canManageAssignment(authentication)")
    public ResponseEntity<ApiResponse<List<CompetencyThresholdConfig>>> updateThresholds(
            @RequestBody SaveCompetencyThresholdsRequest request) {
        List<CompetencyThresholdConfig> thresholds = request.thresholds().stream()
                .map(entry -> {
                    CompetencyThresholdConfig config = new CompetencyThresholdConfig();
                    config.setCompetencyLevel(CompetencyLevel.valueOf(entry.competencyLevel().toUpperCase(Locale.ROOT)));
                    config.setMinScore(entry.minScore());
                    config.setMaxScore(entry.maxScore());
                    config.setLabel(entry.label());
                    config.setColorHex(entry.colorHex());
                    config.setSortOrder(entry.sortOrder());
                    return config;
                })
                .collect(Collectors.toList());

        List<CompetencyThresholdConfig> saved;
        if (request.categoryId() != null) {
            QuestionCategory category = categoryRepository.findById(request.categoryId())
                    .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy danh mục"));
            saved = classificationService.saveThresholdsForCategory(category, thresholds);
        } else {
            saved = classificationService.saveGlobalThresholds(thresholds);
        }

        return ResponseEntity.ok(ApiResponse.success(
                "Cập nhật cấu hình ngưỡng thành công",
                saved
        ));
    }
}
