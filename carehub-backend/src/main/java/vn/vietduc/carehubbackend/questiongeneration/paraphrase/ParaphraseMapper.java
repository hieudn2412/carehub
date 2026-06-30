package vn.vietduc.carehubbackend.questiongeneration.paraphrase;

import org.springframework.stereotype.Component;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.ParaphraseCandidateResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.ParaphraseJobResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.QuestionBankQuestionResponse;
import vn.vietduc.carehubbackend.questiongeneration.entity.ParaphraseCandidate;
import vn.vietduc.carehubbackend.questiongeneration.entity.ParaphraseJob;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionBankQuestion;
import vn.vietduc.carehubbackend.questiongeneration.service.QuestionGenerationLabels;

import java.util.List;

@Component
public class ParaphraseMapper {

    public ParaphraseJobResponse toJobResponse(ParaphraseJob job, List<ParaphraseCandidate> candidates) {
        return new ParaphraseJobResponse(
                job.getId(),
                toQuestionResponse(job.getSourceQuestion()),
                job.getMode().name(),
                job.getTargetLanguage(),
                job.getRequestedCount(),
                job.getChangeStrength(),
                job.getProvider(),
                job.getModel(),
                job.getStatus().name(),
                QuestionGenerationLabels.paraphraseJobStatus(job.getStatus()),
                job.getErrorMessage(),
                candidates.stream().map(this::toCandidateResponse).toList(),
                job.getCreatedAt(),
                job.getUpdatedAt()
        );
    }

    public ParaphraseCandidateResponse toCandidateResponse(ParaphraseCandidate candidate) {
        return new ParaphraseCandidateResponse(
                candidate.getId(),
                candidate.getJob().getId(),
                candidate.getSourceQuestion().getId(),
                candidate.getStem(),
                candidate.getOptionA(),
                candidate.getOptionB(),
                candidate.getOptionC(),
                candidate.getOptionD(),
                candidate.getCorrectAnswer(),
                candidate.getExplanation(),
                candidate.getTopic(),
                candidate.getDifficulty(),
                candidate.getRawOutput(),
                candidate.getSemanticSimilarityToSource(),
                candidate.getLexicalDifferenceFromSource(),
                candidate.getDuplicateMaxSimilarity(),
                candidate.getDuplicateQuestionId(),
                candidate.getDuplicateQuestionStemSnapshot(),
                candidate.getLabel() == null ? null : candidate.getLabel().name(),
                QuestionGenerationLabels.candidateLabel(candidate.getLabel()),
                candidate.getWarnings(),
                candidate.getStatus().name(),
                QuestionGenerationLabels.candidateStatus(candidate.getStatus()),
                candidate.getReviewerNotes(),
                candidate.getSavedQuestionId(),
                candidate.getCreatedAt(),
                candidate.getUpdatedAt()
        );
    }

    public QuestionBankQuestionResponse toQuestionResponse(QuestionBankQuestion question) {
        return new QuestionBankQuestionResponse(
                question.getId(),
                question.getStem(),
                question.getOptionA(),
                question.getOptionB(),
                question.getOptionC(),
                question.getOptionD(),
                question.getCorrectAnswer(),
                question.getExplanation(),
                question.getTopic(),
                question.getDifficulty(),
                question.getLanguage(),
                question.getSourceDocument(),
                question.getQuestionType().name(),
                question.getParentQuestion() == null ? null : question.getParentQuestion().getId(),
                question.getStatus().name(),
                question.getCreatedAt(),
                question.getUpdatedAt()
        );
    }
}
