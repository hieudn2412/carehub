package vn.vietduc.carehubbackend.questiongeneration.modelruntime.vietquill;

import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import vn.vietduc.carehubbackend.questiongeneration.config.AiParaphraseProperties;

import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.TimeUnit;

/**
 * Object pool quản lý các {@link RuntimeHandle} để chạy inference đồng thời.
 * Mỗi handle có ONNX session riêng → thread-safe khi mỗi thread dùng handle riêng.
 */
@Slf4j
@Component
public class VietQuillHandlePool {
    private final BlockingQueue<RuntimeHandle> available;
    private final RuntimeHandle[] allHandles;
    private final int poolSize;

    public VietQuillHandlePool(AiParaphraseProperties properties) {
        this.poolSize = Math.max(1, properties.getPoolSize());
        this.available = new ArrayBlockingQueue<>(poolSize);
        this.allHandles = new RuntimeHandle[poolSize];
    }

    /**
     * Khởi tạo tất cả handles trong pool.
     * Gọi từ VietQuillParaphraseModelService sau khi load model path thành công.
     */
    public void initialize(HandleFactory factory) {
        for (int i = 0; i < poolSize; i++) {
            allHandles[i] = factory.create(i);
            available.offer(allHandles[i]);
        }
        log.info("VietQuill handle pool initialized with {} handles", poolSize);
    }

    /**
     * Lấy 1 handle từ pool. Block tối đa timeoutMs.
     *
     * @throws InterruptedException nếu thread bị ngắt khi đang chờ
     * @throws IllegalStateException nếu timeout mà không có handle nào khả dụng
     */
    public RuntimeHandle acquire(long timeoutMs) throws InterruptedException {
        RuntimeHandle handle = available.poll(timeoutMs, TimeUnit.MILLISECONDS);
        if (handle == null) {
            throw new IllegalStateException(
                    "Không có VietQuill handle nào khả dụng sau " + timeoutMs + "ms. " +
                            "Pool size=" + poolSize + ", hãy tăng VIETQUILL_POOL_SIZE hoặc thử lại sau.");
        }
        return handle;
    }

    /**
     * Trả handle về pool sau khi dùng xong.
     */
    public void release(RuntimeHandle handle) {
        if (handle != null) {
            available.offer(handle);
        }
    }

    /**
     * Lặp qua tất cả handles trong pool, acquire từng cái một, chạy action, rồi release.
     * Dùng cho warmup hoặc maintenance.
     */
    public void processAllHandles(java.util.function.Consumer<RuntimeHandle> action) throws InterruptedException {
        for (int i = 0; i < poolSize; i++) {
            RuntimeHandle handle = acquire(30000);
            try {
                action.accept(handle);
            } finally {
                release(handle);
            }
        }
    }

    @PreDestroy
    public void close() {
        for (RuntimeHandle handle : allHandles) {
            if (handle != null) {
                try {
                    handle.close();
                } catch (Exception ignored) {
                    // Best effort shutdown only.
                }
            }
        }
        log.info("VietQuill handle pool closed ({} handles)", poolSize);
    }

    public int poolSize() {
        return poolSize;
    }

    /**
     * Factory để tạo từng handle trong pool.
     */
    @FunctionalInterface
    public interface HandleFactory {
        RuntimeHandle create(int index);
    }
}
