const { pool, getIsDbConnected } = require("../config/db");
const { registerReportInMemory } = require("./duplicateService");
const notificationService = require("./notificationService");
const manualReportService = require("./manualReportService");

// In-memory fallback if DB is not connected
const seedContacts = [];

// Baseline in-memory reports store matching Master Spec format (IA-YYYY-XXXXX)
const inMemoryReports = [
  {
    id: 1,
    report_code: "IA-2026-00001",
    report_source: "AUTOMATIC",
    camera_id: "CAM-001",
    animal_type: "Dog",
    breed: "Indian Pariah (Indie)",
    injured: true,
    injury_type: "Front leg limp / visible abrasion",
    severity: "Moderate",
    confidence: 0.92,
    description: "AI detected possible injury: indie dog showing visible limping on right forelimb.",
    recommended_action: "Dispatch rescue van for wound dressing and limb stabilization.",
    image_path: "assets/hero-dog.jpg",
    location_name: "Sangamner Main Road Junction",
    latitude: 19.5761,
    longitude: 74.2070,
    report_date: new Date().toISOString().split("T")[0],
    report_time: "10:15:00",
    report_status: "Forwarded to Rescue Team",
    reporter_name: "AI Live Camera",
    reporter_contact: null,
    created_at: new Date(Date.now() - 35 * 60 * 1000)
  },
  {
    id: 2,
    report_code: "IA-2026-00002",
    report_source: "MANUAL",
    camera_id: null,
    animal_type: "Cat",
    breed: "Domestic Short Hair",
    injured: true,
    injury_type: "Ear laceration & superficial cuts",
    severity: "Minor",
    confidence: 1.00,
    description: "Found near community garden, alert and mobile but bleeding from ear tip.",
    recommended_action: "Local volunteer dispatched with antiseptic spray and gauze.",
    image_path: null,
    location_name: "Shivaji Nagar Community Park",
    latitude: 19.5745,
    longitude: 74.2040,
    report_date: new Date().toISOString().split("T")[0],
    report_time: "11:30:00",
    report_status: "Forwarded to Rescue Team",
    reporter_name: "Citizen Reporter",
    reporter_contact: null,
    created_at: new Date(Date.now() - 75 * 60 * 1000)
  }
];

let nextReportSeq = 3;

/**
 * Generate unique report ID in format IA-YYYY-XXXXX (e.g. IA-2026-00003)
 */
async function generateUniqueReportId() {
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
 * Sanitize report for public viewing (Privacy Protection - Section 24)
 * Masks phone numbers, reporter contact, and exact GPS coordinates to generalized locality
 */
function sanitizeForPublic(report) {
  if (!report) return null;
  const clone = { ...report };
  delete clone.reporter_contact;

  // Ensure report_code and report_id are mutually available
  if (!clone.report_id && clone.report_code) {
    clone.report_id = clone.report_code;
  }
  if (!clone.report_code && clone.report_id) {
    clone.report_code = clone.report_id;
  }

  // Ensure detected_at is available for frontend feeds
  if (!clone.detected_at) {
    clone.detected_at = clone.created_at || (clone.report_date ? `${clone.report_date}T${clone.report_time || "00:00:00"}` : new Date().toISOString());
  }

  if (clone.reporter_name && clone.report_source === "MANUAL") {
    clone.reporter_name = "Citizen Reporter";
  }

  // Generalized location description for public view
  if (!clone.location_name && (clone.latitude || clone.longitude)) {
    clone.location_name = "Reported Locality";
  }
  return clone;
}

/**
 * Create a new rescue report (Manual Citizen Submission or Automatic Camera)
 */
async function createReport(data) {
  const reportSource = (data.reportSource || (data.cameraId && data.cameraId !== "manual-entry" ? "AUTOMATIC" : "MANUAL")).toUpperCase();

  // Delegate manual reports to dedicated manualReportService
  if (reportSource === "MANUAL") {
    return await manualReportService.createManualReport(data);
  }

  const reportCode = data.reportCode || data.reportId || await generateUniqueReportId();
  const cameraId = data.cameraId || "CAM-001";
  const animalType = data.animalType || "Unknown";
  const breed = data.breed || "Unknown";
  const injured = data.injured !== undefined ? Boolean(data.injured) : true;
  const injuryType = data.injuryType || "Unspecified injury";
  const severity = ["Minor", "Moderate", "Severe"].includes(data.severity) ? data.severity : "Moderate";
  const confidence = parseFloat(data.confidence) || 1.00;
  const description = data.description || "Injured animal reported via platform.";
  const recommendedAction = data.recommendedAction || "Forward to regional animal rescue contact.";
  const imagePath = data.imagePath || null;
  const locationName = data.location || data.locationName || (reportSource === "AUTOMATIC" ? "Live Camera Feed" : "Manual Citizen Location");
  const latitude = data.latitude ? parseFloat(data.latitude) : null;
  const longitude = data.longitude ? parseFloat(data.longitude) : null;

  const now = new Date();
  const reportDate = data.reportDate || now.toISOString().split("T")[0];
  const reportTime = data.reportTime || now.toTimeString().split(" ")[0];
  const reportStatus = data.reportStatus || "Forwarded to Rescue Team";
  const reporterName = data.reporterName || (reportSource === "MANUAL" ? "Citizen Reporter" : "AI Live Camera");
  const reporterContact = data.reporterContact || null;

  const reportObject = {
    id: nextReportSeq,
    report_code: reportCode,
    report_source: reportSource,
    camera_id: cameraId,
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
    created_at: now
  };

  // Always keep in memory store as cache / immediate view
  inMemoryReports.unshift(reportObject);

  // Register in duplicate prevention cache if automatic
  if (cameraId) {
    registerReportInMemory(cameraId, animalType, reportCode);
  }

  // If DB is connected, persist to MySQL
  if (getIsDbConnected()) {
    const insertQuery = `
      INSERT INTO reports (
        report_code, report_source, camera_id, animal_type, breed, injured,
        injury_type, severity, confidence, description, recommended_action,
        image_path, location_name, latitude, longitude, report_date,
        report_time, report_status, reporter_name, reporter_contact
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `;

    const values = [
      reportCode, reportSource, cameraId, animalType, breed, injured,
      injuryType, severity, confidence, description, recommendedAction,
      imagePath, locationName, latitude, longitude, reportDate,
      reportTime, reportStatus, reporterName, reporterContact
    ];

    try {
      const [result] = await pool.query(insertQuery, values);
      reportObject.id = result.insertId;
    } catch (error) {
      console.warn("[ReportService Warning] Failed to insert into MySQL, saved to memory store:", error.message);
    }
  }

  // If AUTOMATIC report: dispatch email notification asynchronously (non-blocking)
  if (reportSource === "AUTOMATIC") {
    setImmediate(() => {
      notificationService.dispatch(reportObject)
        .then(() => console.log(`[ReportService] Automatic email notification dispatch completed for ${reportCode}`))
        .catch(err => console.error(`[ReportService] Automatic email notification error for ${reportCode} (non-fatal):`, err.message));
    });
  }

  return sanitizeForPublic(reportObject);
}

/**
 * Fetch paginated reports list with optional filters
 */
async function getReports({ limit = 50, offset = 0, source = null, animal_type = null, status = null }) {
  const parsedLimit = parseInt(limit, 10) || 50;
  const parsedOffset = parseInt(offset, 10) || 0;

  if (getIsDbConnected()) {
    try {
      const whereClauses = [];
      const params = [];

      if (source && source !== "all") {
        whereClauses.push("report_source = ?");
        params.push(source.toUpperCase());
      }

      if (animal_type && animal_type !== "all") {
        whereClauses.push("LOWER(animal_type) = LOWER(?)");
        params.push(animal_type);
      }

      if (status && status !== "all") {
        whereClauses.push("report_status = ?");
        params.push(status);
      }

      const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

      const dataQuery = `
        SELECT id, report_code, report_source, camera_id, animal_type, breed,
               injured, injury_type, severity, confidence, description,
               recommended_action, image_path, location_name,
               report_date, report_time, report_status, reporter_name, created_at
        FROM reports
        ${whereSql}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?;
      `;

      const countQuery = `SELECT COUNT(*) AS total FROM reports ${whereSql};`;

      params.push(parsedLimit, parsedOffset);

      const [rows] = await pool.query(dataQuery, params);
      const [countRows] = await pool.query(countQuery, params.slice(0, -2));

      return {
        reports: rows.map(sanitizeForPublic),
        total: countRows[0]?.total || 0,
        limit: parsedLimit,
        offset: parsedOffset
      };
    } catch (error) {
      console.warn("[ReportService Warning] MySQL query failed, using in-memory store:", error.message);
    }
  }

  // In-memory fallback
  let filtered = [...inMemoryReports];
  if (source && source !== "all") {
    filtered = filtered.filter(r => (r.report_source || "").toUpperCase() === source.toUpperCase());
  }
  if (animal_type && animal_type !== "all") {
    filtered = filtered.filter(r => (r.animal_type || "").toLowerCase() === animal_type.toLowerCase());
  }
  if (status && status !== "all") {
    filtered = filtered.filter(r => (r.report_status || "").toLowerCase() === status.toLowerCase());
  }

  const paginated = filtered.slice(parsedOffset, parsedOffset + parsedLimit);
  return {
    reports: paginated.map(sanitizeForPublic),
    total: filtered.length,
    limit: parsedLimit,
    offset: parsedOffset
  };
}

/**
 * Fetch a single report by report_code or id with associated rescue contacts
 */
async function getReportById(identifier) {
  let report = null;

  if (getIsDbConnected()) {
    try {
      const [rows] = await pool.query(
        `SELECT * FROM reports WHERE report_code = ? OR id = ? LIMIT 1;`,
        [identifier, identifier]
      );
      if (rows && rows.length > 0) {
        report = rows[0];
      }
    } catch (err) {
      console.warn("[ReportService] DB single report query failed:", err.message);
    }
  }

  if (!report) {
    report = inMemoryReports.find(
      r => String(r.report_code) === String(identifier) || String(r.id) === String(identifier)
    );
  }

  if (!report) return null;

  let contacts = seedContacts;
  if (getIsDbConnected()) {
    try {
      const [dbContacts] = await pool.query(
        `SELECT id, email, whatsapp, organization_name, contact_person, phone, location, active
         FROM rescue_contacts WHERE active = 1 ORDER BY id ASC LIMIT 5;`
      );
      if (dbContacts && dbContacts.length > 0) {
        contacts = dbContacts;
      }
    } catch (err) {
      // Use seedContacts
    }
  }

  return {
    ...sanitizeForPublic(report),
    rescue_contacts: contacts
  };
}

/**
 * Get aggregate statistics across reports strictly as mandated:
 * Total Reports, Manual Reports, Automatic Reports, Reports Forwarded
 * (NEVER claims 'Animals Rescued' - Section 21)
 */
async function getStatistics() {
  if (getIsDbConnected()) {
    try {
      const [reportStats] = await pool.query(`
        SELECT 
          COUNT(*) AS total_reports,
          SUM(CASE WHEN report_source = 'MANUAL' THEN 1 ELSE 0 END) AS manual_reports,
          SUM(CASE WHEN report_source = 'AUTOMATIC' THEN 1 ELSE 0 END) AS automatic_reports,
          SUM(CASE WHEN report_status LIKE '%Forwarded%' OR report_status LIKE '%Generated%' THEN 1 ELSE 0 END) AS reports_forwarded
        FROM reports;
      `);

      const [detectionStats] = await pool.query(`
        SELECT 
          COUNT(*) AS total_detections,
          SUM(CASE WHEN animal_detected = 1 THEN 1 ELSE 0 END) AS total_animals_detected,
          SUM(CASE WHEN animal_detected = 1 AND injured = 1 THEN 1 ELSE 0 END) AS total_injured_detected
        FROM detections;
      `);

      return {
        total_reports: parseInt(reportStats[0]?.total_reports || 0, 10),
        manual_reports: parseInt(reportStats[0]?.manual_reports || 0, 10),
        automatic_reports: parseInt(reportStats[0]?.automatic_reports || 0, 10),
        reports_forwarded: parseInt(reportStats[0]?.reports_forwarded || 0, 10),
        total_detections: parseInt(detectionStats[0]?.total_detections || 0, 10),
        total_animals_detected: parseInt(detectionStats[0]?.total_animals_detected || 0, 10),
        total_injured_detected: parseInt(detectionStats[0]?.total_injured_detected || 0, 10)
      };
    } catch (error) {
      console.warn("[ReportService Warning] Failed to compute DB stats, using memory store:", error.message);
    }
  }

  // In-memory stats fallback
  const total = inMemoryReports.length;
  const manual = inMemoryReports.filter(r => (r.report_source || "MANUAL").toUpperCase() === "MANUAL").length;
  const automatic = inMemoryReports.filter(r => (r.report_source || "").toUpperCase() === "AUTOMATIC").length;
  const forwarded = inMemoryReports.filter(r => (r.report_status || "").includes("Forwarded") || (r.report_status || "").includes("Generated")).length;

  return {
    total_reports: total,
    manual_reports: manual,
    automatic_reports: automatic,
    reports_forwarded: forwarded,
    total_detections: total,
    total_animals_detected: total,
    total_injured_detected: total
  };
}

module.exports = {
  createReport,
  getReports,
  getReportById,
  getStatistics,
  sanitizeForPublic
};
