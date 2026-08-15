package vn.vietduc.carehubbackend.questiongeneration.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.DataValidation;
import org.apache.poi.ss.usermodel.DataValidationConstraint;
import org.apache.poi.ss.usermodel.DataValidationHelper;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.Name;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.apache.poi.ss.util.CellRangeAddressList;
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
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionCategory;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionCategoryStatus;
import vn.vietduc.carehubbackend.questiongeneration.repository.QuestionCategoryRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.QuestionDocumentRepository;
import vn.vietduc.carehubbackend.training.entity.ProfessionalField;
import vn.vietduc.carehubbackend.training.repository.ProfessionalFieldRepository;

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
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class QuestionBankImportExportService {
    private static final List<String> IMPORT_HEADERS = List.of(
            "Danh mục kiến thức",
            "Lĩnh vực chuyên môn",
            "Nội dung câu hỏi",
            "Phương án A",
            "Phương án B",
            "Phương án C",
            "Phương án D",
            "Đáp án đúng",
            "Mức độ nhận thức",
            "Giải thích",
            "Nguồn câu hỏi"
    );
    private static final List<String> EXPORT_HEADERS = List.of(
            "Danh mục kiến thức", "Lĩnh vực chuyên môn", "Nội dung câu hỏi",
            "Phương án A", "Phương án B", "Phương án C", "Phương án D",
            "Đáp án đúng", "Mức độ nhận thức", "Giải thích", "Nguồn câu hỏi",
            "Trạng thái", "Ngày cập nhật"
    );
    private static final int TEMPLATE_LAST_ROW = 5000;
    private static final Pattern CATEGORY_CODE_PATTERN = Pattern.compile("^\\s*\\[([^]]+)]");

    private final QuestionBankService questionBankService;
    private final EvaluationImportHistoryService importHistoryService;
    private final ObjectMapper objectMapper;
    private final QuestionCategoryRepository categoryRepository;
    private final ProfessionalFieldRepository professionalFieldRepository;
    private final QuestionDocumentRepository questionDocumentRepository;

    @Autowired
    public QuestionBankImportExportService(
            QuestionBankService questionBankService,
            EvaluationImportHistoryService importHistoryService,
            ObjectMapper objectMapper,
            QuestionCategoryRepository categoryRepository,
            ProfessionalFieldRepository professionalFieldRepository,
            QuestionDocumentRepository questionDocumentRepository
    ) {
        this.questionBankService = questionBankService;
        this.importHistoryService = importHistoryService;
        this.objectMapper = objectMapper;
        this.categoryRepository = categoryRepository;
        this.professionalFieldRepository = professionalFieldRepository;
        this.questionDocumentRepository = questionDocumentRepository;
    }

    /** Compatibility constructor for focused unit tests and legacy callers. */
    public QuestionBankImportExportService(
            QuestionBankService questionBankService,
            EvaluationImportHistoryService importHistoryService,
            ObjectMapper objectMapper,
            QuestionCategoryRepository categoryRepository
    ) {
        this(questionBankService, importHistoryService, objectMapper, categoryRepository, null, null);
    }

    private enum DuplicateHandlingMode {
        BLOCK,
        SKIP_DUPLICATES,
        IMPORT_DUPLICATES_AS_DRAFT
    }

    @Transactional(readOnly = true)
    public byte[] importTemplateXlsx() {
        try (Workbook workbook = new XSSFWorkbook(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            Sheet sheet = workbook.createSheet("Câu hỏi");
            CellStyle headerStyle = workbook.createCellStyle();
            Font headerFont = workbook.createFont();
            headerFont.setBold(true);
            headerFont.setColor(IndexedColors.WHITE.getIndex());
            headerStyle.setFont(headerFont);
            headerStyle.setFillForegroundColor(IndexedColors.TEAL.getIndex());
            headerStyle.setFillPattern(org.apache.poi.ss.usermodel.FillPatternType.SOLID_FOREGROUND);

            Row header = sheet.createRow(0);
            for (int index = 0; index < IMPORT_HEADERS.size(); index++) {
                header.createCell(index).setCellValue(IMPORT_HEADERS.get(index));
                header.getCell(index).setCellStyle(headerStyle);
            }
            sheet.createFreezePane(0, 1);

            Sheet reference = workbook.createSheet("Danh mục tham chiếu");
            Row referenceHeader = reference.createRow(0);
            List<String> referenceHeaders = List.of("Giá trị chọn", "Mã danh mục", "Tên danh mục");
            for (int index = 0; index < referenceHeaders.size(); index++) {
                referenceHeader.createCell(index).setCellValue(referenceHeaders.get(index));
                referenceHeader.getCell(index).setCellStyle(headerStyle);
            }
            List<QuestionCategory> categories = categoryRepository
                    .findByStatusOrderByNameAsc(QuestionCategoryStatus.ACTIVE);
            for (int index = 0; index < categories.size(); index++) {
                QuestionCategory category = categories.get(index);
                Row row = reference.createRow(index + 1);
                row.createCell(0).setCellValue(categoryLabel(category));
                row.createCell(1).setCellValue(blank(category.getCode()));
                row.createCell(2).setCellValue(blank(category.getName()));
            }
            if (categories.isEmpty()) {
                reference.createRow(1).createCell(0).setCellValue("");
            }
            Name categoryRange = workbook.createName();
            categoryRange.setNameName("DanhMucKienThuc");
            categoryRange.setRefersToFormula("'Danh mục tham chiếu'!$A$2:$A$" + Math.max(2, categories.size() + 1));
            List<ProfessionalField> fields = professionalFieldRepository == null
                    ? List.of()
                    : professionalFieldRepository.findByActiveTrueOrderByNameAsc();
            int fieldStart = categories.size() + 3;
            Row fieldTitle = reference.createRow(fieldStart - 1);
            fieldTitle.createCell(0).setCellValue("Lĩnh vực chuyên môn");
            fieldTitle.createCell(0).setCellStyle(headerStyle);
            fieldTitle.createCell(1).setCellValue("Mã lĩnh vực");
            fieldTitle.createCell(1).setCellStyle(headerStyle);
            fieldTitle.createCell(2).setCellValue("Tên lĩnh vực");
            fieldTitle.createCell(2).setCellStyle(headerStyle);
            for (int index = 0; index < fields.size(); index++) {
                ProfessionalField field = fields.get(index);
                Row row = reference.createRow(fieldStart + index);
                row.createCell(0).setCellValue(fieldLabel(field));
                row.createCell(1).setCellValue(blank(field.getCode()));
                row.createCell(2).setCellValue(blank(field.getName()));
            }
            Name fieldRange = workbook.createName();
            fieldRange.setNameName("LinhVucChuyenMon");
            fieldRange.setRefersToFormula("'Danh mục tham chiếu'!$A$" + fieldStart + ":$A$" + Math.max(fieldStart, fieldStart + fields.size() - 1));
            addFormulaValidation(sheet, 0, "DanhMucKienThuc");
            addFormulaValidation(sheet, 1, "LinhVucChuyenMon");
            addListValidation(sheet, 7, new String[]{"A", "B", "C", "D"});
            addListValidation(sheet, 8, new String[]{"Kiến thức nền tảng", "Áp dụng lâm sàng", "Tư duy và phân tích lâm sàng"});
            addListValidation(sheet, 9, new String[]{"Dễ", "Trung bình", "Khó"});

            Sheet guide = workbook.createSheet("Hướng dẫn");
            List<String> instructions = List.of(
                    "Các cột bắt buộc: Danh mục kiến thức, Lĩnh vực chuyên môn, Nội dung câu hỏi, Phương án A-D, Đáp án đúng và Mức độ nhận thức.",
                    "Chọn danh mục và lĩnh vực từ danh sách; hệ thống liên kết bằng mã trong dấu [MÃ], không liên kết bằng tên.",
                    "Đáp án đúng chỉ nhận A, B, C hoặc D. Mức độ nhận thức gồm Kiến thức nền tảng, Áp dụng lâm sàng, Tư duy và phân tích lâm sàng.",
                    "Giải thích và Nguồn câu hỏi có thể để trống; nguồn trống sẽ lấy tên file import.",
                    "Dòng không nhận diện được danh mục sẽ bị bỏ qua; dòng sai dữ liệu sẽ được báo lỗi.",
                    "Khi gặp câu trùng, chọn chặn, bỏ qua hoặc nhập bản trùng dưới dạng bản nháp trên màn hình preview.",
                    "Không thêm câu hỏi ví dụ vào sheet Câu hỏi; số dòng Excel được dùng để đối chiếu lỗi."
            );
            for (int index = 0; index < instructions.size(); index++) {
                guide.createRow(index).createCell(0).setCellValue(instructions.get(index));
            }
            int[] widths = {48, 48, 60, 32, 32, 32, 32, 16, 34, 18, 55, 36};
            for (int index = 0; index < widths.length; index++) {
                sheet.setColumnWidth(index, widths[index] * 256);
            }
            for (int index = 0; index < referenceHeaders.size(); index++) reference.autoSizeColumn(index);
            guide.setColumnWidth(0, 110 * 256);
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
            Sheet sheet = workbook.createSheet("Ngân hàng câu hỏi");
            Row header = sheet.createRow(0);
            for (int index = 0; index < EXPORT_HEADERS.size(); index++) {
                header.createCell(index).setCellValue(EXPORT_HEADERS.get(index));
            }
            for (int index = 0; index < questions.size(); index++) {
                QuestionBankQuestionResponse question = questions.get(index);
                Row row = sheet.createRow(index + 1);
                row.createCell(0).setCellValue(categoryLabel(question));
                row.createCell(1).setCellValue(blank(question.professionalFieldName()));
                row.createCell(2).setCellValue(blank(question.stem()));
                row.createCell(3).setCellValue(blank(question.optionA()));
                row.createCell(4).setCellValue(blank(question.optionB()));
                row.createCell(5).setCellValue(blank(question.optionC()));
                row.createCell(6).setCellValue(blank(question.optionD()));
                row.createCell(7).setCellValue(blank(question.correctAnswer()));
                row.createCell(8).setCellValue(cognitiveText(question.cognitiveLevel()));
                row.createCell(9).setCellValue(blank(question.explanation()));
                row.createCell(10).setCellValue(blank(question.sourceDocument()));
                row.createCell(11).setCellValue(statusText(question.status()));
                row.createCell(12).setCellValue(question.updatedAt() == null ? "" : question.updatedAt().toString());
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
                .map(this::normalizeAndResolve)
                .map(row -> {
                    List<String> errors = validate(row);
                    CategoryResolution resolution = resolveCategory(row);
                    FieldResolution fieldResolution = resolveField(row);
                    if (fieldResolution.field() == null && fieldResolution.reason() != null) {
                        errors.add(fieldResolution.reason());
                    }
                    if (resolution.category() == null && resolution.reason() != null && !errors.contains(resolution.reason())) {
                        errors.add(resolution.reason());
                    }
                    boolean skipped = isOnlyCategoryResolutionError(resolution, errors);
                    return toResult(row, resolution, fieldResolution, null, errors, skipped);
                })
                .toList();
        QuestionBankImportPreviewResponse preview = new QuestionBankImportPreviewResponse(
                null,
                parsed.sourceHeaders(),
                results.size(),
                (int) results.stream().filter(QuestionBankImportRowResultResponse::valid).count(),
                (int) results.stream().filter(row -> !row.valid() && !Boolean.TRUE.equals(row.skipped())).count(),
                (int) results.stream().filter(row -> Boolean.TRUE.equals(row.skipped())).count(),
                results
        );
        return importHistoryService.recordQuestionBankPreview(file, preview, actor);
    }

    /**
     * Mỗi dòng được tạo qua {@code questionBankService.*InNewTransaction} (REQUIRES_NEW) để một dòng lỗi
     * chỉ rollback dòng đó, không đánh dấu rollback-only cho transaction của cả lô import.
     */
    @Transactional
    public QuestionBankImportCommitResponse commit(QuestionBankImportCommitRequest request, String actor) {
        if (request == null || request.rows() == null || request.rows().isEmpty()) {
            throw new BadRequestException("Không có dòng import nào để lưu");
        }
        DuplicateHandlingMode duplicateMode = parseDuplicateMode(request.duplicateHandlingMode());
        List<QuestionBankImportRowResultResponse> results = new ArrayList<>();
        for (QuestionBankImportRowRequest rawRow : request.rows()) {
            QuestionBankImportRowRequest row = normalizeAndResolve(rawRow);
            List<String> errors = validate(row);
            CategoryResolution resolution = resolveCategory(row);
            FieldResolution fieldResolution = resolveField(row);
            if (fieldResolution.field() == null && fieldResolution.reason() != null) {
                errors.add(fieldResolution.reason());
            }
            if (resolution.category() == null && resolution.reason() != null && !errors.contains(resolution.reason())) {
                errors.add(resolution.reason());
            }
            Long createdQuestionId = null;
            boolean skipped = isOnlyCategoryResolutionError(resolution, errors);
            if (errors.isEmpty() && !skipped) {
                try {
                    QuestionBankQuestionResponse created = questionBankService.createInNewTransaction(toUpsertRequest(row, resolution.category(), fieldResolution.field()), actor);
                    createdQuestionId = created.id();
                } catch (ConflictException ex) {
                    if (duplicateMode == DuplicateHandlingMode.SKIP_DUPLICATES) {
                        skipped = true;
                        errors.add("Bỏ qua do trùng mạnh: " + safeMessage(ex));
                    } else if (duplicateMode == DuplicateHandlingMode.IMPORT_DUPLICATES_AS_DRAFT) {
                        try {
                            QuestionBankQuestionResponse created = questionBankService
                                    .createImportDraftAllowingDuplicateInNewTransaction(toUpsertRequest(row, resolution.category(), fieldResolution.field()), actor);
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
            results.add(toResult(row, resolution, fieldResolution, createdQuestionId, errors, skipped));
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
                rows.add(rowFromMap(
                        rowIndex + 1,
                        key -> cellText(row, headers.get(mappedHeaderKey(key, columnMapping))),
                        file.getOriginalFilename()
                ));
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
            }, file.getOriginalFilename()));
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
                    "Câu hỏi", "A", "B", "C", "D", "Đáp án", "Giải thích", "Chủ đề", "Mức độ nhận thức", "Ngôn ngữ", "Nguồn", "Trạng thái"
            ));
        }
    }

    private QuestionBankImportRowRequest rowFromMap(int rowNumber, ValueLookup lookup, String defaultSource) {
        String source = lookup.get("sourcedocument");
        String categoryReference = lookup.get("categoryreference");
        String fieldReference = lookup.get("professionalfieldreference");
        return new QuestionBankImportRowRequest(
                rowNumber,
                lookup.get("stem"),
                lookup.get("optiona"),
                lookup.get("optionb"),
                lookup.get("optionc"),
                lookup.get("optiond"),
                lookup.get("correctanswer"),
                lookup.get("explanation"),
                null,
                "vi",
                isBlank(source) ? defaultSource : source,
                "APPROVED",
                null,
                categoryReference,
                null,
                fieldReference,
                lookup.get("cognitivelevel")
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
            case "question", "cauhoi", "noidung", "noidungcauhoi", "stem" -> "stem";
            case "a", "optiona", "dapana", "phuongana" -> "optiona";
            case "b", "optionb", "dapanb", "phuonganb" -> "optionb";
            case "c", "optionc", "dapanc", "phuonganc" -> "optionc";
            case "d", "optiond", "dapand", "phuongand" -> "optiond";
            case "correct", "correctanswer", "dapandung" -> "correctanswer";
            case "giaithich", "explanation" -> "explanation";
            case "chude", "danhmuc", "danhmuckienthuc", "topic", "category", "categoryreference" -> "categoryreference";
            case "linhvuc", "linhvucchuyenmon", "professionalfield", "professionalfieldreference", "field" -> "professionalfieldreference";
            case "mucdonhanthuc", "mucdophanloai", "cognitivelevel", "cognitive",
                    "dokho", "difficulty" -> "cognitivelevel";
            case "ngonngu", "language" -> "language";
            case "nguon", "nguoncauhoi", "sourcedocument", "source" -> "sourcedocument";
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
        if (professionalFieldRepository != null && isBlank(row.professionalFieldReference()) && row.professionalFieldId() == null) {
            errors.add("Thiếu lĩnh vực chuyên môn");
        }
        if (parseCognitiveLevel(row.cognitiveLevel()) == null) {
            errors.add("Mức độ nhận thức phải là Kiến thức nền tảng, Áp dụng lâm sàng hoặc Tư duy và phân tích lâm sàng");
        }
        return errors;
    }

    private UpsertQuestionBankQuestionRequest toUpsertRequest(
            QuestionBankImportRowRequest row,
            QuestionCategory category,
            ProfessionalField field
    ) {
        return new UpsertQuestionBankQuestionRequest(
                row.stem(),
                row.optionA(),
                row.optionB(),
                row.optionC(),
                row.optionD(),
                row.correctAnswer(),
                row.explanation(),
                "vi",
                row.sourceDocument(),
                "APPROVED",
                category.getId(),
                field == null ? null : field.getId(),
                normalizeCognitive(row.cognitiveLevel()),
                null
        );
    }

    private QuestionBankImportRowResultResponse toResult(
            QuestionBankImportRowRequest row,
            CategoryResolution resolution,
            FieldResolution fieldResolution,
            Long createdQuestionId,
            List<String> errors,
            boolean skipped
    ) {
        QuestionCategory category = resolution.category();
        ProfessionalField field = fieldResolution == null ? null : fieldResolution.field();
        return new QuestionBankImportRowResultResponse(
                row.rowNumber(),
                row.stem(),
                row.optionA(),
                row.optionB(),
                row.optionC(),
                row.optionD(),
                row.correctAnswer(),
                row.explanation(),
                category == null ? null : category.getName(),
                "vi",
                row.sourceDocument(),
                "APPROVED",
                errors.isEmpty() && !skipped,
                skipped,
                createdQuestionId,
                errors,
                category == null ? null : category.getId(),
                category == null ? null : category.getCode(),
                category == null ? null : category.getName(),
                field == null ? null : field.getId(),
                field == null ? null : field.getCode(),
                field == null ? null : field.getName(),
                category != null,
                skipped ? resolution.reason() : null,
                row.categoryReference(),
                row.professionalFieldReference(),
                normalizeCognitive(row.cognitiveLevel()),
                null,
                null
        );
    }

    private QuestionBankImportRowRequest normalizeAndResolve(QuestionBankImportRowRequest row) {
        CategoryResolution resolution = resolveCategory(row);
        QuestionCategory category = resolution.category();
        return new QuestionBankImportRowRequest(
                row.rowNumber(), row.stem(), row.optionA(), row.optionB(), row.optionC(), row.optionD(),
                row.correctAnswer() == null ? null : row.correctAnswer().trim().toUpperCase(Locale.ROOT),
                row.explanation(), category == null ? null : category.getName(), "vi",
                row.sourceDocument(), "APPROVED", category == null ? row.categoryId() : category.getId(),
                row.categoryReference(), row.professionalFieldId(), row.professionalFieldReference(),
                normalizeCognitive(row.cognitiveLevel())
        );
    }

    private CategoryResolution resolveCategory(QuestionBankImportRowRequest row) {
        if (row.categoryId() != null) {
            return categoryRepository.findById(row.categoryId())
                    .filter(category -> category.getStatus() == QuestionCategoryStatus.ACTIVE)
                    .map(category -> new CategoryResolution(category, null))
                    .orElseGet(() -> new CategoryResolution(null, "Danh mục không tồn tại hoặc đã ngừng sử dụng"));
        }
        String reference = blank(row.categoryReference()).trim();
        if (reference.isBlank()) {
            return new CategoryResolution(null, "Thiếu danh mục kiến thức");
        }
        Matcher matcher = CATEGORY_CODE_PATTERN.matcher(reference);
        if (matcher.find()) {
            String code = matcher.group(1).trim();
            return categoryRepository.findByCodeIgnoreCase(code)
                    .filter(category -> category.getStatus() == QuestionCategoryStatus.ACTIVE)
                    .map(category -> new CategoryResolution(category, null))
                    .orElseGet(() -> new CategoryResolution(null, "Không nhận diện được mã danh mục [" + code + "]"));
        }
        Optional<QuestionCategory> byCode = categoryRepository.findByCodeIgnoreCase(reference)
                .filter(category -> category.getStatus() == QuestionCategoryStatus.ACTIVE);
        if (byCode.isPresent()) {
            return new CategoryResolution(byCode.get(), null);
        }
        List<QuestionCategory> byName = categoryRepository
                .findByStatusOrderByNameAsc(QuestionCategoryStatus.ACTIVE).stream()
                .filter(category -> normalizeText(category.getName()).equals(normalizeText(reference)))
                .toList();
        if (byName.size() == 1) {
            return new CategoryResolution(byName.get(0), null);
        }
        return new CategoryResolution(null, byName.isEmpty()
                ? "Không nhận diện được danh mục: " + reference
                : "Tên danh mục bị trùng; vui lòng chọn giá trị có [MÃ]");
    }

    private FieldResolution resolveField(QuestionBankImportRowRequest row) {
        if (row.professionalFieldId() != null) {
            if (professionalFieldRepository == null) {
                return new FieldResolution(null, null);
            }
            return professionalFieldRepository.findById(row.professionalFieldId())
                    .filter(ProfessionalField::isActive)
                    .map(field -> new FieldResolution(field, null))
                    .orElseGet(() -> new FieldResolution(null, "Lĩnh vực không tồn tại hoặc đã ngừng sử dụng"));
        }
        String reference = blank(row.professionalFieldReference()).trim();
        if (reference.isBlank()) {
            if (professionalFieldRepository == null) {
                return new FieldResolution(null, null);
            }
            return new FieldResolution(null, "Thiếu lĩnh vực chuyên môn");
        }
        Matcher matcher = CATEGORY_CODE_PATTERN.matcher(reference);
        if (matcher.find()) {
            reference = matcher.group(1).trim();
        }
        String normalizedReference = normalizeText(reference);
        Optional<ProfessionalField> byCode = professionalFieldRepository.findByCode(reference)
                .filter(ProfessionalField::isActive);
        if (byCode.isPresent()) {
            return new FieldResolution(byCode.get(), null);
        }
        List<ProfessionalField> byName = professionalFieldRepository.findByActiveTrueOrderByNameAsc().stream()
                .filter(field -> normalizeText(field.getName()).equals(normalizedReference))
                .toList();
        if (byName.size() == 1) {
            return new FieldResolution(byName.get(0), null);
        }
        return new FieldResolution(null, byName.isEmpty()
                ? "Không nhận diện được lĩnh vực: " + row.professionalFieldReference()
                : "Tên lĩnh vực bị trùng; vui lòng chọn giá trị có [MÃ]");
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

    private void addFormulaValidation(Sheet sheet, int column, String rangeName) {
        DataValidationHelper helper = sheet.getDataValidationHelper();
        DataValidationConstraint constraint = helper.createFormulaListConstraint(rangeName);
        addValidation(sheet, column, helper, constraint);
    }

    private void addListValidation(Sheet sheet, int column, String[] values) {
        DataValidationHelper helper = sheet.getDataValidationHelper();
        DataValidationConstraint constraint = helper.createExplicitListConstraint(values);
        addValidation(sheet, column, helper, constraint);
    }

    private void addValidation(
            Sheet sheet, int column, DataValidationHelper helper, DataValidationConstraint constraint
    ) {
        CellRangeAddressList range = new CellRangeAddressList(1, TEMPLATE_LAST_ROW, column, column);
        DataValidation validation = helper.createValidation(constraint, range);
        validation.setShowErrorBox(true);
        validation.setSuppressDropDownArrow(false);
        sheet.addValidationData(validation);
    }

    private String categoryLabel(QuestionCategory category) {
        if (category == null) return "";
        return "[" + blank(category.getCode()) + "] " + blank(category.getName());
    }

    private String fieldLabel(ProfessionalField field) {
        if (field == null) return "";
        return "[" + blank(field.getCode()) + "] " + blank(field.getName());
    }

    private String categoryLabel(QuestionBankQuestionResponse question) {
        if (question == null || isBlank(question.categoryCode())) return "";
        return "[" + question.categoryCode() + "] " + blank(question.categoryName());
    }

    private String normalizeCognitive(String value) {
        return switch (normalizeText(value)) {
            case "foundation", "kien thuc nen tang", "de", "easy" -> "FOUNDATION";
            case "clinical application", "ap dung lam sang", "trung binh", "medium" -> "CLINICAL_APPLICATION";
            case "clinical reasoning analysis", "tu duy va phan tich lam sang", "kho", "hard" -> "CLINICAL_REASONING_ANALYSIS";
            default -> blank(value).trim().toUpperCase(Locale.ROOT).replace(' ', '_');
        };
    }

    private String cognitiveText(String value) {
        return switch (blank(value).trim().toUpperCase(Locale.ROOT)) {
            case "FOUNDATION" -> "Kiến thức nền tảng";
            case "CLINICAL_APPLICATION" -> "Áp dụng lâm sàng";
            case "CLINICAL_REASONING_ANALYSIS" -> "Tư duy và phân tích lâm sàng";
            default -> blank(value);
        };
    }

    private String parseCognitiveLevel(String value) {
        String normalized = normalizeCognitive(value);
        return List.of("FOUNDATION", "CLINICAL_APPLICATION", "CLINICAL_REASONING_ANALYSIS").contains(normalized)
                ? normalized : null;
    }

    private String statusText(String value) {
        return switch (blank(value).trim().toUpperCase(Locale.ROOT)) {
            case "APPROVED" -> "Đã duyệt";
            case "DRAFT" -> "Bản nháp";
            case "REJECTED" -> "Từ chối";
            case "INACTIVE" -> "Tạm ngưng";
            case "ARCHIVED" -> "Lưu trữ";
            default -> blank(value);
        };
    }

    private String normalizeText(String value) {
        return Normalizer.normalize(blank(value), Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "")
                .replace('đ', 'd')
                .replace('Đ', 'D')
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", " ")
                .trim();
    }

    private boolean isOnlyCategoryResolutionError(CategoryResolution resolution, List<String> errors) {
        return resolution.category() == null
                && resolution.reason() != null
                && errors.size() == 1
                && errors.contains(resolution.reason());
    }

    private boolean rowIsBlank(Row row) {
        for (int index = 0; index < Math.max(IMPORT_HEADERS.size(), row.getLastCellNum()); index++) {
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

    private record CategoryResolution(QuestionCategory category, String reason) {
    }

    private record FieldResolution(ProfessionalField field, String reason) {
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
        private String cognitiveLevel;
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
                case "chude", "danhmuc", "topic", "category", "categoryreference" -> topic = value;
                case "mucdonhanthuc", "cognitivelevel", "cognitive", "dokho", "difficulty" -> cognitiveLevel = value;
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
                    language,
                    sourceDocument,
                    status,
                    null,
                    topic,
                    null,
                    null,
                    cognitiveLevel
            );
        }
    }
}
