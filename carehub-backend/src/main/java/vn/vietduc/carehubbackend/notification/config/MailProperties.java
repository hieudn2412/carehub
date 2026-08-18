package vn.vietduc.carehubbackend.notification.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.io.ByteArrayOutputStream;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;

@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "app.mail")
public class MailProperties {
    private static final Charset WINDOWS_1252 = Charset.forName("windows-1252");

    private String from;
    private String fromName = "VietDuc Care";
    private String replyTo;
    private String brandName = "VietDuc Care";
    private String websiteUrl = "https://quanlydieuduongvd.org";
    private String supportEmail;

    public String getFromName() {
        return normalizeDisplayText(fromName);
    }

    public String getBrandName() {
        return normalizeDisplayText(brandName);
    }

    private String normalizeDisplayText(String value) {
        if (!StringUtils.hasText(value)) {
            return value;
        }
        String trimmed = value.trim();
        if (!looksLikeUtf8Mojibake(trimmed)) {
            return trimmed;
        }
        String best = trimmed;
        best = pickBetter(best, repairMixedSingleByteMojibake(trimmed));
        best = pickBetter(best, repairWith(WINDOWS_1252, trimmed));
        best = pickBetter(best, repairWith(StandardCharsets.ISO_8859_1, trimmed));
        return best;
    }

    private String pickBetter(String current, String candidate) {
        return displayTextDamageScore(candidate) < displayTextDamageScore(current) ? candidate : current;
    }

    private String repairWith(Charset sourceCharset, String value) {
        try {
            return new String(value.getBytes(sourceCharset), StandardCharsets.UTF_8);
        } catch (RuntimeException ex) {
            return value;
        }
    }

    private String repairMixedSingleByteMojibake(String value) {
        try {
            ByteArrayOutputStream bytes = new ByteArrayOutputStream(value.length());
            for (int i = 0; i < value.length(); i++) {
                char current = value.charAt(i);
                if (current <= 0xFF) {
                    bytes.write((byte) current);
                } else if (WINDOWS_1252.newEncoder().canEncode(current)) {
                    bytes.writeBytes(String.valueOf(current).getBytes(WINDOWS_1252));
                } else {
                    bytes.write('?');
                }
            }
            return new String(bytes.toByteArray(), StandardCharsets.UTF_8);
        } catch (RuntimeException ex) {
            return value;
        }
    }

    private boolean looksLikeUtf8Mojibake(String value) {
        return value.contains("Ã")
                || value.contains("Â")
                || value.contains("Ä")
                || value.contains("Æ")
                || value.contains("áº")
                || value.contains("á»");
    }

    private int mojibakeScore(String value) {
        if (!StringUtils.hasText(value)) {
            return 0;
        }
        int score = 0;
        String[] markers = {"Ã", "Â", "Ä", "Æ", "áº", "á»", "�"};
        for (String marker : markers) {
            int index = value.indexOf(marker);
            while (index >= 0) {
                score++;
                index = value.indexOf(marker, index + marker.length());
            }
        }
        return score;
    }

    private int displayTextDamageScore(String value) {
        if (!StringUtils.hasText(value)) {
            return 0;
        }
        return mojibakeScore(value) * 10
                + count(value, '\uFFFD') * 4
                + count(value, '?') * 2
                + controlCharacterCount(value);
    }

    private int count(String value, char target) {
        int count = 0;
        for (int i = 0; i < value.length(); i++) {
            if (value.charAt(i) == target) {
                count++;
            }
        }
        return count;
    }

    private int controlCharacterCount(String value) {
        int count = 0;
        for (int i = 0; i < value.length(); i++) {
            char current = value.charAt(i);
            if (Character.isISOControl(current) && !Character.isWhitespace(current)) {
                count++;
            }
        }
        return count;
    }
}
