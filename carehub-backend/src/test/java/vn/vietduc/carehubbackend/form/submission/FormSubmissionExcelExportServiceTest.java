package vn.vietduc.carehubbackend.form.submission;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;
import vn.vietduc.carehubbackend.form.entity.*;
import vn.vietduc.carehubbackend.form.entity.enums.FormFieldType;
import vn.vietduc.carehubbackend.form.entity.enums.FormItemType;
import vn.vietduc.carehubbackend.form.repository.FormVersionRepository;
import vn.vietduc.carehubbackend.form.submission.entity.*;
import vn.vietduc.carehubbackend.form.submission.repository.FormSubmissionRepository;
import vn.vietduc.carehubbackend.form.submission.service.FormSubmissionExcelExportService;
import vn.vietduc.carehubbackend.user.entity.User;

import java.io.ByteArrayInputStream;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class FormSubmissionExcelExportServiceTest {
    private final FormSubmissionRepository submissionRepository = mock(FormSubmissionRepository.class);
    private final FormVersionRepository versionRepository = mock(FormVersionRepository.class);
    private final FormSubmissionExcelExportService service = new FormSubmissionExcelExportService(
            submissionRepository,
            versionRepository,
            new ObjectMapper()
    );

    @Test
    void exportsSummaryAndDetailedAnswersForSelectedVersionAndResult() throws Exception {
        Form form = Form.builder().id(4L).code("THUT_THAO").title("Thụt tháo").build();
        FormVersion version = FormVersion.builder()
                .id(8L)
                .form(form)
                .versionNumber(2)
                .title("Thụt tháo v2")
                .build();
        FormSection section = FormSection.builder()
                .id(11L)
                .formVersion(version)
                .title("Chuẩn bị")
                .displayOrder(1)
                .sectionKey(UUID.randomUUID())
                .build();
        FormQuestion question = FormQuestion.builder()
                .id(12L)
                .formVersion(version)
                .section(section)
                .itemKey(UUID.randomUUID())
                .itemType(FormItemType.QUESTION)
                .displayOrder(1)
                .questionKey(UUID.randomUUID())
                .code("Q01")
                .title("Xác nhận đúng người bệnh")
                .fieldType(FormFieldType.SINGLE_CHOICE)
                .build();
        version.getSections().add(section);
        section.getQuestions().add(question);
        FormOption option = FormOption.builder()
                .id(13L)
                .question(question)
                .optionKey(UUID.randomUUID())
                .value("yes")
                .label("Có")
                .displayOrder(1)
                .build();
        User manager = User.builder().id(20L).employeeCode("QL01").name("Quản lý").build();
        FormSubmission submission = FormSubmission.builder()
                .id(30L)
                .formVersion(version)
                .submittedBy(manager)
                .status(FormSubmissionStatus.SUBMITTED)
                .submittedAt(Instant.parse("2026-07-25T04:30:00Z"))
                .scoringStatus(FormScoringStatus.CALCULATED)
                .result(FormSubmissionResult.PASSED)
                .totalScore(new BigDecimal("8"))
                .maxScore(BigDecimal.TEN)
                .passingScore(new BigDecimal("6"))
                .convertedScore(new BigDecimal("8"))
                .scoreBreakdown(Map.of("questions", List.of(Map.of(
                        "questionKey", question.getQuestionKey().toString(),
                        "maxScore", "10"
                ))))
                .build();
        submission.setSubjectContext(FormSubmissionContext.builder()
                .submission(submission)
                .employeeCode("NV01")
                .fullName("Nguyễn Văn A")
                .department("Khoa Nội")
                .position("Điều dưỡng")
                .build());
        FormAnswer answer = FormAnswer.builder()
                .id(40L)
                .submission(submission)
                .question(question)
                .selectedOption(option)
                .answerJson(Map.of("value", "yes"))
                .scoreValue(new BigDecimal("8"))
                .weight(BigDecimal.ONE)
                .weightedScore(new BigDecimal("8"))
                .critical(false)
                .excludedFromScore(false)
                .build();
        submission.getAnswers().add(answer);

        when(versionRepository.findByIdAndForm_Id(8L, 4L)).thenReturn(Optional.of(version));
        when(submissionRepository.findSubmittedForVersionExport(4L, 8L, FormSubmissionResult.PASSED))
                .thenReturn(List.of(submission));

        var file = service.exportVersion(4L, 8L, FormSubmissionResult.PASSED);

        assertThat(file.filename()).isEqualTo("ket-qua-THUT_THAO-v2-passed.xlsx");
        assertThat(file.content()).isNotEmpty();
        try (Workbook workbook = new XSSFWorkbook(new ByteArrayInputStream(file.content()))) {
            assertThat(workbook.getNumberOfSheets()).isEqualTo(2);
            assertThat(workbook.getSheet("Tong hop response").getLastRowNum()).isEqualTo(1);
            assertThat(workbook.getSheet("Chi tiet cau tra loi").getLastRowNum()).isEqualTo(1);
            assertThat(workbook.getSheet("Chi tiet cau tra loi").getRow(1).getCell(6).getStringCellValue())
                    .isEqualTo("Q01");
            assertThat(workbook.getSheet("Chi tiet cau tra loi").getRow(1).getCell(9).getStringCellValue())
                    .isEqualTo("Có");
        }
    }
}
