package com.rentalcar.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Request body for admin force-cancel operation.
 * Reason is mandatory — creates accountability in the audit log.
 */
public record ForceCancelRequest(
        @NotBlank(message = "Reason is required for force cancellation")
        @Size(max = 500, message = "Reason must not exceed 500 characters")
        String reason
) {}
