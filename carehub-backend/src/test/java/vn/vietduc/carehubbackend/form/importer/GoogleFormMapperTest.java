package vn.vietduc.carehubbackend.form.importer;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;
import vn.vietduc.carehubbackend.form.entity.enums.FormFieldType;
import vn.vietduc.carehubbackend.form.importer.mapper.GoogleFormMapper;
import vn.vietduc.carehubbackend.form.importer.parser.GoogleFormModel;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class GoogleFormMapperTest {
    private final GoogleFormMapper mapper = new GoogleFormMapper(new ObjectMapper());

    @Test
    void removesEmployeeFieldsAndExpandsGridRowsWithStableMetadata() {
        GoogleFormModel model = new GoogleFormModel("FORM_1", "Kiểm tra", "Mô tả", "[]", List.of(
                new GoogleFormModel.Item(1, "Mã nhân viên", null, 0,
                        List.of(new GoogleFormModel.Entry(10, true, null, List.of()))),
                new GoogleFormModel.Item(2, "Đánh giá", null, 7, List.of(
                        new GoogleFormModel.Entry(20, true, "Bước một", List.of("Không đạt", "Đạt")),
                        new GoogleFormModel.Entry(21, true, "Bước hai", List.of("Không đạt", "Đạt"))))));

        GoogleFormMapper.Mapped result = mapper.map(model,
                "https://docs.google.com/forms/d/e/FORM_1/viewform");

        var items = result.request().sections().get(0).items();
        assertEquals(2, items.size());
        assertEquals("GF_20_0", items.get(0).question().code());
        assertEquals(FormFieldType.SINGLE_CHOICE, items.get(0).question().fieldType());
        assertEquals(0, items.get(0).question().options().get(0).scoreValue().compareTo(java.math.BigDecimal.ZERO));
        assertFalse(result.blocked());
        assertEquals(0, result.messages().size());
        assertEquals("employeeCode", ((Map<?, ?>) result.request().settings().get("subjectSelector")).get("lookupBy"));
        assertEquals(result.sourceHash(), ((Map<?, ?>) result.request().settings().get("importMetadata")).get("sourceHash"));
    }

    @Test
    void removesNumberedProfileFieldsAndKeepsBinaryHandHygieneScoring() {
        GoogleFormModel model = new GoogleFormModel("FORM_3", "Vệ sinh tay", null, "[]", List.of(
                new GoogleFormModel.Item(1, "1. Họ và tên nhân viên", null, 0,
                        List.of(new GoogleFormModel.Entry(10, true, null, List.of()))),
                new GoogleFormModel.Item(2, "Vệ sinh tay", null, 2,
                        List.of(new GoogleFormModel.Entry(20, true, null,
                                List.of("Có vệ sinh tay", "Không vệ sinh tay"))))));

        var result = mapper.map(model, "https://docs.google.com/forms/d/e/FORM_3/viewform");
        var question = result.request().sections().get(0).items().get(0).question();

        assertEquals(1, result.request().sections().get(0).items().size());
        assertEquals("YES", question.options().get(0).value());
        assertEquals(0, question.options().get(0).scoreValue().compareTo(java.math.BigDecimal.ONE));
        assertEquals("NO", question.options().get(1).value());
        assertEquals(0, question.options().get(1).scoreValue().compareTo(java.math.BigDecimal.ZERO));
        assertEquals(List.of("employeeCode", "fullName", "position", "department"),
                ((Map<?, ?>) result.request().settings().get("subjectSelector")).get("displayFields"));
        assertEquals(true, ((Map<?, ?>) result.request().settings().get("subjectSelector")).get("readOnly"));
    }

    @Test
    void notesAreExcludedAndTrailingStarMarksCriticalStep() {
        GoogleFormModel model = new GoogleFormModel("FORM_4", "Checklist", null, "[]", List.of(
                new GoogleFormModel.Item(1, "Ghi chú", null, 0,
                        List.of(new GoogleFormModel.Entry(10, false, null, List.of()))),
                new GoogleFormModel.Item(2, "Bước vô khuẩn (*)", null, 2,
                        List.of(new GoogleFormModel.Entry(20, true, null,
                                List.of("Không thực hiện", "Không đạt", "Đạt", "Tốt", "Rất tốt"))))));

        var result = mapper.map(model, "https://docs.google.com/forms/d/e/FORM_4/viewform");
        var note = result.request().sections().get(0).items().get(0).question();
        var step = result.request().sections().get(0).items().get(1).question();

        assertTrue(note.excludeFromScore());
        assertFalse(Boolean.TRUE.equals(note.critical()));
        assertTrue(step.critical());
        assertEquals(0, new java.math.BigDecimal("-1").compareTo(step.options().get(0).scoreValue()));
        assertEquals(0, new java.math.BigDecimal("1.5").compareTo(step.options().get(4).scoreValue()));
    }

    @Test
    void contextSelectorsAreRequiredButExcludedFromScore() {
        GoogleFormModel model = new GoogleFormModel("FORM_5", "Checklist", null, "[]", List.of(
                new GoogleFormModel.Item(1, "Thời điểm vệ sinh tay", null, 2,
                        List.of(new GoogleFormModel.Entry(10, true, null,
                                List.of("Trước tiếp xúc", "Sau tiếp xúc"))))));

        var question = mapper.map(model, "https://docs.google.com/forms/d/e/FORM_5/viewform")
                .request().sections().get(0).items().get(0).question();

        assertTrue(question.required());
        assertTrue(question.excludeFromScore());
        assertFalse(Boolean.TRUE.equals(question.critical()));
    }

    @Test
    void blocksUnknownGoogleItemType() {
        GoogleFormModel model = new GoogleFormModel("FORM_2", "Unknown", null, "[]", List.of(
                new GoogleFormModel.Item(9, "Unsupported", null, 99, List.of())));

        assertTrue(mapper.map(model, "https://docs.google.com/forms/d/e/FORM_2/viewform").blocked());
    }
}

