package vn.vietduc.carehubbackend;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

@SpringBootTest
@ActiveProfiles("test")
@TestPropertySource(properties = {
        "ai.embedding.preload=false",
        "ai.paraphrase.preload=false"
})
class CarehubBackendApplicationTests {

    @Test
    void contextLoads() {
        // Context startup is the assertion. Never seed or inspect a developer database here.
    }
}
