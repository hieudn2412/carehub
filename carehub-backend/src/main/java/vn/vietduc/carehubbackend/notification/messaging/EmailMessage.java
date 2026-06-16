package vn.vietduc.carehubbackend.notification.messaging;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EmailMessage {
    private Long userId;

    private String templateCode;

    private String to;

    private String subject;

    private String content;

    private String type;

    private String deepLink;

    private String dedupKey;

    private int attempts;
}
