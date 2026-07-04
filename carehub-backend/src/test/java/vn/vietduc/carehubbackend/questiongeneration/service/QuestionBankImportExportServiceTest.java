package vn.vietduc.carehubbackend.questiongeneration.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import vn.vietduc.carehubbackend.exception.ConflictException;
import vn.vietduc.carehubbackend.questiongeneration.dto.request.QuestionBankImportCommitRequest;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.QuestionBankQuestionResponse;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.concurrent.atomic.AtomicLong;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.when;

class QuestionBankImportExportServiceTest {
    private final QuestionBankService questionBankService = mock(QuestionBankService.class);
    private final EvaluationImportHistoryService importHistoryService = mock(EvaluationImportHistoryService.class);
    private final AtomicLong ids = new AtomicLong(100);
    private QuestionBankImportExportService service;

    @BeforeEach
    void setUp() {
        service = new QuestionBankImportExportService(questionBankService, importHistoryService, new ObjectMapper());
        when(importHistoryService.recordQuestionBankPreview(any(), any(), eq("admin"))).thenAnswer(invocation -> invocation.getArgument(1));
        when(importHistoryService.recordQuestionBankCommit(any(), any(), eq("admin"))).thenAnswer(invocation -> invocation.getArgument(1));
        when(questionBankService.create(any(), eq("admin"))).thenAnswer(invocation -> {
            var request = (vn.vietduc.carehubbackend.questiongeneration.dto.request.UpsertQuestionBankQuestionRequest) invocation.getArgument(0);
            Long id = ids.incrementAndGet();
            return new QuestionBankQuestionResponse(
                    id,
                    request.stem(),
                    request.optionA(),
                    request.optionB(),
                    request.optionC(),
                    request.optionD(),
                    request.correctAnswer().toUpperCase(),
                    request.explanation(),
                    request.topic(),
                    request.difficulty(),
                    request.language(),
                    request.sourceDocument(),
                    "ORIGINAL",
                    null,
                    request.status(),
                    "Đã duyệt",
                    null,
                    null,
                    LocalDateTime.now(),
                    LocalDateTime.now()
            );
        });
    }

    @Test
    void previewCsvReportsValidAndInvalidRows() {
        MockMultipartFile file = csv("""
                stem,optionA,optionB,optionC,optionD,correctAnswer,explanation,topic,difficulty,language,sourceDocument,status
                Câu hỏi hợp lệ?,A,B,C,D,A,Giải thích,Chủ đề,EASY,vi,Nguồn,APPROVED
                Câu hỏi thiếu đáp án?,A,B,,,E,,,,,,
                """);

        var preview = service.preview(file, "admin");

        assertThat(preview.totalRows()).isEqualTo(2);
        assertThat(preview.sourceHeaders()).contains("stem", "optionA", "correctAnswer");
        assertThat(preview.validRows()).isEqualTo(1);
        assertThat(preview.invalidRows()).isEqualTo(1);
        assertThat(preview.rows().get(1).errors()).contains("Thiếu một hoặc nhiều phương án A-D", "Đáp án đúng phải là A, B, C hoặc D");
    }

    @Test
    void previewCsvUsesCustomColumnMapping() {
        MockMultipartFile file = csv("""
                noi_dung,pa_1,pa_2,pa_3,pa_4,dap_an
                Câu hỏi map cột?,A,B,C,D,A
                """);
        String mapping = """
                {
                  "stem": "noi_dung",
                  "optionA": "pa_1",
                  "optionB": "pa_2",
                  "optionC": "pa_3",
                  "optionD": "pa_4",
                  "correctAnswer": "dap_an"
                }
                """;

        var preview = service.preview(file, "admin", mapping);

        assertThat(preview.validRows()).isEqualTo(1);
        assertThat(preview.rows().get(0).stem()).isEqualTo("Câu hỏi map cột?");
        assertThat(preview.rows().get(0).correctAnswer()).isEqualTo("A");
    }

    @Test
    void previewDocxTemplateParsesQuestions() throws Exception {
        MockMultipartFile file = docx("""
                Câu hỏi: Người bệnh có dấu hiệu nào cần báo bác sĩ ngay?
                A. Mạch nhanh, huyết áp tụt
                B. Ngủ ngon
                C. Ăn tốt
                D. Không đau
                Đáp án: A
                Giải thích: Đây là dấu hiệu cảnh báo.
                Chủ đề: Cấp cứu
                Độ khó: MEDIUM
                Nguồn: Tài liệu bệnh viện
                Trạng thái: APPROVED
                """);

        var preview = service.preview(file, "admin");

        assertThat(preview.totalRows()).isEqualTo(1);
        assertThat(preview.validRows()).isEqualTo(1);
        assertThat(preview.rows().get(0).stem()).isEqualTo("Người bệnh có dấu hiệu nào cần báo bác sĩ ngay?");
        assertThat(preview.rows().get(0).optionA()).isEqualTo("Mạch nhanh, huyết áp tụt");
        assertThat(preview.rows().get(0).correctAnswer()).isEqualTo("A");
    }

    @Test
    void commitCreatesOnlyValidRows() {
        MockMultipartFile file = csv("""
                stem,optionA,optionB,optionC,optionD,correctAnswer,explanation,topic,difficulty,language,sourceDocument,status
                Câu hỏi hợp lệ?,A,B,C,D,A,Giải thích,Chủ đề,EASY,vi,Nguồn,APPROVED
                Câu hỏi thiếu đáp án?,A,B,,,E,,,,,,
                """);
        var preview = service.preview(file, "admin");

        var commit = service.commit(new QuestionBankImportCommitRequest(preview.importJobId(), "BLOCK", preview.rows().stream()
                .filter(row -> Boolean.TRUE.equals(row.valid()))
                .map(row -> new vn.vietduc.carehubbackend.questiongeneration.dto.request.QuestionBankImportRowRequest(
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
                        row.status()
                ))
                .toList()), "admin");

        assertThat(commit.totalRows()).isEqualTo(1);
        assertThat(commit.createdCount()).isEqualTo(1);
        assertThat(commit.skippedCount()).isZero();
        assertThat(commit.failedCount()).isZero();
        assertThat(commit.rows().get(0).createdQuestionId()).isNotNull();
    }

    @Test
    void commitCanSkipDuplicateRows() {
        reset(questionBankService);
        when(questionBankService.create(any(), eq("admin"))).thenThrow(new ConflictException("Câu hỏi bị trùng mạnh"));
        MockMultipartFile file = csv("""
                stem,optionA,optionB,optionC,optionD,correctAnswer,explanation,topic,difficulty,language,sourceDocument,status
                Câu hỏi đã có?,A,B,C,D,A,Giải thích,Chủ đề,EASY,vi,Nguồn,APPROVED
                """);
        var preview = service.preview(file, "admin");

        var commit = service.commit(new QuestionBankImportCommitRequest(preview.importJobId(), "SKIP_DUPLICATES", preview.rows().stream()
                .map(row -> new vn.vietduc.carehubbackend.questiongeneration.dto.request.QuestionBankImportRowRequest(
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
                        row.status()
                ))
                .toList()), "admin");

        assertThat(commit.createdCount()).isZero();
        assertThat(commit.skippedCount()).isEqualTo(1);
        assertThat(commit.failedCount()).isZero();
        assertThat(commit.rows().get(0).skipped()).isTrue();
    }

    @Test
    void importTemplateContainsHeadersSampleAndGuide() throws Exception {
        byte[] body = service.importTemplateXlsx();

        try (XSSFWorkbook workbook = new XSSFWorkbook(new ByteArrayInputStream(body))) {
            assertThat(workbook.getNumberOfSheets()).isEqualTo(2);
            assertThat(workbook.getSheet("questions").getRow(0).getCell(0).getStringCellValue()).isEqualTo("stem");
            assertThat(workbook.getSheet("questions").getRow(0).getCell(5).getStringCellValue()).isEqualTo("correctAnswer");
            assertThat(workbook.getSheet("questions").getRow(1).getCell(5).getStringCellValue()).isEqualTo("A");
            assertThat(workbook.getSheet("huong-dan").getRow(0).getCell(0).getStringCellValue()).contains("Cột bắt buộc");
        }
    }

    private MockMultipartFile csv(String content) {
        return new MockMultipartFile(
                "file",
                "questions.csv",
                "text/csv",
                content.stripIndent().getBytes(StandardCharsets.UTF_8)
        );
    }

    private MockMultipartFile docx(String content) throws Exception {
        try (XWPFDocument document = new XWPFDocument();
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            content.stripIndent().lines().forEach(line -> document.createParagraph().createRun().setText(line));
            document.write(output);
            return new MockMultipartFile(
                    "file",
                    "questions.docx",
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    output.toByteArray()
            );
        }
    }
}
