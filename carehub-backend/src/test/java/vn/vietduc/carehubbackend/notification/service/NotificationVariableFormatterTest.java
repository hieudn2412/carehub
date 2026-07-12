package vn.vietduc.carehubbackend.notification.service;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;

import static org.junit.jupiter.api.Assertions.assertEquals;

class NotificationVariableFormatterTest {
    private final NotificationVariableFormatter formatter =
            new NotificationVariableFormatter("Asia/Bangkok");

    @Test
    void formatsScoreWithoutFloatingPointNoise() {
        assertEquals("2", formatter.formatScore(
                new BigDecimal("2.000000000000000000000000000000003")));
        assertEquals("6,75", formatter.formatScore(new BigDecimal("6.745")));
    }

    @Test
    void formatsTimestampInConfiguredBusinessZone() {
        assertEquals("11/07/2026 22:04", formatter.formatDateTime(
                Instant.parse("2026-07-11T15:04:29.967445100Z")));
    }

    @Test
    void formatsMissingValuesAsNotAvailable() {
        assertEquals("N/A", formatter.formatScore(null));
        assertEquals("N/A", formatter.formatDateTime(null));
    }
}
