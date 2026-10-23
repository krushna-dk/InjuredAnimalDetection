const reportService = require("../services/reportService");
const manualReportService = require("../services/manualReportService");
const path = require("path");

/**
 * POST /api/reports
 * Create a new animal injury report (Manual Citizen submission or Automatic Detection)
 */
async function createReport(req, res, next) {
  try {
    let imagePath = null;
    if (req.file) {
      try {
        const fs = require("fs");
        const fileBuffer = fs.readFileSync(req.file.path);
        const mimeType = req.file.mimetype || "image/jpeg";
        imagePath = `data:${mimeType};base64,${fileBuffer.toString("base64")}`;
      } catch (err) {
        imagePath = `/uploads/${path.basename(req.file.path)}`;
      }
    } else if (req.body.image_url) {
      imagePath = req.body.image_url;
    }

    const {
      animal_type,
      breed,
      injured,
      injury_type,
      severity,
      confidence,
      description,
      recommended_action,
      location,
      latitude,
      longitude,
      report_date,
      report_time,
      reporter_name,
      reporter_contact,
      reporter_email,
      camera_id,
      report_source
    } = req.body;

    // Validation
    if (!animal_type || animal_type.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Animal species/type is required."
      });
    }

    const validSeverities = ["Minor", "Moderate", "Severe"];
    const normalizedSeverity = validSeverities.includes(severity) ? severity : "Moderate";

    const isAutomatic = camera_id && camera_id !== "manual-entry" && camera_id !== "citizen-report";
    const source = report_source ? report_source.toUpperCase() : (isAutomatic ? "AUTOMATIC" : "MANUAL");

    const reportData = {
      reportSource: source,
      cameraId: isAutomatic ? camera_id : null,
      animalType: animal_type.trim(),
      breed: breed && breed.trim() ? breed.trim() : "Unknown",
      injured: injured !== undefined ? (injured === "true" || injured === true) : true,
      injuryType: injury_type && injury_type.trim() ? injury_type.trim() : "Visible injury",
      severity: normalizedSeverity,
      confidence: confidence ? parseFloat(confidence) : 1.0,
      description: description && description.trim() ? description.trim() : "Injured animal reported by citizen.",
      recommendedAction: recommended_action && recommended_action.trim() ? recommended_action.trim() : "Dispatch rescue volunteer.",
      imagePath,
      location: location && location.trim() ? location.trim() : "Citizen Reported Location",
      latitude: latitude || null,
      longitude: longitude || null,
      reportDate: report_date || null,
      reportTime: report_time || null,
      reporterName: reporter_name && reporter_name.trim() ? reporter_name.trim() : "Citizen Reporter",
      reporterContact: reporter_contact && reporter_contact.trim() ? reporter_contact.trim() : null,
      reporterEmail: reporter_email && reporter_email.trim() ? reporter_email.trim() : null,
      reportStatus: "Forwarded to Rescue Team"
    };

    const newReport = source === "MANUAL"
      ? await manualReportService.createManualReport(reportData)
      : await reportService.createReport(reportData);

    // Response strictly follows Master Prompt Section 6:
    // "Report submitted successfully."
    // "Report ID: IA-2026-00001"
    // "Your report has been forwarded to the rescue team."
    return res.status(201).json({
      success: true,
      message: "Report submitted successfully.",
      report_code: newReport.report_code,
      delivery_status: "Your report has been forwarded to the rescue team.",
      report: newReport
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/reports
 * Fetch reports with optional pagination and filters (source, animal_type, status)
 */
async function getAllReports(req, res, next) {
  try {
    const { limit = 50, offset = 0, source, animal_type, status } = req.query;

    const result = await reportService.getReports({
      limit,
      offset,
      source,
      animal_type,
      status
    });

    return res.status(200).json({
      success: true,
      data: result.reports,
      pagination: {
        total: result.total,
        limit: result.limit,
        offset: result.offset
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/reports/statistics
 * Aggregate platform metrics strictly adhering to Section 21
 */
async function getStatistics(req, res, next) {
  try {
    const stats = await reportService.getStatistics();
    return res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/reports/:id
 * Retrieve a single report by ID or report_code with nearby rescue contacts
 */
async function getReportById(req, res, next) {
  try {
    const { id } = req.params;
    const report = await reportService.getReportById(id);

    if (!report) {
      return res.status(404).json({
        success: false,
        message: `Report not found with ID: ${id}`
      });
    }

    return res.status(200).json({
      success: true,
      report
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createReport,
  getAllReports,
  getStatistics,
  getReportById
};
