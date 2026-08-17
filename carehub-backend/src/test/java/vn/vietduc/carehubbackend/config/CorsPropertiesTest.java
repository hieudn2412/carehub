package vn.vietduc.carehubbackend.config;

import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.bind.Bindable;
import org.springframework.boot.context.properties.bind.Binder;
import org.springframework.boot.context.properties.source.MapConfigurationPropertySource;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class CorsPropertiesTest {

    @Test
    void bindsCommaSeparatedOriginsFromEnvironmentStyleProperty() {
        MapConfigurationPropertySource source = new MapConfigurationPropertySource(Map.of(
                "app.cors.allowed-origin-patterns",
                "https://quanlydieuduongvd.org,https://admin.example.org"
        ));

        CorsProperties properties = new Binder(source)
                .bind("app.cors", Bindable.of(CorsProperties.class))
                .orElseThrow(() -> new AssertionError("CORS properties were not bound"));

        assertThat(properties.getAllowedOriginPatterns()).containsExactly(
                "https://quanlydieuduongvd.org",
                "https://admin.example.org"
        );
    }
}
