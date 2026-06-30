package vn.vietduc.carehubbackend.questiongeneration.modelruntime.vietquill;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class ProtectedTermServiceTest {
    private final ProtectedTermService service = new ProtectedTermService();

    @Test
    void extractsMedicalAbbreviationsNumbersAndUnits() {
        List<String> terms = service.extract("Theo dõi SpO2, HA 90-120 mmHg và truyền 5 ml/phút.");

        assertThat(terms).contains("SpO2", "90-120", "120 mmHg", "5 ml");
    }

    @Test
    void reportsMissingProtectedTerms() {
        List<String> missing = service.missingTerms(
                List.of("SpO2", "5 ml"),
                "Theo dõi độ bão hòa oxy và truyền dịch."
        );

        assertThat(missing).containsExactly("SpO2", "5 ml");
    }
}
