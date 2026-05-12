package com.rentalcar.controller;

import com.rentalcar.dto.request.BookingRequest;
import com.rentalcar.dto.response.BookingResponse;
import com.rentalcar.dto.response.PageResponse;
import com.rentalcar.security.UserPrincipal;
import com.rentalcar.service.BookingService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * Booking lifecycle endpoints for authenticated users.
 * Admin-only operations (complete, forceCancel, getAllBookings)
 * live in AdminController under /api/admin.
 */
@RestController
@RequestMapping("/api/bookings")
@RequiredArgsConstructor
@SecurityRequirement(name = "bearerAuth")
@Tag(name = "Bookings", description = "Booking lifecycle — create, confirm, cancel")
public class BookingController {

    private final BookingService bookingService;

    @PostMapping
    @Operation(summary = "Create a new booking — pessimistic lock prevents double-booking")
    public ResponseEntity<BookingResponse> create(
            @Valid @RequestBody BookingRequest request,
            @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(bookingService.create(request, principal));
    }

    @GetMapping("/my")
    @Operation(summary = "Get authenticated user's bookings — paginated, newest first")
    public ResponseEntity<PageResponse<BookingResponse>> myBookings(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam(defaultValue = "0")  int page,
            @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(bookingService.getMyBookings(principal, page, size));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get booking by ID — owner or admin only")
    public ResponseEntity<BookingResponse> getById(
            @PathVariable UUID id,
            @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(bookingService.getById(id, principal));
    }

    @PatchMapping("/{id}/confirm")
    @Operation(summary = "Confirm a PENDING booking → CONFIRMED")
    public ResponseEntity<BookingResponse> confirm(
            @PathVariable UUID id,
            @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(bookingService.confirm(id, principal));
    }

    @PatchMapping("/{id}/cancel")
    @Operation(summary = "Cancel a booking → CANCELLED — releases car back to AVAILABLE")
    public ResponseEntity<BookingResponse> cancel(
            @PathVariable UUID id,
            @RequestParam(required = false) String reason,
            @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(bookingService.cancel(id, reason, principal));
    }
}
