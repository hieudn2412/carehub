package vn.vietduc.carehubbackend.form.assignment;

import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.*;
import vn.vietduc.carehubbackend.exception.ValidationException;
import vn.vietduc.carehubbackend.form.assignment.dto.CreateFormAssignmentRequest;
import vn.vietduc.carehubbackend.form.assignment.entity.*;
import vn.vietduc.carehubbackend.form.assignment.repository.*;
import vn.vietduc.carehubbackend.form.assignment.service.*;
import vn.vietduc.carehubbackend.form.entity.*;
import vn.vietduc.carehubbackend.form.entity.enums.*;
import vn.vietduc.carehubbackend.form.mapper.FormMapper;
import vn.vietduc.carehubbackend.form.repository.FormRepository;
import vn.vietduc.carehubbackend.form.repository.FormVersionRepository;
import vn.vietduc.carehubbackend.user.entity.*;
import vn.vietduc.carehubbackend.user.repository.*;
import vn.vietduc.carehubbackend.utils.SecurityUtils;

import java.time.*;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class FormAssignmentServiceTest {
    @Mock FormAssignmentRepository assignmentRepository;
    @Mock FormAssignmentItemRepository itemRepository;
    @Mock FormRepository formRepository;
    @Mock FormVersionRepository versionRepository;
    @Mock UserRepository userRepository;
    @Mock UserRoleRepository userRoleRepository;
    @Mock SecurityUtils securityUtils;
    @Mock FormAssignmentAccessService accessService;
    @Mock FormMapper formMapper;
    private FormAssignmentService service;
    private User manager;
    private User admin;

    @BeforeEach
    void setUp() {
        Clock clock = Clock.fixed(Instant.parse("2026-06-21T00:00:00Z"), ZoneOffset.UTC);
        service = new FormAssignmentService(assignmentRepository, itemRepository, formRepository, versionRepository,
                userRepository, userRoleRepository, securityUtils, accessService, formMapper, clock);
        manager = User.builder().id(5L).employeeCode("M01").name("Manager").status(UserStatus.ACTIVE).build();
        admin = User.builder().id(1L).employeeCode("ADMIN").name("Admin").status(UserStatus.ACTIVE).build();
        lenient().when(userRepository.findById(5L)).thenReturn(Optional.of(manager));
        lenient().when(userRoleRepository.findRolesByUserId(5L)).thenReturn(List.of(Role.builder().code("MANAGER").build()));
        lenient().when(securityUtils.getCurrentUserId()).thenReturn(1L);
        lenient().when(userRepository.findById(1L)).thenReturn(Optional.of(admin));
    }

    @Test
    void createsAssignmentPinnedToPublishedVersion() {
        Form form = Form.builder().id(3L).code("HAND").title("Hand").subjectType(FormSubjectType.USER)
                .status(FormStatus.PUBLISHED).deleted(false).build();
        FormVersion version = FormVersion.builder().id(10L).form(form).title("Hand v1")
                .versionNumber(1).status(FormVersionStatus.PUBLISHED).build();
        when(versionRepository.findAllById(List.of(10L))).thenReturn(List.of(version));
        when(assignmentRepository.saveAndFlush(any())).thenAnswer(invocation -> invocation.getArgument(0));

        var response = service.create(new CreateFormAssignmentRequest(5L, null, null, List.of(10L)));

        assertEquals(1, response.items().size());
        assertEquals(10L, response.items().get(0).formVersionId());
        ArgumentCaptor<FormAssignment> captor = ArgumentCaptor.forClass(FormAssignment.class);
        verify(assignmentRepository).saveAndFlush(captor.capture());
        assertSame(version, captor.getValue().getItems().get(0).getFormVersion());
    }

    @Test
    void rejectsDraftVersion() {
        Form form = Form.builder().id(3L).code("HAND").build();
        FormVersion draft = FormVersion.builder().id(10L).form(form).status(FormVersionStatus.DRAFT).build();
        when(versionRepository.findAllById(List.of(10L))).thenReturn(List.of(draft));

        assertThrows(ValidationException.class,
                () -> service.create(new CreateFormAssignmentRequest(5L, null, null, List.of(10L))));
        verifyNoInteractions(assignmentRepository);
    }

    @Test
    void rejectsRetiredFormEvenWhenVersionIsStillPublished() {
        Form form = Form.builder().id(3L).code("HAND").status(FormStatus.RETIRED).deleted(true).build();
        FormVersion version = FormVersion.builder().id(10L).form(form).status(FormVersionStatus.PUBLISHED).build();
        when(versionRepository.findAllById(List.of(10L))).thenReturn(List.of(version));

        assertThrows(ValidationException.class,
                () -> service.create(new CreateFormAssignmentRequest(5L, null, null, List.of(10L))));
        verifyNoInteractions(assignmentRepository);
    }

    @Test
    void listsManagerAssignmentsByForm() {
        Form form = Form.builder().id(3L).code("HAND").status(FormStatus.PUBLISHED).deleted(false).build();
        FormVersion version = FormVersion.builder().id(10L).form(form).title("Hand v1")
                .versionNumber(1).status(FormVersionStatus.PUBLISHED).build();
        FormAssignment assignment = FormAssignment.builder().id(20L).manager(manager).assignedBy(admin)
                .assignedAt(Instant.parse("2026-06-21T00:00:00Z"))
                .effectiveFrom(Instant.parse("2026-06-21T00:00:00Z"))
                .status(FormAssignmentStatus.ACTIVE).build();
        FormAssignmentItem item = FormAssignmentItem.builder().id(30L).assignment(assignment)
                .form(form).formVersion(version).status(FormAssignmentStatus.ACTIVE).build();
        Pageable pageable = PageRequest.of(0, 20);
        when(formRepository.findByIdAndDeletedFalse(3L)).thenReturn(Optional.of(form));
        when(itemRepository.findByFormId(eq(3L), eq(FormAssignmentStatus.ACTIVE), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(item), pageable, 1));

        var response = service.searchByForm(3L, FormAssignmentStatus.ACTIVE, pageable);

        assertEquals(1, response.getTotalElements());
        assertEquals(30L, response.getContent().get(0).assignmentItemId());
        assertEquals("M01", response.getContent().get(0).manager().employeeCode());
        assertEquals(10L, response.getContent().get(0).formVersionId());
    }
}
