package vn.vietduc.carehubbackend.questiongeneration.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vn.vietduc.carehubbackend.common.response.ApiResponse;
import vn.vietduc.carehubbackend.exception.ResourceNotFoundException;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.MyCompetencyKnowledgeResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.MyCompetencySkillResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.MyCompetencySummaryResponse;
import vn.vietduc.carehubbackend.questiongeneration.service.MyCompetencyService;
import vn.vietduc.carehubbackend.user.entity.User;
import vn.vietduc.carehubbackend.user.repository.UserRepository;
import vn.vietduc.carehubbackend.utils.SecurityUtils;

import java.time.LocalDate;

@RestController
@RequestMapping("${app.api-prefix}/me/competency")
@RequiredArgsConstructor
public class MyCompetencyController {

    private final MyCompetencyService myCompetencyService;
    private final UserRepository userRepository;
    private final SecurityUtils securityUtils;

    @GetMapping("/knowledge")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<MyCompetencyKnowledgeResponse>> getMyKnowledgeCompetency(
            @RequestParam(required = false) LocalDate fromDate,
            @RequestParam(required = false) LocalDate toDate) {
        User user = getCurrentUser();
        MyCompetencyKnowledgeResponse data = myCompetencyService.getKnowledgeCompetency(user, fromDate, toDate);
        return ResponseEntity.ok(ApiResponse.success(
                "Lấy dữ liệu năng lực kiến thức thành công", data));
    }

    @GetMapping("/skills")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<MyCompetencySkillResponse>> getMySkillCompetency(
            @RequestParam(required = false) LocalDate fromDate,
            @RequestParam(required = false) LocalDate toDate) {
        User user = getCurrentUser();
        MyCompetencySkillResponse data = myCompetencyService.getSkillCompetency(user, fromDate, toDate);
        return ResponseEntity.ok(ApiResponse.success(
                "Lấy dữ liệu năng lực kỹ năng thành công", data));
    }

    @GetMapping("/summary")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<MyCompetencySummaryResponse>> getMyCompetencySummary(
            @RequestParam(required = false) LocalDate fromDate,
            @RequestParam(required = false) LocalDate toDate) {
        User user = getCurrentUser();
        MyCompetencySummaryResponse data = myCompetencyService.getCompetencySummary(user, fromDate, toDate);
        return ResponseEntity.ok(ApiResponse.success(
                "Lấy tổng hợp năng lực thành công", data));
    }

    private User getCurrentUser() {
        Long userId = securityUtils.getCurrentUserId();
        return userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy người dùng"));
    }
}
