package vn.vietduc.carehubbackend.notification.service;

import jakarta.mail.BodyPart;
import jakarta.mail.Multipart;
import jakarta.mail.Part;
import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mail.javamail.JavaMailSender;
import vn.vietduc.carehubbackend.notification.config.MailProperties;

import java.util.Properties;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.same;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class EmailServiceTest {
    private JavaMailSender mailSender;
    private MailProperties properties;
    private EmailService service;

    @BeforeEach
    void setUp() {
        mailSender = mock(JavaMailSender.class);
        properties = new MailProperties();
        properties.setFrom("thongbao@quanlydieuduongvd.org");
        properties.setFromName("VietDuc Care");
        properties.setReplyTo("hotro@quanlydieuduongvd.org");
        BrandedEmailRenderer renderer = new BrandedEmailRenderer(properties);
        service = new EmailService(mailSender, properties, renderer);
    }

    @Test
    void sendsMultipartAlternativeWithBrandedSenderAndAutomationHeaders() throws Exception {
        MimeMessage mimeMessage = new MimeMessage(Session.getInstance(new Properties()));
        when(mailSender.createMimeMessage()).thenReturn(mimeMessage);

        service.send("employee@example.com", "Thông báo", "Nội dung dạng chữ");
        mimeMessage.saveChanges();

        verify(mailSender).send(same(mimeMessage));
        assertThat(mimeMessage.getFrom()[0].toString()).contains("VietDuc Care", "thongbao@quanlydieuduongvd.org");
        assertThat(mimeMessage.getReplyTo()[0].toString()).isEqualTo("hotro@quanlydieuduongvd.org");
        assertThat(mimeMessage.getHeader("Auto-Submitted", null)).isEqualTo("auto-generated");
        assertThat(mimeMessage.getHeader("Content-Language", null)).isEqualTo("vi-VN");
        assertThat(findContent(mimeMessage, "text/plain")).contains("Nội dung dạng chữ");
        assertThat(findContent(mimeMessage, "text/html")).contains("VietDuc Care", "Nội dung dạng chữ");
    }

    private String findContent(Part part, String mimeType) throws Exception {
        Object rawContent = part.getContent();
        if (rawContent instanceof Multipart multipart) {
            for (int i = 0; i < multipart.getCount(); i++) {
                BodyPart bodyPart = multipart.getBodyPart(i);
                String content = findContent(bodyPart, mimeType);
                if (content != null) {
                    return content;
                }
            }
        }
        if (part.isMimeType(mimeType)) {
            return String.valueOf(rawContent);
        }
        return null;
    }
}
