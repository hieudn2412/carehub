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
        double leftNorm = 0;
        double rightNorm = 0;
        for (int i = 0; i < size; i++) {
            dot += left[i] * right[i];
            leftNorm += left[i] * left[i];
            rightNorm += right[i] * right[i];
        }
        if (leftNorm == 0 || rightNorm == 0) {
            return 0;
        }
        return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
    }

    /**
     * Cosine similarity với early termination: dừng sớm nếu không thể vượt qua threshold.
     * Hữu ích khi chỉ cần biết similarity > threshold, không cần giá trị chính xác.
     */
    public static boolean exceeds(double[] left, double[] right, double threshold) {
        if (threshold <= 0) {
            return true;
        }
        int size = Math.min(left.length, right.length);
        double dot = 0;
        double leftNorm = 0;
        double rightNorm = 0;

        for (int i = 0; i < size; i++) {
            dot += left[i] * right[i];
            leftNorm += left[i] * left[i];
            rightNorm += right[i] * right[i];

            // Early termination: ước tính upper bound của cosine sau mỗi 64 dims
            if ((i + 1) % 64 == 0) {
                double currentCosine = dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
                double remainingDims = size - i - 1;
                double upperBound = (dot + remainingDims)
                        / Math.sqrt((leftNorm + remainingDims) * (rightNorm + remainingDims));
                if (upperBound < threshold) {
                    return false;
                }
            }
        }
        return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm)) >= threshold;
    }
}
