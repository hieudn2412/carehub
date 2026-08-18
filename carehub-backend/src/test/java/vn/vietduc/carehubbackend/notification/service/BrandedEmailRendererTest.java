package vn.vietduc.carehubbackend.notification.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import vn.vietduc.carehubbackend.notification.config.MailProperties;

import static org.assertj.core.api.Assertions.assertThat;

class BrandedEmailRendererTest {
    private BrandedEmailRenderer renderer;

    @BeforeEach
    void setUp() {
        MailProperties properties = new MailProperties();
        properties.setBrandName("VietDuc Care");
        properties.setWebsiteUrl("https://quanlydieuduongvd.org");
        properties.setSupportEmail("hotro@quanlydieuduongvd.org");
        renderer = new BrandedEmailRenderer(properties);
    }

    @Test
    void otpEmailContainsProfessionalPlainTextAndEscapedHtml() {
        var email = renderer.passwordResetOtp("Nguyễn <Admin>", "123456", 5);

        assertThat(email.subject()).isEqualTo("[VietDuc Care] Mã xác thực đặt lại mật khẩu");
        assertThat(email.plainText())
                .contains("Kính gửi Nguyễn <Admin>")
                .contains("Mã xác thực: 123456")
                .contains("5 phút");
        assertThat(email.htmlContent())
                .contains("Nguyễn &lt;Admin&gt;")
                .contains("123456")
                .contains("hotro@quanlydieuduongvd.org")
                .doesNotContain("Nguyễn <Admin>");
    }

    @Test
    void genericEmailEscapesAdminManagedTemplateContent() {
        String html = renderer.renderGeneric("Thông báo", "Nội dung <script>alert(1)</script>\nDòng hai");

        assertThat(html)
                .contains("Nội dung &lt;script&gt;alert(1)&lt;/script&gt;")
                .contains("<br>D&ograve;ng hai")
                .doesNotContain("<script>alert(1)</script>");
    }
}
