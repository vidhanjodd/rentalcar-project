package com.rentalcar.controller;

import com.rentalcar.dto.request.CarRequest;
import com.rentalcar.dto.request.ForceCancelRequest;
import com.rentalcar.dto.response.AuditLogResponse;
import com.rentalcar.dto.response.BookingResponse;
import com.rentalcar.dto.response.CarResponse;
import com.rentalcar.dto.response.PageResponse;
import com.rentalcar.entity.AuditLog;
import com.rentalcar.enums.BookingStatus;
import com.rentalcar.enums.CarStatus;
import com.rentalcar.repository.AuditLogRepository;
import com.rentalcar.security.UserPrincipal;
import com.rentalcar.service.BookingService;
import com.rentalcar.service.CarService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.UUID;

/**
 * Admin-only controller.
 *
 * Deepak's design: all admin ops consolidated under /api/admin/** with a
 * class-level @PreAuthorize. Cleaner than scattering admin auth on every
 * method across CarController and BookingController.
 *
 * YOUR additions: Swagger @Operation docs, UserPrincipal (richer than
 * UserDetails.getUsername()), full PATCH /cars/{id}/status, DELETE /cars/{id}.
 */
@RestController
@RequestMapping("/api/admin")
@PreAuthorize("hasRole('ADMIN')")
@SecurityRequirement(name = "bearerAuth")
@RequiredArgsConstructor
@Tag(name = "Admin", description = "Fleet management, booking operations, audit trail")
public class AdminController {

    private final CarService           carService;
    private final BookingService       bookingService;
    private final AuditLogRepository   auditLogRepository;

    // ── Fleet management ──────────────────────────────────────────────────────

    @GetMapping("/cars")
    @Operation(summary = "List all fleet cars — admin view (all statuses, all cities)")
    public ResponseEntity<PageResponse<CarResponse>> listAllCars(
            @RequestParam(defaultValue = "0")  int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(carService.listAll(page, size));
    }

    @PostMapping("/cars")
    @Operation(summary = "Add a new car to the fleet")
    public ResponseEntity<CarResponse> createCar(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody CarRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(carService.create(request, principal.getUsername()));
    }

    @PutMapping("/cars/{id}")
    @Operation(summary = "Update car details")
    public ResponseEntity<CarResponse> updateCar(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID id,
            @Valid @RequestBody CarRequest request) {
        return ResponseEntity.ok(carService.update(id, request, principal.getUsername()));
    }

    @PatchMapping("/cars/{id}/status")
    @Operation(summary = "Change car status — AVAILABLE / MAINTENANCE / RETIRED")
    public ResponseEntity<CarResponse> updateCarStatus(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID id,
            @RequestParam CarStatus status) {
        return ResponseEntity.ok(carService.updateStatus(id, status, principal.getUsername()));
    }

    @DeleteMapping("/cars/{id}")
    @Operation(summary = "Soft-delete a car — guards against active bookings")
    public ResponseEntity<Void> deleteCar(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID id) {
        carService.delete(id, principal.getUsername());
        return ResponseEntity.noContent().build();
    }

    // ── Booking management ────────────────────────────────────────────────────

    @GetMapping("/bookings")
    @Operation(summary = "List all bookings — filter by status, user email, date range")
    public ResponseEntity<PageResponse<BookingResponse>> getAllBookings(
            @RequestParam(required = false) BookingStatus status,
            @RequestParam(required = false) String userEmail,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @PageableDefault(size = 20, sort = "createdAt") Pageable pageable) {
        return ResponseEntity.ok(bookingService.getAllBookings(status, userEmail, from, to, pageable));
    }

    @PatchMapping("/bookings/{id}/complete")
    @Operation(summary = "Mark a CONFIRMED booking as COMPLETED")
    public ResponseEntity<BookingResponse> completeBooking(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID id) {
        return ResponseEntity.ok(bookingService.complete(id, principal));
    }

    @PostMapping("/bookings/{id}/force-cancel")
    @Operation(summary = "Force-cancel any non-terminal booking — triggers refund event")
    public ResponseEntity<BookingResponse> forceCancel(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID id,
            @Valid @RequestBody ForceCancelRequest request) {
        return ResponseEntity.ok(bookingService.forceCancel(id, request.reason(), principal));
    }

    // ── Audit trail ───────────────────────────────────────────────────────────

    @GetMapping("/audit/{entityType}/{entityId}")
    @Operation(summary = "Full audit trail for a specific entity (Booking or Car)")
    public ResponseEntity<PageResponse<AuditLogResponse>> getAuditTrail(
            @PathVariable String entityType,
            @PathVariable UUID entityId,
            @PageableDefault(size = 50, sort = "createdAt") Pageable pageable) {
        return ResponseEntity.ok(
            PageResponse.from(
                auditLogRepository
                    .findByEntityTypeAndEntityId(entityType, entityId, pageable)
                    .map(this::toAuditResponse)));
    }

    @GetMapping("/audit/actor/{actor}")
    @Operation(summary = "All actions performed by a specific user (compliance view)")
    public ResponseEntity<PageResponse<AuditLogResponse>> getAuditByActor(
            @PathVariable String actor,
            @PageableDefault(size = 50, sort = "createdAt") Pageable pageable) {
        return ResponseEntity.ok(
            PageResponse.from(
                auditLogRepository.findByActor(actor, pageable).map(this::toAuditResponse)));
    }

    private AuditLogResponse toAuditResponse(AuditLog log) {
        return AuditLogResponse.builder()
            .id(log.getId())
            .entityType(log.getEntityType())
            .entityId(log.getEntityId())
            .action(log.getAction())
            .actor(log.getActor())
            .oldValue(log.getOldValue())
            .newValue(log.getNewValue())
            .details(log.getDetails())
            .createdAt(log.getCreatedAt())
            .build();
    }
}
