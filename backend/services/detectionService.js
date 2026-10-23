const fs = require("fs");
const path = require("path");
const { pool } = require("../config/db");
const aiService = require("./aiService");
const duplicateService = require("./duplicateService");
const reportService = require("./reportService");

/**
 * Coordinate detection workflow for a single captured camera frame
 */
async function processFrame({ file, metadata = {} }) {
  const cameraId = metadata.cameraId || "cam-01";
  const location = metadata.location || "Live Camera Feed";
  const latitude = metadata.latitude || null;
  const longitude = metadata.longitude || null;
  const detectedAt = metadata.timestamp ? new Date(metadata.timestamp) : new Date();

  const relativeImagePath = `/uploads/${path.basename(file.path)}`;

  console.log(`[DetectionService] Analyzing frame: ${file.filename} from camera: ${cameraId}`);

  // 1. Call AI Vision Model
  let aiResult;
  try {
    aiResult = await aiService.analyzeImage(file.path, file.mimetype, {
      isTest: Boolean(metadata.isTest)
    });
  } catch (err) {
    // If AI is temporarily busy (rate-limited on all models), signal frontend to retry
    if (err.code === "AI_BUSY" || err.message === "AI_TEMPORARILY_BUSY") {
      console.warn(`[DetectionService] AI temporarily busy \u2014 signalling frontend to retry.`);
      // Clean up uploaded file
      try { if (fs.existsSync(file.path)) fs.unlinkSync(file.path); } catch (_) {}
      return { success: true, busy: true, retry: true };
    }
    console.warn(`[DetectionService] Vision API notice: ${err.message}. Gracefully continuing camera monitoring.`);
    aiResult = {
      animalDetected: false, animal_detected: false,
      animalType: "None", animal_type: "None",
      breed: "None", injured: false,
      injuryType: "None", injury_type: "None",
      severity: "None", confidence: 0.0,
      description: "AI vision service temporarily busy. Continuing camera feed...",
      recommendedAction: "None", recommended_action: "None"
    };
  }

  console.log(`[DetectionService] AI result: Animal=${aiResult.animal_detected} (${aiResult.animal_type}), Injured=${aiResult.injured} (${aiResult.injury_type}), Confidence=${aiResult.confidence}`);

  let detectionLogId = null;
  let reportResult = null;
  let isDuplicate = false;
  let duplicateReason = null;

  // 2. If animal detected, record detection log in database
  if (aiResult.animal_detected) {
    try {
      const insertDetectionQuery = `
        INSERT INTO detections (
          camera_id, animal_detected, animal_type, breed, injured,
          injury_type, severity, confidence, description, recommended_action,
          image_path, location, latitude, longitude, detected_at,
          processing_status, raw_response
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'processed', ?);
      `;

      const values = [
        cameraId,
        aiResult.animal_detected,
        aiResult.animal_type,
        aiResult.breed,
        aiResult.injured,
        aiResult.injury_type,
        aiResult.severity,
        aiResult.confidence,
        aiResult.description,
        aiResult.recommended_action,
        relativeImagePath,
        location,
        latitude,
        longitude,
        detectedAt,
        JSON.stringify(aiResult)
      ];

      const [detResult] = await pool.query(insertDetectionQuery, values);
      detectionLogId = detResult.insertId;
    } catch (dbErr) {
      console.warn("[DetectionService Warning] Failed to log detection in DB:", dbErr.message);
    }
  } else {
    // No animal detected: clean up file to avoid filling up disk unnecessarily
    try {
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
    } catch (cleanupErr) {
      console.warn("[DetectionService] Cleanup notice:", cleanupErr.message);
    }
  }

  // 3. If injured animal is confirmed: evaluate duplicate prevention & create rescue report
  if (aiResult.animal_detected && aiResult.injured) {
    const dupCheck = await duplicateService.checkIsDuplicate({
      cameraId,
      animalType: aiResult.animal_type,
      injuryType: aiResult.injury_type,
      location
    });

    if (dupCheck.isDuplicate) {
      isDuplicate = true;
      duplicateReason = dupCheck.reason;
      console.log(`[DetectionService] Skipped duplicate report: ${dupCheck.reason}`);
    } else {
      // Create new official rescue report
      reportResult = await reportService.createReport({
        cameraId,
        animalType: aiResult.animal_type,
        breed: aiResult.breed,
        injured: aiResult.injured,
        injuryType: aiResult.injury_type,
        severity: aiResult.severity,
        confidence: aiResult.confidence,
        description: aiResult.description,
        recommendedAction: aiResult.recommended_action,
        imagePath: relativeImagePath,
        location,
        latitude,
        longitude,
        detectedAt,
        reportStatus: "Pending Rescue",
        reporterName: `AI Camera (${cameraId})`
      });

      const generatedCode = reportResult.report_code || reportResult.report_id || "IA-NEW";
      console.log(`[DetectionService] *** NEW RESCUE REPORT GENERATED: ${generatedCode} (${aiResult.animal_type}, ${aiResult.severity}) ***`);
    }
  }

  return {
    success: true,
    detection_id: detectionLogId,
    analysis: aiResult,
    image_url: aiResult.animal_detected ? relativeImagePath : null,
    report_created: Boolean(reportResult),
    report: reportResult,
    is_duplicate: isDuplicate,
    duplicate_reason: duplicateReason,
    timestamp: detectedAt
  };
}

module.exports = {
  processFrame
};
