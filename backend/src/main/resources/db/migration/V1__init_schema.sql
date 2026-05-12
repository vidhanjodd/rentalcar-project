-- ============================================================
-- V1__init_schema.sql — Merged Production Schema
-- ============================================================
-- YOUR:   soft-delete, createdBy/updatedBy, all booking fields
--         (dailyRateSnapshot, pickupLocation, dropoffLocation,
--          cancellationReason), refresh_tokens table, seed data,
--         partial indexes, idx_bookings_no_overlap unique guard
-- DEEPAK: CHECK constraints (daily_rate > 0, year range),
--         pool-name on Hikari visible in metrics
-- ============================================================

-- ── Extensions ────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── users ─────────────────────────────────────────────────────────────────────
CREATE TABLE users (
    id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    username     VARCHAR(50)  NOT NULL UNIQUE,
    email        VARCHAR(100) NOT NULL UNIQUE,
    password     VARCHAR(255) NOT NULL,
    first_name   VARCHAR(50)  NOT NULL,
    last_name    VARCHAR(50)  NOT NULL,
    phone        VARCHAR(20),
    role         VARCHAR(20)  NOT NULL DEFAULT 'ROLE_USER',
    enabled      BOOLEAN      NOT NULL DEFAULT TRUE,
    deleted      BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by   VARCHAR(100),
    updated_by   VARCHAR(100)
);

CREATE INDEX idx_users_email    ON users (LOWER(email))    WHERE deleted = FALSE;
CREATE INDEX idx_users_username ON users (LOWER(username)) WHERE deleted = FALSE;
CREATE INDEX idx_users_role     ON users (role)            WHERE deleted = FALSE;

-- ── refresh_tokens ────────────────────────────────────────────────────────────
CREATE TABLE refresh_tokens (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token       VARCHAR(255) NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ  NOT NULL,
    revoked     BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_token   ON refresh_tokens (token)   WHERE revoked = FALSE;
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens (user_id) WHERE revoked = FALSE;

-- ── cars ──────────────────────────────────────────────────────────────────────
CREATE TABLE cars (
    id            UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    brand         VARCHAR(100)   NOT NULL,
    model         VARCHAR(100)   NOT NULL,
    year          INT            NOT NULL,
    license_plate VARCHAR(20)    NOT NULL UNIQUE,
    category      VARCHAR(30)    NOT NULL,
    color         VARCHAR(30),                              -- deepak addition
    status        VARCHAR(20)    NOT NULL DEFAULT 'AVAILABLE',
    daily_rate    NUMERIC(10,2)  NOT NULL,
    city          VARCHAR(100)   NOT NULL,
    seats         INT,
    transmission  VARCHAR(20),
    fuel_type     VARCHAR(20),
    description   TEXT,
    image_url     VARCHAR(500),
    deleted       BOOLEAN        NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    created_by    VARCHAR(100),
    updated_by    VARCHAR(100),
    version       BIGINT         NOT NULL DEFAULT 0,

    -- deepak: correctness guards at DB level
    CONSTRAINT chk_cars_daily_rate CHECK (daily_rate > 0),
    CONSTRAINT chk_cars_year       CHECK (year BETWEEN 1900 AND 2100),
    CONSTRAINT chk_cars_seats      CHECK (seats IS NULL OR seats > 0)
);

CREATE INDEX idx_cars_city_status   ON cars (city, status)   WHERE deleted = FALSE;
CREATE INDEX idx_cars_category      ON cars (category)        WHERE deleted = FALSE;
CREATE INDEX idx_cars_status        ON cars (status)          WHERE deleted = FALSE;
CREATE INDEX idx_cars_daily_rate    ON cars (daily_rate)      WHERE deleted = FALSE;

-- ── bookings ──────────────────────────────────────────────────────────────────
CREATE TABLE bookings (
    id                  UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID           NOT NULL REFERENCES users(id),
    car_id              UUID           NOT NULL REFERENCES cars(id),
    start_date          DATE           NOT NULL,
    end_date            DATE           NOT NULL,
    status              VARCHAR(20)    NOT NULL DEFAULT 'PENDING',
    total_price         NUMERIC(10,2)  NOT NULL,
    daily_rate_snapshot NUMERIC(10,2)  NOT NULL,   -- price immutability
    pickup_location     VARCHAR(200),
    dropoff_location    VARCHAR(200),
    notes               TEXT,
    cancellation_reason TEXT,
    created_at          TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    created_by          VARCHAR(100),
    updated_by          VARCHAR(100),
    version             BIGINT         NOT NULL DEFAULT 0,

    CONSTRAINT chk_booking_dates  CHECK (end_date > start_date),
    CONSTRAINT chk_booking_price  CHECK (total_price > 0),
    CONSTRAINT chk_booking_rate   CHECK (daily_rate_snapshot > 0)
);

CREATE INDEX idx_bookings_user_id   ON bookings (user_id);
CREATE INDEX idx_bookings_car_id    ON bookings (car_id);
CREATE INDEX idx_bookings_status    ON bookings (status);
CREATE INDEX idx_bookings_car_dates ON bookings (car_id, start_date, end_date);
CREATE INDEX idx_bookings_created   ON bookings (created_at DESC);

-- DB-level double-booking guard — catches anything the app layer misses
CREATE UNIQUE INDEX idx_bookings_no_overlap
    ON bookings (car_id, start_date, end_date)
    WHERE status IN ('PENDING', 'CONFIRMED');

-- ── audit_logs ────────────────────────────────────────────────────────────────
CREATE TABLE audit_logs (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(50)  NOT NULL,
    entity_id   UUID         NOT NULL,
    action      VARCHAR(100) NOT NULL,
    old_value   TEXT,
    new_value   TEXT,
    actor       VARCHAR(100) NOT NULL,
    ip_address  VARCHAR(45),
    details     TEXT,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    -- No updated_at — audit logs are write-once, never modified
);

CREATE INDEX idx_audit_entity     ON audit_logs (entity_type, entity_id);
CREATE INDEX idx_audit_actor      ON audit_logs (actor);
CREATE INDEX idx_audit_created_at ON audit_logs (created_at DESC);

-- ── Seed data ─────────────────────────────────────────────────────────────────
-- Admin user — password: Admin@123 (BCrypt strength 12)
INSERT INTO users (id, username, email, password, first_name, last_name, role, enabled)
VALUES (
    gen_random_uuid(),
    'admin',
    'admin@rentalcar.com',
    '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/QmcnorRhe',
    'System', 'Admin', 'ROLE_ADMIN', TRUE
);

-- Sample fleet (Bengaluru)
INSERT INTO cars (brand, model, year, license_plate, category, daily_rate, city, seats, transmission, fuel_type, status)
VALUES
    ('Tata',    'Nexon EV',  2023, 'KA01AB1234', 'SUV',     2500.00, 'Bengaluru', 5, 'AUTOMATIC', 'ELECTRIC',  'AVAILABLE'),
    ('Maruti',  'Swift',     2022, 'KA02CD5678', 'HATCHBACK',800.00, 'Bengaluru', 5, 'MANUAL',    'PETROL',    'AVAILABLE'),
    ('Hyundai', 'Creta',     2023, 'KA03EF9012', 'SUV',     2000.00, 'Bengaluru', 5, 'AUTOMATIC', 'PETROL',    'AVAILABLE'),
    ('Honda',   'City',      2022, 'KA04GH3456', 'SEDAN',   1500.00, 'Bengaluru', 5, 'AUTOMATIC', 'PETROL',    'AVAILABLE'),
    ('Toyota',  'Fortuner',  2023, 'KA05IJ7890', 'SUV',     4500.00, 'Bengaluru', 7, 'AUTOMATIC', 'DIESEL',    'AVAILABLE'),
    ('Tata',    'Altroz',    2023, 'MH01KL1234', 'HATCHBACK',900.00, 'Mumbai',    5, 'MANUAL',    'PETROL',    'AVAILABLE'),
    ('Kia',     'Seltos',    2023, 'MH02MN5678', 'SUV',     2200.00, 'Mumbai',    5, 'AUTOMATIC', 'PETROL',    'AVAILABLE'),
    ('Maruti',  'Baleno',    2022, 'TN01OP9012', 'HATCHBACK',850.00, 'Chennai',   5, 'MANUAL',    'PETROL',    'AVAILABLE'),
    ('Hyundai', 'Verna',     2023, 'TN02QR3456', 'SEDAN',   1600.00, 'Chennai',   5, 'AUTOMATIC', 'PETROL',    'AVAILABLE'),
    ('MG',      'Hector',    2023, 'DL01ST7890', 'SUV',     2800.00, 'Delhi',     5, 'AUTOMATIC', 'PETROL',    'AVAILABLE');
