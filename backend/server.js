const dns = require("dns");
try { dns.setDefaultResultOrder("ipv4first"); } catch (_) {}

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, ".env") });

const { testConnection } = require("./config/db");
const detectionRoutes = require("./routes/detectionRoutes");
const reportRoutes = require("./routes/reportRoutes");
const { notFoundHandler, errorHandler } = require("./middleware/errorMiddleware");

const app = express();
const PORT = process.env.PORT || 5000;

// Security & CORS Middleware
app.use(
  helmet({
    crossOriginResourcePolicy: false // Allow frontend to display uploaded frame images
  })
);
app.use(cors());

// Body Parsers
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

// Static uploads folder for serving captured frame evidence
app.use("/uploads", express.static(path.join(__dirname, process.env.UPLOAD_DIR || "uploads")));

// Serve frontend static files (with fresh cache headers during updates)
app.use(express.static(path.join(__dirname, ".."), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith(".html") || filePath.endsWith(".css") || filePath.endsWith(".js")) {
      res.setHeader("Cache-Control", "no-cache, must-revalidate");
    }
  }
}));

// Dedicated API Health Check Route
app.get("/api/health", (req, res) => {
  res.json({
    project: "Injured Animal Detection and Rehabilitation Using AI",
    status: "API Server Running",
    endpoints: {
      analyze_frame: "POST /api/detection/analyze",
      detection_status: "GET /api/detection/status",
      start_detection: "POST /api/detection/start",
      stop_detection: "POST /api/detection/stop",
      list_reports: "GET /api/reports",
      create_report: "POST /api/reports",
      get_report: "GET /api/reports/:id"
    },
    version: "1.0.0"
  });
});

// Mount Routes
app.use("/api/detection", detectionRoutes);
app.use("/api/reports", reportRoutes);

// -----------------------------------------------------------------------
// GET /api/test-email — Diagnostic endpoint to verify email delivery
// Usage: https://injuredanimaldetection.onrender.com/api/test-email
// -----------------------------------------------------------------------
app.get("/api/test-email", async (req, res) => {
  try {
    const { sendReportEmail } = require("./services/emailService");
    const testReport = {
      report_code: "TEST-" + Date.now(),
      report_source: "MANUAL",
      animal_type: "Dog",
      breed: "Unknown",
      injury_type: "Test",
      severity: "Minor",
      confidence: 1.0,
      description: "This is a test email from the Injured Animal Detection Platform.",
      recommended_action: "No action needed – this is a diagnostic test.",
      location: "Test Location",
      report_date: new Date().toISOString().split("T")[0],
      report_time: new Date().toTimeString().slice(0, 8),
      reporter_name: "System Test",
      reporter_email: process.env.SMTP_USER || "dahiphalekrishna244@gmail.com",
      reporter_contact: null,
      image_path: null,
      report_status: "Test"
    };

    const providers = {
      resend: Boolean(process.env.RESEND_API_KEY),
      brevo: Boolean(process.env.BREVO_API_KEY),
      smtp: Boolean(process.env.SMTP_USER && process.env.SMTP_PASS)
    };

    console.log(`[TestEmail] Starting test email with providers:`, providers);
    const results = await sendReportEmail(testReport);
    console.log(`[TestEmail] Results:`, JSON.stringify(results));

    const success = results.some(r => r.status === "SUCCESS");
    res.json({
      success,
      message: success ? "Test email sent successfully!" : "Test email failed. Check server logs for details.",
      providers_available: providers,
      results
    });
  } catch (err) {
    console.error("[TestEmail] Error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Error Handling Middleware
app.use(notFoundHandler);
app.use(errorHandler);

// Global Process Safety Handlers
process.on("unhandledRejection", (reason, promise) => {
  console.error("[Server Warning] Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("[Server Error] Uncaught Exception:", err);
});

// Start Server
app.listen(PORT, async () => {
  console.log("==========================================================");
  console.log(`[Server] Backend API running at http://localhost:${PORT}`);
  console.log(`[AI Mode] Provider: ${process.env.AI_PROVIDER || "gemini"} (Key present: ${Boolean(process.env.AI_API_KEY)})`);
  console.log("==========================================================");
  await testConnection();
});
