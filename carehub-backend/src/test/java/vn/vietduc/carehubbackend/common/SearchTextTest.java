package vn.vietduc.carehubbackend.common;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;

class SearchTextTest {
    @ParameterizedTest
    @ValueSource(strings = {"duong", "DUONG", "dương", "DƯƠNG", "ngoc hieu", "  duong  ", "dương"})
    void matchesVietnameseNames(String keyword) {
        assertThat(SearchText.contains("Dương Ngọc Hiếu", keyword)).isTrue();
    }

    @Test
    void normalizesVietnameseLettersAndWhitespaceWithoutChangingPunctuation() {
        assertThat(SearchText.normalize(" À Á Ả Ã Ạ Ă Ắ Ằ Ẳ Ẵ Ặ Â Ấ Ầ Ẩ Ẫ Ậ Đ Ê Ế Ề Ể Ễ Ệ Ô Ố Ồ Ổ Ỗ Ộ Ơ Ớ Ờ Ở Ỡ Ợ Ư Ứ Ừ Ử Ữ Ự "))
                .isEqualTo("a a a a a a a a a a a a a a a a a d e e e e e e o o o o o o o o o o o o u u u u u u");
        assertThat(SearchText.normalize(" ĐẶNG\t  DƯƠNG\nĐT_01@example.vn "))
                .isEqualTo("dang duong dt_01@example.vn");
        assertThat(SearchText.contains("Dang Duong", "Đặng Dương")).isTrue();
        assertThat(SearchText.contains("Dương Ngọc Hiếu", "nguyen")).isFalse();
        assertThat(SearchText.normalize(null)).isEmpty();
        assertThat(SearchText.contains(null, "duong")).isFalse();
        assertThat(SearchText.contains("Dương", "")).isTrue();
    }
}
