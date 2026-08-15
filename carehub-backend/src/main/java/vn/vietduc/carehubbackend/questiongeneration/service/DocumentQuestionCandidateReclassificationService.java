package vn.vietduc.carehubbackend.questiongeneration.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import vn.vietduc.carehubbackend.exception.BadRequestException;
import vn.vietduc.carehubbackend.questiongeneration.dto.request.ReclassifyDocumentQuestionCandidatesRequest;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.ReclassifyDocumentQuestionCandidatesResponse;
import vn.vietduc.carehubbackend.questiongeneration.entity.DocumentQuestionCandidate;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.CandidateLabel;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.CandidateStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.CognitiveLevel;
import vn.vietduc.carehubbackend.questiongeneration.generation.DocumentQuestionGenerator;
import vn.vietduc.carehubbackend.questiongeneration.generation.DocumentQuestionGeneratorRouter;
import vn.vietduc.carehubbackend.questiongeneration.repository.DocumentQuestionCandidateRepository;
import vn.vietduc.carehubbackend.questiongeneration.service.model.GeneratedTaxonomyClassification;
import vn.vietduc.carehubbackend.questiongeneration.service.model.ProfessionalFieldClassificationInput;
import vn.vietduc.carehubbackend.questiongeneration.service.model.ProfessionalFieldPromptOption;
import vn.vietduc.carehubbackend.training.entity.ProfessionalField;
import vn.vietduc.carehubbackend.training.repository.ProfessionalFieldRepository;

import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DocumentQuestionCandidateReclassificationService {
    private final DocumentQuestionCandidateRepository candidateRepository;
    private final ProfessionalFieldRepository professionalFieldRepository;
    private final DocumentQuestionGeneratorRouter generatorRouter;
    private final ObjectMapper objectMapper;

    public ReclassifyDocumentQuestionCandidatesResponse reclassify(
            ReclassifyDocumentQuestionCandidatesRequest request
    ) {
        int limit = request == null ? 50 : request.normalizedLimit();
        List<ProfessionalField> activeFields = professionalFieldRepository.findByActiveTrueOrderByNameAsc();
        if (activeFields.isEmpty()) {
            throw new BadRequestException("Chưa có lĩnh vực chuyên môn đang hoạt động để phân loại câu hỏi");
        }
        List<ProfessionalFieldPromptOption> options = activeFields.stream()
                .map(field -> new ProfessionalFieldPromptOption(field.getCode(), field.getName(), field.getDescription()))
                .toList();
        Map<String, ProfessionalField> fieldsByCode = activeFields.stream()
                .collect(Collectors.toMap(
                        field -> field.getCode().toLowerCase(Locale.ROOT),
                        Function.identity(),
                        (first, ignored) -> first
                ));
        List<DocumentQuestionCandidate> candidates = candidateRepository
                .findByProfessionalFieldIsNullAndStatusInOrderByIdAsc(
                        EnumSet.of(CandidateStatus.GENERATED, CandidateStatus.VALIDATED, CandidateStatus.NEED_REVIEW),
                        PageRequest.of(0, limit)
                );
        DocumentQuestionGenerator generator = generatorRouter.current();
        List<Long> updatedIds = new ArrayList<>();
        List<String> errors = new ArrayList<>();

        for (DocumentQuestionCandidate candidate : candidates) {
            try {
                GeneratedTaxonomyClassification classification = generator.classifyTaxonomy(
                        new ProfessionalFieldClassificationInput(
                                candidate.getStem(),
                                candidate.getOptionA(),
                                candidate.getOptionB(),
                                candidate.getOptionC(),
                                candidate.getOptionD(),
                                candidate.getCorrectAnswer(),
                                candidate.getExplanation(),
                                candidate.getSourceExcerpt(),
                                candidate.getTopic(),
                                options
                        )
                );
                ProfessionalField field = resolveField(fieldsByCode, classification.professionalFieldCode());
                if (field == null) {
                    throw new IllegalStateException("AI trả về mã lĩnh vực không tồn tại hoặc đã bị tắt");
                }
                candidate.setProfessionalField(field);
                CognitiveLevel cognitiveLevel = parseCognitiveLevel(classification.cognitiveLevel());
                if (candidate.getCognitiveLevel() == null && cognitiveLevel != null) {
                    candidate.setCognitiveLevel(cognitiveLevel);
                    candidate.setCognitiveVerifiedAt(null);
                    candidate.setCognitiveVerifiedBy(null);
                }
                List<String> warnings = readWarnings(candidate.getWarnings());
                warnings.add("AI đã phân loại lại lĩnh vực chuyên môn; reviewer cần xác nhận trước khi lưu");
                candidate.setWarnings(writeWarnings(warnings));
                candidate.setStatus(CandidateStatus.NEED_REVIEW);
                candidate.setLabel(CandidateLabel.NEED_REVIEW);
                candidateRepository.save(candidate);
                updatedIds.add(candidate.getId());
            } catch (RuntimeException ex) {
                errors.add("Candidate #" + candidate.getId() + ": "
                        + (ex.getMessage() == null ? "Không thể phân loại lại" : ex.getMessage()));
            }
        }

        return new ReclassifyDocumentQuestionCandidatesResponse(
                limit,
                candidates.size(),
                updatedIds.size(),
                errors.size(),
                updatedIds,
                errors
        );
    }

    private ProfessionalField resolveField(Map<String, ProfessionalField> fieldsByCode, String code) {
        if (code == null || code.isBlank()) {
            return null;
        }
        return fieldsByCode.get(code.trim().toLowerCase(Locale.ROOT));
    }

    private CognitiveLevel parseCognitiveLevel(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return CognitiveLevel.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    private List<String> readWarnings(String value) {
        if (value == null || value.isBlank()) {
            return new ArrayList<>();
        }
        try {
            List<String> warnings = objectMapper.readValue(
                    value,
                    objectMapper.getTypeFactory().constructCollectionType(List.class, String.class)
            );
            return warnings == null ? new ArrayList<>() : new ArrayList<>(warnings);
        } catch (JsonProcessingException ex) {
            return new ArrayList<>();
        }
    }

    private String writeWarnings(List<String> warnings) {
        try {
            return objectMapper.writeValueAsString(warnings);
        } catch (JsonProcessingException ex) {
            return "[]";
        }
    }
}
