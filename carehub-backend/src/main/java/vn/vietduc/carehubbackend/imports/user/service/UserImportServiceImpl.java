package vn.vietduc.carehubbackend.imports.user.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityNotFoundException;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.DateUtil;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import vn.vietduc.carehubbackend.exception.BadRequestException;
import vn.vietduc.carehubbackend.common.entity.BaseEntity;
import vn.vietduc.carehubbackend.imports.user.dto.ImportResult;
import vn.vietduc.carehubbackend.imports.user.dto.ImportRowResult;
import vn.vietduc.carehubbackend.imports.user.entity.ImportLog;
import vn.vietduc.carehubbackend.imports.user.repository.ImportLogRepository;
import vn.vietduc.carehubbackend.user.entity.Department;
import vn.vietduc.carehubbackend.user.entity.EducationLevel;
import vn.vietduc.carehubbackend.user.entity.Position;
import vn.vietduc.carehubbackend.user.entity.Role;
import vn.vietduc.carehubbackend.user.entity.User;
import vn.vietduc.carehubbackend.user.entity.UserRole;
import vn.vietduc.carehubbackend.user.entity.UserStatus;
import vn.vietduc.carehubbackend.user.repository.DepartmentRepository;
import vn.vietduc.carehubbackend.user.repository.EducationLevelRepository;
import vn.vietduc.carehubbackend.user.repository.PositionRepository;
import vn.vietduc.carehubbackend.user.repository.RoleRepository;
import vn.vietduc.carehubbackend.user.repository.UserRepository;
import vn.vietduc.carehubbackend.user.repository.UserRoleRepository;

import java.io.IOException;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class UserImportServiceImpl implements UserImportService {
    private static final long MAX_FILE_SIZE_BYTES = 10L * 1024 * 1024;
    private static final int[] IMPORT_COLUMNS = {1, 3, 4, 5, 6, 7, 8, 10, 18, 19};
    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("d/M/yyyy");

    @PersistenceContext
    private EntityManager entityManager;

    @Value("${app.import.default-password}")
    private String password;

    private final UserRepository userRepository;
    private final DepartmentRepository departmentRepository;
    private final PositionRepository positionRepository;
    private final EducationLevelRepository educationRepository;
    private final PasswordEncoder passwordEncoder;
    private final RoleRepository roleRepository;
    private final UserRoleRepository userRoleRepository;
    private final ImportLogRepository importLogRepository;
    private final ObjectMapper objectMapper;

    @Override
    @Transactional
    public ImportResult importExcel(MultipartFile file) throws IOException {
        validateExcelFile(file);

        if (!hasText(password)) {
            throw new BadRequestException("Default import password is not configured");
        }

        long startTime = System.currentTimeMillis();
        int insertedUsers = 0;
        int updatedUsers = 0;
        int skippedUsers = 0;
        int newDepartments = 0;
        int newPositions = 0;
        int newEducationLevels = 0;
        int failedRows = 0;

        List<ImportRowResult> rowResults = new ArrayList<>();
        List<User> newUsersToSave = new ArrayList<>();
        List<UserRole> userRolesToSave = new ArrayList<>();
        Map<String, Department> newDepartmentsToSave = new LinkedHashMap<>();
        Map<String, Position> newPositionsToSave = new LinkedHashMap<>();
        Map<String, EducationLevel> newEducationLevelsToSave = new LinkedHashMap<>();

        Role userRole = roleRepository.findByCode("USER")
                .orElseThrow(() -> new EntityNotFoundException("Role not found"));
        String defaultPasswordHash = passwordEncoder.encode(password);

        List<ParsedUserRow> rows;
        try (Workbook workbook = WorkbookFactory.create(file.getInputStream())) {
            rows = parseRows(workbook.getSheetAt(0));
        }

        Map<String, Department> departmentMap = fetchDepartments(collectValues(rows, ParsedUserRow::departmentCode));
        Map<String, Position> positionMap = fetchPositions(collectValues(rows, ParsedUserRow::positionName));
        Map<String, EducationLevel> educationLevelMap = fetchEducationLevels(collectValues(rows, ParsedUserRow::educationCode));
        Map<String, User> userMap = fetchUsers(collectValues(rows, ParsedUserRow::employeeCode));
        Set<String> seenEmployeeCodes = new HashSet<>();

        for (ParsedUserRow row : rows) {
            String employeeCode = row.employeeCode();

            try {
                if (row.errorMessage() != null) {
                    throw new IllegalArgumentException(row.errorMessage());
                }

                validateRequired(employeeCode, "Employee code");

                if (!seenEmployeeCodes.add(employeeCode)) {
                    throw new IllegalArgumentException("Duplicate employee code in file");
                }

                validateRequired(row.firstName(), "First name");
                validateRequired(row.lastName(), "Last name");
                validateRequired(row.departmentName(), "Department name");
                validateRequired(row.departmentCode(), "Department code");
                validateRequired(row.positionName(), "Position name");
                validateRequired(row.educationCode(), "Education code");
                validateRequired(row.educationLevelName(), "Education level");

                Department department = departmentMap.get(row.departmentCode());
                if (department == null) {
                    department = Department.builder()
                            .departmentCode(row.departmentCode())
                            .name(row.departmentName())
                            .build();
                    departmentMap.put(row.departmentCode(), department);
                    newDepartmentsToSave.put(row.departmentCode(), department);
                    newDepartments++;
                } else if (!Objects.equals(department.getName(), row.departmentName())) {
                    department.setName(row.departmentName());
                }

                Position position = positionMap.get(row.positionName());
                if (position == null) {
                    position = Position.builder()
                            .name(row.positionName())
                            .build();
                    positionMap.put(row.positionName(), position);
                    newPositionsToSave.put(row.positionName(), position);
                    newPositions++;
                }

                EducationLevel education = educationLevelMap.get(row.educationCode());
                if (education == null) {
                    education = EducationLevel.builder()
                            .name(row.educationLevelName())
                            .educationCode(row.educationCode())
                            .build();
                    educationLevelMap.put(row.educationCode(), education);
                    newEducationLevelsToSave.put(row.educationCode(), education);
                    newEducationLevels++;
                }

                String fullName = row.firstName().trim() + " " + row.lastName().trim();
                boolean gender = "Nam".equalsIgnoreCase(row.gender());
                User user = userMap.get(employeeCode);

                if (user == null) {
                    user = User.builder()
                            .employeeCode(employeeCode)
                            .department(department)
                            .position(position)
                            .educationLevel(education)
                            .password(defaultPasswordHash)
                            .firstLogin(true)
                            .isDeleted(false)
                            .name(fullName.trim())
                            .status(UserStatus.INACTIVE)
                            .birthday(row.birthday())
                            .gender(gender)
                            .build();
                    userMap.put(employeeCode, user);
                    newUsersToSave.add(user);
                    userRolesToSave.add(UserRole.builder()
                            .user(user)
                            .role(userRole)
                            .build());
                    insertedUsers++;
                    rowResults.add(rowResult(row.rowNumber(), employeeCode, "INSERTED", "Inserted successfully"));
                } else if (applyUserUpdates(user, department, position, education, fullName.trim(), row.birthday(), gender)) {
                    updatedUsers++;
                    rowResults.add(rowResult(row.rowNumber(), employeeCode, "UPDATED", "Updated successfully"));
                } else {
                    skippedUsers++;
                    rowResults.add(rowResult(row.rowNumber(), employeeCode, "UNCHANGED", "No changes detected"));
                }
            } catch (RuntimeException ex) {
                failedRows++;
                rowResults.add(rowResult(row.rowNumber(), employeeCode, "FAILED", ex.getMessage()));
            }
        }

        if (!newDepartmentsToSave.isEmpty()) {
            departmentRepository.saveAll(newDepartmentsToSave.values());
        }
        if (!newPositionsToSave.isEmpty()) {
            positionRepository.saveAll(newPositionsToSave.values());
        }
        if (!newEducationLevelsToSave.isEmpty()) {
            educationRepository.saveAll(newEducationLevelsToSave.values());
        }
        if (!newUsersToSave.isEmpty()) {
            userRepository.saveAll(newUsersToSave);
        }
        if (!userRolesToSave.isEmpty()) {
            userRoleRepository.saveAll(userRolesToSave);
        }

        entityManager.flush();

        long durationMs = System.currentTimeMillis() - startTime;
        ImportLog importLog = importLogRepository.save(ImportLog.builder()
                .sourceFile(file.getOriginalFilename() == null ? "unknown" : file.getOriginalFilename())
                .status(resolveStatus(insertedUsers + updatedUsers + skippedUsers, failedRows))
                .totalRows(rows.size())
                .insertedRows(insertedUsers)
                .updatedRows(updatedUsers)
                .failedRows(failedRows)
                .durationMs(durationMs)
                .rowResultsJson(writeRowResults(rowResults))
                .build());

        return ImportResult.builder()
                .importLogId(importLog.getId())
                .totalRows(rows.size())
                .insertedUsers(insertedUsers)
                .updatedUsers(updatedUsers)
                .skippedUsers(skippedUsers)
                .failedRows(failedRows)
                .newPositions(newPositions)
                .newDepartments(newDepartments)
                .newEducationLevels(newEducationLevels)
                .durationMs(durationMs)
                .rowResults(rowResults)
                .build();
    }

    private List<ParsedUserRow> parseRows(Sheet sheet) {
        DataFormatter formatter = new DataFormatter();
        List<ParsedUserRow> rows = new ArrayList<>();

        for (int i = 1; i <= sheet.getLastRowNum(); i++) {
            Row row = sheet.getRow(i);
            if (isBlankImportRow(row, formatter)) {
                continue;
            }

            int rowNumber = i + 1;
            String employeeCode = getStringCellValue(row.getCell(1), formatter);
            try {
                rows.add(new ParsedUserRow(
                        rowNumber,
                        employeeCode,
                        getStringCellValue(row.getCell(3), formatter),
                        getStringCellValue(row.getCell(4), formatter),
                        getStringCellValue(row.getCell(5), formatter),
                        getDateCellValue(row.getCell(6), formatter),
                        getStringCellValue(row.getCell(7), formatter),
                        getStringCellValue(row.getCell(8), formatter),
                        getStringCellValue(row.getCell(10), formatter),
                        getStringCellValue(row.getCell(18), formatter),
                        getStringCellValue(row.getCell(19), formatter),
                        null));
            } catch (RuntimeException ex) {
                rows.add(new ParsedUserRow(
                        rowNumber,
                        employeeCode,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        ex.getMessage()));
            }
        }

        return rows;
    }

    private Set<String> collectValues(List<ParsedUserRow> rows, Function<ParsedUserRow, String> extractor) {
        return rows.stream()
                .map(extractor)
                .filter(this::hasText)
                .collect(Collectors.toSet());
    }

    private Map<String, Department> fetchDepartments(Set<String> departmentCodes) {
        if (departmentCodes.isEmpty()) {
            return new LinkedHashMap<>();
        }

        return departmentRepository.findByDepartmentCodeIn(departmentCodes).stream()
                .filter(department -> hasText(department.getDepartmentCode()))
                .collect(Collectors.toMap(
                        Department::getDepartmentCode,
                        department -> department,
                        (left, right) -> left,
                        LinkedHashMap::new));
    }

    private Map<String, Position> fetchPositions(Set<String> positionNames) {
        if (positionNames.isEmpty()) {
            return new LinkedHashMap<>();
        }

        return positionRepository.findByNameIn(positionNames).stream()
                .filter(position -> hasText(position.getName()))
                .collect(Collectors.toMap(
                        Position::getName,
                        position -> position,
                        (left, right) -> left,
                        LinkedHashMap::new));
    }

    private Map<String, EducationLevel> fetchEducationLevels(Set<String> educationCodes) {
        if (educationCodes.isEmpty()) {
            return new LinkedHashMap<>();
        }

        return educationRepository.findByEducationCodeIn(educationCodes).stream()
                .filter(educationLevel -> hasText(educationLevel.getEducationCode()))
                .collect(Collectors.toMap(
                        EducationLevel::getEducationCode,
                        educationLevel -> educationLevel,
                        (left, right) -> left,
                        LinkedHashMap::new));
    }

    private Map<String, User> fetchUsers(Set<String> employeeCodes) {
        if (employeeCodes.isEmpty()) {
            return new LinkedHashMap<>();
        }

        return userRepository.findByEmployeeCodeIn(employeeCodes).stream()
                .collect(Collectors.toMap(
                        User::getEmployeeCode,
                        user -> user,
                        (left, right) -> left,
                        LinkedHashMap::new));
    }

    private boolean applyUserUpdates(
            User user,
            Department department,
            Position position,
            EducationLevel education,
            String fullName,
            LocalDate birthday,
            boolean gender
    ) {
        boolean changed = false;

        if (!sameEntity(user.getDepartment(), department)) {
            user.setDepartment(department);
            changed = true;
        }
        if (!sameEntity(user.getPosition(), position)) {
            user.setPosition(position);
            changed = true;
        }
        if (!sameEntity(user.getEducationLevel(), education)) {
            user.setEducationLevel(education);
            changed = true;
        }
        if (!Objects.equals(user.getName(), fullName)) {
            user.setName(fullName);
            changed = true;
        }
        if (!Objects.equals(user.getBirthday(), birthday)) {
            user.setBirthday(birthday);
            changed = true;
        }
        if (user.isGender() != gender) {
            user.setGender(gender);
            changed = true;
        }
        if (user.isDeleted()) {
            user.setDeleted(false);
            changed = true;
        }

        return changed;
    }

    private boolean sameEntity(BaseEntity left, BaseEntity right) {
        if (left == right) {
            return true;
        }
        if (left == null || right == null) {
            return false;
        }
        Long leftId = idOf(left);
        Long rightId = idOf(right);
        if (leftId == null || rightId == null) {
            return false;
        }
        return Objects.equals(leftId, rightId);
    }

    private Long idOf(BaseEntity entity) {
        return entity == null ? null : entity.getId();
    }

    private String getStringCellValue(Cell cell, DataFormatter formatter) {
        if (cell == null) {
            return null;
        }

        String value = formatter.formatCellValue(cell).trim();
        return value.isEmpty() ? null : value;
    }

    private LocalDate getDateCellValue(Cell cell, DataFormatter formatter) {
        if (cell == null) {
            return null;
        }
        if (cell.getCellType() == CellType.NUMERIC && DateUtil.isCellDateFormatted(cell)) {
            return cell.getLocalDateTimeCellValue().toLocalDate();
        }

        String value = getStringCellValue(cell, formatter);
        if (!hasText(value)) {
            return null;
        }

        try {
            return LocalDate.parse(value, DATE_FORMATTER);
        } catch (DateTimeParseException ex) {
            throw new IllegalArgumentException("Invalid date format at " + cell.getAddress() + ", expected d/M/yyyy");
        }
    }

    private void validateExcelFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("File is required");
        }
        if (file.getSize() > MAX_FILE_SIZE_BYTES) {
            throw new IllegalArgumentException("File size must be 10 MB or less");
        }
        String fileName = file.getOriginalFilename();
        if (fileName == null || (!fileName.toLowerCase().endsWith(".xlsx") && !fileName.toLowerCase().endsWith(".xls"))) {
            throw new IllegalArgumentException("Only Excel files (.xlsx, .xls) are allowed");
        }
    }

    private void validateRequired(String value, String fieldName) {
        if (!hasText(value)) {
            throw new IllegalArgumentException(fieldName + " is required");
        }
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private boolean isBlankImportRow(Row row, DataFormatter formatter) {
        if (row == null) {
            return true;
        }

        for (int columnIndex : IMPORT_COLUMNS) {
            if (hasText(getStringCellValue(row.getCell(columnIndex), formatter))) {
                return false;
            }
        }
        return true;
    }

    private ImportRowResult rowResult(int rowNumber, String employeeCode, String status, String message) {
        return ImportRowResult.builder()
                .rowNumber(rowNumber)
                .employeeCode(employeeCode)
                .status(status)
                .message(message)
                .build();
    }

    private String resolveStatus(int succeededRows, int failedRows) {
        if (failedRows == 0) {
            return "COMPLETED";
        }
        if (succeededRows == 0) {
            return "FAILED";
        }
        return "COMPLETED_WITH_ERRORS";
    }

    private String writeRowResults(List<ImportRowResult> rowResults) {
        try {
            return objectMapper.writeValueAsString(rowResults);
        } catch (JsonProcessingException ex) {
            return "[]";
        }
    }

    private record ParsedUserRow(
            int rowNumber,
            String employeeCode,
            String firstName,
            String lastName,
            String gender,
            LocalDate birthday,
            String departmentName,
            String departmentCode,
            String positionName,
            String educationCode,
            String educationLevelName,
            String errorMessage
    ) {
    }
}
