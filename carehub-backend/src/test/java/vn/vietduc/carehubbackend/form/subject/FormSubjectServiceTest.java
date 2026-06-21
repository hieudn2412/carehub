package vn.vietduc.carehubbackend.form.subject;

import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import vn.vietduc.carehubbackend.form.assignment.entity.*;
import vn.vietduc.carehubbackend.form.assignment.service.FormAssignmentAccessService;
import vn.vietduc.carehubbackend.form.entity.Form;
import vn.vietduc.carehubbackend.form.entity.enums.FormSubjectType;
import vn.vietduc.carehubbackend.form.subject.service.FormSubjectService;
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
    private FormSubjectService service;

    @BeforeEach void setUp() { service = new FormSubjectService(userRepository, securityUtils, assignmentAccessService); }
    @AfterEach void tearDown() { SecurityContextHolder.clearContext(); }

    @Test
    void managerCanLookupActiveEmployeeAcrossDepartmentsWithAssignment() {
        Position position = Position.builder().name("Điều dưỡng").build();
        Department department = Department.builder().name("Khoa Hồi sức").build();
        User target = User.builder().employeeCode("NV01").name("Nguyễn Văn A")
                .position(position).department(department).status(UserStatus.ACTIVE).build();
        FormAssignmentItem item = FormAssignmentItem.builder()
                .form(Form.builder().subjectType(FormSubjectType.USER).build()).build();
        authenticate("ROLE_MANAGER");
        when(securityUtils.getCurrentUserId()).thenReturn(5L);
        when(assignmentAccessService.requireActiveOwnedItem(10L, 5L)).thenReturn(item);
        when(userRepository.findByEmployeeCodeIgnoreCaseAndIsDeletedFalseAndStatus("nv01", UserStatus.ACTIVE))
                .thenReturn(Optional.of(target));

        var response = service.findByEmployeeCode(10L, "nv01");

        assertEquals("NV01", response.employeeCode());
        assertEquals("Điều dưỡng", response.position());
        assertEquals("Khoa Hồi sức", response.department());
    }

    @Test
    void adminCanLookupWithoutAssignment() {
        authenticate("ROLE_ADMIN");
        User target = User.builder().employeeCode("NV02").name("User").status(UserStatus.ACTIVE).build();
        when(userRepository.findByEmployeeCodeIgnoreCaseAndIsDeletedFalseAndStatus("NV02", UserStatus.ACTIVE))
                .thenReturn(Optional.of(target));

        assertEquals("NV02", service.findByEmployeeCode(null, "NV02").employeeCode());
        verifyNoInteractions(assignmentAccessService, securityUtils);
    }

    private void authenticate(String role) {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                "user", "n/a", List.of(new SimpleGrantedAuthority(role))));
    }
}
