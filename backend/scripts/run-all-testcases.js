const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
const path = require("path");

const BASE_URL = "http://localhost:5000";

async function runRuntimeTestSuite() {
  console.log("=================================================================");
  console.log("🚀 COMPREHENSIVE RUNTIME TEST SUITE FOR INJURED ANIMAL DETECTION");
  console.log("=================================================================");
  
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${message}`);
      failed++;
    }
  }

  // -------------------------------------------------------------
  // TEST SUITE 1: STATIC FILE SERVING & ROUTE INTEGRITY
  // -------------------------------------------------------------
  console.log("\n📁 [SUITE 1] Static Asset & Route Integrity");
  try {
    const rootRes = await axios.get(`${BASE_URL}/`);
    assert(rootRes.status === 200, "GET / responds with 200 OK");
    assert(rootRes.data.status === "API Server Running", "Health check confirms API status");

    const homeHtml = await axios.get(`${BASE_URL}/index.html`);
    assert(homeHtml.status === 200 && homeHtml.data.includes("Injured Animal Detection Using AI"), "GET /index.html serves correct page");

    const manualHtml = await axios.get(`${BASE_URL}/manual-report/manual-report.html`);
    assert(manualHtml.status === 200 && manualHtml.data.includes("Manual Report Submission"), "GET /manual-report/manual-report.html serves form");

    const cssRes = await axios.get(`${BASE_URL}/style.css`);
    assert(cssRes.status === 200 && cssRes.data.includes("camera-viewfinder-container"), "GET /style.css contains viewfinder styles");

    const jsRes = await axios.get(`${BASE_URL}/script.js`);
    assert(jsRes.status === 200 && jsRes.data.includes("loadPastReports"), "GET /script.js serves landing page script");

    const manualJsRes = await axios.get(`${BASE_URL}/manual-report/manual-report.js`);
    assert(manualJsRes.status === 200 && manualJsRes.data.includes("startCameraStream"), "GET /manual-report/manual-report.js serves camera logic");
  } catch (err) {
    assert(false, `Suite 1 request failed: ${err.message}`);
  }

  // -------------------------------------------------------------
  // TEST SUITE 2: MANUAL REPORT SUBMISSION (EDGE CASES & VALIDATION)
  // -------------------------------------------------------------
  console.log("\n📝 [SUITE 2] Manual Report Submission & Validation");

  // Test 2A: Valid submission with multipart image file
  let createdReportCode = null;
  try {
    // Create a dummy temporary image file
    const tempImgPath = path.join(__dirname, "temp-test-image.jpg");
    fs.writeFileSync(tempImgPath, "fake-binary-image-data-for-testing-purposes");

    const form = new FormData();
    form.append("image", fs.createReadStream(tempImgPath));
    form.append("animal_type", "Dog");
    form.append("breed", "Indian Pariah (Indie)");
    form.append("injury_type", "Limping / Suspected Limb Fracture");
    form.append("severity", "Moderate");
    form.append("description", "Dog limping near fruit stall, reluctant to bear weight on front left leg.");
    form.append("location", "Sangamner Bus Stand Chowk");
    form.append("latitude", "19.5765");
    form.append("longitude", "74.2072");
    form.append("report_date", "2026-09-21");
    form.append("report_time", "20:05:00");
    form.append("reporter_name", "Local Shopkeeper");
    form.append("reporter_contact", "9822114455");
    form.append("report_source", "MANUAL");

    const submitRes = await axios.post(`${BASE_URL}/api/reports`, form, {
      headers: form.getHeaders()
    });

    assert(submitRes.status === 201, "POST /api/reports creates report with 201 Created");
    assert(submitRes.data.success === true, "Response flag success is true");
    assert(submitRes.data.message === "Report submitted successfully.", "Response message matches Master Spec Section 6");
    assert(submitRes.data.delivery_status === "Your report has been forwarded to the rescue team.", "Delivery status confirms forwarding");
    assert(submitRes.data.report_code && submitRes.data.report_code.startsWith("IA-2026-"), `Report ID format is IA-YYYY-XXXXX: ${submitRes.data.report_code}`);
    assert(submitRes.data.report.report_source === "MANUAL", "Report source is tagged as MANUAL");
    assert(submitRes.data.report.reporter_contact === undefined, "Reporter contact is masked in response (Privacy Protection)");

    createdReportCode = submitRes.data.report_code;

    // Cleanup temp image
    if (fs.existsSync(tempImgPath)) fs.unlinkSync(tempImgPath);
  } catch (err) {
    assert(false, `Test 2A failed: ${err.response ? JSON.stringify(err.response.data) : err.message}`);
  }

  // Test 2B: Validation - Missing animal_type
  try {
    const invalidForm = new FormData();
    invalidForm.append("description", "Some description without species");

    await axios.post(`${BASE_URL}/api/reports`, invalidForm, {
      headers: invalidForm.getHeaders()
    });
    assert(false, "Server should reject submission without animal_type");
  } catch (err) {
    assert(err.response && err.response.status === 400, "Validation properly rejects missing animal_type with 400 Bad Request");
    assert(err.response.data.message.includes("Animal species/type is required"), "Validation error message is informative");
  }

  // Test 2C: Severity normalization fallback
  try {
    const res = await axios.post(`${BASE_URL}/api/reports`, {
      animal_type: "Cat",
      severity: "UnknownNonExistentSeverity",
      location: "Shivaji Nagar"
    });
    assert(res.status === 201, "Server handles unlisted severity gracefully");
    assert(res.data.report.severity === "Moderate", "Normalizes invalid severity to 'Moderate'");
  } catch (err) {
    assert(false, `Test 2C failed: ${err.message}`);
  }

  // -------------------------------------------------------------
  // TEST SUITE 3: PAST REPORTS QUERYING & FILTERING
  // -------------------------------------------------------------
  console.log("\n📋 [SUITE 3] Past Reports Retrieval & Privacy Filters");
  try {
    // All reports
    const allRes = await axios.get(`${BASE_URL}/api/reports`);
    assert(allRes.status === 200, "GET /api/reports returns 200 OK");
    assert(Array.isArray(allRes.data.data), "Reports list is an array");
    assert(allRes.data.data.length >= 3, `Feed contains multiple reports (found ${allRes.data.data.length})`);

    // Verify privacy masking across all reports
    const exposedPhone = allRes.data.data.some(r => r.reporter_contact !== undefined && r.reporter_contact !== null);
    assert(!exposedPhone, "No reporter phone numbers exposed in public list (Section 24 Privacy)");

    // Filter by MANUAL
    const manualOnly = await axios.get(`${BASE_URL}/api/reports?source=MANUAL`);
    assert(manualOnly.data.data.every(r => r.report_source === "MANUAL"), "Filter source=MANUAL returns strictly manual reports");

    // Filter by AUTOMATIC
    const autoOnly = await axios.get(`${BASE_URL}/api/reports?source=AUTOMATIC`);
    assert(autoOnly.data.data.every(r => r.report_source === "AUTOMATIC"), "Filter source=AUTOMATIC returns strictly automatic reports");

    // Single report retrieval
    if (createdReportCode) {
      const singleRes = await axios.get(`${BASE_URL}/api/reports/${createdReportCode}`);
      assert(singleRes.status === 200, `GET /api/reports/${createdReportCode} returns report details`);
      assert(singleRes.data.report.report_code === createdReportCode, "Retrieved report code matches");
      assert(Array.isArray(singleRes.data.report.rescue_contacts) && singleRes.data.report.rescue_contacts.length > 0, "Attached emergency rescue contacts for dispatch");
    }

    // 404 check for non-existent report
    try {
      await axios.get(`${BASE_URL}/api/reports/IA-9999-99999`);
      assert(false, "Should return 404 for non-existent report ID");
    } catch (err404) {
      assert(err404.response && err404.response.status === 404, "Correctly returns 404 for unknown report ID");
    }
  } catch (err) {
    assert(false, `Suite 3 query failed: ${err.message}`);
  }

  // -------------------------------------------------------------
  // TEST SUITE 4: PLATFORM METRICS & STATISTICAL INTEGRITY
  // -------------------------------------------------------------
  console.log("\n📊 [SUITE 4] Platform Statistics & Guardrail Verification");
  try {
    const statsRes = await axios.get(`${BASE_URL}/api/reports/statistics`);
    assert(statsRes.status === 200, "GET /api/reports/statistics returns 200 OK");
    const s = statsRes.data.data;

    assert(typeof s.total_reports === "number" && s.total_reports > 0, `Total reports is numeric: ${s.total_reports}`);
    assert(typeof s.manual_reports === "number" && s.manual_reports > 0, `Manual reports is numeric: ${s.manual_reports}`);
    assert(typeof s.automatic_reports === "number" && s.automatic_reports > 0, `Automatic reports is numeric: ${s.automatic_reports}`);
    assert(s.total_reports === s.manual_reports + s.automatic_reports, "Mathematical integrity: total_reports == manual_reports + automatic_reports");
    assert(s.reports_forwarded === s.total_reports, "All verified reports are forwarded to rescue teams");

    // Strict Spec Guardrail Check (Section 21 & 37)
    assert(s.rescued === undefined, "CRITICAL GUARDRAIL: Statistics NEVER claim unverified 'rescued' status");
  } catch (err) {
    assert(false, `Suite 4 failed: ${err.message}`);
  }

  // -------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------
  console.log("\n=================================================================");
  console.log(`🏁 TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log("=================================================================");

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log("🎉 ALL RUNTIME TEST CASES PASSED WITH ZERO ERRORS!");
    process.exit(0);
  }
}

runRuntimeTestSuite();
