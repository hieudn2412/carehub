package vn.vietduc.carehubbackend.questiongeneration.migration;

import org.junit.jupiter.api.Test;
import vn.vietduc.carehubbackend.questiongeneration.dto.request.CreateExamAssignmentRequest;
import vn.vietduc.carehubbackend.questiongeneration.dto.request.UpsertExamConfigRequest;
import vn.vietduc.carehubbackend.questiongeneration.dto.request.GenerateExamPaperRequest;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.ExamConfigPreviewResponse;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.CognitiveLevel;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ExamAssignmentVariantPolicy;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;

import static org.assertj.core.api.Assertions.assertThat;

class MultiFieldFoundationContractTest {

    @Test
    void cognitiveVocabularyIsStableAndClinical() {
        assertThat(CognitiveLevel.values()).containsExactly(
                CognitiveLevel.FOUNDATION,
                CognitiveLevel.CLINICAL_APPLICATION,
                CognitiveLevel.CLINICAL_REASONING_ANALYSIS
        );
    }

    @Test
    void assignmentRequestNoLongerAcceptsSingleProfessionalField() {
        assertThat(Arrays.stream(CreateExamAssignmentRequest.class.getRecordComponents())
                .map(component -> component.getName()))
                .doesNotContain("professionalFieldId");
    }

    @Test
    void migrationBackfillsFieldByForeignKeyButNeverGuessesCognitiveLevel() throws IOException {
        String sql;
        try (var stream = getClass().getResourceAsStream(
                "/db/migration/V6__multi_field_evaluation_foundation.sql")) {
            assertThat(stream).isNotNull();
            sql = new String(stream.readAllBytes(), StandardCharsets.UTF_8);
        }

        assertThat(sql)
                .contains("WHERE q.category_id = qc.id")
                .contains("ALTER COLUMN professional_field_id SET NOT NULL")
                .contains("CREATE TABLE IF NOT EXISTS exam_blueprint_fields")
                .contains("CREATE TABLE IF NOT EXISTS exam_blueprint_cells")
                .contains("ALTER COLUMN question_set_id DROP NOT NULL");
        assertThat(sql.toLowerCase())
                .doesNotContain("set cognitive_level =")
                .doesNotContain("where q.topic");
    }

    @Test
    void phaseFourMigrationAndBlueprintContractArePresent() throws IOException {
        String sql;
        try (var stream = getClass().getResourceAsStream("/db/migration/V10__exam_blueprint_sources.sql")) {
            assertThat(stream).isNotNull();
            sql = new String(stream.readAllBytes(), StandardCharsets.UTF_8);
        }
        assertThat(sql)
                .contains("audience_id")
                .contains("exam_config_source_filters")
                .contains("pool_checksum");
        assertThat(UpsertExamConfigRequest.class.getRecordComponents())
                .extracting(component -> component.getName())
                .contains("audienceId", "fieldBlueprints", "sourceFilters");
        assertThat(ExamConfigPreviewResponse.class.getRecordComponents())
                .extracting(component -> component.getName())
                .contains("blueprintFields");
    }

    @Test
    void phaseFiveMigrationAndGenerationContractArePresent() throws IOException {
        String sql;
        try (var stream = getClass().getResourceAsStream(
                "/db/migration/V11__deterministic_exam_paper_generation.sql")) {
            assertThat(stream).isNotNull();
            sql = new String(stream.readAllBytes(), StandardCharsets.UTF_8);
        }
        assertThat(sql)
                .contains("exam_paper_generation_batches")
                .contains("UNIQUE (idempotency_key)")
                .contains("exam_paper_generation_batch_cells")
                .contains("generation_algorithm_version")
                .contains("question_family_id")
                .contains("question_position")
                .contains("option_order_json");
        assertThat(GenerateExamPaperRequest.class.getRecordComponents())
                .extracting(component -> component.getName())
                .contains("idempotencyKey", "zeroOverlap");
    }

    @Test
    void phaseSixMigrationLocksTargetPaperAndMakesAssignmentsIdempotent() throws IOException {
        String sql;
        try (var stream = getClass().getResourceAsStream(
                "/db/migration/V12__assignment_variant_snapshots.sql")) {
            assertThat(stream).isNotNull();
            sql = new String(stream.readAllBytes(), StandardCharsets.UTF_8);
        }
        assertThat(sql)
                .contains("assigned_exam_paper_id")
                .contains("assigned_variant_index")
                .contains("retake_variant_policy")
                .contains("ALTER COLUMN assigned_exam_paper_id SET NOT NULL");
        assertThat(ExamAssignmentVariantPolicy.values())
                .containsExactly(ExamAssignmentVariantPolicy.FIXED_PAPER, ExamAssignmentVariantPolicy.STABLE_USER_HASH);
    }
}
