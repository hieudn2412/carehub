package vn.vietduc.carehubbackend.training.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.annotation.Transactional;
import vn.vietduc.carehubbackend.training.entity.ProfessionalField;
import vn.vietduc.carehubbackend.training.entity.CmeScopeConfiguration;
import vn.vietduc.carehubbackend.training.entity.TrainingActivityType;
import vn.vietduc.carehubbackend.training.entity.TrainingRecord;
import vn.vietduc.carehubbackend.training.entity.TrainingRequirement;
import vn.vietduc.carehubbackend.training.enums.DurationUnit;
import vn.vietduc.carehubbackend.training.enums.TrainingRecordStatus;
import vn.vietduc.carehubbackend.training.repository.ProfessionalFieldRepository;
import vn.vietduc.carehubbackend.training.repository.CmeScopeConfigurationRepository;
import vn.vietduc.carehubbackend.training.repository.TrainingActivityTypeRepository;
import vn.vietduc.carehubbackend.training.repository.TrainingRecordRepository;
import vn.vietduc.carehubbackend.training.repository.TrainingRequirementRepository;
import vn.vietduc.carehubbackend.user.entity.Department;
import vn.vietduc.carehubbackend.user.entity.Position;
import vn.vietduc.carehubbackend.user.entity.User;
import vn.vietduc.carehubbackend.user.repository.DepartmentRepository;
import vn.vietduc.carehubbackend.user.repository.PositionRepository;
import vn.vietduc.carehubbackend.user.repository.UserRepository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;

import static org.hamcrest.Matchers.greaterThanOrEqualTo;
import static org.hamcrest.Matchers.is;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
@TestPropertySource(properties = "spring.jpa.hibernate.ddl-auto=create-drop")
class TrainingRequirementStatusControllerIntegrationTest {
    @Autowired
    private MockMvc mockMvc;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Autowired
    private DepartmentRepository departmentRepository;

    @Autowired
    private PositionRepository positionRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ProfessionalFieldRepository professionalFieldRepository;

    @Autowired
    private TrainingActivityTypeRepository activityTypeRepository;

    @Autowired
    private TrainingRecordRepository recordRepository;

    @Autowired
    private TrainingRequirementRepository requirementRepository;

    @Autowired
    private CmeScopeConfigurationRepository cmeScopeConfigurationRepository;

    private Department anesthesia;
    private Department surgery;
    private Position doctor;
    private Position nurse;
    private ProfessionalField ultrasound;
    private User admin;
    private User user;
    private User manager;
    private User otherDepartmentUser;
    private TrainingActivityType activityType;

    @BeforeEach
    void setUp() {
        anesthesia = departmentRepository.save(Department.builder()
                .departmentCode("P5_AN")
                .name("Phase 5 Anesthesia")
                .build());
        surgery = departmentRepository.save(Department.builder()
                .departmentCode("P5_SU")
                .name("Phase 5 Surgery")
                .build());
        cmeScopeConfigurationRepository.saveAndFlush(CmeScopeConfiguration.builder()
                .scopeKey(CmeScopeConfiguration.CME_SCOPE_KEY)
                .departments(new LinkedHashSet<>(List.of(anesthesia, surgery)))
                .build());
        doctor = positionRepository.save(Position.builder().name("Phase 5 Doctor").build());
        nurse = positionRepository.save(Position.builder().name("Phase 5 Nurse").build());
        ultrasound = professionalFieldRepository.save(ProfessionalField.builder()
                .code("P5_US")
                .name("Phase 5 Ultrasound")
                .active(true)
                .build());
        admin = saveUser("P5_ADMIN", "p5-admin@example.com", "Phase 5 Admin", anesthesia, doctor);
        user = saveUser("P5_USER", "p5-user@example.com", "Phase 5 User", anesthesia, doctor);
        manager = saveUser("P5_MANAGER", "p5-manager@example.com", "Phase 5 Manager", anesthesia, doctor);
        otherDepartmentUser = saveUser("P5_OTHER", "p5-other@example.com", "Phase 5 Other", surgery, nurse);
        activityType = activityTypeRepository.save(TrainingActivityType.builder()
                .code("P5_TYPE")
                .name("Phase 5 Type")
                .defaultDurationUnit(DurationUnit.HOUR)
                .requiresEvidence(false)
                .active(true)
                .build());
    }

    @Test
    void adminCrudValidatesBoundariesOverlapDeactivateAndVersion() throws Exception {
        String zeroHoursRequest = requirementJson(
                "req_zero",
                "Zero Hour Rule",
                BigDecimal.ZERO,
                doctor.getId(),
                anesthesia.getId(),
                null,
                LocalDate.of(2026, 1, 1),
                LocalDate.of(2026, 12, 31),
                true,
                null
        );

        String createResponse = mockMvc.perform(post("/api/v1/training/requirements")
                        .with(jwtFor(admin, "ADMIN"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(zeroHoursRequest))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.code", is("REQ_ZERO")))
                .andExpect(jsonPath("$.data.requiredHours", is(0)))
                .andExpect(jsonPath("$.data.applicableEmployeeCount", greaterThanOrEqualTo(2)))
                .andReturn()
                .getResponse()
                .getContentAsString();
        Long requirementId = objectMapper.readTree(createResponse).path("data").path("id").asLong();
        Long version = objectMapper.readTree(createResponse).path("data").path("version").asLong();

        mockMvc.perform(post("/api/v1/training/requirements")
                        .with(jwtFor(admin, "ADMIN"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requirementJson(
                                "req_max",
                                "Max Hour Rule",
                                BigDecimal.valueOf(500),
                                nurse.getId(),
                                surgery.getId(),
                                null,
                                LocalDate.of(2026, 1, 1),
                                null,
                                true,
                                null
                        )))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.requiredHours", is(500)));

        mockMvc.perform(post("/api/v1/training/requirements")
                        .with(jwtFor(admin, "ADMIN"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requirementJson(
                                "req_too_much",
                                "Too Much",
                                BigDecimal.valueOf(500.01),
                                nurse.getId(),
                                anesthesia.getId(),
                                null,
                                LocalDate.of(2026, 1, 1),
                                null,
                                true,
                                null
                        )))
                .andExpect(status().isUnprocessableEntity());

        mockMvc.perform(post("/api/v1/training/requirements")
                        .with(jwtFor(admin, "ADMIN"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requirementJson(
                                "req_overlap",
                                "Overlap",
                                BigDecimal.valueOf(40),
                                doctor.getId(),
                                anesthesia.getId(),
                                null,
                                LocalDate.of(2026, 6, 1),
                                LocalDate.of(2027, 1, 1),
                                true,
                                null
                        )))
                .andExpect(status().isConflict());

        mockMvc.perform(put("/api/v1/training/requirements/{id}", requirementId)
                        .with(jwtFor(admin, "ADMIN"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requirementJson(
                                "REQ_ZERO",
                                "Stale Update",
                                BigDecimal.valueOf(10),
                                doctor.getId(),
                                anesthesia.getId(),
                                null,
                                LocalDate.of(2026, 1, 1),
                                LocalDate.of(2026, 12, 31),
                                true,
                                version + 10
                        )))
                .andExpect(status().isConflict());

        mockMvc.perform(patch("/api/v1/training/requirements/{id}/status", requirementId)
                        .with(jwtFor(admin, "ADMIN"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "active", false,
                                "version", version
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.active", is(false)));

        mockMvc.perform(get("/api/v1/training/requirements")
                        .with(jwtFor(admin, "ADMIN"))
                        .param("keyword", "zero")
                        .param("active", "false")
                        .param("effectiveOn", "2026-06-01"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content[0].code", is("REQ_ZERO")));

        mockMvc.perform(get("/api/v1/training/requirements")
                        .with(jwtFor(user, "USER")))
                .andExpect(status().isForbidden());
    }

    @Test
    void adminCanConfigureApplicableDepartmentsWithOptimisticLocking() throws Exception {
        String currentResponse = mockMvc.perform(get("/api/v1/training/requirements/applicable-departments")
                        .with(jwtFor(admin, "ADMIN")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.departmentIds.length()", is(2)))
                .andReturn()
                .getResponse()
                .getContentAsString();
        long currentVersion = objectMapper.readTree(currentResponse).path("data").path("version").asLong();

        String updateResponse = mockMvc.perform(put("/api/v1/training/requirements/applicable-departments")
                        .with(jwtFor(admin, "ADMIN"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "departmentIds", List.of(anesthesia.getId()),
                                "version", currentVersion
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.departmentIds.length()", is(1)))
                .andExpect(jsonPath("$.data.departmentIds[0]", is(anesthesia.getId().intValue())))
                .andReturn()
                .getResponse()
                .getContentAsString();
        long nextVersion = objectMapper.readTree(updateResponse).path("data").path("version").asLong();

        mockMvc.perform(put("/api/v1/training/requirements/applicable-departments")
                        .with(jwtFor(admin, "ADMIN"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "departmentIds", List.of(surgery.getId()),
                                "version", currentVersion
                        ))))
                .andExpect(status().isConflict());

        mockMvc.perform(put("/api/v1/training/requirements/applicable-departments")
                        .with(jwtFor(admin, "ADMIN"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "departmentIds", List.of(Long.MAX_VALUE),
                                "version", nextVersion
                        ))))
                .andExpect(status().isNotFound());

        mockMvc.perform(put("/api/v1/training/requirements/applicable-departments")
                        .with(jwtFor(admin, "ADMIN"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "departmentIds", List.of(),
                                "version", nextVersion
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.departmentIds.length()", is(0)));

        mockMvc.perform(get("/api/v1/training/requirements/applicable-departments")
                        .with(jwtFor(user, "USER")))
                .andExpect(status().isForbidden());
    }

    @Test
    void statusUsesRequirementPriorityFutureRulesAndApprovedHoursOnly() throws Exception {
        saveRequirement("REQ_GLOBAL", "Global", BigDecimal.valueOf(120), null, null, null,
                LocalDate.of(2021, 1, 1), null);
        saveRequirement("REQ_POSITION", "Position", BigDecimal.valueOf(100), doctor, null, null,
                LocalDate.of(2021, 1, 1), null);
        saveRequirement("REQ_DEPT_POS", "Department Position", BigDecimal.valueOf(80), doctor, anesthesia, null,
                LocalDate.of(2021, 1, 1), null);
        saveRequirement("REQ_SPECIFIC", "Specific", BigDecimal.valueOf(120), doctor, anesthesia, ultrasound,
                LocalDate.of(2021, 1, 1), LocalDate.of(2026, 12, 31));
        saveRequirement("REQ_FUTURE", "Future Specific", BigDecimal.valueOf(40), doctor, anesthesia, ultrasound,
                LocalDate.of(2027, 1, 1), null);

        saveRecord(user, LocalDate.of(2024, 1, 1), TrainingRecordStatus.APPROVED, BigDecimal.valueOf(80), BigDecimal.valueOf(80));
        saveRecord(user, LocalDate.of(2026, 2, 1), TrainingRecordStatus.APPROVED, BigDecimal.valueOf(40), BigDecimal.valueOf(40));
        saveRecord(user, LocalDate.of(2026, 3, 1), TrainingRecordStatus.PENDING_REVIEW, BigDecimal.valueOf(120), null);
        saveRecord(user, LocalDate.of(2026, 4, 1), TrainingRecordStatus.REJECTED, BigDecimal.valueOf(9), null);
        saveRecord(user, LocalDate.of(2020, 1, 1), TrainingRecordStatus.APPROVED, BigDecimal.valueOf(200), BigDecimal.valueOf(200));

        mockMvc.perform(get("/api/v1/training/status/me")
                        .with(jwtFor(user, "USER"))
                        .param("professionalFieldId", ultrasound.getId().toString())
                        .param("asOf", "2026-06-20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status", is("COMPLIANT")))
                .andExpect(jsonPath("$.data.requirementName", is("Specific")))
                .andExpect(jsonPath("$.data.requiredHours", is(120)))
                .andExpect(jsonPath("$.data.approvedHours", is(120.0)))
                .andExpect(jsonPath("$.data.pendingHours", is(120)))
                .andExpect(jsonPath("$.data.rejectedHours", is(9)))
                .andExpect(jsonPath("$.data.remainingHours", is(0.0)))
                .andExpect(jsonPath("$.data.progressPercentage", is(100.0)))
                .andExpect(jsonPath("$.data.windowStart", is("2021-06-20")))
                .andExpect(jsonPath("$.data.yearlyHours.length()", is(2)))
                .andExpect(jsonPath("$.data.attentionRecords.length()", is(2)));

        mockMvc.perform(get("/api/v1/training/status/me")
                        .with(jwtFor(user, "USER"))
                        .param("professionalFieldId", ultrasound.getId().toString())
                        .param("asOf", "2027-06-20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.requirementName", is("Future Specific")))
                .andExpect(jsonPath("$.data.requiredHours", is(40)));
    }

    @Test
    void statusReturnsNotConfiguredAndEnforcesEmployeeScope() throws Exception {
        mockMvc.perform(get("/api/v1/training/status/me")
                        .with(jwtFor(user, "USER"))
                        .param("asOf", "2026-06-20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status", is("NOT_CONFIGURED")))
                .andExpect(jsonPath("$.data.requirementId").doesNotExist());

        mockMvc.perform(get("/api/v1/training/employees/{employeeId}/status", user.getId())
                        .with(jwtFor(manager, "MANAGER"))
                        .param("asOf", "2026-06-20"))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/training/employees/{employeeId}/status", otherDepartmentUser.getId())
                        .with(jwtFor(manager, "MANAGER"))
                        .param("asOf", "2026-06-20"))
                .andExpect(status().isForbidden());
    }

    private User saveUser(String employeeCode, String email, String name, Department department, Position position) {
        return userRepository.save(User.builder()
                .employeeCode(employeeCode)
                .email(email)
                .name(name)
                .password("encoded")
                .department(department)
                .position(position)
                .build());
    }

    private TrainingRequirement saveRequirement(
            String code,
            String name,
            BigDecimal requiredHours,
            Position position,
            Department department,
            ProfessionalField professionalField,
            LocalDate effectiveFrom,
            LocalDate effectiveTo
    ) {
        return requirementRepository.save(TrainingRequirement.builder()
                .code(code)
                .name(name)
                .requiredHours(requiredHours)
                .cycleYears(5)
                .jobPosition(position)
                .department(department)
                .professionalField(professionalField)
                .effectiveFrom(effectiveFrom)
                .effectiveTo(effectiveTo)
                .active(true)
                .createdByUser(admin)
                .updatedByUser(admin)
                .build());
    }

    private TrainingRecord saveRecord(
            User employee,
            LocalDate startDate,
            TrainingRecordStatus status,
            BigDecimal declaredHours,
            BigDecimal approvedHours
    ) {
        return recordRepository.save(TrainingRecord.builder()
                .employee(employee)
                .employeeDepartmentSnapshot(employee.getDepartment())
                .activityType(activityType)
                .professionalField(ultrasound)
                .title("Course " + status + " " + startDate)
                .startDate(startDate)
                .endDate(startDate)
                .durationUnit(DurationUnit.HOUR)
                .declaredHours(declaredHours)
                .approvedHours(approvedHours)
                .workflowStatus(status)
                .createdByUser(employee)
                .build());
    }

    private String requirementJson(
            String code,
            String name,
            BigDecimal requiredHours,
            Long jobPositionId,
            Long departmentId,
            Long professionalFieldId,
            LocalDate effectiveFrom,
            LocalDate effectiveTo,
            Boolean active,
            Long version
    ) throws Exception {
        Map<String, Object> request = new LinkedHashMap<>();
        request.put("code", code);
        request.put("name", name);
        request.put("requiredHours", requiredHours);
        request.put("cycleYears", 5);
        request.put("jobPositionId", jobPositionId);
        request.put("departmentId", departmentId);
        request.put("professionalFieldId", professionalFieldId);
        request.put("warningThresholdHours", null);
        request.put("effectiveFrom", effectiveFrom.toString());
        request.put("effectiveTo", effectiveTo == null ? null : effectiveTo.toString());
        request.put("active", active);
        request.put("version", version);
        return objectMapper.writeValueAsString(request);
    }

    private RequestPostProcessor jwtFor(User user, String... roles) {
        return jwt()
                .jwt(jwt -> jwt
                        .subject(user.getId().toString())
                        .claim("roles", List.of(roles))
                        .claim("employeeCode", user.getEmployeeCode()))
                .authorities(List.of(roles)
                        .stream()
                        .map(role -> new SimpleGrantedAuthority("ROLE_" + role))
                        .toArray(SimpleGrantedAuthority[]::new));
    }
}
