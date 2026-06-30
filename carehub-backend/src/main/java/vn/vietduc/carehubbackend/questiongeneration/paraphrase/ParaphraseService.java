package vn.vietduc.carehubbackend.questiongeneration.paraphrase;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.vietduc.carehubbackend.exception.BadRequestException;
import vn.vietduc.carehubbackend.exception.ResourceNotFoundException;
import vn.vietduc.carehubbackend.questiongeneration.config.AiParaphraseProperties;
import vn.vietduc.carehubbackend.questiongeneration.dto.request.CreateParaphraseJobRequest;
import vn.vietduc.carehubbackend.questiongeneration.dto.request.UpdateParaphraseCandidateRequest;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.ParaphraseCandidateResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.ParaphraseJobResponse;
import vn.vietduc.carehubbackend.questiongeneration.embedding.QuestionEmbeddingService;
import vn.vietduc.carehubbackend.questiongeneration.entity.ParaphraseCandidate;
import vn.vietduc.carehubbackend.questiongeneration.entity.ParaphraseJob;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionBankQuestion;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.CandidateLabel;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.CandidateStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ParaphraseJobStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ParaphraseMode;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionBankStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionType;
import vn.vietduc.carehubbackend.questiongeneration.modelruntime.ParaphraseModelInput;
import vn.vietduc.carehubbackend.questiongeneration.modelruntime.ParaphraseModelService;
import vn.vietduc.carehubbackend.questiongeneration.modelruntime.ParaphrasedMcq;
import vn.vietduc.carehubbackend.questiongeneration.repository.ParaphraseCandidateRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ParaphraseJobRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.QuestionBankQuestionRepository;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ParaphraseService {
    private final QuestionBankQuestionRepository questionRepository;
    private final ParaphraseJobRepository jobRepository;
    private final ParaphraseCandidateRepository candidateRepository;
    private final ParaphraseModelService modelService;
    private final ParaphraseValidationService validationService;
    private final QuestionEmbeddingService embeddingService;
    private final ParaphraseMapper mapper;
    private final AiParaphraseProperties properties;
    private final ObjectMapper objectMapper;

    @Transactional
    public ParaphraseJobResponse createJob(Long questionId, CreateParaphraseJobRequest request, String actor) {
        QuestionBankQuestion source = findQuestion(questionId);
        int requestedCount = request != null && request.requestedCount() != null
                ? request.requestedCount()
                : properties.getRequestedCountDefault();
        requestedCount = Math.max(1, Math.min(10, requestedCount));
        String changeStrength = trimToFallback(request == null ? null : request.changeStrength(), "medium");

        ParaphraseJob job = ParaphraseJob.builder()
                .sourceQuestion(source)
                .mode(ParaphraseMode.FULL_MCQ)
                .targetLanguage("vi")
                .requestedCount(requestedCount)
                .changeStrength(changeStrength)
                .provider(modelService.provider())
                .model(modelService.modelName())
                .status(ParaphraseJobStatus.GENERATING)
                .createdBy(actor)
                .build();
        ParaphraseJob savedJob = jobRepository.save(job);

        try {
            List<ParaphrasedMcq> generated = modelService.paraphrase(new ParaphraseModelInput(
                    source.getStem(),
                    source.getOptionA(),
                    source.getOptionB(),
                    source.getOptionC(),
                    source.getOptionD(),
                    source.getCorrectAnswer(),
                    changeStrength,
                    requestedCount
            ));
            savedJob.setStatus(ParaphraseJobStatus.VALIDATING);
            jobRepository.save(savedJob);
            for (ParaphrasedMcq mcq : generated) {
                persistCandidate(savedJob, source, mcq);
            }
            savedJob.setStatus(ParaphraseJobStatus.COMPLETED);
            savedJob.setErrorMessage(null);
        } catch (RuntimeException ex) {
            savedJob.setStatus(ParaphraseJobStatus.FAILED);
            savedJob.setErrorMessage(ex.getMessage() == null ? "Không tạo được paraphrase" : ex.getMessage());
        }
        jobRepository.save(savedJob);
        return getJob(savedJob.getId());
    }

    @Transactional(readOnly = true)
    public List<ParaphraseJobResponse> listJobsByQuestion(Long questionId) {
        QuestionBankQuestion source = findQuestion(questionId);
        return jobRepository.findBySourceQuestionOrderByIdDesc(source).stream()
                .map(job -> mapper.toJobResponse(job, candidateRepository.findByJobOrderByIdAsc(job)))
                .toList();
    }

    @Transactional(readOnly = true)
    public ParaphraseJobResponse getJob(Long jobId) {
        ParaphraseJob job = findJob(jobId);
        return mapper.toJobResponse(job, candidateRepository.findByJobOrderByIdAsc(job));
    }

    @Transactional(readOnly = true)
    public ParaphraseCandidateResponse getCandidate(Long candidateId) {
        return mapper.toCandidateResponse(findCandidate(candidateId));
    }

    @Transactional
    public ParaphraseCandidateResponse updateCandidate(Long candidateId, UpdateParaphraseCandidateRequest request) {
        ParaphraseCandidate candidate = findCandidate(candidateId);
        QuestionBankQuestion source = candidate.getSourceQuestion();
        if (request.correctAnswer() != null && !request.correctAnswer().equalsIgnoreCase(source.getCorrectAnswer())) {
            throw new BadRequestException("Không được đổi đáp án đúng của câu paraphrase so với câu gốc");
        }
        candidate.setStem(request.stem().trim());
        candidate.setOptionA(request.optionA().trim());
        candidate.setOptionB(request.optionB().trim());
        candidate.setOptionC(request.optionC().trim());
        candidate.setOptionD(request.optionD().trim());
        candidate.setCorrectAnswer(source.getCorrectAnswer());
        candidate.setExplanation(trimToNull(request.explanation()));
        candidate.setTopic(trimToNull(request.topic()));
        candidate.setDifficulty(trimToNull(request.difficulty()));
        candidate.setReviewerNotes(trimToNull(request.reviewerNotes()));
        revalidate(candidate);
        return mapper.toCandidateResponse(candidateRepository.save(candidate));
    }

    @Transactional
    public ParaphraseCandidateResponse approve(Long candidateId, String reviewerNotes) {
        ParaphraseCandidate candidate = findCandidate(candidateId);
        if (candidate.getStatus() == CandidateStatus.REJECTED) {
            throw new BadRequestException("Không thể duyệt candidate đã bị từ chối bởi validation");
        }
        candidate.setStatus(CandidateStatus.APPROVED);
        candidate.setLabel(CandidateLabel.GOOD);
        if (reviewerNotes != null && !reviewerNotes.isBlank()) {
            candidate.setReviewerNotes(reviewerNotes.trim());
        }
        return mapper.toCandidateResponse(candidateRepository.save(candidate));
    }

    @Transactional
    public ParaphraseCandidateResponse reject(Long candidateId, String reviewerNotes) {
        ParaphraseCandidate candidate = findCandidate(candidateId);
        candidate.setStatus(CandidateStatus.REJECTED);
        candidate.setLabel(CandidateLabel.REJECTED);
        if (reviewerNotes != null && !reviewerNotes.isBlank()) {
            candidate.setReviewerNotes(reviewerNotes.trim());
        }
        return mapper.toCandidateResponse(candidateRepository.save(candidate));
    }

    @Transactional
    public ParaphraseCandidateResponse saveAsQuestion(Long candidateId, String actor) {
        ParaphraseCandidate candidate = findCandidate(candidateId);
        if (candidate.getStatus() != CandidateStatus.APPROVED) {
            throw new BadRequestException("Chỉ có thể lưu candidate đã được duyệt vào ngân hàng câu hỏi");
        }
        QuestionBankQuestion source = candidate.getSourceQuestion();
        QuestionBankQuestion savedQuestion = questionRepository.save(QuestionBankQuestion.builder()
                .stem(candidate.getStem())
                .optionA(candidate.getOptionA())
                .optionB(candidate.getOptionB())
                .optionC(candidate.getOptionC())
                .optionD(candidate.getOptionD())
                .correctAnswer(source.getCorrectAnswer())
                .explanation(candidate.getExplanation())
                .topic(candidate.getTopic())
                .difficulty(candidate.getDifficulty())
                .language(source.getLanguage())
                .sourceDocument(source.getSourceDocument())
                .questionType(QuestionType.PARAPHRASE)
                .parentQuestion(source)
                .status(QuestionBankStatus.APPROVED)
                .createdBy(actor)
                .reviewedBy(actor)
                .build());
        embeddingService.saveStemEmbedding(savedQuestion);
        candidate.setSavedQuestionId(savedQuestion.getId());
        candidate.setStatus(CandidateStatus.SAVED);
        return mapper.toCandidateResponse(candidateRepository.save(candidate));
    }

    private void persistCandidate(ParaphraseJob job, QuestionBankQuestion source, ParaphrasedMcq mcq) {
        ParaphraseValidationResult validation = validationService.validate(source, mcq);
        CandidateStatus status;
        CandidateLabel label;
        if (validation.rejected()) {
            status = CandidateStatus.REJECTED;
            label = CandidateLabel.REJECTED;
        } else if (validation.needsReview()) {
            status = CandidateStatus.NEED_REVIEW;
            label = CandidateLabel.NEED_REVIEW;
        } else {
            status = CandidateStatus.VALIDATED;
            label = CandidateLabel.GOOD;
        }
        ParaphraseCandidate candidate = ParaphraseCandidate.builder()
                .job(job)
                .sourceQuestion(source)
                .stem(blankToFallback(mcq.stem(), source.getStem()))
                .optionA(blankToFallback(mcq.optionA(), source.getOptionA()))
                .optionB(blankToFallback(mcq.optionB(), source.getOptionB()))
                .optionC(blankToFallback(mcq.optionC(), source.getOptionC()))
                .optionD(blankToFallback(mcq.optionD(), source.getOptionD()))
                .correctAnswer(source.getCorrectAnswer())
                .explanation(source.getExplanation())
                .topic(source.getTopic())
                .difficulty(source.getDifficulty())
                .rawOutput(mcq.rawOutput())
                .semanticSimilarityToSource(validation.semanticSimilarity())
                .lexicalDifferenceFromSource(validation.lexicalDifference())
                .duplicateMaxSimilarity(validation.duplicateMaxSimilarity())
                .duplicateQuestionId(validation.duplicateQuestionId())
                .duplicateQuestionStemSnapshot(validation.duplicateQuestionStem())
                .warnings(toJson(validation.warnings()))
                .status(status)
                .label(label)
                .build();
        candidateRepository.save(candidate);
    }

    private void revalidate(ParaphraseCandidate candidate) {
        ParaphrasedMcq mcq = new ParaphrasedMcq(
                candidate.getStem(),
                candidate.getOptionA(),
                candidate.getOptionB(),
                candidate.getOptionC(),
                candidate.getOptionD(),
                candidate.getRawOutput()
        );
        ParaphraseValidationResult validation = validationService.validate(candidate.getSourceQuestion(), mcq);
        if (validation.rejected()) {
            candidate.setStatus(CandidateStatus.REJECTED);
            candidate.setLabel(CandidateLabel.REJECTED);
        } else if (validation.needsReview()) {
            candidate.setStatus(CandidateStatus.NEED_REVIEW);
            candidate.setLabel(CandidateLabel.NEED_REVIEW);
        } else {
            candidate.setStatus(CandidateStatus.VALIDATED);
            candidate.setLabel(CandidateLabel.GOOD);
        }
        candidate.setSemanticSimilarityToSource(validation.semanticSimilarity());
        candidate.setLexicalDifferenceFromSource(validation.lexicalDifference());
        candidate.setDuplicateMaxSimilarity(validation.duplicateMaxSimilarity());
        candidate.setDuplicateQuestionId(validation.duplicateQuestionId());
        candidate.setDuplicateQuestionStemSnapshot(validation.duplicateQuestionStem());
        candidate.setWarnings(toJson(validation.warnings()));
    }

    private QuestionBankQuestion findQuestion(Long questionId) {
        return questionRepository.findById(questionId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy câu hỏi"));
    }

    private ParaphraseJob findJob(Long jobId) {
        return jobRepository.findById(jobId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy phiên paraphrase"));
    }

    private ParaphraseCandidate findCandidate(Long candidateId) {
        return candidateRepository.findById(candidateId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy candidate paraphrase"));
    }

    private String trimToFallback(String value, String fallback) {
        return value == null || value.trim().isEmpty() ? fallback : value.trim();
    }

    private String trimToNull(String value) {
        return value == null || value.trim().isEmpty() ? null : value.trim();
    }

    private String blankToFallback(String value, String fallback) {
        return value == null || value.trim().isEmpty() ? fallback : value.trim();
    }

    private String toJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException ex) {
            return "[]";
        }
    }
}
