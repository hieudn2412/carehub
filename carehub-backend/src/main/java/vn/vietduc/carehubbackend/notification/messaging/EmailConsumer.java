package vn.vietduc.carehubbackend.notification.messaging;

import com.rabbitmq.client.Channel;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Component;
import vn.vietduc.carehubbackend.config.RabbitMQConfig;
import vn.vietduc.carehubbackend.notification.service.EmailService;
import vn.vietduc.carehubbackend.notification.service.NotificationService;

import java.io.IOException;

@Slf4j
@Component
@RequiredArgsConstructor
public class EmailConsumer {
    private static final int MAX_EMAIL_ATTEMPTS = 5;

    private final EmailService emailService;
    private final NotificationService notificationService;
    private final RabbitTemplate rabbitTemplate;

    @RabbitListener(queues = RabbitMQConfig.EMAIL_QUEUE)
    public void consume(
            EmailMessage message,
            Message amqpMessage,
            Channel channel
    ) throws IOException {
        long deliveryTag = amqpMessage.getMessageProperties().getDeliveryTag();

        try {
            createInAppNotification(message);
            if (notificationService.isEmailEnabled()) {
                emailService.send(message.getTo(), message.getSubject(), message.getContent());
            }
            channel.basicAck(deliveryTag, false);
        } catch (Exception ex) {
            log.warn("Email dispatch failed for {}, attempt {}", message.getTo(), message.getAttempts() + 1, ex);
            retryOrDlq(message);
            channel.basicAck(deliveryTag, false);
        }
    }

    private void createInAppNotification(EmailMessage message) {
        if (message.getUserId() == null) {
            return;
        }

        String dedupKey = notificationService.defaultDedupKey(message);
        message.setDedupKey(dedupKey);

        notificationService.createInAppNotification(
                message.getUserId(),
                message.getType(),
                message.getSubject(),
                message.getContent(),
                message.getDeepLink(),
                dedupKey
        );
    }

    private void retryOrDlq(EmailMessage message) {
        int nextAttempt = message.getAttempts() + 1;
        message.setAttempts(nextAttempt);

        if (nextAttempt >= MAX_EMAIL_ATTEMPTS) {
            rabbitTemplate.convertAndSend(
                    RabbitMQConfig.EMAIL_DLQ_EXCHANGE,
                    RabbitMQConfig.EMAIL_DLQ_ROUTING_KEY,
                    message
            );
            return;
        }

        rabbitTemplate.convertAndSend(
                RabbitMQConfig.EMAIL_RETRY_EXCHANGE,
                RabbitMQConfig.EMAIL_RETRY_ROUTING_KEY,
                message
        );
    }
}
