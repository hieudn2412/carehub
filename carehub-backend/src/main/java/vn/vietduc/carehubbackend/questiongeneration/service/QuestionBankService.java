package vn.vietduc.carehubbackend.questiongeneration.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.vietduc.carehubbackend.exception.ResourceNotFoundException;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.QuestionBankQuestionResponse;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionBankQuestion;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionBankStatus;
import vn.vietduc.carehubbackend.questiongeneration.paraphrase.ParaphraseMapper;
import vn.vietduc.carehubbackend.questiongeneration.repository.QuestionBankQuestionRepository;

import java.text.Normalizer;
import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class QuestionBankService {
    private final QuestionBankQuestionRepository questionRepository;
    private final ParaphraseMapper mapper;

    @Transactional(readOnly = true)
    public List<QuestionBankQuestionResponse> list(String query, String status) {
        QuestionBankStatus bankStatus = parseStatus(status);
        String normalizedQuery = normalize(query);
        return questionRepository.findTop500ByStatusOrderByIdDesc(bankStatus).stream()
                .filter(question -> normalizedQuery.isBlank() || matches(question, normalizedQuery))
                .map(mapper::toQuestionResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public QuestionBankQuestionResponse get(Long questionId) {
        return mapper.toQuestionResponse(find(questionId));
    }

    public QuestionBankQuestion find(Long questionId) {
        return questionRepository.findById(questionId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy câu hỏi"));
    }

    private QuestionBankStatus parseStatus(String status) {
        if (status == null || status.isBlank()) {
            return QuestionBankStatus.APPROVED;
        }
        try {
            return QuestionBankStatus.valueOf(status.trim().toUpperCase(Locale.ROOT));
        } catch (Exception ex) {
            return QuestionBankStatus.APPROVED;
        }
    }

    private boolean matches(QuestionBankQuestion question, String normalizedQuery) {
        return normalize(question.getStem()).contains(normalizedQuery)
                || normalize(question.getTopic()).contains(normalizedQuery)
                || normalize(question.getSourceDocument()).contains(normalizedQuery);
    }

    private String normalize(String value) {
        String withoutMarks = Normalizer.normalize(value == null ? "" : value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "");
        return withoutMarks
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^\\p{L}\\p{N}\\s]", " ")
                .replaceAll("\\s+", " ")
                .trim();
    }
}
