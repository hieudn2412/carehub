package vn.vietduc.carehubbackend.questiongeneration.service;

import vn.vietduc.carehubbackend.questiongeneration.service.model.OcrResult;
import vn.vietduc.carehubbackend.questiongeneration.service.model.OcrPageResult;

import java.io.InputStream;
import java.util.List;

public interface OcrService {

    /**
     * Perform OCR on a PDF input stream.
     * @param inputStream PDF file input stream
     * @param language OCR language code (e.g., "vie", "eng", "vie+eng")
     * @return OCR result with per-page text and confidence scores
     */
    OcrResult processPdf(InputStream inputStream, String language);

    /**
     * Check if OCR is available (engine is configured and working).
     */
    boolean isAvailable();

    /**
     * Get the OCR engine name for display.
     */
    String getEngineName();
}
