package vn.vietduc.carehubbackend.questiongeneration.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import vn.vietduc.carehubbackend.exception.BadRequestException;
import vn.vietduc.carehubbackend.exception.ConflictException;
import vn.vietduc.carehubbackend.questiongeneration.dto.request.QuestionBankImportCommitRequest;
import vn.vietduc.carehubbackend.questiongeneration.dto.request.QuestionBankImportRowRequest;
import vn.vietduc.carehubbackend.questiongeneration.dto.request.UpsertQuestionBankQuestionRequest;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.QuestionBankImportCommitResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.QuestionBankImportPreviewResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.QuestionBankImportRowResultResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.QuestionBankQuestionResponse;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class QuestionBankImportExportService {
    private static final List<String> EXPORT_HEADERS = List.of(
            "stem",
            "optionA",
            "optionB",
            "optionC",
            "optionD",
            "correctAnswer",
            "explanation",
            "topic",
            "difficulty",
            "language",
            "sourceDocument",
            "status"
    );

    private final QuestionBankService questionBankService;
    private final EvaluationImportHistoryService importHistoryService;
    private final ObjectMapper objectMapper;

    private enum DuplicateHandlingMode {
        BLOCK,
        SKIP_DUPLICATES,
        IMPORT_DUPLICATES_AS_DRAFT
    }

    public byte[] importTemplateXlsx() {
        try (Workbook workbook = new XSSFWorkbook(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            Sheet sheet = workbook.createSheet("questions");
            CellStyle headerStyle = workbook.createCellStyle();
            Font headerFont = workbook.createFont();
            headerFont.setBold(true);
            headerStyle.setFont(headerFont);

            Row header = sheet.createRow(0);
            for (int index = 0; index < EXPORT_HEADERS.size(); index++) {
                header.createCell(index).setCellValue(EXPORT_HEADERS.get(index));
                header.getCell(index).setCellStyle(headerStyle);
            }

            Row sample = sheet.createRow(1);
            List<String> sampleValues = List.of(
                    "Dấu hiệu nào gợi ý người bệnh cần được báo bác sĩ ngay?",
                    "Mạch nhanh, huyết áp tụt",
                    "Ngủ đủ giấc",
                    "Ăn ngon miệng",
                    "Không đau bụng",
                    "A",
                    "Mạch nhanh kèm huyết áp tụt là dấu hiệu cảnh báo tình trạng nặng.",
                    "Cấp cứu",
                    "MEDIUM",
                    "vi",
                    "Bộ câu hỏi mẫu bệnh viện",
                    "APPROVED"
            );
            for (int index = 0; index < sampleValues.size(); index++) {
                sample.createCell(index).setCellValue(sampleValues.get(index));
            }

            Sheet guide = workbook.createSheet("huong-dan");
            guide.createRow(0).createCell(0).setCellValue("Cột bắt buộc: stem, optionA, optionB, optionC, optionD, correctAnswer.");
            guide.createRow(1).createCell(0).setCellValue("correctAnswer chỉ nhận A, B, C hoặc D.");
            guide.createRow(2).createCell(0).setCellValue("status có thể bỏ trống; mặc định APPROVED. Giá trị hợp lệ: DRAFT, APPROVED, REJECTED.");
            guide.createRow(3).createCell(0).setCellValue("difficulty nên dùng EASY, MEDIUM hoặc HARD nếu có dữ liệu.");
            guide.createRow(4).createCell(0).setCellValue("Có thể xóa dòng ví dụ trước khi import.");

            for (int index = 0; index < EXPORT_HEADERS.size(); index++) {
                sheet.autoSizeColumn(index);
            }
            guide.autoSizeColumn(0);
            workbook.write(output);
            return output.toByteArray();
        } catch (IOException ex) {
            throw new BadRequestException("Không thể tạo file mẫu import ngân hàng câu hỏi");
        }
    }

    @Transactional(readOnly = true)
    public byte[] exportXlsx(String query, String status) {
        List<QuestionBankQuestionResponse> questions = questionBankService.list(query, status == null ? "ALL" : status);
        try (Workbook workbook = new XSSFWorkbook(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            Sheet sheet = workbook.createSheet("question-bank");
            Row header = sheet.createRow(0);
            for (int index = 0; index < EXPORT_HEADERS.size(); index++) {
                header.createCell(index).setCellValue(EXPORT_HEADERS.get(index));
            }
            for (int index = 0; index < questions.size(); index++) {
                QuestionBankQuestionResponse question = questions.get(index);
                Row row = sheet.createRow(index + 1);
                row.createCell(0).setCellValue(blank(question.stem()));
                row.createCell(1).setCellValue(blank(question.optionA()));
                row.createCell(2).setCellValue(blank(question.optionB()));
                row.createCell(3).setCellValue(blank(question.optionC()));
                row.createCell(4).setCellValue(blank(question.optionD()));
                row.createCell(5).setCellValue(blank(question.correctAnswer()));
                row.createCell(6).setCellValue(blank(question.explanation()));
                row.createCell(7).setCellValue(blank(question.topic()));
                row.createCell(8).setCellValue(blank(question.difficulty()));
                row.createCell(9).setCellValue(blank(question.language()));
                row.createCell(10).setCellValue(blank(question.sourceDocument()));
                row.createCell(11).setCellValue(blank(question.status()));
            }
            for (int index = 0; index < EXPORT_HEADERS.size(); index++) {
                sheet.autoSizeColumn(index);
            }
            workbook.write(output);
            return output.toByteArray();
        } catch (IOException ex) {
            throw new BadRequestException("Không thể export ngân hàng câu hỏi");
        }
    }

    @Transactional(readOnly = true)
    public QuestionBankImportPreviewResponse preview(MultipartFile file, String actor) {
        return preview(file, actor, null);
    }

    @Transactional(readOnly = true)
    public QuestionBankImportPreviewResponse preview(MultipartFile file, String actor, String columnMappingJson) {
        ParsedRows parsed = parseFile(file, parseColumnMapping(columnMappingJson));
        List<QuestionBankImportRowResultResponse> results = parsed.rows().stream()
                .map(row -> toResult(row, null, validate(row)))
                .toList();
        QuestionBankImportPreviewResponse preview = new QuestionBankImportPreviewResponse(
                null,
                parsed.sourceHeaders(),
                results.size(),
                (int) results.stream().filter(QuestionBankImportRowResultResponse::valid).count(),
                (int) results.stream().filter(row -> !row.valid()).count(),
                results
        );
        return importHistoryService.recordQuestionBankPreview(file, preview, actor);
    }

    @Transactional
    public QuestionBankImportCommitResponse commit(QuestionBankImportCommitRequest request, String actor) {
        if (request == null || request.rows() == null || request.rows().isEmpty()) {
            throw new BadRequestException("Không có dòng import nào để lưu");
        }
        DuplicateHandlingMode duplicateMode = parseDuplicateMode(request.duplicateHandlingMode());
        List<QuestionBankImportRowResultResponse> results = new ArrayList<>();
        for (QuestionBankImportRowRequest row : request.rows()) {
            List<String> errors = validate(row);
            Long createdQuestionId = null;
            boolean skipped = false;
            if (errors.isEmpty()) {
                try {
                    QuestionBankQuestionResponse created = questionBankService.create(toUpsertRequest(row), actor);
                    createdQuestionId = created.id();
                } catch (ConflictException ex) {
                    if (duplicateMode == DuplicateHandlingMode.SKIP_DUPLICATES) {
                        skipped = true;
                        errors.add("Bỏ qua do trùng mạnh: " + safeMessage(ex));
                    } else if (duplicateMode == DuplicateHandlingMode.IMPORT_DUPLICATES_AS_DRAFT) {
                        try {
                            QuestionBankQuestionResponse created = questionBankService.createImportDraftAllowingDuplicate(toUpsertRequest(row), actor);
                            createdQuestionId = created.id();
                        } catch (Exception draftEx) {
                            errors.add(safeMessage(draftEx));
                        }
                    } else {
                        errors.add(safeMessage(ex));
                    }
                } catch (Exception ex) {
                    errors.add(safeMessage(ex));
                }
            }
            results.add(toResult(row, createdQuestionId, errors, skipped));
        }
        int skippedCount = (int) results.stream().filter(row -> Boolean.TRUE.equals(row.skipped())).count();
        QuestionBankImportCommitResponse commit = new QuestionBankImportCommitResponse(
                request.importJobId(),
                results.size(),
                (int) results.stream().filter(row -> row.createdQuestionId() != null).count(),
                skippedCount,
                (int) results.stream().filter(row -> row.createdQuestionId() == null && !Boolean.TRUE.equals(row.skipped())).count(),
                results
        );
        return importHistoryService.recordQuestionBankCommit(request.importJobId(), commit, actor);
    }

    private ParsedRows parseFile(MultipartFile file, Map<String, String> columnMapping) {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("Vui lòng chọn file import");
        }
        String filename = file.getOriginalFilename() == null ? "" : file.getOriginalFilename().toLowerCase(Locale.ROOT);
        try {
            if (filename.endsWith(".xlsx") || filename.endsWith(".xls")) {
                return parseWorkbook(file, columnMapping);
            }
            if (filename.endsWith(".csv")) {
                return parseCsv(file, columnMapping);
            }
            if (filename.endsWith(".docx")) {
                return parseDocx(file);
            }
        } catch (IOException ex) {
            throw new BadRequestException("Không đọc được file import");
        }
        throw new BadRequestException("Chỉ hỗ trợ import XLSX/XLS/CSV/DOCX");
    }

    private ParsedRows parseWorkbook(MultipartFile file, Map<String, String> columnMapping) throws IOException {
        try (Workbook workbook = WorkbookFactory.create(file.getInputStream())) {
            Sheet sheet = workbook.getSheetAt(0);
            if (sheet == null || sheet.getPhysicalNumberOfRows() < 2) {
                return new ParsedRows(List.of(), List.of());
            }
            Row headerRow = sheet.getRow(0);
            Map<String, Integer> headers = headerIndex(headerRow);
            List<String> sourceHeaders = sourceHeaders(headerRow);
            List<QuestionBankImportRowRequest> rows = new ArrayList<>();
            for (int rowIndex = 1; rowIndex <= sheet.getLastRowNum(); rowIndex++) {
                Row row = sheet.getRow(rowIndex);
                if (row == null || rowIsBlank(row)) {
                    continue;
                }
                rows.add(rowFromMap(rowIndex + 1, key -> cellText(row, headers.get(mappedHeaderKey(key, columnMapping)))));
            }
            return new ParsedRows(rows, sourceHeaders);
        }
    }

    private ParsedRows parseCsv(MultipartFile file, Map<String, String> columnMapping) throws IOException {
        String content = new String(file.getBytes(), StandardCharsets.UTF_8);
        List<String> lines = content.lines().filter(line -> !line.isBlank()).toList();
        if (lines.size() < 2) {
            return new ParsedRows(List.of(), List.of());
        }
        List<String> headerValues = parseCsvLine(lines.get(0));
        Map<String, Integer> headers = new HashMap<>();
        for (int index = 0; index < headerValues.size(); index++) {
            headers.put(normalizeHeader(headerValues.get(index)), index);
        }
        List<QuestionBankImportRowRequest> rows = new ArrayList<>();
        for (int index = 1; index < lines.size(); index++) {
            List<String> values = parseCsvLine(lines.get(index));
            int rowNumber = index + 1;
            rows.add(rowFromMap(rowNumber, key -> {
                Integer valueIndex = headers.get(mappedHeaderKey(key, columnMapping));
                return valueIndex == null || valueIndex >= values.size() ? "" : values.get(valueIndex);
            }));
        }
        return new ParsedRows(rows, headerValues);
    }

    private ParsedRows parseDocx(MultipartFile file) throws IOException {
        try (XWPFDocument document = new XWPFDocument(new ByteArrayInputStream(file.getBytes()))) {
            List<QuestionBankImportRowRequest> rows = new ArrayList<>();
            DocxQuestionBuilder builder = new DocxQuestionBuilder();
            int rowNumber = 1;
            for (XWPFParagraph paragraph : document.getParagraphs()) {
                String line = paragraph.getText() == null ? "" : paragraph.getText().trim();
                if (line.isBlank()) {
                    if (builder.hasContent()) {
                        rows.add(builder.toRow(++rowNumber));
                        builder = new DocxQuestionBuilder();
                    }
                    continue;
                }
                if (isQuestionStart(line) && builder.hasContent()) {
                    rows.add(builder.toRow(++rowNumber));
                    builder = new DocxQuestionBuilder();
                }
                builder.accept(line);
            }
            if (builder.hasContent()) {
                rows.add(builder.toRow(++rowNumber));
            }
            return new ParsedRows(rows, List.of(
                    "Câu hỏi", "A", "B", "C", "D", "Đáp án", "Giải thích", "Chủ đề", "Độ khó", "Ngôn ngữ", "Nguồn", "Trạng thái"
            ));
        }
    }

    private QuestionBankImportRowRequest rowFromMap(int rowNumber, ValueLookup lookup) {
        return new QuestionBankImportRowRequest(
                rowNumber,
                lookup.get("stem"),
                lookup.get("optiona"),
                lookup.get("optionb"),
                lookup.get("optionc"),
                lookup.get("optiond"),
                lookup.get("correctanswer"),
                lookup.get("explanation"),
                lookup.get("topic"),
                lookup.get("difficulty"),
                lookup.get("language"),
                lookup.get("sourcedocument"),
                lookup.get("status")
        );
    }

    private Map<String, Integer> headerIndex(Row headerRow) {
        Map<String, Integer> headers = new HashMap<>();
        if (headerRow == null) {
            return headers;
        }
        for (Cell cell : headerRow) {
            headers.put(normalizeHeader(cellText(cell)), cell.getColumnIndex());
        }
        return headers;
    }

    private boolean isQuestionStart(String line) {
        String normalized = normalizeHeader(labelPart(line));
        return List.of("question", "cauhoi", "noidung", "stem").contains(normalized)
                || line.matches("(?i)^c[aâ]u\\s*\\d+\\s*[:.).-].*");
    }

    private String labelPart(String line) {
        int colon = line.indexOf(':');
        if (colon >= 0) {
            return line.substring(0, colon);
        }
        int dot = line.indexOf('.');
        if (dot > 0 && dot <= 3) {
            return line.substring(0, dot);
        }
        int dash = line.indexOf('-');
        if (dash > 0 && dash <= 12) {
            return line.substring(0, dash);
        }
        return line;
    }

    private String valuePart(String line) {
        int colon = line.indexOf(':');
        if (colon >= 0) {
            return line.substring(colon + 1).trim();
        }
        int dot = line.indexOf('.');
        if (dot > 0 && dot <= 3) {
            return line.substring(dot + 1).trim();
        }
        int dash = line.indexOf('-');
        if (dash > 0 && dash <= 12) {
            return line.substring(dash + 1).trim();
        }
        return line.trim();
    }

    private List<String> sourceHeaders(Row headerRow) {
        if (headerRow == null) {
            return List.of();
        }
        List<String> headers = new ArrayList<>();
        for (Cell cell : headerRow) {
            headers.add(cellText(cell));
        }
        return headers;
    }

    private String mappedHeaderKey(String canonicalKey, Map<String, String> columnMapping) {
        String mappedHeader = columnMapping.get(canonicalKey);
        return mappedHeader == null || mappedHeader.isBlank() ? canonicalKey : normalizeHeader(mappedHeader);
    }

    private String normalizeHeader(String value) {
        String withoutMarks = Normalizer.normalize(value == null ? "" : value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "")
                .replace('đ', 'd')
                .replace('Đ', 'D');
        String normalized = withoutMarks.trim().toLowerCase(Locale.ROOT)
                .replace("_", "")
                .replace("-", "")
                .replace(" ", "");
        return switch (normalized) {
            case "question", "cauhoi", "noidung", "stem" -> "stem";
            case "a", "optiona", "dapan a", "dapana" -> "optiona";
            case "b", "optionb", "dapan b", "dapanb" -> "optionb";
            case "c", "optionc", "dapan c", "dapanc" -> "optionc";
            case "d", "optiond", "dapan d", "dapand" -> "optiond";
            case "correct", "correctanswer", "dapandung" -> "correctanswer";
            case "giaithich", "explanation" -> "explanation";
            case "chude", "danhmuc", "topic", "category" -> "topic";
            case "dokho", "difficulty" -> "difficulty";
            case "ngonngu", "language" -> "language";
            case "nguon", "sourcedocument", "source" -> "sourcedocument";
            case "trangthai", "status" -> "status";
            default -> normalized;
        };
    }

    private List<String> validate(QuestionBankImportRowRequest row) {
        List<String> errors = new ArrayList<>();
        if (isBlank(row.stem())) {
            errors.add("Thiếu nội dung câu hỏi");
        }
        if (isBlank(row.optionA()) || isBlank(row.optionB()) || isBlank(row.optionC()) || isBlank(row.optionD())) {
            errors.add("Thiếu một hoặc nhiều phương án A-D");
        }
        String answer = row.correctAnswer() == null ? "" : row.correctAnswer().trim().toUpperCase(Locale.ROOT);
        if (!List.of("A", "B", "C", "D").contains(answer)) {
            errors.add("Đáp án đúng phải là A, B, C hoặc D");
        }
        String status = row.status() == null || row.status().isBlank() ? "APPROVED" : row.status().trim().toUpperCase(Locale.ROOT);
        if (!List.of("DRAFT", "APPROVED", "REJECTED").contains(status)) {
            errors.add("Trạng thái import chỉ được là DRAFT, APPROVED hoặc REJECTED");
        }
        return errors;
    }

    private UpsertQuestionBankQuestionRequest toUpsertRequest(QuestionBankImportRowRequest row) {
        return new UpsertQuestionBankQuestionRequest(
                row.stem(),
                row.optionA(),
                row.optionB(),
                row.optionC(),
                row.optionD(),
                row.correctAnswer(),
                row.explanation(),
                row.topic(),
                row.difficulty(),
                row.language(),
                row.sourceDocument(),
                row.status() == null || row.status().isBlank() ? "APPROVED" : row.status()
        );
    }

    private QuestionBankImportRowResultResponse toResult(
            QuestionBankImportRowRequest row,
            Long createdQuestionId,
            List<String> errors
    ) {
        return toResult(row, createdQuestionId, errors, false);
    }

    private QuestionBankImportRowResultResponse toResult(
            QuestionBankImportRowRequest row,
            Long createdQuestionId,
            List<String> errors,
            boolean skipped
    ) {
        return new QuestionBankImportRowResultResponse(
                row.rowNumber(),
                row.stem(),
                row.optionA(),
                row.optionB(),
                row.optionC(),
                row.optionD(),
                row.correctAnswer(),
                row.explanation(),
                row.topic(),
                row.difficulty(),
                row.language(),
                row.sourceDocument(),
                row.status() == null || row.status().isBlank() ? "APPROVED" : row.status(),
                errors.isEmpty() || skipped,
                skipped,
                createdQuestionId,
                errors
        );
    }

    private DuplicateHandlingMode parseDuplicateMode(String value) {
        if (value == null || value.isBlank()) {
            return DuplicateHandlingMode.BLOCK;
        }
        try {
            return DuplicateHandlingMode.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (Exception ex) {
            throw new BadRequestException("Chế độ xử lý trùng lặp không hợp lệ");
        }
    }

    private String safeMessage(Exception ex) {
        return ex.getMessage() == null ? "Không thể lưu câu hỏi" : ex.getMessage();
    }

    private Map<String, String> parseColumnMapping(String columnMappingJson) {
        if (columnMappingJson == null || columnMappingJson.isBlank()) {
            return Map.of();
        }
        try {
            Map<String, String> raw = objectMapper.readValue(columnMappingJson, new TypeReference<Map<String, String>>() {});
            Map<String, String> normalized = new HashMap<>();
            raw.forEach((key, value) -> {
                if (key != null && value != null && !value.isBlank()) {
                    normalized.put(normalizeHeader(key), value.trim());
                }
            });
            return normalized;
        } catch (Exception ex) {
            throw new BadRequestException("Mapping cột import không hợp lệ");
        }
    }

    private List<String> parseCsvLine(String line) {
        List<String> values = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        boolean quoted = false;
        for (int index = 0; index < line.length(); index++) {
            char ch = line.charAt(index);
            if (ch == '"') {
                if (quoted && index + 1 < line.length() && line.charAt(index + 1) == '"') {
                    current.append('"');
                    index++;
                } else {
                    quoted = !quoted;
                }
            } else if (ch == ',' && !quoted) {
                values.add(current.toString().trim());
                current.setLength(0);
            } else {
                current.append(ch);
            }
        }
        values.add(current.toString().trim());
        return values;
    }

    private boolean rowIsBlank(Row row) {
        for (int index = 0; index < EXPORT_HEADERS.size(); index++) {
            if (!cellText(row, index).isBlank()) {
                return false;
            }
        }
        return true;
    }

    private String cellText(Row row, Integer cellIndex) {
        if (row == null || cellIndex == null) {
            return "";
        }
        return cellText(row.getCell(cellIndex));
    }

    private String cellText(Cell cell) {
        if (cell == null) {
            return "";
        }
        cell.setCellType(CellType.STRING);
        return cell.getStringCellValue() == null ? "" : cell.getStringCellValue().trim();
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private String blank(String value) {
        return value == null ? "" : value;
    }

    @FunctionalInterface
    private interface ValueLookup {
        String get(String key);
    }

    private record ParsedRows(
            List<QuestionBankImportRowRequest> rows,
            List<String> sourceHeaders
    ) {
    }

    private final class DocxQuestionBuilder {
        private String stem;
        private String optionA;
        private String optionB;
        private String optionC;
        private String optionD;
        private String correctAnswer;
        private String explanation;
        private String topic;
        private String difficulty;
        private String language;
        private String sourceDocument;
        private String status;

        void accept(String line) {
            String label = normalizeHeader(labelPart(line));
            String value = valuePart(line);
            switch (label) {
                case "question", "cauhoi", "noidung", "stem" -> stem = value;
                case "a", "optiona", "dapana" -> optionA = value;
                case "b", "optionb", "dapanb" -> optionB = value;
                case "c", "optionc", "dapanc" -> optionC = value;
                case "d", "optiond", "dapand" -> optionD = value;
                case "correct", "correctanswer", "dapandung", "dapan" -> correctAnswer = value;
                case "giaithich", "explanation" -> explanation = value;
                case "chude", "danhmuc", "topic", "category" -> topic = value;
                case "dokho", "difficulty" -> difficulty = value;
                case "ngonngu", "language" -> language = value;
                case "nguon", "sourcedocument", "source" -> sourceDocument = value;
                case "trangthai", "status" -> status = value;
                default -> {
                    if (stem == null || stem.isBlank()) {
                        stem = value;
                    } else {
                        stem = stem + " " + value;
                    }
                }
            }
        }

        boolean hasContent() {
            return !isBlank(stem)
                    || !isBlank(optionA)
                    || !isBlank(optionB)
                    || !isBlank(optionC)
                    || !isBlank(optionD)
                    || !isBlank(correctAnswer);
        }

        QuestionBankImportRowRequest toRow(int rowNumber) {
            return new QuestionBankImportRowRequest(
                    rowNumber,
                    stem,
                    optionA,
                    optionB,
                    optionC,
                    optionD,
                    correctAnswer,
                    explanation,
                    topic,
                    difficulty,
                    language,
                    sourceDocument,
                    status
            );
        }
    }
}
