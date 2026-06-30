package vn.vietduc.carehubbackend.questiongeneration.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import vn.vietduc.carehubbackend.exception.BadRequestException;
import vn.vietduc.carehubbackend.exception.ResourceNotFoundException;
import vn.vietduc.carehubbackend.questiongeneration.config.DocumentProcessingProperties;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.DocumentResponse;
import vn.vietduc.carehubbackend.questiongeneration.entity.DocumentChunk;
import vn.vietduc.carehubbackend.questiongeneration.entity.DocumentSection;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionDocument;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.DocumentChunkType;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.DocumentStatus;
import vn.vietduc.carehubbackend.questiongeneration.repository.DocumentChunkRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.DocumentSectionRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.QuestionDocumentRepository;
import vn.vietduc.carehubbackend.questiongeneration.service.model.ChunkDraft;
import vn.vietduc.carehubbackend.questiongeneration.service.model.ExtractedDocument;
import vn.vietduc.carehubbackend.questiongeneration.service.model.NormalizedParagraph;
import vn.vietduc.carehubbackend.questiongeneration.service.model.SectionBlock;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class QuestionDocumentService {
    private final QuestionDocumentRepository documentRepository;
    private final DocumentSectionRepository sectionRepository;
    private final DocumentChunkRepository chunkRepository;
    private final DocumentTextExtractor textExtractor;
    private final DocumentTextPreprocessor textPreprocessor;
    private final DocumentSectionDetectionService sectionDetectionService;
    private final DocumentChunkingService chunkingService;
    private final DocumentQuestionMapper mapper;
    private final DocumentProcessingProperties properties;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public Page<DocumentResponse> list(Pageable pageable) {
        return documentRepository.findAll(pageable)
                .map(document -> mapper.toDocumentResponse(document, List.of(), List.of()));
    }

    @Transactional(readOnly = true)
    public DocumentResponse get(Long documentId) {
        QuestionDocument document = findDocument(documentId);
        return mapper.toDocumentResponse(
                document,
                sectionRepository.findByDocumentOrderByOrderIndexAsc(document),
                chunkRepository.findByDocumentOrderByChunkIndexAsc(document)
        );
    }

    @Transactional
    public DocumentResponse upload(MultipartFile file, String actor) {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("Tệp tài liệu không được để trống");
        }
        String filename = safeFilename(file.getOriginalFilename());
        validateSupportedFile(filename);
        byte[] bytes = readBytes(file);
        String contentHash = sha256(bytes);
        String storagePath = storeOriginalFile(bytes, contentHash, filename);

        ExtractedDocument extracted = textExtractor.extract(bytes, filename);
        QuestionDocument document = QuestionDocument.builder()
                .filename(filename)
                .contentType(file.getContentType())
                .status(DocumentStatus.READY)
                .pageCount(extracted.pageCount())
                .chunkCount(0)
                .contentHash(contentHash)
                .storagePath(storagePath)
                .createdBy(actor)
                .build();

        if (extracted.errorMessage() != null) {
            document.setStatus(DocumentStatus.FAILED);
            document.setErrorMessage(extracted.errorMessage());
            return mapper.toDocumentResponse(documentRepository.save(document), List.of(), List.of());
        }
        if (extracted.ocrRequired()) {
            document.setStatus(DocumentStatus.OCR_REQUIRED);
            document.setErrorMessage("PDF chưa có text layer đủ tin cậy, cần OCR trước khi tạo câu hỏi");
            return mapper.toDocumentResponse(documentRepository.save(document), List.of(), List.of());
        }

        List<NormalizedParagraph> paragraphs = textPreprocessor.preprocessPages(extracted.pages());
        if (paragraphs.isEmpty()) {
            document.setStatus(DocumentStatus.FAILED);
            document.setErrorMessage("Không tìm thấy nội dung văn bản hữu ích trong tài liệu");
            return mapper.toDocumentResponse(documentRepository.save(document), List.of(), List.of());
        }

        List<SectionBlock> sectionBlocks = sectionDetectionService.detectSections(paragraphs);
        List<ChunkDraft> chunkDrafts = chunkingService.createGenerationChunks(sectionBlocks);
        if (chunkDrafts.isEmpty()) {
            document.setStatus(DocumentStatus.FAILED);
            document.setErrorMessage("Không tạo được chunk sinh câu hỏi từ nội dung tài liệu");
            return mapper.toDocumentResponse(documentRepository.save(document), List.of(), List.of());
        }

        QuestionDocument saved = documentRepository.save(document);
        List<DocumentSection> sections = persistSections(saved, sectionBlocks);
        List<DocumentChunk> chunks = persistChunks(saved, sections, chunkDrafts);
        saved.setChunkCount(chunks.size());
        QuestionDocument updated = documentRepository.save(saved);
        return mapper.toDocumentResponse(updated, sections, chunks);
    }

    @Transactional(readOnly = true)
    public QuestionDocument findDocument(Long documentId) {
        return documentRepository.findById(documentId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy tài liệu"));
    }

    private List<DocumentSection> persistSections(QuestionDocument document, List<SectionBlock> blocks) {
        Map<Integer, SectionBlock> byOrder = blocks.stream()
                .collect(Collectors.toMap(SectionBlock::orderIndex, block -> block));
        List<DocumentSection> sections = new ArrayList<>();
        Map<Integer, DocumentSection> savedByOrder = new java.util.HashMap<>();
        for (SectionBlock block : blocks) {
            DocumentSection parent = block.parentOrderIndex() == null ? null : savedByOrder.get(block.parentOrderIndex());
            if (block.parentOrderIndex() != null && parent == null && byOrder.containsKey(block.parentOrderIndex())) {
                parent = savedByOrder.get(block.parentOrderIndex());
            }
            DocumentSection section = DocumentSection.builder()
                    .document(document)
                    .parent(parent)
                    .title(block.title())
                    .level(block.level())
                    .orderIndex(block.orderIndex())
                    .pageStart(block.pageStart())
                    .pageEnd(block.pageEnd())
                    .path(block.path())
                    .confidence(block.confidence())
                    .build();
            DocumentSection saved = sectionRepository.save(section);
            sections.add(saved);
            savedByOrder.put(block.orderIndex(), saved);
        }
        return sections;
    }

    private List<DocumentChunk> persistChunks(
            QuestionDocument document,
            List<DocumentSection> sections,
            List<ChunkDraft> drafts
    ) {
        Map<Integer, DocumentSection> sectionsByOrder = sections.stream()
                .collect(Collectors.toMap(DocumentSection::getOrderIndex, section -> section));
        List<DocumentChunk> chunks = new ArrayList<>();
        for (int i = 0; i < drafts.size(); i++) {
            ChunkDraft draft = drafts.get(i);
            DocumentChunk chunk = DocumentChunk.builder()
                    .document(document)
                    .section(sectionsByOrder.get(draft.sectionOrderIndex()))
                    .chunkIndex(i)
                    .chunkType(DocumentChunkType.generation)
                    .pageStart(draft.pageStart())
                    .pageEnd(draft.pageEnd())
                    .sectionTitle(draft.sectionTitle())
                    .sectionPath(draft.sectionPath())
                    .text(draft.text())
                    .textHash(sha256(draft.text().getBytes(java.nio.charset.StandardCharsets.UTF_8)))
                    .charCount(draft.text().length())
                    .tokenCount(draft.tokenCount())
                    .qualityFlags(toJson(draft.qualityFlags()))
                    .build();
            chunks.add(chunkRepository.save(chunk));
        }
        for (int i = 0; i < chunks.size(); i++) {
            DocumentChunk chunk = chunks.get(i);
            chunk.setPreviousChunkId(i == 0 ? null : chunks.get(i - 1).getId());
            chunk.setNextChunkId(i == chunks.size() - 1 ? null : chunks.get(i + 1).getId());
        }
        return chunkRepository.saveAll(chunks);
    }

    private void validateSupportedFile(String filename) {
        String extension = extensionOf(filename);
        boolean supported = properties.getSupportedFileTypes().stream()
                .anyMatch(type -> type.equalsIgnoreCase(extension));
        if (!supported) {
            throw new BadRequestException("Định dạng tài liệu chưa được hỗ trợ: " + extension);
        }
    }

    private String safeFilename(String filename) {
        if (filename == null || filename.isBlank()) {
            return "document";
        }
        return Path.of(filename).getFileName().toString().replaceAll("[\\\\/:*?\"<>|]", "_");
    }

    private String extensionOf(String filename) {
        if (filename == null || !filename.contains(".")) {
            return "";
        }
        return filename.substring(filename.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT);
    }

    private byte[] readBytes(MultipartFile file) {
        try {
            return file.getBytes();
        } catch (IOException ex) {
            throw new BadRequestException("Không thể đọc tệp tài liệu");
        }
    }

    private String storeOriginalFile(byte[] bytes, String contentHash, String filename) {
        try {
            Files.createDirectories(properties.getStoragePath());
            String targetName = contentHash.substring(0, 16) + "-" + filename;
            Path target = properties.getStoragePath().resolve(targetName).normalize();
            Files.write(target, bytes);
            return target.toString();
        } catch (IOException ex) {
            throw new BadRequestException("Không thể lưu tệp tài liệu gốc");
        }
    }

    private String sha256(byte[] bytes) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(bytes));
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 is not available", ex);
        }
    }

    private String toJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException ex) {
            return "[]";
        }
    }
}
