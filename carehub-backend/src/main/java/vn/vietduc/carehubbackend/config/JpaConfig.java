package vn.vietduc.carehubbackend.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Bean;
import org.springframework.beans.factory.annotation.Value;

import java.time.Clock;
import java.time.ZoneId;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;

@Configuration
@EnableJpaAuditing
public class JpaConfig {
    @Bean
    public Clock clock() {
        return Clock.systemUTC();
    }

    @Bean
    public ZoneId examBusinessZone(
            @Value("${app.exam.business-zone:Asia/Ho_Chi_Minh}") String zoneId
    ) {
        return ZoneId.of(zoneId);
    }
}
