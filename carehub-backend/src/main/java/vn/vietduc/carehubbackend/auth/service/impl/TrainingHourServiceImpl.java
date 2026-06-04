package vn.vietduc.carehubbackend.auth.service.impl;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import vn.vietduc.carehubbackend.auth.repository.TrainingHourRepository;
import vn.vietduc.carehubbackend.auth.service.TrainingHourService;
import vn.vietduc.carehubbackend.user.entity.TrainingHour;

import java.util.List;

@Service
@RequiredArgsConstructor
public class TrainingHourServiceImpl implements TrainingHourService {
    private final TrainingHourRepository trainingHourRepository;

    @Override
    public List<TrainingHour> getAllTrainingHour() {
        return trainingHourRepository.findAll();
    }

    @Override
    public void DeleteAllTrainingHour() {
        trainingHourRepository.deleteAll();
    }
}
