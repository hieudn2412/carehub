package vn.vietduc.carehubbackend.notification;

import lombok.RequiredArgsConstructor;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;
import vn.vietduc.carehubbackend.config.RabbitMQConfig;

@Component
@RequiredArgsConstructor
public class EmailConsumer {

    private final EmailService emailService;

    @RabbitListener(
            queues = RabbitMQConfig.EMAIL_QUEUE
    )
    public void consume(
            EmailMessage message
    ) {

        emailService.send(
                message.getTo(),
                message.getSubject(),
                message.getContent()
        );
    }
}