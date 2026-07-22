package vn.vietduc.carehubbackend.training.service;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.apache.pdfbox.pdmodel.graphics.image.JPEGFactory;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import vn.vietduc.carehubbackend.exception.ValidationException;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class EvidenceOptimizationServiceTest {
    private final EvidenceOptimizationService service = new EvidenceOptimizationService();

    @Test
    void resizesAndCompressesLargeJpeg() throws Exception {
        byte[] original = imageBytes(3000, 2200, BufferedImage.TYPE_INT_RGB, "jpg");

        EvidenceOptimizationService.OptimizedEvidence result = service.optimize(
                new MockMultipartFile("file", "certificate.jpg", "image/jpeg", original)
        );

        BufferedImage stored = ImageIO.read(new ByteArrayInputStream(result.storedBytes()));
        assertNotNull(stored);
        assertTrue(stored.getWidth() <= EvidenceOptimizationService.MAX_IMAGE_DIMENSION);
        assertTrue(stored.getHeight() <= EvidenceOptimizationService.MAX_IMAGE_DIMENSION);
        assertTrue(result.storedFileSizeBytes() <= result.originalFileSizeBytes());
        assertEquals("image/jpeg", result.mimeType());
    }

    @Test
    void preservesPngTransparency() throws Exception {
        byte[] original = imageBytes(2300, 1200, BufferedImage.TYPE_INT_ARGB, "png");

        EvidenceOptimizationService.OptimizedEvidence result = service.optimize(
                new MockMultipartFile("file", "scan.png", "image/png", original)
        );

        BufferedImage stored = ImageIO.read(new ByteArrayInputStream(result.storedBytes()));
        assertNotNull(stored);
        assertTrue(stored.getColorModel().hasAlpha());
        assertTrue(stored.getWidth() <= EvidenceOptimizationService.MAX_IMAGE_DIMENSION);
        assertEquals("image/png", result.mimeType());
    }

    @Test
    void optimizesPdfImagesWithoutFlatteningText() throws Exception {
        byte[] original = pdfWithLargeImage();

        EvidenceOptimizationService.OptimizedEvidence result = service.optimize(
                new MockMultipartFile("file", "certificate.pdf", "application/pdf", original)
        );

        try (PDDocument stored = Loader.loadPDF(result.storedBytes())) {
            assertEquals(1, stored.getNumberOfPages());
            assertTrue(new PDFTextStripper().getText(stored).contains("Training certificate"));
        }
        assertTrue(result.storedFileSizeBytes() <= result.originalFileSizeBytes());
    }

    @Test
    void rejectsInputAboveTwentyMegabytes() {
        byte[] tooLarge = new byte[(int) EvidenceOptimizationService.MAX_INPUT_SIZE_BYTES + 1];

        assertThrows(ValidationException.class, () -> service.optimize(
                new MockMultipartFile("file", "large.jpg", "image/jpeg", tooLarge)
        ));
    }

    @Test
    void rejectsContentThatDoesNotMatchDeclaredType() {
        assertThrows(ValidationException.class, () -> service.optimize(
                new MockMultipartFile("file", "fake.pdf", "application/pdf", new byte[]{1, 2, 3, 4})
        ));
    }

    private byte[] imageBytes(int width, int height, int type, String format) throws Exception {
        BufferedImage image = new BufferedImage(width, height, type);
        Graphics2D graphics = image.createGraphics();
        graphics.setColor(new Color(25, 100, 190, type == BufferedImage.TYPE_INT_ARGB ? 160 : 255));
        graphics.fillRect(0, 0, width, height);
        graphics.setColor(Color.WHITE);
        graphics.drawString("CareHub evidence", 50, 80);
        graphics.dispose();
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        ImageIO.write(image, format, output);
        return output.toByteArray();
    }

    private byte[] pdfWithLargeImage() throws Exception {
        try (PDDocument document = new PDDocument()) {
            PDPage page = new PDPage(PDRectangle.A4);
            document.addPage(page);
            BufferedImage image = new BufferedImage(2600, 1800, BufferedImage.TYPE_INT_RGB);
            Graphics2D graphics = image.createGraphics();
            graphics.setColor(new Color(230, 240, 250));
            graphics.fillRect(0, 0, image.getWidth(), image.getHeight());
            graphics.dispose();
            var pdfImage = JPEGFactory.createFromImage(document, image, 0.92f);
            try (PDPageContentStream content = new PDPageContentStream(document, page)) {
                content.drawImage(pdfImage, 40, 300, 515, 350);
                content.beginText();
                content.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA), 12);
                content.newLineAtOffset(40, 270);
                content.showText("Training certificate");
                content.endText();
            }
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            document.save(output);
            return output.toByteArray();
        }
    }
}
