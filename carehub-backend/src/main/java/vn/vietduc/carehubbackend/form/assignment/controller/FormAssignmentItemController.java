package vn.vietduc.carehubbackend.form.assignment.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import vn.vietduc.carehubbackend.form.assignment.service.FormAssignmentService;

@RestController
@RequestMapping("${app.api-prefix}/form-assignment-items")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class FormAssignmentItemController {
    private final FormAssignmentService service;

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> revoke(@PathVariable Long id) {
        service.revokeItem(id);
        return ResponseEntity.noContent().build();
    }
}
