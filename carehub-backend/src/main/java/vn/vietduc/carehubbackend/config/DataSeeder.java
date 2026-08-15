package vn.vietduc.carehubbackend.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.io.Resource;
import org.springframework.core.io.ResourceLoader;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionBankQuestion;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionCategory;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.CognitiveLevel;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionBankStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionCategoryStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionType;
import vn.vietduc.carehubbackend.questiongeneration.repository.QuestionBankQuestionRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.QuestionCategoryRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.QuestionSetCategoryRepository;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionSetCategory;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionSetCategoryStatus;
import vn.vietduc.carehubbackend.questiongeneration.security.EvaluationPermissions;
import vn.vietduc.carehubbackend.questiongeneration.service.QuestionBankLessonCatalog;
import vn.vietduc.carehubbackend.training.entity.ProfessionalField;
import vn.vietduc.carehubbackend.training.repository.ProfessionalFieldRepository;
import vn.vietduc.carehubbackend.user.entity.Permission;
import vn.vietduc.carehubbackend.user.entity.Role;
import vn.vietduc.carehubbackend.user.entity.User;
import vn.vietduc.carehubbackend.user.entity.UserRole;
import vn.vietduc.carehubbackend.user.entity.UserStatus;
import vn.vietduc.carehubbackend.user.repository.PermissionRepository;
import vn.vietduc.carehubbackend.user.repository.RoleRepository;
import vn.vietduc.carehubbackend.user.repository.UserRepository;
import vn.vietduc.carehubbackend.user.repository.UserRoleRepository;

import java.io.IOException;
import java.io.InputStream;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Slf4j
@Component
@RequiredArgsConstructor
public class DataSeeder implements CommandLineRunner {

    private static final String ADMIN_ROLE_CODE = "ADMIN";
    private static final String USER_ROLE_CODE = "USER";
    private static final String MANAGER_ROLE_CODE = "MANAGER";
    private static final String SYSTEM_JOB_ROLE_CODE = "SYSTEM_JOB";

    private final RoleRepository roleRepository;
    private final PermissionRepository permissionRepository;
    private final UserRepository userRepository;
    private final UserRoleRepository userRoleRepository;
    private final PasswordEncoder passwordEncoder;
    private final QuestionBankQuestionRepository questionRepository;
    private final QuestionCategoryRepository questionCategoryRepository;
    private final QuestionSetCategoryRepository questionSetCategoryRepository;
    private final ProfessionalFieldRepository professionalFieldRepository;
    private final ResourceLoader resourceLoader;
    private final ObjectMapper objectMapper;

    @Value("${app.seed.enabled:false}")
    private boolean seedEnabled;

    @Value("${app.seed.admin.employee-code}")
    private String adminEmployeeCode;

    @Value("${app.seed.admin.email}")
    private String adminEmail;

    @Value("${app.seed.admin.password:}")
    private String adminPassword;

    @Value("${app.seed.admin.name}")
    private String adminName;

    @Value("${app.seed.question-bank.enabled:false}")
    private boolean questionBankSeedEnabled;

    @Value("${app.seed.question-bank.resource:classpath:question-bank/hospital-review-questions.json}")
    private String questionBankSeedResource;

    @Value("${app.seed.professional-fields.resource:classpath:professional-fields/nursing-professional-fields.json}")
    private String professionalFieldSeedResource;

    @Value("${app.evaluation.legacy-question-set-write-enabled:false}")
    private boolean legacyQuestionSetWriteEnabled;

    @Override
    public void run(String... args) {
        if (!seedEnabled) {
            log.info("Data seeding is disabled");
            return;
        }

        Role adminRole = seedRole(ADMIN_ROLE_CODE, "Administrator");
        Role userRole = seedRole(USER_ROLE_CODE, "User");
        Role managerRole = seedRole(MANAGER_ROLE_CODE, "Manager");
        Role systemJobRole = seedRole(SYSTEM_JOB_ROLE_CODE, "System Job");
        seedEvaluationPermissions();
        seedAdminUser(adminRole);
        seedProfessionalFields();
        seedQuestionCategories();
        if (legacyQuestionSetWriteEnabled) {
            seedQuestionSetCategories();
        } else {
            log.info("Legacy question-set purpose seed is disabled");
        }
        seedQuestionBank();
    }

    private Role seedRole(String code, String name) {
        return roleRepository.findByCode(code)
                .orElseGet(() -> {
                    Role role = Role.builder()
                            .code(code)
                            .name(name)
                            .build();

                    Role saved = roleRepository.save(role);

                    log.info("Seeded role: {}", code);

                    return saved;
                });
    }

    private void seedAdminUser(Role adminRole) {
        if (!StringUtils.hasText(adminPassword)) {
            log.warn("ADMIN_PASSWORD is not set, skipping admin user seed");
            return;
        }

        if (userRepository.existsByEmail(adminEmail)) {
            log.info("Admin user already exists: {}", adminEmail);
            return;
        }

        User admin = User.builder()
                .employeeCode(adminEmployeeCode)
                .email(adminEmail)
                .name(adminName)
                .password(passwordEncoder.encode(adminPassword))
                .firstLogin(false)
                .status(UserStatus.ACTIVE)
                .build();
        userRepository.save(admin);

        userRoleRepository.save(UserRole.builder()
                .user(admin)
                .role(adminRole)
                .build());

        log.info("Seeded admin user: {} ({})", adminEmail, adminEmployeeCode);
    }

    private void seedEvaluationPermissions() {
        Map<String, String> labels = Map.of(
                EvaluationPermissions.QUESTION_AUTHOR, "Tạo và sửa câu hỏi",
                EvaluationPermissions.QUESTION_REVIEWER, "Duyệt câu hỏi AI/paraphrase",
                EvaluationPermissions.QUESTION_SET_MANAGER, "Quản lý bộ câu hỏi",
                EvaluationPermissions.EXAM_CONFIG_MANAGER, "Quản lý cấu hình đề",
                EvaluationPermissions.EXAM_PUBLISHER, "Sinh và phát hành bộ đề",
                EvaluationPermissions.ASSIGNMENT_MANAGER, "Quản lý phân công kiểm tra",
                EvaluationPermissions.RESULT_VIEWER, "Xem kết quả kiểm tra",
                EvaluationPermissions.AUDIT_VIEWER, "Xem audit đánh giá"
        );
        Set<String> existingCodes = permissionRepository.findByCodeIn(EvaluationPermissions.ALL).stream()
                .map(Permission::getCode)
                .collect(Collectors.toSet());
        List<Permission> missingPermissions = EvaluationPermissions.ALL.stream()
                .filter(code -> !existingCodes.contains(code))
                .map(code -> Permission.builder()
                        .code(code)
                        .name(labels.getOrDefault(code, code))
                        .build())
                .toList();
        if (!missingPermissions.isEmpty()) {
            permissionRepository.saveAll(missingPermissions);
            log.info("Seeded {} evaluation permissions", missingPermissions.size());
        }
    }

    private void seedQuestionCategories() {
        for (QuestionBankLessonCatalog.Lesson lesson : QuestionBankLessonCatalog.lessons()) {
            var existing = questionCategoryRepository.findByCode(lesson.code());
            if (existing.isEmpty()) {
                QuestionCategory category = QuestionCategory.builder()
                        .code(lesson.code())
                        .name(lesson.name())
                        .status(QuestionCategoryStatus.ACTIVE)
                        .createdBy("system-seed")
                        .build();
                questionCategoryRepository.save(category);
                log.info("Seeded question category: {}", lesson.name());
            }
        }
    }

    private void seedQuestionSetCategories() {
        List<String[]> categories = List.of(
                new String[]{"ON_TAP", "Ôn tập"},
                new String[]{"DAU_VAO", "Đánh giá đầu vào"},
                new String[]{"SAU_DAO_TAO", "Sau đào tạo"},
                new String[]{"DINH_KY", "Đánh giá định kỳ"},
                new String[]{"BU_KIEN_THUC", "Bù kiến thức"},
                new String[]{"THI_THU", "Thi thử"}
        );
        for (String[] item : categories) {
            questionSetCategoryRepository.findByCode(item[0]).orElseGet(() -> questionSetCategoryRepository.save(
                    QuestionSetCategory.builder()
                            .code(item[0])
                            .name(item[1])
                            .status(QuestionSetCategoryStatus.ACTIVE)
                            .createdBy("system-seed")
                            .build()
            ));
        }
    }

    private ProfessionalField resolveProfessionalFieldForLesson(QuestionBankLessonCatalog.Lesson lesson) {
        String code = switch (lesson.number()) {
            case 1, 2, 5 -> "CC-12";
            case 3 -> "VT-11";
            case 4, 6, 7, 8 -> "XK-15";
            case 9, 10, 11 -> "NK-14";
            default -> null;
        };
        return code == null ? null : professionalFieldRepository.findByCode(code).orElse(null);
    }

    private void seedProfessionalFields() {
        Resource resource = resourceLoader.getResource(professionalFieldSeedResource);
        if (!resource.exists()) {
            log.warn("Professional field seed resource not found: {}", professionalFieldSeedResource);
            return;
        }

        ProfessionalFieldSeedFile seedFile;
        try (InputStream inputStream = resource.getInputStream()) {
            seedFile = objectMapper.readValue(inputStream, ProfessionalFieldSeedFile.class);
        } catch (IOException ex) {
            throw new IllegalStateException("Không thể đọc dữ liệu lĩnh vực chuyên môn: " + professionalFieldSeedResource, ex);
        }

        if (seedFile.fields() == null || seedFile.fields().isEmpty()) {
            log.warn("Professional field seed has no data: {}", professionalFieldSeedResource);
            return;
        }

        int changedCount = 0;
        for (ProfessionalFieldSeed item : seedFile.fields()) {
            if (item == null || !StringUtils.hasText(item.code()) || !StringUtils.hasText(item.name())) {
                continue;
            }
            String code = item.code().trim();
            String name = item.name().trim();
            String description = StringUtils.hasText(item.description()) ? item.description().trim() : null;
            var existing = professionalFieldRepository.findByCode(code);
            if (existing.isEmpty()) {
                professionalFieldRepository.save(ProfessionalField.builder()
                        .code(code)
                        .name(name)
                        .description(description)
                        .active(true)
                        .build());
                changedCount++;
            }
        }
        log.info("Seeded/updated {} professional fields from {}", changedCount, professionalFieldSeedResource);
    }

    private void seedQuestionBank() {
        if (!questionBankSeedEnabled) {
            log.info("Question bank sample seeding is disabled");
            return;
        }

        Resource resource = resourceLoader.getResource(questionBankSeedResource);
        if (!resource.exists()) {
            log.warn("Question bank sample seed resource not found: {}", questionBankSeedResource);
            return;
        }

        QuestionBankSeedFile seedFile = readQuestionBankSeed(resource);
        if (seedFile.questions() == null || seedFile.questions().isEmpty()) {
            log.warn("Question bank sample seed has no questions: {}", questionBankSeedResource);
            return;
        }

        List<QuestionBankQuestion> created = new java.util.ArrayList<>();
        for (QuestionBankSeedQuestion seedQuestion : seedFile.questions()) {
            if (!isValidSeedQuestion(seedQuestion)) {
                continue;
            }
            String topic = resolveSeedTopic(seedFile, seedQuestion);
            var existing = questionRepository.findFirstBySourceDocumentAndStemOrderByIdAsc(
                    seedFile.sourceDocument(),
                    seedQuestion.stem()
            );
            if (existing.isPresent()) {
                continue;
            }
            created.add(toQuestionBankQuestion(seedFile, seedQuestion, topic));
        }

        if (!created.isEmpty()) {
            questionRepository.saveAll(created);
        }
        log.info(
                "Question bank seed synchronized from {}: created={}",
                seedFile.sourceDocument(),
                created.size()
        );
    }

    private QuestionBankSeedFile readQuestionBankSeed(Resource resource) {
        try (InputStream inputStream = resource.getInputStream()) {
            return objectMapper.readValue(inputStream, QuestionBankSeedFile.class);
        } catch (IOException ex) {
            throw new IllegalStateException("Không thể đọc dữ liệu mẫu ngân hàng câu hỏi: " + questionBankSeedResource, ex);
        }
    }

    private boolean isValidSeedQuestion(QuestionBankSeedQuestion question) {
        return question != null
                && StringUtils.hasText(question.stem())
                && StringUtils.hasText(question.optionA())
                && StringUtils.hasText(question.optionB())
                && StringUtils.hasText(question.optionC())
                && StringUtils.hasText(question.optionD())
                && isValidAnswer(question.correctAnswer());
    }

    private boolean isValidAnswer(String answer) {
        return "A".equals(answer) || "B".equals(answer) || "C".equals(answer) || "D".equals(answer);
    }

    private String resolveSeedTopic(QuestionBankSeedFile seedFile, QuestionBankSeedQuestion question) {
        return QuestionBankLessonCatalog.topicForLesson(question.lesson())
                .orElseGet(() -> StringUtils.hasText(question.topic())
                        ? question.topic().trim()
                        : seedFile.sourceDocument());
    }

    private QuestionBankQuestion toQuestionBankQuestion(
            QuestionBankSeedFile seedFile,
            QuestionBankSeedQuestion question,
            String topic
    ) {
        QuestionCategory category = questionCategoryRepository.findAll().stream()
                .filter(item -> item.getName().equalsIgnoreCase(topic))
                .findFirst().orElse(null);
        ProfessionalField field = QuestionBankLessonCatalog.lessons().stream()
                .filter(lesson -> lesson.name().equalsIgnoreCase(topic))
                .findFirst()
                .map(this::resolveProfessionalFieldForLesson)
                .orElse(null);
        CognitiveLevel cognitiveLevel = resolveCognitiveLevel(question.cognitiveLevel());
        return QuestionBankQuestion.builder()
                .stem(question.stem())
                .optionA(question.optionA())
                .optionB(question.optionB())
                .optionC(question.optionC())
                .optionD(question.optionD())
                .correctAnswer(question.correctAnswer())
                .explanation(question.explanation())
                .cognitiveLevel(cognitiveLevel)
                .category(category)
                .professionalField(field)
                .language(StringUtils.hasText(seedFile.language()) ? seedFile.language() : "vi")
                .sourceDocument(seedFile.sourceDocument())
                .questionType(QuestionType.ORIGINAL)
                .status(QuestionBankStatus.APPROVED)
                .createdBy("system-seed")
                .reviewedBy("system-seed")
                .build();
    }

    private CognitiveLevel resolveCognitiveLevel(String raw) {
        if (!StringUtils.hasText(raw)) {
            return null;
        }
        try {
            return CognitiveLevel.valueOf(raw.trim());
        } catch (IllegalArgumentException ex) {
            log.warn("Giá trị cognitiveLevel không hợp lệ trong dữ liệu seed: '{}'", raw);
            return null;
        }
    }

    private record QuestionBankSeedFile(
            String sourceDocument,
            String language,
            String difficulty,
            List<QuestionBankSeedQuestion> questions
    ) {
    }

    private record ProfessionalFieldSeedFile(List<ProfessionalFieldSeed> fields) {
    }

    private record ProfessionalFieldSeed(String code, String name, String description) {
    }

    private record QuestionBankSeedQuestion(
            String lesson,
            Integer sourceIndex,
            String topic,
            String stem,
            String optionA,
            String optionB,
            String optionC,
            String optionD,
            String correctAnswer,
            String explanation,
            String cognitiveLevel
    ) {
    }
}
