package vn.vietduc.carehubbackend.training.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import vn.vietduc.carehubbackend.training.entity.TrainingActivityType;
import vn.vietduc.carehubbackend.training.entity.TrainingEvidenceFile;
import vn.vietduc.carehubbackend.training.entity.TrainingRecord;
import vn.vietduc.carehubbackend.training.enums.DurationUnit;
import vn.vietduc.carehubbackend.training.enums.TrainingRecordStatus;
import vn.vietduc.carehubbackend.training.enums.TrainingSourceType;
import vn.vietduc.carehubbackend.training.repository.TrainingActivityTypeRepository;
import vn.vietduc.carehubbackend.training.repository.TrainingEvidenceFileRepository;
import vn.vietduc.carehubbackend.training.repository.TrainingRecordRepository;
import vn.vietduc.carehubbackend.user.entity.Department;
import vn.vietduc.carehubbackend.user.entity.Position;
import vn.vietduc.carehubbackend.user.entity.User;
import vn.vietduc.carehubbackend.user.repository.DepartmentRepository;
import vn.vietduc.carehubbackend.user.repository.PositionRepository;
import vn.vietduc.carehubbackend.user.repository.UserRepository;

import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.is;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
@TestPropertySource(properties = "spring.jpa.hibernate.ddl-auto=create-drop")
class TrainingLegacyImportControllerIntegrationTest {
    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private DepartmentRepository departmentRepository;

    @Autowired
    private PositionRepository positionRepository;

    @Autowired
    private TrainingActivityTypeRepository activityTypeRepository;

    @Autowired
    private TrainingRecordRepository recordRepository;

    @Autowired
    private TrainingEvidenceFileRepository evidenceFileRepository;

    private User admin;
    private User employee;
    private TrainingActivityType activityType;

    @BeforeEach
    void setUp() {
        Department department = departmentRepository.save(Department.builder()
                .departmentCode("GMHS")
                .name("Gây mê hồi sức")
                .build());
        Position position = positionRepository.save(Position.builder()
                .name("Doctor")
                .build());
        admin = userRepository.save(User.builder()
                .employeeCode("P7_ADMIN")
                .email("phase7-admin@example.com")
                .name("Phase 7 Admin")
                .password("encoded")
                .department(department)
                .position(position)
                .build());
        employee = userRepository.save(User.builder()
                .employeeCode("VD01506")
                .email("phase7-employee@example.com")
                .name("Nguyen Van A")
                .password("encoded")
                .department(department)
                .position(position)
                .build());
        activityType = activityTypeRepository.save(TrainingActivityType.builder()
                .code("LEGACY")
                .name("Legacy Training")
                .defaultDurationUnit(DurationUnit.HOUR)
                .requiresEvidence(false)
                .active(true)
                .createdByUser(admin)
                .build());
        recordRepository.save(TrainingRecord.builder()
                .employee(employee)
                .employeeDepartmentSnapshot(department)
                .activityType(activityType)
                .title("Duplicate Course")
                .startDate(LocalDate.of(2024, 5, 4))
                .endDate(LocalDate.of(2024, 5, 4))
                .durationValue(BigDecimal.valueOf(2.5))
                .durationUnit(DurationUnit.HOUR)
                .durationRawText("2h30")
                .declaredHours(BigDecimal.valueOf(2.5))
                .workflowStatus(TrainingRecordStatus.PENDING_REVIEW)
                .createdByUser(admin)
                .build());
    }

    @Test
    void previewAndApplyLegacyExcelImport() throws Exception {
        MockMultipartFile file = excelFile();
        String previewContent = mockMvc.perform(multipart("/api/v1/training/imports/legacy/preview")
                        .file(file)
                        .param("activityTypeId", activityType.getId().toString())
                        .with(adminJwt()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalRows", is(4)))
                .andExpect(jsonPath("$.data.successRows", is(1)))
                .andExpect(jsonPath("$.data.warningRows", is(2)))
                .andExpect(jsonPath("$.data.failedRows", is(1)))
                .andExpect(jsonPath("$.data.rows[0].validationStatus", is("VALID")))
                .andExpect(jsonPath("$.data.rows[1].validationStatus", is("WARNING")))
                .andExpect(jsonPath("$.data.rows[2].validationStatus", is("INVALID")))
                .andExpect(jsonPath("$.data.rows[3].validationStatus", is("WARNING")))
                .andReturn()
                .getResponse()
                .getContentAsString();

        JsonNode preview = objectMapper.readTree(previewContent).get("data");
        long batchId = preview.get("id").asLong();
        long lessonRowId = preview.get("rows").get(1).get("id").asLong();
        long duplicateRowId = preview.get("rows").get(3).get("id").asLong();

        mockMvc.perform(post("/api/v1/training/imports/legacy/{batchId}/apply", batchId)
                        .with(adminJwt())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.successRows", is(1)))
                .andExpect(jsonPath("$.data.rows[0].validationStatus", is("IMPORTED")))
                .andExpect(jsonPath("$.data.rows[1].validationStatus", is("WARNING")));

        mockMvc.perform(post("/api/v1/training/imports/legacy/{batchId}/apply", batchId)
                        .with(adminJwt())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "confirmedRowIds", List.of(lessonRowId, duplicateRowId)
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.successRows", is(3)));

        List<TrainingRecord> importedRecords = recordRepository.findAll()
                .stream()
                .filter(record -> record.getSourceType() == TrainingSourceType.LEGACY_IMPORT)
                .toList();
        assertThat(importedRecords).hasSize(3);
        assertThat(importedRecords).allMatch(record -> record.getWorkflowStatus() == TrainingRecordStatus.PENDING_REVIEW);
        assertThat(importedRecords)
                .filteredOn(record -> record.getDurationUnit() == DurationUnit.LESSON)
                .singleElement()
                .satisfies(record -> assertThat(record.getDeclaredHours()).isNull());

        List<TrainingEvidenceFile> evidenceFiles = evidenceFileRepository.findByTrainingRecord_IdAndActiveTrue(
                importedRecords.get(0).getId()
        );
        assertThat(evidenceFiles).hasSize(1);
        assertThat(evidenceFiles.get(0).getObjectKey()).isNull();
        assertThat(evidenceFiles.get(0).getLegacyExternalUrl()).startsWith("https://example.com");

        mockMvc.perform(get("/api/v1/training/imports/legacy/{batchId}", batchId)
                        .with(adminJwt()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.rows.length()", is(4)));
    }

    @Test
    void parsesDurationThroughApi() throws Exception {
        mockMvc.perform(get("/api/v1/training/imports/legacy/duration/parse")
                        .with(adminJwt())
                        .param("rawText", "1,5 giờ"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.parsed", is(true)))
                .andExpect(jsonPath("$.data.parsedUnit", is("HOUR")))
                .andExpect(jsonPath("$.data.normalizedHours", is(1.5)));
    }

    private MockMultipartFile excelFile() throws Exception {
        try (Workbook workbook = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet sheet = workbook.createSheet("legacy");
            Row header = sheet.createRow(0);
            List<String> headers = List.of(
                    "Dấu thời gian",
                    "Mã VD",
                    "Họ và Tên",
                    "Ngày tháng năm sinh",
                    "Chương trình đào tạo",
                    "Thời gian đào tạo",
                    "Số tiết đào tạo",
                    "Giấy chứng nhận",
                    "Chức danh"
            );
            for (int i = 0; i < headers.size(); i++) {
                header.createCell(i).setCellValue(headers.get(i));
            }
            addRow(sheet, 1, "2024-05-01T08:30:00", "01506", "Nguyen Van A", "1990-01-01",
                    "Valid Course", "2024-05-01", "2h30", "https://example.com/cert-a.pdf", "Doctor");
            addRow(sheet, 2, "2024-05-02T08:30:00", "VD01506", "Nguyen Van A", "1990-01-01",
                    "Lesson Course", "2024-05-02", "2 tiết", "", "Doctor");
            addRow(sheet, 3, "2024-05-03T08:30:00", "VDO1506", "Nguyen Van A", "1990-01-01",
                    "Invalid Employee", "3024-05-03", "O3", "", "Doctor");
            addRow(sheet, 4, "2024-05-04T08:30:00", "VD01506", "Nguyen Van A", "1990-01-01",
                    "Duplicate Course", "2024-05-04", "2h30", "https://drive.google.com/file/d/abc", "Doctor");
            workbook.write(out);
            return new MockMultipartFile(
                    "file",
                    "legacy-training.xlsx",
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    out.toByteArray()
            );
        }
    }

    private void addRow(Sheet sheet, int rowIndex, String... values) {
        Row row = sheet.createRow(rowIndex);
        for (int i = 0; i < values.length; i++) {
            row.createCell(i).setCellValue(values[i]);
        }
    }

    private org.springframework.test.web.servlet.request.RequestPostProcessor adminJwt() {
        return jwt()
                .jwt(jwt -> jwt
                        .subject(admin.getId().toString())
                        .claim("roles", List.of("ADMIN"))
                        .claim("employeeCode", admin.getEmployeeCode()))
                .authorities(new SimpleGrantedAuthority("ROLE_ADMIN"));
    }
}
