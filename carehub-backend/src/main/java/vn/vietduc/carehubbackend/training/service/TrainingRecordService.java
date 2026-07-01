package vn.vietduc.carehubbackend.training.service;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import vn.vietduc.carehubbackend.training.dto.request.TrainingRecordFormRequest;
import vn.vietduc.carehubbackend.training.dto.request.TrainingRecordSearchRequest;
import vn.vietduc.carehubbackend.training.dto.request.TrainingRecordReviewRequest;
import vn.vietduc.carehubbackend.training.dto.request.TrainingRecordSubmitRequest;
import vn.vietduc.carehubbackend.training.dto.response.TrainingRecordDetailResponse;
import vn.vietduc.carehubbackend.training.dto.response.TrainingRecordListResponse;
import vn.vietduc.carehubbackend.training.dto.response.TrainingRecordOptionsResponse;

public interface TrainingRecordService {
    Page<TrainingRecordListResponse> search(TrainingRecordSearchRequest request, Pageable pageable);

    TrainingRecordDetailResponse getDetail(Long id);

    TrainingRecordOptionsResponse getOptions();

    TrainingRecordDetailResponse create(TrainingRecordFormRequest request);

    TrainingRecordDetailResponse update(Long id, TrainingRecordFormRequest request);

    TrainingRecordDetailResponse submit(Long id, TrainingRecordSubmitRequest request);

    TrainingRecordDetailResponse approve(Long id, TrainingRecordReviewRequest request);

    TrainingRecordDetailResponse reject(Long id, TrainingRecordReviewRequest request);
}
