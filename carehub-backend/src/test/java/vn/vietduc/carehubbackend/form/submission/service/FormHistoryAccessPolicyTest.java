package vn.vietduc.carehubbackend.form.submission.service;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import vn.vietduc.carehubbackend.exception.ResourceNotFoundException;
import vn.vietduc.carehubbackend.form.assignment.repository.FormAssignmentItemRepository;
import vn.vietduc.carehubbackend.form.entity.Form;
import vn.vietduc.carehubbackend.form.entity.FormVersion;
import vn.vietduc.carehubbackend.form.submission.entity.FormSubmission;
import vn.vietduc.carehubbackend.form.submission.entity.FormSubmissionContext;
import vn.vietduc.carehubbackend.form.submission.entity.FormSubmissionStatus;
import vn.vietduc.carehubbackend.user.entity.Department;
import vn.vietduc.carehubbackend.user.entity.User;
import vn.vietduc.carehubbackend.user.repository.UserRepository;
import vn.vietduc.carehubbackend.utils.SecurityUtils;

import java.util.List;
import java.util.Optional;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class FormHistoryAccessPolicyTest {
    @Mock SecurityUtils securityUtils;
    @Mock UserRepository userRepository;
    @Mock FormAssignmentItemRepository assignmentItemRepository;

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void adminUsesHospitalScope() {
        authenticate("ROLE_ADMIN");
        when(securityUtils.getCurrentUserId()).thenReturn(1L);

        var scope = policy().requireHistoryScope();

        assertTrue(scope.admin());
        assertEquals(1L, scope.actorId());
        assertNull(scope.departmentId());
        verifyNoInteractions(userRepository);
    }

    @Test
    void managerIsLockedToOwnDepartmentAndHistoricalAssignments() {
        authenticate("ROLE_MANAGER");
        Department department = Department.builder().id(7L).name("Khoa Nội").build();
        User manager = User.builder().id(2L).name("Manager").department(department).build();
        when(securityUtils.getCurrentUserId()).thenReturn(2L);
        when(userRepository.findByIdAndIsDeletedFalse(2L)).thenReturn(Optional.of(manager));
        when(assignmentItemRepository.existsEverAssignedToManager(2L, 18L)).thenReturn(true);
        lenient().when(assignmentItemRepository.findActiveAllowedDepartmentIds(
                anyLong(), anyLong(), any(), any(), any(), any())).thenReturn(List.of(7L));

        var service = policy();
        var scope = service.requireHistoryScope();

        assertFalse(scope.admin());
        assertEquals(7L, scope.departmentId());
        assertEquals(7L, service.resolveDepartmentScope(99L));
        assertDoesNotThrow(() -> service.requireFormAccess(18L));
        assertThrows(ResourceNotFoundException.class, () -> service.requireFormAccess(19L));
    }

    @Test
    void managerReadsOnlySubmittedResultsFromOwnDepartment() {
        authenticate("ROLE_MANAGER");
        Department ownDepartment = Department.builder().id(7L).name("Khoa Nội").build();
        User manager = User.builder().id(2L).name("Manager").department(ownDepartment).build();
        User subject = User.builder().id(9L).name("Nhân viên").department(ownDepartment).build();
        Form form = Form.builder().id(18L).code("QT18").build();
        FormVersion version = FormVersion.builder().id(19L).form(form).build();
        FormSubmission submission = FormSubmission.builder()
                .id(20L)
                .status(FormSubmissionStatus.SUBMITTED)
                .formVersion(version)
                .build();
        submission.setSubjectContext(FormSubmissionContext.builder().submission(submission).subjectUser(subject).build());
        when(securityUtils.getCurrentUserId()).thenReturn(2L);
        when(userRepository.findByIdAndIsDeletedFalse(2L)).thenReturn(Optional.of(manager));
        when(assignmentItemRepository.existsEverAssignedToManager(2L, 18L)).thenReturn(true);
        when(assignmentItemRepository.findActiveAllowedDepartmentIds(
                anyLong(), anyLong(), any(), any(), any(), any())).thenReturn(List.of(7L));

        var service = policy();
        assertTrue(service.managerCanRead(submission));

        submission.setStatus(FormSubmissionStatus.DRAFT);
        assertFalse(service.managerCanRead(submission));
    }

    private FormHistoryAccessPolicy policy() {
        return new FormHistoryAccessPolicy(securityUtils, userRepository, assignmentItemRepository,
                Clock.fixed(Instant.parse("2026-06-21T00:00:00Z"), ZoneOffset.UTC));
    }

    private void authenticate(String... roles) {
        var authorities = List.of(roles).stream().map(SimpleGrantedAuthority::new).toList();
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("user", "password", authorities));
    }
}
