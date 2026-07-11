package vn.vietduc.carehubbackend.notification.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import vn.vietduc.carehubbackend.exception.UnprocessableEntityException;
import vn.vietduc.carehubbackend.notification.entity.NotificationAudience;
import vn.vietduc.carehubbackend.notification.entity.NotificationEventType;

import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Component
@RequiredArgsConstructor
public class EmailTemplateRenderer {
    private static final Pattern PLACEHOLDER = Pattern.compile("\\{\\{\\s*([a-z][a-z0-9_]*)\\s*}}", Pattern.CASE_INSENSITIVE);

    private final NotificationEventCatalog catalog;

    public void validate(
            NotificationEventType eventType,
            NotificationAudience audience,
            String subject,
            String body
    ) {
        Set<String> allowed = catalog.allowedVariables(eventType, audience);
        validateText(subject, allowed);
        validateText(body, allowed);
    }

    public RenderedTemplate render(
            NotificationEventType eventType,
            NotificationAudience audience,
            String subject,
            String body,
            Map<String, String> variables
    ) {
        validate(eventType, audience, subject, body);
        Map<String, String> safeVariables = variables == null ? Map.of() : variables;
        return new RenderedTemplate(
                renderText(subject, safeVariables),
                renderText(body, safeVariables)
        );
    }

    private void validateText(String value, Set<String> allowed) {
        Matcher matcher = PLACEHOLDER.matcher(value == null ? "" : value);
        while (matcher.find()) {
            String variable = matcher.group(1);
            if (!allowed.contains(variable)) {
                throw new UnprocessableEntityException("Unsupported template variable: " + variable);
            }
        }
        String stripped = matcher.replaceAll("");
        if (stripped.contains("{{") || stripped.contains("}}")) {
            throw new UnprocessableEntityException("Malformed email template placeholder");
        }
    }

    private String renderText(String value, Map<String, String> variables) {
        Matcher matcher = PLACEHOLDER.matcher(value);
        StringBuffer rendered = new StringBuffer();
        while (matcher.find()) {
            String variable = matcher.group(1);
            if (!variables.containsKey(variable)) {
                throw new UnprocessableEntityException("Missing template variable: " + variable);
            }
            matcher.appendReplacement(rendered, Matcher.quoteReplacement(String.valueOf(variables.get(variable))));
        }
        matcher.appendTail(rendered);
        return rendered.toString();
    }

    public record RenderedTemplate(String subject, String body) {
    }
}
