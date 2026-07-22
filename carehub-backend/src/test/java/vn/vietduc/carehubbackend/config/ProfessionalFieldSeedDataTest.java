package vn.vietduc.carehubbackend.config;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.io.InputStream;
import java.util.HashSet;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class ProfessionalFieldSeedDataTest {

    @Test
    void seedContainsTwentyFiveUniqueProfessionalFields() throws Exception {
        try (InputStream input = getClass().getResourceAsStream(
                "/professional-fields/nursing-professional-fields.json")) {
            assertThat(input).isNotNull();
            JsonNode fields = new ObjectMapper().readTree(input).path("fields");
            Set<String> codes = new HashSet<>();

            assertThat(fields.isArray()).isTrue();
            assertThat(fields).hasSize(25);
            for (JsonNode field : fields) {
                assertThat(field.path("code").asText()).isNotBlank();
                assertThat(field.path("name").asText()).isNotBlank();
                assertThat(field.path("description").asText()).isNotBlank();
                assertThat(codes.add(field.path("code").asText()))
                        .as("Mã lĩnh vực bị trùng: %s", field.path("code").asText())
                        .isTrue();
            }
            assertThat(codes).contains("QL-01", "AT-06", "ICU-13", "CD-24", "QT-25");
        }
    }
}
