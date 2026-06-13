package vn.vietduc.carehubbackend.user.service;

import vn.vietduc.carehubbackend.user.dto.request.CompleteFirstLoginRequest;
import vn.vietduc.carehubbackend.user.dto.request.SendEmailVerificationRequest;

public interface FirstLoginService {
    void sendEmailVerificationOtp(SendEmailVerificationRequest request);

    void completeFirstLoginSetup(CompleteFirstLoginRequest request);
}
