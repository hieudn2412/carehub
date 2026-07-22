package vn.vietduc.carehubbackend.training.service;

import net.coobird.thumbnailator.Thumbnails;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.cos.COSBase;
import org.apache.pdfbox.cos.COSName;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDResources;
import org.apache.pdfbox.pdmodel.graphics.PDXObject;
import org.apache.pdfbox.pdmodel.graphics.form.PDFormXObject;
import org.apache.pdfbox.pdmodel.graphics.image.JPEGFactory;
import org.apache.pdfbox.pdmodel.graphics.image.LosslessFactory;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.apache.pdfbox.pdmodel.encryption.InvalidPasswordException;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import vn.vietduc.carehubbackend.exception.ValidationException;

import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Collections;
import java.util.HexFormat;
import java.util.IdentityHashMap;
import java.util.Iterator;
import java.util.Locale;
import java.util.Set;

@Service
public class EvidenceOptimizationService {
    static final long MAX_INPUT_SIZE_BYTES = 20L * 1024L * 1024L;
    static final long MAX_STORED_SIZE_BYTES = 5L * 1024L * 1024L;
    static final int MAX_IMAGE_DIMENSION = 2048;
    static final long MAX_IMAGE_PIXELS = 40_000_000L;
    static final long MAX_PDF_IMAGE_PIXELS = 150_000_000L;
    static final int MAX_PDF_PAGES = 100;
    static final float JPEG_QUALITY = 0.82f;

    private static final Set<String> ALLOWED_EXTENSIONS = Set.of("jpg", "jpeg", "png", "pdf");
    private static final Set<String> ALLOWED_MIME_TYPES = Set.of("image/jpeg", "image/png", "application/pdf");

    public OptimizedEvidence optimize(MultipartFile file) {
        byte[] originalBytes = readAndValidateSize(file);
        String originalFilename = sanitizeFilename(file.getOriginalFilename());
        String extension = extensionOf(originalFilename);
        String detectedMimeType = detectMimeType(originalBytes);
        String declaredMimeType = normalizeMimeType(file.getContentType());

        if (!ALLOWED_EXTENSIONS.contains(extension)
                || !ALLOWED_MIME_TYPES.contains(detectedMimeType)
                || !detectedMimeType.equals(declaredMimeType)
                || !extensionMatchesMime(extension, detectedMimeType)) {
            throw ValidationException.field(
                    "file",
                    "Evidence file content must match an allowed JPG, PNG, or PDF"
            );
        }

        byte[] candidate = switch (detectedMimeType) {
            case "image/jpeg" -> optimizeImage(originalBytes, "jpg");
            case "image/png" -> optimizeImage(originalBytes, "png");
            case "application/pdf" -> optimizePdf(originalBytes);
            default -> throw ValidationException.field("file", "Unsupported evidence file type");
        };
        byte[] storedBytes = candidate.length < originalBytes.length ? candidate : originalBytes;
        if (storedBytes.length > MAX_STORED_SIZE_BYTES) {
            throw ValidationException.field(
                    "file",
                    "Evidence file could not be optimized below the 5 MB storage limit"
            );
        }

        return new OptimizedEvidence(
                originalFilename,
                detectedMimeType,
                originalBytes.length,
                storedBytes,
                sha256(originalBytes),
                sha256(storedBytes),
                storedBytes.length < originalBytes.length
        );
    }

    private byte[] readAndValidateSize(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw ValidationException.field("file", "Evidence file must not be empty");
        }
        if (file.getSize() > MAX_INPUT_SIZE_BYTES) {
            throw ValidationException.field("file", "Evidence file must not exceed 20 MB");
        }
        try {
            byte[] bytes = file.getBytes();
            if (bytes.length == 0 || bytes.length > MAX_INPUT_SIZE_BYTES) {
                throw ValidationException.field("file", "Evidence file must be between 1 byte and 20 MB");
            }
            return bytes;
        } catch (IOException ex) {
            throw ValidationException.field("file", "Could not read evidence file");
        }
    }

    private byte[] optimizeImage(byte[] bytes, String outputFormat) {
        ImageDimensions dimensions = readImageDimensions(bytes);
        validatePixelCount(dimensions.width(), dimensions.height(), MAX_IMAGE_PIXELS, "Image dimensions are too large");
        try (ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            var builder = Thumbnails.of(new ByteArrayInputStream(bytes))
                    .size(MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION)
                    .keepAspectRatio(true)
                    .useExifOrientation(true)
                    .outputFormat(outputFormat);
            if ("jpg".equals(outputFormat)) {
                builder.outputQuality(JPEG_QUALITY);
            }
            builder.toOutputStream(output);
            return output.toByteArray();
        } catch (IOException | RuntimeException ex) {
            throw ValidationException.field("file", "Evidence image is invalid or could not be optimized");
        }
    }

    private byte[] optimizePdf(byte[] bytes) {
        try (PDDocument document = Loader.loadPDF(bytes)) {
            if (document.isEncrypted()) {
                throw ValidationException.field("file", "Encrypted PDF evidence is not supported");
            }
            if (document.getNumberOfPages() > MAX_PDF_PAGES) {
                throw ValidationException.field("file", "PDF evidence must not exceed 100 pages");
            }

            long[] totalPixels = {0L};
            Set<COSBase> visited = Collections.newSetFromMap(new IdentityHashMap<>());
            for (PDPage page : document.getPages()) {
                optimizePdfResources(document, page.getResources(), visited, totalPixels);
            }

            try (ByteArrayOutputStream output = new ByteArrayOutputStream()) {
                document.save(output);
                byte[] optimized = output.toByteArray();
                try (PDDocument verification = Loader.loadPDF(optimized)) {
                    if (verification.getNumberOfPages() != document.getNumberOfPages()) {
                        throw ValidationException.field("file", "Optimized PDF evidence is invalid");
                    }
                }
                return optimized;
            }
        } catch (InvalidPasswordException ex) {
            throw ValidationException.field("file", "Encrypted PDF evidence is not supported");
        } catch (ValidationException ex) {
            throw ex;
        } catch (IOException | RuntimeException ex) {
            throw ValidationException.field("file", "PDF evidence is invalid or could not be optimized");
        }
    }

    private void optimizePdfResources(
            PDDocument document,
            PDResources resources,
            Set<COSBase> visited,
            long[] totalPixels
    ) throws IOException {
        if (resources == null) {
            return;
        }
        for (COSName name : resources.getXObjectNames()) {
            PDXObject object = resources.getXObject(name);
            if (object == null || !visited.add(object.getCOSObject())) {
                continue;
            }
            if (object instanceof PDFormXObject form) {
                optimizePdfResources(document, form.getResources(), visited, totalPixels);
                continue;
            }
            if (!(object instanceof PDImageXObject image)) {
                continue;
            }

            long pixels = validatePixelCount(
                    image.getWidth(),
                    image.getHeight(),
                    MAX_IMAGE_PIXELS,
                    "A PDF image has dimensions that are too large"
            );
            totalPixels[0] += pixels;
            if (totalPixels[0] > MAX_PDF_IMAGE_PIXELS) {
                throw ValidationException.field("file", "PDF evidence contains too many raster image pixels");
            }
            if (image.getWidth() <= MAX_IMAGE_DIMENSION && image.getHeight() <= MAX_IMAGE_DIMENSION) {
                continue;
            }

            BufferedImage source = image.getImage();
            BufferedImage resized = Thumbnails.of(source)
                    .size(MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION)
                    .keepAspectRatio(true)
                    .asBufferedImage();
            String suffix = image.getSuffix() == null ? "" : image.getSuffix().toLowerCase(Locale.ROOT);
            boolean jpegSource = suffix.equals("jpg") || suffix.equals("jpeg");
            boolean losslessRequired = resized.getColorModel().hasAlpha()
                    || resized.getColorModel().getPixelSize() <= 1
                    || !jpegSource;
            PDImageXObject replacement = losslessRequired
                    ? LosslessFactory.createFromImage(document, resized)
                    : JPEGFactory.createFromImage(document, resized, JPEG_QUALITY);
            replacement.setInterpolate(image.getInterpolate());
            resources.put(name, replacement);
        }
    }

    private ImageDimensions readImageDimensions(byte[] bytes) {
        try (ImageInputStream input = ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))) {
            Iterator<ImageReader> readers = ImageIO.getImageReaders(input);
            if (!readers.hasNext()) {
                throw ValidationException.field("file", "Evidence image is invalid");
            }
            ImageReader reader = readers.next();
            try {
                reader.setInput(input, true, true);
                return new ImageDimensions(reader.getWidth(0), reader.getHeight(0));
            } finally {
                reader.dispose();
            }
        } catch (IOException ex) {
            throw ValidationException.field("file", "Evidence image is invalid");
        }
    }

    private long validatePixelCount(int width, int height, long maximum, String message) {
        if (width <= 0 || height <= 0) {
            throw ValidationException.field("file", "Evidence image has invalid dimensions");
        }
        long pixels = (long) width * height;
        if (pixels > maximum) {
            throw ValidationException.field("file", message);
        }
        return pixels;
    }

    private String detectMimeType(byte[] bytes) {
        if (bytes.length >= 3
                && (bytes[0] & 0xFF) == 0xFF
                && (bytes[1] & 0xFF) == 0xD8
                && (bytes[2] & 0xFF) == 0xFF) {
            return "image/jpeg";
        }
        if (bytes.length >= 8
                && (bytes[0] & 0xFF) == 0x89
                && bytes[1] == 0x50
                && bytes[2] == 0x4E
                && bytes[3] == 0x47
                && bytes[4] == 0x0D
                && bytes[5] == 0x0A
                && bytes[6] == 0x1A
                && bytes[7] == 0x0A) {
            return "image/png";
        }
        if (bytes.length >= 5
                && bytes[0] == '%'
                && bytes[1] == 'P'
                && bytes[2] == 'D'
                && bytes[3] == 'F'
                && bytes[4] == '-') {
            return "application/pdf";
        }
        return "application/octet-stream";
    }

    private boolean extensionMatchesMime(String extension, String mimeType) {
        return switch (mimeType) {
            case "image/jpeg" -> extension.equals("jpg") || extension.equals("jpeg");
            case "image/png" -> extension.equals("png");
            case "application/pdf" -> extension.equals("pdf");
            default -> false;
        };
    }

    private String normalizeMimeType(String mimeType) {
        if (mimeType == null) {
            return "";
        }
        int separator = mimeType.indexOf(';');
        return (separator < 0 ? mimeType : mimeType.substring(0, separator)).trim().toLowerCase(Locale.ROOT);
    }

    private String sanitizeFilename(String filename) {
        String value = filename == null || filename.isBlank() ? "evidence" : filename;
        value = value.replace('\\', '/');
        int slashIndex = value.lastIndexOf('/');
        if (slashIndex >= 0) {
            value = value.substring(slashIndex + 1);
        }
        value = value.replaceAll("[^A-Za-z0-9._-]", "_");
        if (value.length() > 160) {
            String extension = extensionOf(value);
            int keep = extension.isBlank() ? 160 : Math.max(1, 159 - extension.length());
            value = value.substring(0, keep) + (extension.isBlank() ? "" : "." + extension);
        }
        return value.isBlank() ? "evidence" : value;
    }

    private String extensionOf(String filename) {
        int dotIndex = filename.lastIndexOf('.');
        if (dotIndex < 0 || dotIndex == filename.length() - 1) {
            return "";
        }
        return filename.substring(dotIndex + 1).toLowerCase(Locale.ROOT);
    }

    private String sha256(byte[] bytes) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 is not available", ex);
        }
    }

    public record OptimizedEvidence(
            String originalFilename,
            String mimeType,
            long originalFileSizeBytes,
            byte[] storedBytes,
            String originalChecksumSha256,
            String storedChecksumSha256,
            boolean optimized
    ) {
        public long storedFileSizeBytes() {
            return storedBytes.length;
        }
    }

    private record ImageDimensions(int width, int height) {
    }
}
