package vn.vietduc.carehubbackend.notification.dto;

import jakarta.validation.constraints.NotNull;

public record NotificationReadRequest(@NotNull Boolean read) {
}
