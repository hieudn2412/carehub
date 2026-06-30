package vn.vietduc.carehubbackend.questiongeneration.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties({
        AiGenerationProperties.class,
        DocumentProcessingProperties.class,
        ValidationRulesProperties.class
})
public class QuestionGenerationConfig {
}
