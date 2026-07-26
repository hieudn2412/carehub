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
        Sheet sheet = workbook.createSheet("Tong hop response");
        String[] headers = {
                "Response ID", "Ma bang kiem", "Phien ban", "Ma nhan vien", "Ho va ten",
                "Khoa/Phong", "Chuc danh", "Ma manager", "Manager thuc hien", "Ngay nop",
                "Ket qua", "Diem quy doi", "Diem tho", "Diem toi da", "Diem san",
                "Khong dat cau trong yeu"
        };
        writeHeader(sheet, headers, styles.header());

        int rowIndex = 1;
        for (FormSubmission submission : submissions) {
            Row row = sheet.createRow(rowIndex++);
            FormSubmissionContext subject = submission.getSubjectContext();
            int column = 0;
            writeNumber(row, column++, submission.getId(), styles.integer());
            writeText(row, column++, version.getForm().getCode());
            writeNumber(row, column++, version.getVersionNumber(), styles.integer());
            writeText(row, column++, subject == null ? null : subject.getEmployeeCode());
            writeText(row, column++, subject == null ? null : subject.getFullName());
            writeText(row, column++, subject == null ? null : subject.getDepartment());
            writeText(row, column++, subject == null ? null : subject.getPosition());
            writeText(row, column++, submission.getSubmittedBy().getEmployeeCode());
            writeText(row, column++, submission.getSubmittedBy().getName());
            writeDate(row, column++, submission, styles.dateTime());
            writeText(row, column++, resultLabel(submission.getResult()));
            writeDecimal(row, column++, submission.getConvertedScore(), styles.decimal());
            writeDecimal(row, column++, submission.getTotalScore(), styles.decimal());
            writeDecimal(row, column++, submission.getMaxScore(), styles.decimal());
            writeDecimal(row, column++, submission.getPassingScore(), styles.decimal());
            writeText(row, column, submission.isCriticalFailure() ? "Co" : "Khong");
        }

        finishSheet(sheet, new int[] {
                14, 18, 12, 16, 26, 24, 22, 16, 26, 20, 26, 15, 15, 15, 15, 22
        });
    }

    private void writeAnswerSheet(
            Workbook workbook,
            FormVersion version,
            List<FormSubmission> submissions,
            Styles styles
    ) {
        Sheet sheet = workbook.createSheet("Chi tiet cau tra loi");
        String[] headers = {
                "Response ID", "Ma nhan vien", "Ho va ten", "Ngay nop", "Ket qua",
                "Nhom", "Ma cau hoi", "Noi dung cau hoi", "Cau trong yeu", "Cau tra loi",
                "Diem goc", "Trong so", "Diem sau trong so", "Diem toi da"
        };
        writeHeader(sheet, headers, styles.header());

        List<FormQuestion> questions = version.getSections().stream()
                .sorted(Comparator.comparing(section -> section.getDisplayOrder()))
                .flatMap(section -> section.getQuestions().stream()
                        .sorted(Comparator.comparing(FormQuestion::getDisplayOrder)))
                .toList();
        int rowIndex = 1;
        for (FormSubmission submission : submissions) {
            Map<UUID, FormAnswer> answersByQuestion = new HashMap<>();
            submission.getAnswers().forEach(answer ->
                    answersByQuestion.put(answer.getQuestion().getQuestionKey(), answer));

            for (FormQuestion question : questions) {
                FormAnswer answer = answersByQuestion.get(question.getQuestionKey());
                Row row = sheet.createRow(rowIndex++);
                FormSubmissionContext subject = submission.getSubjectContext();
                int column = 0;
                writeNumber(row, column++, submission.getId(), styles.integer());
                writeText(row, column++, subject == null ? null : subject.getEmployeeCode());
                writeText(row, column++, subject == null ? null : subject.getFullName());
                writeDate(row, column++, submission, styles.dateTime());
                writeText(row, column++, resultLabel(submission.getResult()));
                writeText(row, column++, question.getSection().getTitle());
                writeText(row, column++, question.getCode());
                writeText(row, column++, question.getTitle());
                writeText(row, column++, question.isCritical() ? "Co" : "Khong");
                writeText(row, column++, answerValue(answer));
                writeDecimal(row, column++, answer == null ? null : answer.getScoreValue(), styles.decimal());
                writeDecimal(row, column++, answer == null ? null : answer.getWeight(), styles.decimal());
                writeDecimal(row, column++, answer == null ? null : answer.getWeightedScore(), styles.decimal());
                writeDecimal(row, column, maxScore(submission, question), styles.decimal());
            }
        }

        finishSheet(sheet, new int[] {
                14, 16, 26, 20, 26, 24, 18, 48, 18, 42, 14, 14, 20, 15
        });
    }

    private BigDecimal maxScore(FormSubmission submission, FormQuestion question) {
        Object questions = submission.getScoreBreakdown() == null
                ? null
                : submission.getScoreBreakdown().get("questions");
        if (!(questions instanceof List<?> items)) return null;

        String questionKey = question.getQuestionKey().toString();
        return items.stream()
                .filter(Map.class::isInstance)
                .map(Map.class::cast)
                .filter(item -> questionKey.equals(String.valueOf(item.get("questionKey"))))
                .map(item -> decimal(item.get("maxScore")))
                .filter(Objects::nonNull)
                .findFirst()
                .orElse(null);
    }

    private String answerValue(FormAnswer answer) {
        if (answer == null) return "";
        if (answer.getSelectedOption() != null) {
            return answer.getSelectedOption().getLabel();
        }
        Map<String, Object> value = answer.getAnswerJson();
        if (value == null || value.isEmpty()) return "";
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

    private BigDecimal decimal(Object value) {
        if (value == null) return null;
        try {
            return new BigDecimal(String.valueOf(value));
        } catch (NumberFormatException exception) {
            return null;
        }
    }

    private String resultLabel(FormSubmissionResult result) {
        if (result == null) return "Chua tinh diem";
        return switch (result) {
            case PASSED -> "Dat";
            case FAILED_SCORE -> "Khong dat diem";
            case FAILED_CRITICAL -> "Khong dat cau trong yeu";
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
