CREATE DATABASE IF NOT EXISTS stockroom_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE stockroom_db;

CREATE TABLE IF NOT EXISTS users (
 id INT AUTO_INCREMENT PRIMARY KEY,
 email VARCHAR(190) NOT NULL UNIQUE,
 password_hash CHAR(64) NULL,            -- NULL for Google-only owners
 google_id VARCHAR(64) NULL UNIQUE,
 name VARCHAR(190) NULL,
 role ENUM('owner') NOT NULL DEFAULT 'owner',
 active TINYINT(1) NOT NULL DEFAULT 1,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS staff_codes (
 id INT AUTO_INCREMENT PRIMARY KEY,
 code VARCHAR(50) NOT NULL UNIQUE,
 owner_id INT NULL,                       -- which owner this staff code belongs to
 active TINYINT(1) NOT NULL DEFAULT 1,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS foods (
 id VARCHAR(32) PRIMARY KEY,
 name VARCHAR(150) NOT NULL,
 price DECIMAL(10,2) NOT NULL DEFAULT 0,
 stock INT NOT NULL DEFAULT 0,
 type ENUM('food','drink') NOT NULL DEFAULT 'food',
 active TINYINT(1) NOT NULL DEFAULT 1,
 owner_id INT NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 INDEX(active), INDEX(owner_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS submissions (
 id BIGINT AUTO_INCREMENT PRIMARY KEY,
 owner_id INT NULL,
 report_date DATE NOT NULL,
 staff_name VARCHAR(120) NOT NULL,
 location VARCHAR(190) NOT NULL,
 food_id VARCHAR(32) NOT NULL,
 item_name VARCHAR(150) NOT NULL,
 price DECIMAL(10,2) NOT NULL,
 type ENUM('food','drink') NOT NULL,
 taken INT NOT NULL DEFAULT 0,
 returned INT NOT NULL DEFAULT 0,
 sold INT NOT NULL DEFAULT 0,
 sales DECIMAL(12,2) NOT NULL DEFAULT 0,
 submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 INDEX(report_date), INDEX(food_id), INDEX(owner_id),
 CONSTRAINT fk_submission_food FOREIGN KEY(food_id) REFERENCES foods(id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS daily_reports (
 id INT AUTO_INCREMENT PRIMARY KEY,
 owner_id INT NULL,
 report_date DATE NOT NULL,
 totals_json LONGTEXT NOT NULL,
 items_json LONGTEXT NOT NULL,
 submissions_json LONGTEXT NOT NULL,
 saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 UNIQUE KEY uq_owner_date (owner_id, report_date)
) ENGINE=InnoDB;

-- Used by api.php to auto-archive each day without any button click.
-- api.php also creates this automatically if it's missing, so this is just a safety net.
CREATE TABLE IF NOT EXISTS settings (
  k VARCHAR(64) PRIMARY KEY,
  v VARCHAR(64) NOT NULL
) ENGINE=InnoDB;
INSERT INTO users(email,password_hash,role) VALUES ('admin@stockroom.com',SHA2('admin123',256),'owner')
ON DUPLICATE KEY UPDATE password_hash=SHA2('admin123',256),active=1;

SET @o := (SELECT id FROM users WHERE email='admin@stockroom.com');

INSERT INTO staff_codes(code,active,owner_id) VALUES ('STAFF2026',1,@o)
ON DUPLICATE KEY UPDATE active=1, owner_id=@o;

INSERT INTO foods(id,name,price,stock,type,owner_id) VALUES
('palamig','Palamig',20,100,'drink',@o),
('turon','Turon',15,100,'food',@o),
('lumpia','Lumpia',12,100,'food',@o),
('corndogs','Corndogs',35,60,'food',@o)
ON DUPLICATE KEY UPDATE name=VALUES(name),price=VALUES(price),type=VALUES(type),owner_id=@o;
