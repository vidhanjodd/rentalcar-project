package com.rentalcar.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuditLogResponse {

    private UUID id;
    private String entityType;
    private UUID entityId;
    private String action;
    private String actor;
    private String oldValue;
    private String newValue;
    private String details;
    private Instant createdAt;
}
