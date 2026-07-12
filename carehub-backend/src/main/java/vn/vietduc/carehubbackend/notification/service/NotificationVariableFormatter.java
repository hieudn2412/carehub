package vn.vietduc.carehubbackend.notification.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;

@Component
public class NotificationVariableFormatter {
    private static final int SCORE_SCALE = 2;
    private final DateTimeFormatter dateTimeFormatter;

    public NotificationVariableFormatter(
            @Value("${app.notification.zone:Asia/Bangkok}") String notificationZone
    ) {
        this.dateTimeFormatter = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm")
                .withZone(ZoneId.of(notificationZone));
    }

    public String formatScore(BigDecimal score) {
        if (score == null) {
            return "N/A";
        }
        return score.setScale(SCORE_SCALE, RoundingMode.HALF_UP)
                .stripTrailingZeros()
                .toPlainString()
                .replace('.', ',');
    }

    public String formatDateTime(Instant instant) {
        return instant == null ? "N/A" : dateTimeFormatter.format(instant);
    }
}
