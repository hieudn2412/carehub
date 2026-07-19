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
    private HandleFactory handleFactory;
    private volatile boolean closing;

    public VietQuillHandlePool(AiParaphraseProperties properties) {
        this.poolSize = Math.max(1, properties.getPoolSize());
        this.available = new ArrayBlockingQueue<>(poolSize);
        this.allHandles = new RuntimeHandle[poolSize];
    }

    /**
     * Khởi tạo tất cả handles trong pool.
     * Gọi từ VietQuillParaphraseModelService sau khi load model path thành công.
     */
    public synchronized void initialize(HandleFactory factory) {
        this.handleFactory = factory;
        this.closing = false;
        try {
            for (int i = 0; i < poolSize; i++) {
                RuntimeHandle handle = factory.create(i);
                allHandles[i] = handle;
                available.offer(handle);
            }
        } catch (RuntimeException ex) {
            available.clear();
            for (int i = 0; i < allHandles.length; i++) {
                RuntimeHandle handle = allHandles[i];
                allHandles[i] = null;
                if (handle != null) {
                    try {
                        handle.close();
                    } catch (Exception ignored) {
                        // Best effort cleanup after partial initialization.
                    }
                }
            }
            throw ex;
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
     * Remove a broken/expired handle and replace it with a fresh ONNX handle.
     * This method is called only after the inference task has stopped using the
     * old handle, so closing its native sessions is safe.
     */
    public synchronized void retire(RuntimeHandle handle) {
        if (handle == null) {
            return;
        }
        int index = -1;
        for (int i = 0; i < allHandles.length; i++) {
            if (allHandles[i] == handle) {
                index = i;
                allHandles[i] = null;
                break;
            }
        }
        available.remove(handle);
        try {
            handle.close();
        } catch (Exception ignored) {
            // Best effort cleanup of a broken native session.
        }
        if (closing || index < 0 || handleFactory == null) {
            return;
        }
        try {
            RuntimeHandle replacement = handleFactory.create(index);
            allHandles[index] = replacement;
            available.offer(replacement);
            log.info("Replaced retired VietQuill handle at index {}", index);
        } catch (RuntimeException ex) {
            log.error("Không thể thay thế VietQuill handle tại index {}: {}", index, ex.getMessage(), ex);
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
    public synchronized void close() {
        closing = true;
        available.clear();
        for (RuntimeHandle handle : allHandles) {
            if (handle != null) {
                try {
                    handle.close();
                } catch (Exception ignored) {
                    // Best effort shutdown only.
                }
            }
        }
        handleFactory = null;
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
