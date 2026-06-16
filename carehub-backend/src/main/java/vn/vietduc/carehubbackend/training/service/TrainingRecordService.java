package vn.vietduc.carehubbackend.training.service;

import vn.vietduc.carehubbackend.training.dto.request.TrainingRecordFormRequest;
import vn.vietduc.carehubbackend.training.dto.request.TrainingRecordSubmitRequest;
import vn.vietduc.carehubbackend.training.dto.response.TrainingRecordDetailResponse;
import vn.vietduc.carehubbackend.training.dto.response.TrainingRecordOptionsResponse;

public interface TrainingRecordService {
    TrainingRecordDetailResponse getDetail(Long id);

    TrainingRecordOptionsResponse getOptions();

    TrainingRecordDetailResponse create(TrainingRecordFormRequest request);

    TrainingRecordDetailResponse update(Long id, TrainingRecordFormRequest request);

    TrainingRecordDetailResponse submit(Long id, TrainingRecordSubmitRequest request);
}
