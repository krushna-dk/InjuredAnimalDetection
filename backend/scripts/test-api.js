/**
 * ==========================================================
 * Backend API Smoke Test Script
 * Project: Injured Animal Detection and Rehabilitation Using AI
 * ==========================================================
 *
 * Usage: node scripts/test-api.js
 *
 * Tests:
 * 1. GET  /                       → Health check
 * 2. GET  /api/detection/status    → System status & stats
 * 3. POST /api/detection/start     → Start detection session
 * 4. POST /api/detection/analyze   → Analyze a frame (uses a 1x1 test JPEG)
 * 5. POST /api/detection/analyze   → Duplicate detection test (rapid re-send)
 * 6. GET  /api/reports             → List reports
 * 7. POST /api/detection/stop      → Stop detection session
 */

const http = require("http");
const path = require("path");

const BASE = process.env.API_URL || "http://localhost:5000";
const CAMERA_ID = "test-cam";

let totalTests = 0;
let passedTests = 0;

function log(label, pass, detail) {
  totalTests++;
  if (pass) passedTests++;
  const icon = pass ? "✅" : "❌";
  console.log(`  ${icon} ${label}${detail ? " — " + detail : ""}`);
}

async function request(method, urlPath, body, headers = {}) {
  const url = new URL(urlPath, BASE);
  const options = {
    method,
    hostname: url.hostname,
    port: url.port,
    path: url.pathname + url.search,
    headers: { ...headers },
  };

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on("error", reject);

    if (body && typeof body === "string") {
      req.write(body);
    } else if (body && Buffer.isBuffer(body)) {
      req.write(body);
    }
    req.end();
  });
}

/**
 * Create a minimal valid JPEG buffer (1x1 red pixel)
 */
function createTestJpeg() {
  // Minimal JPEG: SOI + APP0 + DQT + SOF0 + DHT + SOS + image data + EOI
  // Using a pre-computed 1x1 red JPEG for simplicity
  return Buffer.from(
    "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkS" +
    "Ew8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJ" +
    "CQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIy" +
    "MjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEA" +
    "AAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIh" +
    "MUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6" +
    "Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZ" +
    "mqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx" +
    "8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREA" +
    "AgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAV" +
    "YnLRChYkNOEl8RcYI4Q/RFhHRUYnJCkqNTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNk" +
    "ZWZnaGlqc3R1dnd4eXqCg4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4" +
    "ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+v/aAAwDAQAC" +
    "EQMRAD8A/wD/2Q==",
    "base64"
  );
}

function buildMultipart(fields, fileField, fileBuffer, filename, mimetype) {
  const boundary = "----TestBoundary" + Date.now();
  const parts = [];

  for (const [key, val] of Object.entries(fields)) {
    parts.push(
      `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${val}\r\n`
    );
  }

  parts.push(
    `--${boundary}\r\nContent-Disposition: form-data; name="${fileField}"; filename="${filename}"\r\nContent-Type: ${mimetype}\r\n\r\n`
  );

  const textParts = Buffer.from(parts.join(""));
  const ending = Buffer.from(`\r\n--${boundary}--\r\n`);
  const body = Buffer.concat([textParts, fileBuffer, ending]);

  return { body, contentType: `multipart/form-data; boundary=${boundary}` };
}

async function runTests() {
  console.log("==========================================================");
  console.log("  Backend API Smoke Tests");
  console.log(`  Target: ${BASE}`);
  console.log("==========================================================\n");

  // 1. Health check
  console.log("1. Root health check (GET /):");
  try {
    const res = await request("GET", "/");
    log("Status 200", res.status === 200);
    log("Has project name", res.data?.project?.includes("Injured Animal"));
    log("Has endpoints", Boolean(res.data?.endpoints));
  } catch (err) {
    log("Server reachable", false, err.message);
    console.log("\n❌ Server is not running. Start it with: npm start\n");
    process.exit(1);
  }

  // 2. Detection status
  console.log("\n2. Detection status (GET /api/detection/status):");
  try {
    const res = await request("GET", "/api/detection/status");
    log("Status 200", res.status === 200);
    log("Success flag", res.data?.success === true);
    log("Has AI config", Boolean(res.data?.ai_configuration));
    log("Has statistics", Boolean(res.data?.statistics));
    console.log(`     AI Mode: ${res.data?.ai_configuration?.mode || "unknown"}`);
    console.log(`     DB Connected: ${res.data?.database_connected}`);
  } catch (err) {
    log("Status endpoint", false, err.message);
  }

  // 3. Start detection
  console.log("\n3. Start detection (POST /api/detection/start):");
  try {
    const body = JSON.stringify({ camera_id: CAMERA_ID });
    const res = await request("POST", "/api/detection/start", body, {
      "Content-Type": "application/json",
    });
    log("Status 200", res.status === 200);
    log("Success", res.data?.success === true);
  } catch (err) {
    log("Start detection", false, err.message);
  }

  // 4. Analyze frame
  console.log("\n4. Analyze frame (POST /api/detection/analyze):");
  try {
    const jpeg = createTestJpeg();
    const { body, contentType } = buildMultipart(
      { camera_id: CAMERA_ID, location: "Test Location" },
      "image",
      jpeg,
      "test-frame.jpg",
      "image/jpeg"
    );
    const res = await request("POST", "/api/detection/analyze", body, {
      "Content-Type": contentType,
      "Content-Length": body.length,
    });
    log("Status 200", res.status === 200);
    log("Success", res.data?.success === true);
    log("Has analysis", Boolean(res.data?.analysis));
    if (res.data?.analysis) {
      const a = res.data.analysis;
      console.log(`     Animal: ${a.animal_detected} (${a.animal_type})`);
      console.log(`     Injured: ${a.injured} (${a.injury_type})`);
      console.log(`     Confidence: ${a.confidence}`);
    }
    if (res.data?.report_created) {
      console.log(`     📝 Report created: ${res.data.report?.report_id}`);
    }
    if (res.data?.is_duplicate) {
      console.log(`     ⏳ Duplicate: ${res.data.duplicate_reason}`);
    }
  } catch (err) {
    log("Analyze frame", false, err.message);
  }

  // 5. Duplicate test (rapid re-send)
  console.log("\n5. Duplicate detection (POST /api/detection/analyze — rapid re-send):");
  try {
    const jpeg = createTestJpeg();
    const { body, contentType } = buildMultipart(
      { camera_id: CAMERA_ID, location: "Test Location" },
      "image",
      jpeg,
      "test-frame-2.jpg",
      "image/jpeg"
    );
    const res = await request("POST", "/api/detection/analyze", body, {
      "Content-Type": contentType,
      "Content-Length": body.length,
    });
    log("Status 200", res.status === 200);
    log("Success", res.data?.success === true);
    // The mock cycles, so duplicate detection may or may not trigger
    console.log(`     Duplicate: ${res.data?.is_duplicate || false}`);
  } catch (err) {
    log("Duplicate test", false, err.message);
  }

  // 6. List reports
  console.log("\n6. List reports (GET /api/reports):");
  try {
    const res = await request("GET", "/api/reports?limit=5");
    log("Status 200", res.status === 200);
    log("Success", res.data?.success === true);
    log("Has data array", Array.isArray(res.data?.data));
    log("Has pagination", Boolean(res.data?.pagination));
    console.log(`     Total reports: ${res.data?.pagination?.total || 0}`);
  } catch (err) {
    log("List reports", false, err.message);
  }

  // 7. Stop detection
  console.log("\n7. Stop detection (POST /api/detection/stop):");
  try {
    const body = JSON.stringify({ camera_id: CAMERA_ID });
    const res = await request("POST", "/api/detection/stop", body, {
      "Content-Type": "application/json",
    });
    log("Status 200", res.status === 200);
    log("Success", res.data?.success === true);
  } catch (err) {
    log("Stop detection", false, err.message);
  }

  // Summary
  console.log("\n==========================================================");
  console.log(`  Results: ${passedTests}/${totalTests} passed`);
  console.log("==========================================================\n");

  process.exit(passedTests === totalTests ? 0 : 1);
}

runTests();
