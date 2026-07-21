package vn.vietduc.carehubbackend.form.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;
import vn.vietduc.carehubbackend.form.entity.FormVersion;
import vn.vietduc.carehubbackend.form.mapper.FormMapper;

import java.nio.charset.StandardCharsets;
import java.security.*;
import java.util.*;

@Component
@RequiredArgsConstructor
public class FormSchemaSnapshotService {
    private final FormMapper mapper;
    private final ObjectMapper objectMapper;

    public void update(FormVersion version) {
        version.setSchemaJson(mapper.toSchemaJson(version));
        version.setSchemaHash(sha256(serializeCanonical(version.getSchemaJson())));
    }

    private String sha256(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 is not available", ex);
        }
    }

    private String serializeCanonical(Object value) {
        try {
            return objectMapper.writeValueAsString(canonicalize(value));
        } catch (JacksonException ex) {
            throw new IllegalStateException("Could not serialize form schema", ex);
        }
    }

    private Object canonicalize(Object value) {
        if (value instanceof Map<?, ?> map) {
            Map<String, Object> sorted = new TreeMap<>();
            map.forEach((key, item) -> sorted.put(String.valueOf(key), canonicalize(item)));
            return sorted;
        }
        if (value instanceof List<?> list) return list.stream().map(this::canonicalize).toList();
        return value;
    }
}
