package com.rentalcar.config;

import org.apache.kafka.clients.admin.AdminClientConfig;
import org.apache.kafka.clients.admin.NewTopic;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.TopicBuilder;
import org.springframework.kafka.core.KafkaAdmin;

import java.util.HashMap;
import java.util.Map;

/**
 * Kafka topic definitions — Deepak's per-event-type topic strategy.
 *
 * Why separate topics instead of one:
 *  - Each consumer group subscribes only to what it needs (notification, settlement, audit).
 *  - Adding a new downstream consumer requires zero changes to existing code.
 *  - Topic-level retention/partition policies can differ per event type.
 *
 * Producer and consumer factories use Spring Boot auto-configuration
 * driven by application.yml (JsonSerializer / JsonDeserializer) — no
 * manual factory wiring needed for Boot 3.2.
 */
@Configuration
public class KafkaConfig {

    // ── Topic name constants — single source of truth ─────────────────────
    public static final String BOOKING_CREATED   = "booking.created";
    public static final String BOOKING_CONFIRMED = "booking.confirmed";
    public static final String BOOKING_CANCELLED = "booking.cancelled";
    public static final String BOOKING_COMPLETED = "booking.completed";
    public static final String AUDIT_EVENTS      = "audit.events";

    @Value("${spring.kafka.bootstrap-servers:localhost:9092}")
    private String bootstrapServers;

    // ── KafkaAdmin — explicit so fail-fast works correctly ────────────────
    @Bean
    public KafkaAdmin kafkaAdmin() {
        Map<String, Object> configs = new HashMap<>();
        configs.put(AdminClientConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrapServers);
        return new KafkaAdmin(configs);
    }

    // ── Topics — 3 partitions each, 1 replica (scale replicas in prod) ────
    @Bean public NewTopic bookingCreatedTopic()   { return topic(BOOKING_CREATED); }
    @Bean public NewTopic bookingConfirmedTopic()  { return topic(BOOKING_CONFIRMED); }
    @Bean public NewTopic bookingCancelledTopic()  { return topic(BOOKING_CANCELLED); }
    @Bean public NewTopic bookingCompletedTopic()  { return topic(BOOKING_COMPLETED); }
    @Bean public NewTopic auditEventsTopic()       { return topic(AUDIT_EVENTS); }

    // DLTs are auto-created by @RetryableTopic — no need to declare them here

    private NewTopic topic(String name) {
        return TopicBuilder.name(name).partitions(3).replicas(1).build();
    }
}
