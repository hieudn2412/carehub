package vn.vietduc.carehubbackend.form.subject;

import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import vn.vietduc.carehubbackend.form.assignment.entity.*;
import vn.vietduc.carehubbackend.form.assignment.service.FormAssignmentAccessService;
import vn.vietduc.carehubbackend.form.entity.Form;
import vn.vietduc.carehubbackend.form.entity.enums.FormSubjectType;
import vn.vietduc.carehubbackend.form.subject.service.FormSubjectService;
import vn.vietduc.carehubbackend.form.compliance.repository.FormComplianceTargetRepository;
import vn.vietduc.carehubbackend.exception.ResourceNotFoundException;
import vn.vietduc.carehubbackend.user.entity.*;
import vn.vietduc.carehubbackend.user.repository.UserRepository;
import vn.vietduc.carehubbackend.utils.SecurityUtils;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class FormSubjectServiceTest {
    @Mock UserRepository userRepository;
    @Mock SecurityUtils securityUtils;
    @Mock FormAssignmentAccessService assignmentAccessService;
    @Mock FormComplianceTargetRepository complianceTargetRepository;
    private FormSubjectService service;

    @BeforeEach void setUp() { service = new FormSubjectService(userRepository, securityUtils, assignmentAccessService, complianceTargetRepository); }
    @AfterEach void tearDown() { SecurityContextHolder.clearContext(); }

    @Test
    void managerCanLookupActiveEmployeeInOwnDepartmentWithAssignment() {
        Position position = Position.builder().name("Điều dưỡng").build();
        Department department = Department.builder().id(20L).name("Khoa Hồi sức").build();
        User manager = User.builder().id(5L).employeeCode("QL01").name("Manager")
                .department(department).status(UserStatus.ACTIVE).build();
        User target = User.builder().id(101L).employeeCode("NV01").name("Nguyễn Văn A")
                .position(position).department(department).status(UserStatus.ACTIVE).build();
        FormAssignmentItem item = FormAssignmentItem.builder()
                .form(Form.builder().subjectType(FormSubjectType.USER).build()).build();
        authenticate("ROLE_MANAGER");
        when(securityUtils.getCurrentUserId()).thenReturn(5L);
        when(userRepository.findByIdAndIsDeletedFalse(5L)).thenReturn(Optional.of(manager));
        when(assignmentAccessService.requireActiveOwnedItem(10L, 5L)).thenReturn(item);
        when(userRepository.findByEmployeeCodeIgnoreCaseAndIsDeletedFalse("nv01"))
                .thenReturn(Optional.of(target));

        var response = service.findByEmployeeCode(10L, "nv01");

        assertEquals(101L, response.userId());
        assertEquals("NV01", response.employeeCode());
        assertEquals("Điều dưỡng", response.position());
        assertEquals("Khoa Hồi sức", response.department());
    }

    @Test
    void managerCannotLookupEmployeeFromAnotherDepartment() {
        Department managerDepartment = Department.builder().id(20L).name("Khoa Nội").build();
        Department otherDepartment = Department.builder().id(21L).name("Khoa Ngoại").build();
        User manager = User.builder().id(5L).employeeCode("QL01").name("Manager")
                .department(managerDepartment).status(UserStatus.ACTIVE).build();
        User target = User.builder().id(101L).employeeCode("NV01").name("Nhân viên")
                .department(otherDepartment).status(UserStatus.ACTIVE).build();
        FormAssignmentItem item = FormAssignmentItem.builder()
                .form(Form.builder().subjectType(FormSubjectType.USER).build()).build();
        authenticate("ROLE_MANAGER");
        when(securityUtils.getCurrentUserId()).thenReturn(5L);
        when(assignmentAccessService.requireActiveOwnedItem(10L, 5L)).thenReturn(item);
        when(userRepository.findByIdAndIsDeletedFalse(5L)).thenReturn(Optional.of(manager));
        when(userRepository.findByEmployeeCodeIgnoreCaseAndIsDeletedFalse("NV01"))
                .thenReturn(Optional.of(target));

        assertThrows(ResourceNotFoundException.class,
                () -> service.findByEmployeeCode(10L, "NV01"));
    }

    @Test
    void adminCanLookupWithoutAssignment() {
        authenticate("ROLE_ADMIN");
        User target = User.builder().id(102L).employeeCode("NV02").name("User").status(UserStatus.ACTIVE).build();
        when(securityUtils.getCurrentUserId()).thenReturn(1L);
        when(userRepository.findByEmployeeCodeIgnoreCaseAndIsDeletedFalse("NV02"))
                .thenReturn(Optional.of(target));

        assertEquals("NV02", service.findByEmployeeCode(null, "NV02").employeeCode());
        verifyNoInteractions(assignmentAccessService);
    }

    @Test
    void cannotLookupInactiveEmployee() {
        authenticate("ROLE_ADMIN");
        User target = User.builder().id(103L).employeeCode("NV03").name("Inactive").status(UserStatus.INACTIVE).build();
        when(securityUtils.getCurrentUserId()).thenReturn(1L);
        when(userRepository.findByEmployeeCodeIgnoreCaseAndIsDeletedFalse("NV03"))
                .thenReturn(Optional.of(target));

        assertThrows(ResourceNotFoundException.class, () -> service.findByEmployeeCode(null, "NV03"));
    }

    @Test
    void adminCanSearchActiveEmployeesWithoutAssignment() {
        authenticate("ROLE_ADMIN");
        User target = User.builder().id(104L).employeeCode("NV04").name("Nguyễn Văn B")
                .status(UserStatus.ACTIVE).build();
        var pageable = PageRequest.of(0, 20);
        when(securityUtils.getCurrentUserId()).thenReturn(1L);
        when(userRepository.searchActiveFormSubjectsInDepartments("%nv04%", 1L, null, pageable))
                .thenReturn(new PageImpl<>(List.of(target), pageable, 1));

        var result = service.search(null, " NV04 ", pageable);

        assertEquals(1, result.getTotalElements());
        assertEquals(104L, result.getContent().get(0).userId());
        assertEquals("NV04", result.getContent().get(0).employeeCode());
        verifyNoInteractions(assignmentAccessService);
    }

    @Test
    void assignedUserCanSearchAfterAssignmentAccessIsValidated() {
        authenticate("ROLE_USER");
        var pageable = PageRequest.of(0, 20);
        Department department = Department.builder().id(30L).name("Khoa Nội").build();
        User evaluator = User.builder().id(8L).employeeCode("NV08").name("Người đánh giá")
                .department(department).status(UserStatus.ACTIVE).build();
        FormAssignmentItem item = FormAssignmentItem.builder()
                .form(Form.builder().id(100L).subjectType(FormSubjectType.USER).build()).build();
        when(securityUtils.getCurrentUserId()).thenReturn(8L);
        when(assignmentAccessService.requireActiveOwnedItem(12L, 8L)).thenReturn(item);
        when(userRepository.findByIdAndIsDeletedFalse(8L)).thenReturn(Optional.of(evaluator));
        when(complianceTargetRepository.findAllByForm_IdOrderByDepartment_NameAsc(100L)).thenReturn(List.of());
        when(userRepository.searchActiveFormSubjectsInDepartments(null, 8L, Set.of(30L), pageable))
                .thenReturn(new PageImpl<>(List.of(), pageable, 0));

        assertTrue(service.search(12L, " ", pageable).isEmpty());
        verify(assignmentAccessService).requireActiveOwnedItem(12L, 8L);
    }

    @Test
    void evaluatorCannotLookupSelfByEmployeeCode() {
        authenticate("ROLE_ADMIN");
        User actor = User.builder().id(7L).employeeCode("SELF01").name("Self")
                .status(UserStatus.ACTIVE).build();
        when(securityUtils.getCurrentUserId()).thenReturn(7L);
        when(userRepository.findByEmployeeCodeIgnoreCaseAndIsDeletedFalse("SELF01"))
                .thenReturn(Optional.of(actor));

        assertThrows(ResourceNotFoundException.class,
                () -> service.findByEmployeeCode(null, "SELF01"));
    }

    private void authenticate(String role) {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                "user", "n/a", List.of(new SimpleGrantedAuthority(role))));
    }
}
