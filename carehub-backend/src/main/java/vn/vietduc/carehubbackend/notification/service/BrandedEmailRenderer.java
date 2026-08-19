package vn.vietduc.carehubbackend.notification.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.util.HtmlUtils;
import vn.vietduc.carehubbackend.notification.config.MailProperties;

@Component
@RequiredArgsConstructor
public class BrandedEmailRenderer {
    private static final String PRIMARY_COLOR = "#167c5a";
    private static final String TEXT_COLOR = "#243248";

    private final MailProperties properties;

    public RenderedEmail passwordResetOtp(String recipientName, String otp, int expiryMinutes) {
        String brand = brandName();
        String subject = "[%s] Mã xác thực đặt lại mật khẩu".formatted(brand);
        String greeting = greeting(recipientName);
        String text = """
                %s,

                Bạn vừa yêu cầu đặt lại mật khẩu cho tài khoản %s.

                Mã xác thực: %s

                Mã có hiệu lực trong %d phút. Không chia sẻ mã này với bất kỳ ai.
                Nếu bạn không thực hiện yêu cầu này, hãy bỏ qua email.

                Trân trọng,
                Đội ngũ %s
                """.formatted(greeting, brand, otp, expiryMinutes, brand).strip();
        String body = """
                <p style="margin:0 0 16px">%s,</p>
                <p style="margin:0 0 20px">Bạn vừa yêu cầu đặt lại mật khẩu cho tài khoản %s.</p>
                %s
                <p style="margin:20px 0 8px"><strong>Mã có hiệu lực trong %d phút.</strong></p>
                <p style="margin:0;color:#667085">Không chia sẻ mã này với bất kỳ ai. Nếu bạn không thực hiện yêu cầu, hãy bỏ qua email này.</p>
                """.formatted(escape(greeting), escape(brand), otpBlock(otp), expiryMinutes);
        return new RenderedEmail(subject, text, layout(
                "Mã xác thực đặt lại mật khẩu của bạn",
                "Đặt lại mật khẩu",
                body
        ));
    }

    public RenderedEmail emailVerificationOtp(String recipientName, String otp, int expiryMinutes) {
        String brand = brandName();
        String subject = "[%s] Xác thực địa chỉ email".formatted(brand);
        String greeting = greeting(recipientName);
        String text = """
                %s,

                Sử dụng mã dưới đây để xác thực địa chỉ email cho tài khoản %s.

                Mã xác thực: %s

                Mã có hiệu lực trong %d phút. Không chia sẻ mã này với bất kỳ ai.
                Nếu bạn không thực hiện yêu cầu này, hãy bỏ qua email.

                Trân trọng,
                Đội ngũ %s
                """.formatted(greeting, brand, otp, expiryMinutes, brand).strip();
        String body = """
                <p style="margin:0 0 16px">%s,</p>
                <p style="margin:0 0 20px">Sử dụng mã dưới đây để xác thực địa chỉ email cho tài khoản %s.</p>
                %s
                <p style="margin:20px 0 8px"><strong>Mã có hiệu lực trong %d phút.</strong></p>
                <p style="margin:0;color:#667085">Không chia sẻ mã này với bất kỳ ai. Nếu bạn không thực hiện yêu cầu, hãy bỏ qua email này.</p>
                """.formatted(escape(greeting), escape(brand), otpBlock(otp), expiryMinutes);
        return new RenderedEmail(subject, text, layout(
                "Mã xác thực địa chỉ email của bạn",
                "Xác thực địa chỉ email",
                body
        ));
    }

    public RenderedEmail accountCreated(
            String recipientName,
            String employeeCode,
            String temporaryPassword
    ) {
        String brand = brandName();
        String subject = "[%s] Thông tin tài khoản của bạn".formatted(brand);
        String greeting = greeting(recipientName);
        String text = """
                %s,

                Tài khoản %s của bạn đã được tạo thành công.

                Mã nhân viên: %s
                Mật khẩu tạm thời: %s

                Vui lòng đăng nhập và đổi mật khẩu ngay để bảo vệ tài khoản.
                Không chia sẻ thông tin đăng nhập này với bất kỳ ai.

                Trân trọng,
                Đội ngũ %s
                """.formatted(greeting, brand, employeeCode, temporaryPassword, brand).strip();
        String credentials = """
                <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" style="margin:20px 0;background:#f4f7f6;border:1px solid #dbe7e2;border-radius:10px">
                  <tr><td style="padding:18px 20px">
                    <p style="margin:0 0 10px;color:#667085;font-size:13px">MÃ NHÂN VIÊN</p>
                    <p style="margin:0 0 18px;font-size:18px;font-weight:700;color:%s">%s</p>
                    <p style="margin:0 0 10px;color:#667085;font-size:13px">MẬT KHẨU TẠM THỜI</p>
                    <p style="margin:0;font-size:18px;font-weight:700;color:%s">%s</p>
                  </td></tr>
                </table>
                """.formatted(PRIMARY_COLOR, escape(employeeCode), TEXT_COLOR, escape(temporaryPassword));
        String body = """
                <p style="margin:0 0 16px">%s,</p>
                <p style="margin:0">Tài khoản %s của bạn đã được tạo thành công.</p>
                %s
                <p style="margin:0 0 8px"><strong>Vui lòng đăng nhập và đổi mật khẩu ngay</strong> để bảo vệ tài khoản.</p>
                <p style="margin:0;color:#667085">Không chia sẻ thông tin đăng nhập này với bất kỳ ai.</p>
                """.formatted(escape(greeting), escape(brand), credentials);
        return new RenderedEmail(subject, text, layout(
                "Tài khoản của bạn đã được tạo",
                "Chào mừng bạn đến với " + brand,
                body
        ));
    }

    public String renderGeneric(String subject, String plainContent) {
        String safeContent = escape(plainContent == null ? "" : plainContent)
                .replace("\r\n", "\n")
                .replace("\r", "\n")
                .replace("\n", "<br>");
        String body = "<div style=\"font-size:16px;line-height:1.7;color:%s\">%s</div>"
                .formatted(TEXT_COLOR, safeContent);
        return layout(subject, subject, body);
    }

    private String otpBlock(String otp) {
        return """
                <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" style="margin:20px 0">
                  <tr><td align="center" style="padding:22px;background:#eef8f4;border:1px solid #cce7dc;border-radius:12px">
                    <div style="margin-bottom:8px;color:#667085;font-size:12px;font-weight:700;letter-spacing:1px">MÃ XÁC THỰC</div>
                    <div style="color:%s;font-size:32px;line-height:40px;font-weight:800;letter-spacing:8px">%s</div>
                  </td></tr>
                </table>
                """.formatted(PRIMARY_COLOR, escape(otp));
    }

    private String layout(String preheader, String title, String body) {
        String brand = escape(brandName());
        String footerContact = footerContact();
        return """
                <!doctype html>
                <html lang="vi">
                <head>
                  <meta charset="UTF-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                  <title>%s</title>
                </head>
                <body style="margin:0;padding:0;background:#f3f6f5;font-family:Arial,'Helvetica Neue',sans-serif;color:%s">
                  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">%s</div>
                  <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" style="background:#f3f6f5">
                    <tr><td align="center" style="padding:28px 12px">
                      <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #e2e8e5;border-radius:14px;overflow:hidden">
                        <tr><td style="padding:22px 28px;background:%s;color:#ffffff">
                          <div style="font-size:21px;font-weight:700;letter-spacing:.2px">%s</div>
                          <div style="margin-top:4px;font-size:13px;color:#d9f0e7">Hệ thống quản lý và chăm sóc nhân viên</div>
                        </td></tr>
                        <tr><td style="padding:30px 28px">
                          <h1 style="margin:0 0 22px;color:%s;font-size:24px;line-height:1.35">%s</h1>
                          <div style="font-size:16px;line-height:1.65;color:%s">%s</div>
                        </td></tr>
                        <tr><td style="padding:20px 28px;border-top:1px solid #e8eeeb;background:#fafcfb;color:#667085;font-size:12px;line-height:1.6">
                          Email này được gửi tự động từ %s. Vui lòng không chia sẻ mã xác thực hoặc thông tin đăng nhập.<br>
                          %s
                        </td></tr>
                      </table>
                    </td></tr>
                  </table>
                </body>
                </html>
                """.formatted(
                escape(title), TEXT_COLOR, escape(preheader), PRIMARY_COLOR, brand,
                TEXT_COLOR, escape(title), TEXT_COLOR, body, brand, footerContact
        );
    }

    private String footerContact() {
        String website = properties.getWebsiteUrl();
        String support = properties.getSupportEmail();
        StringBuilder footer = new StringBuilder();
        if (StringUtils.hasText(website)) {
            String escapedUrl = escape(website.trim());
            footer.append("Website: <a href=\"").append(escapedUrl)
                    .append("\" style=\"color:").append(PRIMARY_COLOR).append(";text-decoration:none\">")
                    .append(escapedUrl).append("</a>");
        }
        if (StringUtils.hasText(support)) {
            if (!footer.isEmpty()) {
                footer.append(" &nbsp;|&nbsp; ");
            }
            String escapedSupport = escape(support.trim());
            footer.append("Hỗ trợ: <a href=\"mailto:").append(escapedSupport)
                    .append("\" style=\"color:").append(PRIMARY_COLOR).append(";text-decoration:none\">")
                    .append(escapedSupport).append("</a>");
        }
        return footer.toString();
    }

    private String brandName() {
        return StringUtils.hasText(properties.getBrandName())
                ? properties.getBrandName().trim()
                : "VietDuc Care";
    }

    private String greeting(String recipientName) {
        return StringUtils.hasText(recipientName)
                ? "Kính gửi " + recipientName.trim()
                : "Kính gửi Quý anh/chị";
    }

    private String escape(String value) {
        return HtmlUtils.htmlEscape(value == null ? "" : value);
    }

    public record RenderedEmail(String subject, String plainText, String htmlContent) {
    }
}
