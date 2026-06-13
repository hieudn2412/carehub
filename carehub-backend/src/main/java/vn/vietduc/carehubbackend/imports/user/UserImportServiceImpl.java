package vn.vietduc.carehubbackend.imports.user;

import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityNotFoundException;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import vn.vietduc.carehubbackend.user.entity.*;
import vn.vietduc.carehubbackend.user.repository.*;

import java.io.IOException;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class UserImportServiceImpl implements UserImportService {
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

    @Override
    @Transactional
    public ImportResult importExcel(MultipartFile file) throws IOException {
        validateExcelFile(file);

        long startTime = System.currentTimeMillis();
        int insertedUsers = 0;
        int skippedUsers = 0;
        int newDepartments = 0;
        int newPositions = 0;
        int newEducationLevels = 0;

        Workbook workbook = WorkbookFactory.create(file.getInputStream());

        Sheet sheet = workbook.getSheetAt(0);

        DataFormatter dataformatter = new DataFormatter();

        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("dd/MM/yyyy");

        Role userRole = roleRepository.findByCode("USER")
                .orElseThrow(()->new EntityNotFoundException("Role not found"));

        String defaultPasswordHash = passwordEncoder.encode(password);



        Map<String, Department> departmentMap = departmentRepository.findAll().stream()
                .collect(Collectors.toMap(Department::getDepartmentCode, d -> d));

        Map<String, Position> positionMap = positionRepository.findAll().stream()
                .collect(Collectors.toMap(Position::getName, p -> p));

        Map<String, EducationLevel> educationLevelMap = educationRepository.findAll().stream()
                .collect(Collectors.toMap(EducationLevel::getName, e-> e));

        //Lấy danh sách employee trước
        Set<String> employeeCodes = new HashSet<>();
        for(int i = 1; i<= sheet.getLastRowNum(); i++) {
            String employeeCode = sheet.getRow(i).getCell(1).getStringCellValue();
            employeeCodes.add(employeeCode);
        }

        Map<String, User> userMap = userRepository.findByEmployeeCodeIn(employeeCodes).stream()
                .collect(Collectors.toMap(User::getEmployeeCode, u -> u));

        List<User> usersToImport = new ArrayList<>();
        List<UserRole> userRolesToImport = new ArrayList<>();
        List<Department> departmentsToImport = new ArrayList<>();
        List<Position> positionsToImport = new ArrayList<>();
        List<EducationLevel> educationLevelsToImport = new ArrayList<>();



        for (int i = 1; i <= sheet.getLastRowNum(); i++) {
            Row row = sheet.getRow(i);

            if (row == null) {
                continue;
            }

            String employeeCode = getStringCellValue(row.getCell(1));

            if (employeeCode == null || employeeCode.isBlank()) {
                continue;
            }

            //Xử lý department
            String departmentName = getStringCellValue(row.getCell(7));
            String departmentCode = getStringCellValue(row.getCell(8));

            Department department = departmentMap.get(departmentCode);
            if(department == null){
                department = Department.builder()
                                .departmentCode(departmentCode)
                                .name(departmentName)
                                .build();
                departmentMap.put(departmentCode, department);
                departmentsToImport.add(department);
                newDepartments++;
            }

            //Xử lí position
            String positionName = getStringCellValue(row.getCell(10));
            Position position = positionMap.get(positionName);
            if(position == null){
                position = Position.builder()
                        .name(positionName)
                        .build();
                positionMap.put(positionName, position);
                positionsToImport.add(position);
                newPositions++;
            }

            //Xử lý education
            String educationLevel = getStringCellValue(row.getCell(11));
            EducationLevel education = educationLevelMap.get(educationLevel);
            if(education == null){
                education = EducationLevel.builder()
                        .name(educationLevel)
                        .build();
                educationLevelMap.put(educationLevel, education);
                educationLevelsToImport.add(education);
                newEducationLevels++;
            }

            //Xử lý users
            User user = userMap.get(employeeCode);
            if(user == null){
                String firstName = getStringCellValue(row.getCell(3));
                String lastName = getStringCellValue(row.getCell(4));
                String fullName =  firstName.trim() + " " + lastName.trim();
                String genderString = getStringCellValue(row.getCell(5));
                boolean gender = genderString.equalsIgnoreCase("Nam");
                LocalDate dob = getDateCellValue(row.getCell(6));
                User newUser = User.builder()
                        .employeeCode(employeeCode)
                        .department(department)
                        .position(position)
                        .educationLevel(education)
                        .password(defaultPasswordHash)
                        .firstLogin(true)
                        .isDeleted(false)
                        .name(fullName.trim())
                        .status(UserStatus.INACTIVE)
                        .birthday(dob)
                        .gender(gender)
                        .build();

                usersToImport.add(newUser);
                userMap.put(employeeCode, newUser);

                UserRole newUserRole = UserRole.builder()
                        .user(newUser)
                        .role(userRole)
                        .build();
                userRolesToImport.add(newUserRole);
                insertedUsers++;
                }else{
                skippedUsers++;
            }
            if(usersToImport.size() == 1000){
                departmentRepository.saveAll(departmentsToImport);
                positionRepository.saveAll(positionsToImport);
                educationRepository.saveAll(educationLevelsToImport);
                userRepository.saveAll(usersToImport);
                userRoleRepository.saveAll(userRolesToImport);

                entityManager.flush();
                entityManager.clear();

                departmentsToImport.clear();
                positionsToImport.clear();
                educationLevelsToImport.clear();
                usersToImport.clear();
                userRolesToImport.clear();
            }
        }
        if (!usersToImport.isEmpty()) {
            departmentRepository.saveAll(departmentsToImport);
            positionRepository.saveAll(positionsToImport);
            educationRepository.saveAll(educationLevelsToImport);
            userRepository.saveAll(usersToImport);
            userRoleRepository.saveAll(userRolesToImport);
        }

        workbook.close();
        long durationMs = System.currentTimeMillis() - startTime;
        return ImportResult.builder()
                .insertedUsers(insertedUsers)
                .skippedUsers(skippedUsers)
                .totalRows(sheet.getLastRowNum()-1)
                .newPositions(newPositions)
                .newDepartments(newDepartments)
                .newEducationLevels(newEducationLevels)
                .durationMs(durationMs)
                .build();
    }

    private String getStringCellValue(Cell cell) {
        if (cell == null) {
            return null;
        }
        return switch (cell.getCellType()) {
            case STRING -> cell.getStringCellValue().trim();
            case NUMERIC -> {
                DataFormatter formatter = new DataFormatter();
                yield formatter.formatCellValue(cell).trim();
            }
            case BOOLEAN -> String.valueOf(cell.getBooleanCellValue());
            default -> null;
        };
    }

    private LocalDate getDateCellValue(Cell cell) {
        if (cell == null) return null;
        if (cell.getCellType() == CellType.NUMERIC) {
            if (DateUtil.isCellDateFormatted(cell)) {
                return cell.getLocalDateTimeCellValue().toLocalDate();
            }
            throw new IllegalArgumentException("Cell không phải kiểu Date: " + cell.getAddress());
        }

        if (cell.getCellType() == CellType.STRING) {
            String value = cell.getStringCellValue().trim();
            if (value.isEmpty()) return null;

            DateTimeFormatter formatter = DateTimeFormatter.ofPattern("d/M/yyyy");
            return LocalDate.parse(value, formatter);
        }

        return null;
    }

    private void validateExcelFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("File is required");
        }
        String fileName = file.getOriginalFilename();
        if (fileName == null || (!fileName.endsWith(".xlsx") && !fileName.endsWith(".xls"))) {
            throw new IllegalArgumentException("Only Excel files (.xlsx, .xls) are allowed");
        }
    }
}
