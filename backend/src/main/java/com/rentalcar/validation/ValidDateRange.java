package com.rentalcar.validation;

import jakarta.validation.Constraint;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import jakarta.validation.Payload;

import java.lang.annotation.*;

/**
 * Validates that endDate is not before startDate at the DTO layer —
 * before the request even reaches the service.
 *
 * Applied at class level on BookingRequest.
 * Deepak's design — cleaner than a service-level throw.
 *
 * Usage: @ValidDateRange on BookingRequest class
 */
@Documented
@Constraint(validatedBy = ValidDateRange.Validator.class)
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
public @interface ValidDateRange {
    String message() default "End date must be after start date";
    Class<?>[] groups() default {};
    Class<? extends Payload>[] payload() default {};

    class Validator implements ConstraintValidator<ValidDateRange, com.rentalcar.dto.request.BookingRequest> {
        @Override
        public boolean isValid(com.rentalcar.dto.request.BookingRequest req,
                               ConstraintValidatorContext ctx) {
            if (req.getStartDate() == null || req.getEndDate() == null) {
                return true; // @NotNull handles null cases separately
            }
            return req.getEndDate().isAfter(req.getStartDate());
        }
    }
}
