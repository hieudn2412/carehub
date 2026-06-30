package vn.vietduc.carehubbackend.questiongeneration.service;

import org.apache.poi.xwpf.extractor.XWPFWordExtractor;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.springframework.stereotype.Service;
import vn.vietduc.carehubbackend.questiongeneration.service.model.ExtractedDocument;

import java.io.ByteArrayInputStream;
import java.io.Closeable;
import java.io.IOException;
import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@Service
public class DocumentTextExtractor {
    private static final int MIN_PDF_TEXT_CHARS = 40;

    public ExtractedDocument extract(byte[] bytes, String filename) {
        String extension = extensionOf(filename);
        try {
            return switch (extension) {
                case "pdf" -> extractPdf(bytes);
                case "docx" -> extractDocx(bytes);
                case "txt", "md" -> extractText(bytes);
                default -> new ExtractedDocument(List.of(), 0, false, "Định dạng tài liệu chưa được hỗ trợ");
            };
        } catch (Exception ex) {
            return new ExtractedDocument(List.of(), 0, false, "Không thể đọc nội dung tài liệu: " + ex.getMessage());
        }
    }

    private ExtractedDocument extractPdf(byte[] bytes) throws Exception {
        Class<?> loaderClass = Class.forName("org.apache.pdfbox.Loader");
        Class<?> pdfDocumentClass = Class.forName("org.apache.pdfbox.pdmodel.PDDocument");
        Class<?> textStripperClass = Class.forName("org.apache.pdfbox.text.PDFTextStripper");

        Method loadPdf = loaderClass.getMethod("loadPDF", byte[].class);
        Method isEncrypted = pdfDocumentClass.getMethod("isEncrypted");
        Method getNumberOfPages = pdfDocumentClass.getMethod("getNumberOfPages");
        Method setStartPage = textStripperClass.getMethod("setStartPage", int.class);
        Method setEndPage = textStripperClass.getMethod("setEndPage", int.class);
        Method getText = textStripperClass.getMethod("getText", pdfDocumentClass);

        Object pdf = loadPdf.invoke(null, bytes);
        try {
            int pageCount = (int) getNumberOfPages.invoke(pdf);
            if ((boolean) isEncrypted.invoke(pdf)) {
                return new ExtractedDocument(List.of(), pageCount, false, "PDF đang được mã hóa");
            }
            Object stripper = textStripperClass.getDeclaredConstructor().newInstance();
            List<String> pages = new ArrayList<>();
            StringBuilder allText = new StringBuilder();
            for (int page = 1; page <= pageCount; page++) {
                setStartPage.invoke(stripper, page);
                setEndPage.invoke(stripper, page);
                String text = (String) getText.invoke(stripper, pdf);
                pages.add(text == null ? "" : text);
                allText.append(text == null ? "" : text);
            }
            boolean ocrRequired = compactText(allText.toString()).length() < MIN_PDF_TEXT_CHARS;
            return new ExtractedDocument(pages, pageCount, ocrRequired, null);
        } finally {
            if (pdf instanceof Closeable closeable) {
                closeable.close();
            }
        }
    }

    private ExtractedDocument extractDocx(byte[] bytes) throws IOException {
        try (XWPFDocument document = new XWPFDocument(new ByteArrayInputStream(bytes));
             XWPFWordExtractor extractor = new XWPFWordExtractor(document)) {
            String text = extractor.getText();
            return new ExtractedDocument(List.of(text == null ? "" : text), 1, false, null);
        }
    }

    private ExtractedDocument extractText(byte[] bytes) {
        String text = new String(bytes, StandardCharsets.UTF_8);
        return new ExtractedDocument(List.of(text), 1, false, null);
    }

    private String extensionOf(String filename) {
        if (filename == null || !filename.contains(".")) {
            return "";
        }
        return filename.substring(filename.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT);
    }

    private String compactText(String value) {
        return value == null ? "" : value.replaceAll("\\s+", "");
    }
}
