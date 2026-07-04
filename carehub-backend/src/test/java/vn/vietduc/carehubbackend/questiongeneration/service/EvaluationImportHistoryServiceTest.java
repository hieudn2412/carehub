package vn.vietduc.carehubbackend.questiongeneration.service;

import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.QuestionBankImportCommitResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.QuestionBankImportPreviewResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.QuestionBankImportRowResultResponse;
import vn.vietduc.carehubbackend.questiongeneration.entity.EvaluationImportJob;
import vn.vietduc.carehubbackend.questiongeneration.entity.EvaluationImportJobRow;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.EvaluationImportStatus;
import vn.vietduc.carehubbackend.questiongeneration.repository.EvaluationImportJobRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.EvaluationImportJobRowRepository;

import java.io.ByteArrayInputStream;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicLong;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class EvaluationImportHistoryServiceTest {
    private final EvaluationImportJobRepository jobRepository = mock(EvaluationImportJobRepository.class);
    private final EvaluationImportJobRowRepository rowRepository = mock(EvaluationImportJobRowRepository.class);
    private final AtomicLong ids = new AtomicLong(10);
    private EvaluationImportHistoryService service;
    private EvaluationImportJob savedJob;

    @BeforeEach
    void setUp() {
        service = new EvaluationImportHistoryService(jobRepository, rowRepository);
        when(jobRepository.save(any(EvaluationImportJob.class))).thenAnswer(invocation -> {
            EvaluationImportJob job = invocation.getArgument(0);
            if (job.getId() == null) {
                job.setId(ids.incrementAndGet());
            }
            savedJob = job;
            return job;
        });
    }

    @Test
    void recordQuestionBankPreviewCreatesJobAndRows() {
        MockMultipartFile file = new MockMultipartFile("file", "questions.xlsx", "application/vnd.ms-excel", new byte[]{1, 2});
        QuestionBankImportPreviewResponse preview = new QuestionBankImportPreviewResponse(
                null,
                List.of("stem", "optionA"),
                2,
                1,
                1,
                List.of(
                        row(2, true, null),
                        row(3, false, null)
                )
        );

        var response = service.recordQuestionBankPreview(file, preview, "admin");

        assertThat(response.importJobId()).isEqualTo(savedJob.getId());
        assertThat(savedJob.getStatus()).isEqualTo(EvaluationImportStatus.PREVIEWED);
        assertThat(savedJob.getFileName()).isEqualTo("questions.xlsx");
        assertThat(savedJob.getTotalRows()).isEqualTo(2);
        verify(rowRepository).deleteByJob(savedJob);
        verify(rowRepository, org.mockito.Mockito.times(2)).save(any());
    }

    @Test
    void recordQuestionBankCommitUpdatesExistingJob() {
        EvaluationImportJob job = EvaluationImportJob.builder()
                .id(20L)
                .importType(EvaluationImportHistoryService.QUESTION_BANK_IMPORT)
                .status(EvaluationImportStatus.PREVIEWED)
                .actor("admin")
                .build();
        when(jobRepository.findById(job.getId())).thenReturn(Optional.of(job));
        QuestionBankImportCommitResponse commit = new QuestionBankImportCommitResponse(
                job.getId(),
                1,
                1,
                0,
                0,
                List.of(row(2, true, 101L))
        );

        var response = service.recordQuestionBankCommit(job.getId(), commit, "admin");

        assertThat(response.importJobId()).isEqualTo(job.getId());
        assertThat(savedJob.getStatus()).isEqualTo(EvaluationImportStatus.COMMITTED);
        assertThat(savedJob.getCreatedRows()).isEqualTo(1);
        assertThat(savedJob.getFailedRows()).isZero();
    }

    @Test
    void exportErrorFileContainsInvalidRows() throws Exception {
        EvaluationImportJob job = EvaluationImportJob.builder()
                .id(30L)
                .importType(EvaluationImportHistoryService.QUESTION_BANK_IMPORT)
                .status(EvaluationImportStatus.COMMITTED)
                .build();
        when(jobRepository.findById(job.getId())).thenReturn(Optional.of(job));
        when(rowRepository.findByJobOrderByRowNumberAsc(job)).thenReturn(List.of(
                EvaluationImportJobRow.builder()
                        .job(job)
                        .rowNumber(2)
                        .stem("Câu hỏi lỗi")
                        .status("APPROVED")
                        .valid(false)
                        .skipped(false)
                        .errorsText("Thiếu đáp án")
                        .build()
        ));

        byte[] body = service.exportErrorFile(job.getId());

        try (XSSFWorkbook workbook = new XSSFWorkbook(new ByteArrayInputStream(body))) {
            assertThat(workbook.getSheetAt(0).getRow(0).getCell(0).getStringCellValue()).isEqualTo("importJobId");
            assertThat(workbook.getSheetAt(0).getRow(1).getCell(2).getStringCellValue()).isEqualTo("Câu hỏi lỗi");
            assertThat(workbook.getSheetAt(0).getRow(1).getCell(5).getStringCellValue()).isEqualTo("Thiếu đáp án");
        }
    }

    private QuestionBankImportRowResultResponse row(int rowNumber, boolean valid, Long createdQuestionId) {
        return new QuestionBankImportRowResultResponse(
                rowNumber,
                "Câu hỏi " + rowNumber,
                "A",
                "B",
                "C",
                "D",
                "A",
                "Giải thích",
                "Chủ đề",
                "MEDIUM",
                "vi",
                "Nguồn",
                "APPROVED",
                valid,
                false,
                createdQuestionId,
                valid ? List.of() : List.of("Lỗi dữ liệu")
        );
    }
}
