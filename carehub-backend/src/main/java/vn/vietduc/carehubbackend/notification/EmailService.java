package vn.vietduc.carehubbackend.notification;

import lombok.RequiredArgsConstructor;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class EmailService {

    private final JavaMailSender mailSender;

    public void send(
            String to,
            String subject,
            String content
    ) {

        SimpleMailMessage mail =
                new SimpleMailMessage();

        mail.setTo(to);
        mail.setSubject(subject);
        mail.setText(content);

        mailSender.send(mail);
    }
}
