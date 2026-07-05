package vn.vietduc.carehubbackend.questiongeneration.service;

import org.junit.jupiter.api.Test;
import vn.vietduc.carehubbackend.questiongeneration.service.model.NormalizedParagraph;
import vn.vietduc.carehubbackend.questiongeneration.service.model.SectionBlock;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class DocumentSectionDetectionServiceTest {

    @Test
    void markdownHeadingMarkersBecomeCleanSectionTree() {
        DocumentSectionDetectionService service = new DocumentSectionDetectionService();

        List<SectionBlock> sections = service.detectSections(List.of(
                new NormalizedParagraph("# Đại cương", 1),
                new NormalizedParagraph("Nội dung phần đại cương.", 1),
                new NormalizedParagraph("## Đặc điểm sinh lý", 1),
                new NormalizedParagraph("Nội dung phần sinh lý.", 1)
        ));

        assertThat(sections).hasSize(2);
        assertThat(sections.get(0).title()).isEqualTo("Đại cương");
        assertThat(sections.get(0).path()).isEqualTo("Đại cương");
        assertThat(sections.get(1).title()).isEqualTo("Đặc điểm sinh lý");
        assertThat(sections.get(1).path()).isEqualTo("Đại cương > Đặc điểm sinh lý");
        assertThat(sections.get(1).level()).isEqualTo(2);
    }
}
