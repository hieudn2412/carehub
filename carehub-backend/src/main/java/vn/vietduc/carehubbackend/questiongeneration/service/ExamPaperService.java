package vn.vietduc.carehubbackend.questiongeneration.service;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDFont;
import org.apache.pdfbox.pdmodel.font.PDType0Font;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.apache.poi.xwpf.usermodel.XWPFRun;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.vietduc.carehubbackend.common.response.ErrorResponse;
import vn.vietduc.carehubbackend.exception.BadRequestException;
import vn.vietduc.carehubbackend.exception.ConflictException;
import vn.vietduc.carehubbackend.exception.ResourceNotFoundException;
import vn.vietduc.carehubbackend.exception.ValidationException;
import vn.vietduc.carehubbackend.questiongeneration.dto.request.GenerateExamPaperRequest;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.ExamPaperQuestionResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.ExamPaperResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.ExamPaperCoverageCellResponse;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamConfig;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamBlueprintField;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamBlueprintCell;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamConfigSourceFilter;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamPaper;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamPaperGenerationBatch;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamPaperGenerationBatchCell;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamPaperQuestion;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamPaperQuestionSnapshot;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionBankQuestion;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionSet;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionSetItem;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionSetVersion;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionSetVersionItem;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ExamAssignmentStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ExamConfigStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ExamPaperStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ExamQuestionSelectionMode;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionBankStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.CognitiveLevel;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionCategoryStatus;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamAssignmentRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamConfigRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamPaperQuestionRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamPaperQuestionSnapshotRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamPaperRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamPaperGenerationBatchRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamPaperGenerationBatchCellRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.QuestionBankQuestionRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.QuestionSetItemRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.QuestionSetVersionItemRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.QuestionSetVersionRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamBlueprintFieldRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamBlueprintCellRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamConfigSourceFilterRepository;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.text.Normalizer;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.LinkedHashMap;
import java.util.Objects;
import java.util.Random;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ExamPaperService {
    private static final BigDecimal DEFAULT_POINTS = BigDecimal.ONE;
    private static final int PDF_MAX_CHARS_PER_LINE = 96;

    private final ExamPaperRepository examPaperRepository;
    private final ExamPaperQuestionRepository paperQuestionRepository;
    private final ExamPaperQuestionSnapshotRepository snapshotRepository;
    private final ExamConfigRepository examConfigRepository;
    private final QuestionSetItemRepository questionSetItemRepository;
    private final QuestionSetVersionRepository questionSetVersionRepository;
    private final QuestionSetVersionItemRepository questionSetVersionItemRepository;
    private final QuestionBankQuestionRepository questionRepository;
    private final ExamAssignmentRepository examAssignmentRepository;
    private ExamBlueprintFieldRepository blueprintFieldRepository;
    private ExamBlueprintCellRepository blueprintCellRepository;
    private ExamConfigSourceFilterRepository sourceFilterRepository;
    private ExamPaperGenerationBatchRepository generationBatchRepository;
    private ExamPaperGenerationBatchCellRepository generationBatchCellRepository;

    @Autowired
    public void setBlueprintRepositories(ExamBlueprintFieldRepository fields, ExamBlueprintCellRepository cells, ExamConfigSourceFilterRepository filters) {
        this.blueprintFieldRepository = fields;
        this.blueprintCellRepository = cells;
        this.sourceFilterRepository = filters;
    }

    @Autowired
    public void setGenerationRepositories(
            ExamPaperGenerationBatchRepository batches,
            ExamPaperGenerationBatchCellRepository batchCells
    ) {
        this.generationBatchRepository = batches;
        this.generationBatchCellRepository = batchCells;
    }

    @Transactional(readOnly = true)
    public List<ExamPaperResponse> list(String query, String status) {
        String normalizedQuery = normalize(query);
        ExamPaperStatus statusFilter = parseStatusOrNull(status);
        List<ExamPaper> papers = statusFilter == null
                ? examPaperRepository.findByStatusNotOrderByUpdatedAtDesc(ExamPaperStatus.ARCHIVED)
                : examPaperRepository.findByStatusOrderByUpdatedAtDesc(statusFilter);
        return papers.stream()
                .filter(paper -> normalizedQuery.isBlank()
                        || normalize(paper.getName()).contains(normalizedQuery)
                        || normalize(paper.getCode()).contains(normalizedQuery)
                        || normalize(paper.getExamConfig().getName()).contains(normalizedQuery)
                        || normalize(paper.getQuestionSet() == null ? null : paper.getQuestionSet().getName()).contains(normalizedQuery))
                .map(paper -> toResponse(paper, false))
                .toList();
    }

    @Transactional(readOnly = true)
    public ExamPaperResponse get(Long paperId) {
        return get(paperId, true);
    }

    /**
     * @param includeAnswerKey khi false, các trường đáp án đúng và giải thích được ẩn (null)
     */
    @Transactional(readOnly = true)
    public ExamPaperResponse get(Long paperId, boolean includeAnswerKey) {
        return toResponse(find(paperId), true, includeAnswerKey);
    }

    @Transactional
    public List<ExamPaperResponse> generate(GenerateExamPaperRequest request, String actor) {
        if (request == null || request.examConfigId() == null) {
            throw new BadRequestException("Vui lòng chọn cấu hình đề kiểm tra");
        }
        String idempotencyKey = trimToNull(request.idempotencyKey());
        if (idempotencyKey == null || idempotencyKey.length() > 160) {
            throw new BadRequestException("Idempotency key là bắt buộc và không được vượt quá 160 ký tự");
        }
        if (generationBatchRepository == null || generationBatchCellRepository == null) {
            throw new IllegalStateException("Generation batch repositories are unavailable");
        }
        int variantCount = request.variantCount() == null ? 1 : request.variantCount();
        if (variantCount < 1 || variantCount > 10) {
            throw new BadRequestException("Số mã đề phải trong khoảng 1-10");
        }
        boolean zeroOverlap = Boolean.TRUE.equals(request.zeroOverlap());
        String generationActor = trimToNull(actor) == null ? "system" : trimToNull(actor);
        ExamConfig config = examConfigRepository.findByIdForUpdate(request.examConfigId())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy cấu hình đề kiểm tra"));
        var existingBatch = generationBatchRepository.findByIdempotencyKey(idempotencyKey);
        if (existingBatch.isPresent()) {
            ExamPaperGenerationBatch storedBatch = existingBatch.get();
            String replayHash = ExamGenerationDeterminism.requestHash(
                    config.getId(), storedBatch.getConfigVersion(), request.namePrefix(), variantCount,
                    request.randomSeed(), zeroOverlap);
            if (!Objects.equals(storedBatch.getRequestHash(), replayHash)) {
                throw new ConflictException("Idempotency key đã được dùng với payload sinh đề khác");
            }
            return examPaperRepository.findByGenerationBatchOrderByVariantIndexAsc(storedBatch).stream()
                    .map(paper -> toResponse(paper, true))
                    .toList();
        }
        if (config.getStatus() != ExamConfigStatus.ACTIVE) {
            throw new BadRequestException("Chỉ được sinh đề từ cấu hình đang hoạt động");
        }
        int configVersion = config.getBlueprintVersion() == null ? 1 : config.getBlueprintVersion();
        String requestHash = ExamGenerationDeterminism.requestHash(
                config.getId(), configVersion, request.namePrefix(), variantCount, request.randomSeed(), zeroOverlap);
        QuestionSet questionSet = config.getQuestionSet();
        List<PaperSourceQuestion> sourceItems = questionSet == null
                ? paperSourceQuestionsDirect(config)
                : paperSourceQuestions(questionSet);
        if (sourceItems.size() < config.getTotalQuestions()) {
            throw new BadRequestException("Ngân hàng câu hỏi không đủ số câu để sinh đề");
        }
        List<ExamConfigSourceFilter> sourceFilters = questionSet == null
                ? sourceFilterRepository.findByExamConfigOrderByIdAsc(config)
                : List.of();
        String poolChecksum = questionSet == null
                ? ExamGenerationDeterminism.poolChecksum(configVersion, sourceFilters,
                sourceItems.stream().map(PaperSourceQuestion::question).toList())
                : "LEGACY_QUESTION_SET";
        if (questionSet == null && !Objects.equals(config.getPoolChecksum(), poolChecksum)) {
            throw new ConflictException("Ngân hàng câu hỏi đã thay đổi sau lần preview. Vui lòng preview lại cấu hình trước khi sinh đề");
        }
        if (questionSet == null) {
            validateBlueprintAvailability(config, sourceItems, variantCount, zeroOverlap);
        } else if (zeroOverlap) {
            throw new BadRequestException("Chế độ không lặp giữa các mã đề chỉ hỗ trợ blueprint trực tiếp từ ngân hàng");
        }
        long masterSeed = request.randomSeed() == null ? new java.security.SecureRandom().nextLong() : request.randomSeed();
        LocalDateTime generatedAt = LocalDateTime.now();
        ExamPaperGenerationBatch batch = generationBatchRepository.save(ExamPaperGenerationBatch.builder()
                .examConfig(config)
                .idempotencyKey(idempotencyKey)
                .requestHash(requestHash)
                .configVersion(configVersion)
                .masterSeed(masterSeed)
                .algorithmVersion(ExamGenerationDeterminism.ALGORITHM_VERSION)
                .poolChecksum(poolChecksum)
                .variantCount(variantCount)
                .zeroOverlap(zeroOverlap)
                .overlapQuestionCount(0)
                .overlapPercentage(BigDecimal.ZERO)
                .generatedBy(generationActor)
                .generatedAt(generatedAt)
                .build());
        snapshotBlueprint(batch, config);
        List<ExamPaperResponse> responses = new ArrayList<>();
        List<List<PaperSourceQuestion>> selections = new ArrayList<>();
        Set<Long> batchUsedFamilies = zeroOverlap ? new HashSet<>() : null;
        List<ExamPaper> generatedPapers = new ArrayList<>();
        for (int variant = 1; variant <= variantCount; variant++) {
            long seed = ExamGenerationDeterminism.deriveVariantSeed(masterSeed, variant);
            List<PaperSourceQuestion> selected = selectItems(config, sourceItems, seed, batchUsedFamilies);
            ExamPaper paper = createPaper(
                    config, batch, request.namePrefix(), variant, seed, generationActor, idempotencyKey, generatedAt);
            persistQuestions(
                    paper,
                    selected,
                    Boolean.TRUE.equals(config.getShuffleOptions()),
                    seed,
                    generatedAt
            );
            selections.add(selected);
            generatedPapers.add(paper);
        }
        updateOverlap(batch, selections);
        generationBatchRepository.save(batch);
        generatedPapers.forEach(paper -> responses.add(toResponse(paper, true)));
        return responses;
    }

    @Transactional
    public ExamPaperResponse publish(Long paperId, String actor) {
        ExamPaper paper = find(paperId);
        if (paper.getStatus() == ExamPaperStatus.ARCHIVED) {
            throw new BadRequestException("Không thể phát hành đề đã lưu trữ");
        }
        int storedQuestions = paperQuestionRepository.findByExamPaperOrderByPositionAsc(paper).size();
        if (storedQuestions != paper.getTotalQuestions()) {
            throw new BadRequestException("Đề kiểm tra chưa đủ số câu");
        }
        validateSnapshotMatrix(paper);
        paper.setStatus(ExamPaperStatus.PUBLISHED);
        paper.setPublishedBy(trimToNull(actor) == null ? "system" : trimToNull(actor));
        paper.setPublishedAt(LocalDateTime.now());
        return toResponse(examPaperRepository.save(paper), true);
    }

    @Transactional
    public ExamPaperResponse archive(Long paperId) {
        ExamPaper paper = find(paperId);
        if (paper.getStatus() != ExamPaperStatus.ARCHIVED
                && examAssignmentRepository.countByExamPaperAndStatus(paper, ExamAssignmentStatus.OPEN) > 0) {
            throw new BadRequestException(
                    "Không thể lưu trữ đề đang có bài kiểm tra được giao. Vui lòng đóng các bài kiểm tra liên quan trước.");
        }
        paper.setStatus(ExamPaperStatus.ARCHIVED);
        return toResponse(examPaperRepository.save(paper), false);
    }

    @Transactional(readOnly = true)
    public byte[] exportText(Long paperId, boolean includeAnswers) {
        ExamPaperResponse paper = get(paperId);
        return exportTextContent(paper, includeAnswers).getBytes(StandardCharsets.UTF_8);
    }

    @Transactional(readOnly = true)
    public byte[] export(Long paperId, String format, boolean includeAnswers) {
        ExamPaperResponse paper = get(paperId);
        String normalizedFormat = normalizeExportFormat(format);
        return switch (normalizedFormat) {
            case "txt" -> exportTextContent(paper, includeAnswers).getBytes(StandardCharsets.UTF_8);
            case "docx" -> exportDocx(paper, includeAnswers);
            case "xlsx" -> exportXlsx(paper, includeAnswers);
            case "pdf" -> exportPdf(paper, includeAnswers);
            default -> throw new BadRequestException("Định dạng export bộ đề không được hỗ trợ");
        };
    }

    private String exportTextContent(ExamPaperResponse paper, boolean includeAnswers) {
        StringBuilder builder = new StringBuilder();
        builder.append(paper.name()).append(System.lineSeparator());
        builder.append("Mã đề: ").append(paper.code()).append(System.lineSeparator());
        builder.append("Thời gian: ").append(paper.timeLimitMinutes()).append(" phút").append(System.lineSeparator());
        builder.append("Điểm đạt: ").append(paper.passingScore()).append("/10").append(System.lineSeparator());
        builder.append("Số câu: ").append(paper.totalQuestions()).append(System.lineSeparator());
        builder.append(System.lineSeparator());
        for (ExamPaperQuestionResponse question : paper.questions()) {
            builder.append("Câu ").append(question.position()).append(". ").append(question.stem()).append(System.lineSeparator());
            builder.append("A. ").append(question.optionA()).append(System.lineSeparator());
            builder.append("B. ").append(question.optionB()).append(System.lineSeparator());
            builder.append("C. ").append(question.optionC()).append(System.lineSeparator());
            builder.append("D. ").append(question.optionD()).append(System.lineSeparator());
            if (includeAnswers) {
                builder.append("Đáp án đúng: ").append(question.correctAnswer()).append(System.lineSeparator());
                if (trimToNull(question.explanation()) != null) {
                    builder.append("Giải thích: ").append(question.explanation()).append(System.lineSeparator());
                }
                if (trimToNull(question.sourceDocument()) != null) {
                    builder.append("Nguồn: ").append(question.sourceDocument()).append(System.lineSeparator());
                }
            }
            builder.append(System.lineSeparator());
        }
        return builder.toString();
    }

    private byte[] exportDocx(ExamPaperResponse paper, boolean includeAnswers) {
        try (XWPFDocument document = new XWPFDocument();
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            XWPFParagraph title = document.createParagraph();
            XWPFRun titleRun = title.createRun();
            titleRun.setBold(true);
            titleRun.setFontSize(16);
            titleRun.setText(paper.name());

            for (String line : exportTextContent(paper, includeAnswers).split("\\R")) {
                if (line.equals(paper.name())) {
                    continue;
                }
                XWPFParagraph paragraph = document.createParagraph();
                XWPFRun run = paragraph.createRun();
                if (line.startsWith("Câu ") || line.startsWith("Đáp án đúng:")) {
                    run.setBold(true);
                }
                run.setText(line);
            }
            document.write(output);
            return output.toByteArray();
        } catch (IOException ex) {
            throw new BadRequestException("Không thể export bộ đề DOCX");
        }
    }

    private byte[] exportXlsx(ExamPaperResponse paper, boolean includeAnswers) {
        try (Workbook workbook = new XSSFWorkbook();
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            Sheet sheet = workbook.createSheet("Bộ đề");
            CellStyle headerStyle = workbook.createCellStyle();
            Font headerFont = workbook.createFont();
            headerFont.setBold(true);
            headerStyle.setFont(headerFont);

            int rowIndex = 0;
            rowIndex = metadataRow(sheet, rowIndex, "Tên đề", paper.name());
            rowIndex = metadataRow(sheet, rowIndex, "Mã đề", paper.code());
            rowIndex = metadataRow(sheet, rowIndex, "Thời gian", paper.timeLimitMinutes() + " phút");
            rowIndex = metadataRow(sheet, rowIndex, "Điểm đạt", paper.passingScore() + "/10");
            rowIndex = metadataRow(sheet, rowIndex, "Số câu", String.valueOf(paper.totalQuestions()));
            rowIndex++;

            Row header = sheet.createRow(rowIndex++);
            List<String> headers = includeAnswers
                    ? List.of("STT", "Câu hỏi", "A", "B", "C", "D", "Đáp án đúng", "Giải thích", "Nguồn")
                    : List.of("STT", "Câu hỏi", "A", "B", "C", "D");
            for (int index = 0; index < headers.size(); index++) {
                header.createCell(index).setCellValue(headers.get(index));
                header.getCell(index).setCellStyle(headerStyle);
            }

            for (ExamPaperQuestionResponse question : paper.questions()) {
                Row row = sheet.createRow(rowIndex++);
                row.createCell(0).setCellValue(question.position());
                row.createCell(1).setCellValue(blank(question.stem()));
                row.createCell(2).setCellValue(blank(question.optionA()));
                row.createCell(3).setCellValue(blank(question.optionB()));
                row.createCell(4).setCellValue(blank(question.optionC()));
                row.createCell(5).setCellValue(blank(question.optionD()));
                if (includeAnswers) {
                    row.createCell(6).setCellValue(blank(question.correctAnswer()));
                    row.createCell(7).setCellValue(blank(question.explanation()));
                    row.createCell(8).setCellValue(blank(question.sourceDocument()));
                }
            }
            for (int index = 0; index < headers.size(); index++) {
                sheet.autoSizeColumn(index);
            }
            workbook.write(output);
            return output.toByteArray();
        } catch (IOException ex) {
            throw new BadRequestException("Không thể export bộ đề XLSX");
        }
    }

    private byte[] exportPdf(ExamPaperResponse paper, boolean includeAnswers) {
        try (PDDocument document = new PDDocument();
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            PDFont font = loadPdfFont(document);
            List<String> lines = exportTextContent(paper, includeAnswers).lines()
                    .flatMap(line -> wrapLine(line, PDF_MAX_CHARS_PER_LINE).stream())
                    .toList();
            PDPage page = null;
            PDPageContentStream content = null;
            float margin = 48;
            float y = 0;
            float lineHeight = 15;
            for (String line : lines) {
                if (content == null || y < margin) {
                    if (content != null) {
                        content.endText();
                        content.close();
                    }
                    page = new PDPage(PDRectangle.A4);
                    document.addPage(page);
                    content = new PDPageContentStream(document, page);
                    content.beginText();
                    content.setFont(font, 11);
                    content.newLineAtOffset(margin, page.getMediaBox().getHeight() - margin);
                    y = page.getMediaBox().getHeight() - margin;
                }
                content.showText(line.isBlank() ? " " : line);
                content.newLineAtOffset(0, -lineHeight);
                y -= lineHeight;
            }
            if (content != null) {
                content.endText();
                content.close();
            }
            document.save(output);
            return output.toByteArray();
        } catch (IOException ex) {
            throw new BadRequestException("Không thể export bộ đề PDF");
        }
    }

    private int metadataRow(Sheet sheet, int rowIndex, String label, String value) {
        Row row = sheet.createRow(rowIndex);
        row.createCell(0).setCellValue(label);
        row.createCell(1).setCellValue(value == null ? "" : value);
        return rowIndex + 1;
    }

    private PDFont loadPdfFont(PDDocument document) throws IOException {
        for (String candidate : List.of(
                "C:/Windows/Fonts/arial.ttf",
                "C:/Windows/Fonts/tahoma.ttf",
                "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
                "/System/Library/Fonts/Supplemental/Arial Unicode.ttf"
        )) {
            File file = Path.of(candidate).toFile();
            if (file.exists()) {
                return PDType0Font.load(document, file);
            }
        }
        throw new IOException("Không tìm thấy font Unicode để export PDF");
    }

    private List<String> wrapLine(String line, int maxChars) {
        if (line == null || line.length() <= maxChars) {
            return List.of(line == null ? "" : line);
        }
        List<String> lines = new ArrayList<>();
        String remaining = line;
        while (remaining.length() > maxChars) {
            int breakAt = remaining.lastIndexOf(' ', maxChars);
            if (breakAt < 20) {
                breakAt = maxChars;
            }
            lines.add(remaining.substring(0, breakAt).trim());
            remaining = remaining.substring(breakAt).trim();
        }
        lines.add(remaining);
        return lines;
    }

    private String normalizeExportFormat(String format) {
        String normalized = trimToNull(format);
        return normalized == null ? "txt" : normalized.toLowerCase(Locale.ROOT);
    }

    private String blank(String value) {
        return value == null ? "" : value;
    }

    private List<PaperSourceQuestion> selectItems(
            ExamConfig config,
            List<PaperSourceQuestion> sourceItems,
            long seed,
            Set<Long> batchUsedFamilies
    ) {
        if (config.getQuestionSet() == null) {
            return selectBlueprintItems(config, sourceItems, seed, batchUsedFamilies);
        }
        // Cấu hình theo bộ câu hỏi là dữ liệu cũ: chỉ rút ngẫu nhiên đủ số câu,
        // không còn phân bổ theo độ khó.
        Random random = new Random(seed);
        Set<Long> usedQuestionIds = new HashSet<>();
        List<PaperSourceQuestion> selected = new ArrayList<>(
                pick(sourceItems, config.getTotalQuestions(), usedQuestionIds, random));
        if (selected.size() != config.getTotalQuestions()) {
            throw new BadRequestException("Không đủ câu hỏi để sinh đề theo cấu hình");
        }
        if (Boolean.TRUE.equals(config.getShuffleQuestions())) {
            selected = new ArrayList<>(selected);
            ExamGenerationDeterminism.stableShuffle(selected, random);
        }
        return selected;
    }

    private List<PaperSourceQuestion> selectBlueprintItems(
            ExamConfig config,
            List<PaperSourceQuestion> sourceItems,
            long seed,
            Set<Long> batchUsedFamilies
    ) {
        if (blueprintFieldRepository == null || blueprintCellRepository == null) {
            throw new BadRequestException("Blueprint repository chưa được cấu hình");
        }
        Random random = new Random(seed);
        Set<Long> used = new HashSet<>();
        Set<Long> usedFamilies = new HashSet<>();
        List<PaperSourceQuestion> selected = new ArrayList<>();
        for (ExamBlueprintField field : blueprintFieldRepository.findByExamConfigIdOrderByDisplayOrderAsc(config.getId())) {
            List<ExamBlueprintCell> cells = new ArrayList<>(blueprintCellRepository.findByBlueprintFieldId(field.getId()));
            cells.sort(Comparator.comparingInt(cell -> cognitiveOrder(cell.getCognitiveLevel())));
            for (ExamBlueprintCell cell : cells) {
                List<PaperSourceQuestion> candidates = sourceItems.stream()
                        .filter(item -> item.question() != null && item.question().getProfessionalField() != null)
                        .filter(item -> item.question().getProfessionalField().getId().equals(field.getProfessionalField().getId()))
                        .filter(item -> item.question().getCognitiveLevel() == cell.getCognitiveLevel())
                        .toList();
                List<PaperSourceQuestion> picked = pickByFamily(
                        candidates, cell.getQuestionCount(), used, usedFamilies, batchUsedFamilies, random);
                if (picked.size() < cell.getQuestionCount()) {
                    throw new BadRequestException("Không đủ họ câu hỏi độc lập cho "
                            + field.getProfessionalField().getName() + " / "
                            + QuestionGenerationLabels.cognitiveLevel(cell.getCognitiveLevel()));
                }
                selected.addAll(picked);
            }
        }
        if (selected.size() != config.getTotalQuestions()) {
            throw new BadRequestException("Tổng câu sinh ra không khớp blueprint");
        }
        if (Boolean.TRUE.equals(config.getShuffleQuestions())) {
            selected = new ArrayList<>(selected);
            ExamGenerationDeterminism.stableShuffle(selected, random);
        }
        return selected;
    }

    private List<PaperSourceQuestion> pickByFamily(
            List<PaperSourceQuestion> candidates,
            int count,
            Set<Long> usedQuestionIds,
            Set<Long> usedFamilies,
            Set<Long> batchUsedFamilies,
            Random random
    ) {
        List<PaperSourceQuestion> pool = candidates.stream()
                .filter(item -> item.question() != null && item.question().getId() != null)
                .sorted(Comparator.comparing(item -> item.question().getId()))
                .filter(item -> !usedQuestionIds.contains(item.question().getId()))
                .filter(item -> !usedFamilies.contains(ExamGenerationDeterminism.familyId(item.question())))
                .filter(item -> batchUsedFamilies == null
                        || !batchUsedFamilies.contains(ExamGenerationDeterminism.familyId(item.question())))
                .collect(Collectors.toCollection(ArrayList::new));
        ExamGenerationDeterminism.stableShuffle(pool, random);
        List<PaperSourceQuestion> picked = pool.stream().limit(count).toList();
        for (PaperSourceQuestion item : picked) {
            long familyId = ExamGenerationDeterminism.familyId(item.question());
            usedQuestionIds.add(item.question().getId());
            usedFamilies.add(familyId);
            if (batchUsedFamilies != null) {
                batchUsedFamilies.add(familyId);
            }
        }
        return picked;
    }

    private List<PaperSourceQuestion> pick(List<PaperSourceQuestion> candidates, int count, Set<Long> usedQuestionIds, Random random) {
        List<PaperSourceQuestion> pool = candidates.stream()
                .filter(item -> item.question() != null)
                .filter(item -> !usedQuestionIds.contains(item.question().getId()))
                .sorted(Comparator.comparing(item -> item.question().getId()))
                .collect(Collectors.toCollection(ArrayList::new));
        ExamGenerationDeterminism.stableShuffle(pool, random);
        List<PaperSourceQuestion> picked = pool.stream().limit(count).toList();
        picked.forEach(item -> usedQuestionIds.add(item.question().getId()));
        return picked;
    }

    private ExamPaper createPaper(
            ExamConfig config,
            ExamPaperGenerationBatch batch,
            String namePrefix,
            int version,
            long seed,
            String actor,
            String idempotencyKey,
            LocalDateTime generatedAt
    ) {
        String prefix = trimToNull(namePrefix) == null ? config.getName() : trimToNull(namePrefix);
        String code = uniqueCode(config.getId(), version, seed);
        ExamPaper paper = ExamPaper.builder()
                .code(code)
                .idempotencyKey(idempotencyKey)
                .generationBatch(batch)
                .variantIndex(version)
                .configVersion(batch.getConfigVersion())
                .generationAlgorithmVersion(batch.getAlgorithmVersion())
                .generationPoolChecksum(batch.getPoolChecksum())
                .generatedBy(actor)
                .generatedAt(generatedAt)
                .name(prefix + " - Mã đề " + version)
                .examConfig(config)
                .questionSet(config.getQuestionSet())
                .version(version)
                .randomSeed(seed)
                .status(ExamPaperStatus.DRAFT)
                .totalQuestions(config.getTotalQuestions())
                .timeLimitMinutes(config.getTimeLimitMinutes())
                .passingScore(config.getPassingScore())
                .questionSelectionMode(selectionMode(config))
                .createdBy(actor)
                .build();
        return examPaperRepository.save(paper);
    }

    private void persistQuestions(
            ExamPaper paper,
            List<PaperSourceQuestion> selected,
            boolean shuffleOptions,
            long seed,
            LocalDateTime generatedAt
    ) {
        LocalDateTime now = generatedAt;
        int position = 1;
        for (PaperSourceQuestion item : selected) {
            QuestionBankQuestion question = item.question();
            OptionSnapshot options = buildOptionSnapshot(item, shuffleOptions, seed, position);
            ExamPaperQuestion paperQuestion = paperQuestionRepository.save(ExamPaperQuestion.builder()
                    .examPaper(paper)
                    .question(question)
                    .position(position++)
                    .points(item.points() == null ? DEFAULT_POINTS : item.points())
                    .optionOrderJson(options.optionOrderJson())
                    .build());
            snapshotRepository.save(ExamPaperQuestionSnapshot.builder()
                    .sourceQuestionId(question.getId())
                    .questionFamilyId(ExamGenerationDeterminism.familyId(question))
                    .questionPosition(paperQuestion.getPosition())
                    .optionOrderJson(options.optionOrderJson())
                    .examPaperQuestion(paperQuestion)
                    .stem(item.stem())
                    .optionA(options.optionA())
                    .optionB(options.optionB())
                    .optionC(options.optionC())
                    .optionD(options.optionD())
                    .correctAnswer(options.correctAnswer())
                    .explanation(item.explanation())
                    .topic(item.topic())
                    .categoryId(question.getCategory() == null ? null : question.getCategory().getId())
                    .categoryCode(question.getCategory() == null ? null : question.getCategory().getCode())
                    .categoryName(question.getCategory() == null ? null : question.getCategory().getName())
                    .professionalFieldId(question.getProfessionalField() == null ? null : question.getProfessionalField().getId())
                    .professionalFieldCode(question.getProfessionalField() == null ? null : question.getProfessionalField().getCode())
                    .professionalFieldName(question.getProfessionalField() == null ? null : question.getProfessionalField().getName())
                    .cognitiveLevel(question.getCognitiveLevel() == null ? null : question.getCognitiveLevel().name())
                    .cognitiveLabel(QuestionGenerationLabels.cognitiveLevel(question.getCognitiveLevel()))
                    .cognitiveVerifiedAt(question.getCognitiveVerifiedAt())
                    .cognitiveVerifiedBy(question.getCognitiveVerifiedBy())
                    .sourceDocumentId(question.getSourceDocumentRef() == null ? null : question.getSourceDocumentRef().getId())
                    .sourceDocumentFilename(question.getSourceDocumentRef() == null ? null : question.getSourceDocumentRef().getFilename())
                    .sourceDocumentTitle(question.getSourceDocumentRef() == null ? null : question.getSourceDocumentRef().getFilename())
                    .sourceDocumentContentHash(question.getSourceDocumentRef() == null ? null : question.getSourceDocumentRef().getContentHash())
                    .sourceDocument(item.sourceDocument())
                    .configVersion(paper.getConfigVersion())
                    .paperSeed(seed)
                    .generationAlgorithmVersion(paper.getGenerationAlgorithmVersion())
                    .generationPoolChecksum(paper.getGenerationPoolChecksum())
                    .generatedBy(paper.getGeneratedBy())
                    .generatedAt(generatedAt)
                    .snapshotAt(now)
                    .build());
        }
    }

    private OptionSnapshot buildOptionSnapshot(PaperSourceQuestion question, boolean shuffleOptions, long seed, int position) {
        List<OptionChoice> choices = new ArrayList<>(List.of(
                new OptionChoice("A", question.optionA()),
                new OptionChoice("B", question.optionB()),
                new OptionChoice("C", question.optionC()),
                new OptionChoice("D", question.optionD())
        ));
        if (shuffleOptions) {
            ExamGenerationDeterminism.stableShuffle(choices, new Random(seed + position * 9973L));
            if (isOriginalOptionOrder(choices)) {
                Collections.rotate(choices, 1);
            }
        }

        String correctAnswer = normalizeOptionLabel(question.correctAnswer());
        String newCorrectAnswer = correctAnswer;
        List<String> labels = List.of("A", "B", "C", "D");
        for (int index = 0; index < choices.size(); index++) {
            if (choices.get(index).label().equals(correctAnswer)) {
                newCorrectAnswer = labels.get(index);
                break;
            }
        }
        return new OptionSnapshot(
                choices.get(0).text(),
                choices.get(1).text(),
                choices.get(2).text(),
                choices.get(3).text(),
                newCorrectAnswer,
                optionOrderJson(choices)
        );
    }

    private boolean isOriginalOptionOrder(List<OptionChoice> choices) {
        List<String> labels = List.of("A", "B", "C", "D");
        for (int index = 0; index < choices.size(); index++) {
            if (!labels.get(index).equals(choices.get(index).label())) {
                return false;
            }
        }
        return true;
    }

    private String normalizeOptionLabel(String label) {
        return label == null ? null : label.trim().toUpperCase(Locale.ROOT);
    }

    private String optionOrderJson(List<OptionChoice> choices) {
        return choices.stream()
                .map(choice -> "\"" + choice.label() + "\"")
                .collect(Collectors.joining(",", "[", "]"));
    }

    private List<PaperSourceQuestion> paperSourceQuestions(QuestionSet questionSet) {
        QuestionSetVersion activeVersion = findActiveQuestionSetVersion(questionSet);
        if (activeVersion != null) {
            List<QuestionSetVersionItem> versionItems = questionSetVersionItemRepository.findByQuestionSetVersionOrderByPositionAsc(activeVersion);
            if (!versionItems.isEmpty()) {
                return fromVersionItems(versionItems);
            }
        }
        return questionSetItemRepository.findByQuestionSetOrderByPositionAsc(questionSet).stream()
                .filter(item -> item.getQuestion() != null)
                .map(item -> {
                    QuestionBankQuestion question = item.getQuestion();
                    return new PaperSourceQuestion(
                            question,
                            item.getPosition(),
                            item.getPoints() == null ? DEFAULT_POINTS : item.getPoints(),
                            Boolean.TRUE.equals(item.getRequired()),
                            question.getStem(),
                            question.getOptionA(),
                            question.getOptionB(),
                            question.getOptionC(),
                            question.getOptionD(),
                            question.getCorrectAnswer(),
                            question.getExplanation(),
                            question.getCategory() == null ? null : question.getCategory().getName(),
                            question.getSourceDocument()
                    );
                })
                .toList();
    }

    private List<PaperSourceQuestion> paperSourceQuestionsDirect(ExamConfig config) {
        if (blueprintFieldRepository == null || sourceFilterRepository == null) throw new BadRequestException("Blueprint repository chưa được cấu hình");
        Set<Long> fieldIds = blueprintFieldRepository.findByExamConfigIdOrderByDisplayOrderAsc(config.getId()).stream().map(field -> field.getProfessionalField().getId()).collect(Collectors.toSet());
        List<ExamConfigSourceFilter> filters = sourceFilterRepository.findByExamConfigOrderByIdAsc(config);
        Set<Long> includeCategories = filterIds(filters, ExamConfigSourceFilter.FilterType.INCLUDE_CATEGORY);
        Set<Long> excludeCategories = filterIds(filters, ExamConfigSourceFilter.FilterType.EXCLUDE_CATEGORY);
        Set<Long> includeDocuments = filterIds(filters, ExamConfigSourceFilter.FilterType.INCLUDE_DOCUMENT);
        Set<Long> excludeDocuments = filterIds(filters, ExamConfigSourceFilter.FilterType.EXCLUDE_DOCUMENT);
        return questionRepository.findByStatusAndProfessionalFieldIdInOrderByIdAsc(QuestionBankStatus.APPROVED, fieldIds).stream()
                .filter(question -> question.getCategory() != null && question.getCategory().getStatus() == QuestionCategoryStatus.ACTIVE)
                .filter(question -> question.getProfessionalField() != null && question.getProfessionalField().isActive())
                .filter(question -> question.getCognitiveLevel() != null && question.getCognitiveVerifiedAt() != null && question.getCognitiveVerifiedBy() != null)
                .filter(question -> includeCategories.isEmpty() || question.getCategory() != null && includeCategories.contains(question.getCategory().getId()))
                .filter(question -> question.getCategory() == null || !excludeCategories.contains(question.getCategory().getId()))
                .filter(question -> includeDocuments.isEmpty() || question.getSourceDocumentRef() != null && includeDocuments.contains(question.getSourceDocumentRef().getId()))
                .filter(question -> question.getSourceDocumentRef() == null || !excludeDocuments.contains(question.getSourceDocumentRef().getId()))
                .sorted(Comparator.comparing(QuestionBankQuestion::getId))
                .map(question -> new PaperSourceQuestion(question, null, DEFAULT_POINTS, false, question.getStem(), question.getOptionA(), question.getOptionB(), question.getOptionC(), question.getOptionD(), question.getCorrectAnswer(), question.getExplanation(), question.getCategory() == null ? null : question.getCategory().getName(), question.getSourceDocument()))
                .toList();
    }

    private Set<Long> filterIds(List<ExamConfigSourceFilter> filters, ExamConfigSourceFilter.FilterType type) {
        return filters.stream().filter(filter -> filter.getFilterType() == type).map(ExamConfigSourceFilter::getReferenceId).collect(Collectors.toSet());
    }

    private List<PaperSourceQuestion> fromVersionItems(List<QuestionSetVersionItem> versionItems) {
        List<Long> questionIds = versionItems.stream().map(QuestionSetVersionItem::getSourceQuestionId).toList();
        Map<Long, QuestionBankQuestion> questionsById = questionRepository.findAllById(questionIds).stream()
                .collect(Collectors.toMap(QuestionBankQuestion::getId, Function.identity()));
        List<PaperSourceQuestion> rows = new ArrayList<>();
        for (QuestionSetVersionItem item : versionItems) {
            QuestionBankQuestion question = questionsById.get(item.getSourceQuestionId());
            if (question == null) {
                throw new BadRequestException("Không tìm thấy câu hỏi snapshot #" + item.getSourceQuestionId());
            }
            rows.add(new PaperSourceQuestion(
                    question,
                    item.getPosition(),
                    item.getPoints() == null ? DEFAULT_POINTS : item.getPoints(),
                    Boolean.TRUE.equals(item.getRequired()),
                    item.getStem(),
                    item.getOptionA(),
                    item.getOptionB(),
                    item.getOptionC(),
                    item.getOptionD(),
                    item.getCorrectAnswer(),
                    item.getExplanation(),
                    item.getTopic(),
                    item.getSourceDocument()
            ));
        }
        return rows;
    }

    private QuestionSetVersion findActiveQuestionSetVersion(QuestionSet questionSet) {
        List<QuestionSetVersion> versions = questionSetVersionRepository.findByQuestionSetOrderByVersionDesc(questionSet);
        if (versions.isEmpty()) {
            return null;
        }
        return versions.stream()
                .filter(version -> java.util.Objects.equals(version.getVersion(), questionSet.getActiveVersion()))
                .findFirst()
                .orElse(versions.get(0));
    }

    private void snapshotBlueprint(ExamPaperGenerationBatch batch, ExamConfig config) {
        if (config.getQuestionSet() != null) {
            return;
        }
        int order = 0;
        for (ExamBlueprintField field : blueprintFieldRepository.findByExamConfigIdOrderByDisplayOrderAsc(config.getId())) {
            List<ExamBlueprintCell> cells = new ArrayList<>(blueprintCellRepository.findByBlueprintFieldId(field.getId()));
            cells.sort(Comparator.comparingInt(cell -> cognitiveOrder(cell.getCognitiveLevel())));
            for (ExamBlueprintCell cell : cells) {
                generationBatchCellRepository.save(ExamPaperGenerationBatchCell.builder()
                        .generationBatch(batch)
                        .professionalFieldId(field.getProfessionalField().getId())
                        .professionalFieldCode(field.getProfessionalField().getCode())
                        .professionalFieldName(field.getProfessionalField().getName())
                        .cognitiveLevel(cell.getCognitiveLevel())
                        .cognitiveLabel(QuestionGenerationLabels.cognitiveLevel(cell.getCognitiveLevel()))
                        .requiredCount(cell.getQuestionCount())
                        .displayOrder(order++)
                        .build());
            }
        }
    }

    private void validateBlueprintAvailability(
            ExamConfig config, List<PaperSourceQuestion> sourceItems, int variantCount, boolean zeroOverlap
    ) {
        List<ErrorResponse.FieldErrorDetail> shortages = new ArrayList<>();
        for (ExamBlueprintField field : blueprintFieldRepository.findByExamConfigIdOrderByDisplayOrderAsc(config.getId())) {
            for (ExamBlueprintCell cell : blueprintCellRepository.findByBlueprintFieldId(field.getId())) {
                long uniqueFamilies = sourceItems.stream()
                        .filter(item -> item.question().getProfessionalField().getId()
                                .equals(field.getProfessionalField().getId()))
                        .filter(item -> item.question().getCognitiveLevel() == cell.getCognitiveLevel())
                        .mapToLong(item -> ExamGenerationDeterminism.familyId(item.question()))
                        .distinct()
                        .count();
                long required = zeroOverlap ? (long) cell.getQuestionCount() * variantCount : cell.getQuestionCount();
                if (uniqueFamilies < required) {
                    String fieldLabel = field.getProfessionalField().getName() + " / "
                            + QuestionGenerationLabels.cognitiveLevel(cell.getCognitiveLevel());
                    shortages.add(ErrorResponse.FieldErrorDetail.builder()
                            .field(fieldLabel)
                            .message(fieldLabel + ": cần " + required + " họ câu hỏi, hiện có " + uniqueFamilies
                                    + " (thiếu " + (required - uniqueFamilies) + ")")
                            .build());
                }
            }
        }
        if (!shortages.isEmpty()) {
            throw new ValidationException(
                    "Ma trận đề chưa đủ nguồn câu hỏi để sinh " + variantCount + " mã đề"
                            + (zeroOverlap ? " không trùng lặp" : ""),
                    shortages);
        }
    }

    private void updateOverlap(ExamPaperGenerationBatch batch, List<List<PaperSourceQuestion>> selections) {
        List<Long> selectedIds = selections.stream()
                .flatMap(List::stream)
                .map(item -> item.question().getId())
                .toList();
        int overlapCount = selectedIds.size() - new HashSet<>(selectedIds).size();
        BigDecimal percentage = selectedIds.isEmpty()
                ? BigDecimal.ZERO
                : BigDecimal.valueOf(overlapCount)
                .multiply(BigDecimal.valueOf(100))
                .divide(BigDecimal.valueOf(selectedIds.size()), 4, RoundingMode.HALF_UP);
        batch.setOverlapQuestionCount(overlapCount);
        batch.setOverlapPercentage(percentage);
    }

    private void validateSnapshotMatrix(ExamPaper paper) {
        if (paper.getGenerationBatch() == null || generationBatchCellRepository == null) {
            return;
        }
        List<ExamPaperCoverageCellResponse> coverage = coverage(paper);
        List<String> mismatches = coverage.stream()
                .filter(cell -> !Boolean.TRUE.equals(cell.matchesBlueprint()))
                .map(cell -> cell.professionalFieldName() + " / " + cell.cognitiveLabel()
                        + " cần " + cell.requiredCount() + " câu nhưng đề có " + cell.actualCount())
                .toList();
        if (!mismatches.isEmpty()) {
            throw new BadRequestException("Ma trận đề không khớp blueprint snapshot: " + String.join("; ", mismatches));
        }
    }

    private List<ExamPaperCoverageCellResponse> coverage(ExamPaper paper) {
        if (paper.getGenerationBatch() == null || generationBatchCellRepository == null) {
            return List.of();
        }
        Map<MatrixKey, Integer> actual = new LinkedHashMap<>();
        for (ExamPaperQuestion paperQuestion : paperQuestionRepository.findByExamPaperOrderByPositionAsc(paper)) {
            ExamPaperQuestionSnapshot snapshot = snapshotRepository.findByExamPaperQuestion(paperQuestion)
                    .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy snapshot câu hỏi trong đề"));
            MatrixKey key = new MatrixKey(snapshot.getProfessionalFieldId(), snapshot.getCognitiveLevel());
            actual.merge(key, 1, Integer::sum);
        }
        List<ExamPaperCoverageCellResponse> result = new ArrayList<>();
        for (ExamPaperGenerationBatchCell cell : generationBatchCellRepository
                .findByGenerationBatchOrderByDisplayOrderAscCognitiveLevelAsc(paper.getGenerationBatch())) {
            int actualCount = actual.getOrDefault(
                    new MatrixKey(cell.getProfessionalFieldId(), cell.getCognitiveLevel().name()), 0);
            result.add(new ExamPaperCoverageCellResponse(
                    cell.getProfessionalFieldId(),
                    cell.getProfessionalFieldCode(),
                    cell.getProfessionalFieldName(),
                    cell.getCognitiveLevel().name(),
                    cell.getCognitiveLabel(),
                    cell.getRequiredCount(),
                    actualCount,
                    actualCount == cell.getRequiredCount()
            ));
        }
        return result;
    }

    private int cognitiveOrder(CognitiveLevel level) {
        if (level == null) {
            return Integer.MAX_VALUE;
        }
        return switch (level) {
            case FOUNDATION -> 0;
            case CLINICAL_APPLICATION -> 1;
            case CLINICAL_REASONING_ANALYSIS -> 2;
        };
    }

    private ExamPaperResponse toResponse(ExamPaper paper, boolean includeQuestions) {
        return toResponse(paper, includeQuestions, true);
    }

    private ExamPaperResponse toResponse(ExamPaper paper, boolean includeQuestions, boolean includeAnswerKey) {
        List<ExamPaperQuestion> storedQuestions = paperQuestionRepository.findByExamPaperOrderByPositionAsc(paper);
        List<ExamPaperQuestionResponse> questions = includeQuestions
                ? storedQuestions.stream()
                .map(paperQuestion -> toQuestionResponse(paperQuestion, includeAnswerKey))
                .toList()
                : List.of();
        ExamPaperGenerationBatch batch = paper.getGenerationBatch();
        return new ExamPaperResponse(
                paper.getId(),
                paper.getCode(),
                paper.getName(),
                paper.getExamConfig().getId(),
                paper.getExamConfig().getName(),
                paper.getQuestionSet() == null ? null : paper.getQuestionSet().getId(),
                paper.getQuestionSet() == null ? null : paper.getQuestionSet().getName(),
                paper.getVersion(),
                paper.getRandomSeed(),
                paper.getStatus().name(),
                QuestionGenerationLabels.examPaperStatus(paper.getStatus()),
                paper.getTotalQuestions(),
                storedQuestions.size(),
                paper.getTimeLimitMinutes(),
                paper.getPassingScore(),
                selectionMode(paper).name(),
                questions,
                paper.getPublishedAt(),
                paper.getCreatedAt(),
                paper.getUpdatedAt(),
                paper.getProfessionalField() == null ? null : paper.getProfessionalField().getId(),
                paper.getProfessionalField() == null ? null : paper.getProfessionalField().getCode(),
                paper.getProfessionalField() == null ? null : paper.getProfessionalField().getName(),
                batch == null ? null : batch.getId(),
                batch == null ? null : batch.getMasterSeed(),
                paper.getVariantIndex() == null ? paper.getVersion() : paper.getVariantIndex(),
                paper.getConfigVersion(),
                paper.getGenerationAlgorithmVersion(),
                paper.getGenerationPoolChecksum(),
                batch == null ? null : batch.getZeroOverlap(),
                batch == null ? null : batch.getOverlapQuestionCount(),
                batch == null ? null : batch.getOverlapPercentage(),
                includeQuestions ? coverage(paper) : List.of()
        );
    }

    private ExamQuestionSelectionMode selectionMode(ExamConfig config) {
        return config.getQuestionSelectionMode() == null
                ? ExamQuestionSelectionMode.FIXED_PAPER
                : config.getQuestionSelectionMode();
    }

    private ExamQuestionSelectionMode selectionMode(ExamPaper paper) {
        return paper.getQuestionSelectionMode() == null
                ? ExamQuestionSelectionMode.FIXED_PAPER
                : paper.getQuestionSelectionMode();
    }

    private ExamPaperQuestionResponse toQuestionResponse(ExamPaperQuestion paperQuestion, boolean includeAnswerKey) {
        ExamPaperQuestionSnapshot snapshot = snapshotRepository.findByExamPaperQuestion(paperQuestion)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy snapshot câu hỏi trong đề"));
        return new ExamPaperQuestionResponse(
                paperQuestion.getId(),
                snapshot.getSourceQuestionId() == null ? paperQuestion.getQuestion().getId() : snapshot.getSourceQuestionId(),
                snapshot.getQuestionPosition() == null
                        ? paperQuestion.getPosition()
                        : snapshot.getQuestionPosition(),
                paperQuestion.getPoints(),
                snapshot.getStem(),
                snapshot.getOptionA(),
                snapshot.getOptionB(),
                snapshot.getOptionC(),
                snapshot.getOptionD(),
                includeAnswerKey ? snapshot.getCorrectAnswer() : null,
                includeAnswerKey ? snapshot.getExplanation() : null,
                snapshot.getTopic(),
                snapshot.getSourceDocument(),
                snapshot.getCategoryId(),
                snapshot.getCategoryCode(),
                snapshot.getCategoryName(),
                snapshot.getProfessionalFieldId(),
                snapshot.getProfessionalFieldCode(),
                snapshot.getProfessionalFieldName(),
                snapshot.getCognitiveLevel(),
                snapshot.getCognitiveLabel(),
                snapshot.getSourceDocumentId(),
                snapshot.getSourceDocumentFilename(),
                snapshot.getSourceDocumentContentHash(),
                snapshot.getQuestionFamilyId()
        );
    }

    private ExamPaper find(Long paperId) {
        return examPaperRepository.findById(paperId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy bộ đề kiểm tra"));
    }

    private String uniqueCode(Long configId, int version, long seed) {
        String date = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss"));
        String base = "EP-" + configId + "-" + version + "-" + date + "-" + Math.abs(seed % 10000);
        String code = base;
        int suffix = 1;
        while (examPaperRepository.findByCode(code).isPresent()) {
            code = base + "-" + suffix++;
        }
        return code;
    }

    private ExamPaperStatus parseStatusOrNull(String status) {
        if (status == null || status.isBlank()) {
            return null;
        }
        try {
            return ExamPaperStatus.valueOf(status.trim().toUpperCase(Locale.ROOT));
        } catch (Exception ex) {
            throw new BadRequestException("Trạng thái bộ đề kiểm tra không hợp lệ");
        }
    }

    private int clamp(int value, int min, int max) {
        return Math.max(min, Math.min(max, value));
    }

    private String trimToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private String normalize(String value) {
        return Normalizer.normalize(value == null ? "" : value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "")
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^\\p{L}\\p{N}\\s]", " ")
                .replaceAll("\\s+", " ")
                .trim();
    }

    private record OptionChoice(String label, String text) {
    }

    private record MatrixKey(Long professionalFieldId, String cognitiveLevel) {
    }

    private record OptionSnapshot(
            String optionA,
            String optionB,
            String optionC,
            String optionD,
            String correctAnswer,
            String optionOrderJson
    ) {
    }

    private record PaperSourceQuestion(
            QuestionBankQuestion question,
            Integer sourcePosition,
            BigDecimal points,
            Boolean required,
            String stem,
            String optionA,
            String optionB,
            String optionC,
            String optionD,
            String correctAnswer,
            String explanation,
            String topic,
            String sourceDocument
    ) {
    }
}
