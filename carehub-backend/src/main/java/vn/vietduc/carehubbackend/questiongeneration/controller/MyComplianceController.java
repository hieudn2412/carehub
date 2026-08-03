package vn.vietduc.carehubbackend.questiongeneration.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import vn.vietduc.carehubbackend.common.response.ApiResponse;
import vn.vietduc.carehubbackend.exception.ResourceNotFoundException;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.MyCompetencySkillResponse;
import vn.vietduc.carehubbackend.questiongeneration.service.MyCompetencyService;
import vn.vietduc.carehubbackend.user.repository.UserRepository;
import vn.vietduc.carehubbackend.utils.SecurityUtils;

import java.time.LocalDate;

@RestController
@RequestMapping("${app.api-prefix}/me/compliance")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class MyComplianceController {
    private final MyCompetencyService service;
    private final UserRepository userRepository;
    private final SecurityUtils securityUtils;

    @GetMapping
    public ResponseEntity<ApiResponse<MyCompetencySkillResponse>> get(
            @RequestParam(required = false) LocalDate fromDate,
            @RequestParam(required = false) LocalDate toDate) {
        var user = userRepository.findById(securityUtils.getCurrentUserId())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy người dùng"));
        return ResponseEntity.ok(ApiResponse.success("Lấy tỷ lệ tuân thủ cá nhân thành công",
                service.getSkillCompetency(user, fromDate, toDate)));
    }

    @GetMapping("/overview")
    public ResponseEntity<ApiResponse<vn.vietduc.carehubbackend.questiongeneration.dto.response.MyComplianceOverviewResponse>> overview(
            @RequestParam(required = false) LocalDate fromDate,
            @RequestParam(required = false) LocalDate toDate) {
        var user = userRepository.findById(securityUtils.getCurrentUserId())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy người dùng"));
        return ResponseEntity.ok(ApiResponse.success("Lấy tổng quan tuân thủ cá nhân thành công",
                service.getComplianceOverview(user, fromDate, toDate)));
    }

    @GetMapping("/chart")
    public ResponseEntity<ApiResponse<vn.vietduc.carehubbackend.questiongeneration.dto.response.MyComplianceChartResponse>> chart(
            @RequestParam(required = false) Integer year) {
        if (year != null && (year < LocalDate.MIN.getYear() || year > LocalDate.MAX.getYear())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Năm không hợp lệ");
        }
        var user = userRepository.findById(securityUtils.getCurrentUserId())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy người dùng"));
        return ResponseEntity.ok(ApiResponse.success("Lấy biểu đồ tuân thủ cá nhân thành công",
                service.getComplianceChart(user, year)));
    }
}
