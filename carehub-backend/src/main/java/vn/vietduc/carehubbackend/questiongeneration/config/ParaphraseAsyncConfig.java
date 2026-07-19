package vn.vietduc.carehubbackend.questiongeneration.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;

@Configuration
public class ParaphraseAsyncConfig {

    @Bean(name = "paraphraseJobExecutor")
    public Executor paraphraseJobExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(2);
        executor.setMaxPoolSize(4);
        executor.setQueueCapacity(50);
        executor.setThreadNamePrefix("paraphrase-job-");
        executor.initialize();
        return executor;
    }
}
