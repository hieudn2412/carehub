package vn.vietduc.carehubbackend.questiongeneration.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mock.web.MockMultipartFile;
import vn.vietduc.carehubbackend.questiongeneration.dto.request.QuestionBankImportCommitRequest;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.QuestionBankQuestionResponse;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionCategory;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionCategoryStatus;
import vn.vietduc.carehubbackend.questiongeneration.repository.QuestionCategoryRepository;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicLong;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.verify;

class QuestionBankImportExportServiceTest {
    private final QuestionBankService questionBankService = mock(QuestionBankService.class);
    private final EvaluationImportHistoryService importHistoryService = mock(EvaluationImportHistoryService.class);
    private final QuestionCategoryRepository categoryRepository = mock(QuestionCategoryRepository.class);
    private final AtomicLong ids = new AtomicLong(100);
    private QuestionBankImportExportService service;

    @BeforeEach
    void setUp() {
        service = new QuestionBankImportExportService(questionBankService, importHistoryService, new ObjectMapper(), categoryRepository);
        QuestionCategory topic = QuestionCategory.builder().id(10L).code("DM_01").name("Chủ đề")
                .status(QuestionCategoryStatus.ACTIVE).build();
        QuestionCategory emergency = QuestionCategory.builder().id(11L).code("CAP_CUU").name("Cấp cứu")
                .status(QuestionCategoryStatus.ACTIVE).build();
        when(categoryRepository.findByStatusOrderByNameAsc(QuestionCategoryStatus.ACTIVE))
                .thenReturn(List.of(topic, emergency));
        when(categoryRepository.findById(10L)).thenReturn(Optional.of(topic));
        when(categoryRepository.findById(11L)).thenReturn(Optional.of(emergency));
        when(categoryRepository.findByCodeIgnoreCase("DM_01")).thenReturn(Optional.of(topic));
        when(categoryRepository.findByCodeIgnoreCase("CAP_CUU")).thenReturn(Optional.of(emergency));
        when(importHistoryService.recordQuestionBankPreview(any(), any(), eq("admin"))).thenAnswer(invocation -> invocation.getArgument(1));
        when(importHistoryService.recordQuestionBankCommit(any(), any(), eq("admin"))).thenAnswer(invocation -> invocation.getArgument(1));
        when(questionBankService.createInNewTransaction(any(), eq("admin"))).thenAnswer(invocation -> {
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
                    request.language(),
                    request.sourceDocument(),
                    "ORIGINAL",
                    null,
                    request.status(),
                    "Đã duyệt",
                    null,
                    null,
                    LocalDateTime.now(),
                    LocalDateTime.now(),
                    request.categoryId(),
                    null,
                    null,
                    request.professionalFieldId(),
                    null,
                    null,
                    request.cognitiveLevel(),
                    null,
                    null,
                    request.sourceDocumentId(),
                    null,
                    null
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
        assertThat(preview.validRows()).as(preview.rows().toString()).isEqualTo(1);
        assertThat(preview.invalidRows()).isEqualTo(1);
        assertThat(preview.rows().get(1).errors()).contains("Thiếu một hoặc nhiều phương án A-D", "Đáp án đúng phải là A, B, C hoặc D");
    }

    @Test
    void previewCsvUsesCustomColumnMapping() {
        MockMultipartFile file = csv("""
                noi_dung,pa_1,pa_2,pa_3,pa_4,dap_an,danh_muc,do_kho
                Câu hỏi map cột?,A,B,C,D,A,[DM_01] Chủ đề,EASY
                """);
        String mapping = """
                {
                  "stem": "noi_dung",
                  "optionA": "pa_1",
                  "optionB": "pa_2",
                  "optionC": "pa_3",
                  "optionD": "pa_4",
                  "correctAnswer": "dap_an",
                  "categoryReference": "danh_muc",
                  "difficulty": "do_kho"
                }
                """;

        var preview = service.preview(file, "admin", mapping);

        assertThat(preview.validRows()).as(preview.rows().toString()).isEqualTo(1);
        assertThat(preview.rows().get(0).stem()).isEqualTo("Câu hỏi map cột?");
        assertThat(preview.rows().get(0).correctAnswer()).isEqualTo("A");
    }

    @Test
    void previewVietnameseHeadersResolvesByStableCodeAndDefaultsSourceToImport() {
        MockMultipartFile file = csv("""
                Danh mục kiến thức,Nội dung câu hỏi,Phương án A,Phương án B,Phương án C,Phương án D,Đáp án đúng,Mức độ nhận thức,Giải thích
                [DM_01] Tên cũ,Ai cần báo bác sĩ?,A,B,C,D,A,Áp dụng lâm sàng,
                """);

        var preview = service.preview(file, "admin");

        assertThat(preview.validRows()).isEqualTo(1);
        assertThat(preview.rows().get(0).categoryId()).isEqualTo(10L);
        assertThat(preview.rows().get(0).categoryName()).isEqualTo("Chủ đề");
        assertThat(preview.rows().get(0).professionalFieldCode()).isNull();
        assertThat(preview.rows().get(0).cognitiveLevel()).isEqualTo("CLINICAL_APPLICATION");
        assertThat(preview.rows().get(0).sourceDocument()).isEqualTo("Import");
    }

    @Test
    void commitRevalidatesCategoryAndForcesApprovedVietnameseQuestion() {
        MockMultipartFile file = csv("""
                Danh mục kiến thức,Nội dung câu hỏi,Phương án A,Phương án B,Phương án C,Phương án D,Đáp án đúng,Độ khó,Giải thích,Nguồn câu hỏi
                [CAP_CUU] Tên có thể đã đổi,Câu hỏi?,A,B,C,D,A,Dễ,,
                """);
        var preview = service.preview(file, "admin");
        var row = preview.rows().get(0);

        service.commit(new QuestionBankImportCommitRequest(null, "BLOCK", List.of(
                new vn.vietduc.carehubbackend.questiongeneration.dto.request.QuestionBankImportRowRequest(
                        row.rowNumber(), row.stem(), row.optionA(), row.optionB(), row.optionC(), row.optionD(),
                        row.correctAnswer(), row.explanation(), null, "en", row.sourceDocument(),
                        "REJECTED", row.categoryId(), row.categoryReference(), null, null, row.cognitiveLevel())
        )), "admin");

        ArgumentCaptor<vn.vietduc.carehubbackend.questiongeneration.dto.request.UpsertQuestionBankQuestionRequest> captor =
                ArgumentCaptor.forClass(vn.vietduc.carehubbackend.questiongeneration.dto.request.UpsertQuestionBankQuestionRequest.class);
        verify(questionBankService).createInNewTransaction(captor.capture(), eq("admin"));
        assertThat(captor.getValue().categoryId()).isEqualTo(11L);
        assertThat(captor.getValue().status()).isEqualTo("APPROVED");
        assertThat(captor.getValue().language()).isEqualTo("vi");
    }

    @Test
    void unresolvedCategoryIsSkippedWhileValidRowsRemainImportable() {
        MockMultipartFile file = csv("""
                Danh mục kiến thức,Nội dung câu hỏi,Phương án A,Phương án B,Phương án C,Phương án D,Đáp án đúng,Độ khó,Giải thích,Nguồn câu hỏi
                Không tồn tại,Câu bị bỏ qua?,A,B,C,D,A,Khó,,
                [DM_01] Chủ đề,Câu hợp lệ?,A,B,C,D,A,Dễ,,
                """);

        var preview = service.preview(file, "admin");

        assertThat(preview.validRows()).isEqualTo(1);
        assertThat(preview.skippedRows()).isEqualTo(1);
        assertThat(preview.rows().get(0).categoryResolved()).isFalse();
        assertThat(preview.rows().get(0).skipReason()).contains("Không nhận diện");
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
                        row.language(),
                        row.sourceDocument(),
                        row.status(),
                        row.categoryId(),
                        row.categoryReference(),
                        row.professionalFieldId(),
                        row.professionalFieldReference(),
                        row.cognitiveLevel()
                ))
                .toList()), "admin");

        assertThat(commit.totalRows()).isEqualTo(1);
        assertThat(commit.createdCount()).isEqualTo(1);
        assertThat(commit.skippedCount()).isZero();
        assertThat(commit.failedCount()).isZero();
        assertThat(commit.rows().get(0).createdQuestionId()).isNotNull();
    }

    @Test
    void importTemplateContainsOnlyVietnameseHeadersReferenceAndGuide() throws Exception {
        byte[] body = service.importTemplateXlsx();

        try (XSSFWorkbook workbook = new XSSFWorkbook(new ByteArrayInputStream(body))) {
            assertThat(workbook.getNumberOfSheets()).isEqualTo(3);
            assertThat(workbook.getSheet("Câu hỏi").getRow(0).getPhysicalNumberOfCells()).isEqualTo(10);
            assertThat(workbook.getSheet("Câu hỏi").getRow(0).getCell(0).getStringCellValue()).isEqualTo("Danh mục kiến thức");
            assertThat(workbook.getSheet("Câu hỏi").getRow(0).getCell(1).getStringCellValue()).isEqualTo("Lĩnh vực chuyên môn");
            assertThat(workbook.getSheet("Câu hỏi").getRow(0).getCell(7).getStringCellValue()).isEqualTo("Đáp án đúng");
            assertThat(workbook.getSheet("Câu hỏi").getRow(0).getCell(9).getStringCellValue()).isEqualTo("Giải thích");
            assertThat((Object) workbook.getSheet("Câu hỏi").getRow(1)).isNull();
            assertThat(workbook.getSheet("Danh mục tham chiếu").getRow(1).getCell(0).getStringCellValue()).contains("[DM_01]");
            assertThat(workbook.getSheet("Hướng dẫn").getRow(0).getCell(0).getStringCellValue()).contains("cột bắt buộc");
            assertThat(workbook.getSheet("Câu hỏi").getDataValidations()).hasSize(4);
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
