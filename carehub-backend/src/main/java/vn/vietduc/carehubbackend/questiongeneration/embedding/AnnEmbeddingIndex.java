package vn.vietduc.carehubbackend.questiongeneration.embedding;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import vn.vietduc.carehubbackend.common.util.CosineUtil;
import vn.vietduc.carehubbackend.questiongeneration.config.AiEmbeddingProperties;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import java.util.concurrent.locks.ReadWriteLock;
import java.util.concurrent.locks.ReentrantReadWriteLock;

/**
 * ANN (Approximate Nearest Neighbor) index dùng Locality-Sensitive Hashing (LSH)
 * với random projection để giảm không gian tìm kiếm từ O(n) xuống gần O(log n).
 *
 * Có thể nâng cấp lên HNSW sau nếu cần accuracy cao hơn.
 */
@Slf4j
@Component
public class AnnEmbeddingIndex {
    private final AtomicReference<IndexState> state = new AtomicReference<>(IndexState.EMPTY);
    private final ReadWriteLock rebuildLock = new ReentrantReadWriteLock();
    private final AiEmbeddingProperties properties;

    public AnnEmbeddingIndex(AiEmbeddingProperties properties) {
        this.properties = properties;
    }

    /**
     * Build/rebuild index từ danh sách embedding mới.
     */
    public void rebuild(List<QuestionEmbeddingSnapshot> embeddings) {
        if (!properties.isAnnEnabled()) {
            return;
        }
        rebuildLock.writeLock().lock();
        try {
            if (embeddings.isEmpty()) {
                state.set(IndexState.EMPTY);
                return;
            }

            int dimension = embeddings.get(0).vector().length;
            int numBits = properties.getAnnLshBits();
            double[][] randomVectors = generateRandomVectors(numBits, dimension);

            Map<String, List<Integer>> buckets = new HashMap<>();
            double[][] vectors = new double[embeddings.size()][];
            long[] questionIds = new long[embeddings.size()];
            String[] stems = new String[embeddings.size()];

            for (int i = 0; i < embeddings.size(); i++) {
                QuestionEmbeddingSnapshot snapshot = embeddings.get(i);
                vectors[i] = snapshot.vector();
                questionIds[i] = snapshot.questionId();
                stems[i] = snapshot.stem();
                String hash = computeHash(snapshot.vector(), randomVectors);
                buckets.computeIfAbsent(hash, k -> new ArrayList<>()).add(i);
            }

            state.set(new IndexState(vectors, questionIds, stems, randomVectors, buckets));
            log.info("ANN index rebuilt with {} vectors ({} bits, {} buckets)",
                    embeddings.size(), numBits, buckets.size());
        } finally {
            rebuildLock.writeLock().unlock();
        }
    }

    /**
     * Search best match với ANN + exact verify.
     */
    public SearchResult searchBestMatch(double[] query, double threshold, int maxCandidates) {
        if (!properties.isAnnEnabled()) {
            return null;
        }
        rebuildLock.readLock().lock();
        try {
            IndexState current = state.get();
            if (current == IndexState.EMPTY || current.vectors.length == 0) {
                return null;
            }

            // LSH: tìm candidates trong cùng bucket và lân cận
            String queryHash = computeHash(query, current.randomVectors);
            List<Integer> candidateIndices = new ArrayList<>();

            // Bucket chính xác
            List<Integer> exactBucket = current.buckets.get(queryHash);
            if (exactBucket != null) {
                candidateIndices.addAll(exactBucket);
            }

            // Bucket lân cận (Hamming distance 1)
            if (candidateIndices.size() < maxCandidates && properties.isAnnNeighborBuckets()) {
                char[] hashChars = queryHash.toCharArray();
                for (int i = 0; i < hashChars.length; i++) {
                    char original = hashChars[i];
                    hashChars[i] = original == '0' ? '1' : '0';
                    List<Integer> neighborBucket = current.buckets.get(new String(hashChars));
                    if (neighborBucket != null) {
                        candidateIndices.addAll(neighborBucket);
                    }
                    hashChars[i] = original;
                }
            }

            if (candidateIndices.isEmpty()) {
                return null;
            }

            // Exact verify: cosine trên các candidates
            SearchResult best = null;
            double bestScore = 0;
            int checked = 0;

            for (int idx : candidateIndices) {
                if (checked >= maxCandidates) {
                    break;
                }
                checked++;
                double score = CosineUtil.cosine(query, current.vectors[idx]);
                if (score > bestScore) {
                    bestScore = score;
                    best = new SearchResult(current.questionIds[idx], current.stems[idx], score, current.vectors[idx]);
                    if (bestScore >= threshold) {
                        break; // Early termination
                    }
                }
            }

            return best;
        } finally {
            rebuildLock.readLock().unlock();
        }
    }

    public int size() {
        IndexState current = state.get();
        return current == IndexState.EMPTY ? 0 : current.vectors.length;
    }

    public boolean isReady() {
        return properties.isAnnEnabled() && state.get() != IndexState.EMPTY && state.get().vectors.length > 0;
    }

    private double[][] generateRandomVectors(int numBits, int dimension) {
        double[][] randomVectors = new double[numBits][dimension];
        java.util.Random rng = new java.util.Random(42); // Fixed seed for reproducibility
        for (int i = 0; i < numBits; i++) {
            double norm = 0;
            for (int d = 0; d < dimension; d++) {
                randomVectors[i][d] = rng.nextGaussian();
                norm += randomVectors[i][d] * randomVectors[i][d];
            }
            norm = Math.sqrt(norm);
            for (int d = 0; d < dimension; d++) {
                randomVectors[i][d] /= norm;
            }
        }
        return randomVectors;
    }

    private String computeHash(double[] vector, double[][] randomVectors) {
        StringBuilder sb = new StringBuilder();
        for (double[] rv : randomVectors) {
            double dot = 0;
            for (int i = 0; i < vector.length; i++) {
                dot += vector[i] * rv[i];
            }
            sb.append(dot >= 0 ? '1' : '0');
        }
        return sb.toString();
    }

    private record IndexState(
            double[][] vectors,
            long[] questionIds,
            String[] stems,
            double[][] randomVectors,
            Map<String, List<Integer>> buckets
    ) {
        static final IndexState EMPTY = new IndexState(
                new double[0][], new long[0], new String[0], new double[0][], Map.of()
        );
    }

    public record SearchResult(Long questionId, String stem, double similarity, double[] vector) {
    }
}
