package vn.vietduc.carehubbackend.user.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vn.vietduc.carehubbackend.common.response.ApiResponse;
import vn.vietduc.carehubbackend.user.dto.request.CompleteFirstLoginRequest;
import vn.vietduc.carehubbackend.user.dto.request.SendEmailVerificationRequest;
import vn.vietduc.carehubbackend.user.service.FirstLoginService;

@RestController
@RequestMapping("${app.api-prefix}/user/first-login")
@RequiredArgsConstructor
public class FirstLoginController {

    private final FirstLoginService firstLoginService;

    @PostMapping("/send-email-otp")
    public ResponseEntity<ApiResponse<Void>> sendEmailVerificationOtp(
            @Valid @RequestBody SendEmailVerificationRequest request
    ) {
        firstLoginService.sendEmailVerificationOtp(request);
        return ResponseEntity.ok(ApiResponse.success("OTP sent", null));
    }

    @PostMapping("/complete")
    public ResponseEntity<ApiResponse<Void>> completeFirstLoginSetup(
            @Valid @RequestBody CompleteFirstLoginRequest request
    ) {
        firstLoginService.completeFirstLoginSetup(request);
        return ResponseEntity.ok(ApiResponse.success("First login setup completed", null));
    }
}
