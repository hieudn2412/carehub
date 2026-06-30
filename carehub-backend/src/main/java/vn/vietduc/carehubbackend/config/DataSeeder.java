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
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionBankStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionType;
import vn.vietduc.carehubbackend.questiongeneration.repository.QuestionBankQuestionRepository;
import vn.vietduc.carehubbackend.user.entity.Role;
import vn.vietduc.carehubbackend.user.entity.User;
import vn.vietduc.carehubbackend.user.entity.UserRole;
import vn.vietduc.carehubbackend.user.entity.UserStatus;
import vn.vietduc.carehubbackend.user.repository.RoleRepository;
import vn.vietduc.carehubbackend.user.repository.UserRepository;
import vn.vietduc.carehubbackend.user.repository.UserRoleRepository;

import java.io.IOException;
import java.io.InputStream;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class DataSeeder implements CommandLineRunner {

    private static final String ADMIN_ROLE_CODE = "ADMIN";
    private static final String USER_ROLE_CODE = "USER";
    private static final String MANAGER_ROLE_CODE = "MANAGER";
    private static final String SYSTEM_JOB_ROLE_CODE = "SYSTEM_JOB";

    private final RoleRepository roleRepository;
    private final UserRepository userRepository;
    private final UserRoleRepository userRoleRepository;
    private final PasswordEncoder passwordEncoder;
    private final QuestionBankQuestionRepository questionRepository;
    private final ResourceLoader resourceLoader;
    private final ObjectMapper objectMapper;

    @Value("${app.seed.enabled:true}")
    private boolean seedEnabled;

    @Value("${app.seed.admin.employee-code}")
    private String adminEmployeeCode;

    @Value("${app.seed.admin.email}")
    private String adminEmail;

    @Value("${app.seed.admin.password:}")
    private String adminPassword;

    @Value("${app.seed.admin.name}")
    private String adminName;

    @Value("${app.seed.question-bank.enabled:true}")
    private boolean questionBankSeedEnabled;

    @Value("${app.seed.question-bank.resource:classpath:question-bank/hospital-review-questions.json}")
    private String questionBankSeedResource;

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
        seedAdminUser(adminRole);
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

        List<QuestionBankQuestion> questions = seedFile.questions().stream()
                .filter(this::isValidSeedQuestion)
                .filter(question -> !questionRepository.existsBySourceDocumentAndStem(
                        seedFile.sourceDocument(),
                        question.stem()
                ))
                .map(question -> toQuestionBankQuestion(seedFile, question))
                .toList();

        if (questions.isEmpty()) {
            log.info("Question bank sample seed already exists: {}", seedFile.sourceDocument());
            return;
        }

        questionRepository.saveAll(questions);
        log.info("Seeded {} question bank sample questions from {}", questions.size(), seedFile.sourceDocument());
    }

    private QuestionBankSeedFile readQuestionBankSeed(Resource resource) {
        try (InputStream inputStream = resource.getInputStream()) {
            return objectMapper.readValue(inputStream, QuestionBankSeedFile.class);
        } catch (IOException ex) {
            throw new IllegalStateException("Cannot read question bank sample seed: " + questionBankSeedResource, ex);
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

    private QuestionBankQuestion toQuestionBankQuestion(QuestionBankSeedFile seedFile, QuestionBankSeedQuestion question) {
        return QuestionBankQuestion.builder()
                .stem(question.stem())
                .optionA(question.optionA())
                .optionB(question.optionB())
                .optionC(question.optionC())
                .optionD(question.optionD())
                .correctAnswer(question.correctAnswer())
                .explanation(question.explanation())
                .topic(StringUtils.hasText(question.topic()) ? question.topic() : seedFile.sourceDocument())
                .difficulty(StringUtils.hasText(seedFile.difficulty()) ? seedFile.difficulty() : "medium")
                .language(StringUtils.hasText(seedFile.language()) ? seedFile.language() : "vi")
                .sourceDocument(seedFile.sourceDocument())
                .questionType(QuestionType.ORIGINAL)
                .status(QuestionBankStatus.APPROVED)
                .createdBy("system-seed")
                .reviewedBy("system-seed")
                .build();
    }

    private record QuestionBankSeedFile(
            String sourceDocument,
            String language,
            String difficulty,
            List<QuestionBankSeedQuestion> questions
    ) {
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
            String explanation
    ) {
    }
}
