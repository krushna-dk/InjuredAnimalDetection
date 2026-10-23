const axios = require("axios");

const BASE_URL = "http://localhost:5000";

async function runTests() {
  console.log("=================================================");
  console.log("🧪 TESTING MANUAL REPORT & PAST REPORTS MODULE");
  console.log("=================================================");

  try {
    // 1. Health check
    console.log("\n1. Testing Backend Root Endpoint...");
    const health = await axios.get(`${BASE_URL}/`);
    console.log("✅ Server response:", health.data.status);

    // 2. Initial Statistics
    console.log("\n2. Fetching Platform Statistics...");
    const statsRes = await axios.get(`${BASE_URL}/api/reports/statistics`);
    console.log("✅ Initial Stats:", statsRes.data.data);

    // 3. Create a Manual Citizen Report
    console.log("\n3. Submitting New Manual Citizen Report...");
    const newReportPayload = {
      animal_type: "Dog",
      breed: "Indian Pariah (Indie)",
      injury_type: "Limping / Suspected Fracture",
      severity: "Moderate",
      description: "Brown stray dog limping on front left leg near local market shop.",
      location: "Market Yard Road, Sangamner",
      latitude: 19.5772,
      longitude: 74.2085,
      report_date: "2026-09-21",
      report_time: "19:45:00",
      reporter_name: "Citizen Volunteer",
      reporter_contact: "9876543210",
      report_source: "MANUAL"
    };

    const createRes = await axios.post(`${BASE_URL}/api/reports`, newReportPayload);
    console.log("✅ Manual Report Submission Response:");
    console.log("   - Message:", createRes.data.message);
    console.log("   - Report Code:", createRes.data.report_code);
    console.log("   - Delivery Status:", createRes.data.delivery_status);

    if (!createRes.data.report_code.startsWith("IA-2026-")) {
      throw new Error(`Report code format invalid: ${createRes.data.report_code}`);
    }

    // 4. Fetch Past Reports with source=MANUAL filter
    console.log("\n4. Fetching Past Reports (source=MANUAL)...");
    const manualReportsRes = await axios.get(`${BASE_URL}/api/reports?source=MANUAL`);
    const reports = manualReportsRes.data.data;
    console.log(`✅ Retrieved ${reports.length} manual reports.`);

    const found = reports.find(r => r.report_code === createRes.data.report_code);
    if (found) {
      console.log(`✅ Verified submitted report ${found.report_code} is present in Past Reports!`);
      console.log("   - Animal:", found.animal_type);
      console.log("   - Severity:", found.severity);
      console.log("   - Source:", found.report_source);
      console.log("   - Location:", found.location_name);
      console.log("   - Status:", found.report_status);
      console.log("   - Reporter contact masked (Privacy):", found.reporter_contact === undefined ? "CONFIRMED MASKED" : "EXPOSED");
    } else {
      throw new Error("Submitted report was not found in manual reports list!");
    }

    // 5. Verify Updated Statistics
    console.log("\n5. Checking Updated Statistics...");
    const updatedStatsRes = await axios.get(`${BASE_URL}/api/reports/statistics`);
    console.log("✅ Updated Stats:", updatedStatsRes.data.data);

    console.log("\n=================================================");
    console.log("🎉 ALL TESTS PASSED SUCCESSFULLY!");
    console.log("=================================================");
  } catch (error) {
    console.error("❌ Test Failed:", error.response ? error.response.data : error.message);
    process.exit(1);
  }
}

runTests();
