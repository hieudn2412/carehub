package vn.vietduc.carehubbackend.questiongeneration.service;

import org.junit.jupiter.api.Test;
import vn.vietduc.carehubbackend.questiongeneration.config.DocumentProcessingProperties;
import vn.vietduc.carehubbackend.questiongeneration.service.model.ChunkDraft;
import vn.vietduc.carehubbackend.questiongeneration.service.model.NormalizedParagraph;
import vn.vietduc.carehubbackend.questiongeneration.service.model.SectionBlock;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class DocumentChunkingServiceTest {

    @Test
    void createGenerationChunksDoesNotMixUnrelatedSections() {
        DocumentProcessingProperties properties = new DocumentProcessingProperties();
        properties.getChunk().setTargetTokens(12);
        properties.getChunk().setMaxTokens(18);
        properties.getChunk().setOverlapTokens(2);
        DocumentChunkingService service = new DocumentChunkingService(properties);

        List<SectionBlock> sections = List.of(
                new SectionBlock(
                        "1. Vệ sinh tay",
                        1,
                        0,
                        null,
                        1,
                        1,
                        "1. Vệ sinh tay",
                        0.82,
                        List.of(
                                new NormalizedParagraph("Vệ sinh tay thường quy cần thực hiện trước khi tiếp xúc người bệnh.", 1),
                                new NormalizedParagraph("Dung dịch sát khuẩn tay nhanh phải phủ đủ toàn bộ bề mặt bàn tay.", 1)
                        )
                ),
                new SectionBlock(
                        "2. An toàn thuốc",
                        1,
                        1,
                        null,
                        2,
                        2,
                        "2. An toàn thuốc",
                        0.82,
                        List.of(new NormalizedParagraph("Người điều dưỡng cần kiểm tra đúng thuốc đúng liều đúng người bệnh.", 2))
                )
        );

        List<ChunkDraft> chunks = service.createGenerationChunks(sections);

        assertThat(chunks).isNotEmpty();
        assertThat(chunks).allSatisfy(chunk ->
                assertThat(chunk.sectionPath()).isIn("1. Vệ sinh tay", "2. An toàn thuốc")
        );
        assertThat(chunks).noneSatisfy(chunk ->
                assertThat(chunk.text()).contains("Vệ sinh tay").contains("đúng thuốc")
        );
    }

    @Test
    void flagsHeadingOnlyChunksAsNotEligibleForGeneration() {
        DocumentChunkingService service = new DocumentChunkingService(new DocumentProcessingProperties());

        List<ChunkDraft> chunks = service.createGenerationChunks(List.of(section(
                "1. ĐẠI CƯƠNG",
                "1. ĐẠI CƯƠNG",
                0.9
        )));

        assertThat(chunks).hasSize(1);
        assertThat(chunks.get(0).qualityFlags())
                .contains(DocumentChunkQualityRules.HEADING_ONLY, DocumentChunkQualityRules.LOW_INFORMATION_DENSITY);
        assertThat(DocumentChunkQualityRules.isGenerationEligible(chunks.get(0).qualityFlags())).isFalse();
    }

    @Test
    void keepsClinicalProcedureChunkEligible() {
        DocumentChunkingService service = new DocumentChunkingService(new DocumentProcessingProperties());

        List<ChunkDraft> chunks = service.createGenerationChunks(List.of(section(
                "2. Quy trình chăm sóc",
                "Điều dưỡng cần đánh giá tình trạng người bệnh trước khi thực hiện kỹ thuật, giải thích thủ thuật, "
                        + "kiểm tra đúng người bệnh, chuẩn bị dụng cụ vô khuẩn và ghi nhận đầy đủ diễn biến sau can thiệp. "
                        + "Nếu phát hiện dấu hiệu bất thường, điều dưỡng phải báo bác sĩ ngay và theo dõi sát mạch, huyết áp, nhịp thở.",
                0.9
        )));

        assertThat(chunks).hasSize(1);
        assertThat(DocumentChunkQualityRules.isGenerationEligible(chunks.get(0).qualityFlags())).isTrue();
    }

    @Test
    void flagsDuplicateChunksAsNotEligibleForGeneration() {
        DocumentChunkingService service = new DocumentChunkingService(new DocumentProcessingProperties());
        String repeatedText = "Người điều dưỡng cần kiểm tra đúng người bệnh, đúng thuốc, đúng liều, đúng đường dùng "
                + "và đúng thời điểm trước khi sử dụng thuốc. Sau khi dùng thuốc cần theo dõi phản ứng bất lợi "
                + "và ghi nhận đầy đủ trong hồ sơ chăm sóc.";

        List<ChunkDraft> chunks = service.createGenerationChunks(List.of(
                section("1. An toàn thuốc", repeatedText, 0.9),
                section("2. Nhắc lại an toàn thuốc", repeatedText, 0.9)
        ));

        assertThat(chunks).hasSize(2);
        assertThat(chunks.get(1).qualityFlags()).contains(DocumentChunkQualityRules.DUPLICATE_TEXT);
        assertThat(DocumentChunkQualityRules.isGenerationEligible(chunks.get(1).qualityFlags())).isFalse();
    }

    private SectionBlock section(String title, String text, double confidence) {
        return new SectionBlock(
                title,
                1,
                0,
                null,
                1,
                1,
                title,
                confidence,
                List.of(new NormalizedParagraph(text, 1))
        );
    }
}
