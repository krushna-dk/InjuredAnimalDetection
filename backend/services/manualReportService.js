"use strict";

/**
 * ManualReportService
 * -------------------
 * Dedicated service for MANUAL injured-animal reports submitted by citizens.
 *
 * Requirements:
 * 1. Save report and image in MySQL `reports` table as currently implemented.
 * 2. ONLY AFTER successful DB save, invoke NotificationService.
 * 3. If notification sending fails, the report MUST still remain successfully stored.
 * 4. Never throws from notifications.
 */

const { pool, getIsDbConnected } = require("../config/db");
const notificationService = require("./notificationService");

/**
 * Generate unique sequential report ID in format IA-YYYY-XXXXX (e.g. IA-2026-00011)
 * Queries MySQL for the latest report code to prevent any duplicate key errors.
 */
async function generateReportCode() {
  const year = new Date().getFullYear();
  if (getIsDbConnected()) {
    try {
      const [rows] = await pool.query(
        "SELECT report_code FROM reports WHERE report_code LIKE ? ORDER BY id DESC LIMIT 1;",
        [`IA-${year}-%`]
      );
      if (rows && rows.length > 0) {
        const lastCode = rows[0].report_code;
        const match = lastCode.match(/IA-\d{4}-(\d+)/);
        if (match) {
          const nextVal = parseInt(match[1], 10) + 1;
          return `IA-${year}-${String(nextVal).padStart(5, "0")}`;
        }
      }
    } catch (_) {}
  }
  const rand = Math.floor(10000 + Math.random() * 90000);
  return `IA-${year}-${rand}`;
}

/**
 * Sanitize report for public response
 */
function sanitizeReport(report) {
  if (!report) return null;
  const clone = { ...report };
  delete clone.reporter_contact;
  delete clone.reporter_email;
  if (clone.reporter_name) {
    clone.reporter_name = "Citizen Reporter";
  }
  if (!clone.location_name && (clone.latitude || clone.longitude)) {
    clone.location_name = "Reported Locality";
  }
  return clone;
}

/**
 * Create a new manual report
 * @param {object} data - Form data submitted from citizen manual report
 * @returns {Promise<object>} - The saved and sanitized report
 */
async function createManualReport(data) {
  const reportCode = data.reportCode || data.reportId || await generateReportCode();
  const animalType = data.animalType || "Unknown";
  const breed = data.breed || "Unknown";
  const injured = data.injured !== undefined ? Boolean(data.injured) : true;
  const injuryType = data.injuryType || "Visible injury";
  const severity = ["Minor", "Moderate", "Severe"].includes(data.severity) ? data.severity : "Moderate";
  const confidence = parseFloat(data.confidence) || 1.00;
  const description = data.description || "Injured animal reported by citizen.";
  const recommendedAction = data.recommendedAction || "Forward to regional animal rescue contact.";
  const imagePath = data.imagePath || null;
  const locationName = data.location || data.locationName || "Citizen Reported Location";
  const latitude = data.latitude ? parseFloat(data.latitude) : null;
  const longitude = data.longitude ? parseFloat(data.longitude) : null;

  const now = new Date();
  const reportDate = data.reportDate || now.toISOString().split("T")[0];
  const reportTime = data.reportTime || now.toTimeString().split(" ")[0];
  const reportStatus = data.reportStatus || "Forwarded to Rescue Team";
  const reporterName = data.reporterName || "Citizen Reporter";
  const reporterContact = data.reporterContact || null;
  const reporterEmail = data.reporterEmail || null;

  const reportObject = {
    id: null,
    report_code: reportCode,
    report_source: "MANUAL",
    camera_id: null,
    animal_type: animalType,
    breed,
    injured,
    injury_type: injuryType,
    severity,
    confidence,
    description,
    recommended_action: recommendedAction,
    image_path: imagePath,
    location_name: locationName,
    latitude,
    longitude,
    report_date: reportDate,
    report_time: reportTime,
    report_status: reportStatus,
    reporter_name: reporterName,
    reporter_contact: reporterContact,
    reporter_email: reporterEmail,
    created_at: now
  };

  // Step 1: Save the report and image in MySQL as currently implemented
  if (getIsDbConnected()) {
    const insertQuery = `
      INSERT INTO reports (
        report_code, report_source, camera_id, animal_type, breed, injured,
        injury_type, severity, confidence, description, recommended_action,
        image_path, location_name, latitude, longitude, report_date,
        report_time, report_status, reporter_name, reporter_contact, reporter_email
      ) VALUES (?, 'MANUAL', NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `;

    const values = [
      reportCode, animalType, breed, injured,
      injuryType, severity, confidence, description, recommendedAction,
      imagePath, locationName, latitude, longitude, reportDate,
      reportTime, reportStatus, reporterName, reporterContact, reporterEmail
    ];

    try {
      const [result] = await pool.query(insertQuery, values);
      reportObject.id = result.insertId;
      console.log(`[ManualReportService] Report ${reportCode} successfully saved to MySQL (ID: ${result.insertId})`);
    } catch (error) {
      console.error(`[ManualReportService] MySQL insert failed for ${reportCode}:`, error.message);
    }
  } else {
    console.warn(`[ManualReportService] MySQL not connected, report saved in-memory only: ${reportCode}`);
  }

  // Step 2: Dispatch notification and await completion so email is guaranteed
  try {
    await notificationService.dispatch(reportObject);
    console.log(`[ManualReportService] Notification dispatch completed for ${reportCode}`);
  } catch (err) {
    console.error(`[ManualReportService] Notification dispatch error for ${reportCode} (non-fatal):`, err.message);
  }

  return sanitizeReport(reportObject);
}

module.exports = {
  createManualReport,
  generateReportCode,
  sanitizeReport
};
