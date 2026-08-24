package vn.vietduc.carehubbackend.questiongeneration.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import vn.vietduc.carehubbackend.questiongeneration.config.ValidationRulesProperties;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.DocumentChunkResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.DocumentQuestionCandidateResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.DocumentQuestionChunkResultResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.DocumentQuestionJobResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.DocumentQuestionJobSummaryResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.DocumentResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.DocumentSectionResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.KnowledgePointResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.UsageResponse;
import vn.vietduc.carehubbackend.questiongeneration.entity.DocumentChunk;
import vn.vietduc.carehubbackend.questiongeneration.entity.DocumentKnowledgePoint;
import vn.vietduc.carehubbackend.questiongeneration.entity.DocumentQuestionCandidate;
import vn.vietduc.carehubbackend.questiongeneration.entity.DocumentQuestionChunkResult;
import vn.vietduc.carehubbackend.questiongeneration.entity.DocumentQuestionJob;
import vn.vietduc.carehubbackend.questiongeneration.entity.DocumentSection;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionDocument;

import java.util.List;

@Component
@RequiredArgsConstructor
public class DocumentQuestionMapper {
    private final ValidationRulesProperties validationRules;

    public DocumentResponse toDocumentResponse(
            QuestionDocument document,
            List<DocumentSection> sections,
            List<DocumentChunk> chunks
    ) {
        return toDocumentResponse(document, sections, chunks, 0L, null);
    }

    public DocumentResponse toDocumentResponse(
            QuestionDocument document,
            List<DocumentSection> sections,
            List<DocumentChunk> chunks,
            long questionJobCount,
            DocumentQuestionJob latestQuestionJob
    ) {
        return new DocumentResponse(
                document.getId(),
                document.getFilename(),
                document.getContentType(),
                document.getStatus().name(),
                QuestionGenerationLabels.documentStatus(document.getStatus()),
                document.getPageCount(),
                document.getChunkCount(),
                document.getContentHash(),
                document.getErrorMessage(),
                questionJobCount,
                latestQuestionJob == null ? null : toJobSummaryResponse(latestQuestionJob),
                sections.stream().map(this::toSectionResponse).toList(),
                chunks.stream().map(this::toChunkResponse).toList(),
                document.getCreatedAt(),
                document.getUpdatedAt()
        );
    }

    public DocumentQuestionJobSummaryResponse toJobSummaryResponse(DocumentQuestionJob job) {
        return new DocumentQuestionJobSummaryResponse(
                job.getId(),
                job.getStatus().name(),
                QuestionGenerationLabels.jobStatus(job.getStatus()),
                job.getProvider().name(),
                job.getModel(),
                job.getPipelineVersion() == null ? null : job.getPipelineVersion().name(),
                job.getPromptVersion(),
                job.getCandidateCount(),
                job.getReviewableCandidateCount(),
                job.getRejectedCandidateCount(),
                job.getProblemChunkCount(),
                job.getChunkCount(),
                job.getCompletedChunkCount(),
                job.getFailedChunkCount(),
                job.getCreatedAt(),
                job.getUpdatedAt()
        );
    }

    public DocumentQuestionJobResponse toJobResponse(
            DocumentQuestionJob job,
            List<DocumentKnowledgePoint> knowledgePoints,
            List<DocumentQuestionCandidate> candidates
    ) {
        return toJobResponse(job, knowledgePoints, candidates, List.of());
    }

    public DocumentQuestionJobResponse toJobResponse(
            DocumentQuestionJob job,
            List<DocumentKnowledgePoint> knowledgePoints,
            List<DocumentQuestionCandidate> candidates,
            List<DocumentQuestionChunkResult> chunkResults
    ) {
        return new DocumentQuestionJobResponse(
                job.getId(),
                job.getDocument().getId(),
                job.getProvider().name(),
                job.getModel(),
                job.getPromptVersion(),
                job.getPromptHash(),
                job.getPipelineVersion() == null ? null : job.getPipelineVersion().name(),
                job.getTargetCognitiveLevel() == null ? null : job.getTargetCognitiveLevel().name(),
                job.getStatus().name(),
                QuestionGenerationLabels.jobStatus(job.getStatus()),
                job.getQuestionsPerChunk(),
                job.getChunkCount(),
                job.getCompletedChunkCount(),
                job.getFailedChunkCount(),
                job.getCandidateCount(),
                job.getEligibleChunkCount(),
                job.getSkippedChunkCount(),
                job.getProblemChunkCount(),
                job.getReviewableCandidateCount(),
                job.getRejectedCandidateCount(),
                job.getCriticCallCount(),
                job.getChunkErrors(),
                new UsageResponse(
                        job.getLlmCallCount(),
                        job.getTotalPromptTokens(),
                        job.getTotalPromptCacheHitTokens(),
                        job.getTotalPromptCacheMissTokens(),
                        job.getTotalCompletionTokens(),
                        job.getTotalTokens(),
                        job.getTotalLatencyMs(),
                        job.getEstimatedCostUsd()
                ),
                job.getErrorMessage(),
                knowledgePoints.stream().map(this::toKnowledgePointResponse).toList(),
                candidates.stream().map(this::toCandidateResponse).toList(),
                chunkResults.stream().map(this::toChunkResultResponse).toList(),
                job.getCreatedAt(),
                job.getUpdatedAt()
        );
    }

    public DocumentQuestionCandidateResponse toCandidateResponse(DocumentQuestionCandidate candidate) {
        return new DocumentQuestionCandidateResponse(
                candidate.getId(),
                candidate.getJob().getId(),
                candidate.getDocument().getId(),
                candidate.getChunk().getId(),
                candidate.getStem(),
                candidate.getOptionA(),
                candidate.getOptionB(),
                candidate.getOptionC(),
                candidate.getOptionD(),
                candidate.getCorrectAnswer(),
                candidate.getExplanation(),
                candidate.getTopic(),
                candidate.getCategory() == null ? null : candidate.getCategory().getId(),
                candidate.getCategory() == null ? null : candidate.getCategory().getCode(),
                candidate.getCategory() == null ? null : candidate.getCategory().getName(),
                candidate.getProfessionalField() == null ? null : candidate.getProfessionalField().getId(),
                candidate.getProfessionalField() == null ? null : candidate.getProfessionalField().getCode(),
                candidate.getProfessionalField() == null ? null : candidate.getProfessionalField().getName(),
                candidate.getCognitiveLevel() == null ? null : candidate.getCognitiveLevel().name(),
                candidate.getCognitiveVerifiedAt(),
                candidate.getCognitiveVerifiedBy(),
                candidate.getSourceExcerpt(),
                candidate.getKnowledgePointKey(),
                candidate.getQuestionType(),
                candidate.getAnswerEvidence(),
                candidate.getDistractorRationales(),
                candidate.getChunk().getPageStart(),
                candidate.getChunk().getPageEnd(),
                candidate.getChunk().getSectionPath(),
                candidate.getQualityScore(),
                candidate.getLlmValidation(),
                candidate.getValidationGrade() == null ? null : candidate.getValidationGrade().name(),
                candidate.getValidationSource() == null ? null : candidate.getValidationSource().name(),
                candidate.getValidationIssues(),
                candidate.getEvidenceStatus(),
                candidate.getCriticStatus(),
                candidate.getLabel() == null ? null : candidate.getLabel().name(),
                QuestionGenerationLabels.candidateLabel(candidate.getLabel()),
                candidate.getWarnings(),
                candidate.getStatus().name(),
                QuestionGenerationLabels.candidateStatus(candidate.getStatus()),
                candidate.getDuplicateMaxSimilarity(),
                candidate.getDuplicateMaxSimilarity() != null
                        && candidate.getDuplicateMaxSimilarity() >= validationRules.getDuplicate().getReviewMin(),
                candidate.getDuplicateMaxSimilarity() != null
                        && candidate.getDuplicateMaxSimilarity() >= validationRules.getDuplicate().getStrongMin(),
                candidate.getDuplicateQuestionId(),
                candidate.getDuplicateQuestionStemSnapshot(),
                candidate.getReviewerNotes(),
                candidate.getSavedQuestionId()
        );
    }

    private DocumentQuestionChunkResultResponse toChunkResultResponse(DocumentQuestionChunkResult result) {
        return new DocumentQuestionChunkResultResponse(
                result.getId(),
                result.getChunk().getId(),
                result.getChunk().getChunkIndex(),
                result.getAttemptNo(),
                result.getStatus().name(),
                result.getKnowledgePointCount(),
                result.getRawQuestionCount(),
                result.getReviewableCount(),
                result.getRejectedCount(),
                result.getCriticCallCount(),
                result.getRepairCallCount(),
                result.getLlmCallCount(),
                result.getPromptTokens(),
                result.getPromptCacheHitTokens(),
                result.getPromptCacheMissTokens(),
                result.getCompletionTokens(),
                result.getTotalTokens(),
                result.getLatencyMs(),
                result.getEstimatedCostUsd(),
                result.getErrorCode(),
                result.getErrorMessage(),
                Boolean.TRUE.equals(result.getRetryable())
        );
    }

    private DocumentSectionResponse toSectionResponse(DocumentSection section) {
        return new DocumentSectionResponse(
                section.getId(),
                section.getParent() == null ? null : section.getParent().getId(),
                section.getTitle(),
                section.getLevel(),
                section.getOrderIndex(),
                section.getPageStart(),
                section.getPageEnd(),
                section.getPath(),
                section.getConfidence()
        );
    }

    private DocumentChunkResponse toChunkResponse(DocumentChunk chunk) {
        return new DocumentChunkResponse(
                chunk.getId(),
                chunk.getChunkIndex(),
                chunk.getChunkType().name(),
                chunk.getPageStart(),
                chunk.getPageEnd(),
                chunk.getSectionTitle(),
                chunk.getSectionPath(),
                chunk.getTokenCount(),
                chunk.getCharCount(),
                chunk.getQualityFlags(),
                preview(chunk.getText())
        );
    }

    private KnowledgePointResponse toKnowledgePointResponse(DocumentKnowledgePoint knowledgePoint) {
        return new KnowledgePointResponse(
                knowledgePoint.getId(),
                knowledgePoint.getChunk().getId(),
                knowledgePoint.getSourceKey(),
                knowledgePoint.getStatement(),
                knowledgePoint.getKnowledgeType(),
                knowledgePoint.getImportance(),
                knowledgePoint.getSourceExcerpt(),
                knowledgePoint.getGenerationEligible()
        );
    }

    private String preview(String text) {
        if (text == null || text.length() <= 360) {
            return text;
        }
        return text.substring(0, 360) + "...";
    }
}
