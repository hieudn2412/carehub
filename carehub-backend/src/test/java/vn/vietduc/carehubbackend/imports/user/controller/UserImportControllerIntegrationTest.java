package vn.vietduc.carehubbackend.imports.user.controller;

import com.jayway.jsonpath.JsonPath;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.annotation.Transactional;
import vn.vietduc.carehubbackend.imports.user.repository.ImportLogRepository;
import vn.vietduc.carehubbackend.user.entity.Role;
import vn.vietduc.carehubbackend.user.entity.UserStatus;
import vn.vietduc.carehubbackend.user.repository.DepartmentRepository;
import vn.vietduc.carehubbackend.user.repository.EducationLevelRepository;
import vn.vietduc.carehubbackend.user.repository.PositionRepository;
import vn.vietduc.carehubbackend.user.repository.RoleRepository;
import vn.vietduc.carehubbackend.user.repository.UserRepository;
import vn.vietduc.carehubbackend.user.repository.UserRoleRepository;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.List;

import static org.hamcrest.Matchers.is;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
@TestPropertySource(properties = "spring.jpa.hibernate.ddl-auto=create-drop")
class UserImportControllerIntegrationTest {
    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private RoleRepository roleRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private UserRoleRepository userRoleRepository;

    @Autowired
    private DepartmentRepository departmentRepository;

    @Autowired
    private PositionRepository positionRepository;

    @Autowired
    private EducationLevelRepository educationLevelRepository;

    @Autowired
    private ImportLogRepository importLogRepository;

    private Role userRole;

    @BeforeEach
    void setUp() {
        userRole = roleRepository.save(Role.builder().code("USER").name("User").build());
    }

    @Test
    void importExcelCreatesReferenceDataUsersRolesAndImportLog() throws Exception {
        MockMultipartFile file = workbook("users.xlsx", row("IMP001", "An", "Nguyen", "Nam", "1/2/1990",
                "Intensive Care", "ICU", "Nurse", "BS", "Bachelor"));

        String response = mockMvc.perform(multipart("/api/v1/users/import")
                        .file(file)
                        .with(adminJwt()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalRows", is(1)))
                .andExpect(jsonPath("$.data.insertedUsers", is(1)))
                .andExpect(jsonPath("$.data.failedRows", is(0)))
                .andExpect(jsonPath("$.data.newDepartments", is(1)))
                .andExpect(jsonPath("$.data.newPositions", is(1)))
                .andExpect(jsonPath("$.data.newEducationLevels", is(1)))
                .andReturn()
                .getResponse()
                .getContentAsString();

        Number importLogId = JsonPath.read(response, "$.data.importLogId");
        var importedUser = userRepository.findByEmployeeCodeAndIsDeletedFalse("IMP001").orElseThrow();
        assertEquals("An Nguyen", importedUser.getName());
        assertEquals(UserStatus.INACTIVE, importedUser.getStatus());
        assertEquals("ICU", importedUser.getDepartment().getDepartmentCode());
        assertTrue(importedUser.isFirstLogin());
        assertTrue(userRoleRepository.existsByUser_IdAndRole_Id(importedUser.getId(), userRole.getId()));
        assertEquals(1, departmentRepository.count());
        assertEquals(1, positionRepository.count());
        assertEquals(1, educationLevelRepository.count());

        mockMvc.perform(get("/api/v1/system/import-logs/{id}", importLogId.longValue())
                        .with(adminJwt()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.sourceFile", is("users.xlsx")))
                .andExpect(jsonPath("$.data.status", is("COMPLETED")))
                .andExpect(jsonPath("$.data.insertedRows", is(1)));

        mockMvc.perform(get("/api/v1/system/import-logs")
                        .with(adminJwt())
                        .param("status", "COMPLETED")
                        .param("q", "users")
                        .param("size", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content.length()", is(1)));
    }

    @Test
    void duplicateEmployeeCodeInFileCreatesPartialImportLog() throws Exception {
        MockMultipartFile file = workbook(
                "duplicates.xlsx",
                row("DUP001", "One", "Nguyen", "Nam", "1/1/1990", "Ward A", "WA", "Nurse", "BS", "Bachelor"),
                row("DUP001", "Two", "Tran", "Nu", "2/2/1992", "Ward A", "WA", "Nurse", "BS", "Bachelor")
        );

        mockMvc.perform(multipart("/api/v1/users/import")
                        .file(file)
                        .with(adminJwt()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalRows", is(2)))
                .andExpect(jsonPath("$.data.insertedUsers", is(1)))
                .andExpect(jsonPath("$.data.failedRows", is(1)))
                .andExpect(jsonPath("$.data.rowResults[1].status", is("FAILED")));

        assertEquals("COMPLETED_WITH_ERRORS", importLogRepository.findAll().get(0).getStatus());
    }

    @Test
    void importRequiresAdminAndExcelExtension() throws Exception {
        mockMvc.perform(multipart("/api/v1/users/import")
                        .file(workbook("users.xlsx", row("IMP002", "Lan", "Le", "Nu", "3/3/1993",
                                "Ward B", "WB", "Doctor", "MD", "Doctor")))
                        .with(userJwt()))
                .andExpect(status().isForbidden());

        mockMvc.perform(multipart("/api/v1/users/import")
                        .file(new MockMultipartFile("file", "users.txt", "text/plain", "not excel".getBytes()))
                        .with(adminJwt()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error_code", is("REQ_001")));
    }

    private MockMultipartFile workbook(String filename, Object[]... rows) throws IOException {
        try (XSSFWorkbook workbook = new XSSFWorkbook(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            Sheet sheet = workbook.createSheet("Users");
            sheet.createRow(0).createCell(0).setCellValue("Header");
            for (int i = 0; i < rows.length; i++) {
                writeRow(sheet.createRow(i + 1), rows[i]);
            }
            workbook.write(output);
            return new MockMultipartFile(
                    "file",
                    filename,
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    output.toByteArray()
            );
        }
    }

    private Object[] row(
            String employeeCode,
            String firstName,
            String lastName,
            String gender,
            String birthday,
            String departmentName,
            String departmentCode,
            String positionName,
            String educationCode,
            String educationLevelName
    ) {
        return new Object[]{
                employeeCode,
                firstName,
                lastName,
                gender,
                birthday,
                departmentName,
                departmentCode,
                positionName,
                educationCode,
                educationLevelName
        };
    }

    private void writeRow(Row row, Object[] data) {
        row.createCell(1).setCellValue((String) data[0]);
        row.createCell(3).setCellValue((String) data[1]);
        row.createCell(4).setCellValue((String) data[2]);
        row.createCell(5).setCellValue((String) data[3]);
        row.createCell(6).setCellValue((String) data[4]);
        row.createCell(7).setCellValue((String) data[5]);
        row.createCell(8).setCellValue((String) data[6]);
        row.createCell(10).setCellValue((String) data[7]);
        row.createCell(18).setCellValue((String) data[8]);
        row.createCell(19).setCellValue((String) data[9]);
    }

    private RequestPostProcessor adminJwt() {
        return jwt()
                .jwt(jwt -> jwt.subject("1").claim("roles", List.of("ADMIN")).claim("employeeCode", "ADMIN"))
                .authorities(new SimpleGrantedAuthority("ROLE_ADMIN"));
    }

    private RequestPostProcessor userJwt() {
        return jwt()
                .jwt(jwt -> jwt.subject("2").claim("roles", List.of("USER")).claim("employeeCode", "USER"))
                .authorities(new SimpleGrantedAuthority("ROLE_USER"));
    }
}
