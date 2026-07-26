package vn.vietduc.carehubbackend.common.util;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

/**
 * L1 unit tests — sheet {@code BoundaryValues}, Test ID prefix {@code L1-BV} (IDs 20–23 live here).
 *
 * <p>{@code CosineUtil.cosine} is the similarity primitive behind every duplicate and paraphrase
 * threshold (BV-07, BV-08, BV-09 and BV-13), so its exact contract matters: it returns the <em>dot product</em>
 * clamped at 0, which only equals the cosine when both inputs are L2-normalised. These cases pin
 * that precondition so a future change to non-normalised vectors fails loudly here rather than
 * silently shifting every similarity threshold.
 */
class CosineUtilTest {

    @Test
    @DisplayName("L1-BV-20 | EP-Valid: for L2-normalised vectors the result equals the cosine")
    void normalisedVectorsYieldCosine() {
        double[] unitX = {1.0, 0.0};

        assertThat(CosineUtil.cosine(unitX, new double[]{1.0, 0.0})).isCloseTo(1.0, within(1e-12));
        assertThat(CosineUtil.cosine(unitX, new double[]{0.0, 1.0})).isCloseTo(0.0, within(1e-12));
        // 0.6/0.8 is a unit vector, so the dot product is exactly the cosine.
        assertThat(CosineUtil.cosine(unitX, new double[]{0.6, 0.8})).isCloseTo(0.6, within(1e-12));
    }

    @Test
    @DisplayName("L1-BV-21 | BVA-Min: an opposing direction is clamped to 0 instead of going negative")
    void negativeDotProductIsClampedToZero() {
        assertThat(CosineUtil.cosine(new double[]{1.0, 0.0}, new double[]{-1.0, 0.0})).isZero();
        assertThat(CosineUtil.cosine(new double[]{0.6, 0.8}, new double[]{-0.6, -0.8})).isZero();
    }

    @Test
    @DisplayName("L1-BV-22 | EP-Invalid: empty vectors and length mismatches are handled without error")
    void emptyAndMismatchedVectors() {
        assertThat(CosineUtil.cosine(new double[]{}, new double[]{})).isZero();
        assertThat(CosineUtil.cosine(new double[]{}, new double[]{1.0})).isZero();
        // The shorter length wins: only the first component is compared.
        assertThat(CosineUtil.cosine(new double[]{1.0}, new double[]{1.0, 999.0}))
                .isCloseTo(1.0, within(1e-12));
    }

    @Test
    @DisplayName("L1-BV-23 | EP-Invalid: non-normalised input is NOT a cosine — callers must normalise")
    void nonNormalisedInputIsNotACosine() {
        // A true cosine of a vector with itself is 1.0; the dot product of [2,0] with itself is 4.
        // This documents the precondition rather than a desired behaviour: every caller
        // (DuplicateCheckService, ParaphraseValidationService) feeds L2-normalised E5 vectors.
        assertThat(CosineUtil.cosine(new double[]{2.0, 0.0}, new double[]{2.0, 0.0}))
                .isCloseTo(4.0, within(1e-12));
    }
}
