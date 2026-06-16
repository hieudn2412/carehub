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
import org.springframework.transaction.annotation.Transactional;
import vn.vietduc.carehubbackend.training.dto.request.ActivityTypeFormRequest;
import vn.vietduc.carehubbackend.training.dto.request.ActivityTypeStatusRequest;
import vn.vietduc.carehubbackend.training.entity.TrainingActivityType;
import vn.vietduc.carehubbackend.training.entity.TrainingRecord;
import vn.vietduc.carehubbackend.training.enums.DurationUnit;
import vn.vietduc.carehubbackend.training.repository.TrainingActivityTypeRepository;
import vn.vietduc.carehubbackend.training.repository.TrainingRecordRepository;
import vn.vietduc.carehubbackend.user.entity.User;
import vn.vietduc.carehubbackend.user.repository.UserRepository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.greaterThanOrEqualTo;
import static org.hamcrest.Matchers.is;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
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
class TrainingActivityTypeControllerIntegrationTest {
    @Autowired
    private MockMvc mockMvc;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private TrainingActivityTypeRepository activityTypeRepository;

    @Autowired
    private TrainingRecordRepository recordRepository;

    private User admin;

    @BeforeEach
    void setUp() {
        admin = userRepository.save(User.builder()
                .employeeCode("ADMIN_PHASE2")
                .email("phase2-admin@example.com")
                .name("Phase 2 Admin")
                .password("encoded")
                .build());
    }

    @Test
    void createValidActivityTypeNormalizesCodeAndWritesAudit() throws Exception {
        ActivityTypeFormRequest request = form(" cme ", "Đào tạo liên tục", BigDecimal.valueOf(8));

        mockMvc.perform(post("/api/v1/training/activity-types")
                        .with(adminJwt())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.code", is("CME")))
                .andExpect(jsonPath("$.data.auditTimeline.length()", greaterThanOrEqualTo(1)));
    }

    @Test
    void duplicateCodeReturnsConflict() throws Exception {
        activityTypeRepository.save(TrainingActivityType.builder()
                .code("CME")
                .name("Existing")
                .defaultDurationUnit(DurationUnit.HOUR)
                .build());

        mockMvc.perform(post("/api/v1/training/activity-types")
                        .with(adminJwt())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(form("cme", "Duplicate", BigDecimal.valueOf(1)))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.data.code", is("CONFLICT")));
    }

    @Test
    void invalidMaxHoursReturnsUnprocessableEntity() throws Exception {
        mockMvc.perform(post("/api/v1/training/activity-types")
                        .with(adminJwt())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(form("BAD", "Bad", BigDecimal.ZERO))))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.data.code", is("VALIDATION_FAILED")));
    }

    @Test
    void listFiltersKeywordCaseInsensitiveAndReturnsUsageCount() throws Exception {
        TrainingActivityType activityType = activityTypeRepository.save(TrainingActivityType.builder()
                .code("CME")
                .name("Continuing Medical Education")
                .defaultDurationUnit(DurationUnit.HOUR)
                .build());
        recordRepository.save(TrainingRecord.builder()
                .employee(admin)
                .activityType(activityType)
                .title("Record")
                .startDate(LocalDate.of(2026, 1, 1))
                .createdByUser(admin)
                .build());

        mockMvc.perform(get("/api/v1/training/activity-types")
                        .with(adminJwt())
                        .param("keyword", "medical")
                        .param("page", "0")
                        .param("size", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content[0].code", is("CME")))
                .andExpect(jsonPath("$.data.content[0].usageCount", is(1)));
    }

    @Test
    void deactivateReferencedTypeSucceedsAndDeleteEndpointDoesNotExist() throws Exception {
        TrainingActivityType activityType = activityTypeRepository.save(TrainingActivityType.builder()
                .code("REF")
                .name("Referenced")
                .defaultDurationUnit(DurationUnit.HOUR)
                .build());
        recordRepository.save(TrainingRecord.builder()
                .employee(admin)
                .activityType(activityType)
                .title("Record")
                .startDate(LocalDate.of(2026, 1, 1))
                .createdByUser(admin)
                .build());

        mockMvc.perform(patch("/api/v1/training/activity-types/{id}/status", activityType.getId())
                        .with(adminJwt())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new ActivityTypeStatusRequest(false, activityType.getVersion()))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.active", is(false)))
                .andExpect(jsonPath("$.data.usageCount", is(1)));

        mockMvc.perform(delete("/api/v1/training/activity-types/{id}", activityType.getId())
                        .with(adminJwt()))
                .andExpect(status().isMethodNotAllowed());
    }

    @Test
    void staleVersionReturnsConflict() throws Exception {
        TrainingActivityType activityType = activityTypeRepository.save(TrainingActivityType.builder()
                .code("OLD")
                .name("Old")
                .defaultDurationUnit(DurationUnit.HOUR)
                .build());
        ActivityTypeFormRequest request = new ActivityTypeFormRequest(
                "OLD",
                "Changed",
                null,
                DurationUnit.HOUR,
                true,
                BigDecimal.valueOf(2),
                0,
                true,
                activityType.getVersion() + 10
        );

        mockMvc.perform(put("/api/v1/training/activity-types/{id}", activityType.getId())
                        .with(adminJwt())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.data.message", containsString("updated by another user")));
    }

    @Test
    void referencedTypeCannotChangeCode() throws Exception {
        TrainingActivityType activityType = activityTypeRepository.save(TrainingActivityType.builder()
                .code("LOCKED")
                .name("Locked")
                .defaultDurationUnit(DurationUnit.HOUR)
                .build());
        recordRepository.save(TrainingRecord.builder()
                .employee(admin)
                .activityType(activityType)
                .title("Record")
                .startDate(LocalDate.of(2026, 1, 1))
                .createdByUser(admin)
                .build());
        ActivityTypeFormRequest request = new ActivityTypeFormRequest(
                "NEWCODE",
                "Locked",
                null,
                DurationUnit.HOUR,
                true,
                BigDecimal.valueOf(2),
                0,
                true,
                activityType.getVersion()
        );

        mockMvc.perform(put("/api/v1/training/activity-types/{id}", activityType.getId())
                        .with(adminJwt())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isConflict());
    }

    private ActivityTypeFormRequest form(String code, String name, BigDecimal maxHours) {
        return new ActivityTypeFormRequest(
                code,
                name,
                "Description",
                DurationUnit.HOUR,
                true,
                maxHours,
                0,
                true,
                null
        );
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
