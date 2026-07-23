package vn.vietduc.carehubbackend.questiongeneration.service;

import lombok.RequiredArgsConstructor;
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
import vn.vietduc.carehubbackend.exception.BadRequestException;
import vn.vietduc.carehubbackend.exception.ResourceNotFoundException;
import vn.vietduc.carehubbackend.questiongeneration.dto.request.GenerateExamPaperRequest;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.ExamPaperQuestionResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.ExamPaperResponse;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamConfig;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamConfigDistribution;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamPaper;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamPaperQuestion;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamPaperQuestionSnapshot;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionBankQuestion;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionSet;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionSetItem;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionSetVersion;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionSetVersionItem;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ExamConfigStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ExamPaperStatus;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamConfigDistributionRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamConfigRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamPaperQuestionRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamPaperQuestionSnapshotRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamPaperRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.QuestionBankQuestionRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.QuestionSetItemRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.QuestionSetVersionItemRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.QuestionSetVersionRepository;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.math.BigDecimal;
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
    private final ExamConfigDistributionRepository distributionRepository;
    private final QuestionSetItemRepository questionSetItemRepository;
    private final QuestionSetVersionRepository questionSetVersionRepository;
    private final QuestionSetVersionItemRepository questionSetVersionItemRepository;
    private final QuestionBankQuestionRepository questionRepository;

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
                        || normalize(paper.getQuestionSet().getName()).contains(normalizedQuery))
                .map(paper -> toResponse(paper, false))
                .toList();
    }

    @Transactional(readOnly = true)
    public ExamPaperResponse get(Long paperId) {
        return toResponse(find(paperId), true);
    }

    @Transactional
    public List<ExamPaperResponse> generate(GenerateExamPaperRequest request, String actor) {
        if (request == null || request.examConfigId() == null) {
            throw new BadRequestException("Vui lòng chọn cấu hình đề kiểm tra");
        }
        ExamConfig config = examConfigRepository.findById(request.examConfigId())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy cấu hình đề kiểm tra"));
        if (config.getStatus() != ExamConfigStatus.ACTIVE) {
            throw new BadRequestException("Chỉ được sinh đề từ cấu hình đang hoạt động");
        }
        QuestionSet questionSet = config.getQuestionSet();
        if (questionSet == null) {
            throw new BadRequestException("Cấu hình đề kiểm tra chưa chọn bộ câu hỏi");
        }
        List<PaperSourceQuestion> sourceItems = paperSourceQuestions(questionSet);
        if (sourceItems.size() < config.getTotalQuestions()) {
            throw new BadRequestException("Bộ câu hỏi không đủ số câu để sinh đề");
        }
        int variantCount = clamp(request.variantCount() == null ? 1 : request.variantCount(), 1, 10);
        long baseSeed = request.randomSeed() == null ? System.currentTimeMillis() : request.randomSeed();
        List<ExamPaperResponse> responses = new ArrayList<>();
        for (int variant = 1; variant <= variantCount; variant++) {
            long seed = baseSeed + variant - 1;
            List<PaperSourceQuestion> selected = selectItems(config, sourceItems, seed);
            ExamPaper paper = createPaper(config, request.namePrefix(), variant, seed, actor);
            persistQuestions(paper, selected, Boolean.TRUE.equals(config.getShuffleOptions()), seed);
            responses.add(toResponse(paper, true));
        }
        return responses;
    }

    @Transactional
    public ExamPaperResponse publish(Long paperId, String actor) {
        ExamPaper paper = find(paperId);
        if (paper.getStatus() == ExamPaperStatus.ARCHIVED) {
            throw new BadRequestException("Không thể phát hành đề đã lưu trữ");
        }
        if (paperQuestionRepository.findByExamPaperOrderByPositionAsc(paper).size() != paper.getTotalQuestions()) {
            throw new BadRequestException("Đề kiểm tra chưa đủ số câu");
        }
        paper.setStatus(ExamPaperStatus.PUBLISHED);
        paper.setPublishedBy(actor);
        paper.setPublishedAt(LocalDateTime.now());
        return toResponse(examPaperRepository.save(paper), true);
    }

    @Transactional
    public ExamPaperResponse archive(Long paperId) {
        ExamPaper paper = find(paperId);
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
        builder.append("Điểm đạt: ").append(paper.passingScore()).append("%").append(System.lineSeparator());
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
            rowIndex = metadataRow(sheet, rowIndex, "Điểm đạt", paper.passingScore() + "%");
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

    private List<PaperSourceQuestion> selectItems(ExamConfig config, List<PaperSourceQuestion> sourceItems, long seed) {
        Random random = new Random(seed);
        List<ExamConfigDistribution> distributions = distributionRepository.findByExamConfigOrderByIdAsc(config);
        Set<Long> usedQuestionIds = new HashSet<>();
        List<PaperSourceQuestion> selected = new ArrayList<>();
        Map<String, List<PaperSourceQuestion>> byCategory = sourceItems.stream()
                .collect(Collectors.groupingBy(item -> normalize(item.topic())));

        for (ExamConfigDistribution distribution : distributions) {
            String categoryKey = distribution.getCategory() == null ? "" : normalize(distribution.getCategory().getName());
            List<PaperSourceQuestion> candidates = categoryKey.isBlank()
                    ? sourceItems
                    : byCategory.getOrDefault(categoryKey, List.of());
            List<PaperSourceQuestion> picked = pick(candidates, distribution.getQuestionCount(), usedQuestionIds, random);
            if (picked.size() < distribution.getQuestionCount()) {
                String categoryName = distribution.getCategory() == null ? "Tất cả danh mục" : distribution.getCategory().getName();
                throw new BadRequestException("Không đủ câu hỏi cho danh mục " + categoryName);
            }
            selected.addAll(picked);
        }

        int remaining = config.getTotalQuestions() - selected.size();
        if (remaining > 0) {
            selected.addAll(pick(sourceItems, remaining, usedQuestionIds, random));
        }
        if (selected.size() != config.getTotalQuestions()) {
            throw new BadRequestException("Không đủ câu hỏi để sinh đề theo cấu hình");
        }
        if (Boolean.TRUE.equals(config.getShuffleQuestions())) {
            selected = new ArrayList<>(selected);
            selected.sort(Comparator.comparing(item -> random.nextInt()));
        }
        return selected;
    }

    private List<PaperSourceQuestion> pick(List<PaperSourceQuestion> candidates, int count, Set<Long> usedQuestionIds, Random random) {
        List<PaperSourceQuestion> pool = candidates.stream()
                .filter(item -> item.question() != null)
                .filter(item -> !usedQuestionIds.contains(item.question().getId()))
                .collect(Collectors.toCollection(ArrayList::new));
        pool.sort(Comparator.comparing(item -> random.nextInt()));
        List<PaperSourceQuestion> picked = pool.stream().limit(count).toList();
        picked.forEach(item -> usedQuestionIds.add(item.question().getId()));
        return picked;
    }

    private ExamPaper createPaper(ExamConfig config, String namePrefix, int version, long seed, String actor) {
        String prefix = trimToNull(namePrefix) == null ? config.getName() : trimToNull(namePrefix);
        String code = uniqueCode(config.getId(), version, seed);
        ExamPaper paper = ExamPaper.builder()
                .code(code)
                .name(prefix + " - Mã đề " + version)
                .examConfig(config)
                .questionSet(config.getQuestionSet())
                .version(version)
                .randomSeed(seed)
                .status(ExamPaperStatus.DRAFT)
                .totalQuestions(config.getTotalQuestions())
                .timeLimitMinutes(config.getTimeLimitMinutes())
                .passingScore(config.getPassingScore())
                .createdBy(actor)
                .build();
        return examPaperRepository.save(paper);
    }

    private void persistQuestions(ExamPaper paper, List<PaperSourceQuestion> selected, boolean shuffleOptions, long seed) {
        LocalDateTime now = LocalDateTime.now();
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
                    .examPaperQuestion(paperQuestion)
                    .stem(item.stem())
                    .optionA(options.optionA())
                    .optionB(options.optionB())
                    .optionC(options.optionC())
                    .optionD(options.optionD())
                    .correctAnswer(options.correctAnswer())
                    .explanation(item.explanation())
                    .difficulty(item.difficulty())
                    .topic(item.topic())
                    .sourceDocument(item.sourceDocument())
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
            Collections.shuffle(choices, new Random(seed + position * 9973L));
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
                            question.getDifficulty(),
                            question.getTopic(),
                            question.getSourceDocument()
                    );
                })
                .toList();
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
                    item.getDifficulty(),
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

    private ExamPaperResponse toResponse(ExamPaper paper, boolean includeQuestions) {
        List<ExamPaperQuestionResponse> questions = includeQuestions
                ? paperQuestionRepository.findByExamPaperOrderByPositionAsc(paper).stream()
                .map(this::toQuestionResponse)
                .toList()
                : List.of();
        return new ExamPaperResponse(
                paper.getId(),
                paper.getCode(),
                paper.getName(),
                paper.getExamConfig().getId(),
                paper.getExamConfig().getName(),
                paper.getQuestionSet().getId(),
                paper.getQuestionSet().getName(),
                paper.getVersion(),
                paper.getRandomSeed(),
                paper.getStatus().name(),
                QuestionGenerationLabels.examPaperStatus(paper.getStatus()),
                paper.getTotalQuestions(),
                paper.getTimeLimitMinutes(),
                paper.getPassingScore(),
                questions,
                paper.getPublishedAt(),
                paper.getCreatedAt(),
                paper.getUpdatedAt()
        );
    }

    private ExamPaperQuestionResponse toQuestionResponse(ExamPaperQuestion paperQuestion) {
        ExamPaperQuestionSnapshot snapshot = snapshotRepository.findByExamPaperQuestion(paperQuestion)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy snapshot câu hỏi trong đề"));
        return new ExamPaperQuestionResponse(
                paperQuestion.getId(),
                paperQuestion.getQuestion().getId(),
                paperQuestion.getPosition(),
                paperQuestion.getPoints(),
                snapshot.getStem(),
                snapshot.getOptionA(),
                snapshot.getOptionB(),
                snapshot.getOptionC(),
                snapshot.getOptionD(),
                snapshot.getCorrectAnswer(),
                snapshot.getExplanation(),
                snapshot.getDifficulty(),
                snapshot.getTopic(),
                snapshot.getSourceDocument()
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
            String difficulty,
            String topic,
            String sourceDocument
    ) {
    }
}
