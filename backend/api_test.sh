#!/bin/bash

BASE_URL="http://localhost:8080/api"
RANDOM_SUFFIX=$RANDOM

ADMIN_EMAIL="admin${RANDOM_SUFFIX}@example.com"
ADMIN_USER="admin_${RANDOM_SUFFIX}"

USER_EMAIL="user${RANDOM_SUFFIX}@example.com"
USER_USER="user_${RANDOM_SUFFIX}"

echo "=== AUTH: Register Admin ==="
curl -s -X POST "$BASE_URL/auth/register" -H "Content-Type: application/json" -d "{\"firstName\":\"Admin\",\"lastName\":\"User\",\"username\":\"$ADMIN_USER\",\"email\":\"$ADMIN_EMAIL\",\"password\":\"Password123!\",\"phone\":\"+1234567890\"}" > /dev/null

echo "=== AUTH: Promote to Admin ==="
PGPASSWORD=vidhan psql -h localhost -U vidhan -d rentalcardb -c "UPDATE users SET role = 'ROLE_ADMIN' WHERE email = '$ADMIN_EMAIL';" > /dev/null

echo "=== AUTH: Login Admin ==="
ADMIN_LOGIN=$(curl -s -X POST "$BASE_URL/auth/login" -H "Content-Type: application/json" -d "{\"usernameOrEmail\":\"$ADMIN_EMAIL\",\"password\":\"Password123!\"}")
ADMIN_TOKEN=$(echo $ADMIN_LOGIN | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)

echo "=== AUTH: Register User ==="
curl -s -X POST "$BASE_URL/auth/register" -H "Content-Type: application/json" -d "{\"firstName\":\"Normal\",\"lastName\":\"User\",\"username\":\"$USER_USER\",\"email\":\"$USER_EMAIL\",\"password\":\"Password123!\",\"phone\":\"+1234567890\"}" > /dev/null

echo "=== AUTH: Login User ==="
USER_LOGIN=$(curl -s -X POST "$BASE_URL/auth/login" -H "Content-Type: application/json" -d "{\"usernameOrEmail\":\"$USER_EMAIL\",\"password\":\"Password123!\"}")
USER_TOKEN=$(echo $USER_LOGIN | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)
USER_REFRESH=$(echo $USER_LOGIN | grep -o '"refreshToken":"[^"]*' | cut -d'"' -f4)

echo "=== AUTH: Refresh Token ==="
REFRESH_RES=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/auth/refresh" -H "Content-Type: application/json" -d "{\"refreshToken\":\"$USER_REFRESH\"}")
if [ $(echo "$REFRESH_RES" | tail -n 1) -ne 200 ]; then echo "❌ Refresh failed"; exit 1; fi
USER_TOKEN=$(echo "$REFRESH_RES" | head -n -1 | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)

echo "=== AUTH: Get Current User ==="
if [ $(curl -s -o /dev/null -w "%{http_code}" -X GET "$BASE_URL/auth/me" -H "Authorization: Bearer $USER_TOKEN") -ne 200 ]; then echo "❌ Get Me failed"; exit 1; fi

echo "=== AUTH: Change Password ==="
if [ $(curl -s -o /dev/null -w "%{http_code}" -X PUT "$BASE_URL/auth/change-password" -H "Content-Type: application/json" -H "Authorization: Bearer $USER_TOKEN" -d "{\"currentPassword\":\"Password123!\",\"newPassword\":\"NewPass123!\"}") -ne 200 ]; then echo "❌ Change Password failed"; exit 1; fi

# Login again with new password
USER_LOGIN=$(curl -s -X POST "$BASE_URL/auth/login" -H "Content-Type: application/json" -d "{\"usernameOrEmail\":\"$USER_EMAIL\",\"password\":\"NewPass123!\"}")
USER_TOKEN=$(echo $USER_LOGIN | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)

echo "=== ADMIN CARS: Create Car ==="
CAR_RES=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/admin/cars" -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" -d "{\"brand\":\"Toyota\",\"model\":\"Camry\",\"year\":2023,\"licensePlate\":\"PLT-$RANDOM_SUFFIX\",\"category\":\"SEDAN\",\"color\":\"Silver\",\"dailyRate\":55.00,\"city\":\"New York\",\"seats\":5,\"transmission\":\"AUTOMATIC\",\"fuelType\":\"PETROL\",\"description\":\"Desc\"}")
if [ $(echo "$CAR_RES" | tail -n 1) -ne 201 ]; then echo "❌ Create Car failed"; exit 1; fi
CAR_ID=$(echo "$CAR_RES" | head -n -1 | grep -o '"id":"[^"]*' | cut -d'"' -f4)

echo "=== ADMIN CARS: Update Car ==="
if [ $(curl -s -o /dev/null -w "%{http_code}" -X PUT "$BASE_URL/admin/cars/$CAR_ID" -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" -d "{\"brand\":\"Toyota\",\"model\":\"Camry\",\"year\":2023,\"licensePlate\":\"PLT-$RANDOM_SUFFIX\",\"category\":\"SEDAN\",\"color\":\"Silver\",\"dailyRate\":60.00,\"city\":\"New York\",\"seats\":5,\"transmission\":\"AUTOMATIC\",\"fuelType\":\"PETROL\",\"description\":\"Updated Desc\"}") -ne 200 ]; then echo "❌ Update Car failed"; exit 1; fi

echo "=== ADMIN CARS: Update Car Status ==="
if [ $(curl -s -o /dev/null -w "%{http_code}" -X PATCH "$BASE_URL/admin/cars/$CAR_ID/status?status=MAINTENANCE" -H "Authorization: Bearer $ADMIN_TOKEN") -ne 200 ]; then echo "❌ Update Car Status failed"; exit 1; fi

# Put back to AVAILABLE for booking
curl -s -o /dev/null -X PATCH "$BASE_URL/admin/cars/$CAR_ID/status?status=AVAILABLE" -H "Authorization: Bearer $ADMIN_TOKEN"

echo "=== PUBLIC CARS: Search Cars ==="
if [ $(curl -s -o /dev/null -w "%{http_code}" -X GET "$BASE_URL/cars/search?city=New%20York&page=0&size=10") -ne 200 ]; then echo "❌ Search Cars failed"; exit 1; fi

echo "=== PUBLIC CARS: Get Car by ID ==="
if [ $(curl -s -o /dev/null -w "%{http_code}" -X GET "$BASE_URL/cars/$CAR_ID") -ne 200 ]; then echo "❌ Get Car by ID failed"; exit 1; fi

echo "=== PUBLIC CARS: Get Cities ==="
if [ $(curl -s -o /dev/null -w "%{http_code}" -X GET "$BASE_URL/cars/cities") -ne 200 ]; then echo "❌ Get Cities failed"; exit 1; fi

echo "=== USER BOOKINGS: Create Booking ==="
START_DATE=$(date -d "+1 day" +%Y-%m-%d)
END_DATE=$(date -d "+5 days" +%Y-%m-%d)
BOOKING_RES=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/bookings" -H "Authorization: Bearer $USER_TOKEN" -H "Content-Type: application/json" -d "{\"carId\":\"$CAR_ID\",\"startDate\":\"$START_DATE\",\"endDate\":\"$END_DATE\",\"pickupLocation\":\"Airport\",\"dropoffLocation\":\"Downtown\",\"notes\":\"\"}")
if [ $(echo "$BOOKING_RES" | tail -n 1) -ne 201 ]; then echo "❌ Create Booking failed"; exit 1; fi
BOOKING_ID=$(echo "$BOOKING_RES" | head -n -1 | grep -o '"id":"[^"]*' | cut -d'"' -f4)

echo "=== USER BOOKINGS: Get My Bookings ==="
if [ $(curl -s -o /dev/null -w "%{http_code}" -X GET "$BASE_URL/bookings/my?page=0&size=10" -H "Authorization: Bearer $USER_TOKEN") -ne 200 ]; then echo "❌ Get My Bookings failed"; exit 1; fi

echo "=== USER BOOKINGS: Get Booking by ID ==="
if [ $(curl -s -o /dev/null -w "%{http_code}" -X GET "$BASE_URL/bookings/$BOOKING_ID" -H "Authorization: Bearer $USER_TOKEN") -ne 200 ]; then echo "❌ Get Booking by ID failed"; exit 1; fi

echo "=== USER BOOKINGS: Confirm Booking ==="
if [ $(curl -s -o /dev/null -w "%{http_code}" -X PATCH "$BASE_URL/bookings/$BOOKING_ID/confirm" -H "Authorization: Bearer $USER_TOKEN") -ne 200 ]; then echo "❌ Confirm Booking failed"; exit 1; fi

echo "=== ADMIN BOOKINGS: Get All Bookings ==="
if [ $(curl -s -o /dev/null -w "%{http_code}" -X GET "$BASE_URL/admin/bookings?page=0&size=20" -H "Authorization: Bearer $ADMIN_TOKEN") -ne 200 ]; then echo "❌ Get All Bookings failed"; exit 1; fi

echo "=== ADMIN BOOKINGS: Complete Booking ==="
if [ $(curl -s -o /dev/null -w "%{http_code}" -X PATCH "$BASE_URL/admin/bookings/$BOOKING_ID/complete" -H "Authorization: Bearer $ADMIN_TOKEN") -ne 200 ]; then echo "❌ Complete Booking failed"; exit 1; fi

echo "=== ADMIN BOOKINGS: Force Cancel Booking ==="
START_DATE2=$(date -d "+10 days" +%Y-%m-%d)
END_DATE2=$(date -d "+15 days" +%Y-%m-%d)
BOOKING_RES2=$(curl -s -X POST "$BASE_URL/bookings" -H "Authorization: Bearer $USER_TOKEN" -H "Content-Type: application/json" -d "{\"carId\":\"$CAR_ID\",\"startDate\":\"$START_DATE2\",\"endDate\":\"$END_DATE2\",\"pickupLocation\":\"Airport\",\"dropoffLocation\":\"Downtown\",\"notes\":\"\"}")
BOOKING_ID2=$(echo "$BOOKING_RES2" | grep -o '"id":"[^"]*' | cut -d'"' -f4)
if [ $(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/admin/bookings/$BOOKING_ID2/force-cancel" -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" -d "{\"reason\":\"Admin cancelled\"}") -ne 200 ]; then echo "❌ Force Cancel Booking failed"; exit 1; fi

echo "=== USER BOOKINGS: Cancel Booking ==="
START_DATE3=$(date -d "+20 days" +%Y-%m-%d)
END_DATE3=$(date -d "+25 days" +%Y-%m-%d)
BOOKING_RES3=$(curl -s -X POST "$BASE_URL/bookings" -H "Authorization: Bearer $USER_TOKEN" -H "Content-Type: application/json" -d "{\"carId\":\"$CAR_ID\",\"startDate\":\"$START_DATE3\",\"endDate\":\"$END_DATE3\",\"pickupLocation\":\"Airport\",\"dropoffLocation\":\"Downtown\",\"notes\":\"\"}")
BOOKING_ID3=$(echo "$BOOKING_RES3" | grep -o '"id":"[^"]*' | cut -d'"' -f4)
if [ $(curl -s -o /dev/null -w "%{http_code}" -X PATCH "$BASE_URL/bookings/$BOOKING_ID3/cancel?reason=Change" -H "Authorization: Bearer $USER_TOKEN") -ne 200 ]; then echo "❌ Cancel Booking failed"; exit 1; fi

echo "=== ADMIN AUDIT: Get Audit by Entity (CAR) ==="
if [ $(curl -s -o /dev/null -w "%{http_code}" -X GET "$BASE_URL/admin/audit/Car/$CAR_ID" -H "Authorization: Bearer $ADMIN_TOKEN") -ne 200 ]; then echo "❌ Get Audit by Entity CAR failed"; exit 1; fi

echo "=== ADMIN AUDIT: Get Audit by Actor ==="
if [ $(curl -s -o /dev/null -w "%{http_code}" -X GET "$BASE_URL/admin/audit/actor/$ADMIN_USER" -H "Authorization: Bearer $ADMIN_TOKEN") -ne 200 ]; then echo "❌ Get Audit by Actor failed"; exit 1; fi

echo "=== ADMIN CARS: Delete Car ==="
if [ $(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$BASE_URL/admin/cars/$CAR_ID" -H "Authorization: Bearer $ADMIN_TOKEN") -ne 204 ]; then echo "❌ Delete Car failed"; exit 1; fi

echo "=== AUTH: Logout ==="
if [ $(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/auth/logout" -H "Authorization: Bearer $USER_TOKEN") -ne 200 ]; then echo "❌ Logout failed"; exit 1; fi

echo "🎉 ALL POSTMAN COLLECTION APIS TESTED SUCCESSFULLY!"
