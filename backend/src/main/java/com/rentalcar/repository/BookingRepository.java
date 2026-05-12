package com.rentalcar.repository;

import com.rentalcar.entity.Booking;
import com.rentalcar.enums.BookingStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface BookingRepository extends JpaRepository<Booking, UUID> {

    // ── Double-booking guards ────────────────────────────────────────────────

    /**
     * Two date ranges [A,B] and [C,D] overlap iff: A < D AND C < B.
     * Only checks PENDING and CONFIRMED bookings — cancelled/completed
     * free the car for re-booking.
     */
    @Query("""
        SELECT COUNT(b) > 0 FROM Booking b
        WHERE b.car.id  = :carId
          AND b.status IN ('PENDING', 'CONFIRMED')
          AND b.startDate < :endDate
          AND b.endDate   > :startDate
        """)
    boolean existsOverlappingBooking(
        @Param("carId")     UUID carId,
        @Param("startDate") LocalDate startDate,
        @Param("endDate")   LocalDate endDate
    );

    /** Same check excluding one booking — for rescheduling/update flows. */
    @Query("""
        SELECT COUNT(b) > 0 FROM Booking b
        WHERE b.car.id  = :carId
          AND b.id      <> :excludeId
          AND b.status IN ('PENDING', 'CONFIRMED')
          AND b.startDate < :endDate
          AND b.endDate   > :startDate
        """)
    boolean existsOverlappingBookingExcluding(
        @Param("carId")     UUID carId,
        @Param("startDate") LocalDate startDate,
        @Param("endDate")   LocalDate endDate,
        @Param("excludeId") UUID excludeId
    );

    // ── Locking ──────────────────────────────────────────────────────────────

    /** Pessimistic write lock on booking row — used for all status transitions. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT b FROM Booking b WHERE b.id = :id")
    Optional<Booking> findByIdWithLock(@Param("id") UUID id);

    /** JOIN FETCH to avoid N+1 when building full BookingResponse. */
    @Query("""
        SELECT b FROM Booking b
        JOIN FETCH b.car
        JOIN FETCH b.user
        WHERE b.id = :id
        """)
    Optional<Booking> findByIdWithDetails(@Param("id") UUID id);

    // ── User queries ─────────────────────────────────────────────────────────

    Page<Booking> findByUserId(UUID userId, Pageable pageable);

    @Query("""
        SELECT b FROM Booking b
        WHERE b.user.id = :userId
          AND b.status  = :status
        ORDER BY b.createdAt DESC
        """)
    Page<Booking> findByUserIdAndStatus(
        @Param("userId") UUID userId,
        @Param("status") BookingStatus status,
        Pageable pageable
    );

    // ── Admin / reporting ────────────────────────────────────────────────────

    Page<Booking> findByCarId(UUID carId, Pageable pageable);

    Page<Booking> findByStatus(BookingStatus status, Pageable pageable);

    List<Booking> findByCarIdAndStatusIn(UUID carId, List<BookingStatus> statuses);

    /**
     * Admin filter query — all params optional.
     * Deepak's design: single flexible query replaces 4 separate derived methods.
     */
    @Query("""
        SELECT b FROM Booking b
        WHERE (:status    IS NULL OR b.status          = :status)
          AND (:userEmail IS NULL OR b.user.email      = :userEmail)
          AND (:from      IS NULL OR b.startDate      >= :from)
          AND (:to        IS NULL OR b.endDate        <= :to)
        """)
    Page<Booking> findWithFilters(
        @Param("status")    BookingStatus status,
        @Param("userEmail") String userEmail,
        @Param("from")      LocalDate from,
        @Param("to")        LocalDate to,
        Pageable pageable
    );

    // ── Scheduler queries (Deepak) ────────────────────────────────────────────

    /**
     * PENDING bookings older than {@code cutoff} that should be auto-cancelled.
     * JOIN FETCH user to avoid lazy-load in the scheduler loop.
     */
    @Query("""
        SELECT b FROM Booking b
        JOIN FETCH b.user
        WHERE b.status    = 'PENDING'
          AND b.createdAt < :cutoff
        """)
    List<Booking> findStalePendingBookings(@Param("cutoff") Instant cutoff);

    /**
     * CONFIRMED bookings whose end date has passed — eligible for auto-completion.
     */
    @Query("SELECT b FROM Booking b WHERE b.status = 'CONFIRMED' AND b.endDate < :today")
    List<Booking> findCompletableBookings(@Param("today") LocalDate today);
}
