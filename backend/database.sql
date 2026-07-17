-- ============================================================
--  HIGH-END HOTEL MANAGEMENT SYSTEM — DATABASE SCHEMA
--  Project  : Grand Luxe Hotel Management System
--  Author   : Ankit Sharma
--  Database : hotel_management_db
--  Engine   : MySQL 8.0+
-- ============================================================

-- Drop & recreate database
DROP DATABASE IF EXISTS hotel_management_db;
CREATE DATABASE hotel_management_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE hotel_management_db;

-- ============================================================
-- TABLE 1: users
-- Stores all system users: guests, staff, admins
-- ============================================================
CREATE TABLE users (
  id               INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  full_name        VARCHAR(100)     NOT NULL,
  email            VARCHAR(100)     NOT NULL,
  password_hash    VARCHAR(255)     NOT NULL,
  role             ENUM('guest','staff','admin') NOT NULL DEFAULT 'guest',
  phone            VARCHAR(20)               DEFAULT NULL,
  address          TEXT                      DEFAULT NULL,
  profile_image    VARCHAR(255)              DEFAULT NULL,
  is_active        TINYINT(1)       NOT NULL DEFAULT 1,
  email_verified   TINYINT(1)       NOT NULL DEFAULT 0,
  last_login       TIMESTAMP                 DEFAULT NULL,
  created_at       TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP
                                    ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  INDEX idx_users_role  (role),
  INDEX idx_users_active (is_active)
) ENGINE=InnoDB
  AUTO_INCREMENT=1
  COMMENT='All system users: guests, staff, admins';

-- ============================================================
-- TABLE 2: room_types
-- Master table for room categories & pricing
-- ============================================================
CREATE TABLE room_types (
  id               INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  type_name        VARCHAR(60)      NOT NULL,
  base_price       DECIMAL(10,2)    NOT NULL,
  max_occupancy    INT UNSIGNED     NOT NULL DEFAULT 2,
  size_sqft        INT UNSIGNED              DEFAULT NULL,
  description      TEXT                      DEFAULT NULL,
  created_at       TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_room_type_name (type_name)
) ENGINE=InnoDB
  COMMENT='Room categories with base pricing';

-- ============================================================
-- TABLE 3: rooms
-- Individual hotel rooms
-- ============================================================
CREATE TABLE rooms (
  id               INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  room_number      VARCHAR(10)      NOT NULL,
  room_type_id     INT UNSIGNED     NOT NULL,
  floor            SMALLINT         NOT NULL DEFAULT 1,
  price            DECIMAL(10,2)    NOT NULL COMMENT 'Override price (0 = use room_type base_price)',
  status           ENUM('available','reserved','occupied','maintenance','out_of_order')
                                    NOT NULL DEFAULT 'available',
  amenities        JSON                      DEFAULT NULL
                   COMMENT 'e.g. ["WiFi","AC","Mini Bar","Jacuzzi"]',
  bed_type         ENUM('single','double','queen','king','twin') DEFAULT 'double',
  view_type        VARCHAR(50)               DEFAULT NULL
                   COMMENT 'e.g. Sea View, City View, Garden View',
  smoking_allowed  TINYINT(1)       NOT NULL DEFAULT 0,
  image_url        VARCHAR(255)              DEFAULT NULL,
  notes            TEXT                      DEFAULT NULL,
  created_at       TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP
                                    ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_room_number (room_number),
  INDEX idx_rooms_status    (status),
  INDEX idx_rooms_type      (room_type_id),
  INDEX idx_rooms_floor     (floor),

  CONSTRAINT fk_rooms_type
    FOREIGN KEY (room_type_id)
    REFERENCES room_types (id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
) ENGINE=InnoDB
  COMMENT='Individual hotel rooms with amenities and status';

-- ============================================================
-- TABLE 4: bookings
-- Room reservations made by guests
-- ============================================================
CREATE TABLE bookings (
  id               INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  booking_ref      VARCHAR(20)      NOT NULL
                   COMMENT 'Human-readable reference e.g. GL-2024-00001',
  user_id          INT UNSIGNED     NOT NULL COMMENT 'Guest who booked',
  room_id          INT UNSIGNED     NOT NULL,
  check_in         DATE             NOT NULL,
  check_out        DATE             NOT NULL,
  adults           TINYINT UNSIGNED NOT NULL DEFAULT 1,
  children         TINYINT UNSIGNED NOT NULL DEFAULT 0,
  total_amount     DECIMAL(10,2)    NOT NULL DEFAULT 0.00,
  discount_amount  DECIMAL(10,2)    NOT NULL DEFAULT 0.00,
  tax_amount       DECIMAL(10,2)    NOT NULL DEFAULT 0.00,
  final_amount     DECIMAL(10,2)    NOT NULL DEFAULT 0.00
                   COMMENT 'total_amount - discount + tax',
  payment_status   ENUM('pending','partial','paid','refunded','failed')
                                    NOT NULL DEFAULT 'pending',
  booking_status   ENUM('pending','confirmed','checked_in','checked_out','cancelled','no_show')
                                    NOT NULL DEFAULT 'pending',
  special_requests TEXT                      DEFAULT NULL,
  cancelled_at     TIMESTAMP                 DEFAULT NULL,
  cancellation_reason VARCHAR(255)           DEFAULT NULL,
  booked_by        INT UNSIGNED              DEFAULT NULL
                   COMMENT 'Staff ID if booked by reception, NULL if self-service',
  created_at       TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP
                                    ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_booking_ref (booking_ref),
  INDEX idx_bookings_user       (user_id),
  INDEX idx_bookings_room       (room_id),
  INDEX idx_bookings_checkin    (check_in),
  INDEX idx_bookings_checkout   (check_out),
  INDEX idx_bookings_status     (booking_status),
  INDEX idx_bookings_payment    (payment_status),

  CONSTRAINT fk_bookings_user
    FOREIGN KEY (user_id)
    REFERENCES users (id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,

  CONSTRAINT fk_bookings_room
    FOREIGN KEY (room_id)
    REFERENCES rooms (id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,

  CONSTRAINT fk_bookings_staff
    FOREIGN KEY (booked_by)
    REFERENCES users (id)
    ON UPDATE CASCADE
    ON DELETE SET NULL,

  CONSTRAINT chk_dates
    CHECK (check_out > check_in)
) ENGINE=InnoDB
  COMMENT='Room bookings/reservations by guests';

-- ============================================================
-- TABLE 5: payments
-- Payment records linked to bookings
-- ============================================================
CREATE TABLE payments (
  id               INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  booking_id       INT UNSIGNED     NOT NULL,
  amount           DECIMAL(10,2)    NOT NULL,
  payment_method   ENUM('cash','card','upi','net_banking','wallet','cheque')
                                    NOT NULL DEFAULT 'cash',
  payment_status   ENUM('pending','completed','failed','refunded')
                                    NOT NULL DEFAULT 'pending',
  transaction_id   VARCHAR(100)              DEFAULT NULL
                   COMMENT 'Gateway transaction reference',
  payment_date     TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  notes            VARCHAR(255)              DEFAULT NULL,
  processed_by     INT UNSIGNED              DEFAULT NULL
                   COMMENT 'Staff who processed payment',

  PRIMARY KEY (id),
  INDEX idx_payments_booking (booking_id),
  INDEX idx_payments_status  (payment_status),
  INDEX idx_payments_date    (payment_date),

  CONSTRAINT fk_payments_booking
    FOREIGN KEY (booking_id)
    REFERENCES bookings (id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,

  CONSTRAINT fk_payments_staff
    FOREIGN KEY (processed_by)
    REFERENCES users (id)
    ON UPDATE CASCADE
    ON DELETE SET NULL
) ENGINE=InnoDB
  COMMENT='Payment transactions for bookings';

-- ============================================================
-- TABLE 6: staff
-- Staff profile linked to users table
-- ============================================================
CREATE TABLE staff (
  id                  INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  user_id             INT UNSIGNED     NOT NULL UNIQUE
                      COMMENT 'Links to users table',
  position            VARCHAR(80)      NOT NULL
                      COMMENT 'e.g. Receptionist, Housekeeping, Manager',
  department          ENUM('front_desk','housekeeping','food_beverage',
                           'maintenance','security','management','finance','hr')
                                       NOT NULL DEFAULT 'front_desk',
  salary              DECIMAL(10,2)    NOT NULL DEFAULT 0.00,
  salary_type         ENUM('monthly','weekly','hourly') NOT NULL DEFAULT 'monthly',
  joining_date        DATE             NOT NULL,
  last_payment_date   DATE                       DEFAULT NULL,
  next_payment_date   DATE                       DEFAULT NULL,
  bank_account        VARCHAR(30)                DEFAULT NULL,
  bank_name           VARCHAR(60)                DEFAULT NULL,
  emergency_contact   VARCHAR(100)               DEFAULT NULL,
  emergency_phone     VARCHAR(20)                DEFAULT NULL,
  is_active           TINYINT(1)       NOT NULL DEFAULT 1,
  attendance_logs     JSON                       DEFAULT NULL
                      COMMENT '[{"date":"2024-01-01","check_in":"09:00","check_out":"17:00","status":"present"}]',
  notes               TEXT                       DEFAULT NULL,
  created_at          TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP
                                       ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_staff_user (user_id),
  INDEX idx_staff_department (department),
  INDEX idx_staff_active     (is_active),
  INDEX idx_staff_next_pay   (next_payment_date),

  CONSTRAINT fk_staff_user
    FOREIGN KEY (user_id)
    REFERENCES users (id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
) ENGINE=InnoDB
  COMMENT='Staff profiles, salary, attendance linked to users';

-- ============================================================
-- TABLE 7: salary_payments
-- Track salary disbursement history for staff
-- ============================================================
CREATE TABLE salary_payments (
  id               INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  staff_id         INT UNSIGNED     NOT NULL,
  amount           DECIMAL(10,2)    NOT NULL,
  payment_date     DATE             NOT NULL,
  payment_mode     ENUM('bank_transfer','cash','cheque') NOT NULL DEFAULT 'bank_transfer',
  period_from      DATE             NOT NULL,
  period_to        DATE             NOT NULL,
  status           ENUM('pending','paid','hold') NOT NULL DEFAULT 'pending',
  remarks          VARCHAR(255)              DEFAULT NULL,
  processed_by     INT UNSIGNED              DEFAULT NULL,
  created_at       TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  INDEX idx_salary_staff  (staff_id),
  INDEX idx_salary_date   (payment_date),

  CONSTRAINT fk_salary_staff
    FOREIGN KEY (staff_id)
    REFERENCES staff (id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,

  CONSTRAINT fk_salary_processor
    FOREIGN KEY (processed_by)
    REFERENCES users (id)
    ON UPDATE CASCADE
    ON DELETE SET NULL
) ENGINE=InnoDB
  COMMENT='Staff salary payment history';

-- ============================================================
-- TABLE 8: contact_messages
-- Inquiries from the contact form
-- ============================================================
CREATE TABLE contact_messages (
  id               INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  name             VARCHAR(100)     NOT NULL,
  email            VARCHAR(100)     NOT NULL,
  subject          VARCHAR(200)              DEFAULT NULL,
  message          TEXT             NOT NULL,
  is_read          TINYINT(1)       NOT NULL DEFAULT 0,
  replied_at       TIMESTAMP                 DEFAULT NULL,
  created_at       TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  INDEX idx_contact_read (is_read)
) ENGINE=InnoDB
  COMMENT='Guest contact form submissions';

-- ============================================================
-- VIEWS — useful for reporting & dashboard
-- ============================================================

-- View: Available rooms with full details
CREATE OR REPLACE VIEW vw_available_rooms AS
  SELECT
    r.id,
    r.room_number,
    rt.type_name           AS type,
    r.floor,
    rt.base_price,
    r.price                AS override_price,
    CASE WHEN r.price > 0 THEN r.price ELSE rt.base_price END AS effective_price,
    r.status,
    r.amenities,
    r.bed_type,
    r.view_type,
    rt.max_occupancy,
    rt.description
  FROM rooms r
  JOIN room_types rt ON rt.id = r.room_type_id
  WHERE r.status = 'available';

-- View: Full booking details with guest & room info
CREATE OR REPLACE VIEW vw_booking_details AS
  SELECT
    b.id                   AS booking_id,
    b.booking_ref,
    b.booking_status,
    b.payment_status,
    b.check_in,
    b.check_out,
    DATEDIFF(b.check_out, b.check_in) AS nights,
    b.adults,
    b.children,
    b.total_amount,
    b.discount_amount,
    b.tax_amount,
    b.final_amount,
    b.special_requests,
    b.created_at           AS booked_on,
    u.id                   AS guest_id,
    u.full_name            AS guest_name,
    u.email                AS guest_email,
    u.phone                AS guest_phone,
    r.room_number,
    rt.type_name           AS room_type,
    r.floor,
    r.bed_type
  FROM bookings b
  JOIN users u  ON b.user_id = u.id
  JOIN rooms r  ON b.room_id = r.id
  JOIN room_types rt ON r.room_type_id = rt.id;

-- View: Staff details with user info
CREATE OR REPLACE VIEW vw_staff_details AS
  SELECT
    s.id                   AS staff_id,
    u.id                   AS user_id,
    u.full_name,
    u.email,
    u.phone,
    s.position,
    s.department,
    s.salary,
    s.salary_type,
    s.joining_date,
    s.last_payment_date,
    s.next_payment_date,
    s.is_active
  FROM staff s
  JOIN users u ON s.user_id = u.id;

-- ============================================================
-- SEED DATA — Room Types
-- ============================================================
INSERT INTO room_types (type_name, base_price, max_occupancy, size_sqft, description) VALUES
  ('Standard',          2500.00,  2,  320, 'Comfortable standard room with essential amenities'),
  ('Deluxe',            4500.00,  2,  450, 'Spacious deluxe room with premium furnishings and city view'),
  ('Suite',             8500.00,  3,  650, 'Elegant suite with separate living area and premium decor'),
  ('Executive',         6500.00,  2,  520, 'Executive room with lounge access, work desk and premium toiletries'),
  ('Presidential Suite',18000.00, 6, 1400, 'Our finest accommodation with private pool and butler service'),
  ('Villa',            25000.00,  8, 2200, 'Private villa with exclusive amenities and dedicated staff');

-- ============================================================
-- SEED DATA — Sample Rooms
-- ============================================================
INSERT INTO rooms (room_number, room_type_id, floor, price, status, amenities, bed_type, view_type) VALUES
  ('101', 1, 1, 0, 'available',   JSON_ARRAY('WiFi','AC','TV','Mini Fridge'),           'double', 'Garden View'),
  ('102', 1, 1, 0, 'available',   JSON_ARRAY('WiFi','AC','TV','Mini Fridge'),           'twin',   'Garden View'),
  ('103', 1, 1, 0, 'occupied',    JSON_ARRAY('WiFi','AC','TV','Mini Fridge'),           'double', 'Garden View'),
  ('201', 2, 2, 0, 'available',   JSON_ARRAY('WiFi','AC','TV','Mini Bar','Safe'),       'king',   'City View'),
  ('202', 2, 2, 0, 'available',   JSON_ARRAY('WiFi','AC','TV','Mini Bar','Safe'),       'queen',  'City View'),
  ('203', 2, 2, 0, 'reserved',    JSON_ARRAY('WiFi','AC','TV','Mini Bar','Safe'),       'king',   'Pool View'),
  ('301', 3, 3, 0, 'available',   JSON_ARRAY('WiFi','AC','TV','Mini Bar','Jacuzzi','Lounge'), 'king', 'Sea View'),
  ('302', 3, 3, 0, 'available',   JSON_ARRAY('WiFi','AC','TV','Mini Bar','Jacuzzi','Lounge'), 'king', 'Sea View'),
  ('401', 4, 4, 0, 'available',   JSON_ARRAY('WiFi','AC','TV','Mini Bar','Safe','Lounge Access','Work Desk'), 'king', 'City View'),
  ('501', 5, 5, 0, 'available',   JSON_ARRAY('WiFi','AC','TV','Mini Bar','Jacuzzi','Private Pool','Butler','Lounge'), 'king', 'Panoramic'),
  ('601', 6, 1, 0, 'available',   JSON_ARRAY('WiFi','AC','TV','Full Kitchen','Private Pool','Chef','Butler','Gym'), 'king', 'Beachfront');

-- ============================================================
-- SEED DATA — Admin User (password: admin@123)
-- Hash generated with bcrypt rounds=10
-- ============================================================
INSERT INTO users (full_name, email, password_hash, role, phone) VALUES
  ('Admin User',   'admin@grandluxe.com',  '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.', 'admin', '9000000001'),
  ('Staff User',   'staff@grandluxe.com',  '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.', 'staff', '9000000002'),
  ('Guest User',   'guest@grandluxe.com',  '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.', 'guest', '9000000003');

-- ============================================================
-- USEFUL QUERIES FOR REFERENCE
-- ============================================================

-- 1. Get all available rooms with pricing
-- SELECT * FROM vw_available_rooms ORDER BY effective_price;

-- 2. Get all active bookings with guest & room details
-- SELECT * FROM vw_booking_details WHERE booking_status IN ('confirmed','checked_in');

-- 3. Check room availability for a date range
-- SELECT r.room_number, rt.type_name, rt.base_price
-- FROM rooms r JOIN room_types rt ON r.room_type_id = rt.id
-- WHERE r.status = 'available'
-- AND r.id NOT IN (
--   SELECT room_id FROM bookings
--   WHERE booking_status NOT IN ('cancelled','checked_out')
--   AND check_in < '2024-12-31' AND check_out > '2024-12-28'
-- );

-- 4. Revenue report by month
-- SELECT DATE_FORMAT(payment_date,'%Y-%m') AS month,
--        SUM(amount) AS total_revenue, COUNT(*) AS transactions
-- FROM payments WHERE payment_status = 'completed'
-- GROUP BY month ORDER BY month DESC;

-- 5. Staff attendance summary
-- SELECT u.full_name, s.position, s.department, s.salary,
--        s.last_payment_date, s.next_payment_date
-- FROM vw_staff_details s
-- JOIN users u ON s.user_id = u.id
-- WHERE s.is_active = 1;

-- 6. Dashboard stats
-- SELECT
--   (SELECT COUNT(*) FROM rooms) AS total_rooms,
--   (SELECT COUNT(*) FROM rooms WHERE status='available') AS available_rooms,
--   (SELECT COUNT(*) FROM rooms WHERE status='occupied') AS occupied_rooms,
--   (SELECT COUNT(*) FROM users WHERE role='guest') AS total_guests,
--   (SELECT COUNT(*) FROM bookings WHERE DATE(created_at)=CURDATE()) AS bookings_today,
--   (SELECT COALESCE(SUM(amount),0) FROM payments WHERE payment_status='completed' AND DATE(payment_date)=CURDATE()) AS revenue_today;
