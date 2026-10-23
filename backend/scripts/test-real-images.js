"use strict";

const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const aiService = require("../services/aiService");

async function testImages() {
  console.log("=============================================================");
  console.log("🐾 TESTING REAL-WORLD IMAGES WITH LIVE GEMINI VISION API");
  console.log("=============================================================");
  console.log(`Provider: ${process.env.AI_PROVIDER}`);
  console.log(`Model:    ${process.env.AI_MODEL}`);
  console.log(`API Key:  ${process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.slice(0, 10) + "..." : "NONE"}\n`);

  const testDir = path.join(__dirname, "../../assets/test");
  const files = fs.readdirSync(testDir);

  for (const file of files) {
    const filePath = path.join(testDir, file);
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) continue;

    console.log(`\n-------------------------------------------------------------`);
    console.log(`📸 Testing Image: [${file}] (${(stat.size / 1024).toFixed(1)} KB)`);
    console.log(`-------------------------------------------------------------`);

    try {
      const mimeType = file.endsWith(".png") ? "image/png" : "image/jpeg";
      const result = await aiService.analyzeImage(filePath, mimeType);
      
      console.log(`Result:`);
      console.log(`  - Animal Detected:  ${result.animal_detected ? "✅ YES" : "❌ NO"}`);
      console.log(`  - Animal Type:      ${result.animal_type}`);
      console.log(`  - Breed:            ${result.breed}`);
      console.log(`  - Injured:          ${result.injured ? "🚨 YES" : "💚 NO (Healthy)"}`);
      console.log(`  - Injury Type:      ${result.injury_type}`);
      console.log(`  - Severity:         ${result.severity}`);
      console.log(`  - Confidence:       ${(result.confidence * 100).toFixed(1)}%`);
      console.log(`  - Description:      ${result.description}`);
      console.log(`  - Action:           ${result.recommended_action}`);
    } catch (err) {
      console.error(`❌ Error analyzing ${file}:`, err.message);
      if (err.response) {
        console.error(`   Details:`, err.response.data);
      }
    }

    // Brief delay between batch requests
    await new Promise((r) => setTimeout(r, 1500));
  }

  console.log("\n=============================================================");
  console.log("🏁 REAL-WORLD IMAGE TESTS COMPLETE");
  console.log("=============================================================\n");
}

testImages();
