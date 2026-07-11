package vn.vietduc.carehubbackend.notification.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.vietduc.carehubbackend.exception.ConflictException;
import vn.vietduc.carehubbackend.exception.UnprocessableEntityException;
import vn.vietduc.carehubbackend.notification.dto.NotificationConfigRequest;
import vn.vietduc.carehubbackend.notification.dto.NotificationConfigResponse;
import vn.vietduc.carehubbackend.notification.entity.NotificationConfig;
import vn.vietduc.carehubbackend.notification.entity.NotificationEventType;
import vn.vietduc.carehubbackend.notification.repository.NotificationConfigRepository;

import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class NotificationPolicyService {
    private final NotificationConfigRepository repository;
    private final NotificationEventCatalog catalog;

    @Transactional
    public void initializeDefaults() {
        for (NotificationEventType eventType : NotificationEventType.values()) {
            repository.findByEventType(eventType).orElseGet(() -> repository.save(defaultPolicy(eventType)));
        }
    }

    @Transactional(readOnly = true)
    public NotificationConfigResponse getConfig() {
        return NotificationConfigResponse.from(repository.findAllByOrderByEventTypeAsc());
    }

    @Transactional(readOnly = true)
    public NotificationConfig getPolicy(NotificationEventType eventType) {
        return repository.findByEventType(eventType).orElseGet(() -> defaultPolicy(eventType));
    }

    @Transactional
    public NotificationConfigResponse updateConfig(NotificationConfigRequest request) {
        List<NotificationConfigRequest.PolicyRequest> requested = request.getPolicies();
        Set<NotificationEventType> eventTypes = new HashSet<>();
        requested.forEach(policy -> {
            if (!eventTypes.add(policy.getEventType())) {
                throw new UnprocessableEntityException("Duplicate notification event type: " + policy.getEventType());
            }
        });
        Set<NotificationEventType> supported = Set.copyOf(Arrays.asList(NotificationEventType.values()));
        if (!eventTypes.equals(supported)) {
            throw new UnprocessableEntityException("Configuration must contain every supported notification event type");
        }

        for (NotificationConfigRequest.PolicyRequest input : requested) {
            catalog.validateCadence(input.getEventType(), input.getCadence());
            NotificationConfig policy = repository.findByEventType(input.getEventType())
                    .orElseGet(() -> defaultPolicy(input.getEventType()));
            if (input.getVersion() != null && policy.getId() != null
                    && !Objects.equals(input.getVersion(), policy.getVersion())) {
                throw new ConflictException("Notification configuration was updated by another request");
            }
            policy.setEnabled(input.isEnabled());
            policy.setInAppEnabled(input.isInAppEnabled());
            policy.setEmailEnabled(input.isEmailEnabled());
            policy.setCadence(input.getCadence());
            policy.setThresholdPercent(input.getEventType() == NotificationEventType.QUALITY_COMPLIANCE_BELOW_TARGET
                    ? input.getThresholdPercent()
                    : null);
            if (input.getEventType() == NotificationEventType.QUALITY_COMPLIANCE_BELOW_TARGET
                    && policy.getThresholdPercent() == null) {
                policy.setThresholdPercent(catalog.definition(input.getEventType()).defaultThresholdPercent());
            }
            repository.save(policy);
        }
        return NotificationConfigResponse.from(repository.findAllByOrderByEventTypeAsc());
    }

    @Transactional
    public NotificationConfigResponse resetDefaults() {
        repository.deleteAllInBatch();
        Arrays.stream(NotificationEventType.values()).map(this::defaultPolicy).forEach(repository::save);
        return NotificationConfigResponse.from(repository.findAllByOrderByEventTypeAsc());
    }

    private NotificationConfig defaultPolicy(NotificationEventType eventType) {
        NotificationEventCatalog.Definition definition = catalog.definition(eventType);
        return NotificationConfig.builder()
                .eventType(eventType)
                .enabled(definition.defaultEnabled())
                .inAppEnabled(true)
                .emailEnabled(true)
                .cadence(definition.defaultCadence())
                .thresholdPercent(definition.defaultThresholdPercent())
                .build();
    }
}
