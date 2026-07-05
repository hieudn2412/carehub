package vn.vietduc.carehubbackend.questiongeneration.paraphrase;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import vn.vietduc.carehubbackend.questiongeneration.config.AiEmbeddingProperties;
import vn.vietduc.carehubbackend.questiongeneration.config.AiParaphraseProperties;
import vn.vietduc.carehubbackend.questiongeneration.dto.request.BatchParaphraseCandidateActionRequest;
import vn.vietduc.carehubbackend.questiongeneration.dto.request.CreateBatchParaphraseJobsRequest;
import vn.vietduc.carehubbackend.questiongeneration.dto.request.CreateParaphraseJobRequest;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.ParaphraseCandidateResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.ParaphraseJobResponse;
import vn.vietduc.carehubbackend.questiongeneration.embedding.QuestionEmbeddingService;
import vn.vietduc.carehubbackend.questiongeneration.entity.ParaphraseCandidate;
import vn.vietduc.carehubbackend.questiongeneration.entity.ParaphraseJob;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionBankQuestion;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.CandidateStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ParaphraseJobStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionBankStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionType;
import vn.vietduc.carehubbackend.questiongeneration.modelruntime.ParaphraseModelInput;
import vn.vietduc.carehubbackend.questiongeneration.modelruntime.ParaphraseModelService;
import vn.vietduc.carehubbackend.questiongeneration.modelruntime.ParaphrasedMcq;
import vn.vietduc.carehubbackend.questiongeneration.modelruntime.vietquill.ProtectedTermService;
import vn.vietduc.carehubbackend.questiongeneration.repository.ParaphraseCandidateRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ParaphraseJobRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.QuestionBankQuestionRepository;
import vn.vietduc.carehubbackend.questiongeneration.service.DuplicateCheckService;
import vn.vietduc.carehubbackend.questiongeneration.service.model.DuplicateCheckResult;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anySet;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ParaphraseServiceTest {
    private final QuestionBankQuestionRepository questionRepository = mock(QuestionBankQuestionRepository.class);
    private final ParaphraseJobRepository jobRepository = mock(ParaphraseJobRepository.class);
    private final ParaphraseCandidateRepository candidateRepository = mock(ParaphraseCandidateRepository.class);
    private final ParaphraseModelService modelService = mock(ParaphraseModelService.class);
    private final DuplicateCheckService duplicateCheckService = mock(DuplicateCheckService.class);
    private final QuestionEmbeddingService embeddingService = mock(QuestionEmbeddingService.class);
    private final AtomicReference<ParaphraseJob> savedJob = new AtomicReference<>();
    private final List<ParaphraseCandidate> savedCandidates = new ArrayList<>();
    private final AtomicLong ids = new AtomicLong(100);
    private ParaphraseService service;
    private QuestionBankQuestion sourceQuestion;

    @BeforeEach
    void setUp() {
        AiEmbeddingProperties embeddingProperties = new AiEmbeddingProperties();
        embeddingProperties.setProvider("lexical");
        AiParaphraseProperties paraphraseProperties = new AiParaphraseProperties();
        paraphraseProperties.setRequestedCountDefault(2);

        ParaphraseValidationService validationService = new ParaphraseValidationService(
                new ProtectedTermService(),
                duplicateCheckService,
                embeddingService,
                embeddingProperties
        );
        service = new ParaphraseService(
                questionRepository,
                jobRepository,
                candidateRepository,
                modelService,
                validationService,
                embeddingService,
                new ParaphraseMapper(),
                paraphraseProperties,
                new ObjectMapper()
        );

        sourceQuestion = QuestionBankQuestion.builder()
                .id(10L)
                .stem("Khi xác định người bệnh trước tiêm thuốc, nhân viên cần làm gì?")
                .optionA("Đối chiếu ít nhất hai thông tin nhận diện.")
                .optionB("Chỉ hỏi số phòng của người bệnh.")
                .optionC("Dựa vào vị trí giường hiện tại.")
                .optionD("Bỏ qua nếu người bệnh tỉnh táo.")
                .correctAnswer("A")
                .explanation("Cần dùng tối thiểu hai thông tin nhận diện.")
                .topic("An toàn người bệnh")
                .difficulty("medium")
                .language("vi")
                .questionType(QuestionType.ORIGINAL)
                .status(QuestionBankStatus.APPROVED)
                .build();

        when(questionRepository.findById(sourceQuestion.getId())).thenReturn(Optional.of(sourceQuestion));
        when(modelService.provider()).thenReturn("mock");
        when(modelService.modelName()).thenReturn("mock-vietquill");
        when(modelService.paraphrase(any(ParaphraseModelInput.class))).thenReturn(List.of(new ParaphrasedMcq(
                "Trước khi tiêm thuốc, nhân viên phải xác định người bệnh như thế nào?",
                "Kiểm tra và đối chiếu tối thiểu hai thông tin nhận diện.",
                "Chỉ cần hỏi số phòng của người bệnh.",
                "Chỉ dựa vào vị trí giường đang nằm.",
                "Có thể bỏ qua nếu người bệnh còn tỉnh.",
                "mock-output"
        )));
        when(duplicateCheckService.similarity(anyString(), anyString())).thenReturn(0.62);
        when(duplicateCheckService.check(anyString(), anySet())).thenReturn(new DuplicateCheckResult(
                0.12,
                null,
                null,
                false,
                false,
                null,
                "lexical"
        ));
        when(jobRepository.save(any(ParaphraseJob.class))).thenAnswer(invocation -> {
            ParaphraseJob job = invocation.getArgument(0);
            if (job.getId() == null) {
                job.setId(ids.incrementAndGet());
            }
            savedJob.set(job);
            return job;
        });
        when(jobRepository.findById(any())).thenAnswer(invocation -> {
            Long id = invocation.getArgument(0);
            ParaphraseJob job = savedJob.get();
            return job != null && id.equals(job.getId()) ? Optional.of(job) : Optional.empty();
        });
        when(candidateRepository.save(any(ParaphraseCandidate.class))).thenAnswer(invocation -> {
            ParaphraseCandidate candidate = invocation.getArgument(0);
            if (candidate.getId() == null) {
                candidate.setId(ids.incrementAndGet());
                savedCandidates.add(candidate);
            }
            return candidate;
        });
        when(candidateRepository.findByJobOrderByIdAsc(any())).thenReturn(savedCandidates);
        when(candidateRepository.findById(any())).thenAnswer(invocation -> {
            Long id = invocation.getArgument(0);
            return savedCandidates.stream().filter(candidate -> id.equals(candidate.getId())).findFirst();
        });
        when(questionRepository.save(any(QuestionBankQuestion.class))).thenAnswer(invocation -> {
            QuestionBankQuestion question = invocation.getArgument(0);
            if (question.getId() == null) {
                question.setId(ids.incrementAndGet());
            }
            return question;
        });
    }

    @Test
    void createJobGeneratesValidatedFullMcqCandidate() {
        ParaphraseJobResponse response = service.createJob(
                sourceQuestion.getId(),
                new CreateParaphraseJobRequest(1, "medium"),
                "admin"
        );

        assertThat(response.status()).isEqualTo(ParaphraseJobStatus.COMPLETED.name());
        assertThat(response.candidates()).hasSize(1);
        ParaphraseCandidateResponse candidate = response.candidates().get(0);
        assertThat(candidate.stem()).contains("Trước khi tiêm thuốc");
        assertThat(candidate.optionA()).contains("tối thiểu hai thông tin");
        assertThat(candidate.optionB()).contains("số phòng");
        assertThat(candidate.correctAnswer()).isEqualTo("A");
        assertThat(candidate.status()).isEqualTo(CandidateStatus.VALIDATED.name());
        assertThat(candidate.lexicalDifferenceFromSource()).isEqualTo(0.38);
    }

    @Test
    void approveThenSaveCreatesParaphraseQuestionWithParentAndEmbeddingAttempt() {
        ParaphraseJobResponse response = service.createJob(
                sourceQuestion.getId(),
                new CreateParaphraseJobRequest(1, "medium"),
                "admin"
        );
        Long candidateId = response.candidates().get(0).id();

        service.approve(candidateId, "Ổn");
        ParaphraseCandidateResponse saved = service.saveAsQuestion(candidateId, "admin");

        assertThat(saved.status()).isEqualTo(CandidateStatus.SAVED.name());
        assertThat(saved.savedQuestionId()).isNotNull();
        ArgumentCaptor<QuestionBankQuestion> questionCaptor = ArgumentCaptor.forClass(QuestionBankQuestion.class);
        verify(questionRepository).save(questionCaptor.capture());
        QuestionBankQuestion savedQuestion = questionCaptor.getValue();
        assertThat(savedQuestion.getQuestionType()).isEqualTo(QuestionType.PARAPHRASE);
        assertThat(savedQuestion.getParentQuestion()).isEqualTo(sourceQuestion);
        assertThat(savedQuestion.getCorrectAnswer()).isEqualTo(sourceQuestion.getCorrectAnswer());
        verify(embeddingService).saveStemEmbedding(savedQuestion);
    }

    @Test
    void createBatchJobsKeepsSuccessfulJobsAndReportsInvalidQuestions() {
        QuestionBankQuestion draftQuestion = QuestionBankQuestion.builder()
                .id(11L)
                .stem("Câu hỏi nháp")
                .optionA("A")
                .optionB("B")
                .optionC("C")
                .optionD("D")
                .correctAnswer("A")
                .language("vi")
                .questionType(QuestionType.ORIGINAL)
                .status(QuestionBankStatus.DRAFT)
                .build();
        when(questionRepository.findById(draftQuestion.getId())).thenReturn(Optional.of(draftQuestion));
        when(questionRepository.findById(999L)).thenReturn(Optional.empty());

        var response = service.createBatchJobs(new CreateBatchParaphraseJobsRequest(
                List.of(sourceQuestion.getId(), draftQuestion.getId(), 999L),
                1,
                "medium"
        ), "admin");

        assertThat(response.requestedQuestionCount()).isEqualTo(3);
        assertThat(response.succeededCount()).isEqualTo(1);
        assertThat(response.failedCount()).isEqualTo(2);
        assertThat(response.jobs()).hasSize(1);
        assertThat(response.errors()).extracting("questionId").containsExactly(draftQuestion.getId(), 999L);
    }

    @Test
    void approveBatchUpdatesCandidatesAndReportsMissingCandidate() {
        ParaphraseJobResponse jobResponse = service.createJob(
                sourceQuestion.getId(),
                new CreateParaphraseJobRequest(1, "medium"),
                "admin"
        );
        Long candidateId = jobResponse.candidates().get(0).id();

        var response = service.approveBatch(new BatchParaphraseCandidateActionRequest(
                List.of(candidateId, 999L),
                "Đạt"
        ));

        assertThat(response.requestedCount()).isEqualTo(2);
        assertThat(response.succeededCount()).isEqualTo(1);
        assertThat(response.failedCount()).isEqualTo(1);
        assertThat(response.candidates()).hasSize(1);
        assertThat(response.candidates().get(0).status()).isEqualTo(CandidateStatus.APPROVED.name());
        assertThat(response.errors()).extracting("candidateId").containsExactly(999L);
    }
}
