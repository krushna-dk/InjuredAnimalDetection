const express = require("express");
const router = express.Router();
const reportController = require("../controllers/reportController");
const upload = require("../middleware/uploadMiddleware");

// GET /api/reports/statistics - Platform aggregate metrics
router.get("/statistics", reportController.getStatistics);
router.get("/stats", reportController.getStatistics);

// POST /api/reports - Create new rescue report (manual citizen or automated)
router.post("/", upload.single("image"), reportController.createReport);

// GET /api/reports - Fetch reports with optional filters (source, status, animal_type)
router.get("/", reportController.getAllReports);

// GET /api/reports/:id - Fetch single report by code or ID with rescue contacts
router.get("/:id", reportController.getReportById);

module.exports = router;
