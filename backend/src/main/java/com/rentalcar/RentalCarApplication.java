package com.rentalcar;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.kafka.annotation.EnableKafka;
import org.springframework.retry.annotation.EnableRetry;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Rental Car Booking System — Main Spring Boot Application.
 *
 * Features:
 * - REST API for car search and booking management
 * - JWT authentication with role-based access control
 * - Kafka event streaming for audit trail and notifications
 * - Redis caching for frequent queries
 * - PostgreSQL with JPA/Hibernate and Flyway migrations
 * - Retry logic for optimistic lock conflicts
 * - Scheduled tasks for auto-cancel and auto-complete
 * - Comprehensive audit logging with Spring AOP
 */
@SpringBootApplication
@EnableCaching
@EnableKafka
@EnableRetry
@EnableScheduling
@EnableJpaAuditing
public class RentalCarApplication {

    public static void main(String[] args) {
        SpringApplication.run(RentalCarApplication.class, args);
    }

}

