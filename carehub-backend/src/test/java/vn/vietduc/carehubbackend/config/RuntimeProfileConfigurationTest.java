package vn.vietduc.carehubbackend.config;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.ConfigDataApplicationContextInitializer;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.core.env.Profiles;

import static org.assertj.core.api.Assertions.assertThat;

class RuntimeProfileConfigurationTest {

    private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
            .withInitializer(new ConfigDataApplicationContextInitializer());

    @Test
    void defaultsToSharedDevelopmentInfrastructureWhenNoProfileIsSelected() {
        contextRunner.run(context -> {
            assertThat(context.getEnvironment().acceptsProfiles(Profiles.of("dev"))).isTrue();
            assertThat(context.getEnvironment().getProperty("spring.datasource.url"))
                    .isEqualTo("jdbc:postgresql://116.118.6.153:5432/carehub");
            assertThat(context.getEnvironment().getProperty("spring.rabbitmq.host"))
                    .isEqualTo("116.118.6.153");
            assertThat(context.getEnvironment().getProperty("app.seed.enabled"))
                    .isEqualTo("false");
        });
    }
}
