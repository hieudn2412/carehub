package vn.vietduc.carehubbackend.questiongeneration.service;

import org.junit.jupiter.api.Test;
import vn.vietduc.carehubbackend.questiongeneration.entity.DocumentQuestionJob;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionDocument;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.DocumentStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.GenerationProvider;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.JobStatus;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class DocumentQuestionMapperTest {

    private final DocumentQuestionMapper mapper = new DocumentQuestionMapper();

    @Test
    void documentResponseIncludesLatestQuestionJobSummary() {
        QuestionDocument document = QuestionDocument.builder()
                .id(10L)
                .filename("huong-dan.pdf")
                .contentType("application/pdf")
                .status(DocumentStatus.READY)
                .pageCount(3)
                .chunkCount(8)
                .contentHash("hash")
                .build();
        DocumentQuestionJob latestJob = DocumentQuestionJob.builder()
                .id(20L)
                .document(document)
                .provider(GenerationProvider.api)
                .model("deepseek-chat")
                .promptVersion("v2")
                .status(JobStatus.PARTIALLY_COMPLETED)
                .questionsPerChunk(1)
                .chunkCount(8)
                .completedChunkCount(6)
                .failedChunkCount(2)
                .candidateCount(12)
                .build();

        var response = mapper.toDocumentResponse(document, List.of(), List.of(), 3L, latestJob);

        assertThat(response.questionJobCount()).isEqualTo(3);
        assertThat(response.latestQuestionJob()).isNotNull();
        assertThat(response.latestQuestionJob().id()).isEqualTo(20L);
        assertThat(response.latestQuestionJob().status()).isEqualTo("PARTIALLY_COMPLETED");
        assertThat(response.latestQuestionJob().statusText()).isEqualTo("Hoàn thành một phần");
        assertThat(response.latestQuestionJob().candidateCount()).isEqualTo(12);
        assertThat(response.latestQuestionJob().failedChunkCount()).isEqualTo(2);
    }
}
