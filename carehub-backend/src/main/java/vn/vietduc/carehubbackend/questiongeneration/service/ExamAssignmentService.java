package vn.vietduc.carehubbackend.questiongeneration.service;

import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import vn.vietduc.carehubbackend.exception.BadRequestException;
import vn.vietduc.carehubbackend.exception.ConflictException;
import vn.vietduc.carehubbackend.exception.ResourceNotFoundException;
import vn.vietduc.carehubbackend.notification.entity.NotificationAudience;
import vn.vietduc.carehubbackend.notification.entity.NotificationEventType;
import vn.vietduc.carehubbackend.notification.messaging.NotificationDispatchEvent;
import vn.vietduc.carehubbackend.notification.messaging.NotificationEventPublisher;
import vn.vietduc.carehubbackend.questiongeneration.dto.request.CreateExamAssignmentRequest;
import vn.vietduc.carehubbackend.questiongeneration.dto.request.AddExamAssignmentTargetsRequest;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.ExamAssignmentResultRowResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.ExamAssignmentResultsResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.ExamAssignmentResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.ExamAssignmentTargetResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.ExamAssignmentTargetCandidateResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.EvaluationResultReportResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.MyExamAssignmentResponse;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamAssignment;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamAssignmentTarget;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamAttempt;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamPaper;
import vn.vietduc.carehubbackend.questiongeneration.entity.EvaluationAudience;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.AssignmentTargetType;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ExamAssignmentStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ExamAssignmentRetakeVariantPolicy;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ExamAssignmentVariantPolicy;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ExamAttemptStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ExamPaperStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ExamResultVisibility;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamAssignmentRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamAssignmentTargetRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamAttemptRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamPaperRepository;
import vn.vietduc.carehubbackend.training.entity.TrainingGroup;
import vn.vietduc.carehubbackend.training.entity.ProfessionalField;
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
import java.time.Clock;
import java.time.Instant;
import java.text.Normalizer;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
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
    private final NotificationEventPublisher notificationEventPublisher;
    private final Clock clock;
    private final ZoneId examBusinessZone;
    private final EvaluationAudienceService evaluationAudienceService;
    private final EvaluationResultService evaluationResultService;

    @Autowired
    public ExamAssignmentService(
            ExamAssignmentRepository assignmentRepository,
            ExamAssignmentTargetRepository targetRepository,
            ExamAttemptRepository attemptRepository,
            ExamPaperRepository examPaperRepository,
            UserRepository userRepository,
            DepartmentRepository departmentRepository,
            PositionRepository positionRepository,
            TrainingGroupRepository trainingGroupRepository,
            NotificationEventPublisher notificationEventPublisher,
            Clock clock,
            ZoneId examBusinessZone,
            EvaluationAudienceService evaluationAudienceService,
            EvaluationResultService evaluationResultService
    ) {
        this.assignmentRepository = assignmentRepository;
        this.targetRepository = targetRepository;
        this.attemptRepository = attemptRepository;
        this.examPaperRepository = examPaperRepository;
        this.userRepository = userRepository;
        this.departmentRepository = departmentRepository;
        this.positionRepository = positionRepository;
        this.trainingGroupRepository = trainingGroupRepository;
        this.notificationEventPublisher = notificationEventPublisher;
        this.clock = clock;
        this.examBusinessZone = examBusinessZone;
        this.evaluationAudienceService = evaluationAudienceService;
        this.evaluationResultService = evaluationResultService;
    }

    /** Compatibility constructor for service-level tests and integrations created before audience v1. */
    public ExamAssignmentService(
            ExamAssignmentRepository assignmentRepository,
            ExamAssignmentTargetRepository targetRepository,
            ExamAttemptRepository attemptRepository,
            ExamPaperRepository examPaperRepository,
            UserRepository userRepository,
            DepartmentRepository departmentRepository,
            PositionRepository positionRepository,
            TrainingGroupRepository trainingGroupRepository,
            NotificationEventPublisher notificationEventPublisher,
            Clock clock,
            ZoneId examBusinessZone
    ) {
        this(assignmentRepository, targetRepository, attemptRepository, examPaperRepository, userRepository,
                departmentRepository, positionRepository, trainingGroupRepository, notificationEventPublisher,
                clock, examBusinessZone, null, null);
    }

    @Transactional(readOnly = true)
    public List<ExamAssignmentResponse> list(String query, String status) {
        String normalizedQuery = normalize(query);
        ExamAssignmentStatus statusFilter = parseStatusOrNull(status);
        List<ExamAssignment> assignments = statusFilter == null
                ? assignmentRepository.findByStatusNotOrderByUpdatedAtDesc(ExamAssignmentStatus.ARCHIVED)
                : assignmentRepository.findByStatusOrderByUpdatedAtDesc(statusFilter);
        return assignments.stream()
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
            String status
    ) {
        Long departmentId = managerDepartmentId(managerId);
        String normalizedQuery = normalize(query);
        ExamAssignmentStatus statusFilter = parseStatusOrNull(status);
        return targetRepository.findAssignmentsForDepartment(departmentId, ExamAssignmentStatus.ARCHIVED).stream()
                .filter(assignment -> statusFilter == null || assignment.getStatus() == statusFilter)
                .filter(assignment -> normalizedQuery.isBlank()
                        || normalize(assignment.getName()).contains(normalizedQuery)
                        || normalize(assignment.getExamPaper().getName()).contains(normalizedQuery)
                        || normalize(assignment.getExamPaper().getCode()).contains(normalizedQuery))
                .map(assignment -> toResponse(assignment, false))
                .toList();
    }

    @Deprecated
    public List<ExamAssignmentResponse> listForManager(
            Long managerId, String query, String status, Long ignoredProfessionalFieldId
    ) {
        return listForManager(managerId, query, status);
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
    public List<ExamAssignmentTargetCandidateResponse> targetCandidates(Long assignmentId) {
        ExamAssignment assignment = find(assignmentId);
        if (assignment.getStatus() != ExamAssignmentStatus.OPEN) {
            throw new BadRequestException("Chỉ có thể xem nhân viên để giao bổ sung cho đợt đang mở");
        }
        LocalDateTime now = now();
        if (assignment.getDueAt() != null && !now.isBefore(assignment.getDueAt())) {
            throw new BadRequestException("Đợt giao đề đã quá hạn, không thể giao bổ sung");
        }
        Set<Long> assignedUserIds = targetRepository.findByAssignmentOrderByUserEmployeeCodeAsc(assignment).stream()
                .map(target -> target.getUser().getId())
                .collect(Collectors.toSet());
        return userRepository.findByIsDeletedFalseAndStatus(UserStatus.ACTIVE).stream()
                .filter(user -> !assignedUserIds.contains(user.getId()))
                .sorted(Comparator.comparing(User::getName, Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER))
                        .thenComparing(User::getEmployeeCode, Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER)))
                .map(user -> new ExamAssignmentTargetCandidateResponse(
                        user.getId(),
                        user.getEmployeeCode(),
                        user.getName(),
                        user.getPosition() == null ? null : user.getPosition().getName(),
                        user.getDepartment() == null ? null : user.getDepartment().getName()
                ))
                .toList();
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
        EvaluationResultReportResponse resultReport = evaluationResultService == null
                ? null
                : evaluationResultService.report(assignmentId);
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
                    "Điểm mới nhất", "Đúng", "Tổng câu", "Kết quả (lượt mới nhất)",
                    "Điểm cao nhất", "Kết quả (điểm cao nhất)",
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
                xlsxRow.createCell(10).setCellValue(row.bestPassed() == null ? "" : (Boolean.TRUE.equals(row.bestPassed()) ? "Đạt" : "Không đạt"));
                xlsxRow.createCell(11).setCellValue(row.latestStartedAt() == null ? "" : row.latestStartedAt().toString());
                xlsxRow.createCell(12).setCellValue(row.latestSubmittedAt() == null ? "" : row.latestSubmittedAt().toString());
                xlsxRow.createCell(13).setCellValue(row.latestTimeSpentSeconds() == null ? "" : String.valueOf(row.latestTimeSpentSeconds()));
            }
            for (int index = 0; index < headers.size(); index++) {
                sheet.autoSizeColumn(index);
            }
            if (resultReport != null) {
                writeFieldResultSheet(workbook, headerStyle, resultReport);
                writeFieldCognitiveResultSheet(workbook, headerStyle, resultReport);
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
                .filter(target -> target.getAssignment().getStatus() != ExamAssignmentStatus.ARCHIVED)
                .map(target -> toMyExamResponse(
                        target,
                        attemptsByAssignmentId.getOrDefault(target.getAssignment().getId(), List.of())
                ))
                .toList();
    }

    @Transactional
    public ExamAssignmentResponse create(CreateExamAssignmentRequest request, String actor) {
        if (request == null) {
            throw new BadRequestException("Dữ liệu phân công không hợp lệ");
        }
        String idempotencyKey = trimToNull(request.idempotencyKey());
        if (idempotencyKey == null || idempotencyKey.length() > 160) {
            throw new BadRequestException("Idempotency key là bắt buộc và không được vượt quá 160 ký tự");
        }
        String name = trimToNull(request.name());
        if (name == null) {
            throw new BadRequestException("Vui lòng nhập tên phân công");
        }
        if (request.examPaperId() == null) {
            throw new BadRequestException("Vui lòng chọn bộ đề kiểm tra");
        }
        if (request.availableFrom() != null && request.dueAt() != null
                && !request.availableFrom().isBefore(request.dueAt())) {
            throw new BadRequestException("Thời gian bắt đầu phải sớm hơn hạn nộp");
        }
        ExamPaper examPaper = examPaperRepository.findById(request.examPaperId())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy bộ đề kiểm tra"));
        if (examPaper.getStatus() != ExamPaperStatus.PUBLISHED) {
            throw new BadRequestException("Chỉ được phân công bộ đề đã phát hành");
        }
        List<ExamPaper> publishedVariants = publishedVariants(examPaper);
        ExamAssignmentVariantPolicy variantPolicy = parseVariantPolicy(request.variantPolicy(), publishedVariants.size());
        ExamAssignmentRetakeVariantPolicy retakeVariantPolicy = parseRetakeVariantPolicy(request.retakeVariantPolicy());
        EvaluationAudienceService.ResolvedAudience resolvedAudience = null;
        if (request.audienceId() != null) {
            if (evaluationAudienceService == null) {
                throw new BadRequestException("Audience resolver chưa được cấu hình");
            }
            resolvedAudience = evaluationAudienceService.resolveForAssignment(request.audienceId());
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

        if (resolvedAudience == null && uniqueUserIds.isEmpty() && uniqueDepartmentIds.isEmpty()
                && uniquePositionIds.isEmpty() && uniqueGroupIds.isEmpty() && !allEmployees) {
            throw new BadRequestException("Vui lòng chọn ít nhất một nhân viên, khoa/phòng, chức danh, nhóm hoặc toàn bệnh viện");
        }

        // Track source type for each user
        Map<Long, AssignmentTargetType> targetTypeByUserId = new LinkedHashMap<>();
        Map<Long, Long> sourceIdByUserId = new LinkedHashMap<>();

        if (resolvedAudience != null) {
            uniqueUserIds.addAll(resolvedAudience.userIds());
            uniqueUserIds.forEach(id -> targetTypeByUserId.put(id, AssignmentTargetType.EMPLOYEE));
        }

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

        List<User> users = new ArrayList<>(userRepository.findAllById(uniqueUserIds));
        if (users.size() != uniqueUserIds.size()) {
            throw new BadRequestException("Danh sách nhân viên phân công không hợp lệ");
        }
        users.sort(Comparator.comparing(User::getId));
        String requestHash = assignmentRequestHash(request, users, examPaper, variantPolicy, retakeVariantPolicy);
        ExamAssignment existing = assignmentRepository.findByIdempotencyKey(idempotencyKey).orElse(null);
        if (existing != null) {
            if (!Objects.equals(existing.getRequestHash(), requestHash)) {
                throw new vn.vietduc.carehubbackend.exception.ConflictException(
                        "Idempotency key đã được dùng với payload giao bài khác");
            }
            return toResponse(existing, true);
        }
        ExamAssignmentStatus status = parseCreateStatus(request.status());
        LocalDateTime now = now();
        ExamAssignment assignment = assignmentRepository.save(ExamAssignment.builder()
                .name(name)
                .description(trimToNull(request.description()))
                .idempotencyKey(idempotencyKey)
                .examPaper(examPaper)
                .generationBatch(examPaper.getGenerationBatch())
                .variantPolicy(variantPolicy)
                .retakeVariantPolicy(retakeVariantPolicy)
                .requestHash(requestHash)
                .audience(resolvedAudience == null ? null : resolvedAudience.audience())
                .status(status)
                .availableFrom(request.availableFrom())
                .dueAt(request.dueAt())
                .maxAttempts(clamp(request.maxAttempts() == null ? DEFAULT_MAX_ATTEMPTS : request.maxAttempts(), 1, 10))
                .shuffleQuestions(request.shuffleQuestions() == null || request.shuffleQuestions())
                .shuffleOptions(request.shuffleOptions() == null || request.shuffleOptions())
                .resultVisibility(parseResultVisibility(request.resultVisibility()))
                .createdBy(actor)
                .openedAt(status == ExamAssignmentStatus.OPEN ? now : null)
                .build());
        for (User user : users) {
            AssignmentTargetType targetType = targetTypeByUserId.getOrDefault(user.getId(), AssignmentTargetType.EMPLOYEE);
            Long sourcePositionId = targetType == AssignmentTargetType.POSITION ? sourceIdByUserId.get(user.getId()) : null;
            Long sourceGroupId = targetType == AssignmentTargetType.GROUP ? sourceIdByUserId.get(user.getId()) : null;
            ExamPaper assignedPaper = assignedVariant(assignment, user, publishedVariants, variantPolicy);
            targetRepository.save(ExamAssignmentTarget.builder()
                    .assignment(assignment)
                    .user(user)
                    .assignedExamPaper(assignedPaper)
                    .assignedVariantIndex(assignedPaper.getVariantIndex() == null ? assignedPaper.getVersion() : assignedPaper.getVariantIndex())
                    .variantPolicy(variantPolicy)
                    .audience(resolvedAudience == null ? null : resolvedAudience.audience())
                    .audienceVersion(resolvedAudience == null ? null : resolvedAudience.audience().getVersion())
                    .audienceRuleVersion(resolvedAudience == null ? null : resolvedAudience.audience().getRuleVersion())
                    .matchedRuleJson(resolvedAudience == null ? null : resolvedAudience.ruleJson())
                    .resolvedAt(resolvedAudience == null ? now : now)
                    .targetType(targetType)
                    .sourcePositionId(sourcePositionId)
                    .sourceGroupId(sourceGroupId)
                    .sourceDepartmentId(user.getDepartment() == null ? null : user.getDepartment().getId())
                    .sourceDepartmentName(user.getDepartment() == null ? null : user.getDepartment().getName())
                    .sourcePositionName(user.getPosition() == null ? null : user.getPosition().getName())
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
        boolean targetHasUnpublishedPaper = targetRepository.findByAssignmentOrderByUserEmployeeCodeAsc(assignment).stream()
                .map(target -> target.getAssignedExamPaper() == null ? assignment.getExamPaper() : target.getAssignedExamPaper())
                .anyMatch(paper -> paper.getStatus() != ExamPaperStatus.PUBLISHED);
        if (targetHasUnpublishedPaper) {
            throw new BadRequestException("Có mã đề snapshot cho nhân viên chưa được phát hành");
        }
        assignment.setStatus(ExamAssignmentStatus.OPEN);
        assignment.setOpenedAt(assignment.getOpenedAt() == null ? now() : assignment.getOpenedAt());
        assignment.setClosedAt(null);
        ExamAssignment saved = assignmentRepository.save(assignment);
        if (!wasOpen) {
            targetRepository.findByAssignmentOrderByUserEmployeeCodeAsc(saved).stream()
                    .map(ExamAssignmentTarget::getUser)
                    .forEach(user -> publishExamAssigned(saved, user));
        }
        return toResponse(saved, true);
    }

    @Transactional
    public ExamAssignmentResponse addTargets(Long assignmentId, AddExamAssignmentTargetsRequest request) {
        if (request == null || request.userIds() == null) {
            throw new BadRequestException("Vui lòng chọn nhân viên cần giao bổ sung");
        }
        ExamAssignment assignment = find(assignmentId);
        if (assignment.getStatus() != ExamAssignmentStatus.OPEN) {
            throw new BadRequestException("Chỉ có thể giao bổ sung cho đợt đang mở");
        }
        LocalDateTime now = now();
        if (assignment.getDueAt() != null && !now.isBefore(assignment.getDueAt())) {
            throw new BadRequestException("Đợt giao đề đã quá hạn, không thể giao bổ sung");
        }
        if (assignment.getExamPaper().getStatus() != ExamPaperStatus.PUBLISHED) {
            throw new BadRequestException("Bộ đề của đợt giao chưa được phát hành");
        }

        Set<Long> uniqueUserIds = request.userIds().stream()
                .filter(Objects::nonNull)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        if (uniqueUserIds.isEmpty()) {
            throw new BadRequestException("Vui lòng chọn ít nhất một nhân viên để giao bổ sung");
        }

        Set<Long> assignedUserIds = targetRepository.findByAssignmentOrderByUserEmployeeCodeAsc(assignment).stream()
                .map(target -> target.getUser().getId())
                .collect(Collectors.toSet());
        List<Long> alreadyAssigned = uniqueUserIds.stream()
                .filter(assignedUserIds::contains)
                .toList();
        if (!alreadyAssigned.isEmpty()) {
            throw new ConflictException("Một hoặc nhiều nhân viên đã được giao trong đợt này");
        }

        List<User> users = new ArrayList<>(userRepository.findAllById(uniqueUserIds));
        if (users.size() != uniqueUserIds.size()
                || users.stream().anyMatch(user -> user.isDeleted() || user.getStatus() != UserStatus.ACTIVE)) {
            throw new BadRequestException("Danh sách nhân viên giao bổ sung không hợp lệ hoặc đã ngừng hoạt động");
        }
        users.sort(Comparator.comparing(User::getId));

        List<ExamPaper> publishedVariants = publishedVariants(assignment.getExamPaper());
        ExamAssignmentVariantPolicy variantPolicy = assignment.getVariantPolicy() == null
                ? ExamAssignmentVariantPolicy.FIXED_PAPER
                : assignment.getVariantPolicy();
        List<ExamAssignmentTarget> targets = new ArrayList<>();
        for (User user : users) {
            ExamPaper assignedPaper = assignedVariant(assignment, user, publishedVariants, variantPolicy);
            targets.add(ExamAssignmentTarget.builder()
                    .assignment(assignment)
                    .user(user)
                    .assignedExamPaper(assignedPaper)
                    .assignedVariantIndex(assignedPaper.getVariantIndex() == null
                            ? assignedPaper.getVersion()
                            : assignedPaper.getVariantIndex())
                    .variantPolicy(variantPolicy)
                    .targetType(AssignmentTargetType.EMPLOYEE)
                    .resolvedAt(now)
                    .sourceDepartmentId(user.getDepartment() == null ? null : user.getDepartment().getId())
                    .sourceDepartmentName(user.getDepartment() == null ? null : user.getDepartment().getName())
                    .sourcePositionName(user.getPosition() == null ? null : user.getPosition().getName())
                    .build());
        }
        targetRepository.saveAll(targets);
        users.forEach(user -> publishExamAssigned(assignment, user));
        return toResponse(assignment, true);
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
        assignment.setClosedAt(now());
        return toResponse(assignmentRepository.save(assignment), true);
    }

    @Transactional
    public ExamAssignmentResponse archive(Long assignmentId) {
        ExamAssignment assignment = find(assignmentId);
        assignment.setStatus(ExamAssignmentStatus.ARCHIVED);
        assignment.setClosedAt(assignment.getClosedAt() == null ? now() : assignment.getClosedAt());
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
        List<ExamAttempt> attempts =
                attemptRepository.findByAssignmentOrderByStartedAtDesc(assignment);
        int submittedCount = (int) attempts.stream()
                .filter(attempt -> attempt.getStatus() == ExamAttemptStatus.SUBMITTED || attempt.getStatus() == ExamAttemptStatus.GRADED)
                .count();
        int submittedTargetCount = latestSubmittedTargetCount(attempts);
        return new ExamAssignmentResponse(
                assignment.getId(),
                assignment.getName(),
                assignment.getDescription(),
                assignment.getExamPaper().getId(),
                assignment.getExamPaper().getCode(),
                assignment.getExamPaper().getName(),
                assignment.getGenerationBatch() == null ? null : assignment.getGenerationBatch().getId(),
                (assignment.getVariantPolicy() == null ? ExamAssignmentVariantPolicy.FIXED_PAPER : assignment.getVariantPolicy()).name(),
                (assignment.getRetakeVariantPolicy() == null ? ExamAssignmentRetakeVariantPolicy.KEEP_VARIANT : assignment.getRetakeVariantPolicy()).name(),
                assignment.getAudience() == null ? null : assignment.getAudience().getId(),
                assignment.getAudience() == null ? null : assignment.getAudience().getName(),
                assignment.getStatus().name(),
                QuestionGenerationLabels.examAssignmentStatus(assignment.getStatus()),
                assignment.getAvailableFrom(),
                assignment.getDueAt(),
                assignment.getMaxAttempts(),
                Boolean.TRUE.equals(assignment.getShuffleQuestions()),
                Boolean.TRUE.equals(assignment.getShuffleOptions()),
                resultVisibility.name(),
                QuestionGenerationLabels.examResultVisibility(resultVisibility),
                Math.toIntExact(targetRepository.countByAssignment(assignment)),
                attempts.size(),
                submittedCount,
                submittedTargetCount,
                targets,
                assignment.getOpenedAt(),
                assignment.getClosedAt(),
                assignment.getCreatedAt(),
                assignment.getUpdatedAt()
        );
    }

    /**
     * Assignment progress is employee-based, while attemptCount/submittedCount are
     * attempt-based metrics. Keep both available so the list page does not report
     * values such as 2/2 when one employee has submitted two retakes.
     */
    private int latestSubmittedTargetCount(List<ExamAttempt> attempts) {
        Map<Long, ExamAttempt> latestByUser = new LinkedHashMap<>();
        for (ExamAttempt attempt : attempts) {
            latestByUser.putIfAbsent(attempt.getUser().getId(), attempt);
        }
        return (int) latestByUser.values().stream()
                .filter(attempt -> attempt.getStatus() == ExamAttemptStatus.SUBMITTED
                        || attempt.getStatus() == ExamAttemptStatus.GRADED)
                .count();
    }

    private MyExamAssignmentResponse toMyExamResponse(
            ExamAssignmentTarget target,
            List<ExamAttempt> attempts
    ) {
        ExamAssignment assignment = target.getAssignment();
        ExamPaper assignedPaper = target.getAssignedExamPaper() == null ? assignment.getExamPaper() : target.getAssignedExamPaper();
        Instant serverNow = Instant.now(clock);
        LocalDateTime now = LocalDateTime.ofInstant(serverNow, examBusinessZone);
        ExamAttempt currentAttempt = attempts.stream()
                .filter(attempt -> attempt.getStatus() == ExamAttemptStatus.IN_PROGRESS)
                .filter(attempt -> attempt.getExpiresAt() == null || !now.isAfter(attempt.getExpiresAt()))
                .findFirst()
                .orElse(null);
        ExamAttempt latestAttempt = attempts.stream().findFirst().orElse(null);
        List<ExamAttempt> scoredAttempts = attempts.stream()
                .filter(attempt -> attempt.getScore() != null && attempt.getPassed() != null)
                .toList();
        ExamAttempt bestAttempt = scoredAttempts.stream()
                .max(Comparator.comparing(ExamAttempt::getScore))
                .orElse(null);
        boolean resultsHidden = resultVisibility(assignment) != ExamResultVisibility.SCORE_ONLY
                && !isAssignmentEnded(assignment, now);
        String assessmentStatus = resultsHidden && !scoredAttempts.isEmpty() ? "PENDING"
                : scoredAttempts.isEmpty() ? "NOT_TAKEN"
                : scoredAttempts.stream().anyMatch(attempt -> Boolean.TRUE.equals(attempt.getPassed())) ? "PASSED" : "FAILED";
        int usedAttempts = attempts.size();
        int maxAttempts = assignment.getMaxAttempts() == null
                ? DEFAULT_MAX_ATTEMPTS
                : assignment.getMaxAttempts();
        int remainingAttempts = Math.max(0, maxAttempts - usedAttempts);
        boolean due = assignment.getDueAt() != null && now.isAfter(assignment.getDueAt());
        boolean upcoming = assignment.getAvailableFrom() != null && now.isBefore(assignment.getAvailableFrom());
        boolean canStartNew = assignment.getStatus() == ExamAssignmentStatus.OPEN
                && !due
                && !upcoming
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
        } else if (assignment.getStatus() == ExamAssignmentStatus.OPEN && upcoming) {
            availabilityStatus = "UPCOMING";
            availabilityText = "Chưa đến giờ làm";
            actionLabel = "Chưa đến giờ";
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
        BigDecimal passingScore = BigDecimal.valueOf(assignedPaper.getPassingScore());
        if (passingScore.compareTo(BigDecimal.TEN) > 0) {
            passingScore = passingScore.divide(BigDecimal.TEN, 2, RoundingMode.HALF_UP);
        }

        return new MyExamAssignmentResponse(
                assignment.getId(),
                assignment.getName(),
                assignment.getDescription(),
                assignedPaper.getId(),
                assignedPaper.getCode(),
                assignedPaper.getName(),
                passingScore,
                target.getAssignedVariantIndex() == null ? assignedPaper.getVariantIndex() : target.getAssignedVariantIndex(),
                (assignment.getRetakeVariantPolicy() == null
                        ? ExamAssignmentRetakeVariantPolicy.KEEP_VARIANT
                        : assignment.getRetakeVariantPolicy()).name(),
                assignment.getStatus().name(),
                QuestionGenerationLabels.examAssignmentStatus(assignment.getStatus()),
                assignment.getAvailableFrom(),
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
                currentAttempt == null ? null : toInstant(currentAttempt.getExpiresAt()),
                currentAttempt == null || currentAttempt.getExpiresAt() == null
                        ? null
                        : Math.max(0L, java.time.Duration.between(
                                serverNow,
                                toInstant(currentAttempt.getExpiresAt())
                        ).getSeconds()),
                availabilityStatus,
                availabilityText,
                actionLabel,
                actionable,
                // Điểm đã ở thang 0-10 (ExamAttemptService.gradeAttempt) — trả nguyên, không chia lại.
                resultsHidden || bestAttempt == null ? null : bestAttempt.getScore(),
                assessmentStatus,
                resultsHidden
                        ? null
                        : bestAttempt == null ? (currentAttempt == null ? null : currentAttempt.getId()) : bestAttempt.getId()
        );
    }

    private ExamAssignmentTargetResponse toTargetResponse(ExamAssignmentTarget target) {
        User user = target.getUser();
        return new ExamAssignmentTargetResponse(
                user.getId(),
                user.getEmployeeCode(),
                user.getName(),
                user.getDepartment() == null ? null : user.getDepartment().getName(),
                target.getAssignedExamPaper() == null ? target.getAssignment().getExamPaper().getId() : target.getAssignedExamPaper().getId(),
                target.getAssignedExamPaper() == null ? target.getAssignment().getExamPaper().getCode() : target.getAssignedExamPaper().getCode(),
                target.getAssignedVariantIndex()
        );
    }

    /**
     * Compatibility shim for internal callers compiled before Phase 6. A test
     * or endpoint may still pass a field, but assignment retrieval must never
     * filter a multi-field exam by the legacy single-field column.
     */
    @Deprecated
    public List<ExamAssignmentResponse> list(String query, String status, Long ignoredProfessionalFieldId) {
        return list(query, status);
    }

    private LocalDateTime now() {
        return LocalDateTime.now(clock.withZone(examBusinessZone));
    }

    private Instant toInstant(LocalDateTime value) {
        return value == null ? null : value.atZone(examBusinessZone).toInstant();
    }

    private ExamAssignmentResultRowResponse toResultRow(ExamAssignmentTarget target, List<ExamAttempt> attempts) {
        User user = target.getUser();
        ExamAttempt latest = attempts.stream()
                .max(Comparator.comparing(ExamAttempt::getStartedAt, Comparator.nullsLast(Comparator.naturalOrder())))
                .orElse(null);
        // Chỉ số CHÍNH thống nhất với màn hình nhân viên (toMyExamResponse): điểm tốt nhất
        // trên các lượt đã chấm (có cả score và passed) — điểm này dùng để xét đạt/không đạt.
        List<ExamAttempt> scoredAttempts = attempts.stream()
                .filter(attempt -> attempt.getScore() != null && attempt.getPassed() != null)
                .toList();
        ExamAttempt best = scoredAttempts.stream()
                .max(Comparator.comparing(ExamAttempt::getScore))
                .orElse(null);
        // Giống assessmentStatus của nhân viên: đạt nếu có bất kỳ lượt đã chấm nào đạt.
        Boolean bestPassed = scoredAttempts.isEmpty()
                ? null
                : scoredAttempts.stream().anyMatch(attempt -> Boolean.TRUE.equals(attempt.getPassed()));
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
                bestPassed,
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

    private List<ExamPaper> publishedVariants(ExamPaper selectedPaper) {
        if (selectedPaper.getGenerationBatch() == null) {
            return List.of(selectedPaper);
        }
        List<ExamPaper> variants = examPaperRepository
                .findByGenerationBatchOrderByVariantIndexAsc(selectedPaper.getGenerationBatch()).stream()
                .filter(paper -> paper.getStatus() == ExamPaperStatus.PUBLISHED)
                .sorted(Comparator.comparing(paper -> paper.getVariantIndex() == null ? paper.getVersion() : paper.getVariantIndex()))
                .toList();
        if (variants.isEmpty() || variants.stream().noneMatch(paper -> Objects.equals(paper.getId(), selectedPaper.getId()))) {
            throw new BadRequestException("Mã đề được chọn không thuộc một batch đã phát hành hợp lệ");
        }
        return variants;
    }

    private ExamAssignmentVariantPolicy parseVariantPolicy(String value, int variantCount) {
        if (variantCount < 2) {
            return ExamAssignmentVariantPolicy.FIXED_PAPER;
        }
        if (value == null || value.isBlank()) {
            return ExamAssignmentVariantPolicy.STABLE_USER_HASH;
        }
        try {
            return ExamAssignmentVariantPolicy.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            throw new BadRequestException("Chính sách phân phối mã đề không hợp lệ");
        }
    }

    /**
     * These worksheets deliberately use the immutable field snapshots from graded attempts,
     * so a later taxonomy rename cannot rewrite an exported historical report.
     */
    private void writeFieldResultSheet(
            Workbook workbook,
            CellStyle headerStyle,
            EvaluationResultReportResponse resultReport
    ) {
        Sheet sheet = workbook.createSheet("Theo lĩnh vực");
        Row header = sheet.createRow(0);
        List<String> headers = List.of(
                "Mã lĩnh vực (snapshot)", "Lĩnh vực (snapshot)", "Đúng", "Tổng câu",
                "Điểm trung bình", "Đạt ngưỡng", "Số lượt đánh giá"
        );
        for (int index = 0; index < headers.size(); index++) {
            header.createCell(index).setCellValue(headers.get(index));
            header.getCell(index).setCellStyle(headerStyle);
        }
        int rowIndex = 1;
        for (EvaluationResultReportResponse.FieldCoverage field : resultReport.fields()) {
            Row row = sheet.createRow(rowIndex++);
            row.createCell(0).setCellValue(blank(field.professionalFieldCode()));
            row.createCell(1).setCellValue(blank(field.professionalFieldName()));
            row.createCell(2).setCellValue(field.correctCount());
            row.createCell(3).setCellValue(field.totalQuestions());
            row.createCell(4).setCellValue(field.averageScore() == null ? "" : field.averageScore().toPlainString());
            row.createCell(5).setCellValue(field.passedAttempts() + "/" + field.evaluatedAttempts());
            row.createCell(6).setCellValue(field.evaluatedAttempts());
        }
        for (int index = 0; index < headers.size(); index++) {
            sheet.autoSizeColumn(index);
        }
    }

    private void writeFieldCognitiveResultSheet(
            Workbook workbook,
            CellStyle headerStyle,
            EvaluationResultReportResponse resultReport
    ) {
        Sheet sheet = workbook.createSheet("Lĩnh vực × nhận thức");
        Row header = sheet.createRow(0);
        List<String> headers = List.of(
                "Mã lĩnh vực (snapshot)", "Lĩnh vực (snapshot)", "Mức nhận thức",
                "Đúng", "Tổng câu", "Số lượt đánh giá", "Ghi chú"
        );
        for (int index = 0; index < headers.size(); index++) {
            header.createCell(index).setCellValue(headers.get(index));
            header.getCell(index).setCellStyle(headerStyle);
        }
        int rowIndex = 1;
        for (EvaluationResultReportResponse.CellCoverage cell : resultReport.cells()) {
            Row row = sheet.createRow(rowIndex++);
            row.createCell(0).setCellValue(blank(cell.professionalFieldCode()));
            row.createCell(1).setCellValue(blank(cell.professionalFieldName()));
            row.createCell(2).setCellValue(blank(cell.cognitiveLabel()));
            row.createCell(3).setCellValue(cell.correctCount());
            row.createCell(4).setCellValue(cell.totalQuestions());
            row.createCell(5).setCellValue(cell.evaluatedAttempts());
            row.createCell(6).setCellValue(cell.smallSample()
                    ? "Mẫu nhỏ (≤ 1 câu/lượt), chỉ tham khảo"
                    : "Đủ mẫu");
        }
        for (int index = 0; index < headers.size(); index++) {
            sheet.autoSizeColumn(index);
        }
    }

    private ExamAssignmentRetakeVariantPolicy parseRetakeVariantPolicy(String value) {
        if (value == null || value.isBlank()) {
            return ExamAssignmentRetakeVariantPolicy.KEEP_VARIANT;
        }
        try {
            return ExamAssignmentRetakeVariantPolicy.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            throw new BadRequestException("Chính sách mã đề khi thi lại không hợp lệ");
        }
    }

    private ExamPaper assignedVariant(
            ExamAssignment assignment,
            User user,
            List<ExamPaper> variants,
            ExamAssignmentVariantPolicy policy
    ) {
        if (policy == ExamAssignmentVariantPolicy.FIXED_PAPER || variants.size() == 1) {
            return assignment.getExamPaper();
        }
        int index = Math.floorMod(stableHash(assignment.getId(), user.getId()), variants.size());
        return variants.get(index);
    }

    private int stableHash(Long assignmentId, Long userId) {
        long value = (assignmentId == null ? 0L : assignmentId) * 0x9E3779B97F4A7C15L
                ^ (userId == null ? 0L : userId) * 0xBF58476D1CE4E5B9L;
        value ^= value >>> 30;
        value *= 0xBF58476D1CE4E5B9L;
        value ^= value >>> 27;
        return (int) (value ^ (value >>> 31));
    }

    private String assignmentRequestHash(
            CreateExamAssignmentRequest request,
            List<User> users,
            ExamPaper paper,
            ExamAssignmentVariantPolicy variantPolicy,
            ExamAssignmentRetakeVariantPolicy retakeVariantPolicy
    ) {
        String targets = users.stream().map(User::getId).sorted().map(String::valueOf).collect(Collectors.joining(","));
        String canonical = String.join("|",
                blank(trimToNull(request.name())),
                blank(trimToNull(request.description())),
                String.valueOf(paper.getId()),
                String.valueOf(request.audienceId()),
                targets,
                String.valueOf(request.availableFrom()),
                String.valueOf(request.dueAt()),
                String.valueOf(request.maxAttempts()),
                String.valueOf(request.shuffleQuestions()),
                String.valueOf(request.shuffleOptions()),
                blank(trimToNull(request.resultVisibility())),
                blank(trimToNull(request.status())),
                variantPolicy.name(),
                retakeVariantPolicy.name());
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(canonical.getBytes(StandardCharsets.UTF_8));
            StringBuilder value = new StringBuilder(digest.length * 2);
            for (byte item : digest) value.append(String.format("%02x", item));
            return value.toString();
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
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

    boolean isAssignmentEnded(ExamAssignment assignment, LocalDateTime now) {
        if (assignment == null) {
            return true;
        }
        if (assignment.getStatus() == ExamAssignmentStatus.CLOSED
                || assignment.getStatus() == ExamAssignmentStatus.ARCHIVED) {
            return true;
        }
        return assignment.getDueAt() != null && !now.isBefore(assignment.getDueAt());
    }

    ExamPaper paperForAttempt(ExamAssignment assignment, ExamAssignmentTarget target, int attemptNumber) {
        ExamPaper baseline = target.getAssignedExamPaper() == null ? assignment.getExamPaper() : target.getAssignedExamPaper();
        if (assignment.getRetakeVariantPolicy() != ExamAssignmentRetakeVariantPolicy.ROTATE_VARIANT
                || assignment.getGenerationBatch() == null
                || attemptNumber <= 1) {
            return baseline;
        }
        List<ExamPaper> variants = examPaperRepository
                .findByGenerationBatchOrderByVariantIndexAsc(assignment.getGenerationBatch()).stream()
                .filter(paper -> paper.getStatus() == ExamPaperStatus.PUBLISHED)
                .sorted(Comparator.comparing(paper -> paper.getVariantIndex() == null ? paper.getVersion() : paper.getVariantIndex()))
                .toList();
        if (variants.isEmpty()) {
            throw new BadRequestException("Batch mã đề không còn mã đã phát hành để thi lại");
        }
        int baselineIndex = 0;
        for (int index = 0; index < variants.size(); index++) {
            if (Objects.equals(variants.get(index).getId(), baseline.getId())) {
                baselineIndex = index;
                break;
            }
        }
        return variants.get((baselineIndex + attemptNumber - 1) % variants.size());
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
