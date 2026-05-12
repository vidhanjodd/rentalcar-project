package com.rentalcar.kafka;

import com.rentalcar.config.KafkaConfig;
import com.rentalcar.entity.Booking;
import com.rentalcar.enums.BookingStatus;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.time.Instant;

/**
 * Kafka event producer.
 *
 * Pattern: service layer publishes a Spring ApplicationEvent inside the
 * transaction. The @TransactionalEventListener fires AFTER_COMMIT — so
 * Kafka events are only sent when the DB transaction has successfully
 * committed. This prevents sending events for rolled-back bookings.
 *
 * Topic routing: Deepak's per-event-type topics (booking.created, etc.)
 * plus a parallel publish to audit.events for the AuditConsumer.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class BookingEventProducer {

    private final KafkaTemplate<String, BookingEvent> kafkaTemplate;
    private final ApplicationEventPublisher applicationEventPublisher;

    // ── Internal Spring event (same JVM, same transaction) ──────────────

    public void publishCreated(Booking booking) {
        applicationEventPublisher.publishEvent(
            buildEvent(booking, BookingEvent.EventType.BOOKING_CREATED, null));
    }

    public void publishConfirmed(Booking booking) {
        applicationEventPublisher.publishEvent(
            buildEvent(booking, BookingEvent.EventType.BOOKING_CONFIRMED, BookingStatus.PENDING));
    }

    public void publishCancelled(Booking booking, BookingStatus previousStatus) {
        applicationEventPublisher.publishEvent(
            buildEvent(booking, BookingEvent.EventType.BOOKING_CANCELLED, previousStatus));
    }

    public void publishForceCancelled(Booking booking, BookingStatus previousStatus) {
        applicationEventPublisher.publishEvent(
            buildEvent(booking, BookingEvent.EventType.BOOKING_FORCE_CANCELLED, previousStatus));
    }

    public void publishAutoCancel(Booking booking) {
        applicationEventPublisher.publishEvent(
            buildEvent(booking, BookingEvent.EventType.BOOKING_AUTO_CANCELLED, BookingStatus.PENDING));
    }

    public void publishCompleted(Booking booking) {
        applicationEventPublisher.publishEvent(
            buildEvent(booking, BookingEvent.EventType.BOOKING_COMPLETED, BookingStatus.CONFIRMED));
    }

    public void publishAutoCompleted(Booking booking) {
        applicationEventPublisher.publishEvent(
            buildEvent(booking, BookingEvent.EventType.BOOKING_AUTO_COMPLETED, BookingStatus.CONFIRMED));
    }

    // ── Actual Kafka send — fires only after DB transaction commits ──────

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handleBookingEvent(BookingEvent event) {
        String key   = event.getBookingId().toString();  // partition key = bookingId → ordered per booking
        String topic = topicFor(event.getEventType());

        // Send to the event-specific topic (notification, settlement consumers)
        kafkaTemplate.send(topic, key, event)
            .whenComplete((result, ex) -> {
                if (ex != null) {
                    log.error("Failed to publish {} for booking {}: {}",
                        event.getEventType(), event.getBookingId(), ex.getMessage());
                } else {
                    log.debug("Published {} → topic={} partition={} offset={}",
                        event.getEventType(), topic,
                        result.getRecordMetadata().partition(),
                        result.getRecordMetadata().offset());
                }
            });

        // Always send to audit.events as well (AuditConsumer reads this)
        kafkaTemplate.send(KafkaConfig.AUDIT_EVENTS, key, event);
    }

    private String topicFor(BookingEvent.EventType type) {
        return switch (type) {
            case BOOKING_CREATED                               -> KafkaConfig.BOOKING_CREATED;
            case BOOKING_CONFIRMED                             -> KafkaConfig.BOOKING_CONFIRMED;
            case BOOKING_CANCELLED,
                 BOOKING_FORCE_CANCELLED,
                 BOOKING_AUTO_CANCELLED                        -> KafkaConfig.BOOKING_CANCELLED;
            case BOOKING_COMPLETED,
                 BOOKING_AUTO_COMPLETED                        -> KafkaConfig.BOOKING_COMPLETED;
        };
    }

    private BookingEvent buildEvent(Booking booking,
                                    BookingEvent.EventType type,
                                    BookingStatus previousStatus) {
        return BookingEvent.builder()
            .eventType(type)
            .bookingId(booking.getId())
            .userId(booking.getUser().getId())
            .username(booking.getUser().getUsername())
            .userEmail(booking.getUser().getEmail())
            .carId(booking.getCar().getId())
            .carBrand(booking.getCar().getBrand())
            .carModel(booking.getCar().getModel())
            .licensePlate(booking.getCar().getLicensePlate())
            .startDate(booking.getStartDate())
            .endDate(booking.getEndDate())
            .status(booking.getStatus())
            .previousStatus(previousStatus)
            .totalPrice(booking.getTotalPrice())
            .cancellationReason(booking.getCancellationReason())
            .notes(booking.getNotes())
            .occurredAt(Instant.now())
            .build();
    }
}
