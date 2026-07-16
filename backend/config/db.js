const dotenv = require("dotenv");
const path = require("path");
const mysql = require("mysql2/promise");

dotenv.config({ path: path.resolve(__dirname, "..", ".env"), override: true });

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "hotel_management_db",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  multipleStatements: true,
  timezone: "Z",
});

const initializeDatabase = async () => {
  try {
    await pool.query("SELECT 1");
    console.log("Database connection established.");

    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        full_name VARCHAR(100) NOT NULL,
        email VARCHAR(100) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        role ENUM('admin','staff','guest') NOT NULL DEFAULT 'guest',
        phone VARCHAR(15) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;

      CREATE TABLE IF NOT EXISTS guests (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        full_name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE,
        phone VARCHAR(15) NOT NULL UNIQUE,
        gender ENUM('male','female','other') NOT NULL,
        address TEXT,
        id_proof_type VARCHAR(50),
        id_proof_number VARCHAR(50) UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;

      CREATE TABLE IF NOT EXISTS room_types (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        type_name VARCHAR(50) NOT NULL UNIQUE,
        price_per_night DECIMAL(10,2) NOT NULL,
        capacity INT NOT NULL,
        description VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;

      CREATE TABLE IF NOT EXISTS rooms (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        room_number VARCHAR(10) NOT NULL UNIQUE,
        room_type_id INT UNSIGNED NOT NULL,
        floor INT NOT NULL,
        room_status ENUM('available','reserved','occupied','maintenance') NOT NULL DEFAULT 'available',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_rooms_room_type FOREIGN KEY (room_type_id) REFERENCES room_types(id) ON UPDATE CASCADE ON DELETE RESTRICT
      ) ENGINE=InnoDB;

      CREATE TABLE IF NOT EXISTS bookings (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        guest_id INT UNSIGNED NOT NULL,
        room_id INT UNSIGNED NOT NULL,
        check_in DATE NOT NULL,
        check_out DATE NOT NULL,
        adults INT UNSIGNED NOT NULL DEFAULT 1,
        children INT UNSIGNED NOT NULL DEFAULT 0,
        total_amount DECIMAL(10,2) NOT NULL,
        booking_status ENUM('pending','confirmed','checked_in','checked_out','cancelled') NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_bookings_guest FOREIGN KEY (guest_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT,
        CONSTRAINT fk_bookings_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON UPDATE CASCADE ON DELETE RESTRICT
      ) ENGINE=InnoDB;

      CREATE TABLE IF NOT EXISTS payments (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        booking_id INT UNSIGNED NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        payment_method ENUM('cash','card','upi','net_banking') NOT NULL,
        payment_status ENUM('pending','paid','failed','refunded') NOT NULL DEFAULT 'pending',
        transaction_id VARCHAR(100),
        payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_payments_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON UPDATE CASCADE ON DELETE CASCADE
      ) ENGINE=InnoDB;

      CREATE TABLE IF NOT EXISTS contact_messages (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) NOT NULL,
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);

    console.log("Database schema ready.");
  } catch (error) {
    console.warn("Database initialization skipped:", error.message);
  }
};

module.exports = {
  pool,
  initializeDatabase,
};
