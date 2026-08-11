package vn.vietduc.carehubbackend.training.controller;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.annotation.Transactional;
import vn.vietduc.carehubbackend.training.entity.ProfessionalField;
import vn.vietduc.carehubbackend.training.entity.TrainingActivityType;
import vn.vietduc.carehubbackend.training.entity.TrainingRecord;
import vn.vietduc.carehubbackend.training.enums.DurationUnit;
import vn.vietduc.carehubbackend.training.enums.TrainingRecordStatus;
import vn.vietduc.carehubbackend.training.repository.ProfessionalFieldRepository;
import vn.vietduc.carehubbackend.training.repository.TrainingActivityTypeRepository;
import vn.vietduc.carehubbackend.training.repository.TrainingRecordRepository;
import vn.vietduc.carehubbackend.user.entity.Department;
import vn.vietduc.carehubbackend.user.entity.Position;
import vn.vietduc.carehubbackend.user.entity.User;
import vn.vietduc.carehubbackend.user.entity.UserStatus;
import vn.vietduc.carehubbackend.user.repository.DepartmentRepository;
import vn.vietduc.carehubbackend.user.repository.PositionRepository;
import vn.vietduc.carehubbackend.user.repository.UserRepository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.Year;
import java.util.List;

import static org.hamcrest.Matchers.hasItem;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
@TestPropertySource(properties = "spring.jpa.hibernate.ddl-auto=create-drop")
class TrainingProfessionalFieldHoursControllerIntegrationTest {
    @Autowired
    private MockMvc mockMvc;

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

    private User employee;
    private User otherEmployee;
    private ProfessionalField intensiveCare;
    private ProfessionalField surgery;
    private TrainingActivityType activityType;

    @BeforeEach
    void setUp() {
        Department department = departmentRepository.save(Department.builder()
                .departmentCode("PFH_DEP")
                .name("Professional Field Hours Department")
                .build());
        Position position = positionRepository.save(Position.builder()
                .name("Professional Field Hours Position")
                .build());
        employee = saveUser("PFH_EMP", "pfh-employee@example.com", department, position);
        otherEmployee = saveUser("PFH_OTHER", "pfh-other@example.com", department, position);
        intensiveCare = professionalFieldRepository.save(ProfessionalField.builder()
                .code("PFH_ICU")
                .name("Hồi sức cấp cứu")
                .active(true)
                .build());
        surgery = professionalFieldRepository.save(ProfessionalField.builder()
                .code("PFH_SURGERY")
                .name("Ngoại khoa")
                .active(true)
                .build());
        activityType = activityTypeRepository.save(TrainingActivityType.builder()
                .code("PFH_TYPE")
                .name("Professional Field Hours Type")
                .defaultDurationUnit(DurationUnit.HOUR)
                .requiresEvidence(false)
                .active(true)
                .build());
    }

    @Test
    @DisplayName("Professional-field chart aggregates only the current employee's submitted hours inside the selected year")
    void aggregatesSubmittedHoursByFieldAndSelectedYear() throws Exception {
        saveRecord(employee, "ICU first boundary", LocalDate.of(2025, 1, 1),
                TrainingRecordStatus.SUBMITTED, new BigDecimal("10.50"), intensiveCare);
        saveRecord(employee, "ICU last boundary", LocalDate.of(2025, 12, 31),
                TrainingRecordStatus.SUBMITTED, new BigDecimal("9.50"), intensiveCare);
        saveRecord(employee, "Surgery", LocalDate.of(2025, 6, 1),
                TrainingRecordStatus.SUBMITTED, new BigDecimal("20.00"), surgery);
        saveRecord(employee, "Unassigned", LocalDate.of(2025, 7, 1),
                TrainingRecordStatus.SUBMITTED, new BigDecimal("2.00"), null);
        saveRecord(employee, "Draft excluded", LocalDate.of(2025, 8, 1),
                TrainingRecordStatus.DRAFT, new BigDecimal("1000.00"), surgery);
        saveRecord(employee, "Cancelled excluded", LocalDate.of(2025, 9, 1),
                TrainingRecordStatus.CANCELLED, new BigDecimal("1000.00"), surgery);
        saveRecord(employee, "Previous year", LocalDate.of(2024, 12, 31),
                TrainingRecordStatus.SUBMITTED, new BigDecimal("4.00"), intensiveCare);
        saveRecord(otherEmployee, "Other employee excluded", LocalDate.of(2025, 6, 1),
                TrainingRecordStatus.SUBMITTED, new BigDecimal("999.00"), surgery);

        mockMvc.perform(get("/api/v1/training/status/me/professional-field-hours")
                        .with(jwtFor(employee))
                        .param("year", "2025"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.year").value(2025))
                .andExpect(jsonPath("$.data.fields.length()").value(3))
                .andExpect(jsonPath("$.data.fields[0].professionalFieldId").value(intensiveCare.getId()))
                .andExpect(jsonPath("$.data.fields[0].professionalFieldName").value("Hồi sức cấp cứu"))
                .andExpect(jsonPath("$.data.fields[0].submittedHours").value(20.0))
                .andExpect(jsonPath("$.data.fields[1].professionalFieldId").value(surgery.getId()))
                .andExpect(jsonPath("$.data.fields[1].professionalFieldName").value("Ngoại khoa"))
                .andExpect(jsonPath("$.data.fields[1].submittedHours").value(20.0))
                .andExpect(jsonPath("$.data.fields[2].professionalFieldId").doesNotExist())
                .andExpect(jsonPath("$.data.fields[2].professionalFieldName").value("Chưa xác định"))
                .andExpect(jsonPath("$.data.fields[2].submittedHours").value(2.0))
                .andExpect(jsonPath("$.data.availableYears[0]").value(Year.now().getValue()))
                .andExpect(jsonPath("$.data.availableYears", hasItem(Year.now().getValue())))
                .andExpect(jsonPath("$.data.availableYears", hasItem(2025)))
                .andExpect(jsonPath("$.data.availableYears", hasItem(2024)));
    }

    @Test
    @DisplayName("Professional-field chart defaults to the current year and returns an empty field list when no records match")
    void defaultsToCurrentYearAndReturnsEmptyForYearWithoutData() throws Exception {
        int currentYear = Year.now().getValue();
        saveRecord(employee, "Current year", LocalDate.of(currentYear, 2, 1),
                TrainingRecordStatus.SUBMITTED, new BigDecimal("8.00"), intensiveCare);

        mockMvc.perform(get("/api/v1/training/status/me/professional-field-hours")
                        .with(jwtFor(employee)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.year").value(currentYear))
                .andExpect(jsonPath("$.data.fields.length()").value(1))
                .andExpect(jsonPath("$.data.fields[0].submittedHours").value(8.0));

        mockMvc.perform(get("/api/v1/training/status/me/professional-field-hours")
                        .with(jwtFor(employee))
                        .param("year", "1900"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.year").value(1900))
                .andExpect(jsonPath("$.data.fields.length()").value(0))
                .andExpect(jsonPath("$.data.availableYears", hasItem(currentYear)));
    }

    @Test
    @DisplayName("Professional-field chart rejects years outside LocalDate's supported range")
    void rejectsYearOutsideLocalDateRange() throws Exception {
        mockMvc.perform(get("/api/v1/training/status/me/professional-field-hours")
                        .with(jwtFor(employee))
                        .param("year", "1000000000"))
                .andExpect(status().isBadRequest());
    }

    private User saveUser(String employeeCode, String email, Department department, Position position) {
        return userRepository.save(User.builder()
                .employeeCode(employeeCode)
                .email(email)
                .name(employeeCode)
                .password("encoded")
                .department(department)
                .position(position)
                .status(UserStatus.ACTIVE)
                .build());
    }

    private void saveRecord(
            User owner,
            String title,
            LocalDate startDate,
            TrainingRecordStatus status,
            BigDecimal hours,
            ProfessionalField professionalField
    ) {
        recordRepository.save(TrainingRecord.builder()
                .employee(owner)
                .employeeDepartmentSnapshot(owner.getDepartment())
                .activityType(activityType)
                .professionalField(professionalField)
                .title(title)
                .provider("Professional Field Hours Provider")
                .startDate(startDate)
                .endDate(startDate)
                .durationUnit(DurationUnit.HOUR)
                .declaredHours(hours)
                .workflowStatus(status)
                .submittedAt(status == TrainingRecordStatus.SUBMITTED
                        ? LocalDateTime.of(startDate, java.time.LocalTime.NOON)
                        : null)
                .createdByUser(owner)
                .updatedByUser(owner)
                .build());
    }

    private RequestPostProcessor jwtFor(User user) {
        return jwt()
                .jwt(jwt -> jwt
                        .subject(user.getId().toString())
                        .claim("roles", List.of("USER"))
                        .claim("employeeCode", user.getEmployeeCode()))
                .authorities(new SimpleGrantedAuthority("ROLE_USER"));
    }
}
