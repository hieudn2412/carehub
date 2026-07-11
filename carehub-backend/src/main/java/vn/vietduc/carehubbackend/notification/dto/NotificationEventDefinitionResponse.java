package vn.vietduc.carehubbackend.notification.dto;

import vn.vietduc.carehubbackend.notification.entity.NotificationAudience;
import vn.vietduc.carehubbackend.notification.entity.NotificationCadence;
import vn.vietduc.carehubbackend.notification.entity.NotificationCategory;
import vn.vietduc.carehubbackend.notification.entity.NotificationEventType;
import vn.vietduc.carehubbackend.notification.service.NotificationEventCatalog;

import java.util.List;

public record NotificationEventDefinitionResponse(
        NotificationEventType eventType,
        String displayName,
        NotificationCategory category,
        List<NotificationAudience> audiences,
        NotificationCadence defaultCadence,
        List<String> allowedVariables
) {
    public static NotificationEventDefinitionResponse from(
            NotificationEventType eventType,
            NotificationEventCatalog catalog
    ) {
        NotificationEventCatalog.Definition definition = catalog.definition(eventType);
        return new NotificationEventDefinitionResponse(
                eventType,
                catalog.displayName(eventType),
                definition.category(),
                definition.audiences().stream().sorted().toList(),
                definition.defaultCadence(),
                definition.allowedVariables().stream().sorted().toList()
        );
    }
}
