package vn.vietduc.carehubbackend.questiongeneration.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.io.InputStream;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

class QuestionBankSeedResourceTest {
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void hospitalReviewQuestionSeedContainsValidMcqRows() throws Exception {
        try (InputStream inputStream = getClass().getResourceAsStream("/question-bank/hospital-review-questions.json")) {
            assertThat(inputStream).isNotNull();

            JsonNode root = objectMapper.readTree(inputStream);
            JsonNode questions = root.path("questions");

            assertThat(root.path("sourceDocument").asText()).isEqualTo("Câu hỏi ôn tập - Học phần chăm sóc bệnh cấp tính");
            assertThat(root.path("language").asText()).isEqualTo("vi");
            assertThat(root.path("difficulty").asText()).isEqualTo("medium");
            assertThat(questions).hasSize(270);

            Map<String, String> topicsByLesson = QuestionBankLessonCatalog.lessons().stream()
                    .collect(Collectors.toMap(
                            QuestionBankLessonCatalog.Lesson::normalizedLesson,
                            QuestionBankLessonCatalog.Lesson::name
                    ));
            for (JsonNode question : questions) {
                assertThat(question.path("lesson").asText()).isNotBlank();
                assertThat(question.path("topic").asText())
                        .isEqualTo(topicsByLesson.get(question.path("lesson").asText()));
                assertThat(question.path("stem").asText()).isNotBlank();
                assertThat(question.path("optionA").asText()).isNotBlank();
                assertThat(question.path("optionB").asText()).isNotBlank();
                assertThat(question.path("optionC").asText()).isNotBlank();
                assertThat(question.path("optionD").asText()).isNotBlank();
                assertThat(Set.of("A", "B", "C", "D")).contains(question.path("correctAnswer").asText());
            }
        }
    }

    @Test
    void catalogContainsAllElevenFullLessonNames() {
        assertThat(QuestionBankLessonCatalog.lessons())
                .hasSize(11)
                .allSatisfy(lesson -> {
                    assertThat(lesson.name()).startsWith("BÀI " + lesson.number());
                    assertThat(lesson.name()).doesNotMatch("BÀI \\d+[.:]?");
                });
    }
}
