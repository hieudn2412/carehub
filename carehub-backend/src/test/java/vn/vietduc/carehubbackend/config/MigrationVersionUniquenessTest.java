package vn.vietduc.carehubbackend.config;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Hai file migration cùng số version chỉ lộ ra khi khởi động app và Flyway từ chối boot,
 * thường là sau khi merge nhánh khác. Bắt ngay ở tầng test cho rẻ.
 *
 * <p>DB dev dùng chung cả team nên một version đã apply là coi như bị chiếm: file mới
 * phải lấy số kế tiếp thay vì tái sử dụng số cũ.</p>
 */
class MigrationVersionUniquenessTest {

    private static final Path MIGRATION_DIR = Path.of("src", "main", "resources", "db", "migration");
    private static final Pattern VERSIONED = Pattern.compile("^V(\\d+(?:_\\d+)*)__.+\\.sql$");

    @Test
    @DisplayName("Mỗi số version chỉ được dùng bởi đúng một file migration")
    void migrationVersionsAreUnique() throws IOException {
        Map<String, List<String>> byVersion = new LinkedHashMap<>();
        try (Stream<Path> files = Files.list(MIGRATION_DIR)) {
            files.map(path -> path.getFileName().toString())
                    .sorted()
                    .forEach(name -> {
                        Matcher matcher = VERSIONED.matcher(name);
                        if (matcher.matches()) {
                            byVersion.computeIfAbsent(matcher.group(1), ignored -> new java.util.ArrayList<>()).add(name);
                        }
                    });
        }

        assertThat(byVersion).isNotEmpty();

        Map<String, List<String>> duplicates = new LinkedHashMap<>();
        byVersion.forEach((version, names) -> {
            if (names.size() > 1) {
                duplicates.put(version, names);
            }
        });

        assertThat(duplicates)
                .as("Trùng số version migration — đổi file mới sang số kế tiếp: %s", duplicates)
                .isEmpty();
    }

    @Test
    @DisplayName("Tên file migration phải theo đúng mẫu V<số>__<mô tả>.sql")
    void migrationFileNamesFollowTheConvention() throws IOException {
        try (Stream<Path> files = Files.list(MIGRATION_DIR)) {
            List<String> invalid = files.map(path -> path.getFileName().toString())
                    .filter(name -> name.endsWith(".sql"))
                    .filter(name -> !VERSIONED.matcher(name).matches())
                    .sorted()
                    .toList();

            assertThat(invalid)
                    .as("File migration đặt tên sai mẫu: %s", invalid)
                    .isEmpty();
        }
    }
}
