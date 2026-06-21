package vn.vietduc.carehubbackend.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Bean;

import java.time.Clock;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;

@Configuration
@EnableJpaAuditing
public class JpaConfig {
    @Bean
    public Clock clock() {
        return Clock.systemUTC();
    }
}
