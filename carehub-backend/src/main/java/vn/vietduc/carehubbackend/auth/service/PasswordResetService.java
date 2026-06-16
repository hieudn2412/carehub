package vn.vietduc.carehubbackend.auth.service;

import vn.vietduc.carehubbackend.auth.dto.request.ForgotPasswordRequest;
import vn.vietduc.carehubbackend.auth.dto.request.ResetPasswordRequest;

public interface PasswordResetService {
    public void forgotPassword(ForgotPasswordRequest request);
    public void resetPassword(ResetPasswordRequest resetPasswordRequest);
}
