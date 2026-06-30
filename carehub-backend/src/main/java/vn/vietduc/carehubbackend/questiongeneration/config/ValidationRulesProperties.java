package vn.vietduc.carehubbackend.questiongeneration.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Getter
@Setter
@ConfigurationProperties(prefix = "validation")
public class ValidationRulesProperties {
    private Duplicate duplicate = new Duplicate();
    private Quality quality = new Quality();

    @Getter
    @Setter
    public static class Duplicate {
        private double strongMin = 0.93;
        private double reviewMin = 0.80;
    }

    @Getter
    @Setter
    public static class Quality {
        private double rejectMin = 0.55;
    }
}
