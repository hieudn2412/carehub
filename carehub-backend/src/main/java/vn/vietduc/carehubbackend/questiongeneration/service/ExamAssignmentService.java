package vn.vietduc.carehubbackend.questiongeneration.service;

import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.vietduc.carehubbackend.exception.BadRequestException;
import vn.vietduc.carehubbackend.exception.ResourceNotFoundException;
import vn.vietduc.carehubbackend.notification.entity.NotificationAudience;
import vn.vietduc.carehubbackend.notification.entity.NotificationEventType;
import vn.vietduc.carehubbackend.notification.messaging.NotificationDispatchEvent;
import vn.vietduc.carehubbackend.notification.messaging.NotificationEventPublisher;
import vn.vietduc.carehubbackend.questiongeneration.dto.request.CreateExamAssignmentRequest;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.ExamAssignmentResultRowResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.ExamAssignmentResultsResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.ExamAssignmentResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.ExamAssignmentTargetResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.MyExamAssignmentResponse;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamAssignment;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamAssignmentTarget;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamAttempt;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamPaper;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.AssignmentTargetType;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ExamAssignmentStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ExamAttemptStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ExamPaperStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ExamResultVisibility;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamAssignmentRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamAssignmentTargetRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamAttemptRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamPaperRepository;
import vn.vietduc.carehubbackend.training.entity.TrainingGroup;
import vn.vietduc.carehubbackend.training.entity.ProfessionalField;
import vn.vietduc.carehubbackend.training.repository.ProfessionalFieldRepository;
import vn.vietduc.carehubbackend.training.repository.TrainingGroupRepository;
import vn.vietduc.carehubbackend.user.entity.Department;
import vn.vietduc.carehubbackend.user.entity.Position;
import vn.vietduc.carehubbackend.user.entity.User;
import vn.vietduc.carehubbackend.user.entity.UserStatus;
import vn.vietduc.carehubbackend.user.repository.DepartmentRepository;
import vn.vietduc.carehubbackend.user.repository.PositionRepository;
import vn.vietduc.carehubbackend.user.repository.UserRepository;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.Normalizer;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ExamAssignmentService {
    private static final int DEFAULT_MAX_ATTEMPTS = 1;
    private static final ExamResultVisibility DEFAULT_RESULT_VISIBILITY = ExamResultVisibility.SCORE_ONLY;

    private final ExamAssignmentRepository assignmentRepository;
    private final ExamAssignmentTargetRepository targetRepository;
    private final ExamAttemptRepository attemptRepository;
    private final ExamPaperRepository examPaperRepository;
    private final UserRepository userRepository;
    private final DepartmentRepository departmentRepository;
    private final PositionRepository positionRepository;
    private final TrainingGroupRepository trainingGroupRepository;
    private final ProfessionalFieldRepository professionalFieldRepository;
    private final NotificationEventPublisher notificationEventPublisher;

    @Transactional(readOnly = true)
    public List<ExamAssignmentResponse> list(String query, String status, Long professionalFieldId) {
        String normalizedQuery = normalize(query);
        ExamAssignmentStatus statusFilter = parseStatusOrNull(status);
        List<ExamAssignment> assignments = statusFilter == null
                ? assignmentRepository.findByStatusNotOrderByUpdatedAtDesc(ExamAssignmentStatus.ARCHIVED)
                : assignmentRepository.findByStatusOrderByUpdatedAtDesc(statusFilter);
        return assignments.stream()
                .filter(assignment -> professionalFieldId == null
                        || (assignment.getProfessionalField() != null
                        && professionalFieldId.equals(assignment.getProfessionalField().getId())))
                .filter(assignment -> normalizedQuery.isBlank()
                        || normalize(assignment.getName()).contains(normalizedQuery)
                        || normalize(assignment.getExamPaper().getName()).contains(normalizedQuery)
                        || normalize(assignment.getExamPaper().getCode()).contains(normalizedQuery))
                .map(assignment -> toResponse(assignment, false))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<ExamAssignmentResponse> listForManager(
            Long managerId,
            String query,
            String status,
            Long professionalFieldId
    ) {
        Long departmentId = managerDepartmentId(managerId);
        String normalizedQuery = normalize(query);
        ExamAssignmentStatus statusFilter = parseStatusOrNull(status);
        return targetRepository.findAssignmentsForDepartment(departmentId, ExamAssignmentStatus.ARCHIVED).stream()
                .filter(assignment -> statusFilter == null || assignment.getStatus() == statusFilter)
                .filter(assignment -> professionalFieldId == null
                        || (assignment.getProfessionalField() != null
                        && professionalFieldId.equals(assignment.getProfessionalField().getId())))
                .filter(assignment -> normalizedQuery.isBlank()
                        || normalize(assignment.getName()).contains(normalizedQuery)
                        || normalize(assignment.getExamPaper().getName()).contains(normalizedQuery)
                        || normalize(assignment.getExamPaper().getCode()).contains(normalizedQuery))
                .map(assignment -> toResponse(assignment, false))
                .toList();
    }

    @Transactional(readOnly = true)
    public ExamAssignmentResponse getForManager(Long managerId, Long assignmentId) {
        ExamAssignment assignment = find(assignmentId);
        requireDepartmentTargets(managerDepartmentId(managerId), assignment);
        return toResponse(assignment, true);
    }

    @Transactional(readOnly = true)
    public ExamAssignmentResponse get(Long assignmentId) {
        return toResponse(find(assignmentId), true);
    }

    @Transactional(readOnly = true)
    public ExamAssignmentResultsResponse results(Long assignmentId) {
        ExamAssignment assignment = find(assignmentId);
        List<ExamAssignmentTarget> targets = targetRepository.findByAssignmentOrderByUserEmployeeCodeAsc(assignment);
        return buildResults(assignment, targets);
    }

    @Transactional(readOnly = true)
    public ExamAssignmentResultsResponse resultsForManager(Long managerId, Long assignmentId) {
        ExamAssignment assignment = find(assignmentId);
        List<ExamAssignmentTarget> targets = requireDepartmentTargets(managerDepartmentId(managerId), assignment);
        return buildResults(assignment, targets);
    }

    private ExamAssignmentResultsResponse buildResults(
            ExamAssignment assignment,
            List<ExamAssignmentTarget> targets
    ) {
        Map<Long, List<ExamAttempt>> attemptsByUserId = attemptRepository.findByAssignmentOrderByStartedAtDesc(assignment).stream()
                .collect(Collectors.groupingBy(
                        attempt -> attempt.getUser().getId(),
                        LinkedHashMap::new,
                        Collectors.toList()
                ));
        List<ExamAssignmentResultRowResponse> rows = targets.stream()
                .map(target -> toResultRow(target, attemptsByUserId.getOrDefault(target.getUser().getId(), List.of())))
                .toList();
        List<BigDecimal> gradedScores = rows.stream()
                .map(ExamAssignmentResultRowResponse::bestScore)
                .filter(Objects::nonNull)
                .toList();
        BigDecimal averageScore = gradedScores.isEmpty()
                ? null
                : gradedScores.stream()
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .divide(BigDecimal.valueOf(gradedScores.size()), 2, RoundingMode.HALF_UP);
        BigDecimal bestScore = gradedScores.stream()
                .max(Comparator.naturalOrder())
                .orElse(null);
        return new ExamAssignmentResultsResponse(
                assignment.getId(),
                assignment.getName(),
                assignment.getExamPaper().getId(),
                assignment.getExamPaper().getCode(),
                assignment.getExamPaper().getName(),
                assignment.getProfessionalField() == null ? null : assignment.getProfessionalField().getId(),
                assignment.getProfessionalField() == null ? null : assignment.getProfessionalField().getCode(),
                assignment.getProfessionalField() == null ? null : assignment.getProfessionalField().getName(),
                rows.size(),
                (int) rows.stream().filter(row -> row.latestAttemptId() == null).count(),
                (int) rows.stream().filter(row -> "IN_PROGRESS".equals(row.latestStatus())).count(),
                (int) rows.stream().filter(row -> "SUBMITTED".equals(row.latestStatus())).count(),
                (int) rows.stream().filter(row -> "GRADED".equals(row.latestStatus())).count(),
                (int) rows.stream().filter(row -> "EXPIRED".equals(row.latestStatus())).count(),
                averageScore,
                bestScore,
                rows
        );
    }

    private Long managerDepartmentId(Long managerId) {
        User manager = userRepository.findByIdAndIsDeletedFalse(managerId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy tài khoản manager"));
        if (manager.getDepartment() == null) {
            throw new BadRequestException("Tài khoản manager chưa được gán khoa/phòng");
        }
        return manager.getDepartment().getId();
    }

    private List<ExamAssignmentTarget> requireDepartmentTargets(Long departmentId, ExamAssignment assignment) {
        List<ExamAssignmentTarget> targets = targetRepository.findByAssignmentAndDepartment(assignment, departmentId);
        if (targets.isEmpty()) {
            throw new ResourceNotFoundException("Không tìm thấy bài kiểm tra trong khoa/phòng của manager");
        }
        return targets;
    }

    @Transactional(readOnly = true)
    public byte[] exportResultsXlsx(Long assignmentId) {
        ExamAssignmentResultsResponse results = results(assignmentId);
        try (Workbook workbook = new XSSFWorkbook();
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            Sheet sheet = workbook.createSheet("Kết quả");
            CellStyle headerStyle = workbook.createCellStyle();
            Font headerFont = workbook.createFont();
            headerFont.setBold(true);
            headerStyle.setFont(headerFont);

            int rowIndex = 0;
            rowIndex = metadataRow(sheet, rowIndex, "Phân công", results.assignmentName());
            rowIndex = metadataRow(sheet, rowIndex, "Bộ đề", results.examPaperCode() + " - " + results.examPaperName());
            rowIndex = metadataRow(sheet, rowIndex, "Số nhân viên", String.valueOf(results.targetCount()));
            rowIndex = metadataRow(sheet, rowIndex, "Điểm trung bình", results.averageScore() == null ? "" : results.averageScore().toPlainString());
            rowIndex++;

            Row header = sheet.createRow(rowIndex++);
            List<String> headers = List.of(
                    "Mã NV", "Họ tên", "Khoa/phòng", "Số lượt", "Trạng thái mới nhất",
                    "Điểm mới nhất", "Đúng", "Tổng câu", "Đạt", "Điểm tốt nhất",
                    "Bắt đầu mới nhất", "Nộp mới nhất", "Thời gian làm"
            );
            for (int index = 0; index < headers.size(); index++) {
                header.createCell(index).setCellValue(headers.get(index));
                header.getCell(index).setCellStyle(headerStyle);
            }

            for (ExamAssignmentResultRowResponse row : results.rows()) {
                Row xlsxRow = sheet.createRow(rowIndex++);
                xlsxRow.createCell(0).setCellValue(blank(row.employeeCode()));
                xlsxRow.createCell(1).setCellValue(blank(row.userName()));
                xlsxRow.createCell(2).setCellValue(blank(row.departmentName()));
                xlsxRow.createCell(3).setCellValue(row.attemptCount() == null ? 0 : row.attemptCount());
                xlsxRow.createCell(4).setCellValue(row.latestStatusText() == null ? "Chưa làm" : row.latestStatusText());
                xlsxRow.createCell(5).setCellValue(row.latestScore() == null ? "" : row.latestScore().toPlainString());
                xlsxRow.createCell(6).setCellValue(row.latestCorrectCount() == null ? "" : String.valueOf(row.latestCorrectCount()));
                xlsxRow.createCell(7).setCellValue(row.latestTotalQuestions() == null ? "" : String.valueOf(row.latestTotalQuestions()));
                xlsxRow.createCell(8).setCellValue(row.latestPassed() == null ? "" : (Boolean.TRUE.equals(row.latestPassed()) ? "Đạt" : "Không đạt"));
                xlsxRow.createCell(9).setCellValue(row.bestScore() == null ? "" : row.bestScore().toPlainString());
                xlsxRow.createCell(10).setCellValue(row.latestStartedAt() == null ? "" : row.latestStartedAt().toString());
                xlsxRow.createCell(11).setCellValue(row.latestSubmittedAt() == null ? "" : row.latestSubmittedAt().toString());
                xlsxRow.createCell(12).setCellValue(row.latestTimeSpentSeconds() == null ? "" : String.valueOf(row.latestTimeSpentSeconds()));
            }
            for (int index = 0; index < headers.size(); index++) {
                sheet.autoSizeColumn(index);
            }
            workbook.write(output);
            return output.toByteArray();
        } catch (IOException ex) {
            throw new BadRequestException("Không thể export kết quả phân công");
        }
    }

    @Transactional(readOnly = true)
    public List<MyExamAssignmentResponse> listForUser(Long userId) {
        User user = findUser(userId);
        Map<Long, List<ExamAttempt>> attemptsByAssignmentId = attemptRepository
                .findByUserOrderByStartedAtDesc(user)
                .stream()
                .collect(Collectors.groupingBy(
                        attempt -> attempt.getAssignment().getId(),
                        LinkedHashMap::new,
                        Collectors.toList()
                ));
        return targetRepository.findByUserOrderByAssignmentUpdatedAtDesc(user).stream()
                .map(ExamAssignmentTarget::getAssignment)
                .filter(assignment -> assignment.getStatus() != ExamAssignmentStatus.ARCHIVED)
                .map(assignment -> toMyExamResponse(
                        assignment,
                        attemptsByAssignmentId.getOrDefault(assignment.getId(), List.of())
                ))
                .toList();
    }

    @Transactional
    public ExamAssignmentResponse create(CreateExamAssignmentRequest request, String actor) {
        if (request == null) {
            throw new BadRequestException("Dữ liệu phân công không hợp lệ");
        }
        String name = trimToNull(request.name());
        if (name == null) {
            throw new BadRequestException("Vui lòng nhập tên phân công");
        }
        if (request.examPaperId() == null) {
            throw new BadRequestException("Vui lòng chọn bộ đề kiểm tra");
        }
        if (request.professionalFieldId() == null) {
            throw new BadRequestException("Vui lòng chọn lĩnh vực chuyên môn");
        }
        ProfessionalField professionalField = professionalFieldRepository.findById(request.professionalFieldId())
                .filter(ProfessionalField::isActive)
                .orElseThrow(() -> new BadRequestException("Lĩnh vực chuyên môn không hợp lệ hoặc đã ngừng sử dụng"));
        ExamPaper examPaper = examPaperRepository.findById(request.examPaperId())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy bộ đề kiểm tra"));
        if (examPaper.getStatus() != ExamPaperStatus.PUBLISHED) {
            throw new BadRequestException("Chỉ được phân công bộ đề đã phát hành");
        }
        Set<Long> uniqueUserIds = request.userIds() == null
                ? new LinkedHashSet<>()
                : request.userIds().stream()
                .filter(Objects::nonNull)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        Set<Long> uniqueDepartmentIds = request.departmentIds() == null
                ? new LinkedHashSet<>()
                : request.departmentIds().stream()
                .filter(Objects::nonNull)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        Set<Long> uniquePositionIds = request.positionIds() == null
                ? new LinkedHashSet<>()
                : request.positionIds().stream()
                .filter(Objects::nonNull)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        Set<Long> uniqueGroupIds = request.groupIds() == null
                ? new LinkedHashSet<>()
                : request.groupIds().stream()
                .filter(Objects::nonNull)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        boolean allEmployees = Boolean.TRUE.equals(request.allEmployees());

        if (uniqueUserIds.isEmpty() && uniqueDepartmentIds.isEmpty()
                && uniquePositionIds.isEmpty() && uniqueGroupIds.isEmpty() && !allEmployees) {
            throw new BadRequestException("Vui lòng chọn ít nhất một nhân viên, khoa/phòng, chức danh, nhóm hoặc toàn bệnh viện");
        }

        // Track source type for each user
        Map<Long, AssignmentTargetType> targetTypeByUserId = new LinkedHashMap<>();
        Map<Long, Long> sourceIdByUserId = new LinkedHashMap<>();

        // ALL_EMPLOYEES: get all active users
        if (allEmployees) {
            userRepository.findByIsDeletedFalseAndStatus(UserStatus.ACTIVE).stream()
                    .map(User::getId)
                    .filter(Objects::nonNull)
                    .forEach(id -> {
                        uniqueUserIds.add(id);
                        targetTypeByUserId.put(id, AssignmentTargetType.ALL_EMPLOYEES);
                    });
        }

        // Department expansion
        if (!uniqueDepartmentIds.isEmpty()) {
            List<Department> departments = departmentRepository.findAllById(uniqueDepartmentIds);
            if (departments.size() != uniqueDepartmentIds.size()) {
                throw new BadRequestException("Danh sách khoa/phòng phân công không hợp lệ");
            }
            userRepository.findByDepartment_IdInAndIsDeletedFalse(uniqueDepartmentIds).stream()
                    .map(User::getId)
                    .filter(Objects::nonNull)
                    .forEach(id -> {
                        uniqueUserIds.add(id);
                        targetTypeByUserId.putIfAbsent(id, AssignmentTargetType.EMPLOYEE);
                    });
        }

        // Position expansion
        if (!uniquePositionIds.isEmpty()) {
            List<Position> positions = positionRepository.findAllById(uniquePositionIds);
            if (positions.size() != uniquePositionIds.size()) {
                throw new BadRequestException("Danh sách chức danh phân công không hợp lệ");
            }
            List<User> allActive = userRepository.findByIsDeletedFalseAndStatus(UserStatus.ACTIVE);
            Set<Long> positionIdSet = new LinkedHashSet<>(uniquePositionIds);
            for (User u : allActive) {
                if (u.getPosition() != null && positionIdSet.contains(u.getPosition().getId())) {
                    Long uid = u.getId();
                    if (uid != null) {
                        uniqueUserIds.add(uid);
                        targetTypeByUserId.putIfAbsent(uid, AssignmentTargetType.POSITION);
                        sourceIdByUserId.putIfAbsent(uid, u.getPosition().getId());
                    }
                }
            }
        }

        // Group expansion
        if (!uniqueGroupIds.isEmpty()) {
            List<TrainingGroup> groups = trainingGroupRepository.findByIdInAndActiveTrue(uniqueGroupIds);
            if (groups.size() != uniqueGroupIds.size()) {
                throw new BadRequestException("Danh sách nhóm đào tạo phân công không hợp lệ");
            }
            for (TrainingGroup group : groups) {
                group.getMembers().stream()
                        .map(User::getId)
                        .filter(Objects::nonNull)
                        .forEach(id -> {
                            uniqueUserIds.add(id);
                            targetTypeByUserId.putIfAbsent(id, AssignmentTargetType.GROUP);
                            sourceIdByUserId.putIfAbsent(id, group.getId());
                        });
            }
        }

        if (uniqueUserIds.isEmpty()) {
            throw new BadRequestException("Không tìm thấy nhân viên nào để phân công");
        }

        List<User> users = userRepository.findAllById(uniqueUserIds);
        if (users.size() != uniqueUserIds.size()) {
            throw new BadRequestException("Danh sách nhân viên phân công không hợp lệ");
        }
        ExamAssignmentStatus status = parseCreateStatus(request.status());
        LocalDateTime now = LocalDateTime.now();
        ExamAssignment assignment = assignmentRepository.save(ExamAssignment.builder()
                .name(name)
                .description(trimToNull(request.description()))
                .examPaper(examPaper)
                .professionalField(professionalField)
                .status(status)
                .dueAt(request.dueAt())
                .maxAttempts(clamp(request.maxAttempts() == null ? DEFAULT_MAX_ATTEMPTS : request.maxAttempts(), 1, 10))
                .resultVisibility(parseResultVisibility(request.resultVisibility()))
                .createdBy(actor)
                .openedAt(status == ExamAssignmentStatus.OPEN ? now : null)
                .build());
        for (User user : users) {
            AssignmentTargetType targetType = targetTypeByUserId.getOrDefault(user.getId(), AssignmentTargetType.EMPLOYEE);
            Long sourcePositionId = targetType == AssignmentTargetType.POSITION ? sourceIdByUserId.get(user.getId()) : null;
            Long sourceGroupId = targetType == AssignmentTargetType.GROUP ? sourceIdByUserId.get(user.getId()) : null;
            targetRepository.save(ExamAssignmentTarget.builder()
                    .assignment(assignment)
                    .user(user)
                    .targetType(targetType)
                    .sourcePositionId(sourcePositionId)
                    .sourceGroupId(sourceGroupId)
                    .build());
        }
        if (status == ExamAssignmentStatus.OPEN) {
            users.forEach(user -> publishExamAssigned(assignment, user));
        }
        return toResponse(assignment, true);
    }

    @Transactional
    public ExamAssignmentResponse open(Long assignmentId) {
        ExamAssignment assignment = find(assignmentId);
        boolean wasOpen = assignment.getStatus() == ExamAssignmentStatus.OPEN;
        if (assignment.getStatus() == ExamAssignmentStatus.ARCHIVED) {
            throw new BadRequestException("Không thể mở phân công đã lưu trữ");
        }
        if (assignment.getExamPaper().getStatus() != ExamPaperStatus.PUBLISHED) {
            throw new BadRequestException("Bộ đề của phân công chưa được phát hành");
        }
        assignment.setStatus(ExamAssignmentStatus.OPEN);
        assignment.setOpenedAt(assignment.getOpenedAt() == null ? LocalDateTime.now() : assignment.getOpenedAt());
        assignment.setClosedAt(null);
        ExamAssignment saved = assignmentRepository.save(assignment);
        if (!wasOpen) {
            targetRepository.findByAssignmentOrderByUserEmployeeCodeAsc(saved).stream()
                    .map(ExamAssignmentTarget::getUser)
                    .forEach(user -> publishExamAssigned(saved, user));
        }
        return toResponse(saved, true);
    }

    private void publishExamAssigned(ExamAssignment assignment, User user) {
        Map<String, String> variables = new LinkedHashMap<>();
        variables.put("employee_name", user.getName());
        variables.put("employee_code", user.getEmployeeCode());
        variables.put("exam_name", assignment.getName());
        variables.put("due_at", assignment.getDueAt() == null ? "Không giới hạn" : assignment.getDueAt().toString());
        variables.put("max_attempts", String.valueOf(assignment.getMaxAttempts()));
        notificationEventPublisher.publish(new NotificationDispatchEvent(
                NotificationEventType.EXAM_ASSIGNED,
                user.getId(),
                NotificationAudience.EMPLOYEE,
                "INFO",
                "Bạn được giao bài thi mới",
                "Bài thi '" + assignment.getName() + "' đã được giao cho bạn.",
                "/staff/exam/take",
                "EXAM_ASSIGNED:" + assignment.getId() + ":" + user.getId(),
                variables
        ));
    }

    @Transactional
    public ExamAssignmentResponse close(Long assignmentId) {
        ExamAssignment assignment = find(assignmentId);
        if (assignment.getStatus() == ExamAssignmentStatus.ARCHIVED) {
            throw new BadRequestException("Phân công đã lưu trữ");
        }
        assignment.setStatus(ExamAssignmentStatus.CLOSED);
        assignment.setClosedAt(LocalDateTime.now());
        return toResponse(assignmentRepository.save(assignment), true);
    }

    @Transactional
    public ExamAssignmentResponse archive(Long assignmentId) {
        ExamAssignment assignment = find(assignmentId);
        assignment.setStatus(ExamAssignmentStatus.ARCHIVED);
        assignment.setClosedAt(assignment.getClosedAt() == null ? LocalDateTime.now() : assignment.getClosedAt());
        return toResponse(assignmentRepository.save(assignment), false);
    }

    ExamAssignment find(Long assignmentId) {
        return assignmentRepository.findById(assignmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy phân công kiểm tra"));
    }

    private ExamAssignmentResponse toResponse(ExamAssignment assignment, boolean includeTargets) {
        ExamResultVisibility resultVisibility = resultVisibility(assignment);
        List<ExamAssignmentTargetResponse> targets = includeTargets
                ? targetRepository.findByAssignmentOrderByUserEmployeeCodeAsc(assignment).stream()
                .map(this::toTargetResponse)
                .toList()
                : List.of();
        List<vn.vietduc.carehubbackend.questiongeneration.entity.ExamAttempt> attempts =
                attemptRepository.findByAssignmentOrderByStartedAtDesc(assignment);
        int submittedCount = (int) attempts.stream()
                .filter(attempt -> attempt.getStatus() == ExamAttemptStatus.SUBMITTED || attempt.getStatus() == ExamAttemptStatus.GRADED)
                .count();
        return new ExamAssignmentResponse(
                assignment.getId(),
                assignment.getName(),
                assignment.getDescription(),
                assignment.getExamPaper().getId(),
                assignment.getExamPaper().getCode(),
                assignment.getExamPaper().getName(),
                assignment.getProfessionalField() == null ? null : assignment.getProfessionalField().getId(),
                assignment.getProfessionalField() == null ? null : assignment.getProfessionalField().getCode(),
                assignment.getProfessionalField() == null ? null : assignment.getProfessionalField().getName(),
                assignment.getStatus().name(),
                QuestionGenerationLabels.examAssignmentStatus(assignment.getStatus()),
                assignment.getDueAt(),
                assignment.getMaxAttempts(),
                resultVisibility.name(),
                QuestionGenerationLabels.examResultVisibility(resultVisibility),
                Math.toIntExact(targetRepository.countByAssignment(assignment)),
                attempts.size(),
                submittedCount,
                targets,
                assignment.getOpenedAt(),
                assignment.getClosedAt(),
                assignment.getCreatedAt(),
                assignment.getUpdatedAt()
        );
    }

    private MyExamAssignmentResponse toMyExamResponse(
            ExamAssignment assignment,
            List<ExamAttempt> attempts
    ) {
        LocalDateTime now = LocalDateTime.now();
        ExamAttempt currentAttempt = attempts.stream()
                .filter(attempt -> attempt.getStatus() == ExamAttemptStatus.IN_PROGRESS)
                .filter(attempt -> attempt.getExpiresAt() == null || !now.isAfter(attempt.getExpiresAt()))
                .findFirst()
                .orElse(null);
        ExamAttempt latestAttempt = attempts.stream().findFirst().orElse(null);
        int usedAttempts = attempts.size();
        int maxAttempts = assignment.getMaxAttempts() == null
                ? DEFAULT_MAX_ATTEMPTS
                : assignment.getMaxAttempts();
        int remainingAttempts = Math.max(0, maxAttempts - usedAttempts);
        boolean due = assignment.getDueAt() != null && now.isAfter(assignment.getDueAt());
        boolean canStartNew = assignment.getStatus() == ExamAssignmentStatus.OPEN
                && !due
                && remainingAttempts > 0;

        String availabilityStatus;
        String availabilityText;
        String actionLabel;
        boolean actionable;
        if (currentAttempt != null) {
            availabilityStatus = "IN_PROGRESS";
            availabilityText = "Đang làm";
            actionLabel = "Tiếp tục";
            actionable = true;
        } else if (canStartNew) {
            availabilityStatus = usedAttempts > 0 ? "RETAKE_AVAILABLE" : "AVAILABLE";
            availabilityText = usedAttempts > 0 ? "Có thể làm lại" : "Sẵn sàng";
            actionLabel = usedAttempts > 0 ? "Làm lại" : "Bắt đầu";
            actionable = true;
        } else if (due) {
            availabilityStatus = "OVERDUE";
            availabilityText = "Đã quá hạn";
            actionLabel = "Đã quá hạn";
            actionable = false;
        } else if (remainingAttempts == 0) {
            availabilityStatus = "COMPLETED";
            availabilityText = "Đã hoàn thành";
            actionLabel = "Đã hết lượt";
            actionable = false;
        } else {
            availabilityStatus = "CLOSED";
            availabilityText = "Đã đóng";
            actionLabel = "Đã đóng";
            actionable = false;
        }

        return new MyExamAssignmentResponse(
                assignment.getId(),
                assignment.getName(),
                assignment.getDescription(),
                assignment.getExamPaper().getId(),
                assignment.getExamPaper().getCode(),
                assignment.getExamPaper().getName(),
                assignment.getProfessionalField() == null ? null : assignment.getProfessionalField().getId(),
                assignment.getProfessionalField() == null ? null : assignment.getProfessionalField().getName(),
                assignment.getStatus().name(),
                QuestionGenerationLabels.examAssignmentStatus(assignment.getStatus()),
                assignment.getDueAt(),
                assignment.getOpenedAt(),
                assignment.getCreatedAt(),
                maxAttempts,
                usedAttempts,
                remainingAttempts,
                currentAttempt == null ? null : currentAttempt.getId(),
                currentAttempt == null
                        ? (latestAttempt == null ? null : latestAttempt.getStatus().name())
                        : currentAttempt.getStatus().name(),
                currentAttempt == null
                        ? (latestAttempt == null ? "Chưa làm" : QuestionGenerationLabels.examAttemptStatus(latestAttempt.getStatus()))
                        : QuestionGenerationLabels.examAttemptStatus(currentAttempt.getStatus()),
                currentAttempt == null ? null : currentAttempt.getExpiresAt(),
                availabilityStatus,
                availabilityText,
                actionLabel,
                actionable
        );
    }

    private ExamAssignmentTargetResponse toTargetResponse(ExamAssignmentTarget target) {
        User user = target.getUser();
        return new ExamAssignmentTargetResponse(
                user.getId(),
                user.getEmployeeCode(),
                user.getName(),
                user.getDepartment() == null ? null : user.getDepartment().getName()
        );
    }

    private ExamAssignmentResultRowResponse toResultRow(ExamAssignmentTarget target, List<ExamAttempt> attempts) {
        User user = target.getUser();
        ExamAttempt latest = attempts.stream()
                .max(Comparator.comparing(ExamAttempt::getStartedAt, Comparator.nullsLast(Comparator.naturalOrder())))
                .orElse(null);
        ExamAttempt best = attempts.stream()
                .filter(attempt -> attempt.getScore() != null)
                .max(Comparator.comparing(ExamAttempt::getScore))
                .orElse(null);
        return new ExamAssignmentResultRowResponse(
                user.getId(),
                user.getEmployeeCode(),
                user.getName(),
                user.getDepartment() == null ? null : user.getDepartment().getName(),
                attempts.size(),
                latest == null ? null : latest.getId(),
                latest == null ? null : latest.getAttemptNumber(),
                latest == null ? null : latest.getStatus().name(),
                latest == null ? "Chưa làm" : QuestionGenerationLabels.examAttemptStatus(latest.getStatus()),
                latest == null ? null : latest.getScore(),
                latest == null ? null : latest.getCorrectCount(),
                latest == null ? null : latest.getTotalQuestions(),
                latest == null ? null : latest.getPassed(),
                best == null ? null : best.getScore(),
                best == null ? null : best.getPassed(),
                latest == null ? null : latest.getStartedAt(),
                latest == null ? null : latest.getSubmittedAt(),
                latest == null ? null : latest.getTimeSpentSeconds()
        );
    }

    private int metadataRow(Sheet sheet, int rowIndex, String label, String value) {
        Row row = sheet.createRow(rowIndex);
        row.createCell(0).setCellValue(label);
        row.createCell(1).setCellValue(value == null ? "" : value);
        return rowIndex + 1;
    }

    private User findUser(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy nhân viên"));
    }

    private ExamAssignmentStatus parseCreateStatus(String status) {
        ExamAssignmentStatus parsed = parseStatusOrNull(status);
        if (parsed == null) {
            return ExamAssignmentStatus.DRAFT;
        }
        if (parsed != ExamAssignmentStatus.DRAFT && parsed != ExamAssignmentStatus.OPEN) {
            throw new BadRequestException("Trạng thái tạo phân công không hợp lệ");
        }
        return parsed;
    }

    private ExamAssignmentStatus parseStatusOrNull(String status) {
        if (status == null || status.isBlank()) {
            return null;
        }
        try {
            return ExamAssignmentStatus.valueOf(status.trim().toUpperCase(Locale.ROOT));
        } catch (Exception ex) {
            throw new BadRequestException("Trạng thái phân công không hợp lệ");
        }
    }

    ExamResultVisibility resultVisibility(ExamAssignment assignment) {
        return assignment.getResultVisibility() == null ? DEFAULT_RESULT_VISIBILITY : assignment.getResultVisibility();
    }

    private ExamResultVisibility parseResultVisibility(String visibility) {
        if (visibility == null || visibility.isBlank()) {
            return DEFAULT_RESULT_VISIBILITY;
        }
        try {
            return ExamResultVisibility.valueOf(visibility.trim().toUpperCase(Locale.ROOT));
        } catch (Exception ex) {
            throw new BadRequestException("Chế độ hiển thị kết quả không hợp lệ");
        }
    }

    private int clamp(int value, int min, int max) {
        return Math.max(min, Math.min(max, value));
    }

    private String trimToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private String blank(String value) {
        return value == null ? "" : value;
    }

    private String normalize(String value) {
        return Normalizer.normalize(value == null ? "" : value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "")
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^\\p{L}\\p{N}\\s]", " ")
                .replaceAll("\\s+", " ")
                .trim();
    }
}
