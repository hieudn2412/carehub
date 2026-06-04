package vn.vietduc.carehubbackend.auth.service;

import vn.vietduc.carehubbackend.user.entity.TrainingHour;

import java.util.List;

public interface TrainingHourService {
    public List<TrainingHour> getAllTrainingHour();
    public void DeleteAllTrainingHour();
}
