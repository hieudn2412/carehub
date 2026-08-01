package vn.vietduc.carehubbackend.questiongeneration.dto.request;

import java.util.List;

public record RetryProblemChunksRequest(List<Long> chunkIds) {
}
