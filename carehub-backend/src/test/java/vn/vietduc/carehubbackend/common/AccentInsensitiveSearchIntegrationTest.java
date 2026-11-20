package vn.vietduc.carehubbackend.common;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.annotation.Transactional;
import vn.vietduc.carehubbackend.user.dto.request.UserFilterRequest;
import vn.vietduc.carehubbackend.user.repository.UserRepository;
import vn.vietduc.carehubbackend.notification.entity.Notification;
import vn.vietduc.carehubbackend.notification.entity.EmailTemplate;
import vn.vietduc.carehubbackend.notification.repository.NotificationRepository;
import vn.vietduc.carehubbackend.notification.repository.EmailTemplateRepository;
import vn.vietduc.carehubbackend.notification.service.EmailTemplateService;
import vn.vietduc.carehubbackend.imports.user.entity.ImportLog;
import vn.vietduc.carehubbackend.imports.user.repository.ImportLogRepository;
import vn.vietduc.carehubbackend.form.entity.Form;
import vn.vietduc.carehubbackend.form.entity.enums.FormStatus;
import vn.vietduc.carehubbackend.form.entity.enums.FormSubjectType;
import vn.vietduc.carehubbackend.form.repository.FormRepository;
import vn.vietduc.carehubbackend.user.entity.User;
import vn.vietduc.carehubbackend.user.entity.UserStatus;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
@TestPropertySource(properties = "spring.jpa.hibernate.ddl-auto=create-drop")
class AccentInsensitiveSearchIntegrationTest {
    @Autowired
    private UserRepository userRepository;

    @Autowired private NotificationRepository notificationRepository;
    @Autowired private EmailTemplateRepository emailTemplateRepository;
    @Autowired private EmailTemplateService emailTemplateService;
    @Autowired private ImportLogRepository importLogRepository;
    @Autowired private FormRepository formRepository;

    @ParameterizedTest
    @ValueSource(strings = {"duong", "DUONG", "dương", "DƯƠNG", "ngoc hieu", "  duong  ", "dương"})
    void findsVietnameseNameWithUnaccentedKeyword(String keyword) {
        User employee = userRepository.saveAndFlush(User.builder()
                .employeeCode("SEARCH001")
                .name("Dương Ngọc Hiếu")
                .password("test-encoded")
                .build());
        UserFilterRequest filter = new UserFilterRequest();
        filter.setKeyword(keyword);

        var results = userRepository.searchUsers(filter, PageRequest.of(0, 10));

        assertThat(results.getContent()).extracting(User::getId).contains(employee.getId());
        assertThat(results.getTotalElements()).isEqualTo(1);
    }

    @Test
    void foldsDStrokeAndKeepsPaginationAndDeletedFilter() {
        saveEmployee("SEARCH001", "Đặng Dương Ngọc Hiếu", false);
        saveEmployee("SEARCH002", "Đặng Văn An", false);
        saveEmployee("SEARCH003", "Đặng đã xóa", true);
        saveEmployee("SEARCH004", "Nguyễn Văn An", false);
        UserFilterRequest filter = new UserFilterRequest();
        filter.setKeyword("dang");

        var firstPage = userRepository.searchUsers(filter, PageRequest.of(0, 1));
        var secondPage = userRepository.searchUsers(filter, PageRequest.of(1, 1));

        assertThat(firstPage.getContent()).hasSize(1);
        assertThat(secondPage.getContent()).hasSize(1);
        assertThat(firstPage.getTotalElements()).isEqualTo(2);
        assertThat(secondPage.getTotalElements()).isEqualTo(2);
        assertThat(firstPage.getContent().get(0).getId()).isNotEqualTo(secondPage.getContent().get(0).getId());
    }

    @Test
    void searchesJpaCandidatesWithoutLosingExclusions() {
        User matching = saveEmployee("SEARCH001", "Đặng Dương Ngọc Hiếu", false);
        User excluded = saveEmployee("SEARCH002", "Dương Văn An", false);
        saveEmployee("SEARCH003", "Dương đã xóa", true);

        var results = userRepository.searchActiveFormSubjects("%duong%", excluded.getId(), null,
                PageRequest.of(0, 1));

        assertThat(results.getContent()).extracting(User::getId).containsExactly(matching.getId());
        assertThat(results.getTotalElements()).isEqualTo(1);
    }

    @Test
    void searchesNotificationTitlesWithoutLeakingAnotherUsersNotifications() {
        User owner = saveEmployee("SEARCH001", "Dương Ngọc Hiếu", false);
        User other = saveEmployee("SEARCH002", "Đặng Văn An", false);
        Notification matching = notificationRepository.saveAndFlush(Notification.builder().user(owner)
                .type("TRAINING").title("Đào tạo điều dưỡng").content("Nội dung").read(false).build());
        notificationRepository.saveAndFlush(Notification.builder().user(other)
                .type("TRAINING").title("Đào tạo điều dưỡng").content("Nội dung").read(false).build());

        var results = notificationRepository.findScoped(owner.getId(), "dieu duong", false, PageRequest.of(0, 10));

        assertThat(results.getContent()).extracting(Notification::getId).containsExactly(matching.getId());
        assertThat(notificationRepository.findScoped(owner.getId(), "dieu duong", true, PageRequest.of(0, 10)))
                .isEmpty();
    }

    @Test
    void searchesEmailTemplatesThroughCriteriaAndPreservesActiveFilter() {
        EmailTemplate matching = emailTemplateRepository.saveAndFlush(EmailTemplate.builder().code("SEARCH_TEMPLATE")
                .name("Đào tạo điều dưỡng").subject("Nhắc lịch").body("Nội dung").active(true).build());

        var results = emailTemplateService.list("dao tao dieu duong", null, null, true, PageRequest.of(0, 10));

        assertThat(results.getContent()).extracting(template -> template.id()).containsExactly(matching.getId());
        assertThat(emailTemplateService.list("dao tao", null, null, false, PageRequest.of(0, 10))).isEmpty();
    }

    @Test
    void searchesImportedFilenamesWithStatusAndPagination() {
        ImportLog matching = importLogRepository.saveAndFlush(ImportLog.builder()
                .sourceFile("Danh sách điều dưỡng.xlsx").status("SUCCESS").build());
        importLogRepository.saveAndFlush(ImportLog.builder()
                .sourceFile("Danh sách điều dưỡng lỗi.xlsx").status("FAILED").build());

        var results = importLogRepository.findBySourceFileContainingIgnoreCaseAndStatus(
                "dieu duong", "SUCCESS", PageRequest.of(0, 1));

        assertThat(results.getContent()).extracting(ImportLog::getId).containsExactly(matching.getId());
        assertThat(results.getTotalElements()).isEqualTo(1);
        assertThat(importLogRepository.findBySourceFileContainingIgnoreCase("DANH SACH", PageRequest.of(0, 1))
                .getTotalElements()).isEqualTo(2);
    }

    @Test
    void searchesChecklistTitlesWithoutIncludingDeletedForms() {
        Form matching = formRepository.saveAndFlush(Form.builder().code("SEARCH_FORM")
                .title("Đánh giá điều dưỡng").subjectType(FormSubjectType.USER).status(FormStatus.DRAFT).build());
        formRepository.saveAndFlush(Form.builder().code("SEARCH_DELETED_FORM")
                .title("Đánh giá điều dưỡng đã xóa").subjectType(FormSubjectType.USER)
                .status(FormStatus.DRAFT).deleted(true).build());

        var results = formRepository.search("danh gia dieu duong", null, null, null, PageRequest.of(0, 10));

        assertThat(results.getContent()).extracting(Form::getId).containsExactly(matching.getId());
        assertThat(results.getTotalElements()).isEqualTo(1);
    }

    private User saveEmployee(String code, String name, boolean deleted) {
        return userRepository.saveAndFlush(User.builder().employeeCode(code).name(name)
                .password("test-encoded").status(UserStatus.ACTIVE).isDeleted(deleted).build());
    }
}
