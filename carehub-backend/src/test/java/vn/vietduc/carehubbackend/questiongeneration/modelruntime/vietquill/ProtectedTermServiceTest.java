package vn.vietduc.carehubbackend.questiongeneration.modelruntime.vietquill;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class ProtectedTermServiceTest {
    private final ProtectedTermService service = new ProtectedTermService();

    @Test
    void extractsMedicalAbbreviationsNumbersAndUnits() {
        List<String> terms = service.extract(
                "Người bệnh 65 tuổi, hs-TnT 120 ng/L, HA 85/55 mmHg và truyền 5 ml/phút.");

        assertThat(terms).contains("65 tuổi", "120 ng/L", "85/55 mmHg", "5 ml", "hs-TnT");
    }

    @Test
    void reportsMissingProtectedTerms() {
        List<String> missing = service.missingTerms(
                List.of("SpO2", "5 ml"),
                "Theo dõi độ bão hòa oxy và truyền dịch."
        );

        assertThat(missing).containsExactly("SpO2", "5 ml");
    }

    @Test
    void doesNotTreatChangedNumberAsTheOriginalNumber() {
        List<String> missing = service.missingTerms(
                service.extract("Truyền 5 ml trong 30 phút"),
                "Truyền 50 ml trong 30 phút"
        );

        assertThat(missing).contains("5 ml", "5");
    }

    @Test
    void doesNotExtractFragmentsFromUppercaseVietnameseWords() {
        assertThat(service.extract("Một mục tiêu KHÔNG thay đổi, vẫn theo dõi ICU và SpO2."))
                .contains("ICU", "SpO2")
                .doesNotContain("M", "KH", "NG");
    }
}
