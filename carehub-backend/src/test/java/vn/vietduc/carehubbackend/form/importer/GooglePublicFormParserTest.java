package vn.vietduc.carehubbackend.form.importer;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;
import vn.vietduc.carehubbackend.exception.BadRequestException;
import vn.vietduc.carehubbackend.form.importer.parser.GoogleFormModel;
import vn.vietduc.carehubbackend.form.importer.parser.GooglePublicFormParser;

import static org.junit.jupiter.api.Assertions.*;

class GooglePublicFormParserTest {
    private final GooglePublicFormParser parser = new GooglePublicFormParser(new ObjectMapper());

    @Test
    void extractsTitleDescriptionItemsAndRequiredFlag() {
        String payload = "[null,[\"Mô tả\",[[11,\"Câu hỏi\",null,0,[[101,null,1]]]],null,null,null,null,null,null,\"Biểu mẫu thử\"],null,\"Tên tài liệu\"]";
        GoogleFormModel result = parser.parse("FORM_ID", "<script>var FB_PUBLIC_LOAD_DATA_ = " + payload + ";</script>");

        assertEquals("Biểu mẫu thử", result.title());
        assertEquals("Mô tả", result.description());
        assertEquals(1, result.items().size());
        assertEquals(101L, result.items().get(0).entries().get(0).id());
        assertTrue(result.items().get(0).entries().get(0).required());
    }

    @Test
    void rejectsPagesWithoutPublicPayload() {
        assertThrows(BadRequestException.class, () -> parser.parse("FORM_ID", "<html></html>"));
    }

    @Test
    void acceptsUnescapedControlCharactersFromGoogleJavascriptPayload() {
        String payload = "[null,[\"Mô tả\",[[11,\"5.\tĐánh giá\r\nquá trình\",null,0,[[101,null,1]]]],null,null,null,null,null,null,\"Biểu mẫu thử\"],null,\"Tên tài liệu\"]";

        GoogleFormModel result = parser.parse(
                "FORM_ID", "<script>var FB_PUBLIC_LOAD_DATA_ = " + payload + ";</script>");

        assertEquals("5.\tĐánh giá\r\nquá trình", result.items().get(0).title());
        assertTrue(result.rawPayload().contains("5.\\tĐánh giá\\r\\nquá trình"));
    }

    @Test
    void keepsExistingJsonEscapesIntact() {
        String payload = "[null,[null,[[11,\"Dòng 1\\nDòng 2\",null,0,[[101,null,1]]]],null,null,null,null,null,null,\"Biểu mẫu thử\"],null,\"Tên tài liệu\"]";

        GoogleFormModel result = parser.parse(
                "FORM_ID", "<script>var FB_PUBLIC_LOAD_DATA_ = " + payload + ";</script>");

        assertEquals("Dòng 1\nDòng 2", result.items().get(0).title());
    }

    @Test
    void supportsPreviouslyWrappedFormPayload() {
        String payload = "[null,[null,[null,[[11,\"Câu hỏi\",null,0,[[101,null,1]]]],null,null,null,null,null,null,\"Biểu mẫu cũ\"],null,null]]";

        GoogleFormModel result = parser.parse(
                "FORM_ID", "<script>var FB_PUBLIC_LOAD_DATA_ = " + payload + ";</script>");

        assertEquals("Biểu mẫu cũ", result.title());
        assertEquals(1, result.items().size());
    }
}
