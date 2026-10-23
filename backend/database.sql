-- ==========================================================
-- Database: injured_animal_detection
-- Project: Injured Animal Detection and Reporting Platform Using AI
-- ==========================================================

CREATE DATABASE IF NOT EXISTS `injured_animal_detection`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE `injured_animal_detection`;

-- ----------------------------------------------------------
-- 1. Table: cameras
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS `cameras` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `camera_code` VARCHAR(64) NOT NULL UNIQUE,
  `camera_name` VARCHAR(128) NOT NULL,
  `location_name` VARCHAR(255) DEFAULT 'Main Road / Public View',
  `latitude` DECIMAL(10,7) DEFAULT NULL,
  `longitude` DECIMAL(10,7) DEFAULT NULL,
  `camera_type` ENUM('Browser / WebCam', 'RTSP / IP Camera', 'Traffic Camera') DEFAULT 'Browser / WebCam',
  `stream_source` VARCHAR(255) DEFAULT NULL,
  `active` BOOLEAN NOT NULL DEFAULT TRUE,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_cameras_code` (`camera_code`),
  INDEX `idx_cameras_active` (`active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- 2. Table: detections
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS `detections` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `camera_id` VARCHAR(64) DEFAULT 'CAM-001',
  `animal_detected` BOOLEAN NOT NULL DEFAULT FALSE,
  `animal_type` VARCHAR(64) DEFAULT NULL,
  `breed` VARCHAR(64) DEFAULT NULL,
  `injured` BOOLEAN NOT NULL DEFAULT FALSE,
  `injury_type` VARCHAR(128) DEFAULT NULL,
  `severity` ENUM('None', 'Minor', 'Moderate', 'Severe') DEFAULT 'None',
  `confidence` DECIMAL(4,2) DEFAULT 0.00,
  `description` TEXT DEFAULT NULL,
  `visual_evidence` TEXT DEFAULT NULL,
  `recommended_action` TEXT DEFAULT NULL,
  `image_path` VARCHAR(255) DEFAULT NULL,
  `location` VARCHAR(255) DEFAULT 'Live Camera Feed',
  `latitude` DECIMAL(10,7) DEFAULT NULL,
  `longitude` DECIMAL(10,7) DEFAULT NULL,
  `detected_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `processed_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `processing_status` VARCHAR(64) DEFAULT 'processed',
  `report_generated` BOOLEAN NOT NULL DEFAULT FALSE,
  `report_id` VARCHAR(64) DEFAULT NULL,
  `raw_response` JSON DEFAULT NULL,
  INDEX `idx_detections_camera` (`camera_id`),
  INDEX `idx_detections_detected_at` (`detected_at`),
  INDEX `idx_detections_status` (`animal_detected`, `injured`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- 3. Table: reports
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS `reports` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `report_code` VARCHAR(64) NOT NULL UNIQUE,
  `report_source` ENUM('MANUAL', 'AUTOMATIC') NOT NULL DEFAULT 'MANUAL',
  `camera_id` VARCHAR(64) DEFAULT NULL,
  `animal_type` VARCHAR(64) NOT NULL,
  `breed` VARCHAR(64) DEFAULT 'Unknown',
  `injured` BOOLEAN NOT NULL DEFAULT TRUE,
  `injury_type` VARCHAR(128) DEFAULT 'Unspecified injury',
  `severity` ENUM('Minor', 'Moderate', 'Severe') NOT NULL DEFAULT 'Moderate',
  `confidence` DECIMAL(4,2) DEFAULT 1.00,
  `description` TEXT DEFAULT NULL,
  `recommended_action` TEXT DEFAULT NULL,
  `image_path` VARCHAR(255) DEFAULT NULL,
  `location_name` VARCHAR(255) DEFAULT 'Public Area',
  `latitude` DECIMAL(10,7) DEFAULT NULL,
  `longitude` DECIMAL(10,7) DEFAULT NULL,
  `report_date` DATE NOT NULL,
  `report_time` TIME NOT NULL,
  `report_status` VARCHAR(64) NOT NULL DEFAULT 'Forwarded to Rescue Team',
  `reporter_name` VARCHAR(128) DEFAULT NULL,
  `reporter_contact` VARCHAR(64) DEFAULT NULL,
  `reporter_email` VARCHAR(128) DEFAULT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_reports_code` (`report_code`),
  INDEX `idx_reports_source` (`report_source`),
  INDEX `idx_reports_status` (`report_status`),
  INDEX `idx_reports_date` (`report_date`, `report_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- 4. Table: rescue_contacts
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS `rescue_contacts` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `email` VARCHAR(128) NOT NULL,
  `whatsapp` VARCHAR(32) NOT NULL,
  `organization_name` VARCHAR(128) DEFAULT 'Emergency Rescue Coordinator',
  `contact_person` VARCHAR(128) DEFAULT 'Rescue Coordinator',
  `phone` VARCHAR(32) DEFAULT '+918805997679',
  `location` VARCHAR(255) DEFAULT 'Regional Rescue Zone',
  `active` BOOLEAN NOT NULL DEFAULT TRUE,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- 5. Table: report_delivery_logs
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS `report_delivery_logs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `report_id` VARCHAR(64) NOT NULL,
  `delivery_type` ENUM('EMAIL', 'WHATSAPP') NOT NULL,
  `recipient` VARCHAR(128) NOT NULL,
  `status` ENUM('SUCCESS', 'FAILED', 'PENDING') NOT NULL DEFAULT 'PENDING',
  `error_message` TEXT DEFAULT NULL,
  `sent_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_delivery_report` (`report_id`),
  INDEX `idx_delivery_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- SEED DATA
-- ----------------------------------------------------------

-- Default Cameras
INSERT INTO `cameras` (`camera_code`, `camera_name`, `location_name`, `latitude`, `longitude`, `camera_type`, `active`)
VALUES 
  ('CAM-001', 'Sangamner Main Road Camera', 'Sangamner Main Road Junction', 19.5761, 74.2070, 'Browser / WebCam', TRUE),
  ('CAM-002', 'Market Yard Security Cam', 'Market Yard West Entrance', 19.5780, 74.2095, 'RTSP / IP Camera', TRUE)
ON DUPLICATE KEY UPDATE `camera_name` = VALUES(`camera_name`);

-- Rescue Organization Contacts
-- Dedicated contacts table containing: id, email, whatsapp
INSERT INTO `rescue_contacts` (`email`, `whatsapp`, `active`)
VALUES
  ('dahiphalekrishna244@gmail.com', '8805997679', TRUE);

-- Baseline Demonstration Reports matching Master Spec Format
INSERT INTO `reports` (`report_code`, `report_source`, `camera_id`, `animal_type`, `breed`, `injured`, `injury_type`, `severity`, `confidence`, `description`, `recommended_action`, `image_path`, `location_name`, `latitude`, `longitude`, `report_date`, `report_time`, `report_status`, `reporter_name`)
VALUES
  ('IA-2026-00001', 'AUTOMATIC', 'CAM-001', 'Dog', 'Indian Pariah (Indie)', TRUE, 'Front leg limp / visible abrasion', 'Moderate', 0.92, 'AI detected possible injury: indie dog showing visible limping on right forelimb.', 'Dispatch rescue van for wound dressing and limb stabilization.', 'assets/hero-dog.jpg', 'Sangamner Main Road Junction', 19.5761, 74.2070, CURDATE(), '10:15:00', 'Forwarded to Rescue Team', 'AI Live Camera'),
  ('IA-2026-00002', 'MANUAL', NULL, 'Cat', 'Domestic Short Hair', TRUE, 'Ear laceration & superficial cuts', 'Minor', 1.00, 'Found near community garden, alert and mobile but bleeding from ear tip.', 'Local volunteer dispatched with antiseptic spray and gauze.', NULL, 'Shivaji Nagar Community Park', 19.5745, 74.2040, CURDATE(), '11:30:00', 'Forwarded to Rescue Team', 'Citizen Reporter')
ON DUPLICATE KEY UPDATE `report_code` = VALUES(`report_code`);
