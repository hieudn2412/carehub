package vn.vietduc.carehubbackend.notification.service;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import org.springframework.mail.MailPreparationException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vn.vietduc.carehubbackend.notification.config.MailProperties;

import java.io.UnsupportedEncodingException;
import java.nio.charset.StandardCharsets;

@Service
@RequiredArgsConstructor
public class EmailService {

    private final JavaMailSender mailSender;
    private final MailProperties properties;
    private final BrandedEmailRenderer renderer;

    public void send(String to, String subject, String plainContent) {
        send(to, subject, plainContent, null);
    }

    public void send(String to, String subject, String plainContent, String htmlContent) {
        MimeMessage message = mailSender.createMimeMessage();
        try {
            MimeMessageHelper helper = new MimeMessageHelper(
                    message,
                    MimeMessageHelper.MULTIPART_MODE_MIXED_RELATED,
                    StandardCharsets.UTF_8.name()
            );
            helper.setFrom(properties.getFrom(), properties.getFromName());
            helper.setTo(to);
            helper.setSubject(subject);
            if (StringUtils.hasText(properties.getReplyTo())) {
                helper.setReplyTo(properties.getReplyTo());
            }
            String effectiveHtml = StringUtils.hasText(htmlContent)
                    ? htmlContent
                    : renderer.renderGeneric(subject, plainContent);
            helper.setText(plainContent == null ? "" : plainContent, effectiveHtml);

            message.setHeader("Auto-Submitted", "auto-generated");
            message.setHeader("X-Auto-Response-Suppress", "All");
            message.setHeader("Content-Language", "vi-VN");
        } catch (MessagingException | UnsupportedEncodingException ex) {
            throw new MailPreparationException("Không thể tạo nội dung email", ex);
        }
        mailSender.send(message);
    }
}
