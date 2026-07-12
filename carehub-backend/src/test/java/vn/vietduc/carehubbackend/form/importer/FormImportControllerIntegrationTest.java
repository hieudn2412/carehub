package vn.vietduc.carehubbackend.form.importer;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import vn.vietduc.carehubbackend.form.importer.client.GooglePublicFormClient;
import vn.vietduc.carehubbackend.form.importer.config.FormImportProperties;
import vn.vietduc.carehubbackend.form.repository.FormRepository;
import vn.vietduc.carehubbackend.user.entity.User;
import vn.vietduc.carehubbackend.user.entity.UserStatus;
import vn.vietduc.carehubbackend.user.repository.UserRepository;

import java.net.URI;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

import static org.hamcrest.Matchers.is;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
@TestPropertySource(properties = "spring.jpa.hibernate.ddl-auto=create-drop")
class FormImportControllerIntegrationTest {
    private static final String GOOGLE_FORM_URL = "https://docs.google.com/forms/d/e/FORM_TEST/viewform";
    private static final AtomicInteger USER_SEQUENCE = new AtomicInteger();

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private FormRepository formRepository;

    private User admin;

    @BeforeEach
    void setUp() {
        int sequence = USER_SEQUENCE.incrementAndGet();
        admin = userRepository.save(User.builder()
                .employeeCode("FORM_IMPORT_ADMIN_" + sequence)
                .email("form-import-admin-%d@example.com".formatted(sequence))
                .name("Form Import Admin")
                .password("encoded")
                .status(UserStatus.ACTIVE)
                .build());
    }

    @Test
    void previewAndApplyGoogleFormImportWithoutCallingNetwork() throws Exception {
        String previewResponse = mockMvc.perform(post("/api/v1/form-import-batches")
                        .with(adminJwt())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "forms": [{
                                    "code": "HAND_HYGIENE",
                                    "sourceUrl": "%s",
                                    "displayOrder": 0
                                  }]
                                }
                                """.formatted(GOOGLE_FORM_URL)))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.data.status", is("VALIDATED")))
                .andExpect(jsonPath("$.data.totalForms", is(1)))
                .andExpect(jsonPath("$.data.successForms", is(1)))
                .andExpect(jsonPath("$.data.warningForms", is(1)))
                .andExpect(jsonPath("$.data.rows[0].status", is("WARNING")))
                .andExpect(jsonPath("$.data.rows[0].code", is("HAND_HYGIENE")))
                .andReturn()
                .getResponse()
                .getContentAsString();
        Number batchId = JsonPath.read(previewResponse, "$.data.id");

        mockMvc.perform(get("/api/v1/form-import-batches/{id}", batchId.longValue())
                        .with(adminJwt()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.rows[0].sourceTitle", is("Hand hygiene audit")));

        mockMvc.perform(post("/api/v1/form-import-batches/{id}/application", batchId.longValue())
                        .with(adminJwt()))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.data.status", is("APPLIED")))
                .andExpect(jsonPath("$.data.rows[0].status", is("IMPORTED")))
                .andExpect(jsonPath("$.data.rows[0].formId").isNumber())
                .andExpect(jsonPath("$.data.rows[0].versionId").isNumber());

        assertTrue(formRepository.findByCodeIgnoreCaseAndDeletedFalse("HAND_HYGIENE").isPresent());
    }

    @Test
    void previewRejectsDuplicateCodesAndRequiresAdmin() throws Exception {
        String duplicateRequest = """
                {
                  "forms": [
                    {"code": "DUP_FORM", "sourceUrl": "%s", "displayOrder": 0},
                    {"code": "dup_form", "sourceUrl": "%s", "displayOrder": 1}
                  ]
                }
                """.formatted(GOOGLE_FORM_URL, GOOGLE_FORM_URL);

        mockMvc.perform(post("/api/v1/form-import-batches")
                        .with(adminJwt())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(duplicateRequest))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.error_code", is("VAL_001")));

        mockMvc.perform(post("/api/v1/form-import-batches")
                        .with(userJwt())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"forms":[{"code":"OK","sourceUrl":"%s","displayOrder":0}]}
                                """.formatted(GOOGLE_FORM_URL)))
                .andExpect(status().isForbidden());
    }

    private RequestPostProcessor adminJwt() {
        return jwt()
                .jwt(jwt -> jwt
                        .subject(admin.getId().toString())
                        .claim("roles", List.of("ADMIN"))
                        .claim("employeeCode", admin.getEmployeeCode()))
                .authorities(new SimpleGrantedAuthority("ROLE_ADMIN"));
    }

    private RequestPostProcessor userJwt() {
        return jwt()
                .jwt(jwt -> jwt.subject("2").claim("roles", List.of("USER")).claim("employeeCode", "USER"))
                .authorities(new SimpleGrantedAuthority("ROLE_USER"));
    }

    @TestConfiguration
    static class FakeGooglePublicFormClientConfig {
        @Bean
        @Primary
        GooglePublicFormClient googlePublicFormClient(FormImportProperties properties) {
            return new GooglePublicFormClient(null, properties) {
                @Override
                public Source fetch(String sourceUrl) {
                    URI uri = validate(sourceUrl);
                    return new Source(extractFormId(uri), uri.toString(), htmlPayload());
                }

                @Override
                public URI validate(String sourceUrl) {
                    if (!GOOGLE_FORM_URL.equals(sourceUrl)) {
                        throw new IllegalArgumentException("Unexpected test URL: " + sourceUrl);
                    }
                    return URI.create(GOOGLE_FORM_URL);
                }

                @Override
                public String extractFormId(URI uri) {
                    return "FORM_TEST";
                }
            };
        }

        private static String htmlPayload() {
            String payload = """
                    [null,["Audit form",[[11,"Hand hygiene step",null,2,[[101,[["Yes"],["No"]],1]]]],null,null,null,null,null,null,"Hand hygiene audit"],null,"Document title"]
                    """;
            return "<script>var FB_PUBLIC_LOAD_DATA_ = " + payload.strip() + ";</script>";
        }
    }
}
