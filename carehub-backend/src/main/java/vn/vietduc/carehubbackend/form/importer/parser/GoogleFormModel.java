package vn.vietduc.carehubbackend.form.importer.parser;

import java.util.List;

public record GoogleFormModel(String formId, String title, String description, String rawPayload, List<Item> items) {
    public record Item(long id, String title, String description, int type, List<Entry> entries) {
    }

    public record Entry(long id, boolean required, String rowTitle, List<String> options) {
    }
}

