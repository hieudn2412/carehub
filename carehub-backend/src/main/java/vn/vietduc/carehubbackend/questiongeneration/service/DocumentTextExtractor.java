package vn.vietduc.carehubbackend.questiongeneration.service;

import org.apache.poi.xwpf.usermodel.IBodyElement;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.apache.poi.xwpf.usermodel.XWPFTable;
import org.apache.poi.xwpf.usermodel.XWPFTableCell;
import org.apache.poi.xwpf.usermodel.XWPFTableRow;
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
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
public class DocumentTextExtractor {
    private static final int MIN_PDF_TEXT_CHARS = 40;
    private static final Pattern HEADING_STYLE = Pattern.compile(".*?(?:heading|title|tiêu đề|tieude)\\s*([1-6])?.*", Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);

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
        try (XWPFDocument document = new XWPFDocument(new ByteArrayInputStream(bytes))) {
            StringBuilder text = new StringBuilder();
            for (IBodyElement element : document.getBodyElements()) {
                if (element instanceof XWPFParagraph paragraph) {
                    appendParagraph(text, paragraph);
                } else if (element instanceof XWPFTable table) {
                    appendTable(text, table);
                }
            }
            return new ExtractedDocument(List.of(text.toString()), 1, false, null);
        }
    }

    private void appendParagraph(StringBuilder target, XWPFParagraph paragraph) {
        String text = paragraph.getText();
        if (text == null || text.isBlank()) {
            target.append('\n');
            return;
        }
        String normalized = text.trim();
        int headingLevel = headingLevel(paragraph);
        if (headingLevel > 0) {
            target.append("#".repeat(headingLevel)).append(' ').append(normalized).append("\n\n");
            return;
        }
        if (paragraph.getNumID() != null && !normalized.matches("^(?:[-*•]|\\d+[.)]|[a-zA-Z][.)])\\s+.+")) {
            target.append("- ").append(normalized).append('\n');
            return;
        }
        target.append(normalized).append('\n');
    }

    private void appendTable(StringBuilder target, XWPFTable table) {
        target.append('\n');
        for (XWPFTableRow row : table.getRows()) {
            String rowText = row.getTableCells().stream()
                    .map(XWPFTableCell::getText)
                    .map(value -> value == null ? "" : value.replaceAll("\\s+", " ").trim())
                    .filter(value -> !value.isBlank())
                    .collect(Collectors.joining(" | "));
            if (!rowText.isBlank()) {
                target.append(rowText).append('\n');
            }
        }
        target.append('\n');
    }

    private int headingLevel(XWPFParagraph paragraph) {
        String style = paragraph.getStyle();
        if (style == null || style.isBlank()) {
            return 0;
        }
        String normalized = style.toLowerCase(Locale.ROOT).replaceAll("[_-]+", " ");
        Matcher matcher = HEADING_STYLE.matcher(normalized);
        if (!matcher.matches()) {
            return 0;
        }
        String level = matcher.group(1);
        if (level == null || level.isBlank()) {
            return 1;
        }
        return Math.min(6, Math.max(1, Integer.parseInt(level)));
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
