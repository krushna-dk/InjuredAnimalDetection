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

// Serve frontend static files (defaults to index.html on root)
app.use(express.static(path.join(__dirname, "..")));

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
