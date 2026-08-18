package vn.vietduc.carehubbackend.notification.config;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class MailPropertiesTest {

    @Test
    void normalizesVietnameseDisplayNamesLoadedWithWrongCharset() {
        MailProperties properties = new MailProperties();
        properties.setFromName("Bá»‡nh Viá»‡n Viá»‡t Äá»©c");
        properties.setBrandName("Bá»‡nh Viá»‡n Viá»‡t Äá»©c");

        assertThat(properties.getFromName()).isEqualTo("Bệnh Viện Việt Đức");
        assertThat(properties.getBrandName()).isEqualTo("Bệnh Viện Việt Đức");
    }

    @Test
    void keepsAlreadyValidVietnameseDisplayNames() {
        MailProperties properties = new MailProperties();
        properties.setBrandName("Bệnh Viện Việt Đức");

        assertThat(properties.getBrandName()).isEqualTo("Bệnh Viện Việt Đức");
    }
}
