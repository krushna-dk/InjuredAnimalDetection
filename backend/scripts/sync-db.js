"use strict";

const { pool, testConnection } = require("../config/db");

async function syncDb() {
  const connected = await testConnection();
  if (!connected) {
    console.log("[SyncDB] Database not reachable. Skipping live migration.");
    process.exit(0);
  }

  const dbName = process.env.DB_NAME || "injured_animal_detection";

  try {
    const [cols] = await pool.query(
      "SELECT COLUMN_NAME, TABLE_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ?",
      [dbName]
    );

    const hasCol = (table, col) =>
      cols.some((c) => c.TABLE_NAME === table && c.COLUMN_NAME === col);

    if (!hasCol("reports", "reporter_email")) {
      await pool.query(
        "ALTER TABLE reports ADD COLUMN reporter_email VARCHAR(128) DEFAULT NULL AFTER reporter_contact"
      );
      console.log("[SyncDB] Added reporter_email to reports table.");
    } else {
      console.log("[SyncDB] reporter_email already present in reports table.");
    }

    if (!hasCol("detections", "location")) {
      await pool.query(
        "ALTER TABLE detections ADD COLUMN location VARCHAR(255) DEFAULT 'Live Camera Feed' AFTER image_path"
      );
      console.log("[SyncDB] Added location to detections table.");
    }

    if (!hasCol("detections", "latitude")) {
      await pool.query(
        "ALTER TABLE detections ADD COLUMN latitude DECIMAL(10,7) DEFAULT NULL AFTER location"
      );
      console.log("[SyncDB] Added latitude to detections table.");
    }

    if (!hasCol("detections", "longitude")) {
      await pool.query(
        "ALTER TABLE detections ADD COLUMN longitude DECIMAL(10,7) DEFAULT NULL AFTER latitude"
      );
      console.log("[SyncDB] Added longitude to detections table.");
    }

    if (!hasCol("detections", "processing_status")) {
      await pool.query(
        "ALTER TABLE detections ADD COLUMN processing_status VARCHAR(64) DEFAULT 'processed' AFTER processed_at"
      );
      console.log("[SyncDB] Added processing_status to detections table.");
    }

    console.log("[SyncDB] All database columns synchronized successfully!");
  } catch (err) {
    console.error("[SyncDB Error]", err.message);
  } finally {
    process.exit(0);
  }
}

syncDb();
