package vn.vietduc.carehubbackend.notification.service;

import com.rabbitmq.client.Channel;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.MessageProperties;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import vn.vietduc.carehubbackend.config.CapturingEmailProducerConfig;
import vn.vietduc.carehubbackend.config.CapturingEmailProducerConfig.CapturingEmailProducer;
import vn.vietduc.carehubbackend.config.RabbitMQConfig;
import vn.vietduc.carehubbackend.notification.entity.EmailTemplate;
import vn.vietduc.carehubbackend.notification.entity.Notification;
import vn.vietduc.carehubbackend.notification.entity.NotificationAudience;
import vn.vietduc.carehubbackend.notification.entity.NotificationCadence;
import vn.vietduc.carehubbackend.notification.entity.NotificationCategory;
import vn.vietduc.carehubbackend.notification.entity.NotificationConfig;
import vn.vietduc.carehubbackend.notification.entity.NotificationEventType;
import vn.vietduc.carehubbackend.notification.messaging.EmailConsumer;
import vn.vietduc.carehubbackend.notification.messaging.EmailMessage;
import vn.vietduc.carehubbackend.notification.messaging.NotificationDispatchEvent;
import vn.vietduc.carehubbackend.notification.repository.EmailTemplateRepository;
import vn.vietduc.carehubbackend.notification.repository.NotificationConfigRepository;
import vn.vietduc.carehubbackend.notification.repository.NotificationRepository;
import vn.vietduc.carehubbackend.training.entity.CmeScopeConfiguration;
import vn.vietduc.carehubbackend.training.repository.CmeScopeConfigurationRepository;
import vn.vietduc.carehubbackend.training.service.CmeScopeService;
import vn.vietduc.carehubbackend.training.service.TrainingComplianceCalculator;
import vn.vietduc.carehubbackend.user.entity.Department;
import vn.vietduc.carehubbackend.user.entity.User;
import vn.vietduc.carehubbackend.user.entity.UserStatus;
import vn.vietduc.carehubbackend.user.repository.DepartmentRepository;
import vn.vietduc.carehubbackend.user.repository.UserRepository;

import java.time.LocalDate;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

/**
 * L2 integration tests — sheet {@code L2-NotificationService}, ids L2-NTF-04…11 (01–03 live in
 * {@code NotificationControllerIntegrationTest}).
 *
 * <p>Not {@code @Transactional}: the dedup assertions rely on committed rows. Located in this
 * package so the package-private {@link NotificationAlertScheduler#scanCme(LocalDate)} is reachable —
 * the scheduler bean itself is conditionally disabled in the test profile
 * ({@code app.notification.scheduling-enabled: false}), so it is constructed by hand from real beans.
 *
 * <p>There is no broker in the test profile. The producer side is captured at the
 * {@code EmailProducer} boundary; the consumer ({@link EmailConsumer}) is driven by direct
 * invocation with a mocked {@code Channel}/{@code RabbitTemplate}. Real queue routing and the
 * 15-minute TTL retry topology need a live RabbitMQ and stay Blocked (L2-NTF-11).
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(properties = "spring.jpa.hibernate.ddl-auto=create-drop")
@Import(CapturingEmailProducerConfig.class)
class NotificationPipelineIntegrationTest {

    private static final AtomicInteger SEQ = new AtomicInteger();

    @Autowired
    private NotificationDispatcher dispatcher;
    @Autowired
    private NotificationPolicyService policyService;
    @Autowired
    private TrainingComplianceCalculator complianceCalculator;
    @Autowired
    private CmeScopeService cmeScopeService;
    @Autowired
    private NamedParameterJdbcTemplate jdbc;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private DepartmentRepository departmentRepository;
    @Autowired
    private NotificationRepository notificationRepository;
    @Autowired
    private NotificationConfigRepository notificationConfigRepository;
    @Autowired
    private EmailTemplateRepository emailTemplateRepository;
    @Autowired
    private CmeScopeConfigurationRepository cmeScopeConfigurationRepository;
    @Autowired
    private EmailService emailService;
    @Autowired
    private CapturingEmailProducer emailProducer;

    private int seq;
    private User recipient;

    @BeforeEach
    void setUp() {
        seq = SEQ.incrementAndGet();
        recipient = userRepository.save(User.builder()
                .employeeCode("NTF%03d".formatted(seq))
                .email("ntf%03d@example.com".formatted(seq))
                .name("Notify Target " + seq)
                .password("secret")
                .status(UserStatus.ACTIVE)
                .build());
        emailProducer.reset();
    }

    // ── dispatch chain ────────────────────────────────────────────────────────

    @DisplayName("L2-NTF-04 | Event Published: dispatch writes one in-app row and publishes one templated email")
    @Test
    void dispatchWritesInAppRowAndPublishesEmail() {
        seedActiveTemplate(NotificationEventType.EXAM_PASSED, NotificationAudience.EMPLOYEE);

        dispatcher.dispatch(event("dedup-happy-" + seq));

        List<Notification> rows = notificationsOf(recipient);
        assertThat(rows).hasSize(1);
        assertThat(rows.get(0).getDedupKey()).isEqualTo(recipient.getId() + ":dedup-happy-" + seq);
        assertThat(rows.get(0).isRead()).isFalse();

        assertThat(emailProducer.sent()).hasSize(1).allSatisfy(mail -> {
            assertThat(mail.getTo()).isEqualTo(recipient.getEmail());
            assertThat(mail.getSubject()).contains("Notify Target " + seq); // {{employee_name}} rendered
            assertThat(mail.getDedupKey()).isEqualTo(recipient.getId() + ":dedup-happy-" + seq);
        });
    }

    @DisplayName("L2-NTF-05 | Idempotency: the same dedupKey dispatched twice yields one row and no second email")
    @Test
    void duplicateDedupKeyIsSuppressedIncludingTheEmail() {
        seedActiveTemplate(NotificationEventType.EXAM_PASSED, NotificationAudience.EMPLOYEE);

        dispatcher.dispatch(event("dedup-twice-" + seq));
        dispatcher.dispatch(event("dedup-twice-" + seq));

        assertThat(notificationsOf(recipient)).hasSize(1);
        // The dedup hit returns before the email branch, so redelivery cannot double-send.
        assertThat(emailProducer.sent()).hasSize(1);
    }

    @DisplayName("L2-NTF-06 | Negative: policy toggles short-circuit at the right layer (disabled / in-app only / no email address)")
    @Test
    void policyTogglesShortCircuit() {
        seedActiveTemplate(NotificationEventType.EXAM_PASSED, NotificationAudience.EMPLOYEE);

        // enabled=false → nothing at all.
        seedPolicy(NotificationEventType.EXAM_PASSED, false, true, true, NotificationCadence.IMMEDIATE);
        dispatcher.dispatch(event("toggle-a-" + seq));
        assertThat(notificationsOf(recipient)).isEmpty();
        assertThat(emailProducer.sent()).isEmpty();

        // emailEnabled=false → row without email.
        seedPolicy(NotificationEventType.EXAM_PASSED, true, true, false, NotificationCadence.IMMEDIATE);
        dispatcher.dispatch(event("toggle-b-" + seq));
        assertThat(notificationsOf(recipient)).hasSize(1);
        assertThat(emailProducer.sent()).isEmpty();

        // email enabled but the recipient has no address → row, still no email.
        seedPolicy(NotificationEventType.EXAM_PASSED, true, true, true, NotificationCadence.IMMEDIATE);
        recipient.setEmail(null);
        userRepository.save(recipient);
        dispatcher.dispatch(event("toggle-c-" + seq));
        assertThat(notificationsOf(recipient)).hasSize(2);
        assertThat(emailProducer.sent()).isEmpty();
    }

    @DisplayName("L2-NTF-07 | Negative: no active template → the in-app row exists but no email is published")
    @Test
    void missingTemplateSkipsTheEmailOnly() {
        // No template seeded for EXAM_PASSED/EMPLOYEE in this sequence's namespace: deactivate any.
        emailTemplateRepository.findAll().stream()
                .filter(t -> t.getEventType() == NotificationEventType.EXAM_PASSED && t.isActive())
                .forEach(t -> {
                    t.setActive(false);
                    emailTemplateRepository.save(t);
                });

        dispatcher.dispatch(event("no-template-" + seq));

        assertThat(notificationsOf(recipient)).hasSize(1);
        assertThat(emailProducer.sent()).isEmpty();
    }

    @DisplayName("L2-NTF-08 | Negative: a soft-deleted recipient receives nothing")
    @Test
    void softDeletedRecipientIsSkipped() {
        seedActiveTemplate(NotificationEventType.EXAM_PASSED, NotificationAudience.EMPLOYEE);
        recipient.setDeleted(true);
        userRepository.save(recipient);

        dispatcher.dispatch(event("deleted-" + seq));

        assertThat(notificationsOf(recipient)).isEmpty();
        assertThat(emailProducer.sent()).isEmpty();
    }

    // ── EmailConsumer retry ladder (direct invocation — no broker) ────────────

    @DisplayName("L2-NTF-09 | Event Published: a failed send re-publishes to the retry exchange with attempts=1 and still acks")
    @Test
    void failedSendGoesToRetryQueue() throws Exception {
        RabbitTemplate rabbitTemplate = mock(RabbitTemplate.class);
        Channel channel = mock(Channel.class);
        // Real EmailService: spring.mail points at localhost:2525 where nothing listens, so the send
        // fails exactly the way a broken SMTP relay would in production.
        EmailConsumer consumer = new EmailConsumer(emailService, rabbitTemplate);
        EmailMessage message = EmailMessage.builder()
                .to("ntf%03d@example.com".formatted(seq)).subject("s").content("c").attempts(0).build();

        consumer.consume(message, amqpMessage(7L), channel);

        assertThat(message.getAttempts()).isEqualTo(1);
        verify(rabbitTemplate).convertAndSend(
                eq(RabbitMQConfig.EMAIL_RETRY_EXCHANGE), eq(RabbitMQConfig.EMAIL_RETRY_ROUTING_KEY), any(EmailMessage.class));
        verify(channel).basicAck(7L, false); // MANUAL ack mode: always acked, never requeued
    }

    @DisplayName("L2-NTF-10 | Negative: the fifth failure routes to the DLQ instead of another retry")
    @Test
    void fifthFailureLandsOnDlq() throws Exception {
        RabbitTemplate rabbitTemplate = mock(RabbitTemplate.class);
        Channel channel = mock(Channel.class);
        EmailConsumer consumer = new EmailConsumer(emailService, rabbitTemplate);
        EmailMessage message = EmailMessage.builder()
                .to("ntf%03d@example.com".formatted(seq)).subject("s").content("c").attempts(4).build();

        consumer.consume(message, amqpMessage(8L), channel);

        assertThat(message.getAttempts()).isEqualTo(5);
        verify(rabbitTemplate).convertAndSend(
                eq(RabbitMQConfig.EMAIL_DLQ_EXCHANGE), eq(RabbitMQConfig.EMAIL_DLQ_ROUTING_KEY), any(EmailMessage.class));
        verify(channel).basicAck(8L, false);
    }

    @DisplayName("L2-NTF-11 | Idempotency: the 15-minute TTL retry topology dead-letters back into email.queue")
    @Disabled("Blocked: needs a live RabbitMQ broker — H2 profile has none; x-message-ttl/x-dead-letter args cannot be observed without RabbitAdmin against a real node")
    @Test
    void retryQueueTtlDeadLettersBackIntoMainQueue() {
        // Intentionally unimplemented. The row stays in the workbook as Blocked with this reason.
    }

    // ── scheduled CME scan ────────────────────────────────────────────────────

    @DisplayName("L2-NTF-12 | Idempotency: running the CME scan twice on the same day produces one notification per recipient (bucketed dedup)")
    @Test
    void cmeScanIsIdempotentWithinTheSameBucket() {
        Department department = departmentRepository.save(Department.builder()
                .name("NTF Dept " + seq).build());
        recipient.setDepartment(department);
        userRepository.save(recipient);
        cmeScopeConfigurationRepository.findByScopeKey(CmeScopeConfiguration.CME_SCOPE_KEY)
                .ifPresentOrElse(config -> {
                    config.getDepartments().add(department);
                    cmeScopeConfigurationRepository.save(config);
                }, () -> cmeScopeConfigurationRepository.save(CmeScopeConfiguration.builder()
                        .scopeKey(CmeScopeConfiguration.CME_SCOPE_KEY)
                        .departments(new LinkedHashSet<>(List.of(department)))
                        .build()));
        seedPolicy(NotificationEventType.CME_HOURS_BELOW_REQUIREMENT, true, true, false, NotificationCadence.DAILY);

        NotificationAlertScheduler scheduler = new NotificationAlertScheduler(
                policyService, dispatcher, complianceCalculator, userRepository, jdbc, cmeScopeService);
        LocalDate today = LocalDate.of(2026, 7, 28);

        scheduler.scanCme(today);
        scheduler.scanCme(today);

        // The recipient has 0 submitted hours against the global 120h target → NON_COMPLIANT, so the
        // scan must notify — but only once per DAILY bucket thanks to the dedup key
        // "CME:<userId>:EMPLOYEE:2026-07-28".
        List<Notification> rows = notificationsOf(recipient);
        assertThat(rows).hasSize(1);
        assertThat(rows.get(0).getDedupKey())
                .isEqualTo(recipient.getId() + ":CME:" + recipient.getId() + ":EMPLOYEE:2026-07-28");
        assertThat(rows.get(0).getTitle()).isEqualTo("Bạn chưa đạt yêu cầu giờ CME");
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private NotificationDispatchEvent event(String dedupKey) {
        return new NotificationDispatchEvent(
                NotificationEventType.EXAM_PASSED,
                recipient.getId(),
                NotificationAudience.EMPLOYEE,
                "INFO",
                "Bạn đã vượt qua bài kiểm tra",
                "Điểm của bạn đã đạt yêu cầu.",
                "/staff/exam",
                dedupKey,
                Map.of("exam_name", "An toàn người bệnh", "score", "9.0"));
    }

    private void seedActiveTemplate(NotificationEventType eventType, NotificationAudience audience) {
        emailTemplateRepository.save(EmailTemplate.builder()
                .code("NTF_TPL_%03d".formatted(seq))
                .name("Pipeline template " + seq)
                .category(NotificationCategory.EVALUATION)
                .eventType(eventType)
                .audience(audience)
                .subject("Chúc mừng {{employee_name}}")
                .body("{{employee_name}} ({{employee_code}}) đạt {{score}} điểm bài {{exam_name}}.")
                .mandatory(false)
                .active(true)
                .version(0L)
                .build());
    }

    private void seedPolicy(NotificationEventType eventType, boolean enabled, boolean inApp, boolean email,
                            NotificationCadence cadence) {
        NotificationConfig config = notificationConfigRepository.findByEventType(eventType)
                .orElseGet(() -> NotificationConfig.builder().eventType(eventType).build());
        config.setEnabled(enabled);
        config.setInAppEnabled(inApp);
        config.setEmailEnabled(email);
        config.setCadence(cadence);
        notificationConfigRepository.save(config);
    }

    private List<Notification> notificationsOf(User user) {
        return notificationRepository.findAll().stream()
                .filter(notification -> notification.getUser().getId().equals(user.getId()))
                .toList();
    }

    private Message amqpMessage(long deliveryTag) {
        MessageProperties properties = new MessageProperties();
        properties.setDeliveryTag(deliveryTag);
        return new Message(new byte[0], properties);
    }
}
