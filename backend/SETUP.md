# Rental Car Booking Application - Setup Instructions

## ✅ Fixes Applied

### 1. Compilation Errors (RESOLVED)
- Fixed 16 compilation errors by adding missing fields to entities and DTOs
- Added `color` field to Car entity and CarRequest/CarResponse DTOs
- Added `userEmail`, `licensePlate`, `notes` fields to BookingEvent
- Added missing BookingEventType enums: BOOKING_FORCE_CANCELLED, BOOKING_AUTO_CANCELLED, BOOKING_AUTO_COMPLETED
- Fixed AuditLogService logging issue (variable shadowing)
- Fixed CarController to pass performedBy user parameter for audit trail

### 2. Main Class Configuration (RESOLVED)
- Created `RentalCarApplication.java` as the main Spring Boot application entry point
- Configured in pom.xml with `<mainClass>com.rentalcar.RentalCarApplication</mainClass>`
- Added proper Spring Boot annotations: @EnableCaching, @EnableKafka, @EnableRetry, @EnableScheduling

### 3. Circular Dependency (RESOLVED)
- Fixed circular dependency between SecurityConfig and JwtAuthenticationFilter
- Removed @Component from JwtAuthenticationFilter
- Created JwtAuthenticationFilter as @Bean in SecurityConfig with proper dependency injection
- Eliminated constructor injection of filter in SecurityConfig

### 4. Database Schema (NEEDS MANUAL ACTION)
- Updated V1 migration to include `ip_address` column in audit_logs table (for fresh databases)
- Created V2 migration to add `ip_address` column to existing databases
- **Current Issue**: Existing database may not have this column yet

## 🚀 How to Get the Application Running

### Prerequisites
- PostgreSQL running on localhost:5432
- User: vidhan, Password: vidhan, Database: rentalcardb
- Redis running on localhost:6379 (optional for running with cache disabled)
- Kafka running on localhost:9092 (optional, can disable with configuration)

### Option 1: Fresh Database (RECOMMENDED)

Drop and recreate the database:

```bash
# As postgres user
dropdb rentalcardb
createdb rentalcardb
```

Then run the application:

```bash
cd /home/vidhan/SpringBootApplications/rentalcar-project
mvn spring-boot:run
```

Flyway will automatically:
- Create all tables from V1 (including ip_address in audit_logs)
- Apply V2 migration (which will be a no-op since column already exists)

### Option 2: Existing Database

Manually add the missing `ip_address` column:

```sql
psql -U vidhan -d rentalcardb -c "
ALTER TABLE audit_logs ADD COLUMN ip_address VARCHAR(45);
INSERT INTO flyway_schema_history (version, description, type, installed_by, installed_on, execution_time, success) 
VALUES (2, 'add ip_address to audit_logs', 'SQL', 'vidhan', NOW(), 0, true);
"
```

Then run the application:

```bash
cd /home/vidhan/SpringBootApplications/rentalcar-project
mvn spring-boot:run
```

## 📝 Configuration Notes

The application uses environment variables with defaults:

```yaml
Database:
  - DB_URL: jdbc:postgresql://localhost:5432/rentalcardb
  - DB_USER: vidhan
  - DB_PASSWORD: vidhan

Redis (optional):
  - REDIS_HOST: localhost
  - REDIS_PORT: 6379

Kafka (optional):
  - KAFKA_SERVERS: localhost:9092

JWT:
  - JWT_SECRET: (uses default if not set)
  - JWT_EXPIRATION_MS: 86400000 (24 hours)
```

To run with different configuration:

```bash
DB_URL=jdbc:postgresql://your-host:5432/rentalcardb \
DB_USER=your_user \
DB_PASSWORD=your_pass \
mvn spring-boot:run
```

## 🧪 Testing the API

Once the application starts, access:

- **Swagger UI**: http://localhost:8080/swagger-ui.html
- **API Docs**: http://localhost:8080/api-docs
- **Health Check**: http://localhost:8080/actuator/health

### Example API Call (Create User)

```bash
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username":"testuser",
    "email":"test@example.com",
    "password":"Test@123",
    "firstName":"John",
    "lastName":"Doe"
  }'
```

## 🐛 Troubleshooting

### "Unable to build Hibernate SessionFactory" Error
**Cause**: Database schema doesn't match entity definitions
**Solution**: Use Option 1 (Fresh Database) above

### "Cannot resolve reference to bean 'jpaSharedEM_entityManagerFactory'"
**Cause**: Database schema validation failed during EntityManagerFactory creation
**Solution**: Add missing columns to database or reset database

### Circular dependency errors
**Already Fixed** - All circular dependencies have been resolved

## 📚 Project Structure

```
src/main/java/com/rentalcar/
├── RentalCarApplication.java          (Main entry point)
├── entity/                            (JPA entities)
│   ├── User.java
│   ├── Car.java
│   ├── Booking.java
│   ├── AuditLog.java
│   └── RefreshToken.java
├── service/                           (Business logic)
│   ├── UserService.java
│   ├── CarService.java
│   ├── BookingService.java
│   └── AuditLogService.java
├── controller/                        (REST endpoints)
├── repository/                        (Data access)
├── security/                          (Auth & JWT)
├── config/                            (Spring configuration)
├── kafka/                             (Event streaming)
├── scheduler/                         (Scheduled tasks)
└── exception/                         (Error handling)

src/main/resources/
├── application.yml                    (Configuration)
└── db/migration/
    ├── V1__init_schema.sql           (Initial schema)
    └── V2__add_ip_address_to_audit_logs.sql  (Schema update)
```

## ✨ Features Enabled

- ✅ REST API with Spring Boot 3.2.5
- ✅ JWT Authentication & Role-based Access Control
- ✅ PostgreSQL with JPA/Hibernate
- ✅ Flyway Database Migrations
- ✅ Redis Caching (3-tier strategy)
- ✅ Kafka Event Streaming
- ✅ Audit Logging with Spring AOP
- ✅ Optimistic Locking for Concurrent Updates
- ✅ Retry Logic for Transaction Conflicts
- ✅ Scheduled Tasks (Auto-cancel, Auto-complete)
- ✅ Comprehensive Error Handling
- ✅ OpenAPI/Swagger Documentation
- ✅ Health Checks & Metrics (Prometheus)


