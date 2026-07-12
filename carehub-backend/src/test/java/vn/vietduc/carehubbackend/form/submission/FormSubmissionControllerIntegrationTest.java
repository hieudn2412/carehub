package vn.vietduc.carehubbackend.form.submission;

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
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.annotation.Transactional;
import vn.vietduc.carehubbackend.user.entity.Role;
import vn.vietduc.carehubbackend.user.entity.User;
import vn.vietduc.carehubbackend.user.entity.UserRole;
import vn.vietduc.carehubbackend.user.entity.UserStatus;
import vn.vietduc.carehubbackend.user.repository.RoleRepository;
import vn.vietduc.carehubbackend.user.repository.UserRepository;
import vn.vietduc.carehubbackend.user.repository.UserRoleRepository;

import java.util.List;

import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.blankOrNullString;
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
class FormSubmissionControllerIntegrationTest {
    private static final String QUESTION_KEY = "33333333-3333-3333-3333-333333333333";
    private static final String PASS_OPTION_KEY = "55555555-5555-5555-5555-555555555555";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RoleRepository roleRepository;

    @Autowired
    private UserRoleRepository userRoleRepository;

    private User admin;
    private User manager;
    private User subject;

    @BeforeEach
    void setUp() {
        Role adminRole = roleRepository.save(Role.builder().code("ADMIN").name("Administrator").build());
        Role managerRole = roleRepository.save(Role.builder().code("MANAGER").name("Manager").build());
        admin = userRepository.save(User.builder()
                .employeeCode("FORM_SUB_ADMIN")
                .email("form-sub-admin@example.com")
                .name("Form Submission Admin")
                .password("encoded")
                .status(UserStatus.ACTIVE)
                .build());
        manager = userRepository.save(User.builder()
                .employeeCode("FORM_SUB_MANAGER")
                .email("form-sub-manager@example.com")
                .name("Form Submission Manager")
                .password("encoded")
                .status(UserStatus.ACTIVE)
                .build());
        subject = userRepository.save(User.builder()
                .employeeCode("FORM_SUB_SUBJECT")
                .email("form-sub-subject@example.com")
                .name("Form Submission Subject")
                .password("encoded")
                .status(UserStatus.ACTIVE)
                .build());
        userRoleRepository.save(UserRole.builder().user(admin).role(adminRole).build());
        userRoleRepository.save(UserRole.builder().user(manager).role(managerRole).build());
    }

    @Test
    void managerCreatesAnswersAndSubmitsAssignedFormThenAdminReadsResponses() throws Exception {
        Fixture fixture = publishedAssignedForm();

        String createResponse = mockMvc.perform(post("/api/v1/form-submissions")
                        .with(managerJwt())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "assignmentItemId": %d,
                                  "subject": {
                                    "type": "USER",
                                    "employeeCode": "FORM_SUB_SUBJECT"
                                  }
                                }
                                """.formatted(fixture.assignmentItemId())))
                .andExpect(status().isCreated())
                .andExpect(header().exists("Location"))
                .andExpect(jsonPath("$.data.status", is("DRAFT")))
                .andExpect(jsonPath("$.data.subject.employeeCode", is("FORM_SUB_SUBJECT")))
                .andReturn()
                .getResponse()
                .getContentAsString();
        Number submissionId = JsonPath.read(createResponse, "$.data.id");
        Number lockVersion = JsonPath.read(createResponse, "$.data.lockVersion");

        String updateResponse = mockMvc.perform(put("/api/v1/form-submissions/{id}", submissionId.longValue())
                        .with(managerJwt())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "lockVersion": %d,
                                  "answers": [{
                                    "questionKey": "%s",
                                    "optionKey": "%s"
                                  }]
                                }
                                """.formatted(lockVersion.longValue(), QUESTION_KEY, PASS_OPTION_KEY)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.answers.length()", is(1)))
                .andExpect(jsonPath("$.data.scoringStatus", is("NOT_CONFIGURED")))
                .andReturn()
                .getResponse()
                .getContentAsString();
        Number updatedLockVersion = JsonPath.read(updateResponse, "$.data.lockVersion");

        mockMvc.perform(post("/api/v1/form-submissions/{id}/submission", submissionId.longValue())
                        .with(managerJwt())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"lockVersion": %d}
                                """.formatted(updatedLockVersion.longValue())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status", is("SUBMITTED")))
                .andExpect(jsonPath("$.data.scoringStatus", is("CALCULATED")))
                .andExpect(jsonPath("$.data.result", is("PASSED")))
                .andExpect(jsonPath("$.data.answers.length()", is(1)))
                .andExpect(jsonPath("$.data.submittedAt", not(blankOrNullString())));

        mockMvc.perform(get("/api/v1/forms/{formId}/responses", fixture.formId())
                        .with(adminJwt())
                        .param("includeAnswers", "true")
                        .param("size", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content.length()", is(1)))
                .andExpect(jsonPath("$.data.content[0].answers.length()", is(1)));
    }

    @Test
    void duplicateDraftAndMissingRequiredAnswerReturnDomainErrors() throws Exception {
        Fixture fixture = publishedAssignedForm();

        String createResponse = mockMvc.perform(post("/api/v1/form-submissions")
                        .with(managerJwt())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createSubmissionJson(fixture.assignmentItemId())))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        Number submissionId = JsonPath.read(createResponse, "$.data.id");
        Number lockVersion = JsonPath.read(createResponse, "$.data.lockVersion");

        mockMvc.perform(post("/api/v1/form-submissions")
                        .with(managerJwt())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createSubmissionJson(fixture.assignmentItemId())))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error_code", is("SYS_409")));

        mockMvc.perform(post("/api/v1/form-submissions/{id}/submission", submissionId.longValue())
                        .with(managerJwt())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"lockVersion": %d}
                                """.formatted(lockVersion.longValue())))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.error_code", is("VAL_001")));

        mockMvc.perform(post("/api/v1/form-submissions")
                        .with(adminJwt())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createSubmissionJson(fixture.assignmentItemId())))
                .andExpect(status().isForbidden());
    }

    private Fixture publishedAssignedForm() throws Exception {
        String createFormResponse = mockMvc.perform(post("/api/v1/forms")
                        .with(adminJwt())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"code":"SUBMISSION_FORM","title":"Submission form","subjectType":"USER"}
                                """))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        Number formId = JsonPath.read(createFormResponse, "$.data.id");

        String createVersionResponse = mockMvc.perform(post("/api/v1/forms/{formId}/versions", formId.longValue())
                        .with(adminJwt())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(versionJson()))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        Number versionId = JsonPath.read(createVersionResponse, "$.data.id");

        mockMvc.perform(post("/api/v1/forms/{formId}/versions/{versionId}/publication", formId.longValue(), versionId.longValue())
                        .with(adminJwt()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status", is("PUBLISHED")));

        String assignmentResponse = mockMvc.perform(post("/api/v1/form-assignments")
                        .with(adminJwt())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "managerId": %d,
                                  "formVersionIds": [%d]
                                }
                                """.formatted(manager.getId(), versionId.longValue())))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.items.length()", is(1)))
                .andReturn()
                .getResponse()
                .getContentAsString();
        Number assignmentItemId = JsonPath.read(assignmentResponse, "$.data.items[0].assignmentItemId");
        return new Fixture(formId.longValue(), versionId.longValue(), assignmentItemId.longValue());
    }

    private String createSubmissionJson(Long assignmentItemId) {
        return """
                {
                  "assignmentItemId": %d,
                  "subject": {
                    "type": "USER",
                    "employeeCode": "FORM_SUB_SUBJECT"
                  }
                }
                """.formatted(assignmentItemId);
    }

    private String versionJson() {
        return """
                {
                  "title": "Submission form v1",
                  "sections": [{
                    "sectionKey": "11111111-1111-1111-1111-111111111111",
                    "title": "Checklist",
                    "displayOrder": 0,
                    "items": [{
                      "itemKey": "22222222-2222-2222-2222-222222222222",
                      "itemType": "QUESTION",
                      "displayOrder": 0,
                      "question": {
                        "questionKey": "%s",
                        "code": "PASS_CHECK",
                        "title": "Pass check",
                        "fieldType": "SINGLE_CHOICE",
                        "required": true,
                        "weight": 1,
                        "options": [
                          {
                            "optionKey": "44444444-4444-4444-4444-444444444444",
                            "value": "FAIL",
                            "label": "Fail",
                            "scoreValue": 0,
                            "displayOrder": 0
                          },
                          {
                            "optionKey": "%s",
                            "value": "PASS",
                            "label": "Pass",
                            "scoreValue": 1,
                            "displayOrder": 1
                          }
                        ]
                      }
                    }]
                  }]
                }
                """.formatted(QUESTION_KEY, PASS_OPTION_KEY);
    }

    private RequestPostProcessor adminJwt() {
        return jwtFor(admin, "ADMIN");
    }

    private RequestPostProcessor managerJwt() {
        return jwtFor(manager, "MANAGER");
    }

    private RequestPostProcessor jwtFor(User user, String role) {
        return jwt()
                .jwt(jwt -> jwt
                        .subject(user.getId().toString())
                        .claim("roles", List.of(role))
                        .claim("employeeCode", user.getEmployeeCode()))
                .authorities(new SimpleGrantedAuthority("ROLE_" + role));
    }

    private record Fixture(Long formId, Long versionId, Long assignmentItemId) {
    }
}
