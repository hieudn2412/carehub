package vn.vietduc.carehubbackend.questiongeneration.service;

import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;
import vn.vietduc.carehubbackend.exception.BadRequestException;
import vn.vietduc.carehubbackend.exception.ResourceNotFoundException;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.EvaluationImportJobResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.EvaluationImportJobRowResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.QuestionBankImportCommitResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.QuestionBankImportPreviewResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.QuestionBankImportRowResultResponse;
import vn.vietduc.carehubbackend.questiongeneration.entity.EvaluationImportJob;
import vn.vietduc.carehubbackend.questiongeneration.entity.EvaluationImportJobRow;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.EvaluationImportStatus;
import vn.vietduc.carehubbackend.questiongeneration.repository.EvaluationImportJobRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.EvaluationImportJobRowRepository;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class EvaluationImportHistoryService {
    public static final String QUESTION_BANK_IMPORT = "QUESTION_BANK";

    private final EvaluationImportJobRepository jobRepository;
    private final EvaluationImportJobRowRepository rowRepository;

    @Transactional
    public QuestionBankImportPreviewResponse recordQuestionBankPreview(
            MultipartFile file,
            QuestionBankImportPreviewResponse preview,
            String actor
    ) {
        EvaluationImportJob job = jobRepository.save(EvaluationImportJob.builder()
                .importType(QUESTION_BANK_IMPORT)
                .status(EvaluationImportStatus.PREVIEWED)
                .fileName(file == null ? null : file.getOriginalFilename())
                .contentType(file == null ? null : file.getContentType())
                .fileSize(file == null ? null : file.getSize())
                .actor(cleanActor(actor))
                .totalRows(preview.totalRows())
                .validRows(preview.validRows())
                .invalidRows(preview.invalidRows())
                .createdRows(0)
                .skippedRows(0)
                .failedRows(preview.invalidRows())
                .build());
        replaceRows(job, preview.rows());
        return new QuestionBankImportPreviewResponse(
                job.getId(),
                preview.sourceHeaders(),
                preview.totalRows(),
                preview.validRows(),
                preview.invalidRows(),
                preview.rows()
        );
    }

    @Transactional
    public QuestionBankImportCommitResponse recordQuestionBankCommit(
            Long importJobId,
            QuestionBankImportCommitResponse commit,
            String actor
    ) {
        EvaluationImportJob job = importJobId == null
                ? EvaluationImportJob.builder()
                .importType(QUESTION_BANK_IMPORT)
                .actor(cleanActor(actor))
                .build()
                : jobRepository.findById(importJobId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy lịch sử import"));
        job.setImportType(QUESTION_BANK_IMPORT);
        job.setStatus(EvaluationImportStatus.COMMITTED);
        job.setActor(cleanActor(job.getActor() == null ? actor : job.getActor()));
        job.setTotalRows(commit.totalRows());
        job.setValidRows(zero(commit.createdCount()) + zero(commit.skippedCount()));
        job.setInvalidRows(zero(commit.failedCount()));
        job.setCreatedRows(zero(commit.createdCount()));
        job.setSkippedRows(zero(commit.skippedCount()));
        job.setFailedRows(zero(commit.failedCount()));
        EvaluationImportJob saved = jobRepository.save(job);
        replaceRows(saved, commit.rows());
        return new QuestionBankImportCommitResponse(
                saved.getId(),
                commit.totalRows(),
                commit.createdCount(),
                zero(commit.skippedCount()),
                commit.failedCount(),
                commit.rows()
        );
    }

    @Transactional(readOnly = true)
    public List<EvaluationImportJobResponse> list(String q, String status, String importType) {
        String keyword = normalize(q);
        String statusFilter = normalize(status);
        String typeFilter = normalize(importType);
        return jobRepository.findTop100ByOrderByCreatedAtDesc().stream()
                .filter(job -> !StringUtils.hasText(statusFilter) || normalize(job.getStatus()).equals(statusFilter))
                .filter(job -> !StringUtils.hasText(typeFilter) || normalize(job.getImportType()).equals(typeFilter))
                .filter(job -> matchesKeyword(job, keyword))
                .map(job -> toResponse(job, false))
                .toList();
    }

    @Transactional(readOnly = true)
    public EvaluationImportJobResponse get(Long importJobId) {
        EvaluationImportJob job = jobRepository.findById(importJobId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy lịch sử import"));
        return toResponse(job, true);
    }

    @Transactional(readOnly = true)
    public byte[] exportErrorFile(Long importJobId) {
        EvaluationImportJob job = jobRepository.findById(importJobId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy lịch sử import"));
        List<EvaluationImportJobRow> errorRows = rowRepository.findByJobOrderByRowNumberAsc(job).stream()
                .filter(row -> !Boolean.TRUE.equals(row.getValid()) || StringUtils.hasText(row.getErrorsText()))
                .toList();
        if (errorRows.isEmpty()) {
            throw new BadRequestException("Import này không có dòng lỗi để tải");
        }
        try (Workbook workbook = new XSSFWorkbook(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            Sheet sheet = workbook.createSheet("import-errors");
            CellStyle headerStyle = workbook.createCellStyle();
            Font headerFont = workbook.createFont();
            headerFont.setBold(true);
            headerStyle.setFont(headerFont);

            Row header = sheet.createRow(0);
            List<String> headers = List.of("importJobId", "rowNumber", "stem", "status", "result", "errors");
            for (int index = 0; index < headers.size(); index++) {
                header.createCell(index).setCellValue(headers.get(index));
                header.getCell(index).setCellStyle(headerStyle);
            }
            for (int index = 0; index < errorRows.size(); index++) {
                EvaluationImportJobRow row = errorRows.get(index);
                Row xlsxRow = sheet.createRow(index + 1);
                xlsxRow.createCell(0).setCellValue(job.getId());
                xlsxRow.createCell(1).setCellValue(row.getRowNumber() == null ? 0 : row.getRowNumber());
                xlsxRow.createCell(2).setCellValue(blank(row.getStem()));
                xlsxRow.createCell(3).setCellValue(blank(row.getStatus()));
                xlsxRow.createCell(4).setCellValue(Boolean.TRUE.equals(row.getSkipped()) ? "Bỏ qua" : "Có lỗi");
                xlsxRow.createCell(5).setCellValue(blank(row.getErrorsText()));
            }
            for (int index = 0; index < headers.size(); index++) {
                sheet.autoSizeColumn(index);
            }
            workbook.write(output);
            return output.toByteArray();
        } catch (IOException ex) {
            throw new BadRequestException("Không thể tạo file lỗi import");
        }
    }

    private void replaceRows(EvaluationImportJob job, List<QuestionBankImportRowResultResponse> rows) {
        rowRepository.deleteByJob(job);
        if (rows == null || rows.isEmpty()) {
            return;
        }
        rows.forEach(row -> rowRepository.save(EvaluationImportJobRow.builder()
                .job(job)
                .rowNumber(row.rowNumber())
                .stem(row.stem())
                .status(row.status())
                .valid(row.valid())
                .skipped(row.skipped())
                .createdQuestionId(row.createdQuestionId())
                .errorsText(row.errors() == null ? "" : String.join("; ", row.errors()))
                .build()));
    }

    private EvaluationImportJobResponse toResponse(EvaluationImportJob job, boolean includeRows) {
        return new EvaluationImportJobResponse(
                job.getId(),
                job.getImportType(),
                importTypeText(job.getImportType()),
                job.getStatus() == null ? "" : job.getStatus().name(),
                importStatusText(job.getStatus()),
                job.getFileName(),
                job.getContentType(),
                job.getFileSize(),
                job.getActor(),
                zero(job.getTotalRows()),
                zero(job.getValidRows()),
                zero(job.getInvalidRows()),
                zero(job.getCreatedRows()),
                zero(job.getSkippedRows()),
                zero(job.getFailedRows()),
                job.getErrorMessage(),
                job.getCreatedAt(),
                includeRows
                        ? rowRepository.findByJobOrderByRowNumberAsc(job).stream().map(this::toRowResponse).toList()
                        : List.of()
        );
    }

    private EvaluationImportJobRowResponse toRowResponse(EvaluationImportJobRow row) {
        return new EvaluationImportJobRowResponse(
                row.getRowNumber(),
                row.getStem(),
                row.getStatus(),
                row.getValid(),
                row.getSkipped(),
                row.getCreatedQuestionId(),
                row.getErrorsText()
        );
    }

    private boolean matchesKeyword(EvaluationImportJob job, String keyword) {
        if (!StringUtils.hasText(keyword)) {
            return true;
        }
        return normalize(job.getFileName()).contains(keyword)
                || normalize(job.getActor()).contains(keyword)
                || normalize(job.getImportType()).contains(keyword)
                || normalize(importTypeText(job.getImportType())).contains(keyword)
                || String.valueOf(job.getId()).contains(keyword);
    }

    private String importTypeText(String importType) {
        if (QUESTION_BANK_IMPORT.equals(importType)) {
            return "Ngân hàng câu hỏi";
        }
        return importType == null ? "" : importType;
    }

    private String importStatusText(EvaluationImportStatus status) {
        if (status == null) {
            return "";
        }
        return switch (status) {
            case PREVIEWED -> "Đã preview";
            case COMMITTED -> "Đã import";
            case FAILED -> "Thất bại";
            case CANCELLED -> "Đã hủy";
        };
    }

    private String cleanActor(String actor) {
        return actor == null || actor.isBlank() ? "system" : actor.trim();
    }

    private int zero(Integer value) {
        return value == null ? 0 : value;
    }

    private String blank(String value) {
        return value == null ? "" : value;
    }

    private String normalize(Object value) {
        return String.valueOf(value == null ? "" : value).toLowerCase(Locale.ROOT).trim();
    }
}
