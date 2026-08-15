package vn.vietduc.carehubbackend.questiongeneration.controller;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.TestingAuthenticationToken;
import vn.vietduc.carehubbackend.exception.ServiceUnavailableException;
import vn.vietduc.carehubbackend.questiongeneration.service.EvaluationAuditLogService;
import vn.vietduc.carehubbackend.questiongeneration.service.EvaluationCutoverService;
import vn.vietduc.carehubbackend.questiongeneration.service.ExamAssignmentService;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class ExamAssignmentControllerTest {
    @Mock
    private ExamAssignmentService assignmentService;

    @Mock
    private EvaluationAuditLogService auditLogService;

    @Mock
    private EvaluationCutoverService cutover;

    @InjectMocks
    private ExamAssignmentController controller;

    @Test
    void openingAssignmentCannotBypassProductionAudienceAndGenerationGates() {
        doThrow(new ServiceUnavailableException("audience gate")).when(cutover).requireAudienceRules();

        assertThrows(ServiceUnavailableException.class, () -> controller.open(
                17L, new TestingAuthenticationToken("publisher", "credentials")));

        verify(cutover).requireAudienceRules();
        verify(cutover, never()).requireMultiFieldGeneration();
        verify(assignmentService, never()).open(17L);
    }
}
