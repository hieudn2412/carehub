package vn.vietduc.carehubbackend.config;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import vn.vietduc.carehubbackend.notification.messaging.EmailMessage;
import vn.vietduc.carehubbackend.notification.messaging.EmailProducer;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Capturing replacement for {@link EmailProducer}, for L2 integration tests that assert the
 * <em>Event Published</em> side of a flow (an email/AMQP message would have left the service).
 *
 * <p>Deliberately a {@code @TestConfiguration} that must be {@code @Import}ed explicitly — NOT a
 * component-scanned {@code @Profile("test")} configuration like {@code TestEvidenceStorageConfig} —
 * because {@code AuthControllerIntegrationTest} and {@code UserControllerIntegrationTest} already
 * register their own {@code @Primary} no-op {@code EmailProducer}; auto-scanning this one into
 * their contexts would create two primaries and fail startup.
 *
 * <p>Every new L2 test class should import exactly this config (and nothing else new) so they all
 * share a single additional Spring context.
 */
@TestConfiguration
public class CapturingEmailProducerConfig {

    /** Records instead of publishing. There is no broker in the test profile. */
    public static class CapturingEmailProducer extends EmailProducer {
        private final List<EmailMessage> sent = Collections.synchronizedList(new ArrayList<>());

        public CapturingEmailProducer() {
            super(null);
        }

        @Override
        public void sendEmail(EmailMessage message) {
            sent.add(message);
        }

        /** Snapshot of everything "published" since the last {@link #reset()}. */
        public List<EmailMessage> sent() {
            synchronized (sent) {
                return List.copyOf(sent);
            }
        }

        public void reset() {
            sent.clear();
        }
    }

    // Bean name deliberately differs from the @Service's "emailProducer": reusing that name raises
    // BeanDefinitionOverrideException (overriding is disabled). Two beans of the type coexist and
    // @Primary steers every injection point here.
    @Bean
    @Primary
    public CapturingEmailProducer capturingEmailProducer() {
        return new CapturingEmailProducer();
    }
}
