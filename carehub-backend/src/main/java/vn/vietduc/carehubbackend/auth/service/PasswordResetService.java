package vn.vietduc.carehubbackend.auth.service;

import vn.vietduc.carehubbackend.auth.dto.request.ForgotPasswordRequest;
import vn.vietduc.carehubbackend.auth.dto.request.ResetPasswordRequest;
import vn.vietduc.carehubbackend.auth.dto.request.VerifyOtpRequest;

public interface PasswordResetService {
    public void forgotPassword(ForgotPasswordRequest request);
    public void verifyResetOtp(VerifyOtpRequest request);
    public void resetPassword(ResetPasswordRequest resetPasswordRequest);
}
