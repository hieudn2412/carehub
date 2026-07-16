package vn.vietduc.carehubbackend.form.importer.client;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatusCode;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import vn.vietduc.carehubbackend.exception.BadRequestException;
import vn.vietduc.carehubbackend.form.importer.config.FormImportProperties;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Component
@RequiredArgsConstructor
public class GooglePublicFormClient {
    private static final Pattern PATH = Pattern.compile("^/forms/d/e/([A-Za-z0-9_-]+)/viewform/?$");

    private final RestClient googleFormRestClient;
    private final FormImportProperties properties;

    public Source fetch(String sourceUrl) {
        if (!properties.googlePublic().enabled()) {
            throw new BadRequestException("Google public form import is disabled");
        }
        URI uri = validate(sourceUrl);
        String html = googleFormRestClient.get()
                .uri(uri)
                .retrieve()
                .onStatus(HttpStatusCode::isError, (request, response) -> {
                    throw new BadRequestException("Google Form returned HTTP " + response.getStatusCode().value());
                })
                .body(String.class);
        if (html == null || html.isBlank()) {
            throw new BadRequestException("Google Form returned an empty response");
        }
        if (html.getBytes(StandardCharsets.UTF_8).length > properties.googlePublic().maxResponseBytes()) {
            throw new BadRequestException("Google Form response exceeds the configured size limit");
        }
        return new Source(extractFormId(uri), uri.toString(), html);
    }

    public URI validate(String sourceUrl) {
        try {
            URI uri = URI.create(sourceUrl.trim());
            if (!"https".equalsIgnoreCase(uri.getScheme()) || !"docs.google.com".equalsIgnoreCase(uri.getHost())) {
                throw new BadRequestException("Only HTTPS public Google Forms URLs are allowed");
            }
            if (!PATH.matcher(uri.getPath()).matches()) {
                throw new BadRequestException("Google Form URL must match /forms/d/e/{formId}/viewform");
            }
            return new URI("https", "docs.google.com", uri.getPath(), null);
        } catch (BadRequestException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new BadRequestException("URL Google Form không hợp lệ");
        }
    }

    public String extractFormId(URI uri) {
        Matcher matcher = PATH.matcher(uri.getPath());
        if (!matcher.matches()) {
            throw new BadRequestException("Invalid Google Form URL path");
        }
        return matcher.group(1);
    }

    public record Source(String formId, String normalizedUrl, String html) {
    }
}

