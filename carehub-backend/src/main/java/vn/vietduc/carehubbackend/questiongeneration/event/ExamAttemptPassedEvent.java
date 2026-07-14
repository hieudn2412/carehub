package vn.vietduc.carehubbackend.questiongeneration.event;

import vn.vietduc.carehubbackend.questiongeneration.entity.ExamAttempt;

public record ExamAttemptPassedEvent(ExamAttempt attempt) {
}
