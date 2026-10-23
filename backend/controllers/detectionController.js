const detectionService = require("../services/detectionService");
const reportService = require("../services/reportService");
const { pool } = require("../config/db");

// Active camera detection sessions state
const activeSessions = new Map();

/**
 * POST /api/detection/analyze
 * Receives an image frame and metadata, processes AI detection,
 * logs detection, checks duplicate cooldown, and creates a report if injured.
 */
async function analyzeFrame(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No image frame was uploaded. Please send an image in the 'image' field."
      });
    }

    const metadata = {
      cameraId: req.body.camera_id || "cam-01",
      location: req.body.location || "Live Camera Feed",
      latitude: req.body.latitude || null,
      longitude: req.body.longitude || null,
      timestamp: req.body.timestamp || new Date().toISOString(),
      isTest: req.body.is_test === "true" || req.body.is_test === true
    };

    const result = await detectionService.processFrame({
      file: req.file,
      metadata
    });

    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/detection/status
 * Returns system health, active sessions, and detection statistics
 */
async function getStatus(req, res, next) {
  try {
    let dbConnected = false;
    try {
      const [rows] = await pool.query("SELECT 1 AS alive");
      dbConnected = rows && rows[0]?.alive === 1;
    } catch (e) {
      dbConnected = false;
    }

    const stats = await reportService.getStatistics();
    const provider = process.env.AI_PROVIDER || "gemini";
    const hasApiKey = Boolean(process.env.AI_API_KEY);

    return res.status(200).json({
      success: true,
      system_status: "Operational",
      database_connected: dbConnected,
      ai_configuration: {
        provider: provider,
        has_api_key: hasApiKey,
        mode: (provider === "mock" || (!hasApiKey && provider === "gemini")) ? "Mock / Demo Mode" : "Live API Mode",
        model: process.env.AI_MODEL || "gemini-1.5-flash"
      },
      duplicate_prevention: {
        cooldown_seconds: parseInt(process.env.DUPLICATE_COOLDOWN_SECONDS, 10) || 60
      },
      active_cameras_monitoring: Array.from(activeSessions.keys()),
      statistics: stats,
      server_time: new Date()
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/detection/start
 * Mark a detection session as started
 */
function startDetection(req, res) {
  const cameraId = req.body.camera_id || "cam-01";
  activeSessions.set(cameraId, {
    startTime: new Date(),
    location: req.body.location || "Stationary AI Monitor #1"
  });

  console.log(`[DetectionController] Camera detection started: ${cameraId}`);

  return res.status(200).json({
    success: true,
    message: `Detection session started for camera: ${cameraId}`,
    camera_id: cameraId,
    started_at: new Date()
  });
}

/**
 * POST /api/detection/stop
 * Mark a detection session as stopped
 */
function stopDetection(req, res) {
  const cameraId = req.body.camera_id || "cam-01";
  activeSessions.delete(cameraId);

  console.log(`[DetectionController] Camera detection stopped: ${cameraId}`);

  return res.status(200).json({
    success: true,
    message: `Detection session stopped for camera: ${cameraId}`,
    camera_id: cameraId,
    stopped_at: new Date()
  });
}

module.exports = {
  analyzeFrame,
  getStatus,
  startDetection,
  stopDetection
};
