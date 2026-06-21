package vn.vietduc.carehubbackend.form.importer.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

@ConfigurationProperties(prefix = "app.form-import")
public record FormImportProperties(
        int maxBatchSize,
        GooglePublic googlePublic
) {
    public record GooglePublic(
            boolean enabled,
            Duration connectTimeout,
            Duration readTimeout,
            int maxResponseBytes
    ) {
    }
}

