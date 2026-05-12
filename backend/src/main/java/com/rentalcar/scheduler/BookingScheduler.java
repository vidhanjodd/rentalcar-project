package com.rentalcar.scheduler;

import com.rentalcar.entity.Booking;
import com.rentalcar.repository.BookingRepository;
import com.rentalcar.service.BookingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;

/**
 * Scheduled jobs for automatic booking lifecycle management.
 * Deepak's design — two jobs that run every hour (configurable).
 *
 * Job 1: cancelStalePendingBookings
 *   PENDING bookings older than pendingTimeoutMinutes are auto-cancelled.
 *   Prevents cars from being held indefinitely by users who never confirmed.
 *
 * Job 2: completeExpiredBookings
 *   CONFIRMED bookings past their end date are auto-completed.
 *   Keeps the system state in sync with real-world car return.
 *
 * Both call BookingService methods directly (not via proxy) so they get
 * the correct @Transactional and @CacheEvict behaviour.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class BookingScheduler {

    private final BookingRepository bookingRepository;
    private final BookingService    bookingService;

    @Value("${app.scheduling.pending-timeout-minutes:30}")
    private int pendingTimeoutMinutes;

    @Scheduled(fixedRateString = "${app.scheduling.interval-ms:3600000}")
    public void cancelStalePendingBookings() {
        Instant cutoff = Instant.now().minus(pendingTimeoutMinutes, ChronoUnit.MINUTES);
        List<Booking> stale = bookingRepository.findStalePendingBookings(cutoff);

        if (stale.isEmpty()) return;

        for (Booking booking : stale) {
            try {
                bookingService.autoCancel(booking);
            } catch (Exception e) {
                // Log and continue — one failure should not stop processing others
                log.error("Failed to auto-cancel booking {}: {}", booking.getId(), e.getMessage());
            }
        }

        log.info("Auto-cancelled {} stale PENDING bookings (timeout={}min)",
            stale.size(), pendingTimeoutMinutes);
    }

    @Scheduled(fixedRateString = "${app.scheduling.interval-ms:3600000}")
    public void completeExpiredBookings() {
        List<Booking> completable = bookingRepository.findCompletableBookings(LocalDate.now());

        if (completable.isEmpty()) return;

        for (Booking booking : completable) {
            try {
                bookingService.autoComplete(booking);
            } catch (Exception e) {
                log.error("Failed to auto-complete booking {}: {}", booking.getId(), e.getMessage());
            }
        }

        log.info("Auto-completed {} expired CONFIRMED bookings", completable.size());
    }
}
