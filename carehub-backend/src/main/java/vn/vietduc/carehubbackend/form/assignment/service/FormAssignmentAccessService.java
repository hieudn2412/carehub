package vn.vietduc.carehubbackend.form.assignment.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.vietduc.carehubbackend.exception.ResourceNotFoundException;
import vn.vietduc.carehubbackend.form.assignment.entity.FormAssignmentItem;
import vn.vietduc.carehubbackend.form.assignment.entity.FormAssignmentStatus;
import vn.vietduc.carehubbackend.form.assignment.repository.FormAssignmentItemRepository;
import vn.vietduc.carehubbackend.form.entity.enums.FormStatus;
import vn.vietduc.carehubbackend.form.entity.enums.FormVersionStatus;

import java.time.Clock;
import java.time.Instant;

@Service
@RequiredArgsConstructor
public class FormAssignmentAccessService {
    private final FormAssignmentItemRepository itemRepository;
    private final Clock clock;

    @Transactional(readOnly = true)
    public FormAssignmentItem requireActiveOwnedItem(Long itemId, Long managerId) {
        return itemRepository.findActiveOwnedItem(itemId, managerId, FormAssignmentStatus.ACTIVE,
                        FormStatus.PUBLISHED, FormVersionStatus.PUBLISHED, Instant.now(clock))
                .orElseThrow(() -> new ResourceNotFoundException("Assigned form not found"));
    }

    @Transactional
    public FormAssignmentItem requireActiveOwnedItemForUpdate(Long itemId, Long managerId) {
        return itemRepository.findActiveOwnedItemForUpdate(itemId, managerId,
                        FormAssignmentStatus.ACTIVE, FormStatus.PUBLISHED,
                        FormVersionStatus.PUBLISHED, Instant.now(clock))
                .orElseThrow(() -> new ResourceNotFoundException("Assigned form not found"));
    }
}
