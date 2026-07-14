package vn.vietduc.carehubbackend.questiongeneration.service.impl;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import vn.vietduc.carehubbackend.questiongeneration.service.OcrService;
import vn.vietduc.carehubbackend.questiongeneration.service.model.OcrPageResult;
import vn.vietduc.carehubbackend.questiongeneration.service.model.OcrResult;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;

/**
 * OCR service implementation using Tesseract CLI.
 * Requires tesseract to be installed on the system and available in PATH.
 * Configure with: app.ocr.engine=tesseract
 */
@Service
@ConditionalOnProperty(name = "app.ocr.engine", havingValue = "tesseract", matchIfMissing = false)
@Slf4j
public class TesseractOcrService implements OcrService {

    private static final String TESSERACT_CMD = "tesseract";
    private static final Duration TIMEOUT = Duration.ofMinutes(5);

    @Override
    public OcrResult processPdf(InputStream inputStream, String language) {
        Instant start = Instant.now();
        String lang = language != null && !language.isBlank() ? language : "vie+eng";

        try {
            Path tempPdf = Files.createTempFile("ocr_input_", ".pdf");
            Path tempOutput = Files.createTempFile("ocr_output_", "");
            try {
                Files.copy(inputStream, tempPdf, java.nio.file.StandardCopyOption.REPLACE_EXISTING);

                List<String> cmd = List.of(
                        TESSERACT_CMD,
                        tempPdf.toAbsolutePath().toString(),
                        tempOutput.toAbsolutePath().toString(),
                        "-l", lang,
                        "pdf"
                );

                ProcessBuilder pb = new ProcessBuilder(cmd);
                pb.redirectErrorStream(true);
                Process process = pb.start();
                boolean completed = process.waitFor(TIMEOUT.toSeconds(), TimeUnit.SECONDS);

                if (!completed) {
                    process.destroyForcibly();
                    return new OcrResult(List.of(), 0, 0, 0.0,
                            Duration.between(start, Instant.now()), "tesseract");
                }

                // Read output (tesseract pdf mode produces one file per page)
                Path outputFile = Path.of(tempOutput + ".txt");
                List<OcrPageResult> pages = new ArrayList<>();
                if (Files.exists(outputFile)) {
                    String fullText = Files.readString(outputFile);
                    String[] pageTexts = fullText.split("\f"); // Form feed separates pages
                    int pageNum = 1;
                    for (String pageText : pageTexts) {
                        String text = pageText.trim();
                        double confidence = estimateConfidence(text);
                        pages.add(new OcrPageResult(pageNum++, text, confidence, !text.isEmpty(), null));
                    }
                }

                if (pages.isEmpty()) {
                    pages.add(OcrPageResult.empty(1));
                }

                double avgConf = pages.stream().mapToDouble(OcrPageResult::confidence).average().orElse(0.0);
                long pagesWithText = pages.stream().filter(OcrPageResult::hasText).count();

                return new OcrResult(pages, pages.size(), (int) pagesWithText,
                        Math.round(avgConf * 100.0) / 100.0,
                        Duration.between(start, Instant.now()), "tesseract");

            } finally {
                Files.deleteIfExists(tempPdf);
                Files.deleteIfExists(tempOutput);
                Files.deleteIfExists(Path.of(tempOutput + ".txt"));
            }
        } catch (Exception e) {
            log.error("Tesseract OCR failed: {}", e.getMessage(), e);
            return new OcrResult(List.of(OcrPageResult.error(1, e.getMessage())),
                    1, 0, 0.0, Duration.between(start, Instant.now()), "tesseract");
        }
    }

    @Override
    public boolean isAvailable() {
        try {
            ProcessBuilder pb = new ProcessBuilder(TESSERACT_CMD, "--version");
            pb.redirectErrorStream(true);
            Process process = pb.start();
            boolean completed = process.waitFor(10, TimeUnit.SECONDS);
            return completed && process.exitValue() == 0;
        } catch (Exception e) {
            log.debug("Tesseract not available: {}", e.getMessage());
            return false;
        }
    }

    @Override
    public String getEngineName() {
        return "Tesseract OCR";
    }

    /**
     * Estimate confidence based on text characteristics.
     * Real implementation would use tesseract's confidence output (hOCR/TSV).
     */
    private double estimateConfidence(String text) {
        if (text == null || text.isBlank()) return 0.0;
        // Rough heuristic: ratio of recognizable characters
        long validChars = text.chars().filter(c -> Character.isLetterOrDigit(c) || Character.isWhitespace(c)).count();
        return Math.min(95.0, (double) validChars / Math.max(1, text.length()) * 100.0);
    }
}
