package vn.vietduc.carehubbackend.questiongeneration.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;
import java.util.concurrent.ThreadPoolExecutor;

@Configuration
@EnableAsync
public class DocumentQuestionAsyncConfig {

    @Bean(name = "documentQuestionJobExecutor")
    public Executor documentQuestionJobExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(2);
        executor.setMaxPoolSize(4);
        executor.setQueueCapacity(50);
        executor.setThreadNamePrefix("doc-question-");
        executor.initialize();
        return executor;
    }

    /**
     * Pool dùng chung cho việc xử lý từng chunk của một phiên sinh câu hỏi.
     * Trước đây mỗi phiên tự tạo một {@code Executors.newFixedThreadPool(...)} rồi shutdown,
     * nên chạy nhiều phiên liên tiếp sẽ liên tục dựng và huỷ thread.
     *
     * <p>Số thread bám theo {@code ai.generation.max-concurrent-calls} vì semaphore trong
     * generator mới là thứ chặn số lời gọi API đồng thời — thêm thread cũng không gọi
     * được nhiều hơn. Dùng CallerRuns để job không vỡ khi hàng đợi đầy.</p>
     */
    @Bean(name = "documentChunkExecutor")
    public ThreadPoolTaskExecutor documentChunkExecutor(AiGenerationProperties properties) {
        int parallelism = Math.max(1, properties.getMaxConcurrentCalls());
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(parallelism);
        executor.setMaxPoolSize(parallelism);
        executor.setQueueCapacity(200);
        executor.setThreadNamePrefix("doc-chunk-");
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(30);
        executor.initialize();
        return executor;
    }
}
