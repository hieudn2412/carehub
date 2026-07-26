package vn.vietduc.carehubbackend.common.util;

public final class CosineUtil {
    private CosineUtil() {
    }

    public static double cosine(double[] left, double[] right) {
        int size = Math.min(left.length, right.length);
        if (size == 0) {
            return 0;
        }
        double dot = 0;
        for (int i = 0; i < size; i++) {
            dot += left[i] * right[i];
        }
        // Vectors from E5 model are L2-normalized, so cosine = dot product
        return Math.max(0, dot);
    }
}
