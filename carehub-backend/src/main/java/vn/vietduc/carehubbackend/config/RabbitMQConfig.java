package vn.vietduc.carehubbackend.config;

import org.springframework.amqp.core.AcknowledgeMode;
import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.QueueBuilder;
import org.springframework.amqp.core.TopicExchange;
import org.springframework.amqp.rabbit.config.SimpleRabbitListenerContainerFactory;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.JacksonJsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitMQConfig {

    public static final String EMAIL_QUEUE = "email.queue";
    public static final String EMAIL_EXCHANGE = "email.exchange";
    public static final String EMAIL_ROUTING_KEY = "email.routing.key";

    public static final String EMAIL_RETRY_QUEUE = "email.retry.queue";
    public static final String EMAIL_RETRY_EXCHANGE = "email.retry.exchange";
    public static final String EMAIL_RETRY_ROUTING_KEY = "email.retry.routing.key";
    public static final int EMAIL_RETRY_DELAY_MS = 15 * 60 * 1000;

    public static final String EMAIL_DLQ = "email.dlq";
    public static final String EMAIL_DLQ_EXCHANGE = "email.dlq.exchange";
    public static final String EMAIL_DLQ_ROUTING_KEY = "email.dlq.routing.key";

    @Bean
    public MessageConverter messageConverter() {
        return new JacksonJsonMessageConverter();
    }

    @Bean
    public RabbitTemplate rabbitTemplate(
            ConnectionFactory connectionFactory,
            MessageConverter messageConverter
    ) {
        RabbitTemplate rabbitTemplate = new RabbitTemplate(connectionFactory);
        rabbitTemplate.setMessageConverter(messageConverter);
        return rabbitTemplate;
    }

    @Bean
    public SimpleRabbitListenerContainerFactory rabbitListenerContainerFactory(
            ConnectionFactory connectionFactory,
            MessageConverter messageConverter
    ) {
        SimpleRabbitListenerContainerFactory factory = new SimpleRabbitListenerContainerFactory();
        factory.setConnectionFactory(connectionFactory);
        factory.setMessageConverter(messageConverter);
        factory.setAcknowledgeMode(AcknowledgeMode.MANUAL);
        return factory;
    }

    @Bean
    public Queue emailQueue() {
        return QueueBuilder.durable(EMAIL_QUEUE).build();
    }

    @Bean
    public TopicExchange emailExchange() {
        return new TopicExchange(EMAIL_EXCHANGE);
    }

    @Bean
    public Binding emailBinding() {
        return BindingBuilder
                .bind(emailQueue())
                .to(emailExchange())
                .with(EMAIL_ROUTING_KEY);
    }

    @Bean
    public Queue emailRetryQueue() {
        return QueueBuilder.durable(EMAIL_RETRY_QUEUE)
                .ttl(EMAIL_RETRY_DELAY_MS)
                .deadLetterExchange(EMAIL_EXCHANGE)
                .deadLetterRoutingKey(EMAIL_ROUTING_KEY)
                .build();
    }

    @Bean
    public TopicExchange emailRetryExchange() {
        return new TopicExchange(EMAIL_RETRY_EXCHANGE);
    }

    @Bean
    public Binding emailRetryBinding() {
        return BindingBuilder
                .bind(emailRetryQueue())
                .to(emailRetryExchange())
                .with(EMAIL_RETRY_ROUTING_KEY);
    }

    @Bean
    public Queue emailDlq() {
        return QueueBuilder.durable(EMAIL_DLQ).build();
    }

    @Bean
    public TopicExchange emailDlqExchange() {
        return new TopicExchange(EMAIL_DLQ_EXCHANGE);
    }

    @Bean
    public Binding emailDlqBinding() {
        return BindingBuilder
                .bind(emailDlq())
                .to(emailDlqExchange())
                .with(EMAIL_DLQ_ROUTING_KEY);
    }
}
