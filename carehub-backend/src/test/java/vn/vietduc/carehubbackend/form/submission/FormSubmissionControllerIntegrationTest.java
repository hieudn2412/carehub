package vn.vietduc.carehubbackend.form.submission;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.DisplayName;
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
import vn.vietduc.carehubbackend.user.entity.Department;
import vn.vietduc.carehubbackend.user.entity.Role;
import vn.vietduc.carehubbackend.user.entity.User;
import vn.vietduc.carehubbackend.user.entity.UserRole;
import vn.vietduc.carehubbackend.user.entity.UserStatus;
import vn.vietduc.carehubbackend.user.repository.DepartmentRepository;
import vn.vietduc.carehubbackend.user.repository.RoleRepository;
import vn.vietduc.carehubbackend.user.repository.UserRepository;
import vn.vietduc.carehubbackend.user.repository.UserRoleRepository;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.blankOrNullString;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
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

    @Autowired
    private DepartmentRepository departmentRepository;

    private User admin;
    private User manager;
    private User subject;

    @BeforeEach
    void setUp() {
        Role adminRole = roleRepository.save(Role.builder().code("ADMIN").name("Administrator").build());
        Role managerRole = roleRepository.save(Role.builder().code("MANAGER").name("Manager").build());
        Department department = departmentRepository.save(Department.builder()
                .departmentCode("FORM_SUB_DEPT")
                .name("Khoa kiểm thử biểu mẫu")
                .build());
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
                .department(department)
                .status(UserStatus.ACTIVE)
                .build());
        subject = userRepository.save(User.builder()
                .employeeCode("FORM_SUB_SUBJECT")
                .email("form-sub-subject@example.com")
                .name("Form Submission Subject")
                .password("encoded")
                .department(department)
                .status(UserStatus.ACTIVE)
                .build());
        userRoleRepository.save(UserRole.builder().user(admin).role(adminRole).build());
        userRoleRepository.save(UserRole.builder().user(manager).role(managerRole).build());
    }

    @DisplayName("L2-SCR-01 | Happy Path: DRAFT → answers → SUBMITTED with lockVersion; scoringStatus CALCULATED, result PASSED; admin reads responses")
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
                                    "userId": %d
                                  }
                                }
                                """.formatted(fixture.assignmentItemId(), subject.getId())))
                .andExpect(status().isCreated())
                .andExpect(header().exists("Location"))
                .andExpect(jsonPath("$.data.status", is("DRAFT")))
                .andExpect(jsonPath("$.data.subject.employeeCode", is("FORM_SUB_SUBJECT")))
                .andReturn()
                .getResponse()
                .getContentAsString();
        Number submissionId = JsonPath.read(createResponse, "$.data.id");
        Number lockVersion = JsonPath.read(createResponse, "$.data.lockVersion");

        mockMvc.perform(get("/api/v1/form-submissions/draft")
                        .with(managerJwt())
                        .param("assignmentItemId", fixture.assignmentItemId().toString())
                        .param("subjectUserId", subject.getId().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id", is(submissionId.intValue())))
                .andExpect(jsonPath("$.data.status", is("DRAFT")));

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

        mockMvc.perform(get("/api/v1/form-submissions")
                        .with(managerJwt())
                        .param("status", "SUBMITTED")
                        .param("keyword", "Subject")
                        .param("size", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content.length()", is(1)))
                .andExpect(jsonPath("$.data.content[0].submittedBy.fullName", is(manager.getName())))
                .andExpect(jsonPath("$.data.content[0].subject.employeeCode", is(subject.getEmployeeCode())));

        mockMvc.perform(get("/api/v1/form-submissions")
                        .with(managerJwt())
                        .param("status", "SUBMITTED")
                        .param("keyword", "khong-ton-tai")
                        .param("size", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content.length()", is(0)));

        mockMvc.perform(get("/api/v1/forms/{formId}/responses", fixture.formId())
                        .with(adminJwt())
                        .param("includeAnswers", "true")
                        .param("size", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content.length()", is(1)))
                .andExpect(jsonPath("$.data.content[0].answers.length()", is(1)));

        mockMvc.perform(get("/api/v1/forms/history")
                        .with(managerJwt())
                        .param("dateFrom", "2020-01-01")
                        .param("dateTo", "2030-12-31"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content.length()", is(1)))
                .andExpect(jsonPath("$.data.content[0].formId", is(fixture.formId().intValue())))
                .andExpect(jsonPath("$.data.content[0].monitoringCount", is(1)))
                .andExpect(jsonPath("$.data.content[0].passedCount", is(1)));

        mockMvc.perform(get("/api/v1/forms/{formId}/history/versions", fixture.formId())
                        .with(managerJwt())
                        .param("dateFrom", "2020-01-01")
                        .param("dateTo", "2030-12-31"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()", is(1)))
                .andExpect(jsonPath("$.data[0].total", is(1)))
                .andExpect(jsonPath("$.data[0].passed", is(1)));

        mockMvc.perform(get("/api/v1/forms/{formId}/versions/{versionId}/responses",
                        fixture.formId(), fixture.versionId())
                        .with(managerJwt())
                        .param("status", "SUBMITTED")
                        .param("dateFrom", "2020-01-01")
                        .param("dateTo", "2030-12-31"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content.length()", is(1)));

        mockMvc.perform(get("/api/v1/form-submissions/{id}", submissionId.longValue())
                        .with(managerJwt()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id", is(submissionId.intValue())));

        mockMvc.perform(delete("/api/v1/form-assignment-items/{id}", fixture.assignmentItemId())
                        .with(adminJwt()))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/v1/forms/history")
                        .with(managerJwt())
                        .param("dateFrom", "2020-01-01")
                        .param("dateTo", "2030-12-31"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content.length()", is(1)))
                .andExpect(jsonPath("$.data.content[0].monitoringCount", is(1)));

        mockMvc.perform(get("/api/v1/forms/{formId}/history/versions/{versionId}",
                        fixture.formId(), fixture.versionId())
                        .with(managerJwt()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id", is(fixture.versionId().intValue())))
                .andExpect(jsonPath("$.data.sections.length()", is(1)));
    }

    @DisplayName("L2-SCR-02 | Constraint Violation: second draft for the same assignment+subject → 409; missing required answer → 422; foreign assignment → 404")
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
                .andExpect(status().isNotFound());
    }

    @DisplayName("L2-SCR-03 | Happy Path: admin direct evaluation from a published version stores assignment_item_id = NULL")
    @Test
    void adminCreatesDirectSubmissionFromPublishedVersionWithoutAssignment() throws Exception {
        Fixture fixture = publishedAssignedForm();

        String createResponse = mockMvc.perform(post("/api/v1/form-submissions")
                        .with(adminJwt())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "formVersionId": %d,
                                  "subject": {
                                    "type": "USER",
                                    "userId": %d
                                  }
                                }
                                """.formatted(fixture.versionId(), subject.getId())))
                .andExpect(status().isCreated())
                .andExpect(header().exists("Location"))
                .andExpect(jsonPath("$.data.status", is("DRAFT")))
                .andExpect(jsonPath("$.data.assignmentItemId").doesNotExist())
                .andExpect(jsonPath("$.data.subject.employeeCode", is("FORM_SUB_SUBJECT")))
                .andReturn()
                .getResponse()
                .getContentAsString();
        Number submissionId = JsonPath.read(createResponse, "$.data.id");

        mockMvc.perform(get("/api/v1/form-submissions/draft")
                        .with(adminJwt())
                        .param("formVersionId", fixture.versionId().toString())
                        .param("subjectUserId", subject.getId().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id", is(submissionId.intValue())));

        mockMvc.perform(post("/api/v1/form-submissions")
                        .with(adminJwt())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "formVersionId": %d,
                                  "subject": {
                                    "type": "USER",
                                    "userId": %d
                                  }
                                }
                                """.formatted(fixture.versionId(), subject.getId())))
                .andExpect(status().isConflict());
    }

    @Test
    void subjectSearchRequiresAssignmentForNonAdminAndReturnsActiveUsers() throws Exception {
        Fixture fixture = publishedAssignedForm();
        Department otherDepartment = departmentRepository.save(Department.builder()
                .departmentCode("FORM_SUB_OTHER_DEPT")
                .name("Khoa khác")
                .build());
        User foreignSubject = userRepository.save(User.builder()
                .employeeCode("FORM_SUB_FOREIGN")
                .email("form-sub-foreign@example.com")
                .name("Nhân viên khoa khác")
                .password("encoded")
                .department(otherDepartment)
                .status(UserStatus.ACTIVE)
                .build());

        mockMvc.perform(get("/api/v1/form-subjects/users/search")
                        .with(managerJwt())
                        .param("assignmentItemId", fixture.assignmentItemId().toString())
                        .param("keyword", "SUBJECT")
                        .param("size", "20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content.length()", is(1)))
                .andExpect(jsonPath("$.data.content[0].userId", is(subject.getId().intValue())))
                .andExpect(jsonPath("$.data.content[0].employeeCode", is(subject.getEmployeeCode())));

        mockMvc.perform(get("/api/v1/form-subjects/users/search")
                        .with(managerJwt())
                        .param("assignmentItemId", fixture.assignmentItemId().toString())
                        .param("keyword", "FOREIGN")
                        .param("size", "20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content.length()", is(0)));

        mockMvc.perform(get("/api/v1/form-subjects/users")
                        .with(managerJwt())
                        .param("assignmentItemId", fixture.assignmentItemId().toString())
                        .param("employeeCode", foreignSubject.getEmployeeCode()))
                .andExpect(status().isNotFound());

        mockMvc.perform(post("/api/v1/form-submissions")
                        .with(managerJwt())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "assignmentItemId": %d,
                                  "subject": {"type": "USER", "userId": %d}
                                }
                                """.formatted(fixture.assignmentItemId(), foreignSubject.getId())))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/v1/form-subjects/users/search")
                        .with(managerJwt())
                        .param("keyword", "SUBJECT"))
                .andExpect(status().isNotFound());

        mockMvc.perform(get("/api/v1/form-subjects/users/search")
                        .with(adminJwt())
                        .param("keyword", "SUBJECT"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content.length()", is(1)));
    }

    @Test
    void userIdKeepsCaseInsensitiveDuplicateEmployeeCodesUnambiguous() throws Exception {
        Fixture fixture = publishedAssignedForm();
        User duplicateCodeSubject = userRepository.save(User.builder()
                .employeeCode("form_sub_subject")
                .email("form-subject-case-duplicate@example.com")
                .name("Case Duplicate Subject")
                .password("encoded")
                .status(UserStatus.ACTIVE)
                .build());

        String searchResponse = mockMvc.perform(get("/api/v1/form-subjects/users/search")
                        .with(adminJwt())
                        .param("keyword", "form_sub_subject")
                        .param("size", "20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content.length()", is(2)))
                .andReturn().getResponse().getContentAsString();
        List<Integer> userIds = JsonPath.read(searchResponse, "$.data.content[*].userId");
        assertTrue(userIds.contains(subject.getId().intValue()));
        assertTrue(userIds.contains(duplicateCodeSubject.getId().intValue()));

        mockMvc.perform(get("/api/v1/form-submissions/draft")
                        .with(adminJwt())
                        .param("formVersionId", fixture.versionId().toString())
                        .param("subjectUserId", duplicateCodeSubject.getId().toString()))
                .andExpect(status().isNoContent());

        mockMvc.perform(post("/api/v1/form-submissions")
                        .with(adminJwt())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "formVersionId": %d,
                                  "subject": {"type": "USER", "userId": %d}
                                }
                                """.formatted(fixture.versionId(), duplicateCodeSubject.getId())))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.subject.employeeCode", is("form_sub_subject")));
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
                    "userId": %d
                  }
                }
                """.formatted(assignmentItemId, subject.getId());
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
