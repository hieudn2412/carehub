package vn.vietduc.carehubbackend.questiongeneration.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionDocument;
import vn.vietduc.carehubbackend.questiongeneration.repository.DocumentChunkRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.DocumentQuestionJobRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.DocumentSectionRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.QuestionBankQuestionRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.QuestionDocumentRepository;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Xoá tài liệu từng lỗi 500: code nạp chunk/section lên rồi deleteAllInBatch,
 * khiến các entity vẫn managed và trỏ vào document đã bị xoá → flush cuối giao
 * dịch ném TransientPropertyValueException. Test này chốt lại: đường xoá không
 * được nạp entity lên persistence context nữa.
 */
@ExtendWith(MockitoExtension.class)
class QuestionDocumentDeleteTest {

    @Mock private QuestionDocumentRepository documentRepository;
    @Mock private DocumentSectionRepository sectionRepository;
    @Mock private DocumentChunkRepository chunkRepository;
    @Mock private DocumentQuestionJobRepository jobRepository;
    @Mock private QuestionBankQuestionRepository questionRepository;

    @InjectMocks private QuestionDocumentService service;

    @Test
    void xoaTaiLieuKhongNapChunkSectionLenPersistenceContext() {
        QuestionDocument document = new QuestionDocument();
        document.setId(21L);
        document.setFilename("quy-trinh.pdf");
        when(documentRepository.findById(21L)).thenReturn(Optional.of(document));
        when(jobRepository.countByDocument(document)).thenReturn(0L);
        when(questionRepository.countBySourceDocumentRef(document)).thenReturn(0L);

        assertThat(service.delete(21L)).isEqualTo("quy-trinh.pdf");

        verify(chunkRepository).deleteAllByDocument(document);
        verify(sectionRepository).deleteAllByDocument(document);
        verify(documentRepository).delete(document);

        verify(chunkRepository, never()).findByDocumentOrderByChunkIndexAsc(any());
        verify(sectionRepository, never()).findByDocumentOrderByOrderIndexAsc(any());
        verify(chunkRepository, never()).deleteAllInBatch(anyList());
        verify(sectionRepository, never()).deleteAllInBatch(anyList());
        verify(sectionRepository, never()).saveAllAndFlush(anyList());
    }
}
