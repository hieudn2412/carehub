package vn.vietduc.carehubbackend.form.submission.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.vietduc.carehubbackend.exception.ResourceNotFoundException;
import vn.vietduc.carehubbackend.form.entity.FormQuestion;
import vn.vietduc.carehubbackend.form.entity.FormVersion;
import vn.vietduc.carehubbackend.form.repository.FormVersionRepository;
import vn.vietduc.carehubbackend.form.submission.entity.*;
import vn.vietduc.carehubbackend.form.submission.repository.FormSubmissionRepository;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.*;

@Service
@RequiredArgsConstructor
public class FormSubmissionExcelExportService {
    private static final ZoneId EXPORT_ZONE = ZoneId.of("Asia/Bangkok");
    private static final String EXCEL_CONTENT_TYPE =
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    private final FormSubmissionRepository submissionRepository;
    private final FormVersionRepository versionRepository;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public ExportFile exportVersion(Long formId, Long versionId, FormSubmissionResult result) {
        FormVersion version = versionRepository.findByIdAndForm_Id(versionId, formId)
                .orElseThrow(() -> new ResourceNotFoundException("Form version not found"));
        List<FormSubmission> submissions = submissionRepository.findSubmittedForVersionExport(
                formId, versionId, result);
        return createExport(version, submissions, result == null ? null : result.name());
    }

    @Transactional(readOnly = true)
    public ExportFile exportVersion(
            Long formId,
            Long versionId,
            String keyword,
            Long submittedByUserId,
            Long departmentId,
            String result,
            LocalDate dateFrom,
            LocalDate dateTo
    ) {
        FormVersion version = versionRepository.findByIdAndForm_Id(versionId, formId)
                .orElseThrow(() -> new ResourceNotFoundException("Form version not found"));
        FormSubmissionHistoryCriteria criteria = FormSubmissionHistoryCriteria.of(
                keyword, submittedByUserId, departmentId, result, dateFrom, dateTo);
        List<FormSubmission> submissions = submissionRepository.findHistoryForVersionExport(
                formId,
                versionId,
                criteria.keyword(),
                criteria.submittedByUserId(),
                criteria.departmentId(),
                criteria.filterResults(),
                criteria.results(),
                criteria.fromInclusive(),
                criteria.toExclusive()
        );

        return createExport(version, submissions, result);
    }

    private ExportFile createExport(
            FormVersion version,
            List<FormSubmission> submissions,
            String result
    ) {
        try (Workbook workbook = new XSSFWorkbook();
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            Styles styles = createStyles(workbook);
            writeSummarySheet(workbook, version, submissions, styles);
            writeAnswerSheet(workbook, version, submissions, styles);
            workbook.write(output);
            return new ExportFile(filename(version, result), EXCEL_CONTENT_TYPE, output.toByteArray());
        } catch (IOException exception) {
            throw new IllegalStateException("Could not generate form version Excel export", exception);
        }
    }

    private void writeSummarySheet(
            Workbook workbook,
            FormVersion version,
            List<FormSubmission> submissions,
            Styles styles
    ) {
        Sheet sheet = workbook.createSheet("Tổng hợp kết quả");
        String[] headers = {
                "Tên bảng kiểm", "Phiên bản", "Mã nhân viên", "Họ và tên",
                "Khoa/Phòng", "Chức danh", "Mã manager", "Manager thực hiện", "Ngày nộp",
                "Kết quả", "Điểm quy đổi"
        };
        writeHeader(sheet, headers, styles.header());

        int rowIndex = 1;
        for (FormSubmission submission : submissions) {
            Row row = sheet.createRow(rowIndex++);
            FormSubmissionContext subject = submission.getSubjectContext();
            int column = 0;
            writeText(row, column++, checklistTitle(version));
            writeNumber(row, column++, version.getVersionNumber(), styles.integer());
            writeText(row, column++, subject == null ? null : subject.getEmployeeCode());
            writeText(row, column++, subject == null ? null : subject.getFullName());
            writeText(row, column++, subject == null ? null : subject.getDepartment());
            writeText(row, column++, subject == null ? null : subject.getPosition());
            writeText(row, column++, submission.getSubmittedBy().getEmployeeCode());
            writeText(row, column++, submission.getSubmittedBy().getName());
            writeDate(row, column++, submission, styles.dateTime());
            writeText(row, column++, resultLabel(submission.getResult()));
            writeDecimal(row, column, submission.getConvertedScore(), styles.decimal());
        }

        finishSheet(sheet, new int[] {
                30, 12, 16, 26, 24, 22, 16, 26, 20, 26, 15
        });
    }

    private String checklistTitle(FormVersion version) {
        if (version.getTitle() != null && !version.getTitle().isBlank()) {
            return version.getTitle();
        }
        if (version.getForm() != null && version.getForm().getTitle() != null) {
            return version.getForm().getTitle();
        }
        return "";
    }

    private void writeAnswerSheet(
            Workbook workbook,
            FormVersion version,
            List<FormSubmission> submissions,
            Styles styles
    ) {
        Sheet sheet = workbook.createSheet("Chi tiết câu trả lời");
        List<FormQuestion> questions = orderedQuestions(version);
        String[] headers = answerSheetHeaders(questions);
        writeHeader(sheet, headers, styles.header());

        int rowIndex = 1;
        for (FormSubmission submission : submissions) {
            Map<UUID, FormAnswer> answersByQuestion = new HashMap<>();
            submission.getAnswers().forEach(answer ->
                    answersByQuestion.put(answer.getQuestion().getQuestionKey(), answer));

            Row row = sheet.createRow(rowIndex++);
            FormSubmissionContext subject = submission.getSubjectContext();
            int column = 0;
            writeText(row, column++, subject == null ? null : subject.getEmployeeCode());
            writeText(row, column++, subject == null ? null : subject.getFullName());
            writeDate(row, column++, submission, styles.dateTime());
            writeDecimal(row, column++, submission.getConvertedScore(), styles.decimal());
            writeText(row, column++, resultLabel(submission.getResult()));
            for (FormQuestion question : questions) {
                FormAnswer answer = answersByQuestion.get(question.getQuestionKey());
                writeText(row, column++, answerValue(answer));
            }
        }

        finishSheet(sheet, answerSheetWidths(questions.size()));
    }

    private List<FormQuestion> orderedQuestions(FormVersion version) {
        return version.getSections().stream()
                .sorted(Comparator.comparing(section -> section.getDisplayOrder()))
                .flatMap(section -> section.getQuestions().stream()
                        .sorted(Comparator.comparing(FormQuestion::getDisplayOrder)))
                .toList();
    }

    private String[] answerSheetHeaders(List<FormQuestion> questions) {
        List<String> headers = new ArrayList<>(List.of(
                "Mã NV", "Họ tên", "Ngày nộp", "Tổng điểm", "Kết quả"
        ));
        questions.stream()
                .map(this::questionHeader)
                .forEach(headers::add);
        return headers.toArray(String[]::new);
    }

    private String questionHeader(FormQuestion question) {
        return question.getTitle();
    }

    private int[] answerSheetWidths(int questionCount) {
        int[] widths = new int[5 + questionCount];
        widths[0] = 16;
        widths[1] = 28;
        widths[2] = 20;
        widths[3] = 14;
        widths[4] = 26;
        Arrays.fill(widths, 5, widths.length, 36);
        return widths;
    }

    private String answerValue(FormAnswer answer) {
        if (answer == null) return "";
        if (answer.getSelectedOption() != null) {
            return answer.getSelectedOption().getLabel();
        }
        Map<String, Object> value = answer.getAnswerJson();
        if (value == null || value.isEmpty()) return "";
        Object labels = value.get("labels");
        if (labels != null) return displayValue(labels);
        Object label = value.get("label");
        if (label != null) return displayValue(label);
        Object textValue = value.get("textValue");
        if (textValue != null) return displayValue(textValue);
        Object numberValue = value.get("numberValue");
        if (numberValue != null) return displayValue(numberValue);
        Object dateValue = value.get("dateValue");
        if (dateValue != null) return displayValue(dateValue);
        Object timeValue = value.get("timeValue");
        if (timeValue != null) return displayValue(timeValue);
        Object values = value.get("values");
        if (values != null) return displayValue(values);
        Object simpleValue = value.get("value");
        if (simpleValue != null) return displayValue(simpleValue);
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException exception) {
            return value.toString();
        }
    }

    private String displayValue(Object value) {
        if (value instanceof Collection<?> collection) {
            return collection.stream().map(String::valueOf).reduce((left, right) -> left + ", " + right).orElse("");
        }
        return String.valueOf(value);
    }

    private void writeHeader(Sheet sheet, String[] headers, CellStyle style) {
        Row row = sheet.createRow(0);
        row.setHeightInPoints(28);
        for (int index = 0; index < headers.length; index++) {
            Cell cell = row.createCell(index);
            cell.setCellValue(headers[index]);
            cell.setCellStyle(style);
        }
    }

    private void finishSheet(Sheet sheet, int[] widths) {
        sheet.createFreezePane(0, 1);
        sheet.setAutoFilter(new org.apache.poi.ss.util.CellRangeAddress(
                0, Math.max(0, sheet.getLastRowNum()), 0, widths.length - 1));
        for (int index = 0; index < widths.length; index++) {
            sheet.setColumnWidth(index, Math.min(widths[index], 60) * 256);
        }
    }

    private Styles createStyles(Workbook workbook) {
        CellStyle header = workbook.createCellStyle();
        header.setFillForegroundColor(IndexedColors.DARK_GREEN.getIndex());
        header.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        header.setAlignment(HorizontalAlignment.CENTER);
        header.setVerticalAlignment(VerticalAlignment.CENTER);
        header.setWrapText(true);
        Font headerFont = workbook.createFont();
        headerFont.setBold(true);
        headerFont.setColor(IndexedColors.WHITE.getIndex());
        header.setFont(headerFont);

        CellStyle dateTime = workbook.createCellStyle();
        dateTime.setDataFormat(workbook.createDataFormat().getFormat("dd/mm/yyyy hh:mm"));
        CellStyle decimal = workbook.createCellStyle();
        decimal.setDataFormat(workbook.createDataFormat().getFormat("0.00"));
        CellStyle integer = workbook.createCellStyle();
        integer.setDataFormat(workbook.createDataFormat().getFormat("0"));
        return new Styles(header, dateTime, decimal, integer);
    }

    private void writeText(Row row, int column, String value) {
        row.createCell(column).setCellValue(value == null ? "" : value);
    }

    private void writeNumber(Row row, int column, Number value, CellStyle style) {
        Cell cell = row.createCell(column);
        if (value != null) cell.setCellValue(value.doubleValue());
        cell.setCellStyle(style);
    }

    private void writeDecimal(Row row, int column, BigDecimal value, CellStyle style) {
        writeNumber(row, column, value, style);
    }

    private void writeDate(Row row, int column, FormSubmission submission, CellStyle style) {
        Cell cell = row.createCell(column);
        if (submission.getSubmittedAt() != null) {
            cell.setCellValue(Date.from(submission.getSubmittedAt()));
        } else if (submission.getUpdatedAt() != null) {
            cell.setCellValue(Date.from(submission.getUpdatedAt().atZone(EXPORT_ZONE).toInstant()));
        }
        cell.setCellStyle(style);
    }

    private String resultLabel(FormSubmissionResult result) {
        if (result == null) return "Chưa tính điểm";
        return switch (result) {
            case PASSED -> "Đạt";
            case FAILED_SCORE -> "Không đạt điểm";
            case FAILED_CRITICAL -> "Không đạt câu trọng yếu";
        };
    }

    private String filename(FormVersion version, String result) {
        String code = version.getForm().getCode() == null ? "bang-kiem" : version.getForm().getCode();
        String safeCode = code.replaceAll("[^A-Za-z0-9._-]", "-");
        String suffix = result == null || result.isBlank() ? "tat-ca" : result.toLowerCase(Locale.ROOT);
        return "ket-qua-" + safeCode + "-v" + version.getVersionNumber() + "-" + suffix + ".xlsx";
    }

    public record ExportFile(String filename, String contentType, byte[] content) {
    }

    private record Styles(CellStyle header, CellStyle dateTime, CellStyle decimal, CellStyle integer) {
    }
}
