package vn.vietduc.carehubbackend.form.controller;

import com.jayway.jsonpath.JsonPath;
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
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;
import vn.vietduc.carehubbackend.user.entity.User;
import vn.vietduc.carehubbackend.user.repository.UserRepository;

import java.util.List;

import static org.hamcrest.Matchers.is;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
@TestPropertySource(properties = "spring.jpa.hibernate.ddl-auto=create-drop")
class FormBuilderControllerIntegrationTest {
    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    private User admin;

    @BeforeEach
    void setUp() {
        admin = userRepository.save(User.builder()
                .employeeCode("FORM_ADMIN")
                .email("form-admin@example.com")
                .name("Form Admin")
                .password("encoded")
                .build());
    }

    @Test
    void fullBuilderLifecycleCreatesPublishesAndClonesVersion() throws Exception {
        MvcResult createFormResult = mockMvc.perform(post("/api/v1/forms")
                        .with(adminJwt())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "code": " safety-round ",
                                  "title": "Safety round",
                                  "description": "Daily safety form",
                                  "subjectType": "ROOM"
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(header().exists("Location"))
                .andExpect(jsonPath("$.data.code", is("SAFETY-ROUND")))
                .andExpect(jsonPath("$.data.status", is("DRAFT")))
                .andReturn();
        Number formId = JsonPath.read(createFormResult.getResponse().getContentAsString(), "$.data.id");

        MvcResult createVersionResult = mockMvc.perform(post("/api/v1/forms/{formId}/versions", formId.longValue())
                        .with(adminJwt())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(validVersionJson()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.versionNumber", is(1)))
                .andExpect(jsonPath("$.data.status", is("DRAFT")))
                .andExpect(jsonPath("$.data.sections[0].items[0].question.options.length()", is(2)))
                .andReturn();
        Number versionId = JsonPath.read(createVersionResult.getResponse().getContentAsString(), "$.data.id");
        Number lockVersion = JsonPath.read(createVersionResult.getResponse().getContentAsString(), "$.data.lockVersion");

        String updateJson = validVersionJson()
                .replaceFirst("\\{", "{\"lockVersion\":" + lockVersion.longValue() + ",")
                .replace("Safety round v1", "Safety round v1 updated");
        mockMvc.perform(put("/api/v1/forms/{formId}/versions/{versionId}", formId.longValue(), versionId.longValue())
                        .with(adminJwt())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(updateJson))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.title", is("Safety round v1 updated")));

        mockMvc.perform(post("/api/v1/forms/{formId}/versions/{versionId}/publication", formId.longValue(), versionId.longValue())
                        .with(adminJwt()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status", is("PUBLISHED")))
                .andExpect(jsonPath("$.data.publishedBy.id", is(admin.getId().intValue())))
                .andExpect(jsonPath("$.data.schemaHash").isNotEmpty());

        mockMvc.perform(post("/api/v1/forms/{formId}/versions", formId.longValue())
                        .with(adminJwt())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.versionNumber", is(2)))
                .andExpect(jsonPath("$.data.status", is("DRAFT")))
                .andExpect(jsonPath("$.data.sections[0].sectionKey", is("11111111-1111-1111-1111-111111111111")))
                .andExpect(jsonPath("$.data.sections[0].items[0].question.code", is("RISK_LEVEL")));

        mockMvc.perform(put("/api/v1/forms/{formId}/versions/{versionId}", formId.longValue(), versionId.longValue())
                        .with(adminJwt())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"lockVersion\":0}"))
                .andExpect(status().isConflict());
    }

    @Test
    void listSupportsFilteringAndBuilderRequiresAdmin() throws Exception {
        mockMvc.perform(post("/api/v1/forms")
                        .with(adminJwt())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"code":"ROOM-A","title":"Room A","subjectType":"ROOM"}
                                """))
                .andExpect(status().isCreated());

        mockMvc.perform(get("/api/v1/forms")
                        .with(adminJwt())
                        .param("keyword", "room-a")
                        .param("subjectType", "ROOM")
                        .param("size", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content.length()", is(1)))
                .andExpect(jsonPath("$.data.content[0].code", is("ROOM-A")));

        mockMvc.perform(get("/api/v1/forms")
                        .with(jwt().authorities(new SimpleGrantedAuthority("ROLE_USER"))))
                .andExpect(status().isForbidden());
    }

    @Test
    void invalidAndDuplicateFormsReturnConsistentErrors() throws Exception {
        mockMvc.perform(post("/api/v1/forms")
                        .with(adminJwt())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\":\"?\",\"title\":\"\",\"subjectType\":\"ROOM\"}"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.error_code", is("VAL_001")));

        String valid = "{\"code\":\"DUPLICATE\",\"title\":\"One\",\"subjectType\":\"USER\"}";
        mockMvc.perform(post("/api/v1/forms")
                        .with(adminJwt())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(valid))
                .andExpect(status().isCreated());
        mockMvc.perform(post("/api/v1/forms")
                        .with(adminJwt())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(valid))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error_code", is("SYS_409")));
    }

    @Test
    void previewApiReturnsFormListAndCompleteDraftStructure() throws Exception {
        MvcResult createFormResult = mockMvc.perform(post("/api/v1/forms")
                        .with(adminJwt())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "code": "PREVIEW-FORM",
                                  "title": "Preview form",
                                  "description": "Google Forms style preview",
                                  "subjectType": "USER"
                                }
                                """))
                .andExpect(status().isCreated())
                .andReturn();
        Number formId = JsonPath.read(createFormResult.getResponse().getContentAsString(), "$.data.id");

        MvcResult createVersionResult = mockMvc.perform(post(
                        "/api/v1/forms/{formId}/versions",
                        formId.longValue()
                )
                        .with(adminJwt())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(validVersionJson()))
                .andExpect(status().isCreated())
                .andReturn();
        Number versionId = JsonPath.read(createVersionResult.getResponse().getContentAsString(), "$.data.id");

        mockMvc.perform(get("/api/v1/form-previews")
                        .with(adminJwt())
                        .param("keyword", "preview-form"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content.length()", is(1)))
                .andExpect(jsonPath("$.data.content[0].code", is("PREVIEW-FORM")))
                .andExpect(jsonPath("$.data.content[0].previewVersion.id", is(versionId.intValue())))
                .andExpect(jsonPath("$.data.content[0].previewVersion.status", is("DRAFT")));

        mockMvc.perform(get("/api/v1/form-previews/{formId}", formId.longValue())
                        .with(adminJwt()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.form.id", is(formId.intValue())))
                .andExpect(jsonPath("$.data.version.id", is(versionId.intValue())))
                .andExpect(jsonPath("$.data.version.status", is("DRAFT")))
                .andExpect(jsonPath("$.data.version.sections[0].title", is("Risk assessment")))
                .andExpect(jsonPath("$.data.version.sections[0].items[0].question.fieldType", is("SINGLE_CHOICE")))
                .andExpect(jsonPath("$.data.version.sections[0].items[0].question.options.length()", is(2)));

        mockMvc.perform(get("/api/v1/form-previews/{formId}", formId.longValue())
                        .with(jwt().authorities(new SimpleGrantedAuthority("ROLE_USER"))))
                .andExpect(status().isForbidden());
    }

    private String validVersionJson() {
        return """
                {
                  "title": "Safety round v1",
                  "settings": {"scoringEnabled": true},
                  "sections": [{
                    "sectionKey": "11111111-1111-1111-1111-111111111111",
                    "title": "Risk assessment",
                    "displayOrder": 0,
                    "items": [{
                      "itemKey": "22222222-2222-2222-2222-222222222222",
                      "itemType": "QUESTION",
                      "displayOrder": 0,
                      "question": {
                        "questionKey": "33333333-3333-3333-3333-333333333333",
                        "code": "risk_level",
                        "title": "Risk level",
                        "fieldType": "SINGLE_CHOICE",
                        "required": true,
                        "weight": 1,
                        "options": [
                          {
                            "optionKey": "44444444-4444-4444-4444-444444444444",
            "value": "LOW",
            "label": "Low",
            "scoreValue": 0,
            "displayOrder": 0
                          },
                          {
                            "optionKey": "55555555-5555-5555-5555-555555555555",
            "value": "HIGH",
            "label": "High",
            "scoreValue": 1,
            "displayOrder": 1
                          }
                        ]
                      }
                    }]
                  }]
                }
                """;
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
