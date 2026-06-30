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
}
