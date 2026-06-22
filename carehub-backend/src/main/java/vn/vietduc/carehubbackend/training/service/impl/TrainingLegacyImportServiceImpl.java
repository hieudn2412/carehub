package vn.vietduc.carehubbackend.training.service.impl;

import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.DateUtil;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import vn.vietduc.carehubbackend.exception.BadRequestException;
import vn.vietduc.carehubbackend.exception.ResourceNotFoundException;
import vn.vietduc.carehubbackend.training.dto.request.TrainingImportApplyRequest;
import vn.vietduc.carehubbackend.training.dto.response.TrainingDurationParseResponse;
import vn.vietduc.carehubbackend.training.dto.response.TrainingImportBatchResponse;
import vn.vietduc.carehubbackend.training.dto.response.TrainingImportRowResponse;
import vn.vietduc.carehubbackend.training.entity.ProfessionalField;
import vn.vietduc.carehubbackend.training.entity.TrainingActivityType;
import vn.vietduc.carehubbackend.training.entity.TrainingEvidenceFile;
import vn.vietduc.carehubbackend.training.entity.TrainingImportBatch;
import vn.vietduc.carehubbackend.training.entity.TrainingImportRow;
import vn.vietduc.carehubbackend.training.entity.TrainingRecord;
import vn.vietduc.carehubbackend.training.enums.DurationUnit;
import vn.vietduc.carehubbackend.training.enums.EvidenceModerationStatus;
import vn.vietduc.carehubbackend.training.enums.TrainingImportBatchStatus;
import vn.vietduc.carehubbackend.training.enums.TrainingImportRowStatus;
import vn.vietduc.carehubbackend.training.enums.TrainingRecordChangeType;
import vn.vietduc.carehubbackend.training.enums.TrainingRecordStatus;
import vn.vietduc.carehubbackend.training.enums.TrainingSourceType;
import vn.vietduc.carehubbackend.training.repository.ProfessionalFieldRepository;
import vn.vietduc.carehubbackend.training.repository.TrainingActivityTypeRepository;
import vn.vietduc.carehubbackend.training.repository.TrainingEvidenceFileRepository;
import vn.vietduc.carehubbackend.training.repository.TrainingImportBatchRepository;
import vn.vietduc.carehubbackend.training.repository.TrainingImportRowRepository;
import vn.vietduc.carehubbackend.training.repository.TrainingRecordRepository;
import vn.vietduc.carehubbackend.training.service.TrainingAccessPolicy;
import vn.vietduc.carehubbackend.training.service.TrainingAuditService;
import vn.vietduc.carehubbackend.training.service.TrainingLegacyDurationParser;
import vn.vietduc.carehubbackend.training.service.TrainingLegacyImportService;
import vn.vietduc.carehubbackend.user.entity.User;
import vn.vietduc.carehubbackend.user.repository.UserRepository;

import java.io.IOException;
import java.math.BigDecimal;
import java.text.Normalizer;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TrainingLegacyImportServiceImpl implements TrainingLegacyImportService {
    private static final Set<String> TIMESTAMP_HEADERS = Set.of("dauthoigian", "timestamp", "thoigiangui");
    private static final Set<String> EMPLOYEE_CODE_HEADERS = Set.of("mavd", "manhanvien", "manv");
    private static final Set<String> FULL_NAME_HEADERS = Set.of("hovaten", "hoten");
    private static final Set<String> BIRTH_DATE_HEADERS = Set.of("ngaythangnamsinh", "ngaysinh");
    private static final Set<String> TITLE_HEADERS = Set.of("chuongtrinhdaotao", "chuongtrinh");
    private static final Set<String> TRAINING_DATE_HEADERS = Set.of("thoigiandaotao", "ngaydaotao");
    private static final Set<String> DURATION_HEADERS = Set.of("sotietdaotao", "thoiluong", "sogiodaotao");
    private static final Set<String> EVIDENCE_HEADERS = Set.of("giaychungnhan", "minhchung", "evidence");
    private static final Set<String> JOB_TITLE_HEADERS = Set.of("chucdanh", "vitri", "position");
    private static final List<DateTimeFormatter> DATE_FORMATS = List.of(
            DateTimeFormatter.ISO_LOCAL_DATE,
            DateTimeFormatter.ofPattern("d/M/uuuu"),
            DateTimeFormatter.ofPattern("d-M-uuuu"),
            DateTimeFormatter.ofPattern("M/d/uuuu"),
            DateTimeFormatter.ofPattern("M-d-uuuu")
    );
    private static final List<DateTimeFormatter> DATE_TIME_FORMATS = List.of(
            DateTimeFormatter.ISO_LOCAL_DATE_TIME,
            DateTimeFormatter.ofPattern("d/M/uuuu H:mm:ss"),
            DateTimeFormatter.ofPattern("d/M/uuuu H:mm"),
            DateTimeFormatter.ofPattern("M/d/uuuu H:mm:ss"),
            DateTimeFormatter.ofPattern("M/d/uuuu H:mm")
    );

    private final TrainingImportBatchRepository batchRepository;
    private final TrainingImportRowRepository rowRepository;
    private final TrainingActivityTypeRepository activityTypeRepository;
    private final ProfessionalFieldRepository professionalFieldRepository;
    private final UserRepository userRepository;
    private final TrainingRecordRepository recordRepository;
    private final TrainingEvidenceFileRepository evidenceFileRepository;
    private final TrainingAccessPolicy accessPolicy;
    private final TrainingAuditService auditService;
    private final TrainingLegacyDurationParser durationParser;

    @Override
    @Transactional
    public TrainingImportBatchResponse createPreview(
            MultipartFile file,
            Long activityTypeId,
            Long professionalFieldId
    ) throws IOException {
        validateUpload(file);
        TrainingActivityType activityType = findActiveActivityType(activityTypeId);
        ProfessionalField professionalField = professionalFieldId == null ? null : professionalFieldRepository.findById(professionalFieldId)
                .orElseThrow(() -> new ResourceNotFoundException("Professional field not found"));
        User actor = accessPolicy.currentActor();
        Set<String> roleCodes = accessPolicy.currentRoleCodes();
        List<SourceRow> sourceRows = readSourceRows(file);
        if (sourceRows.isEmpty()) {
            throw new BadRequestException("Excel file does not contain data rows");
        }

        Map<String, User> usersByCode = loadUsersByNormalizedCode(sourceRows);
        TrainingImportBatch batch = batchRepository.save(TrainingImportBatch.builder()
                .originalFilename(limit(file.getOriginalFilename(), 500, "legacy-training-import.xlsx"))
                .status(TrainingImportBatchStatus.PROCESSING)
                .totalRows(sourceRows.size())
                .importedByUser(actor)
                .importedAt(LocalDateTime.now())
                .build());

        List<TrainingImportRow> rows = new ArrayList<>();
        for (SourceRow sourceRow : sourceRows) {
            rows.add(validateRow(batch, sourceRow, usersByCode, actor, roleCodes, activityType, professionalField));
        }
        rowRepository.saveAll(rows);
        updatePreviewSummary(batch, rows);
        return toResponse(batchRepository.save(batch), rows);
    }

    @Override
    @Transactional
    public TrainingImportBatchResponse apply(Long batchId, TrainingImportApplyRequest request) {
        TrainingImportBatch batch = batchRepository.findById(batchId)
                .orElseThrow(() -> new ResourceNotFoundException("Training import batch not found"));
        User actor = accessPolicy.currentActor();
        Set<String> roleCodes = accessPolicy.currentRoleCodes();
        List<TrainingImportRow> rows = rowRepository.findByImportBatch_IdOrderBySourceRowNumberAsc(batchId);
        TrainingImportApplyRequest applyRequest = request == null ? new TrainingImportApplyRequest(false, Set.of()) : request;

        for (TrainingImportRow row : rows) {
            if (row.getValidationStatus() == TrainingImportRowStatus.IMPORTED) {
                continue;
            }
            if (row.getValidationStatus() == TrainingImportRowStatus.INVALID) {
                continue;
            }
            boolean shouldImport = row.getValidationStatus() == TrainingImportRowStatus.VALID
                    || (row.getValidationStatus() == TrainingImportRowStatus.WARNING
                    && applyRequest.shouldCommitWarning(row.getId()));
            if (!shouldImport) {
                continue;
            }

            TrainingRecord record = createRecordFromRow(row, actor, roleCodes);
            row.setTrainingRecord(record);
            row.setValidationStatus(TrainingImportRowStatus.IMPORTED);
        }

        rowRepository.saveAll(rows);
        updateApplySummary(batch, rows);
        return toResponse(batchRepository.save(batch), rows);
    }

    @Override
    @Transactional(readOnly = true)
    public TrainingImportBatchResponse get(Long batchId) {
        TrainingImportBatch batch = batchRepository.findById(batchId)
                .orElseThrow(() -> new ResourceNotFoundException("Training import batch not found"));
        return toResponse(batch, rowRepository.findByImportBatch_IdOrderBySourceRowNumberAsc(batchId));
    }

    @Override
    @Transactional(readOnly = true)
    public Page<TrainingImportBatchResponse> list(Pageable pageable) {
        return batchRepository.findAllByOrderByImportedAtDesc(pageable)
                .map(batch -> toResponse(batch, List.of()));
    }

    @Override
    public TrainingDurationParseResponse parseDuration(String rawText) {
        return durationParser.parse(rawText);
    }

    private TrainingRecord createRecordFromRow(TrainingImportRow row, User actor, Set<String> roleCodes) {
        Map<String, Object> data = row.getNormalizedData();
        Long employeeId = longValue(data.get("employeeId"));
        Long activityTypeId = longValue(data.get("activityTypeId"));
        Long professionalFieldId = longValue(data.get("professionalFieldId"));
        User employee = userRepository.findById(employeeId)
                .orElseThrow(() -> new ResourceNotFoundException("Employee not found"));
        if (!accessPolicy.canCreateRecordFor(actor, roleCodes, employee)) {
            throw new BadRequestException("Import row is outside your employee scope: row " + row.getSourceRowNumber());
        }
        TrainingActivityType activityType = findActiveActivityType(activityTypeId);
        ProfessionalField professionalField = professionalFieldId == null ? null : professionalFieldRepository.findById(professionalFieldId)
                .orElseThrow(() -> new ResourceNotFoundException("Professional field not found"));

        TrainingRecord record = TrainingRecord.builder()
                .employee(employee)
                .employeeDepartmentSnapshot(employee.getDepartment())
                .activityType(activityType)
                .professionalField(professionalField)
                .title(requiredString(data, "title"))
                .provider("Legacy Excel Import")
                .description("Imported from legacy Excel row " + row.getSourceRowNumber())
                .startDate(LocalDate.parse(requiredString(data, "startDate")))
                .endDate(LocalDate.parse(requiredString(data, "endDate")))
                .durationValue(bigDecimalValue(data.get("durationValue")))
                .durationUnit(DurationUnit.valueOf(requiredString(data, "durationUnit")))
                .durationRawText(stringValue(data.get("durationRawText")))
                .declaredHours(bigDecimalValue(data.get("declaredHours")))
                .workflowStatus(TrainingRecordStatus.PENDING_REVIEW)
                .sourceType(TrainingSourceType.LEGACY_IMPORT)
                .sourceReference("training-import-row-" + row.getId())
                .sourceSubmittedAt(localDateTimeValue(data.get("sourceSubmittedAt")))
                .importBatch(row.getImportBatch())
                .createdByUser(actor)
                .updatedByUser(actor)
                .build();
        TrainingRecord saved = recordRepository.save(record);

        String legacyExternalUrl = stringValue(data.get("legacyExternalUrl"));
        if (legacyExternalUrl != null && !legacyExternalUrl.isBlank()) {
            evidenceFileRepository.save(TrainingEvidenceFile.builder()
                    .trainingRecord(saved)
                    .originalFilename(limit(fileNameFromUrl(legacyExternalUrl), 500, "legacy-external-evidence"))
                    .objectKey(null)
                    .legacyExternalUrl(legacyExternalUrl)
                    .moderationStatus(EvidenceModerationStatus.NOT_REQUESTED)
                    .moderationResult(Map.of(
                            "source", "LEGACY_EXTERNAL_URL",
                            "available", Boolean.TRUE.equals(data.get("legacyEvidenceAvailable"))
                    ))
                    .uploadedByUser(actor)
                    .uploadedAt(LocalDateTime.now())
                    .active(true)
                    .build());
        }

        auditService.logRecordChange(
                saved,
                TrainingRecordChangeType.CREATED,
                null,
                Map.of(
                        "sourceType", TrainingSourceType.LEGACY_IMPORT.name(),
                        "importBatchId", row.getImportBatch().getId(),
                        "importRowId", row.getId()
                ),
                actor
        );
        return saved;
    }

    private TrainingImportRow validateRow(
            TrainingImportBatch batch,
            SourceRow sourceRow,
            Map<String, User> usersByCode,
            User actor,
            Set<String> roleCodes,
            TrainingActivityType activityType,
            ProfessionalField professionalField
    ) {
        List<String> errors = new ArrayList<>();
        List<String> warnings = new ArrayList<>();
        Map<String, Object> raw = sourceRow.rawData();
        Map<String, Object> normalized = new LinkedHashMap<>();

        String employeeCodeRaw = stringValue(raw.get("employeeCode"));
        String normalizedEmployeeCode = normalizeEmployeeCode(employeeCodeRaw);
        normalized.put("employeeCode", normalizedEmployeeCode);
        User employee = usersByCode.get(normalizedEmployeeCode);
        if (normalizedEmployeeCode.isBlank()) {
            errors.add("Employee code is missing");
        } else if (!looksLikeEmployeeCode(normalizedEmployeeCode)) {
            errors.add("Employee code does not look like an official VD code");
        } else if (employee == null) {
            errors.add("Employee code does not match an active employee");
        } else if (!accessPolicy.canCreateRecordFor(actor, roleCodes, employee)) {
            errors.add("Employee is outside your import scope");
        } else {
            normalized.put("employeeId", employee.getId());
            normalized.put("employeeName", employee.getName());
            normalized.put("departmentId", employee.getDepartment() == null ? null : employee.getDepartment().getId());
            normalized.put("departmentName", employee.getDepartment() == null ? null : employee.getDepartment().getName());
            normalized.put("jobPositionId", employee.getPosition() == null ? null : employee.getPosition().getId());
            normalized.put("jobPositionName", employee.getPosition() == null ? null : employee.getPosition().getName());
            compareSnapshot(raw, employee, warnings);
        }

        String title = normalizeWhitespace(stringValue(raw.get("title")));
        if (title == null || title.isBlank()) {
            errors.add("Training program title is missing");
        } else {
            normalized.put("title", limit(title, 500, title));
        }

        LocalDate trainingDate = parseDate(stringValue(raw.get("trainingDate")));
        if (trainingDate == null) {
            errors.add("Training date is missing or invalid");
        } else if (isTrainingDateOutOfRange(trainingDate)) {
            errors.add("Training date is outside the accepted legacy migration range");
        } else {
            normalized.put("startDate", trainingDate.toString());
            normalized.put("endDate", trainingDate.toString());
        }

        LocalDateTime sourceSubmittedAt = parseDateTime(stringValue(raw.get("sourceSubmittedAt")));
        if (sourceSubmittedAt != null) {
            normalized.put("sourceSubmittedAt", sourceSubmittedAt.toString());
        }

        addBirthDateWarning(raw, warnings);
        addDuration(sourceRow, normalized, errors, warnings);
        addEvidence(raw, normalized, warnings);

        normalized.put("activityTypeId", activityType.getId());
        normalized.put("activityTypeName", activityType.getName());
        if (professionalField != null) {
            normalized.put("professionalFieldId", professionalField.getId());
            normalized.put("professionalFieldName", professionalField.getName());
        }
        addDuplicateWarning(normalized, employee, title, trainingDate, warnings);

        TrainingImportRowStatus rowStatus = !errors.isEmpty()
                ? TrainingImportRowStatus.INVALID
                : warnings.isEmpty() ? TrainingImportRowStatus.VALID : TrainingImportRowStatus.WARNING;
        return TrainingImportRow.builder()
                .importBatch(batch)
                .sourceRowNumber(sourceRow.rowNumber())
                .rawData(raw)
                .normalizedData(normalized)
                .validationStatus(rowStatus)
                .validationMessages(messages(errors, warnings))
                .build();
    }

    private void addDuration(
            SourceRow sourceRow,
            Map<String, Object> normalized,
            List<String> errors,
            List<String> warnings
    ) {
        String rawDuration = stringValue(sourceRow.rawData().get("duration"));
        TrainingDurationParseResponse parsed = durationParser.parse(rawDuration);
        normalized.put("durationRawText", rawDuration);
        normalized.put("durationConfidence", parsed.confidence());
        normalized.put("durationWarnings", parsed.warningMessages());
        if (!parsed.parsed()) {
            errors.addAll(parsed.warningMessages());
            return;
        }
        normalized.put("durationValue", parsed.parsedValue());
        normalized.put("durationUnit", parsed.parsedUnit().name());
        normalized.put("declaredHours", parsed.normalizedHours());
        if (!parsed.warningMessages().isEmpty()) {
            warnings.addAll(parsed.warningMessages());
        }
        if (!parsed.autoCommittable()) {
            warnings.add("Duration requires manager confirmation before import");
        }
    }

    private void addEvidence(Map<String, Object> raw, Map<String, Object> normalized, List<String> warnings) {
        String evidenceUrl = normalizeWhitespace(stringValue(raw.get("legacyEvidenceUrl")));
        if (evidenceUrl == null || evidenceUrl.isBlank()) {
            warnings.add("Record has no legacy evidence URL");
            normalized.put("legacyEvidenceAvailable", false);
            return;
        }
        normalized.put("legacyExternalUrl", evidenceUrl);
        boolean validUrl = evidenceUrl.startsWith("http://") || evidenceUrl.startsWith("https://");
        boolean googleDrive = evidenceUrl.toLowerCase(Locale.ROOT).contains("drive.google.com");
        normalized.put("legacyEvidenceAvailable", validUrl);
        if (!validUrl) {
            warnings.add("Legacy evidence link is not a valid URL and is marked unavailable");
        } else if (googleDrive) {
            warnings.add("Google Drive URL will be stored as legacyExternalUrl only");
        }
    }

    private void addDuplicateWarning(
            Map<String, Object> normalized,
            User employee,
            String title,
            LocalDate trainingDate,
            List<String> warnings
    ) {
        BigDecimal declaredHours = bigDecimalValue(normalized.get("declaredHours"));
        if (employee == null || title == null || trainingDate == null || declaredHours == null) {
            return;
        }
        long duplicateCount = recordRepository.countDuplicateCandidates(
                employee.getId(),
                title,
                trainingDate,
                declaredHours
        );
        if (duplicateCount > 0) {
            normalized.put("duplicateCandidate", true);
            warnings.add("Candidate duplicate found for same employee, title, date, and duration");
        } else {
            normalized.put("duplicateCandidate", false);
        }
    }

    private void compareSnapshot(Map<String, Object> raw, User employee, List<String> warnings) {
        String fullName = normalizeWhitespace(stringValue(raw.get("fullName")));
        if (fullName == null || fullName.isBlank()) {
            warnings.add("Full name snapshot is missing");
        } else if (employee.getName() != null && !normalizeHumanName(fullName).equals(normalizeHumanName(employee.getName()))) {
            warnings.add("Full name snapshot differs from employee master data");
        }

        String jobTitle = normalizeWhitespace(stringValue(raw.get("jobTitle")));
        if (jobTitle != null && !jobTitle.isBlank()
                && employee.getPosition() != null
                && employee.getPosition().getName() != null
                && !normalizeHumanName(jobTitle).equals(normalizeHumanName(employee.getPosition().getName()))) {
            warnings.add("Job title snapshot differs from employee position");
        }
    }

    private void addBirthDateWarning(Map<String, Object> raw, List<String> warnings) {
        String birthDateText = stringValue(raw.get("birthDate"));
        if (birthDateText == null || birthDateText.isBlank()) {
            return;
        }
        LocalDate birthDate = parseDate(birthDateText);
        if (birthDate == null || birthDate.getYear() < 1900 || birthDate.isAfter(LocalDate.now())) {
            warnings.add("Birth date snapshot looks invalid");
        }
    }

    private Map<String, User> loadUsersByNormalizedCode(List<SourceRow> sourceRows) {
        Set<String> employeeCodes = sourceRows.stream()
                .map(row -> normalizeEmployeeCode(stringValue(row.rawData().get("employeeCode"))))
                .filter(code -> !code.isBlank())
                .collect(Collectors.toSet());
        if (employeeCodes.isEmpty()) {
            return Map.of();
        }
        return userRepository.findActiveByNormalizedEmployeeCodes(employeeCodes)
                .stream()
                .collect(Collectors.toMap(user -> user.getEmployeeCode().toUpperCase(Locale.ROOT), Function.identity()));
    }

    private List<SourceRow> readSourceRows(MultipartFile file) throws IOException {
        try (Workbook workbook = WorkbookFactory.create(file.getInputStream())) {
            Sheet sheet = workbook.getSheetAt(0);
            Row headerRow = sheet.getRow(sheet.getFirstRowNum());
            if (headerRow == null) {
                return List.of();
            }
            Map<String, Integer> headers = readHeaderMap(headerRow);
            DataFormatter formatter = new DataFormatter();
            List<SourceRow> rows = new ArrayList<>();
            for (int index = sheet.getFirstRowNum() + 1; index <= sheet.getLastRowNum(); index++) {
                Row row = sheet.getRow(index);
                if (row == null || isBlankRow(row, formatter)) {
                    continue;
                }
                rows.add(new SourceRow(index + 1, readRawData(row, headers, formatter)));
            }
            return rows;
        } catch (RuntimeException exception) {
            throw new BadRequestException("Cannot read Excel file: " + exception.getMessage());
        }
    }

    private Map<String, Integer> readHeaderMap(Row headerRow) {
        Map<String, Integer> headers = new HashMap<>();
        for (Cell cell : headerRow) {
            String key = normalizeHeader(cell.getStringCellValue());
            if (!key.isBlank()) {
                headers.put(key, cell.getColumnIndex());
            }
        }
        return headers;
    }

    private Map<String, Object> readRawData(Row row, Map<String, Integer> headers, DataFormatter formatter) {
        Map<String, Object> raw = new LinkedHashMap<>();
        raw.put("sourceSubmittedAt", cellValue(row, findHeader(headers, TIMESTAMP_HEADERS), formatter));
        raw.put("employeeCode", cellValue(row, findHeader(headers, EMPLOYEE_CODE_HEADERS), formatter));
        raw.put("fullName", cellValue(row, findHeader(headers, FULL_NAME_HEADERS), formatter));
        raw.put("birthDate", cellValue(row, findHeader(headers, BIRTH_DATE_HEADERS), formatter));
        raw.put("title", cellValue(row, findHeader(headers, TITLE_HEADERS), formatter));
        raw.put("trainingDate", cellValue(row, findHeader(headers, TRAINING_DATE_HEADERS), formatter));
        raw.put("duration", cellValue(row, findHeader(headers, DURATION_HEADERS), formatter));
        raw.put("legacyEvidenceUrl", cellValue(row, findHeader(headers, EVIDENCE_HEADERS), formatter));
        raw.put("jobTitle", cellValue(row, findHeader(headers, JOB_TITLE_HEADERS), formatter));
        return raw;
    }

    private Integer findHeader(Map<String, Integer> headers, Collection<String> aliases) {
        return aliases.stream().map(headers::get).filter(Objects::nonNull).findFirst().orElse(null);
    }

    private String cellValue(Row row, Integer columnIndex, DataFormatter formatter) {
        if (columnIndex == null) {
            return "";
        }
        Cell cell = row.getCell(columnIndex);
        if (cell == null) {
            return "";
        }
        if (cell.getCellType() == CellType.NUMERIC && DateUtil.isCellDateFormatted(cell)) {
            return cell.getLocalDateTimeCellValue().toString();
        }
        return formatter.formatCellValue(cell).trim();
    }

    private boolean isBlankRow(Row row, DataFormatter formatter) {
        for (Cell cell : row) {
            if (!formatter.formatCellValue(cell).trim().isBlank()) {
                return false;
            }
        }
        return true;
    }

    private TrainingActivityType findActiveActivityType(Long activityTypeId) {
        TrainingActivityType activityType = activityTypeRepository.findById(activityTypeId)
                .orElseThrow(() -> new ResourceNotFoundException("Training activity type not found"));
        if (!activityType.isActive()) {
            throw new BadRequestException("Training activity type is inactive");
        }
        return activityType;
    }

    private void updatePreviewSummary(TrainingImportBatch batch, List<TrainingImportRow> rows) {
        batch.setSuccessRows((int) rows.stream().filter(row -> row.getValidationStatus() == TrainingImportRowStatus.VALID).count());
        batch.setWarningRows((int) rows.stream().filter(row -> row.getValidationStatus() == TrainingImportRowStatus.WARNING).count());
        batch.setFailedRows((int) rows.stream().filter(row -> row.getValidationStatus() == TrainingImportRowStatus.INVALID).count());
        batch.setStatus(batch.getFailedRows() > 0 || batch.getWarningRows() > 0
                ? TrainingImportBatchStatus.COMPLETED_WITH_WARNINGS
                : TrainingImportBatchStatus.COMPLETED);
    }

    private void updateApplySummary(TrainingImportBatch batch, List<TrainingImportRow> rows) {
        batch.setSuccessRows((int) rows.stream().filter(row -> row.getValidationStatus() == TrainingImportRowStatus.IMPORTED).count());
        batch.setWarningRows((int) rows.stream().filter(row -> row.getValidationStatus() == TrainingImportRowStatus.WARNING).count());
        batch.setFailedRows((int) rows.stream().filter(row -> row.getValidationStatus() == TrainingImportRowStatus.INVALID).count());
        batch.setStatus(batch.getWarningRows() > 0 || batch.getFailedRows() > 0
                ? TrainingImportBatchStatus.COMPLETED_WITH_WARNINGS
                : TrainingImportBatchStatus.COMPLETED);
    }

    private TrainingImportBatchResponse toResponse(TrainingImportBatch batch, List<TrainingImportRow> rows) {
        return new TrainingImportBatchResponse(
                batch.getId(),
                batch.getOriginalFilename(),
                batch.getStatus(),
                batch.getTotalRows(),
                batch.getSuccessRows(),
                batch.getFailedRows(),
                batch.getWarningRows(),
                batch.getImportedByUser() == null ? null : batch.getImportedByUser().getId(),
                batch.getImportedAt(),
                rows.stream().map(this::toRowResponse).toList()
        );
    }

    @SuppressWarnings("unchecked")
    private TrainingImportRowResponse toRowResponse(TrainingImportRow row) {
        Map<String, Object> messages = row.getValidationMessages() == null ? Map.of() : row.getValidationMessages();
        return new TrainingImportRowResponse(
                row.getId(),
                row.getSourceRowNumber(),
                row.getValidationStatus(),
                row.getRawData(),
                row.getNormalizedData(),
                (List<String>) messages.getOrDefault("errors", List.of()),
                (List<String>) messages.getOrDefault("warnings", List.of()),
                row.getTrainingRecord() == null ? null : row.getTrainingRecord().getId()
        );
    }

    private Map<String, Object> messages(List<String> errors, List<String> warnings) {
        Map<String, Object> messages = new LinkedHashMap<>();
        messages.put("errors", List.copyOf(errors));
        messages.put("warnings", List.copyOf(warnings));
        return messages;
    }

    private void validateUpload(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("Excel file is required");
        }
        String filename = file.getOriginalFilename() == null ? "" : file.getOriginalFilename().toLowerCase(Locale.ROOT);
        if (!filename.endsWith(".xlsx") && !filename.endsWith(".xls")) {
            throw new BadRequestException("Legacy import only accepts .xlsx or .xls files");
        }
    }

    private String normalizeEmployeeCode(String value) {
        String normalized = value == null ? "" : value.trim().toUpperCase(Locale.ROOT).replaceAll("\\s+", "");
        if (normalized.matches("\\d+")) {
            return "VD" + normalized;
        }
        return normalized;
    }

    private boolean looksLikeEmployeeCode(String value) {
        return value.matches("VD[A-Z0-9]+");
    }

    private LocalDate parseDate(String value) {
        String text = normalizeWhitespace(value);
        if (text == null || text.isBlank()) {
            return null;
        }
        LocalDateTime dateTime = parseDateTime(text);
        if (dateTime != null) {
            return dateTime.toLocalDate();
        }
        for (DateTimeFormatter formatter : DATE_FORMATS) {
            try {
                return LocalDate.parse(text, formatter);
            } catch (DateTimeParseException ignored) {
                // Try the next known legacy format.
            }
        }
        return null;
    }

    private LocalDateTime parseDateTime(String value) {
        String text = normalizeWhitespace(value);
        if (text == null || text.isBlank()) {
            return null;
        }
        for (DateTimeFormatter formatter : DATE_TIME_FORMATS) {
            try {
                return LocalDateTime.parse(text, formatter);
            } catch (DateTimeParseException ignored) {
                // Try the next known legacy format.
            }
        }
        try {
            return LocalDate.parse(text, DateTimeFormatter.ISO_LOCAL_DATE).atStartOfDay();
        } catch (DateTimeParseException ignored) {
            return null;
        }
    }

    private boolean isTrainingDateOutOfRange(LocalDate date) {
        return date.getYear() < 2000 || date.getYear() > LocalDate.now().getYear() + 1;
    }

    private String normalizeHeader(String value) {
        return stripAccent(value).toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "");
    }

    private String normalizeHumanName(String value) {
        return stripAccent(value).toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "");
    }

    private String stripAccent(String value) {
        if (value == null) {
            return "";
        }
        String vietnameseD = value.replace('Đ', 'D').replace('đ', 'd');
        return Normalizer.normalize(vietnameseD, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
    }

    private String normalizeWhitespace(String value) {
        if (value == null) {
            return null;
        }
        return value.replaceAll("\\s+", " ").trim();
    }

    private String stringValue(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private String requiredString(Map<String, Object> data, String key) {
        String value = stringValue(data.get(key));
        if (value == null || value.isBlank()) {
            throw new BadRequestException("Import row is missing normalized field: " + key);
        }
        return value;
    }

    private BigDecimal bigDecimalValue(Object value) {
        if (value == null || String.valueOf(value).isBlank() || "null".equals(String.valueOf(value))) {
            return null;
        }
        if (value instanceof BigDecimal decimal) {
            return decimal;
        }
        if (value instanceof Number number) {
            return BigDecimal.valueOf(number.doubleValue());
        }
        return new BigDecimal(String.valueOf(value));
    }

    private Long longValue(Object value) {
        if (value == null || String.valueOf(value).isBlank()) {
            return null;
        }
        if (value instanceof Number number) {
            return number.longValue();
        }
        return Long.valueOf(String.valueOf(value));
    }

    private LocalDateTime localDateTimeValue(Object value) {
        return Optional.ofNullable(stringValue(value)).map(this::parseDateTime).orElse(null);
    }

    private String limit(String value, int maxLength, String fallback) {
        String resolved = value == null || value.isBlank() ? fallback : value;
        return resolved.length() <= maxLength ? resolved : resolved.substring(0, maxLength);
    }

    private String fileNameFromUrl(String url) {
        String normalized = url == null ? "" : url.trim();
        int slashIndex = normalized.lastIndexOf('/');
        String candidate = slashIndex >= 0 ? normalized.substring(slashIndex + 1) : normalized;
        int queryIndex = candidate.indexOf('?');
        if (queryIndex >= 0) {
            candidate = candidate.substring(0, queryIndex);
        }
        return candidate.isBlank() ? "legacy-external-evidence" : candidate;
    }

    private record SourceRow(int rowNumber, Map<String, Object> rawData) {
    }
}
