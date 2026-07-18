package vn.vietduc.carehubbackend.questiongeneration.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
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
import vn.vietduc.carehubbackend.questiongeneration.dto.request.CreateQuestionSetRequest;
import vn.vietduc.carehubbackend.questiongeneration.dto.request.PreviewQuestionSetRequest;
import vn.vietduc.carehubbackend.questiongeneration.dto.request.UpdateQuestionSetRequest;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.QuestionBankQuestionResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.QuestionSetDetailResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.QuestionSetItemResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.QuestionSetPreviewResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.QuestionSetSnapshotItemResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.QuestionSetSummaryResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.QuestionSetVersionSummaryResponse;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionBankQuestion;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionSet;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionSetItem;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionSetItemSnapshot;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionSetVersion;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionSetVersionItem;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionBankStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionSetStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionType;
import vn.vietduc.carehubbackend.questiongeneration.paraphrase.ParaphraseMapper;
import vn.vietduc.carehubbackend.questiongeneration.repository.QuestionBankQuestionRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.QuestionSetItemRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.QuestionSetItemSnapshotRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.QuestionSetRepository;
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
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Random;
import java.util.Set;
import java.util.concurrent.ThreadLocalRandom;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class QuestionSetService {
    private static final BigDecimal DEFAULT_POINTS = BigDecimal.ONE;
    private static final int PDF_MAX_CHARS_PER_LINE = 96;

    private final QuestionSetRepository questionSetRepository;
    private final QuestionSetItemRepository itemRepository;
    private final QuestionSetItemSnapshotRepository snapshotRepository;
    private final QuestionSetVersionRepository versionRepository;
    private final QuestionSetVersionItemRepository versionItemRepository;
    private final QuestionBankQuestionRepository questionRepository;
    private final ParaphraseMapper questionMapper;

    @Transactional(readOnly = true)
    public List<QuestionSetSummaryResponse> list(String query, String category, String difficulty, String status) {
        String normalizedQuery = normalize(query);
        String normalizedCategory = normalize(category);
        String normalizedDifficulty = normalize(difficulty);
        QuestionSetStatus statusFilter = parseStatusOrNull(status);
        return questionSetRepository.findAll().stream()
                .filter(questionSet -> statusFilter == null
                        ? questionSet.getStatus() != QuestionSetStatus.ARCHIVED
                        : questionSet.getStatus() == statusFilter)
                .filter(questionSet -> normalizedQuery.isBlank()
                        || normalize(questionSet.getName()).contains(normalizedQuery)
                        || normalize(questionSet.getDescription()).contains(normalizedQuery))
                .filter(questionSet -> normalizedCategory.isBlank()
                        || normalize(questionSet.getCategory()).equals(normalizedCategory))
                .filter(questionSet -> normalizedDifficulty.isBlank()
                        || normalize(questionSet.getDifficulty()).equals(normalizedDifficulty))
                .sorted(Comparator.comparing(
                        QuestionSet::getUpdatedAt,
                        Comparator.nullsLast(Comparator.reverseOrder())
                ))
                .map(this::toSummary)
                .toList();
    }

    @Transactional(readOnly = true)
    public QuestionSetDetailResponse get(Long setId) {
        QuestionSet questionSet = findSet(setId);
        return toDetail(questionSet);
    }

    @Transactional
    public QuestionSetDetailResponse create(CreateQuestionSetRequest request, String actor) {
        String name = required(request == null ? null : request.name(), "Tên bộ câu hỏi không được để trống");
        QuestionSetStatus status = parseStatus(request.status(), QuestionSetStatus.DRAFT);
        List<Long> questionIds = normalizedQuestionIds(request.questionIds());
        if (status == QuestionSetStatus.ACTIVE && questionIds.isEmpty()) {
            throw new BadRequestException("Không thể kích hoạt bộ câu hỏi rỗng");
        }
        String code = trimToNull(request.code());
        if (code != null && questionSetRepository.findByCode(code).isPresent()) {
            throw new BadRequestException("Mã bộ câu hỏi đã tồn tại");
        }
        if (code == null) {
            code = generateCode();
        }

        QuestionSet questionSet = QuestionSet.builder()
                .code(code)
                .name(name)
                .description(trimToNull(request.description()))
                .category(trimToNull(request.category()))
                .difficulty(trimToNull(request.difficulty()))
                .status(status)
                .questionCount(0)
                .createdBy(actor)
                .reviewedBy(status == QuestionSetStatus.ACTIVE ? actor : null)
                .build();
        QuestionSet saved = questionSetRepository.save(questionSet);
        replaceItems(saved, questionIds);
        if (status == QuestionSetStatus.ACTIVE) {
            createSnapshotVersion(saved, actor);
        }
        log.info("Question set created setId={} status={} questionCount={} actor={}", saved.getId(), saved.getStatus(), saved.getQuestionCount(), actor);
        return toDetail(saved);
    }

    @Transactional
    public QuestionSetDetailResponse update(Long setId, UpdateQuestionSetRequest request, String actor) {
        QuestionSet questionSet = findSet(setId);
        if (questionSet.getStatus() == QuestionSetStatus.ARCHIVED) {
            throw new BadRequestException("Không thể cập nhật bộ câu hỏi đã lưu trữ");
        }
        if (questionSet.getStatus() == QuestionSetStatus.ACTIVE) {
            throw new BadRequestException("Bộ câu hỏi đang hoạt động đã khóa snapshot; hãy tạo bản nháp chỉnh sửa rồi kích hoạt version mới");
        }
        String name = required(request == null ? null : request.name(), "Tên bộ câu hỏi không được để trống");
        QuestionSetStatus status = parseStatus(request.status(), questionSet.getStatus());
        List<Long> questionIds = normalizedQuestionIds(request.questionIds());
        if (status == QuestionSetStatus.ACTIVE && questionIds.isEmpty()) {
            throw new BadRequestException("Không thể kích hoạt bộ câu hỏi rỗng");
        }
        String code = trimToNull(request.code());
        if (code != null) {
            questionSetRepository.findByCode(code)
                    .filter(existing -> !Objects.equals(existing.getId(), questionSet.getId()))
                    .ifPresent(existing -> {
                        throw new BadRequestException("Mã bộ câu hỏi đã tồn tại");
                    });
        }

        questionSet.setCode(code);
        questionSet.setName(name);
        questionSet.setDescription(trimToNull(request.description()));
        questionSet.setCategory(trimToNull(request.category()));
        questionSet.setDifficulty(trimToNull(request.difficulty()));
        questionSet.setStatus(status);
        if (status == QuestionSetStatus.ACTIVE) {
            questionSet.setReviewedBy(actor);
        }
        replaceItems(questionSet, questionIds);
        QuestionSet saved = questionSetRepository.save(questionSet);
        if (status == QuestionSetStatus.ACTIVE) {
            createSnapshotVersion(saved, actor);
        }
        log.info("Question set updated setId={} status={} questionCount={} actor={}", saved.getId(), saved.getStatus(), saved.getQuestionCount(), actor);
        return toDetail(saved);
    }

    @Transactional
    public QuestionSetDetailResponse activate(Long setId, String actor) {
        QuestionSet questionSet = findSet(setId);
        List<QuestionSetItem> items = itemRepository.findByQuestionSetOrderByPositionAsc(questionSet);
        if (items.isEmpty()) {
            throw new BadRequestException("Không thể kích hoạt bộ câu hỏi rỗng");
        }
        questionSet.setStatus(QuestionSetStatus.ACTIVE);
        questionSet.setReviewedBy(actor);
        questionSetRepository.save(questionSet);
        createSnapshotVersion(questionSet, items, actor);
        log.info("Question set activated setId={} questionCount={} actor={}", questionSet.getId(), items.size(), actor);
        return toDetail(questionSet);
    }

    @Transactional
    public QuestionSetDetailResponse deactivate(Long setId) {
        QuestionSet questionSet = findSet(setId);
        if (questionSet.getStatus() == QuestionSetStatus.ARCHIVED) {
            throw new BadRequestException("Bộ câu hỏi đã được lưu trữ");
        }
        questionSet.setStatus(QuestionSetStatus.INACTIVE);
        questionSetRepository.save(questionSet);
        log.info("Question set deactivated setId={}", questionSet.getId());
        return toDetail(questionSet);
    }

    @Transactional
    public QuestionSetSummaryResponse archive(Long setId) {
        QuestionSet questionSet = findSet(setId);
        questionSet.setStatus(QuestionSetStatus.ARCHIVED);
        questionSetRepository.save(questionSet);
        log.info("Question set archived setId={}", questionSet.getId());
        return toSummary(questionSet);
    }

    @Transactional
    public QuestionSetDetailResponse duplicate(Long setId, String actor) {
        QuestionSet source = findSet(setId);
        if (source.getStatus() == QuestionSetStatus.ARCHIVED) {
            throw new BadRequestException("Không thể nhân bản bộ câu hỏi đã lưu trữ");
        }
        QuestionSet copy = QuestionSet.builder()
                .code(uniqueCopyCode(source.getCode(), source.getId()))
                .name("Bản sao - " + source.getName())
                .description(source.getDescription())
                .category(source.getCategory())
                .difficulty(source.getDifficulty())
                .status(QuestionSetStatus.DRAFT)
                .questionCount(0)
                .createdBy(actor)
                .build();
        QuestionSet saved = questionSetRepository.save(copy);
        QuestionSetVersion activeVersion = findActiveVersion(source);
        int copiedCount;
        if (activeVersion != null) {
            List<QuestionSetVersionItem> versionItems = versionItemRepository.findByQuestionSetVersionOrderByPositionAsc(activeVersion);
            copiedCount = versionItems.isEmpty()
                    ? duplicateLiveItems(saved, itemRepository.findByQuestionSetOrderByPositionAsc(source))
                    : duplicateVersionItems(saved, versionItems);
        } else {
            copiedCount = duplicateLiveItems(saved, itemRepository.findByQuestionSetOrderByPositionAsc(source));
        }
        saved.setQuestionCount(copiedCount);
        questionSetRepository.save(saved);
        log.info("Question set duplicated sourceSetId={} newSetId={} actor={}", source.getId(), saved.getId(), actor);
        return toDetail(saved);
    }

    @Transactional(readOnly = true)
    public QuestionSetPreviewResponse preview(PreviewQuestionSetRequest request) {
        if (request == null || request.difficultyDistribution() == null || request.difficultyDistribution().isEmpty()) {
            return new QuestionSetPreviewResponse(List.of(), List.of(), List.of(), List.of("Chưa có phân bổ độ khó để xem trước"));
        }
        Set<Long> excluded = new HashSet<>(request.excludeQuestionIds() == null ? List.of() : request.excludeQuestionIds());
        String normalizedCategory = normalize(request.category());
        String normalizedTopic = normalize(request.topic());
        boolean avoidSameSource = Boolean.TRUE.equals(request.avoidSameSourceDocument());
        long seed = request.randomSeed() == null ? 1L : request.randomSeed();
        List<QuestionBankQuestion> approved = questionRepository.findTop500ByStatusOrderByIdAsc(QuestionBankStatus.APPROVED).stream()
                .filter(question -> !excluded.contains(question.getId()))
                .filter(question -> normalizedCategory.isBlank() || normalize(question.getTopic()).contains(normalizedCategory))
                .filter(question -> normalizedTopic.isBlank() || normalize(question.getTopic()).contains(normalizedTopic))
                .toList();

        List<QuestionBankQuestion> selected = new ArrayList<>();
        List<QuestionSetPreviewResponse.Shortage> shortage = new ArrayList<>();
        List<String> warnings = new ArrayList<>();
        Set<Long> selectedIds = new HashSet<>();
        Set<String> usedSources = new HashSet<>();

        request.difficultyDistribution().entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .forEach(entry -> {
                    String difficulty = entry.getKey();
                    int requested = Math.max(0, entry.getValue() == null ? 0 : entry.getValue());
                    if (requested == 0) {
                        return;
                    }
                    List<QuestionBankQuestion> candidates = approved.stream()
                            .filter(question -> !selectedIds.contains(question.getId()))
                            .filter(question -> normalize(difficulty).isBlank()
                                    || normalize(question.getDifficulty()).equals(normalize(difficulty)))
                            .sorted(Comparator.comparing((QuestionBankQuestion question) ->
                                    question.getQuestionType() == QuestionType.ORIGINAL ? 0 : 1))
                            .collect(Collectors.toCollection(ArrayList::new));
                    java.util.Collections.shuffle(candidates, new Random(seed + difficulty.hashCode()));
                    List<QuestionBankQuestion> picked = pickCandidates(candidates, requested, avoidSameSource, usedSources);
                    picked.forEach(question -> {
                        selected.add(question);
                        selectedIds.add(question.getId());
                        if (question.getSourceDocument() != null && !question.getSourceDocument().isBlank()) {
                            usedSources.add(question.getSourceDocument());
                        }
                    });
                    if (picked.size() < requested) {
                        shortage.add(new QuestionSetPreviewResponse.Shortage(difficulty, requested, candidates.size()));
                    }
                });

        if (!shortage.isEmpty()) {
            warnings.add("Không đủ câu hỏi theo phân bổ đã chọn");
        }
        QuestionSetPreviewResponse response = new QuestionSetPreviewResponse(
                selected.stream().map(QuestionBankQuestion::getId).toList(),
                selected.stream().map(questionMapper::toQuestionResponse).toList(),
                shortage,
                warnings
        );
        log.info(
                "Question set preview generated selectedCount={} shortageCount={} category={} topic={}",
                response.questionIds().size(),
                response.shortage().size(),
                request.category(),
                request.topic()
        );
        return response;
    }

    @Transactional(readOnly = true)
    public byte[] export(Long setId, String format) {
        QuestionSet questionSet = findSet(setId);
        String normalizedFormat = normalizeExportFormat(format);
        List<ExportQuestionSetItem> rows = exportRows(questionSet);
        return switch (normalizedFormat) {
            case "csv" -> exportCsv(questionSet, rows);
            case "xlsx" -> exportXlsx(questionSet, rows);
            case "docx" -> exportDocx(questionSet, rows);
            case "pdf" -> exportPdf(questionSet, rows);
            default -> throw new BadRequestException("Định dạng export bộ câu hỏi không được hỗ trợ");
        };
    }

    private List<QuestionBankQuestion> pickCandidates(
            List<QuestionBankQuestion> candidates,
            int requested,
            boolean avoidSameSource,
            Set<String> usedSources
    ) {
        List<QuestionBankQuestion> picked = new ArrayList<>();
        for (QuestionBankQuestion candidate : candidates) {
            if (picked.size() >= requested) {
                break;
            }
            String source = candidate.getSourceDocument();
            if (avoidSameSource && source != null && !source.isBlank() && usedSources.contains(source)) {
                continue;
            }
            picked.add(candidate);
            if (source != null && !source.isBlank()) {
                usedSources.add(source);
            }
        }
        if (picked.size() < requested) {
            for (QuestionBankQuestion candidate : candidates) {
                if (picked.size() >= requested) {
                    break;
                }
                if (picked.stream().noneMatch(existing -> Objects.equals(existing.getId(), candidate.getId()))) {
                    picked.add(candidate);
                }
            }
        }
        return picked;
    }

    private List<ExportQuestionSetItem> exportRows(QuestionSet questionSet) {
        QuestionSetVersion activeVersion = findActiveVersion(questionSet);
        if (activeVersion != null) {
            return versionItemRepository.findByQuestionSetVersionOrderByPositionAsc(activeVersion).stream()
                    .map(item -> new ExportQuestionSetItem(
                            item.getSourceQuestionId(),
                            item.getPosition(),
                            item.getPoints(),
                            item.getRequired(),
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
                    ))
                    .toList();
        }
        return itemRepository.findByQuestionSetOrderByPositionAsc(questionSet).stream()
                .map(item -> {
                    QuestionBankQuestion question = item.getQuestion();
                    return new ExportQuestionSetItem(
                            question.getId(),
                            item.getPosition(),
                            item.getPoints(),
                            item.getRequired(),
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

    private byte[] exportCsv(QuestionSet questionSet, List<ExportQuestionSetItem> rows) {
        StringBuilder builder = new StringBuilder("\uFEFF");
        builder.append("position,sourceQuestionId,stem,optionA,optionB,optionC,optionD,correctAnswer,explanation,difficulty,topic,sourceDocument")
                .append(System.lineSeparator());
        for (ExportQuestionSetItem item : rows) {
            builder.append(csv(item.position()))
                    .append(",").append(csv(item.sourceQuestionId()))
                    .append(",").append(csv(item.stem()))
                    .append(",").append(csv(item.optionA()))
                    .append(",").append(csv(item.optionB()))
                    .append(",").append(csv(item.optionC()))
                    .append(",").append(csv(item.optionD()))
                    .append(",").append(csv(item.correctAnswer()))
                    .append(",").append(csv(item.explanation()))
                    .append(",").append(csv(item.difficulty()))
                    .append(",").append(csv(item.topic()))
                    .append(",").append(csv(item.sourceDocument()))
                    .append(System.lineSeparator());
        }
        return builder.toString().getBytes(StandardCharsets.UTF_8);
    }

    private byte[] exportXlsx(QuestionSet questionSet, List<ExportQuestionSetItem> rows) {
        try (Workbook workbook = new XSSFWorkbook();
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            Sheet sheet = workbook.createSheet("Bộ câu hỏi");
            CellStyle headerStyle = workbook.createCellStyle();
            Font headerFont = workbook.createFont();
            headerFont.setBold(true);
            headerStyle.setFont(headerFont);

            int rowIndex = 0;
            rowIndex = metadataRow(sheet, rowIndex, "Tên bộ", questionSet.getName());
            rowIndex = metadataRow(sheet, rowIndex, "Mã bộ", questionSet.getCode());
            rowIndex = metadataRow(sheet, rowIndex, "Trạng thái", QuestionGenerationLabels.questionSetStatus(questionSet.getStatus()));
            rowIndex = metadataRow(sheet, rowIndex, "Active version", questionSet.getActiveVersion() == null ? "" : String.valueOf(questionSet.getActiveVersion()));
            rowIndex++;

            Row header = sheet.createRow(rowIndex++);
            List<String> headers = List.of("STT", "Question ID", "Câu hỏi", "A", "B", "C", "D", "Đáp án", "Giải thích", "Độ khó", "Chủ đề", "Nguồn");
            for (int index = 0; index < headers.size(); index++) {
                header.createCell(index).setCellValue(headers.get(index));
                header.getCell(index).setCellStyle(headerStyle);
            }
            for (ExportQuestionSetItem item : rows) {
                Row row = sheet.createRow(rowIndex++);
                row.createCell(0).setCellValue(item.position());
                row.createCell(1).setCellValue(item.sourceQuestionId() == null ? "" : String.valueOf(item.sourceQuestionId()));
                row.createCell(2).setCellValue(blank(item.stem()));
                row.createCell(3).setCellValue(blank(item.optionA()));
                row.createCell(4).setCellValue(blank(item.optionB()));
                row.createCell(5).setCellValue(blank(item.optionC()));
                row.createCell(6).setCellValue(blank(item.optionD()));
                row.createCell(7).setCellValue(blank(item.correctAnswer()));
                row.createCell(8).setCellValue(blank(item.explanation()));
                row.createCell(9).setCellValue(blank(item.difficulty()));
                row.createCell(10).setCellValue(blank(item.topic()));
                row.createCell(11).setCellValue(blank(item.sourceDocument()));
            }
            for (int index = 0; index < headers.size(); index++) {
                sheet.autoSizeColumn(index);
            }
            workbook.write(output);
            return output.toByteArray();
        } catch (IOException ex) {
            throw new BadRequestException("Không thể export bộ câu hỏi XLSX");
        }
    }

    private byte[] exportDocx(QuestionSet questionSet, List<ExportQuestionSetItem> rows) {
        try (XWPFDocument document = new XWPFDocument();
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            addDocxParagraph(document, questionSet.getName(), true, 16);
            addDocxParagraph(document, "Mã bộ: " + blank(questionSet.getCode()), false, 11);
            addDocxParagraph(document, "Trạng thái: " + QuestionGenerationLabels.questionSetStatus(questionSet.getStatus()), false, 11);
            if (questionSet.getActiveVersion() != null) {
                addDocxParagraph(document, "Active version: " + questionSet.getActiveVersion(), false, 11);
            }
            addDocxParagraph(document, "", false, 11);
            for (ExportQuestionSetItem item : rows) {
                addDocxParagraph(document, "Câu " + item.position() + ". " + item.stem(), true, 11);
                addDocxParagraph(document, "A. " + blank(item.optionA()), false, 11);
                addDocxParagraph(document, "B. " + blank(item.optionB()), false, 11);
                addDocxParagraph(document, "C. " + blank(item.optionC()), false, 11);
                addDocxParagraph(document, "D. " + blank(item.optionD()), false, 11);
                addDocxParagraph(document, "Đáp án đúng: " + blank(item.correctAnswer()), true, 11);
                if (trimToNull(item.explanation()) != null) {
                    addDocxParagraph(document, "Giải thích: " + item.explanation(), false, 11);
                }
                addDocxParagraph(document, "", false, 11);
            }
            document.write(output);
            return output.toByteArray();
        } catch (IOException ex) {
            throw new BadRequestException("Không thể export bộ câu hỏi DOCX");
        }
    }

    private byte[] exportPdf(QuestionSet questionSet, List<ExportQuestionSetItem> rows) {
        try (PDDocument document = new PDDocument();
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            PDFont font = loadPdfFont(document);
            List<String> lines = exportTextLines(questionSet, rows).stream()
                    .flatMap(line -> wrapLine(line, PDF_MAX_CHARS_PER_LINE).stream())
                    .toList();
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
                    PDPage page = new PDPage(PDRectangle.A4);
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
            throw new BadRequestException("Không thể export bộ câu hỏi PDF");
        }
    }

    private List<String> exportTextLines(QuestionSet questionSet, List<ExportQuestionSetItem> rows) {
        List<String> lines = new ArrayList<>();
        lines.add(questionSet.getName());
        lines.add("Mã bộ: " + blank(questionSet.getCode()));
        lines.add("Trạng thái: " + QuestionGenerationLabels.questionSetStatus(questionSet.getStatus()));
        if (questionSet.getActiveVersion() != null) {
            lines.add("Active version: " + questionSet.getActiveVersion());
        }
        lines.add("");
        for (ExportQuestionSetItem item : rows) {
            lines.add("Câu " + item.position() + ". " + item.stem());
            lines.add("A. " + blank(item.optionA()));
            lines.add("B. " + blank(item.optionB()));
            lines.add("C. " + blank(item.optionC()));
            lines.add("D. " + blank(item.optionD()));
            lines.add("Đáp án đúng: " + blank(item.correctAnswer()));
            if (trimToNull(item.explanation()) != null) {
                lines.add("Giải thích: " + item.explanation());
            }
            lines.add("");
        }
        return lines;
    }

    private void replaceItems(QuestionSet questionSet, List<Long> questionIds) {
        List<QuestionBankQuestion> questions = resolveApprovedQuestions(questionIds);
        List<QuestionSetItem> existingItems = itemRepository.findByQuestionSetOrderByPositionAsc(questionSet);
        if (!existingItems.isEmpty()) {
            snapshotRepository.deleteByQuestionSetItemIn(existingItems);
            snapshotRepository.flush();
        }
        itemRepository.deleteByQuestionSet(questionSet);
        itemRepository.flush();
        int position = 1;
        for (QuestionBankQuestion question : questions) {
            itemRepository.save(QuestionSetItem.builder()
                    .questionSet(questionSet)
                    .question(question)
                    .position(position++)
                    .points(DEFAULT_POINTS)
                    .required(true)
                    .build());
        }
        questionSet.setQuestionCount(questions.size());
        questionSetRepository.save(questionSet);
    }

    private List<QuestionBankQuestion> resolveApprovedQuestions(List<Long> questionIds) {
        if (questionIds.isEmpty()) {
            return List.of();
        }
        List<QuestionBankQuestion> found = questionRepository.findAllById(questionIds);
        Map<Long, QuestionBankQuestion> byId = found.stream()
                .collect(Collectors.toMap(QuestionBankQuestion::getId, Function.identity()));
        List<QuestionBankQuestion> ordered = new ArrayList<>();
        for (Long id : questionIds) {
            QuestionBankQuestion question = byId.get(id);
            if (question == null) {
                throw new BadRequestException("Không tìm thấy câu hỏi #" + id);
            }
            if (question.getStatus() != QuestionBankStatus.APPROVED) {
                throw new BadRequestException("Chỉ được thêm câu hỏi đã duyệt vào bộ câu hỏi");
            }
            ordered.add(question);
        }
        return ordered;
    }

    private int duplicateVersionItems(QuestionSet target, List<QuestionSetVersionItem> sourceItems) {
        if (sourceItems == null || sourceItems.isEmpty()) {
            return 0;
        }
        List<Long> questionIds = sourceItems.stream()
                .map(QuestionSetVersionItem::getSourceQuestionId)
                .toList();
        Map<Long, QuestionBankQuestion> questionsById = resolveApprovedQuestions(questionIds).stream()
                .collect(Collectors.toMap(QuestionBankQuestion::getId, Function.identity()));
        for (QuestionSetVersionItem sourceItem : sourceItems) {
            itemRepository.save(QuestionSetItem.builder()
                    .questionSet(target)
                    .question(questionsById.get(sourceItem.getSourceQuestionId()))
                    .position(sourceItem.getPosition())
                    .points(sourceItem.getPoints() == null ? DEFAULT_POINTS : sourceItem.getPoints())
                    .required(Boolean.TRUE.equals(sourceItem.getRequired()))
                    .build());
        }
        return sourceItems.size();
    }

    private int duplicateLiveItems(QuestionSet target, List<QuestionSetItem> sourceItems) {
        if (sourceItems == null || sourceItems.isEmpty()) {
            return 0;
        }
        for (QuestionSetItem sourceItem : sourceItems) {
            itemRepository.save(QuestionSetItem.builder()
                    .questionSet(target)
                    .question(sourceItem.getQuestion())
                    .position(sourceItem.getPosition())
                    .points(sourceItem.getPoints() == null ? DEFAULT_POINTS : sourceItem.getPoints())
                    .required(Boolean.TRUE.equals(sourceItem.getRequired()))
                    .build());
        }
        return sourceItems.size();
    }

    private void createSnapshots(QuestionSet questionSet) {
        createSnapshots(questionSet, itemRepository.findByQuestionSetOrderByPositionAsc(questionSet));
    }

    private void createSnapshots(QuestionSet questionSet, List<QuestionSetItem> items) {
        LocalDateTime now = LocalDateTime.now();
        for (QuestionSetItem item : items) {
            if (snapshotRepository.existsByQuestionSetItem(item)) {
                continue;
            }
            QuestionBankQuestion question = item.getQuestion();
            snapshotRepository.save(QuestionSetItemSnapshot.builder()
                    .questionSetItem(item)
                    .stem(question.getStem())
                    .optionA(question.getOptionA())
                    .optionB(question.getOptionB())
                    .optionC(question.getOptionC())
                    .optionD(question.getOptionD())
                    .correctAnswer(question.getCorrectAnswer())
                    .explanation(question.getExplanation())
                    .sourceDocument(question.getSourceDocument())
                    .snapshotAt(now)
                    .build());
        }
        questionSet.setQuestionCount(items.size());
    }

    private QuestionSetVersion createSnapshotVersion(QuestionSet questionSet, String actor) {
        return createSnapshotVersion(questionSet, itemRepository.findByQuestionSetOrderByPositionAsc(questionSet), actor);
    }

    private QuestionSetVersion createSnapshotVersion(QuestionSet questionSet, List<QuestionSetItem> items, String actor) {
        validateActivatableItems(items);
        LocalDateTime now = LocalDateTime.now();
        int nextVersion = versionRepository.findTopByQuestionSetOrderByVersionDesc(questionSet)
                .map(version -> version.getVersion() + 1)
                .orElse(1);
        QuestionSetVersion version = versionRepository.save(QuestionSetVersion.builder()
                .questionSet(questionSet)
                .version(nextVersion)
                .questionCount(items.size())
                .snapshotAt(now)
                .activatedBy(actor)
                .build());
        for (QuestionSetItem item : items) {
            QuestionBankQuestion question = item.getQuestion();
            versionItemRepository.save(QuestionSetVersionItem.builder()
                    .questionSetVersion(version)
                    .sourceQuestionId(question.getId())
                    .position(item.getPosition())
                    .points(item.getPoints() == null ? DEFAULT_POINTS : item.getPoints())
                    .required(Boolean.TRUE.equals(item.getRequired()))
                    .stem(question.getStem())
                    .optionA(question.getOptionA())
                    .optionB(question.getOptionB())
                    .optionC(question.getOptionC())
                    .optionD(question.getOptionD())
                    .correctAnswer(question.getCorrectAnswer())
                    .explanation(question.getExplanation())
                    .difficulty(question.getDifficulty())
                    .topic(question.getTopic())
                    .sourceDocument(question.getSourceDocument())
                    .build());
        }
        questionSet.setActiveVersion(nextVersion);
        questionSet.setSnapshotAt(now);
        questionSet.setQuestionCount(items.size());
        questionSetRepository.save(questionSet);
        return version;
    }

    private void validateActivatableItems(List<QuestionSetItem> items) {
        if (items.isEmpty()) {
            throw new BadRequestException("Không thể kích hoạt bộ câu hỏi rỗng");
        }
        for (QuestionSetItem item : items) {
            QuestionBankQuestion question = item.getQuestion();
            if (question == null || question.getStatus() != QuestionBankStatus.APPROVED) {
                throw new BadRequestException("Bộ câu hỏi chỉ được kích hoạt khi tất cả câu hỏi đã duyệt");
            }
        }
    }

    private QuestionSetVersion findActiveVersion(QuestionSet questionSet) {
        List<QuestionSetVersion> versions = versionRepository.findByQuestionSetOrderByVersionDesc(questionSet);
        if (versions.isEmpty()) {
            return null;
        }
        return versions.stream()
                .filter(version -> Objects.equals(version.getVersion(), questionSet.getActiveVersion()))
                .findFirst()
                .orElse(versions.get(0));
    }

    private QuestionSetDetailResponse toDetail(QuestionSet questionSet) {
        List<QuestionSetVersion> versions = versionRepository.findByQuestionSetOrderByVersionDesc(questionSet);
        QuestionSetVersion activeVersion = findActiveVersion(questionSet);
        List<QuestionSetSnapshotItemResponse> activeSnapshotItems = activeVersion == null
                ? List.of()
                : versionItemRepository.findByQuestionSetVersionOrderByPositionAsc(activeVersion).stream()
                .map(this::toSnapshotItemResponse)
                .toList();
        List<QuestionSetItemResponse> items = itemRepository.findByQuestionSetOrderByPositionAsc(questionSet).stream()
                .map(item -> new QuestionSetItemResponse(
                        item.getId(),
                        item.getPosition(),
                        item.getPoints(),
                        item.getRequired(),
                        questionMapper.toQuestionResponse(item.getQuestion())
                ))
                .toList();
        return new QuestionSetDetailResponse(
                questionSet.getId(),
                questionSet.getCode(),
                questionSet.getName(),
                questionSet.getDescription(),
                questionSet.getCategory(),
                questionSet.getDifficulty(),
                questionSet.getStatus().name(),
                QuestionGenerationLabels.questionSetStatus(questionSet.getStatus()),
                questionSet.getQuestionCount(),
                items,
                questionSet.getActiveVersion(),
                questionSet.getSnapshotAt(),
                versions.stream().map(this::toVersionSummaryResponse).toList(),
                activeSnapshotItems,
                questionSet.getCreatedAt(),
                questionSet.getUpdatedAt()
        );
    }

    private QuestionSetVersionSummaryResponse toVersionSummaryResponse(QuestionSetVersion version) {
        return new QuestionSetVersionSummaryResponse(
                version.getId(),
                version.getVersion(),
                version.getQuestionCount(),
                version.getSnapshotAt(),
                version.getActivatedBy()
        );
    }

    private QuestionSetSnapshotItemResponse toSnapshotItemResponse(QuestionSetVersionItem item) {
        return new QuestionSetSnapshotItemResponse(
                item.getId(),
                item.getSourceQuestionId(),
                item.getPosition(),
                item.getPoints(),
                item.getRequired(),
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
        );
    }

    private QuestionSetSummaryResponse toSummary(QuestionSet questionSet) {
        return new QuestionSetSummaryResponse(
                questionSet.getId(),
                questionSet.getCode(),
                questionSet.getName(),
                questionSet.getDescription(),
                questionSet.getCategory(),
                questionSet.getDifficulty(),
                questionSet.getStatus().name(),
                QuestionGenerationLabels.questionSetStatus(questionSet.getStatus()),
                questionSet.getQuestionCount(),
                questionSet.getCreatedAt(),
                questionSet.getUpdatedAt()
        );
    }

    private String normalizeExportFormat(String format) {
        String normalized = trimToNull(format);
        return normalized == null ? "csv" : normalized.toLowerCase(Locale.ROOT);
    }

    private String csv(Object value) {
        String text = value == null ? "" : String.valueOf(value);
        return "\"" + text.replace("\"", "\"\"") + "\"";
    }

    private int metadataRow(Sheet sheet, int rowIndex, String label, String value) {
        Row row = sheet.createRow(rowIndex);
        row.createCell(0).setCellValue(label);
        row.createCell(1).setCellValue(value == null ? "" : value);
        return rowIndex + 1;
    }

    private void addDocxParagraph(XWPFDocument document, String text, boolean bold, int fontSize) {
        XWPFParagraph paragraph = document.createParagraph();
        XWPFRun run = paragraph.createRun();
        run.setBold(bold);
        run.setFontSize(fontSize);
        run.setText(text == null ? "" : text);
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

    private String blank(String value) {
        return value == null ? "" : value;
    }

    private QuestionSet findSet(Long setId) {
        return questionSetRepository.findById(setId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy bộ câu hỏi"));
    }

    private List<Long> normalizedQuestionIds(List<Long> ids) {
        if (ids == null || ids.isEmpty()) {
            return List.of();
        }
        LinkedHashSet<Long> unique = new LinkedHashSet<>();
        for (Long id : ids) {
            if (id == null) {
                continue;
            }
            if (!unique.add(id)) {
                throw new BadRequestException("Danh sách câu hỏi không được trùng");
            }
        }
        return new ArrayList<>(unique);
    }

    private QuestionSetStatus parseStatus(String value, QuestionSetStatus fallback) {
        if (value == null || value.isBlank()) {
            return fallback;
        }
        try {
            return QuestionSetStatus.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (Exception ex) {
            throw new BadRequestException("Trạng thái bộ câu hỏi không hợp lệ");
        }
    }

    private QuestionSetStatus parseStatusOrNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return QuestionSetStatus.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (Exception ex) {
            return null;
        }
    }

    private String required(String value, String message) {
        String trimmed = trimToNull(value);
        if (trimmed == null) {
            throw new BadRequestException(message);
        }
        return trimmed;
    }

    private String trimToNull(String value) {
        if (value == null || value.trim().isEmpty()) {
            return null;
        }
        return value.trim();
    }

    private String uniqueCopyCode(String sourceCode, Long sourceId) {
        String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss"));
        String base = trimToNull(sourceCode) == null
                ? "COPY-QS-" + sourceId + "-" + timestamp
                : "COPY-" + sourceCode + "-" + timestamp;
        if (base.length() > 60) {
            base = base.substring(0, 60);
        }
        String code = base;
        int suffix = 1;
        while (questionSetRepository.findByCode(code).isPresent()) {
            String tail = "-" + suffix++;
            code = base.substring(0, Math.min(base.length(), 64 - tail.length())) + tail;
        }
        return code;
    }

    private String generateCode() {
        String datePart = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        for (int attempt = 0; attempt < 10; attempt++) {
            String code = "QS-" + datePart + "-" + String.format("%03d", ThreadLocalRandom.current().nextInt(100, 999));
            if (questionSetRepository.findByCode(code).isEmpty()) {
                return code;
            }
        }
        throw new BadRequestException("Không thể sinh mã bộ câu hỏi tự động, vui lòng thử lại");
    }

    private String normalize(String value) {
        String withoutMarks = Normalizer.normalize(value == null ? "" : value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "");
        return withoutMarks
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^\\p{L}\\p{N}\\s]", " ")
                .replaceAll("\\s+", " ")
                .trim();
    }

    private record ExportQuestionSetItem(
            Long sourceQuestionId,
            Integer position,
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
