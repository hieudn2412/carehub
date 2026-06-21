package vn.vietduc.carehubbackend.form.importer;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;
import vn.vietduc.carehubbackend.form.importer.dto.FormImportRequest;

import java.io.InputStream;
import java.util.HashSet;

import static org.junit.jupiter.api.Assertions.*;

class FormImportManifestTest {
    @Test
    void bundledManifestContainsEighteenUniqueForms() throws Exception {
        try (InputStream input = getClass().getResourceAsStream("/form-import/nursing-forms-2026.json")) {
            assertNotNull(input);
            FormImportRequest request = new ObjectMapper().readValue(input, FormImportRequest.class);
            assertEquals(18, request.forms().size());
            assertEquals(18, new HashSet<>(request.forms().stream().map(FormImportRequest.FormSource::code).toList()).size());
            assertEquals(18, new HashSet<>(request.forms().stream().map(FormImportRequest.FormSource::displayOrder).toList()).size());
            assertTrue(request.forms().stream().allMatch(form -> form.sourceUrl().startsWith(
                    "https://docs.google.com/forms/d/e/")));
        }
    }
}
