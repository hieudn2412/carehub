package vn.vietduc.carehubbackend.questiongeneration.service.impl;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import vn.vietduc.carehubbackend.questiongeneration.service.OcrService;
import vn.vietduc.carehubbackend.questiongeneration.service.model.OcrPageResult;
import vn.vietduc.carehubbackend.questiongeneration.service.model.OcrResult;

import java.io.InputStream;
import java.time.Duration;
import java.util.List;

/**
 * Fallback OCR service when no OCR engine is configured.
 * Returns empty results and marks documents as OCR_REQUIRED.
 */
@Service
@ConditionalOnProperty(name = "app.ocr.engine", havingValue = "none", matchIfMissing = true)
@Slf4j
public class NoOpOcrService implements OcrService {

    @Override
    public OcrResult processPdf(InputStream inputStream, String language) {
        log.warn("No OCR engine configured. Document will remain in OCR_REQUIRED state.");
        return new OcrResult(
                List.of(OcrPageResult.empty(1)),
                1, 0, 0.0,
                Duration.ZERO,
                "none"
        );
    }

    @Override
    public boolean isAvailable() {
        return false;
    }

    @Override
    public String getEngineName() {
        return "Không có (chưa cấu hình OCR)";
    }
}
