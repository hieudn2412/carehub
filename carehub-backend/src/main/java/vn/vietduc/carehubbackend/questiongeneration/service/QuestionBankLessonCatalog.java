package vn.vietduc.carehubbackend.questiongeneration.service;

import java.util.List;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Canonical lesson categories for the acute-care nursing review question bank.
 */
public final class QuestionBankLessonCatalog {
    private static final Pattern LESSON_NUMBER = Pattern.compile(
            "(?iu)^\\s*bài\\s*(\\d+)\\s*$"
    );

    private static final List<Lesson> LESSONS = List.of(
            new Lesson(1, "BÀI 1: TỔNG QUAN ĐIỀU DƯỠNG TRONG CHĂM SÓC BỆNH CẤP TÍNH"),
            new Lesson(2, "BÀI 2. CHĂM SÓC NGƯỜI BỆNH CHẤN THƯƠNG"),
            new Lesson(3, "BÀI 3. QUẢN LÝ VẾT THƯƠNG VÀ KIỂM SOÁT ĐAU SAU PHẪU THUẬT"),
            new Lesson(4, "BÀI 4. TỔNG QUAN VỀ CHĂM SÓC NGƯỜI BỆNH PHẪU THUẬT"),
            new Lesson(5, "BÀI 5. CHĂM SÓC VÀ XỬ TRÍ SỐC PHẢN VỆ"),
            new Lesson(6, "BÀI 6. CHĂM SÓC NGƯỜI BỆNH GÃY XƯƠNG"),
            new Lesson(7, "BÀI 7. CHĂM SÓC NGƯỜI BỆNH TẮC RUỘT CẤP"),
            new Lesson(8, "BÀI 8. CHĂM SÓC NGƯỜI BỆNH VIÊM RUỘT THỪA"),
            new Lesson(9, "BÀI 9. CHĂM SÓC NGƯỜI BỆNH XUẤT HUYẾT TIÊU HÓA"),
            new Lesson(10, "BÀI 10. CHĂM SÓC NGƯỜI BỆNH VIÊM TỤY CẤP"),
            new Lesson(11, "BÀI 11. CHĂM SÓC NGƯỜI BỆNH NHỒI MÁU CƠ TIM")
    );

    private QuestionBankLessonCatalog() {
    }

    public static List<Lesson> lessons() {
        return LESSONS;
    }

    public static Optional<String> topicForLesson(String lesson) {
        Matcher matcher = LESSON_NUMBER.matcher(lesson == null ? "" : lesson.trim());
        if (!matcher.matches()) {
            return Optional.empty();
        }
        int number = Integer.parseInt(matcher.group(1));
        return LESSONS.stream()
                .filter(item -> item.number() == number)
                .map(Lesson::name)
                .findFirst();
    }

    public record Lesson(int number, String name) {
        public String code() {
            return "BAI_" + number;
        }

        public String normalizedLesson() {
            return "Bài " + number;
        }
    }
}
