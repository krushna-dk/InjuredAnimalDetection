const express = require("express");
const router = express.Router();
const detectionController = require("../controllers/detectionController");
const upload = require("../middleware/uploadMiddleware");

// POST /api/detection/analyze - Upload and analyze camera frame
router.post("/analyze", upload.single("image"), detectionController.analyzeFrame);

// GET /api/detection/status - System and active detection status
router.get("/status", detectionController.getStatus);

// POST /api/detection/start - Register detection start
router.post("/start", detectionController.startDetection);

// POST /api/detection/stop - Register detection stop
router.post("/stop", detectionController.stopDetection);

module.exports = router;
