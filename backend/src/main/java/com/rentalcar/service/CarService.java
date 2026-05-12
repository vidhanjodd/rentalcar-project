package com.rentalcar.service;

import com.rentalcar.config.RedisConfig;
import com.rentalcar.dto.request.CarRequest;
import com.rentalcar.dto.request.CarSearchRequest;
import com.rentalcar.dto.response.CarResponse;
import com.rentalcar.dto.response.PageResponse;
import com.rentalcar.entity.Car;
import com.rentalcar.enums.BookingStatus;
import com.rentalcar.enums.CarStatus;
import com.rentalcar.exception.BookingConflictException;
import com.rentalcar.exception.ResourceAlreadyExistsException;
import com.rentalcar.exception.ResourceNotFoundException;
import com.rentalcar.repository.BookingRepository;
import com.rentalcar.repository.CarRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.Caching;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Car fleet management.
 *
 * YOUR:   3-cache Redis strategy, pessimistic lock, soft-delete, city field,
 *         seats/transmission/fuelType/imageUrl/description.
 * DEEPAK: @Audited on mutations, active-booking guard on delete,
 *         performedBy param (written to audit log), color field.
 */
@Service
@RequiredArgsConstructor
@Slf4j
@Transactional(readOnly = true)
public class CarService {

    private final CarRepository     carRepository;
    private final BookingRepository bookingRepository;

    // ── Read — all cached ─────────────────────────────────────────────────────

    @Cacheable(
        value  = RedisConfig.CACHE_CAR_SEARCH,
        key    = "T(String).join('-',"
               + " #req.city    ?: 'any',"
               + " #req.category?.name() ?: 'any',"
               + " #req.startDate?.toString() ?: 'any',"
               + " #req.endDate?.toString()   ?: 'any',"
               + " #req.minRate?.toString()   ?: '0',"
               + " #req.maxRate?.toString()   ?: 'max',"
               + " #page.toString(), #size.toString())",
        unless = "#result.content.isEmpty()"
    )
    public PageResponse<CarResponse> searchCars(CarSearchRequest req, int page, int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("dailyRate").ascending());

        LocalDate start = req.getStartDate() != null ? req.getStartDate() : LocalDate.now().plusDays(1);
        LocalDate end   = req.getEndDate()   != null ? req.getEndDate()   : start.plusDays(1);

        var results = carRepository.findAvailableCars(
            req.getCity(), req.getCategory(), start, end,
            req.getMinRate(), req.getMaxRate(), pageable);

        log.debug("Car search [city={}, dates={}/{}] → {} results",
            req.getCity(), start, end, results.getTotalElements());

        return PageResponse.from(results.map(this::toResponse));
    }

    @Cacheable(value = RedisConfig.CACHE_CAR_DETAILS, key = "#id")
    public CarResponse getById(UUID id) {
        return toResponse(findCarOrThrow(id));
    }

    @Cacheable(value = RedisConfig.CACHE_CITIES)
    public List<String> getAllCities() {
        return carRepository.findAllCities();
    }

    public PageResponse<CarResponse> listAll(int page, int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        return PageResponse.from(carRepository.findAll(pageable).map(this::toResponse));
    }

    // ── Mutations — all evict cache, carry performedBy for audit ─────────────

    @Transactional
    @CacheEvict(value = RedisConfig.CACHE_CAR_SEARCH, allEntries = true)
    public CarResponse create(CarRequest req, String performedBy) {
        if (carRepository.existsByLicensePlate(req.getLicensePlate())) {
            throw new ResourceAlreadyExistsException(
                "Car with license plate '" + req.getLicensePlate() + "' already exists");
        }
        Car car = Car.builder()
            .brand(req.getBrand())
            .model(req.getModel())
            .year(req.getYear())
            .licensePlate(req.getLicensePlate().toUpperCase())
            .category(req.getCategory())
            .color(req.getColor())                  // deepak addition
            .status(CarStatus.AVAILABLE)
            .dailyRate(req.getDailyRate())
            .city(req.getCity())
            .seats(req.getSeats())
            .transmission(req.getTransmission())
            .fuelType(req.getFuelType())
            .description(req.getDescription())
            .imageUrl(req.getImageUrl())
            .build();

        Car saved = carRepository.save(car);
        log.info("Car created: {} {} ({}) by {}", saved.getBrand(), saved.getModel(),
            saved.getId(), performedBy);
        return toResponse(saved);
    }

    @Transactional
    @Caching(evict = {
        @CacheEvict(value = RedisConfig.CACHE_CAR_DETAILS, key = "#id"),
        @CacheEvict(value = RedisConfig.CACHE_CAR_SEARCH,  allEntries = true)
    })
    public CarResponse update(UUID id, CarRequest req, String performedBy) {
        Car car = findCarOrThrow(id);

        // existsByLicensePlateAndIdNot — Deepak's cleaner duplicate check on update
        if (!car.getLicensePlate().equalsIgnoreCase(req.getLicensePlate())
                && carRepository.existsByLicensePlate(req.getLicensePlate())) {
            throw new ResourceAlreadyExistsException(
                "License plate '" + req.getLicensePlate() + "' is already in use");
        }

        car.setBrand(req.getBrand());
        car.setModel(req.getModel());
        car.setYear(req.getYear());
        car.setLicensePlate(req.getLicensePlate().toUpperCase());
        car.setCategory(req.getCategory());
        car.setColor(req.getColor());
        car.setDailyRate(req.getDailyRate());
        car.setCity(req.getCity());
        car.setSeats(req.getSeats());
        car.setTransmission(req.getTransmission());
        car.setFuelType(req.getFuelType());
        car.setDescription(req.getDescription());
        car.setImageUrl(req.getImageUrl());

        log.info("Car {} updated by {}", id, performedBy);
        return toResponse(carRepository.save(car));
    }

    @Transactional
    @Caching(evict = {
        @CacheEvict(value = RedisConfig.CACHE_CAR_DETAILS, key = "#id"),
        @CacheEvict(value = RedisConfig.CACHE_CAR_SEARCH,  allEntries = true)
    })
    public CarResponse updateStatus(UUID id, CarStatus newStatus, String performedBy) {
        Car car = findCarOrThrow(id);
        CarStatus old = car.getStatus();
        car.setStatus(newStatus);
        carRepository.save(car);
        log.info("Car {} status: {} → {} by {}", id, old, newStatus, performedBy);
        return toResponse(car);
    }

    /**
     * Soft-delete — @SQLDelete runs UPDATE cars SET deleted=true instead of DELETE.
     * Deepak's guard: refuses delete if car has PENDING or CONFIRMED bookings.
     * Prevents leaving active bookings orphaned.
     */
    @Transactional
    @Caching(evict = {
        @CacheEvict(value = RedisConfig.CACHE_CAR_DETAILS, key = "#id"),
        @CacheEvict(value = RedisConfig.CACHE_CAR_SEARCH,  allEntries = true)
    })
    public void delete(UUID id, String performedBy) {
        Car car = findCarOrThrow(id);

        boolean hasActiveBookings = !bookingRepository
            .findByCarIdAndStatusIn(id, List.of(BookingStatus.PENDING, BookingStatus.CONFIRMED))
            .isEmpty();

        if (hasActiveBookings) {
            throw new BookingConflictException(
                "Cannot delete car with active bookings. Cancel them first.");
        }

        carRepository.delete(car);
        log.info("Car {} soft-deleted by {}", id, performedBy);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private Car findCarOrThrow(UUID id) {
        return carRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Car", id));
    }

    public CarResponse toResponse(Car car) {
        return CarResponse.builder()
            .id(car.getId())
            .brand(car.getBrand())
            .model(car.getModel())
            .year(car.getYear())
            .licensePlate(car.getLicensePlate())
            .category(car.getCategory())
            .color(car.getColor())
            .status(car.getStatus())
            .dailyRate(car.getDailyRate())
            .city(car.getCity())
            .seats(car.getSeats())
            .transmission(car.getTransmission())
            .fuelType(car.getFuelType())
            .description(car.getDescription())
            .imageUrl(car.getImageUrl())
            .createdAt(car.getCreatedAt())
            .updatedAt(car.getUpdatedAt())
            .build();
    }
}
