-- Repair the seeded admin credential so the documented default login works.
UPDATE users
SET password = '$2b$12$M0gguZfeRc3G2wk3te9X3.BDyfLSqZ/NVqqGN1ZtgKbSGkG8kOoQq'
WHERE username = 'admin'
  AND email = 'admin@rentalcar.com';
